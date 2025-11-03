
using Linton.Game;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using System.Runtime.Serialization;

namespace Linton.Server.Sockets;


/// <summary>
/// Class representing the protocol for allowed messages from the server towards
/// the clients connected via websocket.
/// </summary>
public abstract record OutEvent
{

    [property: JsonProperty("type")]
    public abstract string TypeString { get; }

    /// <summary>
    /// Invalid message received from client, explains why
    /// (usually followed by socket closing with reason PolicyViolation)
    /// </summary>
    /// <param name="Reason">why a previous message was invalid</param>
    public sealed record InvalidMessage(
        [property: JsonProperty("reason")] InvalidMessage.ErrorReason Reason
    ) : OutEvent
    {
        public override string TypeString => "invalid_message";

        /// <summary>
        /// Represents the reason for which a message may have been rejected.
        /// </summary>
        [JsonConverter(typeof(StringEnumConverter))]
        public enum ErrorReason
        {
            /// <summary>
            /// The plain text message was unable to be parsed into a valid
            /// event object.
            /// </summary>
            [EnumMember(Value = "message_parsing_failed")]
            MessageParsingFailed,
            /// <summary>
            /// Indicates that the client has not yet joined a room at the time
            /// of receiving the message, which is not allowed for the type
            /// of message received.
            /// </summary>
            [EnumMember(Value = "client_not_in_room")]
            ClientNotInRoom,
            /// <summary>
            /// Indicates that the client has already joined a room at the time
            /// of receiving the message, which is not allowed for the type
            /// of message received.
            /// </summary>
            [EnumMember(Value = "client_already_in_room")]
            ClientAlreadyInRoom,
            /// <summary>
            /// Indicates that the client was not the room owner at the time
            /// of receiving the message, which is not allowed for the type of
            /// message received.
            /// </summary>
            [EnumMember(Value = "client_not_room_owner")]
            ClientNotRoomOwner,
            /// <summary>
            /// Indicates that a given room ID refers to a room that does not
            /// currently exist.
            /// </summary>
            [EnumMember(Value = "room_does_not_exist")]
            RoomDoesNotExist,
            /// <summary>
            /// Indicates that a given room was full and could not be connected
            /// to at the time of receiving the message.
            /// </summary>
            [EnumMember(Value = "room_is_full")]
            RoomIsFull,
            /// <summary>
            /// Indicates that the provided username exceeds the maximum length
            /// limit for usernames.
            /// </summary>
            [EnumMember(Value = "username_too_long")]
            UsernameTooLong,
            /// <summary>
            /// Indicates that the provided chat message contents exceed the
            /// maximum length limit for chat messages.
            /// </summary>
            [EnumMember(Value = "chat_message_too_long")]
            ChatMessageTooLong
        }
    }

    /// <summary>
    /// Tells the client their own player ID
    /// </summary>
    /// <param name="PlayerId">the client player ID</param>
    public sealed record Identification(
        [property: JsonProperty("sessionId")] Guid SessionId,
        [property: JsonProperty("playerId")] Guid PlayerId
    ) : OutEvent
    {
        public override string TypeString => "identification";
    }

    /// <summary>
    /// Tells the clients about the room they are currently in
    /// </summary>
    /// <param name="Players">all players currently connected to the room</param>
    /// <param name="OwnerId">the current owner of the room</param>
    /// <param name="Settings">the room settings</param>
    /// <param name="State">the current state of the room</param>
    public sealed record RoomInfo(
        [property: JsonProperty("players")] List<RoomInfo.PlayerInfo> Players,
        [property: JsonProperty("owner")] Guid OwnerId,
        [property: JsonProperty("settings")] RoomSettings Settings,
        [property: JsonProperty("state")] string State
    ) : OutEvent
    {
        public override string TypeString => "room_info";

        /// <summary>
        /// Represents information about other players in the room
        /// </summary>
        /// <param name="Id">the ID of the player</param>
        /// <param name="Name">the name of the player</param>
        /// <param name="IsReady">whether the player is ready</param>
        public sealed record PlayerInfo(
            [property: JsonProperty("id")] Guid Id,
            [property: JsonProperty("name")] string Name,
            [property: JsonProperty("isReady")] bool IsReady
        )
        { }
    }

    /// <summary>
    /// Tells the clients that the room has encountered a critical internal
    /// error
    /// (usually followed by disconnect of all connected clients and immediate)
    /// closure of the room)
    /// </summary>
    public sealed record RoomCrashed : OutEvent
    {
        public override string TypeString => "room_crashed";
    }

    /// <summary>
    /// Tells the clients about a new chat message
    /// </summary>
    /// <param name="SenderName">name of the sender</param>
    /// <param name="Contents">contents of the message</param>
    public sealed record ChatMessage(
        [property: JsonProperty("senderName")] string SenderName,
        [property: JsonProperty("senderId")] Guid SenderId,
        [property: JsonProperty("contents")] string Contents
    ) : OutEvent
    {
        public override string TypeString => "chat_message";
    }

    /// <summary>
    /// Used to tell clients about the current world terrain.
    /// </summary>
    /// <param name="Terrain">the current world terrain</param>
    public sealed record TerrainInfo(
        [property: JsonProperty("terrain")] Terrain Terrain
    ) : OutEvent
    {
        public override string TypeString => "terrain_info";
    }

}
