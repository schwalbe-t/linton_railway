
using System.Drawing;
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


public static class TerrainUnits
{
    public const int UnitsPerTile = 5;
    public const int TilesPerChunk = 32;
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
    /// Represents the peak of a mountain in the terrain.
    /// </summary>
    /// <param name="TileX">the X tile coordinate of the peak</param>
    /// <param name="TileZ">the Z tile coordinate of the peak</param>
    /// <param name="Height">the height of the peak in units</param>
    public sealed record Mountain(
        [property: JsonProperty("tileX")] int TileX,
        [property: JsonProperty("tileZ")] int TileZ,
        [property: JsonProperty("height")] float Height
    )
    {
        public const float MinHeight = 25.0f;
        public const float MaxHeight = 35.0f;
        public const float HeightRange = MaxHeight - MinHeight;

        public const float MinChance = 0.2f;
        public const float MaxChance = 0.75f;
        public const float ChanceRange = MaxChance - MinChance;
    }

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

    [JsonProperty("mountains")]
    public readonly List<Mountain> Mountains;

    public Terrain(int playerCount, ushort seed, Random rng)
    {
        Seed = seed;
        int playerChunks = playerCount * ChunksPerPlayer;
        SizeC = BaseSizeChunks + (int)Math.Ceiling(Math.Sqrt(playerChunks));
        SizeT = SizeC.ChunksToTiles();
        SizeU = SizeT.TilesToUnits();
        int numRivers = (int)(SizeC * RiversPerChunkSize);
        var noise = new FastNoise();
        noise.SetSeed(Seed);
        Rivers = GenerateRivers(numRivers, rng, noise);
        Mountains = GenerateMountains(rng, noise);
    }

    List<QuadSpline> GenerateRivers(int numRivers, Random rng, FastNoise noise)
        => Enumerable.Range(0, numRivers)
            .Select(_ => GenerateRiver(rng, noise))
            .ToList();

    const float RiverDCPerlinScale = 1234f;
    const float RiverDVPerlinScale = 5432f;
    const float RiverTurnProbability = 0.4f;
    const int RiverTurnRadius = 5;

    QuadSpline GenerateRiver(Random rng, FastNoise noise)
    {
        bool alongX = rng.Next(2) == 0;
        int tileX = alongX ? 0 : rng.Next(SizeT);
        int tileZ = !alongX ? 0 : rng.Next(SizeT);
        Vector3 start = new(tileX.TilesToUnits(), 0, tileZ.TilesToUnits());
        List<QuadSpline.Segment> segments = new();
        int dirX = alongX ? 1 : 0;
        int dirZ = alongX ? 0 : 1;
        while (tileX >= 0 && tileX <= SizeT && tileZ >= 0 && tileZ <= SizeT)
        {
            // n is between -1 and 1
            float dcn = noise.GetPerlin(
                tileX * RiverDCPerlinScale, tileZ * RiverDCPerlinScale
            );
            bool changeDir = (dcn + 1f) / 2f <= RiverTurnProbability;
            int ctrlDist = changeDir ? RiverTurnRadius : 1;
            int ctrlX = tileX + dirX * ctrlDist;
            int ctrlZ = tileZ + dirZ * ctrlDist;
            if (changeDir)
            {
                float dvn = noise.GetPerlin(
                    tileX * RiverDVPerlinScale, tileZ * RiverDVPerlinScale
                );
                int chosenDir = dvn > 0.0 ? 1 : -1;
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
                tileX = ctrlX + dirX * ctrlDist;
                tileZ = ctrlZ + dirZ * ctrlDist;
            }
            else
            {
                tileX += dirX * ctrlDist;
                tileZ += dirZ * ctrlDist;
            }
            Vector3 ctrl = new(ctrlX.TilesToUnits(), 0, ctrlZ.TilesToUnits());
            Vector3 to = new(tileX.TilesToUnits(), 0, tileZ.TilesToUnits());
            segments.Add(new QuadSpline.Segment(ctrl, to));
        }
        return new QuadSpline(start, segments);
    }

    const float PeakCPerlinScale = 143.4f;
    const float PeakHPerlinScale = 3.14f;

    List<Mountain> GenerateMountains(Random rng, FastNoise noise)
    {
        var mountains = new List<Mountain>();
        for (int chunkX = 0; chunkX < SizeC; chunkX += 1)
        {
            for (int chunkZ = 0; chunkZ < SizeC; chunkZ += 1)
            {
                float cn = noise.GetPerlin(
                    chunkX * PeakCPerlinScale, chunkZ * PeakCPerlinScale
                );
                float spawnChance = (cn + 1f) / 2f * Mountain.ChanceRange
                    + Mountain.MinChance;
                bool createMountain = rng.NextSingle() < spawnChance;
                if (!createMountain) { continue; }
                int rTileX = rng.Next(1.ChunksToTiles());
                int rTileZ = rng.Next(1.ChunksToTiles());
                int tileX = chunkX.ChunksToTiles() + rTileX;
                int tileZ = chunkZ.ChunksToTiles() + rTileZ;
                float hn = noise.GetPerlin(
                    chunkX * PeakHPerlinScale, chunkZ * PeakHPerlinScale
                );
                float height = hn * Mountain.HeightRange + Mountain.MinHeight;
                mountains.Add(new Mountain(tileX, tileZ, height));
            }
        }
        return mountains;
    }

}