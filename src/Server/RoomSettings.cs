
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

public class RoomSettings
{
    public required bool roomIsPublic;
    public TrainNameLanguage trainNameLanguage = TrainNameLanguage.English;
    public bool trainNameChanges = true;
    public bool variedTrainStyles = true;
    public TrainLength trainLength = TrainLength.Medium;
}