
using System.Collections.Concurrent;
using System.Net.WebSockets;
using Linton.Game;
using Linton.Server.Sockets;
using Newtonsoft.Json;

namespace Linton.Server;


/// <summary>
/// Responsible for handling incoming events from clients connected to rooms.
/// </summary>
/// <param name="logger">the logger</param>
public sealed class RoomSocketController(ILogger<RoomSocketController> logger)
    : SocketController<Session>(logger)
{
    
    /// <summary>
    /// Handles a new client connecting to the server.
    /// </summary>
    /// <param name="socket">the new connection</param>
    /// <param name="session">the user session</param>
    /// <returns>the new socket context</returns>
    public override void OnConnect(Socket socket, Session session)
    {
        socket.SendJson(new OutEvent.Identification(
            session.SessionId, session.PlayerId
        ));
    }

    /// <summary>
    /// Handles a plain text message received from any room socket connection.
    /// </summary>
    /// <param name="socket">the socket the message came from</param>
    /// <param name="session">the user session</param>
    /// <param name="message">the plain text contents</param>
    public override void OnMessage(
        Socket socket, Session session, string message)
    {
        InEvent inEvent;
        try
        {
            inEvent = JsonConvert.DeserializeObject<InEvent>(
                message, JsonSettings.Settings
            ) ?? throw new JsonSerializationException("InEvent is null");
        }
        catch (JsonSerializationException)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.MessageParsingFailed
            ));
            return;
        }
        if (session.Room is Room room)
        {
            OnRoomEvent(socket, session, inEvent, room);
            return;
        }
        OnSeparatedEvent(socket, session, inEvent);
    }

    /// <summary>
    /// Handles an incoming event from a client that has not registered to
    /// be in any specific room.
    /// </summary>
    /// <param name="socket">the socket the event came from</param>
    /// <param name="session">the user session</param>
    /// <param name="inEvent">the event</param>
    static void OnSeparatedEvent(
        Socket socket, Session session, InEvent inEvent
    )
    {
        if (inEvent is not InEvent.JoinRoom joinRoom)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.ClientNotInRoom
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (joinRoom.Name.Length > InEvent.JoinRoom.NameLengthLimit)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.UsernameTooLong
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        Room? foundRoom = RoomRegistry.Rooms.GetValueOrDefault(joinRoom.RoomId);
        if (foundRoom is not Room room)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.RoomDoesNotExist
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (room.Connected.Count >= Room.MaxNumConnections)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.RoomIsFull
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (!room.TryConnect(session.PlayerId, joinRoom.Name, socket))
        {
            // connection may fail if the room has been closed since the time
            // we looked it up in the rooms index
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.RoomDoesNotExist
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        session.Room = room;
    }

    /// <summary>
    /// Handles an incoming event from a client that is currently connected
    /// to a specific room.
    /// </summary>
    /// <param name="socket">the socket the event came from</param>
    /// <param name="session">the user session</param>
    /// <param name="inEvent">the event</param>
    /// <param name="room">the room the client is connected to</param>
    static void OnRoomEvent(
        Socket socket, Session session, InEvent inEvent, Room room
    )
    {
        // events that don't require client to be owner
        switch (inEvent)
        {
            case InEvent.JoinRoom:
                socket.SendJson(new OutEvent.InvalidMessage(
                    OutEvent.InvalidMessage.ErrorReason.ClientAlreadyInRoom
                ));
                socket.Close(WebSocketCloseStatus.PolicyViolation);
                return;

            case InEvent.IsReady:
                if (room.State is not RoomState.Waiting waiting) { return; }
                waiting.OnHasBecomeReady(room, session.PlayerId);
                return;

            case InEvent.ChatMessage message:
                if (message.Contents.Length > InEvent.ChatMessage.LengthLimit)
                {
                    socket.SendJson(new OutEvent.InvalidMessage(
                        OutEvent.InvalidMessage.ErrorReason.ChatMessageTooLong
                    ));
                    return;
                }
                string? foundSender = room.Connected
                    .GetValueOrDefault(session.PlayerId)
                    ?.Name;
                if (foundSender is not string senderName) { return; }
                room.BroadcastEvent(new OutEvent.ChatMessage(
                    senderName, SenderId: session.PlayerId, message.Contents
                ));
                return;

            case InEvent.SwitchStateUpdates updates:
                if (room.State is not RoomState.Playing playing) { return; }
                GameInstance game = playing.Game;
                game.State.UpdateSwitchStates(
                    updates.Updates, session.PlayerId, game.Network
                );
                return;
        }
        // events that require client to be owner
        if (room.Owner != session.PlayerId)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                OutEvent.InvalidMessage.ErrorReason.ClientNotRoomOwner
            ));
            return;
        }
        switch (inEvent)
        {
            case InEvent.ConfigureRoom configureRoom:
                room.Settings = configureRoom.NewSettings;
                RoomRegistry.SetRoomPublic(room.Id, room.Settings.IsPublic);
                return;
        }
    }

    /// <summary>
    /// Handles a client disconnecting.
    /// </summary>
    /// <param name="socket">The disconnecting connection to the client</param>
    /// <param name="session">the user session</param>
    public override void OnDisconnect(Socket socket, Session session)
    {
        if (session.Room is Room room)
        {
            room.OnDisconnect(session.PlayerId);
        }
        session.StopUsage();
    }

}