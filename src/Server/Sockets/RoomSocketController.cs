
using System.Collections.Concurrent;
using System.Net.WebSockets;
using Linton.Server.Sockets;
using Newtonsoft.Json;

namespace Linton.Server;


/// <summary>
/// Responsible for handling incoming events from clients connected to rooms.
/// </summary>
/// <param name="logger">the logger</param>
public sealed class RoomSocketController(ILogger<RoomSocketController> logger)
    : SocketController(logger)
{

    readonly ConcurrentDictionary<Guid, Room> _playerRooms = new();

    /// <summary>
    /// Handles a new client connecting to the server.
    /// </summary>
    /// <param name="socket">the new connection</param>
    public override void OnConnect(Socket socket)
    {
        socket.SendJson(new OutEvent.Identification(
            socket.Id
        ));
    }

    /// <summary>
    /// Handles a plain text message received from any room socket connection.
    /// </summary>
    /// <param name="socket">the socket the message came from</param>
    /// <param name="message">the plain text contents</param>
    public override void OnMessage(Socket socket, string message)
    {
        InEvent inEvent;
        try
        {
            inEvent = JsonConvert.DeserializeObject<InEvent>(
                message, JsonSettings.Settings
            ) ?? throw new JsonSerializationException("InEvent is null");
        }
        catch (JsonSerializationException ex)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                $"Failed to parse event message: {ex.Message}"
            ));
            return;
        }
        if (_playerRooms.TryGetValue(socket.Id, out Room? room))
        {
            OnRoomEvent(socket, inEvent, room);
            return;
        }
        OnSeparatedEvent(socket, inEvent);
    }

    /// <summary>
    /// Handles an incoming event from a client that has not registered to
    /// be in any specific room.
    /// </summary>
    /// <param name="socket">the socket the event came from</param>
    /// <param name="inEvent">the event</param>
    void OnSeparatedEvent(Socket socket, InEvent inEvent)
    {
        if (inEvent is not InEvent.JoinRoom joinRoom)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                "Client must send 'join_room'-event before using other events"
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (joinRoom.Name.Length > InEvent.JoinRoom.NameLengthLimit)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                "Requested name inside of room is too long"
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        Room? foundRoom = RoomRegistry.Rooms.GetValueOrDefault(joinRoom.RoomId);
        if (foundRoom is not Room room)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                "The requested room does not exist"
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (room.Connected.Count >= Room.MaxNumConnections)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                "The requested room is full"
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        if (!room.TryConnect(socket.Id, joinRoom.Name, socket)) {
            // connection may fail if the room has been closed since the time
            // we looked it up in the rooms index
            socket.SendJson(new OutEvent.InvalidMessage(
                "The requested room does not exist"
            ));
            socket.Close(WebSocketCloseStatus.PolicyViolation);
            return;
        }
        _playerRooms[socket.Id] = room;
    }
    
    /// <summary>
    /// Handles an incoming event from a client that is currently connected
    /// to a specific room.
    /// </summary>
    /// <param name="socket">the socket the event came from</param>
    /// <param name="inEvent">the event</param>
    /// <param name="room">the room the client is connected to</param>
    static void OnRoomEvent(Socket socket, InEvent inEvent, Room room)
    {
        // events that don't require client to be owner
        switch (inEvent)
        {
            case InEvent.JoinRoom:
                socket.SendJson(new OutEvent.InvalidMessage(
                    "This client has already joined a room"
                ));
                socket.Close(WebSocketCloseStatus.PolicyViolation);
                return;
            
            case InEvent.IsReady:
                if (room.State is not RoomState.Waiting waiting) { return; }
                waiting.OnHasBecomeReady(room, socket.Id);
                return;

            case InEvent.ChatMessage message:
                if (message.Contents.Length > InEvent.ChatMessage.LengthLimit)
                {
                    socket.SendJson(new OutEvent.InvalidMessage(
                        "Chat message is too long"
                    ));
                    return;
                }
                string? foundSender = room.Connected
                    .GetValueOrDefault(socket.Id)
                    ?.Name;
                if (foundSender is not string senderName) { return; }
                room.BroadcastEvent(new OutEvent.ChatMessage(
                    senderName, message.Contents
                ));
                return;
        }
        // events that require client to be owner
        if (room.Owner != socket.Id)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                "This client is not the current owner of the room"
            ));
            return;
        }
        switch (inEvent)
        {
            case InEvent.KickPlayer kickPlayer:
                room.Connected.GetValueOrDefault(kickPlayer.KickedId)
                    ?.Socket?.Close();
                return;
            
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
    public override void OnDisconnect(Socket socket)
    {
        if (!_playerRooms.Remove(socket.Id, out Room? room)) { return; }
        room.OnDisconnect(socket.Id);
    }

}