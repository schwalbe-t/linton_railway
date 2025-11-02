import { Matrix4, Vector3 } from "../libs/math.gl.js";
import { Geometry, Texture } from "./graphics.js";
import { Renderer } from "./renderer.js";

export const units = Object.freeze({
    toTiles:  u => u / Terrain.UNITS_PER_TILE,
    toChunks: u => u / Terrain.UNITS_PER_CHUNK
});

export const tiles = Object.freeze({
    toUnits:  t => t * Terrain.UNITS_PER_TILE,
    toChunks: t => t / Terrain.TILES_PER_CHUNK
});

export const chunks = Object.freeze({
    toUnits: c => c * Terrain.UNITS_PER_CHUNK,
    toTiles: c => c * Terrain.TILES_PER_CHUNK
});


class ChunkElevation {

    constructor(chunkX, chunkZ, details) {
        const chunkSizeTiles = chunks.toTiles(1);
        this.originTileX = chunks.toTiles(chunkX);
        this.originTileZ = chunks.toTiles(chunkZ);
        this.elevation = new Array(chunkSizeTiles ** 2);
        for (let rTileX = 0; rTileX < (chunkSizeTiles + 1); rTileX += 1) {
            for (let rTileZ = 0; rTileZ < (chunkSizeTiles + 1); rTileZ += 1) {
                const tileX = this.originTileX + rTileX;
                const tileZ = this.originTileZ + rTileZ;
                const elev 
                    = noise.perlin2(tileX / 3.14, tileZ / 3.14)
                    + noise.perlin2(tileX / 12.5, tileZ / 12.5) * 10
                    + noise.perlin2(tileX / 21, tileZ / 21) * 20
                    + noise.perlin2(tileX / 67, tileZ / 67) * 200;
                this.elevation[this.indexOfRel(rTileX, rTileZ)] = elev;
            }
        }
    }

    indexOfRel(rTileX, rTileZ) {
        return rTileZ * (Terrain.TILES_PER_CHUNK + 1) + rTileX;
    }
    indexOf(tileX, tileZ) {
        return this.indexOfRel(
            tileX - this.originTileX, tileZ - this.originTileZ
        );
    }

    atRel(rTileX, rTileZ) {
        return this.elevation[this.indexOfRel(rTileX, rTileZ)];
    }
    at(tileX, tileZ) {
        return this.elevation[this.indexOf(tileX, tileZ)];
    }

}


export class TerrainChunk {

    static ROCK_MIN_DIFF_Y = 4;

