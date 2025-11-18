
using Newtonsoft.Json;
using Linton.Server.Sockets;
using Linton.Game;

namespace Linton.Server;


public static class JsonSettings
{
    public static readonly JsonSerializerSettings Settings = new()
    {
        Converters =
        {
            new InEventConverter(),
            new Vector3Converter(),
            new ConcurrentDictionaryConverter<TrackConnection, ushort>()
        }
    };
}