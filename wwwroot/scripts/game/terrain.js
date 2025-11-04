import { Matrix4, Vector3, Vector4 } from "../libs/math.gl.js";
import {
    Geometry, Texture, Shader, Model,
    DepthTesting, TextureFormat, TextureFilter
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { quadspline, linspline } from "./spline.js";

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

    static RIVER_BASE_ELEV = -20.0;
    static RIVER_DIST_ELEV = 10.0; // units per distance from river
    static WATER_HEIGHT = -5;

    static MOUNTAIN_DIST_ELEV = 6.0; // units per distance from mountain peak
    static ROCK_MIN_DIFF_Y = 4;
    static SNOW_MIN_Y = 5.0;

    static MIN_BASE_TERRAIN = -3.0;

    static riverElevLimit(tileX, tileZ, details) {
        let closestDist = Infinity;
        for (const river of details.tesRivers) {
            for (const seg of river.segments) {
                const segTileX = units.toTiles(seg.x);
                const segTileZ = units.toTiles(seg.z);
                const segDist = Math.hypot(tileX - segTileX, tileZ - segTileZ);
                closestDist = Math.min(closestDist, segDist);
            }
        }
        return ChunkElevation.RIVER_BASE_ELEV
            + closestDist * ChunkElevation.RIVER_DIST_ELEV;
    }

    static mountainElevLimit(tileX, tileZ, details) {
        let highestLimit = 0;
        for (const m of details.mountains) {
            const dist = Math.hypot(tileX - m.tileX, tileZ - m.tileZ);
            const bLimit = m.height - dist * ChunkElevation.MOUNTAIN_DIST_ELEV;
            const limit = bLimit
                + noise.perlin2(tileX / 3.46, tileZ / 3.46) * 2
                + noise.perlin2(tileX / 10.6, tileZ / 10.6) * 5;
            highestLimit = Math.max(highestLimit, limit);
        }
        return highestLimit;
    }

    constructor(chunkX, chunkZ, details) {
        const chunkSizeTiles = chunks.toTiles(1);
        this.originTileX = chunks.toTiles(chunkX);
        this.originTileZ = chunks.toTiles(chunkZ);
        this.elevation = new Array(chunkSizeTiles ** 2);
        for (let rTileX = 0; rTileX <= chunkSizeTiles; rTileX += 1) {
            for (let rTileZ = 0; rTileZ <= chunkSizeTiles; rTileZ += 1) {
                const tileX = this.originTileX + rTileX;
                const tileZ = this.originTileZ + rTileZ;
                const rawElev 
                    = noise.perlin2(tileX / 5.25, tileZ / 5.25) * 3
                    + noise.perlin2(tileX / 8.34, tileZ / 8.34) * 5
                    + noise.perlin2(tileX / 32.74, tileZ / 32.74) * 10;
                const elev = Math.max(rawElev, ChunkElevation.MIN_BASE_TERRAIN);
                const riverElev
                    = ChunkElevation.riverElevLimit(tileX, tileZ, details);
                const mountainElev
                    = ChunkElevation.mountainElevLimit(tileX, tileZ, details);
                this.elevation[this.indexOfRel(rTileX, rTileZ)]
                    = Math.min(elev + mountainElev, riverElev);
            }
        }
    }

    indexOfRel(rTileX, rTileZ) {
        return rTileZ * (Terrain.TILES_PER_CHUNK + 1) + rTileX;
    }

    atRel(rTileX, rTileZ) {
        if (rTileX < 0 || rTileX > chunks.toTiles(1)) { return 0.0; }
        if (rTileZ < 0 || rTileZ > chunks.toTiles(1)) { return 0.0; }
        return this.elevation[this.indexOfRel(rTileX, rTileZ)];
    }
    at(tileX, tileZ) {
        return this.atRel(tileX - this.originTileX, tileZ - this.originTileZ);
    }

}


export class TerrainChunk {

