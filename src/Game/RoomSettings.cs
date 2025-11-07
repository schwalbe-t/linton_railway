
using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace Linton.Game;


[JsonConverter(typeof(StringEnumConverter))]
public enum TrainNameLanguage
{
    [EnumMember(Value = "en")] English,
    [EnumMember(Value = "de")] German,
    [EnumMember(Value = "bg")] Bulgarian
}

[JsonConverter(typeof(StringEnumConverter))]
public enum TrainLength
{
    [EnumMember(Value = "short")] Short,
    [EnumMember(Value = "medium")] Medium,
    [EnumMember(Value = "long")] Long
}

public record RoomSettings(
    [property: JsonProperty("roomIsPublic")]
    bool IsPublic,
    [property: JsonProperty("trainNameLanguage")]
    TrainNameLanguage TrainNameLanguage = TrainNameLanguage.English,
    [property: JsonProperty("trainNameChanges")]
    bool TrainNameChanges = true,
    [property: JsonProperty("variedTrainStyles")]
    bool VariedTrainStyles = true,
    [property: JsonProperty("trainLength")]
    TrainLength TrainLength = TrainLength.Medium
);