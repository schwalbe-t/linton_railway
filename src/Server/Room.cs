
using System.Collections.Concurrent;
using Linton.Game;

namespace Linton.Server;

public abstract class RoomState
{
    public abstract string TypeString { get; }
    public virtual void Update(Room room) { }

    public sealed class Dying : RoomState
    {
        public override string TypeString { get => "dying"; }

        public readonly long Until = DateTimeOffset.Now.ToUnixTimeMilliseconds()
            + Room.ClosureDelayMs;

        public override void Update(Room room)
        {

        }
    }

    public sealed class Waiting : RoomState
    {
        public override string TypeString { get => "waiting"; }

        readonly ConcurrentDictionary<string, bool> _ready = new();

        public override void Update(Room room)
        {

        }
    }

    public sealed class Playing : RoomState
    {
        public override string TypeString { get => "playing"; }

        public required GameInstance Game;

        public override void Update(Room room)
        {

        }
    }
}


public class RoomConnection(string name)
{
    public readonly string Name = name;
}


public class Room(string id, RoomSettings settings)
{
    /// <summary>
    /// The minimum amount of time that needs to pass (in milliseconds) before
    /// the room registry cleanup is allowed to delete a dying room.
    /// This duration is already included in the 'Until'-property of the 'Dying'
    /// room state.
    /// </summary>
    public static readonly long ClosureDelayMs = 300_000;
    /// <summary>
    /// Room connection requests should be rejected if this amount of clients
    /// is connected to the same room.
    /// </summary>
    public static readonly int MaxNumConnections = 32;


    private readonly Lock _lock = new();

    private RoomState _state;
    public RoomState State
    {
        get
        {
            lock (_lock) { return _state; }   
        }
        set
        {
            lock (_lock) { _state = value; }
            BroadcastRoomInfo();
        }
    }

    readonly ConcurrentDictionary<string, RoomConnection> _connected = new();
    public IReadOnlyDictionary<string, RoomConnection> Connected
    {
        get => _connected;
    }

    private string? _owner = null;
    /// <summary>
    /// Specifies the owner of the room (or null if the room is empty).
    /// The owner is the one that is allowed to change room settings and
    /// disconnect players.
    /// </summary>
    public string? Owner
    {
        get
        {
            lock (_lock) { return _owner; }
        }
        private set
        {
            lock (_lock) { _owner = value; }
            BroadcastRoomInfo();
        }
    }

    private long _lastGameTime = DateTimeOffset.Now.ToUnixTimeMilliseconds();
    /// <summary>
    /// The UNIX time stamp of the last time a game ended (or the point in time
    /// when the room was created).
    /// </summary>
    public long LastGameTime
    {
        get
        {
            lock (_lock) { return _lastGameTime; }
        }
        private set
        {
            lock (_lock) { _lastGameTime = value; }
        }
    }

    /// <summary>
    /// Updates the state of the room.
    /// </summary>
    public void Update()
    {
        string? prevOwner = Owner;
        if (prevOwner == null || !_connected.ContainsKey(prevOwner))
        {
            string? newOwner = _connected.Keys.FirstOrDefault();
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
    public void Connect(string playerId, string name)
    {

    }

    /// <summary>
    /// Handles a player disconnecting from the room.
    /// </summary>
    /// <param name="playerId">the id of the disconnected player</param>
    public void OnDisconnect(string playerId)
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

}