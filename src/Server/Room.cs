
using Linton.Game;
using Linton.Server.Sockets;
using System.Collections.Concurrent;
using Newtonsoft.Json;

namespace Linton.Server;


public record User(string Name, Socket Socket);


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

    /// <summary>
    /// The current state of the room.
    /// Updating this will trigger a room info event broadcast.
    /// </summary>
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

    bool _isClosed = false;
    /// <summary>
    /// Specifies if the room is closed, meaning no new players are allowed
    /// to join the room.
    /// </summary>
    public bool IsClosed
    {
        get { lock (_lock) { return _isClosed; } }
        private set { lock (_lock) { _isClosed = value; } }
    }

    readonly ConcurrentDictionary<Guid, User> _connected = new();
    /// <summary>
    /// A map of user IDs to users for all currently connected users.
    /// </summary>
    public IReadOnlyDictionary<Guid, User> Connected => _connected;

    Guid? _owner = null;
    /// <summary>
    /// Specifies the owner of the room (or null if the room is empty).
    /// The owner is the one that is allowed to change room settings and
    /// disconnect players.
    /// Updating this will trigger a room info event broadcast.
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
    /// The unique identifier of this room.
    /// </summary>
    public readonly Guid Id = id;

    RoomSettings _settings = settings;
    /// <summary>
    /// The current settings of the room.
    /// Updating these will trigger a room info event broadcast.
    /// </summary>
    public RoomSettings Settings
    {
        get { lock (_lock) { return _settings; } }
        set
        {
            lock (_lock) { _settings = value; }
            BroadcastRoomInfo();
        }
    }

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
        if (State is RoomState.Playing playing)
        {
            BroadcastEvent(new OutEvent.GameUpdate(playing.Game.State));
        }
    }

    /// <summary>
    /// Handles a new player connecting to the room. This operation will always
    /// succeed. The caller should verify that the room is not full before
    /// calling this method.
    /// </summary>
    /// <param name="playerId">the id of the connecting player</param>
    /// <param name="name">the name of the connecting player</param>
    /// <param name="socket">the connection to the player</param>
    /// <returns>whether the connection was successful</returns>
    public bool TryConnect(Guid playerId, string name, Socket socket)
    {
        lock (_lock)
        {
            if (IsClosed) { return false; }
            _connected[playerId] = new User(name, socket);
        }
        if (State is RoomState.Playing playing)
        {
            playing.Game.OnPlayerConnectionChange(playerId, isConnected: true);
            socket.SendText(playing.Game.WorldInfoString);
        }
        BroadcastRoomInfo();
        return true;
    }

    /// <summary>
    /// Handles a player disconnecting from the room.
    /// </summary>
    /// <param name="playerId">the id of the disconnected player</param>
    public void OnDisconnect(Guid playerId)
    {
        _connected.Remove(playerId, out _);
        if (State is RoomState.Playing playing)
        {
            playing.Game.OnPlayerConnectionChange(playerId, isConnected: false);
        }
        BroadcastRoomInfo();
    }

    /// <summary>
    /// Disconnects all connected clients from the room and does anything else
    /// required before deletion of the room.
    /// This sets the room to be closed, meaning no other clients are allowed
    /// to join it.
    /// </summary>
    public void OnClose()
    {
        IsClosed = true;
        foreach (User user in _connected.Values)
        {
            user.Socket.Close();
        }
    }

    /// <summary>
    /// Broadcasts the given event to all connected clients.
    /// </summary>
    /// <param name="e">the event to broadcast</param>
    public void BroadcastEvent(OutEvent e)
    {
        string msg = JsonConvert.SerializeObject(e, JsonSettings.Settings);
        BroadcastRawMessage(msg);
    }

    /// <summary>
    /// Broadcasts the given raw text message to all connected clients.
    /// Only use with serialized out events.
    /// </summary>
    /// <param name="msg">the message to broadcast</param>
    public void BroadcastRawMessage(string msg)
    {
        foreach (User user in _connected.Values)
        {
            user.Socket.SendText(msg);
        }
    }

    /// <summary>
    /// Broadcasts to all connected clients that the room has encountered a
    /// critical error and that disconnetion is imminent.
    /// </summary>
    public void BroadcastRoomCrash()
        => BroadcastEvent(new OutEvent.RoomCrashed());

    /// <summary>
    /// Broadcasts the room info event to all connected clients.
    /// </summary>
    public void BroadcastRoomInfo()
    {
        if (Owner is not Guid ownerId) { return; }
        List<OutEvent.RoomInfo.PlayerInfo> players = _connected
            .Select(entry => new OutEvent.RoomInfo.PlayerInfo(
                Id: entry.Key,
                Name: entry.Value.Name,
                IsReady: State is RoomState.Waiting waiting
                    && waiting.Ready.GetValueOrDefault(entry.Key)
            ))
            .ToList();
        BroadcastEvent(new OutEvent.RoomInfo(
            players, ownerId, Settings, State.TypeString
        ));
    }

}