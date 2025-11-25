
using Microsoft.AspNetCore.Mvc;

namespace Linton.Server;


/// <summary>
/// API controller for the room API.
/// </summary>
[ApiController]
[Route("api/rooms")]
public sealed class RoomApiController : ControllerBase
{
    /// <summary>
    /// Attempts to create a room under the given client IP, configuring it
    /// to be public if needed.
    /// </summary>
    /// <param name="clientIp">The IP of the client requesting the room</param>
    /// <param name="isPublic">Whether the room should be public</param>
    /// <returns>HTTP 200 (roomId) or HTTP 429 (on cooldown)</returns>
    IActionResult AttemptRoomCreation(string clientIp, bool isPublic)
    {
        if (!RoomRegistry.MayCreateRoom(clientIp))
        {
            // HTTP 429 - Too Many Requests
            return StatusCode(429, new { error = "Room creation on cooldown" });
        }
        Guid roomId = RoomRegistry.CreateRoom(clientIp, isPublic);
        return Ok(new { roomId });
    }

    /// <summary>
    /// Attempts to create a private room for the requesting user.
    /// </summary>
    /// <returns>
    /// 200 { roomId } - If client is not on cooldown
    /// 429 { error } - If client is on cooldown
    /// </returns>
    [HttpPost("create")]
    public IActionResult CreateRoom() => AttemptRoomCreation(
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        false
    );

    /// <summary>
    /// Attempts to find a public room to allocate the requesting user into,
    /// or attempts to create a new public room if none could be found.
    /// </summary>
    /// <returns>
    /// 200 { roomId } - If room found or was able to create room as client
    /// 429 { error } - If no room found and client on cooldown
    /// </returns>
    [HttpGet("findPublic")]
    public IActionResult FindPublicRoom()
    {
        Guid? existingId = RoomRegistry.FindPublicRoom();
        if (existingId is Guid roomId)
        {
            return Ok(new { roomId });
        }
        string clientIp = HttpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        return AttemptRoomCreation(clientIp, true);
    }

    [HttpGet("getInviteCode")]
    public IActionResult GetInviteCode(Guid roomId)
    {
        string? inviteCode = RoomRegistry.GetRoomInviteCode(roomId);
        if (inviteCode is not null) { return Ok(new { inviteCode }); }
        return StatusCode(400, new { error = "Room does not exist" });
    }

    [HttpGet("findByInviteCode")]
    public IActionResult FindByInviteCode(string inviteCode)
    {
        if (RoomRegistry.RoomInviteCodes.TryGetValue(inviteCode, out Guid i))
        {
            return Ok(new { roomId = i });
        }
        return StatusCode(400, new { error = "Unknown invite code" });
    }
}
