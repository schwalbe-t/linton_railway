
using System.IO.Compression;
using System.Numerics;
using System.Security.Cryptography.X509Certificates;

namespace Linton.Game;


public sealed class TrackNetworkGenerator
{

    enum Direction {
        North = 0, South = 1, East = 2, West = 3
    }

    static sbyte DirX(Direction d) => d switch
    {
        Direction.East => +1,
        Direction.West => -1,
        _ => 0
    };

    static sbyte DirZ(Direction d) => d switch
    {
        Direction.North => -1,
        Direction.South => +1,
        _ => 0
    };

    static Direction DirLeft(Direction d) => d switch
    {
        Direction.North => Direction.West,
        Direction.West => Direction.South,
        Direction.South => Direction.East,
        Direction.East => Direction.North,
        _ => d
    };

    static Direction DirRight(Direction d) => d switch
    {
        Direction.North => Direction.East,
        Direction.East => Direction.South,
        Direction.South => Direction.West,
        Direction.West => Direction.North,
        _ => d
    };

    static Direction OppDir(Direction d) => d switch
    {
        Direction.North => Direction.South,
        Direction.South => Direction.North,
        Direction.East => Direction.West,
        Direction.West => Direction.East,
        _ => d
    };

    static bool DirSameAxis(Direction a, Direction b)
        => a == b || OppDir(a) == b;


    readonly struct StationEntrances(
        int entryAX, int entryAZ, Direction entryADir,
        int entryBX, int entryBZ, Direction entryBDir
    )
    {
        public readonly int EntryAX = entryAX;
        public readonly int EntryAZ = entryAZ;
        public readonly int EntryBX = entryBX;
        public readonly int EntryBZ = entryBZ;
        public readonly Direction EntryADir = entryADir;
        public readonly Direction EntryBDir = entryBDir;
    }

