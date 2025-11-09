
import { Matrix4, Vector3 } from "../libs/math.gl.js";
import {
    Geometry, Texture, Shader, Model,
    DepthTesting, TextureFormat, TextureFilter,
    UniformBuffer,
    Framebuffer
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { quadspline } from "./spline.js";

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


export class HeightMap {

    static RIVER_BASE_ELEV = -20.0;
    static RIVER_DIST_ELEV = 10.0; // units per distance from river
    static RIVER_APPLIC_TR = 5;
    static WATER_HEIGHT = -5;

    static TRACK_LIM_GROW_DIST_T = 1; // increase min/max allowed after N tiles 
    static TRACK_BASE_MIN_ELEV = -1.0;
    static TRACK_DIST_MIN_ELEV = 4.0; // units per distance from track
    static TRACK_BASE_MAX_ELEV = -0.5;
    static TRACK_DIST_MAX_ELEV = 4.0;  // units per distance from track
    static TRACK_APPLIC_TR = 5;

    static STATION_CLEARANCE_TR = 0; // in addition to min-max
    static STATION_MIN_ELEV = -2.5;

    static MOUNTAIN_DIST_ELEV = 6.0; // units per distance from mountain peak
    static MOUNTAIN_APPLIC_TR = 7;
    static ROCK_MIN_DIFF_Y = 4;
    static SNOW_MIN_Y = 5.0;

    static MIN_BASE_TERRAIN = -3.0;

    apply(f) {
        for (let tileX = 0; tileX <= this.sizeT; tileX += 1) {
            for (let tileZ = 0; tileZ <= this.sizeT; tileZ += 1) {
                const tileI = this.indexOf(tileX, tileZ);
                this.elevation[tileI] = f(tileX, tileZ, this.elevation[tileI]);
            }
        }
    }

    applyLocal(cTileX, cTileZ, tileR, f) {
        const startX = Math.max(cTileX - tileR, 0);
        const startZ = Math.max(cTileZ - tileR, 0);
        const endX = Math.min(cTileX + tileR, this.sizeT);
        const endZ = Math.min(cTileZ + tileR, this.sizeT);
        for (let tileX = startX; tileX <= endX; tileX += 1) {
            for (let tileZ = startZ; tileZ <= endZ; tileZ += 1) {
                const tileI = this.indexOf(tileX, tileZ);
                this.elevation[tileI] = f(tileX, tileZ, this.elevation[tileI]);
            }
        }
    }

    static baseNoise = () => (tileX, tileZ) => 
        noise.perlin2(tileX /  5.25, tileZ /  5.25) *  3 +
        noise.perlin2(tileX /  8.34, tileZ /  8.34) *  5 +
        noise.perlin2(tileX / 32.74, tileZ / 32.74) * 10;

    static minTerrainHeight = (minHeight) =>
        (_1, _2, elev) => Math.max(elev, minHeight);

    static mountainPeak = (mTileX, mTileZ, mHeight) => (tileX, tileZ, elev) => {
        const dist = Math.hypot(tileX - mTileX, tileZ - mTileZ);
        const baseAdded = mHeight - dist * HeightMap.MOUNTAIN_DIST_ELEV;
        const added = baseAdded
            + noise.perlin2(tileX / 3.46, tileZ / 3.46) * 2
            + noise.perlin2(tileX / 10.6, tileZ / 10.6) * 5;
        return elev + Math.max(added, 0.0);
    };

    static trackSegment = (sTileX, sTileZ) => (tileX, tileZ, elev) => {
        const rawDist = Math.hypot(tileX - sTileX, tileZ - sTileZ);
        const dist = Math.max(rawDist - HeightMap.TRACK_LIM_GROW_DIST_T, 0);
        const minElev = HeightMap.TRACK_BASE_MIN_ELEV
            - dist * HeightMap.TRACK_DIST_MIN_ELEV;
        const maxElev = HeightMap.TRACK_BASE_MAX_ELEV
            + dist * HeightMap.TRACK_DIST_MAX_ELEV;
        return Math.min(Math.max(elev, minElev), maxElev);
    };

    static riverSegment = (sTileX, sTileZ) => (tileX, tileZ, elev) => {
        const dist = Math.hypot(tileX - sTileX, tileZ - sTileZ);
        const maxElev = HeightMap.RIVER_BASE_ELEV
            + dist * HeightMap.RIVER_DIST_ELEV;
        return Math.min(elev, maxElev);
    };

    constructor(world) {
        this.sizeC = world.terrain.sizeC;
        this.sizeT = chunks.toTiles(this.sizeC);
        this.elevation = new Array((this.sizeT + 1) ** 2).fill(0.0);
        this.allowTrees = new Array((this.sizeT + 1) ** 2).fill(true);
        this.apply(HeightMap.baseNoise());
        this.apply(HeightMap.minTerrainHeight(HeightMap.MIN_BASE_TERRAIN));
        for (const m of world.terrain.mountains) {
            this.applyLocal(
                m.tileX, m.tileZ, HeightMap.MOUNTAIN_APPLIC_TR,
                HeightMap.mountainPeak(m.tileX, m.tileZ, m.height)
            );
        }
        for (const segment of world.network.segments) {
            const applyPos = (x, z) => {
                const tx = units.toTiles(x);
                const tz = units.toTiles(z);
                const itx = Math.round(tx);
                const itz = Math.round(tz);
                this.applyLocal(
                    itx, itz,
                    HeightMap.TRACK_APPLIC_TR,
                    HeightMap.trackSegment(tx, tz)
                );
                const i = this.indexOf(itx, itz);
                this.allowTrees[i] = true;
            };
            applyPos(segment.tesSpline.start.x, segment.tesSpline.start.z);
            segment.tesSpline.segments.forEach(s => applyPos(s.x, s.z));
        }
        for (const river of world.terrain.tesRivers) {
            const applyPos = (x, z) => {
                const tx = units.toTiles(x);
                const tz = units.toTiles(z);
                this.applyLocal(
                    Math.round(tx), Math.round(tz),
                    HeightMap.RIVER_APPLIC_TR,
                    HeightMap.riverSegment(tx, tz)
                );
            };
            applyPos(river.start.x, river.start.z);
            river.segments.forEach(s => applyPos(s.x, s.z));
        }
        for (const station of world.network.stations) {
            const minTX = Math.floor(units.toTiles(station.minPos[0]))
                - HeightMap.STATION_CLEARANCE_TR;
            const minTZ = Math.floor(units.toTiles(station.minPos[2]))
                - HeightMap.STATION_CLEARANCE_TR;
            const maxTX = Math.ceil(units.toTiles(station.maxPos[0]))
                + HeightMap.STATION_CLEARANCE_TR;
            const maxTZ = Math.ceil(units.toTiles(station.maxPos[2]))
                + HeightMap.STATION_CLEARANCE_TR;
            for (let tileX = minTX; tileX <= maxTX; tileX += 1) {
                for (let tileZ = minTZ; tileZ <= maxTZ; tileZ += 1) {
                    const i = this.indexOf(tileX, tileZ);
                    this.allowTrees[i] = false;
                    this.elevation[i] = Math.max(
                        this.elevation[i], HeightMap.STATION_MIN_ELEV
                    );
                }
            }
        }
    }

    isInBounds(tileX, tileZ) {
        return tileX >= 0 && tileZ >= 0
            && tileX <= this.sizeT && tileZ <= this.sizeT;
    }

    indexOf(tileX, tileZ) {
        return tileZ * (this.sizeT + 1) + tileX;
    }

    at(tileX, tileZ) {
        const bTileX = Math.min(Math.max(tileX, 0), this.sizeT);
        const bTileZ = Math.min(Math.max(tileZ, 0), this.sizeT);
        return this.elevation[this.indexOf(bTileX, bTileZ)];
    }

    allowsTreesAt(tileX, tileZ) {
        const bTileX = Math.min(Math.max(tileX, 0), this.sizeT);
        const bTileZ = Math.min(Math.max(tileZ, 0), this.sizeT);
        return this.allowTrees[this.indexOf(bTileX, bTileZ)];
    }

}


export class TerrainChunk {

    buildTerrainMesh(elev) {
        const chTileX = chunks.toTiles(this.chunkX);
        const chTileZ = chunks.toTiles(this.chunkZ);
        const vertData = [];
        const elemData = [];
        let nextVertIdx = 0;
        for (let rTileL = 0; rTileL < chunks.toTiles(1); rTileL += 1) {
            for (let rTileT = 0; rTileT < chunks.toTiles(1); rTileT += 1) {
                const vertexPos = (rTileX, rTileZ) => {
                    const tileX = chTileX + rTileX;
                    const tileZ = chTileZ + rTileZ;
                    return new Vector3(
                        tiles.toUnits(rTileX), 
                        elev.at(tileX, tileZ),
                        tiles.toUnits(rTileZ)
                    );
                };
                const vertexNorm = (rTileX, rTileZ) => {
                    const tileX = chTileX + rTileX;
                    const tileZ = chTileZ + rTileZ;
                    const hl = elev.at(tileX - 1, tileZ    );
                    const hr = elev.at(tileX + 1, tileZ    );
                    const ht = elev.at(tileX,     tileZ - 1);
                    const hb = elev.at(tileX,     tileZ + 1);
                    const dx = new Vector3(tiles.toUnits(2), hr - hl, 0);
                    const dz = new Vector3(0, hb - ht, tiles.toUnits(2));
                    return dz.cross(dx).normalize();
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
                    aRRTileX, aRRTileZ, aPos, aNorm,
                    bRRTileX, bRRTileZ, bPos, bNorm,
                    cRRTileX, cRRTileZ, cPos, cNorm
                ) => {
                    const minY = Math.min(aPos.y, bPos.y, cPos.y);
                    const maxY = Math.max(aPos.y, bPos.y, cPos.y);
                    const isRock = maxY - minY > HeightMap.ROCK_MIN_DIFF_Y;
                    const isSnow = maxY >= HeightMap.SNOW_MIN_Y;
                    const matU = isSnow? 0.5 : 0.0;
                    const matV = isRock? 0.5 : 0.0;
                    const a = buildVertex(
                        aPos, aNorm, aRRTileX, aRRTileZ, matU, matV
                    );
                    const b = buildVertex(
                        bPos, bNorm, bRRTileX, bRRTileZ, matU, matV
                    );
                    const c = buildVertex(
                        cPos, cNorm, cRRTileX, cRRTileZ, matU, matV
                    );
                    elemData.push(a, b, c);
                };
                const tlP = vertexPos(rTileL    , rTileT    );
                const trP = vertexPos(rTileL + 1, rTileT    );
                const blP = vertexPos(rTileL    , rTileT + 1);
                const brP = vertexPos(rTileL + 1, rTileT + 1);
                const tlN = vertexNorm(rTileL    , rTileT    );
                const trN = vertexNorm(rTileL + 1, rTileT    );
                const blN = vertexNorm(rTileL    , rTileT + 1);
                const brN = vertexNorm(rTileL + 1, rTileT + 1);
                const tlToBrDiff = Math.abs(tlP.y - brP.y);
                const trToBlDiff = Math.abs(trP.y - blP.y);
                const tlToBrMax = Math.max(tlP.y, brP.y);
                const trToBlMax = Math.max(trP.y, blP.y);
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
                    buildFragment(
                        0, 0, tlP, tlN, 0, 1, blP, blN, 1, 1, brP, brN
                    );
                    buildFragment(
                        0, 0, tlP, tlN, 1, 1, brP, brN, 1, 0, trP, trN
                    );
                } else {
                    // tl---tr
                    //  | / |
                    // bl---br
                    buildFragment(
                        0, 0, tlP, tlN, 0, 1, blP, blN, 1, 0, trP, trN
                    );
                    buildFragment(
                        0, 1, blP, blN, 1, 1, brP, brN, 1, 0, trP, trN
                    );
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
            chunks.toUnits(0), HeightMap.WATER_HEIGHT, chunks.toUnits(0),
            0, 1, 0,
            0, 1,
            // [1] top right
            chunks.toUnits(1), HeightMap.WATER_HEIGHT, chunks.toUnits(0),
            0, 1, 0,
            1, 1,
            // [2] bottom left
            chunks.toUnits(0), HeightMap.WATER_HEIGHT, chunks.toUnits(1),
            0, 1, 0,
            0, 0,
            // [3] bottom right
            chunks.toUnits(1), HeightMap.WATER_HEIGHT, chunks.toUnits(1),
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
    static TREE_RANDOM_HEIGHT = 1.0;

    buildTreeInstances(elev) {
        const treeBufferData = [];
        // will stay below 'Terrain.TREE_MAX_INSTANCE_COUNT'
        // because even if every tile had a tree then 32 * 32 = 1024 < 4096
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
                const allowed =
                    elev.allowsTreesAt(tileX,     tileZ    ) &&
                    elev.allowsTreesAt(tileX + 1, tileZ    ) &&
                    elev.allowsTreesAt(tileX,     tileZ + 1) &&
                    elev.allowsTreesAt(tileX + 1, tileZ + 1);
                if (!allowed) { continue; }
                const corners = [
                    elev.at(tileX,     tileZ    ),
                    elev.at(tileX + 1, tileZ    ),
                    elev.at(tileX,     tileZ + 1),
                    elev.at(tileX + 1, tileZ + 1)
                ];
                const minY = Math.min(...corners);
                const maxY = Math.max(...corners);
                if (maxY - minY >= HeightMap.ROCK_MIN_DIFF_Y) { continue; }
                const y = minY
                    + Math.random() * TerrainChunk.TREE_RANDOM_HEIGHT;
                const x = chunks.toUnits(this.chunkX)
                    + tiles.toUnits(rTileX + Math.random());
                const z = chunks.toUnits(this.chunkZ)
                    + tiles.toUnits(rTileZ + Math.random());
                const r = Math.random() * 2 * Math.PI;
                treeBufferData.push(x, y, z, r);
            }
        }
        this.treeBuffer = new UniformBuffer(
            Terrain.TREE_MAX_INSTANCE_COUNT * 4
        );
        this.treeBuffer.upload(treeBufferData);
        this.treeInstanceCount = treeBufferData.length / 4;
    }

    constructor(chunkX, chunkZ, elev) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.buildTerrainMesh(elev);
        this.buildWaterMesh();
        this.buildTreeInstances(elev);
    }

    delete() {
        this.terrainMesh.delete();
        this.treeBuffer.delete();
    }

}


export class Terrain {

    static RIVER_TESSELLATION_RES = 10;

    static tessellateRivers(terrainDetails) {
        terrainDetails.tesRivers = terrainDetails.rivers
            .map(r => quadspline.tessellate(r, Terrain.RIVER_TESSELLATION_RES));
    }


    static UNITS_PER_TILE = 5
    static TILES_PER_CHUNK = 32
    static UNITS_PER_CHUNK = Terrain.UNITS_PER_TILE * Terrain.TILES_PER_CHUNK
    
    static TREE_MAX_INSTANCE_COUNT = 4096;

    static TREE_PR_RES = 16;
    static TREE_PR_HEIGHT = 4.5;
    static TREE_PR_MODEL = null;
    static preRenderTree() {
        const s = Terrain.PRERENDER_SHADER;
        s.setUniform(Renderer.INSTANCES_UNIFORM, [ new Matrix4() ]);
        const fh = Terrain.TREE_PR_HEIGHT;
        const hh = fh / 2;
        const view = new Matrix4().lookAt({
            center: new Vector3(0, hh, 0),
            eye: new Vector3(1, 0, 1).normalize().scale(hh + 1).add([0, hh, 0]),
            up: new Vector3(0, 1, 0)
        });
        const proj = new Matrix4().ortho({
            left: -hh, right: hh,
            bottom: -hh, top: hh,
            near: 1, far: fh + 1
        });
        s.setUniform(Renderer.VIEW_PROJ_UNIFORM, proj.multiplyRight(view));
        const color = Texture.withSize(
            Terrain.TREE_PR_RES, Terrain.TREE_PR_RES, TextureFormat.RGBA8,
            TextureFilter.NEAREST
        );
        const depth = Texture.withSize(
            Terrain.TREE_PR_RES, Terrain.TREE_PR_RES, TextureFormat.DEPTH16,
            TextureFilter.NEAREST
        );
        const dest = new Framebuffer();
        dest.setColor(color);
        dest.setDepth(depth);
        Terrain.TREE_MODEL.render(s, dest, Renderer.TEXTURE_UNIFORM);
        dest.delete();
        const vertData = [
            // [0] - X plane top left
            -hh, fh, 0,   0, 0, 1,   0, 1,
            // [1] - X plane top right
            +hh, fh, 0,   0, 0, 1,   1, 1,
            // [2] - X plane bottom left
            -hh,  0, 0,   0, 0, 1,   0, 0,
            // [3] - X plane bottom right
            +hh,  0, 0,   0, 0, 1,   1, 0,
            // [4] - Z plane top left
            0, fh, -hh,   1, 0, 0,   0, 1,
            // [5] - Z plane top right
            0, fh, +hh,   1, 0, 0,   1, 1,
            // [6] - Z plane bottom left
            0, 0,  -hh,   1, 0, 0,   0, 0,
            // [7] - Z plane bottom right
            0, 0,  +hh,   1, 0, 0,   1, 0
        ];
        const elemData = [
            0, 2, 3,   0, 3, 1,
            4, 6, 7,   4, 7, 5
        ];
        const geometry = new Geometry(
            Renderer.GEOMETRY_LAYOUT, vertData, elemData
        );
        Terrain.TREE_PR_MODEL = new Model([ { geometry, texture: color } ]);
    }

    static TERRAIN_TEXTURE = null;
    static WATER_SHADER = null;
    static WATER_NORMAL_MAP = null;
    static WATER_DUDV_MAP = null;
    static TREE_SHADOW_SHADER = null;
    static TREE_GEOMETRY_SHADER = null;
    static TREE_MODEL = null;
    static PRERENDER_SHADER = null;
    static async loadResources() {
        const textureReq = Texture.loadImage(
            "/res/textures/terrain.png"
        );
        const waterShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/water.frag.glsl"
        );
        const waterNormalReq = Texture.loadImage(
            "/res/textures/water_normal.png"
        );
        const treeShadowShaderReq = Shader.loadGlsl(
            "/res/shaders/tree.vert.glsl", "/res/shaders/shadows.frag.glsl"
        );
        const treeGeometryShaderReq = Shader.loadGlsl(
            "/res/shaders/tree.vert.glsl", "/res/shaders/tree.frag.glsl"
        );
        const treeModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            { 
                tex: "/res/models/tree.png", obj: "/res/models/tree.obj",
                texFormat: TextureFormat.RGBA8, texFilter: TextureFilter.NEAREST
            }
        ]);
        const preRenderShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/unshaded.frag.glsl"
        );
        Terrain.TERRAIN_TEXTURE = await textureReq;
        Terrain.WATER_SHADER = await waterShaderReq;
        Terrain.WATER_NORMAL_MAP = await waterNormalReq;
        Terrain.TREE_SHADOW_SHADER = await treeShadowShaderReq;
        Terrain.TREE_GEOMETRY_SHADER = await treeGeometryShaderReq;
        Terrain.TREE_MODEL = await treeModelReq;
        Terrain.PRERENDER_SHADER = await preRenderShaderReq;
        Terrain.preRenderTree();
    }

    constructor(terrainDetails, elev) {
        this.flatTrees = false;
        noise.seed(terrainDetails.seed);
        this.sizeC = terrainDetails.sizeC;
        this.sizeT = chunks.toTiles(this.sizeC);
        this.sizeU = chunks.toUnits(this.sizeC);
        this.chunks = [];
        for (let chunkX = 0; chunkX < this.sizeC; chunkX += 1) {
            for (let chunkZ = 0; chunkZ < this.sizeC; chunkZ += 1) {
                this.chunks.push(new TerrainChunk(
                    chunkX, chunkZ, elev
                ));
            }
        }
    }

    static RENDER_XMIN = -2;
    static RENDER_XMAX = +2;
    static RENDER_ZMIN = -2;
    static RENDER_ZMAX = +1;

    render(renderer) {
        renderer.setGeometryUniforms(Terrain.WATER_SHADER);
        renderer.setShadowUniforms(Terrain.TREE_SHADOW_SHADER);
        renderer.setGeometryUniforms(Terrain.TREE_GEOMETRY_SHADER);
        Terrain.WATER_SHADER
            .setUniform("uNormalMap", Terrain.WATER_NORMAL_MAP);
        Terrain.TREE_GEOMETRY_SHADER
            .setUniform("uSwayingTrees", !this.flatTrees);
        Terrain.TREE_SHADOW_SHADER
            .setUniform("uSwayingTrees", !this.flatTrees);
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
                this.flatTrees ? Terrain.TREE_PR_MODEL : Terrain.TREE_MODEL,
                chunk.treeBuffer,
                Terrain.TREE_SHADOW_SHADER, Terrain.TREE_GEOMETRY_SHADER,
                DepthTesting.ENABLED, chunk.treeInstanceCount
            );
        }
    }

    delete() {
        this.chunks.forEach(c => c.delete());
    }

}