
using System.Collections.Concurrent;
using System.Collections.Immutable;
using Linton.Server;
using Linton.Server.Sockets;
using Newtonsoft.Json;

namespace Linton.Game;


/// <summary>
/// Represents an instance of the game.
/// </summary>
public class GameInstance
{

    static readonly TimeSpan SubroundLength = TimeSpan.FromMinutes(5);
    // needs to match client side constant
    static readonly TimeSpan WinnerAnnounceLength = TimeSpan.FromSeconds(20);
    const int SubroundCount = 3;


    readonly Lock _lock = new();

    public readonly ConcurrentDictionary<Guid, Player> Playing;
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

    public readonly GameState State;

    DateTime _lastFrameTime = DateTime.MinValue;
    DateTime _nextSubround = DateTime.MinValue;
    int _nextSubroundIndex = 0;
    bool _hasNextSubround = true;
    ImmutableList<OutEvent.GameWinners.WinnerInfo>? _winners = null;

    public GameInstance(
        Dictionary<Guid, string> playing, RoomSettings settings
    )
    {
        Playing = new(
            playing.ToDictionary(p => p.Key, p => new Player(p.Key, p.Value))
        );
        Settings = settings;
        ushort seed = (ushort)new Random().Next(ushort.MaxValue + 1);
        _rng = new Random(seed);
        Terrain = new Terrain(playing.Count, seed, _rng);
        Network = new TrackNetworkGenerator(Terrain, settings, _rng).Build();
        OutEvent.WorldInfo worldInfo = new(Terrain, Network);
        WorldInfoString = JsonConvert.SerializeObject(
            worldInfo, JsonSettings.Settings
        );
        State = new GameState(Terrain.SizeT, Network);
    }

    /// <summary>
    /// Allocates a region to every player in the game. This randomly assigns
    /// each player a region as close to the center of the map as possible.
    /// </summary>
    private void AllocateRegionsAll()
    {
        List<Player> unallocated = Playing.Values.ToList();
        while (unallocated.Count > 0)
        {
            int i;
            lock (_lock) {
                i = _rng.Next(unallocated.Count);
            }
            AllocateRegion(unallocated[i]);
            unallocated.RemoveAt(i);
        }
    }

    /// <summary>
    /// Allocates a region to the given player, as close to the center
    /// of the map as possible.
    /// </summary>
    /// <param name="p">the player to allocate a region to</param>
    private void AllocateRegion(Player p)
    {
        bool TryAllocate(int cx, int cz)
        {
            bool oob = cx < 0 || cx >= Terrain.SizeC
                || cz < 0 || cz >= Terrain.SizeC;
            if (oob) { throw new Exception("Failed to find region"); }
            RegionMap.Region region = State.Regions.RegionOfChunk(cx, cz);
            bool taken = region.TryTake(p);
            if (taken) { State.IncrementOwnedRegionCount(); }
            return taken;
        }
        int centerX = Terrain.SizeC / 2;
        int centerZ = Terrain.SizeC / 2;
        for (int rad = 0; ; rad += 1)
        {
            for (int rcx = -rad; rcx <= +rad; rcx += 1)
            {
                for (int rcz = -rad; rcz <= +rad; rcz += 1)
                {
                    bool isCorner = rad != 0 && Math.Abs(rcx) == Math.Abs(rcz);
                    if (isCorner) { continue; }
                    if (TryAllocate(centerX + rcx, centerZ + rcz)) { return; }
                }
            }
        }
    }

    /// <summary>
    /// Updates the state of the game instance.
    /// </summary>
    public void Update()
    {
        lock (_lock)
        {
            if (!Playing.Values.Any(p => p.IsConnected))
            {
                _hasEnded = true;
                return;
            }
            DateTime now = DateTime.UtcNow;
            float deltaTime = 0f;
            if (_lastFrameTime != DateTime.MinValue)
            {
                deltaTime = (float)(now - _lastFrameTime).TotalSeconds;
            }
            _lastFrameTime = now;
            State.UpdateTrains(Network, _rng, deltaTime);
            State.SummonTrains(Network, Settings, _rng);
            if (now >= _nextSubround && _hasNextSubround)
            {
                if (_nextSubroundIndex >= SubroundCount)
                {
                    _hasNextSubround = false;
                    _winners = ComputeWinners();
                    _nextSubround = DateTime.MaxValue;
                }
                else
                {
                    _nextSubroundIndex += 1;
                    _nextSubround = now + SubroundLength;       
                    AllocateRegionsAll();  
                }       
            }
            else if (now >= _nextSubround && !_hasNextSubround)
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
            if (Playing.GetValueOrDefault(pid) is not Player p) { return; }
            p.IsConnected = isConnected;
        }
    }

    ImmutableList<OutEvent.GameWinners.WinnerInfo> ComputeWinners()
        => Playing.Values
        .Select(p => new OutEvent.GameWinners.WinnerInfo(
            p.Name, p.NumPoints
        ))
        .ToList().OrderByDescending(p => p.NumPoints)
        .ToImmutableList();

    public ImmutableList<OutEvent.GameWinners.WinnerInfo>?
        ShouldStartDisplayWinners()
    {
        lock (_lock)
        {
            if (_nextSubround != DateTime.MaxValue) { return null; }
            return _winners;
        }
    }

    public void ConfirmWinnerDisplay()
    {
        lock (_lock)
        {
            _nextSubround = DateTime.UtcNow + WinnerAnnounceLength;
        }
    }

}