
in vec2 fTileCoords;

out vec4 oColor;

#define MAX_WORLD_CHUNK_LEN 60
#define MAX_CHUNK_COUNT MAX_WORLD_CHUNK_LEN * MAX_WORLD_CHUNK_LEN
layout(std140) uniform uStations {
    vec4 stations[MAX_CHUNK_COUNT];
};

uniform float uWorldSizeC;
uniform float uTilesPerChunk;

vec3 stationAt(int chunkX, int chunkZ, int sizeC) {
    return stations[chunkZ * sizeC + chunkX].xyz;
}

void main() {
    int sizeC = int(uWorldSizeC);
    int tilesPerChunk = int(uTilesPerChunk);
    int fTileX = int(fTileCoords.x);
    int fTileZ = int(fTileCoords.y);
    int fChunkX = fTileX / tilesPerChunk;
    int fChunkZ = fTileZ / tilesPerChunk;
    int minChunkX = max(fChunkX - 1, 0);
    int minChunkZ = max(fChunkZ - 1, 0);
    int maxChunkX = min(fChunkX + 1, sizeC - 1);
    int maxChunkZ = min(fChunkZ + 1, sizeC - 1);
    float closestTileDist = 9999999.9; // big value
    float closestValue = 0.0;
    for (int chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        for (int chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
            vec3 station = stationAt(chunkX, chunkZ, sizeC);
            vec2 diff = station.xy - fTileCoords;
            float stationTileDist = abs(diff.x) + abs(diff.y);
            if (stationTileDist >= closestTileDist) { continue; }
            closestTileDist = stationTileDist;
            closestValue = station.z;
        }
    }
    oColor = vec4(closestValue, 0.0, 0.0, 1.0);
}