    buildTerrainMesh(details, elev) {
        const vertData = [];
        const elemData = [];
        let nextVertIdx = 0;
        for (let rTileL = 0; rTileL < chunks.toTiles(1); rTileL += 1) {
            for (let rTileT = 0; rTileT < chunks.toTiles(1); rTileT += 1) {
                const vertexPos = (rrTileX, rrTileZ) => {
                    const rTileX = rTileL + rrTileX;
                    const rTileZ = rTileT + rrTileZ;
                    return new Vector3(
                        tiles.toUnits(rTileX), 
                        elev.atRel(rTileX, rTileZ),
                        tiles.toUnits(rTileZ)
                    );
                };
                const buildVertex = (
                    pos, normal, rrTileX, rrTileZ, matU, matV
                ) => {
                    const i = nextVertIdx;
                    nextVertIdx += 1;
                    vertData.push(
                        ...pos, ...normal, 
                        0.1 + matU + rrTileX * 0.3, // tex coord U
                        0.1 + matV + rrTileZ * 0.3, // tex coord V
                    );
                    return i;
                };
                const buildFragment = (
                    aRRTileX, aRRTileZ, aPos,
                    bRRTileX, bRRTileZ, bPos,
                    cRRTileX, cRRTileZ, cPos
                ) => {
                    const minY = Math.min(aPos.y, bPos.y, cPos.y);
                    const maxY = Math.max(aPos.y, bPos.y, cPos.y);
                    const isRock = (maxY - minY) > TerrainChunk.ROCK_MIN_DIFF_Y;
                    const matU = 0.0;
                    const matV = isRock? 0.5 : 0.0;
                    const ab = bPos.clone().subtract(aPos);
                    const ac = cPos.clone().subtract(aPos);
                    const normal = ab.cross(ac).normalize();
                    const a = buildVertex(
                        aPos, normal, aRRTileX, aRRTileZ, matU, matV
                    );
                    const b = buildVertex(
                        bPos, normal, bRRTileX, bRRTileZ, matU, matV
                    );
                    const c = buildVertex(
                        cPos, normal, cRRTileX, cRRTileZ, matU, matV
                    );
                    elemData.push(a, b, c);
                };
                const tlPos = vertexPos(0, 0);
                const trPos = vertexPos(1, 0);
                const blPos = vertexPos(0, 1);
                const brPos = vertexPos(1, 1);
                const tlToBrDiff = Math.abs(tlPos.y - brPos.y);
                const trToBlDiff = Math.abs(trPos.y - blPos.y);
                const tlToBrMax = Math.max(tlPos.y, brPos.y);
                const trToBlMax = Math.max(trPos.y, blPos.y);
                // minimize height difference along the cut
                // (if height difference between cut options the same,
                // make the highest point of the cut as low as possible)
                const cutTlToBr = tlToBrDiff !== trToBlDiff
                    ? tlToBrDiff < trToBlDiff
                    : tlToBrMax < trToBlMax;
                if (cutTlToBr) {
                    // tl---tr
                    //  | \ |
                    // bl---br
                    buildFragment(0, 0, tlPos, 0, 1, blPos, 1, 1, brPos);
                    buildFragment(0, 0, tlPos, 1, 1, brPos, 1, 0, trPos);
                } else {
                    // tl---tr
                    //  | / |
                    // bl---br
                    buildFragment(0, 0, tlPos, 0, 1, blPos, 1, 0, trPos);
                    buildFragment(0, 1, blPos, 1, 1, brPos, 1, 0, trPos);
                }
            }
        }
        this.terrainMesh = new Geometry(
            Renderer.GEOMETRY_LAYOUT, vertData, elemData
        );
        this.terrainMeshInstances = [ new Matrix4().translate([
            chunks.toUnits(this.chunkX), 0, chunks.toUnits(this.chunkZ)
        ]) ];
    }

    constructor(chunkX, chunkZ, details) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        const elev = new ChunkElevation(this.chunkX, this.chunkZ, details);
        this.buildTerrainMesh(details, elev);
    }

    delete() {
        this.terrainMesh.delete();
    }

}


export class Terrain {

    static UNITS_PER_TILE = 10
    static TILES_PER_CHUNK = 10
    static UNITS_PER_CHUNK = Terrain.UNITS_PER_TILE * Terrain.TILES_PER_CHUNK
    
    static TERRAIN_TEXTURE = null;
    static async loadResources() {
        const textureReq = Texture.loadImage("/res/terrain.png");
        Terrain.TERRAIN_TEXTURE = await textureReq;
    }

    constructor(details) {
        noise.seed(details.seed);
        this.sizeC = details.sizeChunks;
        this.sizeT = chunks.toTiles(this.sizeC);
        this.sizeU = chunks.toUnits(this.sizeC);
        this.chunks = [];
        for (let chunkX = 0; chunkX < this.sizeC; chunkX += 1) {
            for (let chunkZ = 0; chunkZ < this.sizeC; chunkZ += 1) {
                this.chunks.push(new TerrainChunk(
                    chunkX, chunkZ, details
                ));
            }
        }
    }

    render(renderer) {
        for (const chunk of this.chunks) {
            renderer.renderGeometry(
                chunk.terrainMesh, Terrain.TERRAIN_TEXTURE,
                chunk.terrainMeshInstances
            );
        }
    }

}