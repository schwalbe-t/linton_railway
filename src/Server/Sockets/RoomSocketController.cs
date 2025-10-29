
using System.Collections.Concurrent;
using System.Net.WebSockets;
using Linton.Server.Sockets;
using Newtonsoft.Json;

namespace Linton.Server;


public sealed class RoomSocketController(ILogger<RoomSocketController> logger)
    : SocketController(logger)
{

    readonly ConcurrentDictionary<Guid, Guid> _playerRoomId = new();

    public override void OnMessage(Socket socket, string message)
    {
        InEvent e;
        try
        {
            e = JsonConvert.DeserializeObject<InEvent>(
                message, JsonSettings.Settings
            ) ?? throw new JsonSerializationException("InEvent is null");
        }
        catch (JsonSerializationException ex)
        {
            socket.SendJson(new OutEvent.InvalidMessage(
                $"Failed to parse event message: {ex.Message}"
            ));
            socket.Close(WebSocketCloseStatus.ProtocolError);
            return;
        }
        // TODO!
    }

    public override void OnDisconnect(Socket socket)
    {
        // TODO!
    }

}