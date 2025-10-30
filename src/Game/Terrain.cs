
using System.Drawing;
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


public static class TerrainUnits
{
    public const int UnitsPerTile = 10;
    public const int TilesPerChunk = 10;
    public const int UnitsPerChunk = UnitsPerTile * TilesPerChunk;

    public static int UnitsToTiles(this int u) => u / UnitsPerTile;
    public static int TilesToChunks(this int t) => t / TilesPerChunk;
    public static int UnitsToChunks(this int u) => u / UnitsPerChunk;

    public static int TilesToUnits(this int t) => t * UnitsPerTile;
    public static int ChunksToTiles(this int c) => c * TilesPerChunk;
    public static int ChunksToUnits(this int c) => c * UnitsPerChunk;

    public static float UnitsToTiles(this float u) => u / UnitsPerTile;
    public static float TilesToChunks(this float t) => t / TilesPerChunk;
    public static float UnitsToChunks(this float u) => u / UnitsPerChunk;

    public static float TilesToUnits(this float t) => t * UnitsPerTile;
    public static float ChunksToTiles(this float c) => c * TilesPerChunk;
    public static float ChunksToUnits(this float c) => c * UnitsPerChunk;
}


/// <summary>
/// Represents the abstract server-side terrain of the game world.
/// </summary>
public sealed class Terrain
{

    /// <summary>
    /// The base size (width and height) of the terrain.
    /// </summary>
    public const int BaseSizeChunks = 2;

    /// <summary>
    /// The minimum number of additional chunks to generate for each player.
    /// </summary>
    public const int ChunksPerPlayer = 10;

    /// <summary>
    /// The number of rivers to generate for every chunk of world size.
    /// </summary>
    public const float RiversPerChunkSize = 1f / 3f;


    /// <summary>
    /// The seed that this terrain was generated from.
    /// Clients may use this to generate the same concrete elevation data.
    /// </summary>
    [JsonProperty("seed")] public readonly ushort Seed;

    [JsonProperty("sizeU")] public readonly int SizeU;
    [JsonProperty("sizeT")] public readonly int SizeT;
    [JsonProperty("sizeC")] public readonly int SizeC;

    [JsonProperty("rivers")]
    public readonly List<QuadSpline> Rivers;

    public Terrain(int playerCount, ushort seed, Random rng)
    {
        Seed = seed;
        int playerChunks = playerCount * ChunksPerPlayer;
        SizeC = BaseSizeChunks + (int)Math.Ceiling(Math.Sqrt(playerChunks));
        SizeT = SizeC.ChunksToTiles();
        SizeU = SizeT.TilesToUnits();
        int numRivers = (int)(SizeC * RiversPerChunkSize);
        Rivers = GenerateRivers(numRivers, rng);
    }

    List<QuadSpline> GenerateRivers(int numRivers, Random rng)
    {
        var noise = new FastNoise();
        noise.SetSeed(Seed);
        return Enumerable.Range(0, numRivers)
            .Select(_ => GenerateRiver(rng, noise))
            .ToList();
    }

    const float RiverPerlinScale = 123.5f;

    QuadSpline GenerateRiver(Random rng, FastNoise noise)
    {
        bool alongX = rng.Next(2) == 0;
        int tileX =  alongX ? 0 : rng.Next(SizeT);
        int tileZ = !alongX ? 0 : rng.Next(SizeT);
        Vector3 start = new(tileX.TilesToUnits(), 0, tileZ.TilesToUnits());
        List<QuadSpline.Segment> segments = new();
        int dirX = alongX ? 1 : 0;
        int dirZ = alongX ? 0 : 1;
        while (tileX >= 0 && tileX <= SizeT && tileZ >= 0 && tileZ <= SizeT)
        {
            int ctrlX = tileX + dirX;
            int ctrlZ = tileZ + dirZ;
            // n is between -1 and 1
            float n = noise.GetPerlin(
                tileX * RiverPerlinScale, tileZ * RiverPerlinScale
            );
            bool changeDir = n >= 0f;
            if (changeDir)
            {
                int chosenDir = (Math.Abs(n) > 0.5f) ? 1 : -1;
                bool oldDirX = dirX != 0;
                bool oldDirZ = dirZ != 0;
                if (alongX)
                {
                    dirX = oldDirZ ? 1 : 0;
                    dirZ = oldDirZ ? 0 : chosenDir;
                }
                else
                {
                    dirX = oldDirX ? 0 : chosenDir;
                    dirZ = oldDirX ? 1 : 0;
                }
                tileX = ctrlX + dirX;
                tileZ = ctrlZ + dirZ;
            }
            else
            {
                tileX += dirX;
                tileZ += dirZ;
            }
            Vector3 ctrl = new(ctrlX.TilesToUnits(), 0, ctrlZ.TilesToUnits());
            Vector3 to = new(tileX.TilesToUnits(), 0, tileZ.TilesToUnits());
            segments.Add(new QuadSpline.Segment(ctrl, to));
        }
        return new QuadSpline(start, segments);
    }
    
}