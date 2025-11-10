
using System.Numerics;

namespace Linton.Game;


public sealed class TrackNetworkGenerator
{

    enum Direction {
        North = 0,
        South = 1,
        East = 2,
        West = 3
    }

    static sbyte DirectionX(Direction d) => d switch
    {
        Direction.East => -1,
        Direction.West => +1,
        _ => 0
    };

    static sbyte DirectionZ(Direction d) => d switch
    {
        Direction.North => -1,
        Direction.South => +1,
        _ => 0
    };


    readonly struct Segment(
        Direction startDir, sbyte offsetX, sbyte offsetZ, Direction endDir
    )
    {
        readonly sbyte OffsetX = offsetX;
        readonly sbyte OffsetZ = offsetZ;
        readonly Direction StartDir = startDir;
        readonly Direction EndDir = endDir;

        sbyte CtrlX => (sbyte)(Math.Abs(DirectionX(StartDir)) * OffsetX);
        sbyte CtrlZ => (sbyte)(Math.Abs(DirectionZ(StartDir)) * OffsetZ);
    }

    readonly List<List<Segment>?> _segments;

    List<Segment> SegmentsAt(int x, int z)
    {
        int i = (Terrain.SizeT + 1) * z + x;
        if (_segments[i] is List<Segment> s) { return s; }
        List<Segment> ns = new();
        _segments[i] = ns;
        return ns;
    }


    readonly struct StationEntrances(
        int entryAX, int entryAZ, Direction entryADir,
        int entryBX, int entryBZ, Direction entryBDir
    )
    {
        readonly int EntryAX = entryAX;
        readonly int EntryAZ = entryAZ;
        readonly int EntryBX = entryBX;
        readonly int EntryBZ = entryBZ;
        readonly Direction EntryADir = entryADir;
        readonly Direction EntryBDir = entryBDir;
    }

    readonly List<TrackStation> _stations = new();
    readonly List<StationEntrances> _stEntrances = new();

    StationEntrances EntrancesAt(int x, int z)
        => _stEntrances[z * Terrain.SizeC + x];

    const int MaxStationOffsetT = 5;
    const int MinNumStationPlatforms = 2;
    const int MaxNumStationPlatforms = 3;
    const int StationEntryOffsetT = 3;
    const int PlatformSpacingT = 2;

    static int StationLengthTiles(RoomSettings s) => s.TrainLength switch
    {
        TrainLength.Short => 3,
        TrainLength.Medium => 5,
        TrainLength.Long => 7,
        _ => 0
    };

    void GenerateStations(RoomSettings settings, Random rng)
    {
        for (int chunkZ = 0; chunkZ < Terrain.SizeC; chunkZ += 1)
        {
            for (int chunkX = 0; chunkX < Terrain.SizeC; chunkX += 1)
            {
                // figure out width and length of station
                int numPlatforms = rng.Next(
                    MinNumStationPlatforms, MaxNumStationPlatforms + 1
                );
                int statWidthT = (numPlatforms - 1) * PlatformSpacingT;
                float statWidthU = statWidthT.TilesToUnits();
                int statLenT = Math.Max(
                    StationLengthTiles(settings), statWidthT
                );
                float statLenU = statLenT.TilesToUnits();
                // determine position
                int chunkOffsetTX = rng.Next(
                    -MaxStationOffsetT, MaxStationOffsetT + 1
                );
                int chunkOffsetTZ = rng.Next(
                    -MaxStationOffsetT, MaxStationOffsetT + 1
                );
                int alongX = rng.Next() / 13 % 2;
                int alongZ = alongX == 0 ? 1 : 0;
                int entryRelTX = -alongX * (StationEntryOffsetT + statLenT / 2);
                int entryRelTZ = -alongZ * (StationEntryOffsetT + statLenT / 2);
                int entryTX = chunkX.ChunksToTiles() + 1.ChunksToTiles() / 2
                    + chunkOffsetTX + entryRelTX;
                int entryTZ = chunkZ.ChunksToTiles() + 1.ChunksToTiles() / 2
                    + chunkOffsetTZ + entryRelTZ;
                int exitTX = entryTX
                    + alongX * (2 * StationEntryOffsetT + statLenT);
                int exitTZ = entryTZ
                    + alongZ * (2 * StationEntryOffsetT + statLenT);
                float minX = entryTX.TilesToUnits()
                    + alongX * StationEntryOffsetT.TilesToUnits()
                    - alongZ * statLenU / 2f;
                float minZ = entryTZ.TilesToUnits()
                    + alongZ * StationEntryOffsetT.TilesToUnits()
                    - alongX * statLenU / 2f;
                Vector3 min = new(minX, 0f, minZ);
                Vector3 max = new(minX + statLenU, 0f, minZ + statLenU);
                _stations.Add(new TrackStation(
                    min, max, isAlongZ: alongZ == 1,
                    (ushort) numPlatforms, platformLength: statLenU
                ));
                // generate platforms
                float pltBaseOffset = (statLenU - statWidthU) / 2f;
                float pltMinX = minX + alongZ * pltBaseOffset;
                float pltMinZ = minZ + alongX * pltBaseOffset;
                var entry = new Vector3(entryTX, 0, entryTZ).TilesToUnits();
                var exit = new Vector3(exitTX, 0, exitTZ).TilesToUnits();
                for (int pltI = 0; pltI < numPlatforms; pltI += 1)
                {
                    float pltEntryX = pltMinX
                        + alongZ * pltI * PlatformSpacingT.TilesToUnits();
                    float pltEntryZ = pltMinZ
                        + alongX * pltI * PlatformSpacingT.TilesToUnits();
                    Vector3 pltEntry = new(pltEntryX, 0, pltEntryZ);
                    Vector3 pltEntryMid = Vector3.Lerp(entry, pltEntry, 0.5f);
                    float pltExitX = pltEntryX + alongX * statLenU;
                    float pltExitZ = pltEntryZ + alongZ * statLenU;
                    Vector3 pltExit = new(pltExitX, 0, pltExitZ);
                    Vector3 pltExitMid = Vector3.Lerp(pltExit, exit, 0.5f);
                    Vector3 pltCtrlOffset = (
                        new Vector3(alongX, 0, alongZ) * StationEntryOffsetT
                    ).TilesToUnits() / 4f;
                    _splines.Add(new QuadSpline(
                        Start: entry,
                        Segments: [
                            new QuadSpline.Segment(
                                Ctrl: entry + pltCtrlOffset,
                                To: pltEntryMid
                            ),
                            new QuadSpline.Segment(
                                Ctrl: pltEntry - pltCtrlOffset,
                                To: pltEntry
                            ),
                            new QuadSpline.Segment(pltExit, pltExit),
                            new QuadSpline.Segment(
                                Ctrl: pltExit + pltCtrlOffset,
                                To: pltExitMid
                            ),
                            new QuadSpline.Segment(
                                Ctrl: exit - pltCtrlOffset,
                                To: exit
                            )
                        ]
                    ));
                }
                _stEntrances.Add(new StationEntrances(
                    entryTX, entryTZ,
                    alongX == 1 ? Direction.East : Direction.South,
                    exitTX, exitTZ,
                    alongX == 1 ? Direction.West : Direction.North
                ));
            }
        }
    }


