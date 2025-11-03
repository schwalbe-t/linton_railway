
using System.Numerics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Linton.Server.Sockets;


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


public sealed class Vector3Converter : JsonConverter
{
    public override bool CanConvert(Type objectType)
        => typeof(Vector3).IsAssignableFrom(objectType);

    public override object? ReadJson(
        JsonReader reader, Type objectType, object? existingValue,
        JsonSerializer serializer
    )
    {
        float[]? foundNums = serializer.Deserialize<float[]>(reader);
        if (foundNums is not float[] nums)
        {
            throw new JsonSerializationException("Vector3 is not number array");
        }
        return new Vector3(nums[0], nums[1], nums[2]);
    }

    public override void WriteJson(
        JsonWriter writer, object? value, JsonSerializer serializer
    )
    {
        if (value is not Vector3 vector)
        {
            throw new JsonSerializationException("Not instance of Vector3");
        }
        writer.WriteStartArray();
        writer.WriteValue(vector.X);
        writer.WriteValue(vector.Y);
        writer.WriteValue(vector.Z);
        writer.WriteEndArray();
    }
}