
using System.Numerics;

namespace Linton.Game;


/// <summary>
/// Maps tiles in the game world to their corresponding owning players.
/// </summary>
public sealed class RegionMap
{
    public sealed class Region
    {
        /// <summary>The X position of the region station in tiles.</summary>
        public readonly int TileX;
        /// <summary>The Z position of the region station in tiles.</summary>
        public readonly int TileZ;
        
        readonly Lock _lock = new();
        Player? _owner = null;
        /// <summary>The current owner of the region (or else null)</summary>
        public Player? Owner { get { lock(_lock) { return _owner; } } }

        /// <summary>
        /// Creates a new region centered around a given track station.
        /// </summary>
        /// <param name="station">the region station</param>
        public Region(TrackStation station)
        {
            Vector3 center = Vector3.Lerp(station.MinPos, station.MaxPos, 0.5f);
            TileX = (int)Math.Floor(center.X.UnitsToTiles());
            TileZ = (int)Math.Floor(center.Z.UnitsToTiles());
        }

        /// <summary>
        /// Creates a new region centered in the given chunk.
        /// </summary>
        /// <param name="chunkX">chunk X coordinate</param>
        /// <param name="chunkZ">chunk Z coordinate</param>
        public Region(int chunkX, int chunkZ)
        {
            TileX = chunkX.ChunksToTiles() + (1.ChunksToTiles() / 2);
            TileZ = chunkZ.ChunksToTiles() + (1.ChunksToTiles() / 2);
        }

        /// <summary>
        /// Attempts to take ownership of the region as the given player.
        /// </summary>
        /// <param name="p">the player to become owner</param>
        /// <returns>true if made owner, false if region already taken</returns>
        public bool TryTake(Player p)
        {
            lock(_lock)
            {
                if (_owner is not null) { return false; }
                _owner = p;
            }
            return true;
        }
    }

    /// <summary>The size of the region map in chunks.</summary>
    public readonly int SizeC;
    /// <summary>The size of the region map in tiles.</summary>
    public readonly int SizeT;

    /// <summary>
    /// Maps each chunk coordinate (row-major, i = cz * SizeC + cx)
    /// to the corresponding region.
    /// </summary>
    readonly List<Region> _chunks;

    /// <summary>
    /// Maps each tile coordinate (row-major, i = tz * SizeT + tx)
    /// to the index of the corresponding region in '_chunks'.
    /// </summary>
    readonly List<ushort> _tiles;

    /// <summary>
    /// Attempts to find the index of the region that the tile at the given
    /// coordinates belongs to by checking the manhattan distances to each of
    /// the stations in each neighbor chunk (and that of the given tile).
    /// </summary>
    /// <param name="tileX">the X coordinate of the tile</param>
    /// <param name="tileZ">the Z coordinate of the tile</param>
    /// <returns>the index of the region the tile belongs to</returns>
    /// <exception cref="Exception">if the world has size 0</exception>
    private ushort SlowFindTileRegion(int tileX, int tileZ)
    {
        int oChunkX = tileX.TilesToChunks();
        int oChunkZ = tileZ.TilesToChunks();
        int minChunkX = Math.Max(oChunkX - 1, 0);
        int minChunkZ = Math.Max(oChunkZ - 1, 0);
        int maxChunkX = Math.Min(oChunkX + 1, SizeC - 1);
        int maxChunkZ = Math.Min(oChunkZ + 1, SizeC - 1);
        int closestIdx = -1;
        int closestDist = int.MaxValue;
        for (int chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1)
        {
            for (int chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1)
            {
                int i = chunkZ * SizeC + chunkX;
                Region r = _chunks[i];
                int dist = Math.Abs(r.TileX - tileX)
                    + Math.Abs(r.TileZ - tileZ);
                if (dist >= closestDist) { continue; }
                closestIdx = i;
                closestDist = dist;
            }
        }
        if (closestIdx != -1) { return (ushort)closestIdx; }
        throw new Exception("Unable to find tile region");
    }

    /// <summary>
    /// Constructs and fully initializes a new region map based on the given
    /// size in chunks and track stations.
    /// Chunks for which no station is provided are assigned their center tile
    /// as the station coordinates.
    /// </summary>
    /// <param name="sizeT">the size of the map in tiles</param>
    /// <param name="stations">all stations that should be included</param>
    public RegionMap(int sizeT, List<TrackStation> stations) {
        SizeC = sizeT.TilesToChunks();
        SizeT = sizeT;
        _chunks = Enumerable.Range(0, SizeC * SizeC)
            .Select(_ => (Region)null!)
            .ToList();
        foreach (TrackStation station in stations)
        {
            Region r = new(station);
            int chunkX = r.TileX.TilesToChunks();
            int chunkZ = r.TileZ.TilesToChunks();
            _chunks[chunkZ * SizeC + chunkX] = r;
        }
        for (int regI = 0; regI < _chunks.Count; regI += 1)
        {
            if (_chunks[regI] != null) { continue; }
            _chunks[regI] = new Region(regI % SizeC, regI / SizeC);
        }
        _tiles = Enumerable.Range(0, SizeT * SizeT)
            .Select(i => SlowFindTileRegion(i % SizeT, i / SizeT))
            .ToList();
    }

    /// <summary>
    /// Performs a fast lookup into the map to determine the region that the
    /// tile with the given coordinates belongs to.
    /// If the given coordinates are out of bounds, the region of the closest
    /// tile that is in bounds will be returned instead.
    /// </summary>
    /// <param name="tileX">the X coordinate of the tile</param>
    /// <param name="tileZ">the Z coordinate of the tile</param>
    /// <returns>the region the tile belongs to</returns>
    public Region RegionOfTile(int tileX, int tileZ)
    {
        int tx = Math.Clamp(tileX, 0, SizeT - 1);
        int tz = Math.Clamp(tileZ, 0, SizeT - 1);
        ushort ri = _tiles[tz * SizeT + tx];
        return _chunks[ri];
    }

}