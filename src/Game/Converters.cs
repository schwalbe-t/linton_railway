
using System.Collections.Concurrent;
using Newtonsoft.Json;

namespace Linton.Game;


public sealed class ConcurrentDictionaryConverter<TKey, TValue>
    : JsonConverter<ConcurrentDictionary<TKey, TValue>>
    where TKey: notnull
    where TValue: notnull
{
    public override ConcurrentDictionary<TKey, TValue>? ReadJson(JsonReader reader, Type objectType, ConcurrentDictionary<TKey, TValue>? existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        throw new NotImplementedException(
            "ConcurrentDictionary deserialization"
        );
    }

    public override void WriteJson(
        JsonWriter writer, ConcurrentDictionary<TKey, TValue>? value,
        JsonSerializer serializer
    )
    {
        if (value is null) {
            writer.WriteNull();
            return;
        }
        writer.WriteStartArray();
        foreach (var entry in value)
        {
            writer.WriteStartObject();
            writer.WritePropertyName("key");
            serializer.Serialize(writer, entry.Key);
            writer.WritePropertyName("value");
            serializer.Serialize(writer, entry.Value);
            writer.WriteEndObject();
        }
        writer.WriteEndArray();
    }

}