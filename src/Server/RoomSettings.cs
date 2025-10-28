
using System.Runtime.Serialization;
using System.Text.Json.Serialization;

namespace Linton.Server;


[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TrainNameLanguage
{
    [EnumMember(Value = "en")] English,
    [EnumMember(Value = "de")] German,
    [EnumMember(Value = "bg")] Bulgarian
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TrainLength
{
    [EnumMember(Value = "short")] Short,
    [EnumMember(Value = "medium")] Medium,
    [EnumMember(Value = "long")] Long
}

public record RoomSettings(
    bool IsPublic,
    TrainNameLanguage TrainNameLanguage = TrainNameLanguage.English,
    bool TrainNameChanges = true,
    bool VariedTrainStyles = true,
    TrainLength TrainLength = TrainLength.Medium
) { }