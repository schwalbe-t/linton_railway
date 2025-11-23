
using System.Collections.ObjectModel;
using System.Numerics;
using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace Linton.Game;


[JsonConverter(typeof(StringEnumConverter))]
public enum LocomotiveType
{
    [EnumMember(Value = "diesel")] Diesel,
    [EnumMember(Value = "steam")] Steam
}

[JsonConverter(typeof(StringEnumConverter))]
public enum TrainColor
{
    [EnumMember(Value = "green")] Green,
    [EnumMember(Value = "cyan")] Cyan,
    [EnumMember(Value = "magenta")] Magenta,
    [EnumMember(Value = "red")] Red,
    [EnumMember(Value = "orange")] Orange
}


public sealed class Train
{
    static readonly LocomotiveType[] LocoTypes
        = Enum.GetValues<LocomotiveType>();

    static readonly TrainColor[] TrainColors
        = Enum.GetValues<TrainColor>();

    static int BaseLength(TrainLength length) => length switch
    {
        TrainLength.Short => 2,
        TrainLength.Medium => 4,
        TrainLength.Long => 6,
        _ => 0
    };

    const int MinTrainLenDiff = -1;
    const int MaxTrainLenDiff = +1;

    const LocomotiveType DefaultLocoType = LocomotiveType.Diesel;
    const TrainColor DefaultColor = TrainColor.Green;

    /// <summary>
    /// [units/s]
    /// The maximum allowed speed for the train in units per second.
    /// </summary>
    const float TopSpeed = 10f;
    /// <summary>
    /// [units/s^2]
    /// The added amount of speed (units per second) added for every second
    /// of acceleration.
    /// </summary>
    const float Acceleration = 2f;
    /// <summary>
    /// [(units/s)/units]
    /// The amount of maximum added speed added (starting at 0) for every unit
    /// of remaining distance until the next point the train needs to stop at.
    /// If the train needs to stop after 5 units and the value of this variable
    /// is 3, then the speed must be limited to be at most:
    /// <code>5 units * 3 (units/s)/units = 15 units/s</code>
    /// </summary>
    const float Deceleration = 3f;

    /// <summary>
    /// [units/s]
    /// The fixed speed of trains in regions not owned by any player.
    /// </summary>
    const float UnownedRegionSpeed = 1000f;

    /// <summary>
    /// The maximum number of previously occupied segments to store.
    /// </summary>
    const int MaxOccupiedSegmentCount = 20;


    [JsonProperty("locoType")]
    public readonly LocomotiveType LocoType = DefaultLocoType;
    [JsonProperty("color")]
    public readonly TrainColor Color = DefaultColor;
    [JsonProperty("carCount")]
    public readonly int CarCount;

    [JsonIgnore]
    readonly Lock _lock = new();

    [JsonIgnore]
    float _segmentDist;
    [JsonProperty("segmentDist")]
    public float SegmentDist
    { get { lock (_lock) { return _segmentDist; } } }

    /// <summary>
    /// from oldest segment idx [0] to newest segment idx (highest index)
    /// locomotive always occupies the segment specified by the last element
    /// </summary>
    [JsonIgnore]
    readonly List<TrackConnection> _occupiedSegments = new();
    [JsonProperty("occupiedSegments")]
    public List<TrackConnection> OccupiedSegments
    { get { lock(_lock) { return new(_occupiedSegments); } } }

    [JsonIgnore]
    float _speed = 0f;

    [JsonIgnore]
    bool _atEnd = false;
    [JsonIgnore]
    public bool AtEnd { get { lock (_lock) { return _atEnd; } } }

    public TrackConnection CurrentSegment
    { get { lock (_lock) { return _occupiedSegments[^1]; } } }

    public Train(
        TrackNetwork network, TrackConnection segment,
        RoomSettings settings, Random rng
    )
    {
        CarCount = BaseLength(settings.TrainLength);
        if (settings.VariedTrainStyles)
        {
            LocoType = LocoTypes[rng.Next(LocoTypes.Length)];
            Color = TrainColors[rng.Next(TrainColors.Length)];
            CarCount += rng.Next(MinTrainLenDiff, MaxTrainLenDiff + 1);
        }
        _occupiedSegments.Add(segment);
        _segmentDist = 0.0f;
        if (segment.ToHighEnd)
        {
            TrackSegment seg = network.Segments[segment.SegmentIdx];
            _segmentDist = seg.LSpline.ComputeLength();
        }
    }

