
using Microsoft.AspNetCore.Mvc;

namespace Linton.Server;

[ApiController]
[Route("api/rooms/[controller]")]
public class RoomApiController : ControllerBase
{
    private IActionResult AttemptRoomCreation(string clientIp, bool isPublic)
    {
        
    }

    [HttpPost("create")]
    public IActionResult CreateRoom() => AttemptRoomCreation(
        HttpContext.Connection.RemoteIpAddress
    )

    [HttpGet("/findPublic")]
    public IActionResult FindPublicRoom()
    {
        
    }
}
