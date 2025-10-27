
namespace Linton.Server;

public abstract class RoomState
{
    public sealed class Dying : RoomState
    {
        public readonly long Until = DateTimeOffset.Now.ToUnixTimeMilliseconds()
            + Room.CLOSURE_DELAY_MS;

    }   
}

public class Room(string id, RoomSettings settings)
{

    // Minimum time that needs to pass before the room registry cleanup
    // is allowed to delete a dying room
    public static readonly long CLOSURE_DELAY_MS = 300_000;
    // Reject room join requests after this number of connections
    public static readonly int MAX_NUM_CONNECTIONS = 32;




}