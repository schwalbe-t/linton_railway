
using System.Net.WebSockets;
using Microsoft.AspNetCore.Mvc;

namespace Linton.Server.Sockets;


/// <summary>
/// An abstract API controller for websocket connections.
/// </summary>
public abstract class SocketController(ILogger logger) : ControllerBase
{

    /// <summary>
    /// Handles a new incoming websocket connection.
    /// </summary>
    /// <param name="socket">the newly connected socket</param>
    public virtual void OnConnect(Socket socket) { }

    /// <summary>
    /// Handles an incoming message from a given websocket connection.
    /// </summary>
    /// <param name="socket">the socket the message was received from</param>
    /// <param name="message">the message received</param>
    public virtual void OnMessage(Socket socket, string message) { }

    /// <summary>
    /// Handles a closed websocket connection.
    /// </summary>
    /// <param name="socket">the socket whose connection was closed</param>
    public virtual void OnDisconnect(Socket socket) { }


    readonly ILogger _logger = logger;

    /// <summary>
    /// Attempts to upgrade the current HTTP request to a websocket connection.
    /// </summary>
    /// <param name="context">the request context</param>
    /// <returns>the task representing the connection</returns>
    public async Task TryCreateConnection(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            return;
        }
        WebSocket ws = await context.WebSockets.AcceptWebSocketAsync();
        var socket = new Socket(ws);
        try
        {
            OnConnect(socket);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex, "SocketController connect handler threw exception"
            );
            await socket.CloseAsync(WebSocketCloseStatus.InternalServerError);
            return;
        }
        while (ws.State == WebSocketState.Open)
        {
            try
            {
                string? received = await socket.ReceiveTextAsync();
                if (received is not string message) { break; }
                OnMessage(socket, message);
            }
            catch (WebSocketException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex, "SocketController message handler threw exception"
                );
            }
        }
        try
        {
            OnDisconnect(socket);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex, "SocketController disconnect handler threw exception"
            );
        }
        await socket.CloseAsync();
    }

}