    buildTerrainMesh(elev) {
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
                    const isRock = maxY - minY > ChunkElevation.ROCK_MIN_DIFF_Y;
                    const isSnow = maxY >= ChunkElevation.SNOW_MIN_Y;
                    const matU = isSnow? 0.5 : 0.0;
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

    buildWaterMesh() {
        const vertData = [
            // [0] top left
            chunks.toUnits(0), ChunkElevation.WATER_HEIGHT, chunks.toUnits(0),
            0, 1, 0,
            0, 1,
            // [1] top right
            chunks.toUnits(1), ChunkElevation.WATER_HEIGHT, chunks.toUnits(0),
            0, 1, 0,
            1, 1,
            // [2] bottom left
            chunks.toUnits(0), ChunkElevation.WATER_HEIGHT, chunks.toUnits(1),
            0, 1, 0,
            0, 0,
            // [3] bottom right
            chunks.toUnits(1), ChunkElevation.WATER_HEIGHT, chunks.toUnits(1),
            0, 1, 0,
            1, 0 
        ];
        const elemData = [
            0, 2, 3,
            0, 3, 1
        ];
        this.waterMesh = new Geometry(
            Renderer.GEOMETRY_LAYOUT, vertData, elemData
        );
        this.waterMeshInstances = [ new Matrix4().translate([
            chunks.toUnits(this.chunkX), 0, chunks.toUnits(this.chunkZ)
        ]) ];
    }

    static TREE_MIN_CHANCE = -0.5;
    static TREE_MAX_CHANCE = 1.0;
    static TREE_CHANCE_RANGE = TerrainChunk.TREE_MAX_CHANCE
        - TerrainChunk.TREE_MIN_CHANCE;
    static TREE_CHANCE_PD = 15.23;

    buildTreeInstances(elev) {
        this.treeInstances = [];
        for (let rTileX = 0; rTileX < chunks.toTiles(1); rTileX += 1) {
            for (let rTileZ = 0; rTileZ < chunks.toTiles(1); rTileZ += 1) {
                const tileX = chunks.toTiles(this.chunkX) + rTileX;
                const tileZ = chunks.toTiles(this.chunkZ) + rTileZ;
                const n = noise.perlin2(
                    tileX / TerrainChunk.TREE_CHANCE_PD,
                    tileZ / TerrainChunk.TREE_CHANCE_PD
                ) * 0.5 + 0.5;
                const chance = n * TerrainChunk.TREE_CHANCE_RANGE
                    + TerrainChunk.TREE_MIN_CHANCE;
                if (Math.random() >= chance) { continue; }
                const corners = [
                    elev.atRel(rTileX,     rTileZ    ),
                    elev.atRel(rTileX + 1, rTileZ    ),
                    elev.atRel(rTileX,     rTileZ + 1),
                    elev.atRel(rTileX + 1, rTileZ + 1)
                ];
                const minY = Math.min(...corners);
                const maxY = Math.max(...corners);
                if (maxY - minY >= ChunkElevation.ROCK_MIN_DIFF_Y) { continue; }
                const y = minY;
                const x = chunks.toUnits(this.chunkX)
                    + tiles.toUnits(rTileX + Math.random());
                const z = chunks.toUnits(this.chunkZ)
                    + tiles.toUnits(rTileZ + Math.random());
                const r = Math.random() * 2 * Math.PI;
                const instance = new Vector4(x, y, z, r);
                this.treeInstances.push(instance);
            }
        }
    }

    constructor(chunkX, chunkZ, details) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        const elev = new ChunkElevation(this.chunkX, this.chunkZ, details);
        this.buildTerrainMesh(elev);
        this.buildWaterMesh();
        this.buildTreeInstances(elev);
    }

    delete() {
        this.terrainMesh.delete();
    }

}


export class Terrain {