    readonly List<TrackStation> _stations = new();
    readonly List<StationEntrances> _stEntrances = new();

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
                    StationLengthTiles(settings),
                    // 1 tile padding on each side for doubled tracks
                    statWidthT + 2
                );
                float statLenU = statLenT.TilesToUnits();
                // determine position
                int chunkOffsetTX = rng.Next(
                    -MaxStationOffsetT, MaxStationOffsetT + 1
                );
                int chunkOffsetTZ = rng.Next(
                    -MaxStationOffsetT, MaxStationOffsetT + 1
                );
                int alongX = rng.NextSingle() <= 0.5f ? 0 : 1;
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
                    (ushort)numPlatforms, platformLength: statLenU
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


    readonly List<uint> _terrainCost;

    uint TerrainCostAt(int tileX, int tileZ)
    {
        if (tileX < 0 || tileX > Terrain.SizeT) { return 0; }
        if (tileZ < 0 || tileZ > Terrain.SizeT) { return 0; }
        return _terrainCost[tileZ * (Terrain.SizeT + 1) + tileX];
    }

    delegate uint TerrainCostFunction(int relTileX, int relTileZ);

    void ApplyTerrainCostFunction(
        int centerTX, int centerTZ, int tileR,
        TerrainCostFunction f
    )
    {
        for (int rTileX = -tileR; rTileX <= tileR; rTileX += 1)
        {
            int tileX = centerTX + rTileX;
            if (tileX < 0 || tileX > Terrain.SizeT) { continue; }
            for (int rTileZ = -tileR; rTileZ <= tileR; rTileZ += 1)
            {
                int tileZ = centerTZ + rTileZ;
                if (tileZ < 0 || tileZ > Terrain.SizeT) { continue; }
                uint cost = f(rTileX, rTileZ);
                int i = tileZ * (Terrain.SizeT + 1) + tileX;
                _terrainCost[i] = Math.Max(_terrainCost[i], cost);
            }
        }
    }

    const int MountainCostApplicTR = 15;
    const uint MountainHeightCostFactor = 15;
    const uint MountainCostFalloff = 40; // per tile manhattan distance

    void ComputeMountainCosts()
    {
        foreach (Terrain.Mountain m in Terrain.Mountains)
        {
            uint baseCost = (uint)(m.Height * MountainHeightCostFactor);
            ApplyTerrainCostFunction(
                m.TileX, m.TileZ, MountainCostApplicTR,
                (rtx, rtz) =>
                {
                    uint dist = (uint)Math.Abs(rtx) + (uint)Math.Abs(rtz);
                    uint redCost = dist * MountainCostFalloff;
                    return baseCost - Math.Min(redCost, baseCost);
                }
            );
        }
    }

    const int RiverTessellationRes = 3;
    const int RiverCostApplicTR = 2;
    const int RiverCost = 50;

    void ComputeRiverCosts()
    {
        foreach (QuadSpline rq in Terrain.Rivers)
        {
            LinSpline r = rq.Tessellate(RiverTessellationRes);
            void ApplyPoint(Vector3 p)
            {
                int centerTX = (int)Math.Round(p.X.UnitsToTiles());
                int centerTZ = (int)Math.Round(p.Z.UnitsToTiles());
                ApplyTerrainCostFunction(
                    centerTX, centerTZ, RiverCostApplicTR, (_, _) => RiverCost
                );
            }
            ApplyPoint(r.Start);
            r.Segments.ForEach(ApplyPoint);
        }
    }

    const float StationRadiusS = 1.5f; // scale for station cost radius
    const uint StationCost = 10000; // should NEVER happen

    void ComputeStationCosts()
    {
        foreach (TrackStation s in _stations)
        {
            Vector3 centerPos = Vector3.Lerp(s.MinPos, s.MaxPos, 0.5f);
            int centerTX = (int)Math.Round(centerPos.X.UnitsToTiles());
            int centerTZ = (int)Math.Round(centerPos.Z.UnitsToTiles());
            Vector3 rTileR = (s.MaxPos - s.MinPos).UnitsToTiles()
                * StationRadiusS;
            int tileR = Math.Max(
                (int)Math.Floor(rTileR.X), (int)Math.Floor(rTileR.Z)
            ) / 2;
            ApplyTerrainCostFunction(
                centerTX, centerTZ, tileR, (_, _) => StationCost
            );
        }
    }



    sealed class Segment(
        Direction dir, sbyte offsetX, sbyte offsetZ, Direction destDir
    )
    {
        public readonly sbyte OffsetX = offsetX;
        public readonly sbyte OffsetZ = offsetZ;
        public readonly Direction Dir = dir;
        public readonly Direction DestDir = destDir;
        public bool Generated = false;
    }

    readonly List<List<Segment>?> _segments;

    List<Segment> SegmentsAt(int x, int z)
    {
        if (x < 0 || x > Terrain.SizeT) { return []; }
        if (z < 0 || z > Terrain.SizeT) { return []; }
        int i = (Terrain.SizeT + 1) * z + x;
        if (_segments[i] is List<Segment> s) { return s; }
        List<Segment> ns = new();
        _segments[i] = ns;
        return ns;
    }


    sealed class SearchPathNode(
        int tileX, int tileZ, uint dist, Direction dir,
        SearchPathNode? parent, uint cost
    )
    {
        public readonly int TileX = tileX;
        public readonly int TileZ = tileZ;
        public readonly uint Dist = dist;
        public readonly Direction Dir = dir;
        public SearchPathNode? Parent = parent;
        public uint Cost = cost;
        public bool Explored = false;
    }

    void BuildFoundPath(SearchPathNode end)
    {
        SearchPathNode current = end;
        while (true)
        {
            SearchPathNode? prev = current.Parent;
            if (prev is null) { break; }
            int offsetTX = current.TileX - prev.TileX;
            int offsetTZ = current.TileZ - prev.TileZ;
            SegmentsAt(prev.TileX, prev.TileZ).Add(new Segment(
                prev.Dir, (sbyte)offsetTX, (sbyte)offsetTZ, current.Dir
            ));
            current = prev;
        }
    }

    const uint DistCostFactor = 10;

    static uint DistanceCost(int aTX, int aTZ, int bTX, int bTZ)
        => ((uint)Math.Abs(bTX - aTX) + (uint)Math.Abs(bTZ - aTZ))
            * DistCostFactor;

    static uint DistanceCost(int tX, int tZ, List<(int, int, Direction)> ends)
    {
        uint min = uint.MaxValue;
        foreach (var (eTX, eTZ, _) in ends)
        {
            min = Math.Min(min, DistanceCost(tX, tZ, eTX, eTZ));
        }
        return min;
    }

    const uint SegmentReverseCost = 10000;
    const uint CurveCost = 1;

    uint AddedSegmentCost(
        Direction startDir,
        int offsetTX, int offsetTZ,
        int destTX, int destTZ,
        Direction destDir, bool isCurve,
        Direction generalPathDir
    )
    {
        int startTX = destTX - offsetTX;
        int startTZ = destTZ - offsetTZ;
        bool existsSame = SegmentsAt(startTX, startTZ).Any(s =>
            s.Dir == startDir && s.OffsetX == offsetTX && s.OffsetZ == offsetTZ
        );
        if (existsSame) { return 0; }
        bool existsOpp = SegmentsAt(destTX, destTZ).Any(s =>
            s.Dir == OppDir(destDir) &&
            s.OffsetX == -offsetTX && s.OffsetZ == -offsetTZ
        );
        if (existsOpp) { return 0; }
        if (startDir == OppDir(generalPathDir))
        {
            return SegmentReverseCost;
        }
        int ctrlTX = startTX + Math.Abs(DirX(startDir)) * offsetTX;
        int ctrlTZ = startTZ + Math.Abs(DirZ(startDir)) * offsetTZ;
        uint terrainCost = Math.Max(Math.Max(
            TerrainCostAt(startTX, startTZ),
            TerrainCostAt(ctrlTX, ctrlTZ)),
            TerrainCostAt(destTX, destTZ)
        );
        uint distCost = DistanceCost(startTX, startTZ, destTX, destTZ);
        uint curveCost = isCurve ? CurveCost : 0;
        return distCost + terrainCost + curveCost;
    }

    static Direction FindPathDirection(
        List<(int, int, Direction)> starts,
        List<(int, int, Direction)> ends
    )
    {
        int mX = 0;
        int mZ = 0;
        foreach (var (sTX, sTZ, _) in starts)
        {
            foreach (var (eTX, eTZ, _) in ends)
            {
                int dX = eTX - sTX;
                if (mX == 0 || Math.Abs(dX) < Math.Abs(mX)) { mX = dX; }
                int dZ = eTZ - sTZ;
                if (mZ == 0 || Math.Abs(dZ) < Math.Abs(mZ)) { mZ = dZ; }
            }
        }
        if (Math.Abs(mX) > Math.Abs(mZ))
        {
            return mX > 0 ? Direction.East : Direction.West;
        }
        return mZ > 0 ? Direction.South : Direction.North;
    }

    const int CurveRadius = 3;

    bool GeneratePath(
        List<(int, int, Direction)> starts,
        List<(int, int, Direction)> ends
    )
    {
        Direction generalPathDir = FindPathDirection(starts, ends);
        Dictionary<(int, int, Direction), SearchPathNode> nodes = new();
        foreach (var start in starts)
        {
            var (startTX, startTZ, startDir) = start;
            uint startDist = DistanceCost(startTX, startTZ, ends);
            SearchPathNode node = new(
                startTX, startTZ, startDist, startDir, null, 0
            );
            nodes.Add(start, node);
        }
        while (true)
        {
            SearchPathNode? current = null;
            uint cheapestCost = uint.MaxValue;
            foreach (SearchPathNode node in nodes.Values)
            {
                if (node.Explored) { continue; }
                uint cost = node.Cost + node.Dist;
                if (cost > cheapestCost) { continue; }
                current = node;
                cheapestCost = cost;
            }
            if (current is null) { return false; } // no path found
            if (ends.Any(e => e == (current.TileX, current.TileZ, current.Dir)))
            {
                BuildFoundPath(current);
                return true;
            }
            current.Explored = true;
            bool isOob = current.TileX < 0 || current.TileX >= Terrain.SizeT
                || current.TileZ < 0 || current.TileX >= Terrain.SizeT;
            if (isOob) { continue; }
            void AddNode(int oTX, int oTZ, Direction newDir, bool isCurve)
            {
                int tileX = current.TileX + oTX;
                int tileZ = current.TileZ + oTZ;
                uint cost = current.Cost + AddedSegmentCost(
                    current.Dir, oTX, oTZ, tileX, tileZ, newDir, isCurve,
                    generalPathDir
                );
                uint dist = DistanceCost(tileX, tileZ, ends);
                SearchPathNode? existing = nodes.GetValueOrDefault((
                    tileX, tileZ, newDir
                ));
                if (existing is not null && cost < existing.Cost)
                {
                    existing.Cost = cost;
                    existing.Parent = current;
                    existing.Explored = false;
                }
                else if(existing is null)
                {
                    nodes.Add((tileX, tileZ, newDir), new SearchPathNode(
                        tileX, tileZ, dist, newDir, current, cost
                    ));
                }
            }
            AddNode(
                DirX(current.Dir), DirZ(current.Dir),
                current.Dir, isCurve: false
            );
            Direction left = DirLeft(current.Dir);
            AddNode(
                (DirX(current.Dir) + DirX(left)) * CurveRadius,
                (DirZ(current.Dir) + DirZ(left)) * CurveRadius,
                left, isCurve: true
            );
            Direction right = DirRight(current.Dir);
            AddNode(
                (DirX(current.Dir) + DirX(right)) * CurveRadius,
                (DirZ(current.Dir) + DirZ(right)) * CurveRadius,
                right, isCurve: true
            );
        }
    }


    void TryConnectStations(
        int chunkX, int chunkZ, Direction dir, Random rng
    )
    {
        bool startOob = chunkX < 0 || chunkX >= Terrain.SizeC
            || chunkZ < 0 || chunkZ >= Terrain.SizeC;
        int destCX = chunkX + DirX(dir);
        int destCZ = chunkZ + DirZ(dir);
        bool destOob = destCX < 0 || destCX >= Terrain.SizeC
            || destCZ < 0 || destCZ >= Terrain.SizeC;
        if (!startOob && !destOob)
        {
            StationEntrances a = _stEntrances[chunkZ * Terrain.SizeC + chunkX];
            var aB = (a.EntryBX, a.EntryBZ, OppDir(a.EntryBDir));
            StationEntrances b = _stEntrances[destCZ * Terrain.SizeC + destCX];
            var bA = (b.EntryAX, b.EntryAZ, b.EntryADir);
            GeneratePath([aB], [bA]);
            return;
        }
        if (destOob && !startOob)
        {
            StationEntrances a = _stEntrances[chunkZ * Terrain.SizeC + chunkX];
            var aB = (a.EntryBX, a.EntryBZ, OppDir(a.EntryBDir));
            var edgeTX = dir == Direction.South ? a.EntryBX
                : (a.EntryBX.TilesToChunks() + 1).ChunksToTiles();
            var edgeTZ = dir == Direction.East ? a.EntryBZ
                : (a.EntryBZ.TilesToChunks() + 1).ChunksToTiles();
            GeneratePath([aB], [(edgeTX, edgeTZ, dir)]);
            return;
        }
        if (startOob && !destOob)
        {
            StationEntrances b = _stEntrances[destCZ * Terrain.SizeC + destCX];
            var bA = (b.EntryAX, b.EntryAZ, b.EntryADir);
            var edgeTX = dir == Direction.South ? b.EntryAX
                : b.EntryAX.TilesToChunks().ChunksToTiles();
            var edgeTZ = dir == Direction.East ? b.EntryAZ
                : b.EntryAZ.TilesToChunks().ChunksToTiles();
            GeneratePath([(edgeTX, edgeTZ, dir)], [bA]);
            return;
        }
    }


    void GenerateSegmentChainSpline(Segment start, int startTX, int startTZ)
    {
        if (start.Generated) { return; }
        Segment current = start;
        int currTX = startTX;
        int currTZ = startTZ;
        var startPos = new Vector3(currTX, 0, currTZ).TilesToUnits();
        List<QuadSpline.Segment> segments = new();
        while (!current.Generated)
        {
            int ctrlTX = currTX
                + Math.Abs(DirX(current.Dir)) * current.OffsetX;
            int ctrlTZ = currTZ
                + Math.Abs(DirZ(current.Dir)) * current.OffsetZ;
            var ctrlPos = new Vector3(ctrlTX, 0, ctrlTZ).TilesToUnits();
            int destTX = currTX + current.OffsetX;
            int destTZ = currTZ + current.OffsetZ;
            var destPos = new Vector3(destTX, 0, destTZ).TilesToUnits();
            segments.Add(new QuadSpline.Segment(ctrlPos, destPos));
            current.Generated = true;
            var atDest = SegmentsAt(destTX, destTZ)
                .Where(s => s.Dir == current.DestDir)
                .ToList();
            if (atDest.Count != 1) { break; }
            current = atDest[0];
            currTX = destTX;
            currTZ = destTZ;
        }
        if (segments.Count == 0) { return; }
        _splines.Add(new QuadSpline(startPos, segments));
    }

    void GenerateSegmentSplines()
    {
        for (int tileX = 0; tileX <= Terrain.SizeT; tileX += 1)
        {
            for (int tileZ = 0; tileZ <= Terrain.SizeT; tileZ += 1)
            {
                foreach (Segment s in SegmentsAt(tileX, tileZ))
                {
                    GenerateSegmentChainSpline(s, tileX, tileZ);
                }
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
        _terrainCost = Enumerable.Range(0, segmentC * segmentC)
            .Select(_ => (uint)0)
            .ToList();
        ComputeMountainCosts();
        ComputeRiverCosts();
        ComputeStationCosts();
        for (int chunkZ = -1; chunkZ < terrain.SizeC; chunkZ += 1)
        {
            for (int chunkX = -1; chunkX < terrain.SizeC; chunkX += 1)
            {
                TryConnectStations(chunkX, chunkZ, Direction.East, rng);
                TryConnectStations(chunkX, chunkZ, Direction.South, rng);
            }
        }
        GenerateSegmentSplines();
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
        static Vector3 NormOrNull(Vector3 n)
        {
            float l = n.Length();
            if (l == 0f) { return n; }
            return n / l;
        }
        Vector3 startDir = NormOrNull(s.Segments[0].Ctrl - s.Start);
        List<QuadSpline.Segment> left = new();
        List<QuadSpline.Segment> right = new();
        Vector3 prev = s.Start;
        for (int segI = 0; segI < s.Segments.Count; segI += 1)
        {
            QuadSpline.Segment seg = s.Segments[segI];
            Vector3 ctrlDir = NormOrNull(seg.To - prev);
            Vector3 nextCtrl = segI < s.Segments.Count - 1
                ? s.Segments[segI + 1].Ctrl
                : seg.To;
            Vector3 toDir = NormOrNull(nextCtrl - seg.Ctrl);
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
        // List<QuadSpline> doubled = new();
        // _splines.ForEach(s => DoubleTrackSpline(s, doubled));
        // return new TrackNetwork(doubled, _stations, _entrances);
        return new TrackNetwork(_splines, _stations, _entrances);
    }

}