
using Newtonsoft.Json;
using Linton.Server.Sockets;

namespace Linton.Server;


public static class JsonSettings
{
    public static readonly JsonSerializerSettings Settings = new()
    {
        Converters = { new InEventConverter() }
    };
}