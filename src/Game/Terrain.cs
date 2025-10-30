
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


public sealed class Terrain
{
    
}