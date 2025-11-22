
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
        TrainLength.Short => 3,
        TrainLength.Medium => 6,
        TrainLength.Long => 9,
        _ => 0
    };

    const int MinTrainLenDiff = -2;
    const int MaxTrainLenDiff = +2;

    const LocomotiveType DefaultLocoType = LocomotiveType.Diesel;
    const TrainColor DefaultColor = TrainColor.Cyan;

    const float CarSpacing = 5f;

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


    public class CarPosition(int localSegIdx, LinSpline.Point pos)
    {
        [JsonIgnore]
        readonly Lock _lock = new();

        [JsonIgnore]
        int _localSegIdx = localSegIdx;
        [JsonProperty("localSegIdx")]
        public int LocalSegIdx
        {
            get { lock (_lock) { return _localSegIdx; } }
            set { lock (_lock) { _localSegIdx = value; } }
        }

        [JsonIgnore]
        LinSpline.Point _segmentPos = pos;
        [JsonProperty("segmentPos")]
        public LinSpline.Point SegmentPos
        {
            get { lock (_lock) { return _segmentPos; } }
            set { lock (_lock) { _segmentPos = value; } }
        }
    }


    [JsonProperty("locoType")]
    public readonly LocomotiveType LocoType = DefaultLocoType;
    [JsonProperty("color")]
    public readonly TrainColor Color = DefaultColor;
    [JsonProperty("carCount")]
    public readonly int CarCount;

    [JsonIgnore]
    readonly Lock _lock = new();

    /// <summary>
    /// loco [0], then cars from front to back
    /// </summary>
    [JsonProperty("carPositions")]
    public readonly ReadOnlyCollection<CarPosition> CarPositions;

    /// <summary>
    /// Distance of each carriage from the locomotive
    /// </summary>
    [JsonIgnore]
    readonly List<float> CarLocoDistances;

    /// <summary>
    /// from oldest segment idx to newest segment idx
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
        LinSpline.Point segPos = new();
        if (segment.ToHighEnd)
        {
            TrackSegment seg = network.Segments[segment.SegmentIdx];
            seg.LSpline.AdvancePoint(ref segPos, float.PositiveInfinity);
        }
        CarPositions = Enumerable.Range(0, CarCount + 1)
            .Select(_ => new CarPosition(0, segPos))
            .ToList().AsReadOnly();
        CarLocoDistances = Enumerable.Range(0, CarCount)
            .Select(_ => 0f)
            .ToList();
        _occupiedSegments.Add(segment);
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
        Vector3 endPos = ascend ? seg.HighEnd : seg.LowEnd;
        if (nextConns.Count == 0)
        {
            reachedEnd = true;
            return null;
        }
        if (nextConns.Count == 1)
        {
            return nextConns[0];
        }
        int endTX = (int)Math.Round(endPos.X.UnitsToTiles());
        int endTZ = (int)Math.Round(endPos.Z.UnitsToTiles());
        RegionMap.Region reg = state.Regions.RegionOfTile(endTX, endTZ);
        if (reg.Owner is null)
        {
            return nextConns[randomBranchIdx % nextConns.Count];
        }
        TrackConnection endConn = new(segmentIdx, ascend);
        ushort? selectedBranch = state.Switches.GetValueOrDefault(endConn);
        if (selectedBranch is ushort branchIdx)
        {
            return nextConns[branchIdx];
        }
        return null;
    }

    float NextStopPointDist(
        CarPosition car, TrackNetwork network, GameState state)
    {
        TrackConnection localSeg = _occupiedSegments[car.LocalSegIdx];
        int segIdx = localSeg.SegmentIdx;
        TrackSegment seg = network.Segments[segIdx];
        bool ascend = !localSeg.ToHighEnd;
        LinSpline.Point p = car.SegmentPos;
        float dist = 0f;
        while (true)
        {
            float step = float.PositiveInfinity * (ascend ? 1 : -1);
            float advanced = seg.LSpline.AdvancePoint(ref p, step);
            if (advanced > 0.001)
            {
                dist += advanced;
                continue;
            }
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
                seg.LSpline.AdvancePoint(ref p, float.PositiveInfinity);
            }
        }
        return dist;
    }

    void UpdateSpeed(TrackNetwork network, GameState state, float deltaTime)
    {
        CarPosition loco = CarPositions.First();
        _speed += Acceleration * deltaTime;
        _speed = Math.Min(_speed, TopSpeed);
        float stopDist = NextStopPointDist(loco, network, state);
        float stopTopSpeed = stopDist * Deceleration;
        _speed = Math.Min(_speed, stopTopSpeed);
    }

    void AdvanceCarPosition(
        TrackNetwork network, GameState state, Random rng,
        CarPosition car, float distance
    )
    {
        float movedDist = distance;
        while (!_atEnd)
        {
            TrackConnection localSeg = _occupiedSegments[car.LocalSegIdx];
            TrackSegment seg = network.Segments[localSeg.SegmentIdx];
            float step = movedDist * (localSeg.ToHighEnd ? -1 : 1);
            LinSpline.Point p = car.SegmentPos;
            movedDist -= seg.LSpline.AdvancePoint(ref p, step);
            car.SegmentPos = p;
            if (movedDist < 0.0001) { break; }
            if (car.LocalSegIdx < _occupiedSegments.Count - 1)
            {
                car.LocalSegIdx += 1;
                continue;
            }
            TrackConnection? oNext = ChooseNextSegment(
                network, state, localSeg.SegmentIdx, !localSeg.ToHighEnd,
                rng.Next(), out _atEnd
            );
            if (oNext is not TrackConnection next) { break; }
            int nextLocalSegIdx = _occupiedSegments.Count;
            _occupiedSegments.Add(next);
            car.LocalSegIdx = nextLocalSegIdx;
            LinSpline.Point np = new();
            if (next.ToHighEnd)
            {
                TrackSegment nextSeg = network.Segments[next.SegmentIdx];
                nextSeg.LSpline.AdvancePoint(ref np, float.PositiveInfinity);
            }
            car.SegmentPos = np;
        }
    }

    void UpdatePosition(
        TrackNetwork network, GameState state, Random rng, float deltaTime
    )
    {
        float movedDist = _speed * deltaTime;
        float locoMovedDist = 
        for (int carI = 0; carI < CarPositions.Count; carI += 1)
        {
            CarPosition carPos = CarPositions[carI];
            float maxDist = movedDist;
            if (carI >= 1)
            {
                float carLocoDist = CarLocoDistances[carI - 1];

            }
            AdvanceCarPosition(network, state, rng, carPos, movedDist);
        }
        CarPosition last = CarPositions.Last();
        if (last.LocalSegIdx > 0)
        {
            int rmCnt = last.LocalSegIdx;
            foreach (CarPosition carPos in CarPositions)
            {
                carPos.LocalSegIdx -= rmCnt;
            }
            _occupiedSegments.RemoveRange(0, rmCnt);
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