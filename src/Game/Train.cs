
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
    const TrainColor DefaultColor = TrainColor.Cyan;

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

    static float NextStopPointDist(
        TrackConnection segment, float segmentDist,
        TrackNetwork network, GameState state)
    {
        int segIdx = segment.SegmentIdx;
        TrackSegment seg = network.Segments[segIdx];
        bool ascend = !segment.ToHighEnd;
        LinSpline.Point p = new();
        seg.LSpline.AdvancePoint(ref p, segmentDist, out _);
        float dist = 0f;
        while (true)
        {
            float step = float.PositiveInfinity * (ascend ? 1 : -1);
            dist += seg.LSpline.AdvancePoint(ref p, step, out bool segEnd);
            if (!segEnd) { continue; }
            TrackConnection? oNext = ChooseNextSegment(
                network, state, segIdx, ascend, 0, out bool atEnd
            );
            if (atEnd) { return float.PositiveInfinity; }
            if (oNext is not TrackConnection next) { break; }
            segIdx = next.SegmentIdx;
            seg = network.Segments[segIdx];
            ascend = !next.ToHighEnd;
            p = new LinSpline.Point();
            if (!ascend)
            {
                seg.LSpline.AdvancePoint(ref p, float.PositiveInfinity, out _);
            }
        }
        return dist;
    }

    void UpdateSpeed(TrackNetwork network, GameState state, float deltaTime)
    {
        _speed += Acceleration * deltaTime;
        _speed = Math.Min(_speed, TopSpeed);
        TrackConnection cSeg = _occupiedSegments[^1];
        float stopDist = NextStopPointDist(cSeg, _segmentDist, network, state);
        float stopTopSpeed = stopDist * Deceleration;
        _speed = Math.Min(_speed, stopTopSpeed);
    }

    void UpdatePosition(
        TrackNetwork network, GameState state, Random rng, float deltaTime
    )
    {
        float distLeft = _speed * deltaTime;
        while (!_atEnd)
        {
            TrackConnection curr = _occupiedSegments[^1];
            TrackSegment seg = network.Segments[curr.SegmentIdx];
            LinSpline.Point p = new();
            seg.LSpline.AdvancePoint(ref p, _segmentDist, out _);
            float step = distLeft * (curr.ToHighEnd ? -1 : 1);
            float adv = seg.LSpline.AdvancePoint(ref p, step, out bool segEnd);
            distLeft -= adv;
            _segmentDist += adv;
            if (!segEnd || distLeft < 0.0001) { break; }
            TrackConnection? oNext = ChooseNextSegment(
                network, state, curr.SegmentIdx, !curr.ToHighEnd,
                rng.Next(), out _atEnd
            );
            if (oNext is not TrackConnection next) { break; }
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

    public void Update(
        TrackNetwork network, GameState state, Random rng, float deltaTime
    )
    {
        lock (_lock)
        {
            UpdateSpeed(network, state, deltaTime);
            UpdatePosition(network, state, rng, deltaTime);
        }
    }

}