
namespace Linton.Game;


/// <summary>
/// Represents an instance of the game.
/// </summary>
/// <param name="playing">
/// a map of (playerId -> playerName) for all participating players
/// </param>
public class GameInstance(Dictionary<Guid, string> playing)
{

    readonly Lock _lock = new();

    readonly Dictionary<Guid, Player> _playing = playing
        .ToDictionary(p => p.Key, p => new Player(p.Key, p.Value));

    bool _hasEnded = false;
    public bool HasEnded
    {
        get { lock (_lock) { return _hasEnded; } }
    }

    /// <summary>
    /// Updates the state of the game instance.
    /// </summary>
    public void Update()
    {
        lock (_lock)
        {
            if (_playing.Count == 0)
            {
                _hasEnded = true;
            }
        }
    }

    /// <summary>
    /// Signals to the game instance that the given player has disconnected
    /// and will no longer be participating.
    /// </summary>
    /// <param name="playerId">the ID of the player</param>
    public void OnDisconnect(Guid playerId)
    {
        lock (_lock)
        {
            _playing.Remove(playerId);
        }
    }

}