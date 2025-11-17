
using Linton.Server;
using Linton.Server.Sockets;
using Newtonsoft.Json;

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
    public readonly RoomSettings Settings;

    bool _hasEnded = false;
    public bool HasEnded
    {
        get { lock (_lock) { return _hasEnded; } }
    }

    readonly Random _rng;

    public readonly Terrain Terrain;
    public readonly TrackNetwork Network;
    public readonly string WorldInfoString;
    public readonly RegionMap RegionMap;

    public GameInstance(
        Dictionary<Guid, string> playing, RoomSettings settings
    )
    {
        _playing = playing
            .ToDictionary(p => p.Key, p => new Player(p.Key, p.Value));
        Settings = settings;
        ushort seed = (ushort)new Random().Next(ushort.MaxValue + 1);
        _rng = new Random(seed);
        Terrain = new Terrain(playing.Count, seed, _rng);
        Network = new TrackNetworkGenerator(Terrain, settings, _rng).Build();
        OutEvent.WorldInfo worldInfo = new(Terrain, Network);
        WorldInfoString = JsonConvert.SerializeObject(
            worldInfo, JsonSettings.Settings
        );
        RegionMap = new RegionMap(Terrain.SizeT, Network.Stations);
    }

    /// <summary>
    /// Updates the state of the game instance.
    /// </summary>
    public void Update()
    {
        lock (_lock)
        {
            if (!_playing.Values.Any(p => p.IsConnected))
            {
                _hasEnded = true;
            }
        }
    }

    /// <summary>
    /// Signals to the game instance that the given player has disconnected
    /// or reconnected. If the player has not been a participant since the
    /// start of the game, this method has no effect.
    /// </summary>
    /// <param name="pid">the ID of the player</param>
    /// <param name="isConnected">whether the player is now connected</param>
    public void OnPlayerConnectionChange(Guid pid, bool isConnected)
    {
        lock (_lock)
        {
            if (_playing.GetValueOrDefault(pid) is not Player p) { return; }
            p.IsConnected = isConnected;
        }
    }

}