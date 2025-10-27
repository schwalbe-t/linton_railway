
using System.Collections.Concurrent;

namespace Linton.Server;

public class RoomRegistry
{

    public static readonly long CREATION_COOLDOWN_MS = 3 * 60_000;
    // don't auto-add players to public room if the player count is equal to
    // this number
    public static readonly int MAX_PUBLIC_PLAYER_C = 5;

    readonly ConcurrentDictionary<string, Room> _rooms = new();
    readonly ConcurrentDictionary<string, Room> _publicRooms = new();
    readonly ConcurrentDictionary<string, long> _clientCooldowns = new();

    public bool MayCreateRoom(string clientIp)
    {
        if (!_clientCooldowns.TryGetValue(clientIp, out long until))
        {
            return true;
        }
        bool hasExpired = DateTimeOffset.Now.ToUnixTimeMilliseconds() >= until;
        if (hasExpired)
        {
            _clientCooldowns.Remove(clientIp, out _);
        }
        return hasExpired;
    }
    
    public void RunCleanup()
    {
        long time = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        foreach (var cooldownEntry in _clientCooldowns)
        {
            if (time < cooldownEntry.Value) { continue; }
            _clientCooldowns.Remove(cooldownEntry.Key, out _);
        }
        foreach (var roomEntry in _rooms)
        {
            
        }
    }

}