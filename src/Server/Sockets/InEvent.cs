
using Newtonsoft.Json;

namespace Linton.Server.Sockets;


/// <summary>
/// Class representing the protocol for allowed messages from clients towards
/// the server connected via a websocket.
/// </summary>
public abstract record InEvent
{

    /// <summary>
    /// Used by clients to request to join a given room under a given name
    /// (client may not be connected to a room at this point)
    /// (must always be the first message sent)
    /// (name length must not exceed 'NameLengthLimit')
    /// </summary>
    /// <param name="RoomId">the ID of the room to connect to</param>
    /// <param name="Name">the name to join the room under</param>
    public sealed record JoinRoom(
        [property: JsonProperty("roomId")] Guid RoomId,
        [property: JsonProperty("name")] string Name
    ) : InEvent
    {
        public const int NameLengthLimit = 32;
    }

    /// <summary>
    /// Used by clients to specify that they are ready for the game to start.
    /// </summary>
    public sealed record IsReady : InEvent;

    /// <summary>
    /// Used by clients to change room sessions.
    /// Changes the settings of the room that the sender is connected to.
    /// The sender of the event must be the owner of the room.
    /// </summary>
    /// <param name="NewSettings">the new settings of the room</param>
    public sealed record ConfigureRoom(
        [property: JsonProperty("newSettings")] RoomSettings NewSettings
    ) : InEvent;

    /// <summary>
    /// Used by clients to send messages to all other players connected to the
    /// same room.
    /// (message length must not exeed 'ContentLengthLimit')
    /// </summary>
    /// <param name="Contents"></param>
    public sealed record ChatMessage(
        [property: JsonProperty("contents")] string Contents
    ) : InEvent
    {
        public const int LengthLimit = 256;
    }

}