    static UNITS_PER_TILE = 5
    static TILES_PER_CHUNK = 32
    static UNITS_PER_CHUNK = Terrain.UNITS_PER_TILE * Terrain.TILES_PER_CHUNK
    
    static TREE_MAX_INSTANCE_COUNT = 256;

    static TERRAIN_TEXTURE = null;
    static WATER_SHADER = null;
    static WATER_NORMAL_TEXTURE = null;
    static TREE_SHADOW_SHADER = null;
    static TREE_GEOMETRY_SHADER = null;
    static TREE_MODEL = null;
    static async loadResources() {
        const textureReq = Texture.loadImage("/res/terrain.png");
        const waterShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "res/shaders/water.frag.glsl"
        );
        const waterNormalTextureReq = Texture.loadImage("/res/water.png");
        const treeShadowShaderReq = Shader.loadGlsl(
            "/res/shaders/tree.vert.glsl", "res/shaders/shadows.frag.glsl"
        );
        const treeGeometryShaderReq = Shader.loadGlsl(
            "/res/shaders/tree.vert.glsl", "res/shaders/geometry.frag.glsl"
        );
        const treeModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            { 
                tex: "/res/models/tree.png", obj: "/res/models/tree.obj",
                texFormat: TextureFormat.RGBA8, texFilter: TextureFilter.LINEAR
            }
        ]);
        Terrain.TERRAIN_TEXTURE = await textureReq;
        Terrain.WATER_SHADER = await waterShaderReq;
        Terrain.WATER_NORMAL_TEXTURE = await waterNormalTextureReq;
        Terrain.TREE_SHADOW_SHADER = await treeShadowShaderReq;
        Terrain.TREE_GEOMETRY_SHADER = await treeGeometryShaderReq;
        Terrain.TREE_MODEL = await treeModelReq;
    }

    static RIVER_TESSELLATION_RES = 5;

    constructor(details) {
        details.tesRivers = details.rivers
            .map(r => quadspline.tessellate(r, Terrain.RIVER_TESSELLATION_RES));
        noise.seed(details.seed);
        this.sizeC = details.sizeC;
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

    static RENDER_XMIN = -3;
    static RENDER_XMAX = +3;
    static RENDER_ZMIN = -2;
    static RENDER_ZMAX = +1;

    render(renderer) {
        renderer.setGeometryUniforms(Terrain.WATER_SHADER);
        renderer.setShadowUniforms(Terrain.TREE_SHADOW_SHADER);
        renderer.setGeometryUniforms(Terrain.TREE_GEOMETRY_SHADER);
        const camChunkX = units.toChunks(renderer.camera.center.x);
        const camChunkZ = units.toChunks(renderer.camera.center.z);
        for (const chunk of this.chunks) {
            const isOutOfBounds =
                chunk.chunkX < Math.floor(camChunkX) + Terrain.RENDER_XMIN ||
                chunk.chunkZ < Math.floor(camChunkZ) + Terrain.RENDER_ZMIN ||
                chunk.chunkX >= Math.ceil(camChunkX) + Terrain.RENDER_XMAX ||
                chunk.chunkZ >= Math.ceil(camChunkZ) + Terrain.RENDER_ZMAX;
            if (isOutOfBounds) { continue; }
            renderer.renderGeometry(
                chunk.terrainMesh, Terrain.TERRAIN_TEXTURE,
                chunk.waterMeshInstances
            );
            renderer.renderGeometry(
                chunk.waterMesh, Terrain.WATER_NORMAL_TEXTURE,
                chunk.terrainMeshInstances, null, Terrain.WATER_SHADER
            );
            renderer.renderModel(
                Terrain.TREE_MODEL, chunk.treeInstances,
                Terrain.TREE_SHADOW_SHADER, Terrain.TREE_GEOMETRY_SHADER,
                DepthTesting.ENABLED, Terrain.TREE_MAX_INSTANCE_COUNT
            );
        }
    }

    delete() {
        this.chunks.forEach(c => c.delete());
    }

}