    static TrackConnection? ChooseNextSegment(
        TrackNetwork network, GameState state,
        int segmentIdx, bool ascend, int randomBranchIdx,
        out bool reachedEnd
    )
    {
        reachedEnd = false;
        TrackSegment seg = network.Segments[segmentIdx];
        List<TrackConnection> nextConns = ascend
            ? seg.ConnectsHigh : seg.ConnectsLow;
        if (nextConns.Count == 0)
        {
            reachedEnd = true;
            return null;
        }
        if (nextConns.Count == 1)
        {
            return nextConns[0];
        }
        Vector3 endPos = ascend ? seg.HighEnd : seg.LowEnd;
        int endTX = (int)Math.Round(endPos.X.UnitsToTiles());
        int endTZ = (int)Math.Round(endPos.Z.UnitsToTiles());
        RegionMap.Region reg = state.Regions.RegionOfTile(endTX, endTZ);
        if (reg.Owner is null)
        {
            return nextConns[randomBranchIdx % nextConns.Count];
        }
        TrackConnection endConn = new(segmentIdx, ascend);
        if (state.Switches.TryGetValue(endConn, out ushort branchIdx))
        {
            return nextConns[branchIdx];
        }
        return null;
    }

    const float StoppingDistStepSize = 10000f; // large value
    const float MaxStoppingDist = 50f; // don't keep looking after this value
    const float TrainDistPadding = 10f; // min distance between trains (per car)
    const float BranchExitPadding = 15f;

    static float NextStopPointDist(
        Train self, TrackConnection segment, float segmentDist,
        TrackNetwork network, GameState state, Random rng
    )
    {
        int segIdx = segment.SegmentIdx;
        TrackSegment seg = network.Segments[segIdx];
        bool ascend = !segment.ToHighEnd;
        LinSpline.Point p = new();
        seg.LSpline.AdvancePoint(ref p, segmentDist, out _);
        float segDist = segmentDist;
        float stopDist = 0f;
        float ClosestTrainDist()
        {
            float closestTrainDist = float.PositiveInfinity;
            foreach (Train train in state.Trains.Values)
            {
                if (train == self) { continue; }
                TrackConnection trainSeg = train.CurrentSegment;
                if (trainSeg.SegmentIdx != segIdx) { continue; }
                bool isHigher = train.SegmentDist > segDist;
                bool isAfter = ascend ? isHigher : !isHigher;
                if (!isAfter) { continue; }
                float trainDist = Math.Abs(train.SegmentDist - segDist)
                    - (TrainDistPadding * train.CarCount);
                closestTrainDist = Math.Min(closestTrainDist, trainDist);
            }
            return closestTrainDist;
        }
        bool AllowedBranchExit(TrackConnection next)
        {
            TrackSegment nextSeg = network.Segments[next.SegmentIdx];
            List<TrackConnection> branches = next.ToHighEnd
                ? nextSeg.ConnectsHigh : nextSeg.ConnectsLow;
            if (branches.Count <= 1)
            {
                return true;
            }
            if (state.Switches.TryGetValue(next, out ushort branchIdx))
            {
                return branches[branchIdx].SegmentIdx == segIdx;
            }
            Vector3 endPos = next.ToHighEnd
                ? nextSeg.HighEnd : nextSeg.LowEnd;
            int endTX = (int)Math.Round(endPos.X.UnitsToTiles());
            int endTZ = (int)Math.Round(endPos.Z.UnitsToTiles());
            RegionMap.Region reg = state.Regions.RegionOfTile(endTX, endTZ);
            return reg.Owner == null;
        }
        while (stopDist < MaxStoppingDist)
        {
            float closestTrainDist = ClosestTrainDist();
            if (closestTrainDist != float.PositiveInfinity)
            {
                stopDist += closestTrainDist;
                break;
            }
            float step = StoppingDistStepSize * (ascend ? 1 : -1);
            float d = seg.LSpline.AdvancePoint(ref p, step, out bool segEnd);
            stopDist += d;
            segDist += d;
            if (!segEnd) { continue; }
            List<TrackConnection> nextConns = ascend
                ? seg.ConnectsHigh : seg.ConnectsLow;
            if (nextConns.Count >= 1 && !nextConns.All(AllowedBranchExit))
            {
                stopDist -= BranchExitPadding;
                break;
            }
            TrackConnection? oNext = ChooseNextSegment(
                network, state, segIdx, ascend, rng.Next(), out bool atEnd
            );
            if (atEnd) { return float.PositiveInfinity; }
            if (oNext is not TrackConnection next) { break; }
            segIdx = next.SegmentIdx;
            seg = network.Segments[segIdx];
            ascend = !next.ToHighEnd;
            segDist = 0f;
            p = new LinSpline.Point();
            if (!ascend)
            {
                float segLen = seg.LSpline.ComputeLength();
                seg.LSpline.AdvancePoint(ref p, segLen, out _);
                segDist = segLen;
            }
        }
        return stopDist;
    }

