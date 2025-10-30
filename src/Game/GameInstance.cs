
namespace Linton.Game;


/// <summary>
/// Represents an instance of the game.
/// </summary>
/// <param name="playing">
/// a map of (playerId -> playerName) for all participating players
/// </param>
public class GameInstance
{

    readonly Lock _lock = new();

    readonly Dictionary<Guid, Player> _playing;

    bool _hasEnded = false;
    public bool HasEnded
    {
        get { lock (_lock) { return _hasEnded; } }
    }

    readonly Random _rng;

    public readonly Terrain Terrain;

    public GameInstance(Dictionary<Guid, string> playing)
    {
        _playing = playing
            .ToDictionary(p => p.Key, p => new Player(p.Key, p.Value));
        ushort seed = (ushort)new Random().Next(ushort.MaxValue + 1);
        _rng = new Random(seed);
        Terrain = new Terrain(playing.Count, seed, _rng);
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