    public readonly Terrain Terrain;

    public TrackNetworkGenerator(
        Terrain terrain, RoomSettings settings, Random rng
    )
    {
        Terrain = terrain;
        int segmentC = terrain.SizeT + 1;
        _segments = Enumerable.Range(0, segmentC * segmentC)
            .Select(_ => (List<Segment>?)null)
            .ToList();
        GenerateStations(settings, rng);
    }


    readonly List<QuadSpline> _splines = new();
    readonly List<Vector3> _entrances = new();

    const float DoubleTrackOffset = 3f / 2f;
    static readonly Vector3 TrackUp = new(0, 1, 0);

    static Vector3 DoubleLeft(Vector3 p, Vector3 d)
        => p + (Vector3.Cross(TrackUp, d) * DoubleTrackOffset);

    static Vector3 DoubleRight(Vector3 p, Vector3 d)
        => p + (Vector3.Cross(d, TrackUp) * DoubleTrackOffset);

    static void DoubleTrackSpline(QuadSpline s, List<QuadSpline> o)
    {
        if (s.Segments.Count == 0) { return; }
        Vector3 startDir = Vector3.Normalize(s.Segments[0].Ctrl - s.Start);
        List<QuadSpline.Segment> left = new();
        List<QuadSpline.Segment> right = new();
        Vector3 prev = s.Start;
        for (int segI = 0; segI < s.Segments.Count; segI += 1)
        {
            QuadSpline.Segment seg = s.Segments[segI];
            Vector3 ctrlDir = Vector3.Normalize(seg.To - prev);
            Vector3 nextCtrl = segI < s.Segments.Count - 1
                ? s.Segments[segI + 1].Ctrl
                : seg.To;
            Vector3 toDir = Vector3.Normalize(nextCtrl - seg.Ctrl);
            left.Add(new QuadSpline.Segment(
                Ctrl: DoubleLeft(seg.Ctrl, ctrlDir),
                To: DoubleLeft(seg.To, toDir)
            ));
            right.Add(new QuadSpline.Segment(
                Ctrl: DoubleRight(seg.Ctrl, ctrlDir),
                To: DoubleRight(seg.To, toDir)
            ));
        }
        o.Add(new QuadSpline(
            Start: DoubleLeft(s.Start, startDir),
            Segments: left
        ));
        o.Add(new QuadSpline(
            Start: DoubleRight(s.Start, startDir),
            Segments: right
        ));
    }

    public TrackNetwork Build()
    {
        List<QuadSpline> doubled = new();
        _splines.ForEach(s => DoubleTrackSpline(s, doubled));
        return new TrackNetwork(doubled, _stations, _entrances);
    }

}