
using System.Collections.Concurrent;
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


public sealed class GameState(int sizeT, TrackNetwork trackNetwork)
{

    [JsonProperty("regions")]
    public readonly RegionMap Regions = new(sizeT, trackNetwork.Stations);

    [JsonProperty("switches")]
    public readonly ConcurrentDictionary<TrackConnection, ushort> Switches
        = new();

    [JsonProperty("trains")]
    public readonly ConcurrentDictionary<Guid, Train> Trains = new();

    [JsonIgnore]
    readonly Lock _lock = new();

    /// <summary>
    /// The maximum number of trains in the network for every chunk occupied
    /// by the network that is owned by a player.
    /// </summary>
    const int TrainCountLimit = 6;

    [JsonIgnore]
    int _ownedRegionCount = 0;
    /// <summary>
    /// The number of regions owned by any player on the map.
    /// Use 'IncrementOwnedRegionCount' to increase when allocating players to
    /// regions.
    /// </summary>
    [JsonIgnore]
    public int OwnedRegionCount
    {
        get { lock (_lock) { return _ownedRegionCount; } }
    }

    /// <summary>
    /// Increases the owned region count by 1.
    /// </summary>
    public void IncrementOwnedRegionCount()
    {
        lock (_lock) { _ownedRegionCount += 1; }
    }

    /// <summary>
    /// Represents an update to a "switch" on the network.
    /// Specifically, it makes it so the end of the segment specified by
    /// 'Connection' is linked to the 'BranchIdx'-th connection on that end
    /// of the segment.
    /// If 'BranchIdx' is null, any previously existing connection is unset.
    /// </summary>
    /// <param name="Connection">the segment end to configure</param>
    /// <param name="BranchIdx">the branch to connect to</param>
    public record struct SwitchStateUpdate(
        [property: JsonProperty("connection")] TrackConnection Connection,
        [property: JsonProperty("branchIdx")] ushort? BranchIdx = null
    );

    /// <summary>
    /// Applies the given list of switch state updates to the current game
    /// state.
    /// </summary>
    /// <param name="updates">the updates to apply</param>
    /// <param name="playerId">the player id to operate under</param>
    /// <param name="network">the network the switches are on</param>
    public void UpdateSwitchStates(
        List<SwitchStateUpdate> updates, 
        Guid playerId, TrackNetwork network
    )
    {
        bool IsRegionOwner(TrackConnection conn)
        {
            TrackSegment seg = network.Segments[conn.SegmentIdx];
            Vector3 end = conn.ToHighEnd ? seg.HighEnd : seg.LowEnd;
            int endTX = (int)Math.Round(end.X.UnitsToTiles());
            int endTZ = (int)Math.Round(end.Z.UnitsToTiles());
            RegionMap.Region region = Regions.RegionOfTile(endTX, endTZ);
            return region.Owner?.Id == playerId;
        }
        foreach (SwitchStateUpdate update in updates)
        {
            TrackConnection c = update.Connection;
            if (c.SegmentIdx < 0) { continue; }
            if (c.SegmentIdx >= network.Segments.Count) { continue; }
            if (!IsRegionOwner(c)) { continue; }
            TrackSegment s = network.Segments[c.SegmentIdx];
            int branchC = (c.ToHighEnd ? s.ConnectsHigh : s.ConnectsLow).Count;
            if (update.BranchIdx is ushort i && i < branchC)
            {
                Switches[c] = i;
            }
            else
            {
                Switches.Remove(c, out _);
            }
        }
    }

    public void UpdateTrains(
        TrackNetwork network, Random rng, float deltaTime
    )
    {
        foreach (var (trainId, train) in Trains)
        {
            train.Update(network, this, rng, deltaTime);
            if (train.AtEnd) {
                Trains.Remove(trainId, out _);
            }
        }
    }

    public void SummonTrains(
        TrackNetwork network, RoomSettings settings, Random rng
    )
    {
        int targetTrainCount = OwnedRegionCount * TrainCountLimit;
        int entranceCount = network.Entrances.Count;
        while (Trains.Count < targetTrainCount)
        {
            TrackConnection start = network.Entrances[rng.Next(entranceCount)];
            Train train = new(network, start, settings, rng);
            Guid trainId = Guid.NewGuid();
            Trains[trainId] = train;
        }
    }

    public List<Train.KnownValue> GetKnownTrainValues(Guid playerId)
    {
        List<Train.KnownValue> trains = new();
        foreach (var (tid, t) in Trains)
        {
            if (!t.ValueKnownTo.ContainsKey(playerId)) { continue; }
            trains.Add(new Train.KnownValue(tid, t.Value));
        }
        return trains;
    }

}