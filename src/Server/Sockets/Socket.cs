
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json;

namespace Linton.Server.Sockets;


/// <summary>
/// Represents a high-level WebSocket connection.
/// </summary>
/// <param name="connection">The underlying WebSocket connection</param>
public sealed class Socket(WebSocket connection)
{

    readonly WebSocket _connection = connection;

    readonly SemaphoreSlim _sendLock = new(1, 1);

    /// <summary>
    /// Uniquely identifies this socket.
    /// </summary>
    public readonly Guid Id = Guid.NewGuid();

    internal async Task<string?> ReceiveTextAsync(
        CancellationToken cancelToken = default
    )
    {
        using var ms = new MemoryStream();
        var buffer = new byte[4096];
        var bufferSeg = new ArraySegment<byte>(buffer);
        WebSocketReceiveResult result;
        do
        {
            result = await _connection.ReceiveAsync(bufferSeg, cancelToken);
            ms.Write(buffer, 0, result.Count);
        } while (!result.EndOfMessage);
        if (result.MessageType == WebSocketMessageType.Close) { return null; }
        ms.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(ms, Encoding.UTF8);
        return await reader.ReadToEndAsync(cancelToken);
    }

    /// <summary>
    /// Asynchronously sends the given plain text message to the client
    /// over this connection.
    /// </summary>
    /// <param name="message">the message to send</param>
    /// <param name="cancelToken">cancellation token</param>
    /// <returns></returns>
    public async Task SendTextAsync(
        string message, CancellationToken cancelToken = default
    )
    {
        byte[] buffer = Encoding.UTF8.GetBytes(message);
        var bufferSeg = new ArraySegment<byte>(buffer);
        await _sendLock.WaitAsync(cancelToken);
        try
        {
            await _connection.SendAsync(
                bufferSeg, WebSocketMessageType.Text, true, cancelToken
            );
        }
        catch (Exception)
        {
            // ignore errors during sending, if caused by websocket state
            // disconnection is handled somewhere else
        }
        finally
        {
            _sendLock.Release();
        }
    }

    /// <summary>
    /// Sends the given plain text message to the client over this connection.
    /// The method will return immediately, but it may take longer until the
    /// actual message is sent through the underlying connection.
    /// </summary>
    /// <param name="message">the message to send</param>
    public void SendText(string message)
    {
        // No need to await since we don't care about the result
        _ = SendTextAsync(message);
    }

    /// <summary>
    /// Sends a JSON representation of the given object over plain text to
    /// the client over this connection. The method will return immediately,
    /// but it may take longer until the actual message is sent through the
    /// underlying connection.
    /// </summary>
    /// <param name="message">the message to send</param>
    public void SendJson(object? message)
        => SendText(JsonConvert.SerializeObject(
            message, JsonSettings.Settings
        ));

    /// <summary>
    /// Closes this connection asynchronously, giving the ability to wait
    /// for the closure of the socket to complete.
    /// </summary>
    /// <param name="reason">the reason for closure</param>
    /// <param name="cancelToken">cancellation token</param>
    public async Task CloseAsync(
        WebSocketCloseStatus reason = WebSocketCloseStatus.NormalClosure,
        CancellationToken cancelToken = default
    )
    {
        await _sendLock.WaitAsync(cancelToken);
        try
        {
            await _connection.CloseAsync(reason, null, cancelToken);
        }
        catch (Exception)
        {
            // Errors that occur during closure can safely be ignored, at this
            // point the connection is already lost anyway
        }
        finally
        {
            _connection.Dispose();
            _sendLock.Release();
        }
    }

    /// <summary>
    /// Starts closing the connection. The method will return immediately,
    /// but it may take longer until the actual underlying connection is closed.
    /// </summary>
    /// <param name="reason">the reason for closure</param>
    public void Close(
        WebSocketCloseStatus reason = WebSocketCloseStatus.NormalClosure
    )
    {
        _ = CloseAsync(reason);
    }

}