
using System.Collections.Concurrent;

namespace Linton.Server;


/// <summary>
/// Represents a user session, which holds context about a given user
/// across multiple websocket connections. 
/// This so that even if the user is disconnected, they can still
/// reconnect using their previous (private) session ID to identify themselves
/// and keep any game state from before they disconnected.
/// </summary>
public sealed class Session
{
    /// <summary>
    /// The minimum delay from the time a user disconnects until the closure
    /// of the session.
    /// </summary>
    public static readonly TimeSpan TimeoutDelay = TimeSpan.FromMinutes(15);

    /// <summary>
    /// The ID under which the session is registered in the session registry.
    /// </summary>
    public readonly Guid SessionId = Guid.NewGuid();
    /// <summary>
    /// The (public) player ID of the player.
    /// </summary>
    public readonly Guid PlayerId = Guid.NewGuid();

    readonly Lock _lock = new();

    /// <summary>
    /// The room the user is currently connected to.
    /// Defaults to 'null' when no user is currently connected.
    /// </summary>
    Room? _room = null;
    public Room? Room
    {
        get { lock (_lock) { return _room; } }
        set { lock (_lock) { _room = value; } }
    }

    /// <summary>
    /// The point in time after which the session may be deleted.
    /// Defaults to 'DateTime.MaxValue' when a user is currently connected.
    /// </summary>
    DateTime _timeoutAfter = DateTime.UtcNow + TimeoutDelay;
    public DateTime TimeoutAfter
    {
        get { lock (_lock) { return _timeoutAfter; } }
        private set { lock (_lock) { _timeoutAfter = value; } }
    }

    /// <summary>
    /// Attempts to take possession of the session.
    /// This function may return false to indicate that the session is already
    /// being used.
    /// </summary>
    /// <returns>whether the session as acquired</returns>
    public bool StartUsage()
    {
        lock (_lock)
        {
            if (TimeoutAfter == DateTime.MaxValue) { return false; }
            TimeoutAfter = DateTime.MaxValue;
        }
        return true;
    }

    /// <summary>
    /// Releases ownership over this session, allowing other socket connections
    /// to use it.
    /// </summary>
    public void StopUsage()
    {
        TimeoutAfter = DateTime.UtcNow + TimeoutDelay;
        Room = null;
    }
}


/// <summary>
/// Keeps track of all known sessions.
/// </summary>
public static class SessionRegistry
{

    static readonly ConcurrentDictionary<Guid, Session> _sessions = new();

    /// <summary>
    /// Creates a new session with a random session ID and player ID
    /// and stores it in the registry.
    /// </summary>
    /// <returns>the created session</returns>
    public static Session Create()
    {
        var session = new Session();
        _sessions[session.SessionId] = session;
        return session;
    }

    /// <summary>
    /// Looks up the session that the given session ID maps to.
    /// If no such session could be found, null is returned.
    /// </summary>
    /// <param name="sessionId">the session ID</param>
    /// <returns>the session the ID maps to</returns>
    public static Session? Get(Guid sessionId)
        => _sessions.GetValueOrDefault(sessionId);

    /// <summary>
    /// Runs a clean up over all known sessions, which means deleting any
    /// sessions that have timed out. This method should be called perdiodically
    /// (once every few minutes).
    /// </summary>
    public static void RunCleanup()
    {
        foreach (var entry in _sessions)
        {
            if (DateTime.UtcNow <= entry.Value.TimeoutAfter) { continue; }
            _sessions.Remove(entry.Key, out _);
        }
    }

    /// <summary>
    /// Attempts to find and start using the session with the given nullable
    /// session ID. If the given ID is null, the session does not exist or
    /// the session is currently in use, a new session will be created
    /// and start being used.
    /// </summary>
    /// <param name="sessionId">the id of the session to start using</param>
    /// <returns>the found (or new) session</returns>
    public static Session StartGetOrCreate(Guid? sessionId)
    {
        if (sessionId is Guid id && Get(id) is Session s && s.StartUsage())
        {
            return s;
        }
        var created = Create();
        created.StartUsage();
        return created;
    }

}