
using System.Net.WebSockets;
using Microsoft.AspNetCore.Mvc;

namespace Linton.Server.Sockets;


/// <summary>
/// An abstract API controller for websocket connections.
/// </summary>
public abstract class SocketController<TContext>(ILogger logger)
    : ControllerBase
{

    /// <summary>
    /// Handles a new incoming websocket connection.
    /// </summary>
    /// <param name="socket">the newly connected socket</param>
    /// <returns>the context attached to this socket</returns>
    public abstract void OnConnect(Socket socket, TContext ctx);

    /// <summary>
    /// Handles an incoming message from a given websocket connection.
    /// </summary>
    /// <param name="socket">the socket the message was received from</param>
    /// <param name="ctx">the context associated with the socket</param>
    /// <param name="message">the message received</param>
    public abstract void OnMessage(Socket socket, TContext ctx, string message);

    /// <summary>
    /// Handles a closed websocket connection.
    /// </summary>
    /// <param name="socket">the socket whose connection was closed</param>
    /// <param name="ctx">the context associated with the socket</param>
    public abstract void OnDisconnect(Socket socket, TContext ctx);


    readonly ILogger _logger = logger;

    public delegate TContext ContextBuilder();

    /// <summary>
    /// Attempts to upgrade the current HTTP request to a websocket connection.
    /// </summary>
    /// <param name="context">the request context</param>
    /// <returns>the task representing the connection</returns>
    public async Task TryCreateConnection(
        HttpContext context, ContextBuilder contextBuilder
    )
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            return;
        }
        WebSocket ws = await context.WebSockets.AcceptWebSocketAsync();
        var socket = new Socket(ws);
        TContext userCtx = contextBuilder();
        try
        {
            OnConnect(socket, userCtx);
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
                OnMessage(socket, userCtx, message);
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
            OnDisconnect(socket, userCtx);
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