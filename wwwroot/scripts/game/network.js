
import { Matrix4, Vector3 } from "../libs/math.gl.js";
import {
    DepthTesting, Framebuffer, UniformBuffer,
    Geometry, Model, Shader, Texture, TextureFilter, TextureFormat
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { linspline, quadspline } from "./spline.js";
import { chunks, tiles, units } from "./terrain.js";

export class TrackNetwork {

    static TRACK_TESSELLATION_RES = 10;

    static tessellateTrackSegments(networkDetails) {
        for (const segment of networkDetails.segments) {
            segment.tesSpline = quadspline.tessellate(
                segment.spline, TrackNetwork.TRACK_TESSELLATION_RES
            );
        }
    }


    static TRACKS_TEXTURE = null;
    static PLATFORM_MODEL = null;
    static STATION_MODEL = null;
    static TILE_REGION_COMP_SHADER = null;
    static TRACK_HIGHLIGHT_SHADER = null;
    static async loadResources() {
        const tracksTextureReq = Texture.loadImage(
            "/res/textures/tracks.png", TextureFormat.RGBA8
        );
        const platformModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            {
                tex: "/res/models/platform.png", 
                obj: "/res/models/platform.obj",
                texFormat: TextureFormat.RGBA8, texFilter: TextureFilter.LINEAR
            }
        ]);
        const stationModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            {
                tex: "/res/models/station.png", obj: "/res/models/station.obj",
                texFormat: TextureFormat.RGBA8, texFilter: TextureFilter.LINEAR
            }
        ]);
        const tileRegionCompShaderReq = Shader.loadGlsl(
            "/res/shaders/tile_region.vert.glsl",
            "/res/shaders/tile_region.frag.glsl"
        );
        const trackHighlightShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl",
            "/res/shaders/track_highlight.frag.glsl"
        );
        TrackNetwork.TRACKS_TEXTURE = await tracksTextureReq;
        TrackNetwork.PLATFORM_MODEL = await platformModelReq;
        TrackNetwork.STATION_MODEL = await stationModelReq;
        TrackNetwork.TILE_REGION_COMP_SHADER = await tileRegionCompShaderReq;
        TrackNetwork.TRACK_HIGHLIGHT_SHADER = await trackHighlightShaderReq;
    }

    static TRACK_VERTICES_LOW = [
        // ballast top plane
        { x: +0.8, y:  0.0, uv: [0.00, 1.00], muv: [ 0.00,  0.00] }, // [0] low right
        { x: -0.8, y:  0.0, uv: [0.25, 1.00], muv: [ 0.00,  0.00] }, // [1] low left
        // ballast right plane
        { x: +0.8, y:  0.0, uv: [0.50, 1.00], muv: [ 0.00, -0.50] }, // [2] low top
        { x: +1.6, y: -4.0, uv: [0.50, 0.50], muv: [ 0.00, -0.50] }, // [3] low bottom
        // ballast left plane
        { x: -0.8, y:  0.0, uv: [1.00, 1.00], muv: [ 0.00, -0.50] }, // [4] low top
        { x: -1.6, y: -4.0, uv: [1.00, 0.50], muv: [ 0.00, -0.50] }  // [5] low bottom
    ];
    static TRACK_MAX_SEG_LEN = 4;
    static TRACK_UV_DIST = 4;
    static TRACK_VERTICES_HIGH = [
        // ballast top plane
        { x: +0.8, y:  0.0, uv: [0.00, 1.00], duv: [ 0.00, -1.00], muv: [ 0.00,  0.00] }, // [0] high right
        { x: -0.8, y:  0.0, uv: [0.25, 1.00], duv: [ 0.00, -1.00], muv: [ 0.00,  0.00] }, // [1] high left
        // ballast right plane
        { x: +0.8, y:  0.0, uv: [0.50, 1.00], duv: [+0.50,  0.00], muv: [ 0.00, -0.50] }, // [2] high top
        { x: +1.6, y: -4.0, uv: [0.50, 0.50], duv: [+0.50,  0.00], muv: [ 0.00, -0.50] }, // [3] high bottom
        // ballast left plane
        { x: -0.8, y:  0.0, uv: [1.00, 1.00], duv: [-0.50,  0.00], muv: [ 0.00, -0.50] }, // [4] high top
        { x: -1.6, y: -4.0, uv: [1.00, 0.50], duv: [-0.50,  0.00], muv: [ 0.00, -0.50] }  // [5] high bottom
    ];
    static BUILD_TRACK_SPLINE_STEP = (quad, l, h) => {
        quad(l(1), l(0), h(0), h(1)); // ballast top plane
        quad(l(2), l(3), h(3), h(2)); // ballast right plane
        quad(h(4), h(5), l(5), l(4)); // ballast left plane
    }
    static BRIDGE_TERRAIN_ELEV = -3.0;
    static TRACK_UP = new Vector3(0, 1, 0);

    static generateSegmentMesh(segment, elev) {
        const spline = segment.tesSpline;
        let totalMinX = +Infinity;
        let totalMinZ = +Infinity;
        let totalMaxX = -Infinity;
        let totalMaxZ = -Infinity;
        const boundsIncludePos = pos => {
            totalMinX = Math.min(totalMinX, pos.x);
            totalMinZ = Math.min(totalMinZ, pos.z);
            totalMaxX = Math.max(totalMaxX, pos.x);
            totalMaxZ = Math.max(totalMaxZ, pos.z);
        };
        boundsIncludePos(spline.start);
        boundsIncludePos(spline.segments.at(-1));
        const bridgeUvMod = (low, high) => {
            const lowTileX = Math.round(units.toTiles(low.x));
            const lowTileZ = Math.round(units.toTiles(low.z));
            const highTileX = Math.round(units.toTiles(high.x));
            const highTileZ = Math.round(units.toTiles(high.z));
            const minElev = Math.min(
                elev.at(lowTileX, lowTileZ), elev.at(highTileX, highTileZ)
            );
            return minElev <= TrackNetwork.BRIDGE_TERRAIN_ELEV ? 1 : 0;
        };
        const geometry = linspline.generateGeometry(spline, {
            segLengthLimit: TrackNetwork.TRACK_MAX_SEG_LEN,
            uvDistance: TrackNetwork.TRACK_UV_DIST,
            modifyFunc: bridgeUvMod,
            up: TrackNetwork.TRACK_UP,
            lowVertices: TrackNetwork.TRACK_VERTICES_LOW,
            highVertices: TrackNetwork.TRACK_VERTICES_HIGH,
            buildSegment: TrackNetwork.BUILD_TRACK_SPLINE_STEP,
            layout: Renderer.OBJ_LAYOUT
        });
        return {
            geometry,
            minCX: Math.floor(units.toChunks(totalMinX)),
            minCZ: Math.floor(units.toChunks(totalMinZ)),
            maxCX: Math.floor(units.toChunks(totalMaxX)),
            maxCZ: Math.floor(units.toChunks(totalMaxZ)),
            tesSpline: segment.tesSpline,
            connectsLow: segment.connectsLow,
            connectsHigh: segment.connectsHigh
        };
    }

    static TRACK_HL_VERTICES_LOW = [
        { x: +0.5, y:  0.05, uv: [0.50, 0.50], muv: [0.00, 0.00] }, // [0] low right
        { x: -0.5, y:  0.05, uv: [0.50, 0.50], muv: [0.00, 0.00] }  // [1] low left
    ];
    static TRACK_HL_MAX_SEG_LEN = 2;
    static TRACK_HL_VERTICES_HIGH = [
        { x: +0.5, y:  0.05, uv: [0.50, 0.50], duv: [0.00, 0.00], muv: [0.00, 0.00] }, // [0] high right
        { x: -0.5, y:  0.05, uv: [0.50, 0.50], duv: [0.00, 0.00], muv: [0.00, 0.00] }  // [1] high left
    ];
    static BUILD_TRACK_HL_SPLINE_STEP = (quad, l, h) => {
        quad(l(1), l(0), h(0), h(1));
    }
    static TRACK_HL_MAX_GEN_LEN = 20;

    static generateSegmentHighlight(segment, fromHigh) {
        const spline = segment.tesSpline;
        return linspline.generateGeometry(spline, {
            startFromHigh: fromHigh,
            segLengthLimit: TrackNetwork.TRACK_HL_MAX_SEG_LEN,
            genLengthLimit: TrackNetwork.TRACK_HL_MAX_GEN_LEN,
            up: TrackNetwork.TRACK_UP,
            lowVertices: TrackNetwork.TRACK_HL_VERTICES_LOW,
            highVertices: TrackNetwork.TRACK_HL_VERTICES_HIGH,
            buildSegment: TrackNetwork.BUILD_TRACK_HL_SPLINE_STEP,
            layout: Renderer.OBJ_LAYOUT
        });
    }

    static PLATFORM_MODEL_LENGTH = 5; // in units
    static STATION_MODEL_WIDTH = 5; // in units
    static PLATFORM_DISTANCE = 10; // distance between platforms in units

    buildStationInstances(networkDetails, elev) {
        this.stations = [];
        for (const station of networkDetails.stations) {
            const stationInst = {
                platforms: [],
                buildings: [],
                chunkX: 0, chunkZ: 0
            };
            const along = station.isAlongZ
                ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
            const across = station.isAlongZ
                ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
            const center = new Vector3(station.minPos)
                .lerp(station.maxPos, 0.5);
            stationInst.chunkX = Math.floor(units.toChunks(center.x));
            stationInst.chunkZ = Math.floor(units.toChunks(center.z));
            const platformSpan = station.platformCount
                * TrackNetwork.PLATFORM_DISTANCE;
            const platformBaseOffset = -platformSpan / 2;
            const segmentC = Math.floor(
                station.platformLength / TrackNetwork.PLATFORM_MODEL_LENGTH
            );
            const platformLength = segmentC
                * TrackNetwork.PLATFORM_MODEL_LENGTH;
            for (let pltI = 0; pltI <= station.platformCount; pltI += 1) {
                const offset = platformBaseOffset
                    + pltI * TrackNetwork.PLATFORM_DISTANCE;
                const basePos = across.clone().scale(offset).add(center)
                    .add(along.clone().scale(-platformLength / 2));
                for (let segI = 0; segI < segmentC; segI += 1) {
                    const alongOffset = (segI + 0.5)
                        * TrackNetwork.PLATFORM_MODEL_LENGTH;
                    const pos = along.clone().scale(alongOffset).add(basePos);
                    const instance = new Matrix4().translate(pos);
                    if (station.isAlongZ) { instance.rotateY(Math.PI / 2); }
                    stationInst.platforms.push(instance);
                }
            }
            const bdOffset = platformSpan / 2
                + TrackNetwork.PLATFORM_MODEL_LENGTH / 2
                + TrackNetwork.STATION_MODEL_WIDTH / 2;
            const bdPos = across.clone().scale(bdOffset).add(center);
            const bdTileX = Math.round(units.toTiles(bdPos.x));
            const bdTileZ = Math.round(units.toTiles(bdPos.z));
            bdPos.y = elev.at(bdTileX, bdTileZ);
            const bdInstance = new Matrix4().translate(bdPos);
            if (station.isAlongZ) { bdInstance.rotateY(Math.PI / 2); }
            stationInst.buildings.push(bdInstance);
            this.stations.push(stationInst);
        }
    }

    constructor(worldDetails, elev) {
        this.segments = worldDetails.network.segments
            .map(s => TrackNetwork.generateSegmentMesh(s, elev));
        this.buildStationInstances(worldDetails.network, elev);
        this.sizeT = chunks.toTiles(worldDetails.terrain.sizeC);
        this.prepareTileRegionTex(worldDetails.network);
        this.switchHighlights = [];
    }

    static REGION_MAX_WORLD_CHUNK_LEN = 60;
    static STATION_OF_CLIENT = 1.0;
    static STATION_OF_ENEMY = 0.5;
    static STATION_UNOWNED = 0.0;

    prepareTileRegionTex(network) {
        const sizeC = Math.floor(tiles.toChunks(this.sizeT));
        this.tileRegionTex = Texture.withSize(
            this.sizeT, this.sizeT, TextureFormat.R8, TextureFilter.LINEAR
        );
        this.tileRegionFb = new Framebuffer();
        this.tileRegionFb.setColor(this.tileRegionTex);
        this.stationLocBuffSize =TrackNetwork.REGION_MAX_WORLD_CHUNK_LEN ** 2;
        this.stationLocBuff = new UniformBuffer(this.stationLocBuffSize * 4);
        this.stationLocBuffData = new Array(this.stationLocBuffSize * 4)
            .fill(0.0);
        for (const station of network.stations) {
            const center = new Vector3(station.minPos)
                .lerp(station.maxPos, 0.5);
            const tileX = Math.floor(units.toTiles(center.x));
            const tileZ = Math.floor(units.toTiles(center.z));
            const chunkX = Math.floor(tiles.toChunks(tileX));
            const chunkZ = Math.floor(tiles.toChunks(tileZ));
            const offset = (chunkZ * sizeC + chunkX) * 4;
            this.stationLocBuffData[offset + 0] = tileX;
            this.stationLocBuffData[offset + 1] = tileZ;
            this.stationLocBuffData[offset + 2] = TrackNetwork.STATION_UNOWNED;
        }
        const s = TrackNetwork.TILE_REGION_COMP_SHADER;
        s.setUniform("uStations", this.stationLocBuff);
        s.setUniform("uWorldSizeC", Math.floor(tiles.toChunks(this.sizeT)));
        s.setUniform("uTilesPerChunk", tiles.PER_CHUNK);
        this.tileStationMapG = new Geometry([2, 2], [
            -1, +1,   0,          this.sizeT, // [0] top left
            +1, +1,   this.sizeT, this.sizeT, // [1] top right
            -1, -1,   0,          0,     // [2] bottom left
            +1, -1,   this.sizeT, 0      // [3] bottom right
        ], [
            0, 2, 3, // top left -> bottom left -> bottom right
            0, 3, 1  // top left -> bottom right -> top right
        ]);
    }

    updateTileRegionTex(regions) {
        const sizeC = Math.floor(tiles.toChunks(this.sizeT));
        for (let cx = 0; cx < sizeC; cx += 1) {
            for (let cz = 0; cz < sizeC; cz += 1) {
                const i = cz * sizeC + cx;
                const owner = regions.chunks[i].owner;
                this.stationLocBuffData[i * 4 + 2] = owner === null 
                    ? TrackNetwork.STATION_UNOWNED
                    : owner.id === playerId
                        ? TrackNetwork.STATION_OF_CLIENT
                        : TrackNetwork.STATION_OF_ENEMY;
            }
        }
        this.stationLocBuff.upload(this.stationLocBuffData);
        const s = TrackNetwork.TILE_REGION_COMP_SHADER;
        this.tileStationMapG.render(
            s, this.tileRegionFb, 1, DepthTesting.DISABLED
        );
    }

    updateSwitchStates(switches) {
        this.switchHighlights.forEach(h => h.delete());
        this.switchHighlights = switches.map(sw => {
            const segmentIdx = sw.key.segmentIdx;
            const segment = this.segments[segmentIdx];
            const branches = sw.key.toHighEnd
                ? segment.connectsHigh : segment.connectsLow;
            const branch = branches[sw.value];
            return TrackNetwork.generateSegmentHighlight(
                this.segments[branch.segmentIdx], branch.toHighEnd
            );
        });
    }

    static RENDER_XMIN = -2;
    static RENDER_XMAX = +2;
    static RENDER_ZMIN = -1;
    static RENDER_ZMAX = +1;

    render(renderer) {
        renderer.setGeometryUniforms(TrackNetwork.TRACK_HIGHLIGHT_SHADER);
        const segmentInstance = [ new Matrix4() ];
        const camChunkX = units.toChunks(renderer.camera.center.x);
        const camChunkZ = units.toChunks(renderer.camera.center.z);
        const cMinChunkX = Math.floor(camChunkX) + TrackNetwork.RENDER_XMIN;
        const cMinChunkZ = Math.floor(camChunkZ) + TrackNetwork.RENDER_ZMIN;
        const cMaxChunkX = Math.ceil(camChunkX) + TrackNetwork.RENDER_XMAX;
        const cMaxChunkZ = Math.ceil(camChunkZ) + TrackNetwork.RENDER_ZMAX;
        const isOutOfBounds = (minChunkX, minChunkZ, maxChunkX, maxChunkZ) =>
            maxChunkX < cMinChunkX || maxChunkZ < cMinChunkZ ||
            minChunkX >= cMaxChunkX || minChunkZ >= cMaxChunkZ;
        for (const s of this.segments) {
            if (isOutOfBounds(s.minCX, s.minCZ, s.maxCX, s.maxCZ)) {
                continue;
            }
            renderer.renderGeometry(
                s.geometry, TrackNetwork.TRACKS_TEXTURE, segmentInstance
            );
        }
        for (const s of this.stations) {
            if (isOutOfBounds(s.chunkX, s.chunkZ, s.chunkX, s.chunkZ)) {
                continue; 
            }
            renderer.renderModel(TrackNetwork.PLATFORM_MODEL, s.platforms);
            renderer.renderModel(TrackNetwork.STATION_MODEL, s.buildings);
        }
        const hlInst = new Matrix4();
        for (const h of this.switchHighlights) {
            renderer.renderGeometry(
                h, null, [hlInst], null, TrackNetwork.TRACK_HIGHLIGHT_SHADER
            );
        }
    }
 
    delete() {
        this.segments.forEach(s => s.geometry.delete());
        this.tileRegionFb.delete();
        this.tileRegionTex.delete();
        this.stationLocBuff.delete();
        this.tileStationMapG.delete();
        this.switchHighlights.forEach(h => h.delete());
    }

}