    bool CurrentSegmentOwned(TrackNetwork network, GameState state)
    {
        TrackConnection curr = _occupiedSegments[^1];
        TrackSegment seg = network.Segments[curr.SegmentIdx];
        Vector3 lowT = seg.LowEnd.UnitsToTiles();
        int lowTX = (int)Math.Round(lowT.X);
        int lowTZ = (int)Math.Round(lowT.Z);
        RegionMap.Region lowReg = state.Regions.RegionOfTile(lowTX, lowTZ);
        Vector3 highT = seg.HighEnd.UnitsToTiles();
        int highTX = (int)Math.Round(highT.X);
        int highTZ = (int)Math.Round(highT.Z);
        RegionMap.Region highReg = state.Regions.RegionOfTile(highTX, highTZ);
        return lowReg.Owner != null || highReg.Owner != null;
    }

    // after less than this distance force speed = 0
    const float StopPointCutoff = 0.1f;

    void UpdateSpeed(
        TrackNetwork network, GameState state, float deltaTime, Random rng
    )
    {
        if (!CurrentSegmentOwned(network, state))
        {
            _speed = UnownedRegionSpeed;
            return;
        }
        _speed += Acceleration * deltaTime;
        _speed = Math.Min(_speed, TopSpeed);
        TrackConnection cSeg = _occupiedSegments[^1];
        float stopDist = NextStopPointDist(
            this, cSeg, _segmentDist, network, state, rng
        );
        float stopTopSpeed = stopDist * Deceleration;
        _speed = Math.Min(_speed, stopTopSpeed);
        if (stopDist < StopPointCutoff) { _speed = 0f; }
    }

    void MoveDistance(
        TrackNetwork network, GameState state, Random rng, float distance
    )
    {
        float distLeft = distance;
        while (!_atEnd)
        {
            TrackConnection curr = _occupiedSegments[^1];
            TrackSegment seg = network.Segments[curr.SegmentIdx];
            LinSpline.Point p = new();
            seg.LSpline.AdvancePoint(ref p, _segmentDist, out _);
            float dirSign = curr.ToHighEnd ? -1 : 1;
            float step = distLeft * dirSign;
            float adv = seg.LSpline.AdvancePoint(ref p, step, out bool segEnd);
            distLeft -= adv;
            _segmentDist += adv * dirSign;
            if (!segEnd || distLeft < 0.001) { break; }
            TrackConnection? oNext = ChooseNextSegment(
                network, state, curr.SegmentIdx, !curr.ToHighEnd,
                rng.Next(), out _atEnd
            );
            if (oNext is not TrackConnection next) { break; }
            foreach (var (swConn, branchIdx) in state.Switches)
            {
                TrackSegment swSeg = network.Segments[swConn.SegmentIdx];
                List<TrackConnection> branches = swConn.ToHighEnd
                    ? swSeg.ConnectsHigh : swSeg.ConnectsLow;
                TrackConnection branch = branches[branchIdx];
                bool isExit = branch.SegmentIdx == curr.SegmentIdx
                    && branch.ToHighEnd != curr.ToHighEnd;
                bool isEntry = branch.SegmentIdx == next.SegmentIdx
                    && branch.ToHighEnd == next.ToHighEnd;
                bool unset = isExit || isEntry;
                if (unset) { state.Switches.Remove(swConn, out _); }
            }
            _occupiedSegments.Add(next);
            _segmentDist = 0f;
            if (next.ToHighEnd)
            {
                TrackSegment nSeg = network.Segments[next.SegmentIdx];
                _segmentDist = nSeg.LSpline.ComputeLength();
            }
        }
        int rmOccSegCount = _occupiedSegments.Count - MaxOccupiedSegmentCount;
        if (rmOccSegCount > 0)
        {
            _occupiedSegments.RemoveRange(0, rmOccSegCount);
        }
    }

    const float MovementTimeStepSize = 0.003f;

    public void Update(
        TrackNetwork network, GameState state, Random rng, float deltaTime
    )
    {
        lock (_lock)
        {
            float remTime = deltaTime;
            while (remTime > 0)
            {
                float timeStep = Math.Min(remTime, MovementTimeStepSize);
                UpdateSpeed(network, state, timeStep, rng);
                float dist = _speed * timeStep;
                MoveDistance(network, state, rng, dist);
                remTime -= MovementTimeStepSize;
            }
        }
    }

}