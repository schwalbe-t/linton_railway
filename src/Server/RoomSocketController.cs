
using Linton.Server.Sockets;

namespace Linton.Server;


public sealed class RoomSocketController(ILogger<RoomSocketController> logger)
    : SocketController(logger)
{

    readonly ILogger<RoomSocketController> _logger = logger;

    public override void OnConnect(Socket socket)
    {
        _logger.LogInformation("{socketId} connected", socket.Id);
    }

    public override void OnMessage(Socket socket, string message)
    {
        _logger.LogInformation("{socketId}: {message}", socket.Id, message);
        socket.SendText(message);
    }

    public override void OnDisconnect(Socket socket)
    {
        _logger.LogInformation("{socketId} disconnected", socket.Id);
    }

}