
using Linton.Game;
using System.Collections.Concurrent;

namespace Linton.Server;


/// <summary>
/// Contains all rooms that exist on a given server.
/// This class manages room creation, allocation (for public games), deletion
/// and client room creation timeouts.
/// </summary>
public static class RoomRegistry
{

    /// <summary>
    /// Minimum amount of time that needs to pass between consecutive room
    /// creations by the same client IP address.
    /// </summary>
    public static readonly TimeSpan CreationCooldown = TimeSpan.FromMinutes(3);

    /// <summary>
    /// The target number of players in a public room for the public room
    /// allocation method. If two threads happen to allocate a client into the
    /// same room at the same time they are allowed to exceed this limit.
    /// </summary>
    public const int MaxNumPublicPlayers = 5;


    static readonly ConcurrentDictionary<Guid, Room> _rooms = new();
    public static IReadOnlyDictionary<Guid, Room> Rooms => _rooms;

    static readonly ConcurrentDictionary<Guid, Room> _publicRooms = new();

    static readonly ConcurrentDictionary<string, Guid> _roomInviteCodes = new();
    public static IReadOnlyDictionary<string, Guid> RoomInviteCodes
        => _roomInviteCodes;

    static readonly ConcurrentDictionary<string, DateTime> _clientCooldowns
        = new();

    static readonly Lock _lock = new();
    static readonly Random _rng = new();

    /// <summary>
    /// Checks if the given client IP is allowed to create a new room.
    /// </summary>
    /// <param name="clientIp">the IP of the client</param>
    /// <returns></returns>
    public static bool MayCreateRoom(string clientIp)
    {
        if (!_clientCooldowns.TryGetValue(clientIp, out DateTime until))
        {
            return true;
        }
        bool hasExpired = DateTime.UtcNow >= until;
        if (hasExpired)
        {
            _clientCooldowns.Remove(clientIp, out _);
        }
        return hasExpired;
    }

    /// <summary>
    /// Run a cleanup over all known rooms. This involves cleaning up
    /// the cooldown registry and closes any rooms which have been in the
    /// 'Dying' state for long enough. This method should be called 
    /// periodically (once every few minutes).
    /// </summary>
    public static void RunCleanup()
    {
        foreach (var entry in _clientCooldowns)
        {
            if (DateTime.UtcNow < entry.Value) { continue; }
            _clientCooldowns.Remove(entry.Key, out _);
        }
        foreach (var entry in _rooms)
        {
            if (entry.Value.State is not RoomState.Dying dying) { continue; }
            if (DateTime.UtcNow < dying.Until) { continue; }
            CloseRoom(entry.Key);
        }
    }

    /// <summary>
    /// Creates a new room under a given client IP.
    /// This adds a cooldown to the specified client IP.
    /// </summary>
    /// <param name="clientIp">the IP of the client</param>
    /// <param name="isPublic">starting 'RoomIsPublic'-property of the room</param>
    /// <returns></returns>
    public static Guid CreateRoom(string clientIp, bool isPublic)
    {
        Guid id = Guid.NewGuid();
        var settings = new RoomSettings(isPublic);
        var room = new Room(id, settings);
        _rooms[id] = room;
        SetRoomPublic(id, isPublic);
        _clientCooldowns[clientIp] = DateTime.UtcNow + CreationCooldown;
        return id;
    }

    /// <summary>
    /// Updates the given room to be visible to the 'FindPublicRoom'-method.
    /// Silently returns if the room does not exist.
    /// This does not update the room settings of the room themselves.
    /// </summary>
    /// <param name="roomId">the ID of the room</param>
    /// <param name="isPublic">whether or not the room should be visible</param>
    public static void SetRoomPublic(Guid roomId, bool isPublic)
    {
        Room? foundRoom = _rooms[roomId];
        if (foundRoom is not Room room) { return; }
        if (isPublic) { _publicRooms[roomId] = room; }
        else { _publicRooms.Remove(roomId, out _); }
    }

    /// <summary>
    /// Disconnects all players from the room with the given ID and closes it.
    /// </summary>
    /// <param name="roomId">the ID of the room to close</param>
    public static void CloseRoom(Guid roomId)
    {
        _publicRooms.Remove(roomId, out _);
        _rooms.Remove(roomId, out Room? room);
        room?.OnClose();
    }

    /// <summary>
    /// Finds the most suitable public room for a new player to connect to.
    /// This involves searching all public rooms for the one that (in order of
    /// decreasing priority):
    /// - Has less than the target number of players
    /// - Has the highest number of players
    /// - Has had the highest duration of time pass since a game has started
    ///   (or since the room has been created, whichever happend later)
    /// </summary>
    /// <returns>The Id of the found room, or null if none was found</returns>
    public static Guid? FindPublicRoom()
    {
        DateTime now = DateTime.UtcNow;
        Guid? bestId = null;
        int bestPlayerC = 0;
        double bestWaitTime = double.MaxValue;
        foreach (var entry in _publicRooms)
        {
            int roomPlayerC = entry.Value.Connected.Count;
            if (roomPlayerC >= MaxNumPublicPlayers) { continue; }
            if (roomPlayerC < bestPlayerC) { continue; }
            double waitTime = (now - entry.Value.LastGameTime).TotalSeconds;
            if (waitTime > bestWaitTime) { continue; }
            bestId = entry.Key;
            bestPlayerC = roomPlayerC;
            bestWaitTime = waitTime;
        }
        return bestId;
    }

    const string InviteCodeDigits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const int InviteCodeLength = 8;

    /// <summary>
    /// Generates a random, unique room invite code and maps it to the given
    /// room id.
    /// </summary>
    /// <param name="roomId">the ID of the room</param>
    /// <returns>the generated invite code</returns>
    static string GenerateRoomInviteCode(Guid roomId)
    {
        lock (_lock)
        {
            int digitCount = InviteCodeDigits.Length;
            string generated = "";
            do
            {
                char[] digits = Enumerable.Range(0, InviteCodeLength)
                    .Select(_ => InviteCodeDigits[_rng.Next(digitCount)])
                    .ToArray();
                generated = new string(digits);
            }
            while (!_roomInviteCodes.TryAdd(generated, roomId));
            return generated;
        }
    }

    /// <summary>
    /// Returns the invite code that matches the given room ID.
    /// If the given room does not currently have an invite code, a new one
    /// is created.
    /// </summary>
    /// <param name="roomId">the ID of the room</param>
    /// <returns>the room invite code (or null if room doesn't exist)</returns>
    public static string? GetRoomInviteCode(Guid roomId)
    {
        if (!Rooms.TryGetValue(roomId, out Room? room)) { return null; }
        if (room is null) { return null; }
        string? existingCode = room.InviteCode;
        if (existingCode is not null) { return existingCode; }
        string newCode = GenerateRoomInviteCode(roomId);
        if (room.TrySetInviteCode(newCode)) { return newCode; }
        _roomInviteCodes.Remove(newCode, out _);
        return room.InviteCode;
    }

}