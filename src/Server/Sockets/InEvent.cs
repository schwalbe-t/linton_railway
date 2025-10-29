
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

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
    public sealed record IsReady : InEvent { }

    /// <summary>
    /// Used by clients to request disconnection of a player.
    /// Player must be present in the same room as the sender of the event.
    /// The sender of the event must be the owner of the room.
    /// </summary>
    /// <param name="KickedId">the ID of the player to disconnect</param>
    public sealed record KickPlayer(
        [property: JsonProperty("kickedId")] Guid KickedId
    ) : InEvent { }

    /// <summary>
    /// Used by clients to change room sessions.
    /// Changes the settings of the room that the sender is connected to.
    /// The sender of the event must be the owner of the room.
    /// </summary>
    /// <param name="NewSettings">the new settings of the room</param>
    public sealed record ConfigureRoom(
        [property: JsonProperty("newSettings")] RoomSettings NewSettings
    ) : InEvent { }

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
        public const int ContentLengthLimit = 256;
    }

}


public sealed class InEventConverter : JsonConverter
{
    public override bool CanConvert(Type objectType)
        => typeof(InEvent).IsAssignableFrom(objectType);

    public override object? ReadJson(
        JsonReader reader, Type objectType, object? existingValue,
        JsonSerializer serializer
    )
    {
        var jsonObject = JObject.Load(reader);
        string? type = jsonObject["type"]?.ToString();
        Type resultType = type switch
        {
            "join_room" => typeof(InEvent.JoinRoom),
            "is_ready" => typeof(InEvent.IsReady),
            "kick_player" => typeof(InEvent.KickPlayer),
            "configure_room" => typeof(InEvent.ConfigureRoom),
            "chat_message" => typeof(InEvent.ChatMessage),
            _ => throw new JsonSerializationException(
                $"Unknown InEvent type '{type}'"
            )
        };
        return jsonObject.ToObject(resultType, new JsonSerializer())
            ?? throw new JsonSerializationException(
                $"Failed to deserialize InEvent type '{type}'"
            );
    }

    public override void WriteJson(
        JsonWriter writer, object? value, JsonSerializer serializer
    )
    {
        throw new NotImplementedException("InEvent serialization");
    }
}