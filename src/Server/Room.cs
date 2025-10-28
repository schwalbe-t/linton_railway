
using System.Collections.Concurrent;

namespace Linton.Server;


public class Room(Guid id, RoomSettings settings)
{
    /// <summary>
    /// The minimum amount of time that needs to pass (in milliseconds) before
    /// the room registry cleanup is allowed to delete a dying room.
    /// This duration is already included in the 'Until'-property of the 'Dying'
    /// room state.
    /// </summary>
    public static readonly TimeSpan ClosureDelay = TimeSpan.FromMinutes(5);
    /// <summary>
    /// Room connection requests should be rejected if this amount of clients
    /// is connected to the same room.
    /// </summary>
    public const int MaxNumConnections = 32;


    readonly Lock _lock = new();

    RoomState _state = new RoomState.Dying();
    public RoomState State
    {
        get { lock (_lock) { return _state; } }
        set
        {
            lock (_lock) { _state = value; }
            BroadcastRoomInfo();
        }
    }

    readonly ConcurrentDictionary<Guid, User> _connected = new();
    public IReadOnlyDictionary<Guid, User> Connected => _connected;

    Guid? _owner = null;
    /// <summary>
    /// Specifies the owner of the room (or null if the room is empty).
    /// The owner is the one that is allowed to change room settings and
    /// disconnect players.
    /// </summary>
    public Guid? Owner
    {
        get { lock (_lock) { return _owner; } }
        private set
        {
            lock (_lock) { _owner = value; }
            BroadcastRoomInfo();
        }
    }

    /// <summary>
    /// The UNIX time stamp of the last time a game ended (or the point in time
    /// when the room was created).
    /// </summary>
    public long LastGameTime = DateTimeOffset.Now.ToUnixTimeMilliseconds();

    /// <summary>
    /// Updates the state of the room.
    /// </summary>
    public void Update()
    {
        Guid? prevOwner = Owner;
        if (prevOwner == null || !_connected.ContainsKey(prevOwner.Value))
        {
            Guid? newOwner = _connected.Keys.FirstOrDefault();
            if (newOwner != Owner) { Owner = newOwner; }
        }
        State.Update(this);
    }

    /// <summary>
    /// Handles a new player connecting to the room. This operation will always
    /// succeed. The caller should verify that the room is not full before
    /// calling this method.
    /// </summary>
    /// <param name="playerId">the id of the connecting player</param>
    /// <param name="name">the name of the connecting player</param>
    public void Connect(Guid playerId, string name)
    {

    }

    /// <summary>
    /// Handles a player disconnecting from the room.
    /// </summary>
    /// <param name="playerId">the id of the disconnected player</param>
    public void OnDisconnect(Guid playerId)
    {

    }

    /// <summary>
    /// Disconnects all connected clients from the room and does anything else
    /// required before deletion of the room.
    /// </summary>
    public void OnClose()
    {
        // TODO: disconnect all
    }

    /// <summary>
    /// Broadcasts to all connected clients that the room has encountered a
    /// critical error and that disconnetion is imminent.
    /// </summary>
    public void BroadcastRoomCrash()
    {

    }

    /// <summary>
    /// Broadcasts the room info event to all connected clients.
    /// </summary>
    public void BroadcastRoomInfo()
    {

    }
    
    /// <summary>
    /// Should the room be playing at the time of calling, the terrain info
    /// of the game instance is broadcasted to all connected clients. 
    /// </summary>
    public void BroadcastTerrainInfo()
    {
        // TODO!
    }

}