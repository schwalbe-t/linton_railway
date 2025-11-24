
import { Matrix4, Vector3, Vector4 } from "../libs/math.gl.js";
import {
    DepthTesting, Framebuffer, UniformBuffer,
    Geometry, Model, Shader, Texture, TextureFilter, TextureFormat
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { RegionText, Signal, TrainText } from "./world_ui.js";
import { linspline, quadspline } from "./spline.js";
import { chunks, tiles, units } from "./terrain.js";


export class Train {

    static TRAIN_COLORS = Object.freeze({
        "green":   new Vector4( 67, 127,  93, 255).scale(1/255),
        "cyan":    new Vector4( 90, 139, 151, 255).scale(1/255),
        "magenta": new Vector4(170, 116, 158, 255).scale(1/255),
        "red":     new Vector4(186,  94, 105, 255).scale(1/255),
        "orange":  new Vector4(211, 146,  91, 255).scale(1/255)
    });

    static LOCO_MODELS = null;
    static CARRIAGE_MODEL = null;
    static TRAIN_GEOMETRY_SHADER = null;
    static async loadResources() {
        const locoDieselModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            {
                tex: "/res/models/loco_diesel.png",
                obj: "/res/models/loco_diesel.obj"
            }
        ]);
        const locoSteamModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            {
                tex: "/res/models/loco_steam.png",
                obj: "/res/models/loco_steam.obj"
            }
        ]);
        const carriageModelReq = Model.loadMeshes(Renderer.OBJ_LAYOUT, [
            {
                tex: "/res/models/carriage.png",
                obj: "/res/models/carriage.obj"
            }
        ]);
        const trainGeometryShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/train.frag.glsl"
        )
        Train.LOCO_MODELS = Object.freeze({
            "diesel": await locoDieselModelReq,
            "steam": await locoSteamModelReq
        });
        Train.CARRIAGE_MODEL = await carriageModelReq;
        Train.TRAIN_GEOMETRY_SHADER = await trainGeometryShaderReq;
    }


    constructor(trainState) {
        this.color = trainState.color;
        this.locoType = trainState.locoType;
        this.carCount = trainState.carCount;
        this.occSegments = [];
        this.onNewState(trainState);
        this.chunkX = 0;
        this.chunKZ = 0;
        this.knownValue = null;
        this.text = new TrainText(new Vector3());
    }

    static MAX_OCC_COUNT = 50;
    // [milliseconds]
    // should exceed the expected room update interval
    // the longer, the smoother (but the more delay there is)
    static INTERPOLATION_TIME = 500 / 1000;

    findInterpolationDist(nextState, network) {
        const startLsi = this.currentLocalSegIdx;
        const endLsi = this.occSegments.length - 1;
        if (startLsi === endLsi) {
            return Math.abs(this.currentSegDist - nextState.segmentDist);
        }
        const localSegEndDist = (lsi, dirEnd) => {
            const conn = this.occSegments[lsi];
            const seg = network.segments[conn.segmentIdx];
            // toHighEnd = true  (descending) + dirEnd = true  => 0.0
            // toHighEnd = true  (descending) + dirEnd = false => len
            // toHighEnd = false (ascending)  + dirEnd = true  => len
            // toHighEnd = false (ascending)  + dirEnd = false => 0.0
            return conn.toHighEnd === dirEnd ? 0.0
                : linspline.computeLength(seg.tesSpline);
        };
        const startEndDist = localSegEndDist(startLsi, true);
        let totalDist = Math.abs(this.currentSegDist - startEndDist);
        for (let lsi = startLsi + 1; lsi < endLsi; lsi += 1) {
            const conn = this.occSegments[lsi];
            const seg = network.segments[conn.segmentIdx];
            totalDist += linspline.computeLength(seg.tesSpline);
        }
        const endEndDist = localSegEndDist(endLsi, false);
        return totalDist + Math.abs(nextState.segmentDist - endEndDist);
    }

    static LOADING_TIME = 60.0; // needs to match server side constant

    onNewState(trainState, network = null) {
        if (trainState.loadingTimer > 0) {
            const remSecs = Math.floor(
                Train.LOADING_TIME - trainState.loadingTimer
            );
            const dispRemSecs = Math.min(Math.max(remSecs, 0), 59);
            const remTimeText = `${dispRemSecs}`.padStart(2, "0");
            this.text.setText(`-00:${remTimeText}`);
        }
        const olc = this.occSegments.at(-1)
            || { segmentIdx: -1, toHighEnd: false };
        const oldLastIdx = trainState.occupiedSegments
            .findIndex(o => o.segmentIdx === olc.segmentIdx);
        const snap = () => {
            this.occSegments = [...trainState.occupiedSegments];
            this.currentLocalSegIdx = this.occSegments.length - 1;
            this.currentSegDist = trainState.segmentDist;
            this.targetSegDist = this.currentSegDist;
            this.remLerpDist = 0.0;
            this.remLerpTime = 0.0;
        };
        if (oldLastIdx === -1) { return snap(); }
        const added = trainState.occupiedSegments.slice(oldLastIdx + 1);
        this.occSegments.push(...added);
        const remOccCount = this.occSegments.length - Train.MAX_OCC_COUNT;
        if (remOccCount > 0) {
            this.occSegments = this.occSegments.slice(remOccCount);
            this.currentLocalSegIdx -= remOccCount;
            if (this.currentLocalSegIdx < 0) { return snap(); }
        }
        this.remLerpDist = this.findInterpolationDist(trainState, network);
        this.targetSegDist = trainState.segmentDist;
        this.remLerpTime = Train.INTERPOLATION_TIME;
    }

    interpolateState(network, deltaTime) {
        // snap to end
        if (this.remLerpTime <= 0.0001) {
            this.currentLocalSegIdx = this.occSegments.length - 1;
            this.currentSegDist = this.targetSegDist;
            this.remLerpDist = 0.0;
            this.remLerpTime = 0.0;
            return;
        }
        // compute how much distance to advance this frame
        const lerpDist = this.remLerpDist * (deltaTime / this.remLerpTime);
        this.remLerpDist -= lerpDist;
        this.remLerpDist = Math.max(this.remLerpDist, 0.0);
        this.remLerpTime -= deltaTime;
        this.remLerpTime = Math.max(this.remLerpTime, 0.0);
        // advance by computed distance
        let remDist = lerpDist;
        for (;;) {
            const localSeg = this.occSegments[this.currentLocalSegIdx];
            const seg = network.segments[localSeg.segmentIdx];
            const p = linspline.Point();
            linspline.advancePoint(seg.tesSpline, p, this.currentSegDist);
            const dirSign = localSeg.toHighEnd ? -1 : 1;
            const step = remDist * dirSign;
            const d = linspline.advancePoint(seg.tesSpline, p, step);
            this.currentSegDist += d * dirSign;
            if (d >= remDist - 0.0001) { break; }
            remDist -= d;
            const isLast = this.currentLocalSegIdx
                >= this.occSegments.length - 1;
            if (isLast) { break; }
            this.currentLocalSegIdx += 1;
            this.currentSegDist = 0.0;
            const newLocalSeg = this.occSegments[this.currentLocalSegIdx];
            if (newLocalSeg.toHighEnd) {
                const newSeg = network.segments[newLocalSeg.segmentIdx];
                const newSegLen = linspline.computeLength(newSeg.tesSpline);
                this.currentSegDist = newSegLen;
            }
        }
    }

    update(network, deltaTime) {
        this.interpolateState(network, deltaTime);
        const conn = this.occSegments[this.currentLocalSegIdx];
        const seg = network.segments[conn.segmentIdx];
        const p = linspline.Point();
        linspline.advancePoint(seg.tesSpline, p, this.currentSegDist);
        const pos = linspline.atPoint(seg.tesSpline, p);
        this.chunkX = Math.round(units.toChunks(pos.x));
        this.chunkZ = Math.round(units.toChunks(pos.z));
    }

    static BOGEY_SPAN = 3.0;
    static CAR_INTERVAL = 5.75;
    static CAR_BOGEY_SPACING = Train.CAR_INTERVAL - Train.BOGEY_SPAN;

    static TRAIN_UP = new Vector3(0, 1, 0);
    static TRAIN_TEXT_OFFSET = new Vector3(0, 5, 0);

    static GOOD_MIN_VALUE = 8;
    static BAD_MAX_VALUE = 4;

    render(renderer, network) {
        let localSegIdx = this.currentLocalSegIdx;
        let segDist = this.currentSegDist;
        const reversePos = dist => {
            let remDist = dist;
            for (;;) {
                const localSeg = this.occSegments[localSegIdx];
                const seg = network.segments[localSeg.segmentIdx];
                const p = linspline.Point();
                linspline.advancePoint(seg.tesSpline, p, segDist);
                const dirSign = localSeg.toHighEnd ? -1 : 1;
                const step = remDist * dirSign;
                const d = linspline.reversePoint(seg.tesSpline, p, step);
                remDist -= d;
                segDist -= d * dirSign;
                if (remDist < 0.0001) { break; }
                if (localSegIdx <= 0) { break; }
                localSegIdx -= 1;
                segDist = 0.0;
                const newLocalSeg = this.occSegments[localSegIdx];
                if (!newLocalSeg.toHighEnd) {
                    const newSeg = network.segments[newLocalSeg.segmentIdx];
                    segDist = linspline.computeLength(newSeg.tesSpline);
                }
            }
        };
        const currentPos = () => {
            const localSeg = this.occSegments[localSegIdx];
            const seg = network.segments[localSeg.segmentIdx];
            const p = linspline.Point();
            linspline.advancePoint(seg.tesSpline, p, segDist);
            return linspline.atPoint(seg.tesSpline, p);
        };
        let locoPos = null;
        let locoInstance = null;
        const carInstances = [];
        for (let carI = 0; carI <= this.carCount; carI += 1) {
            const isLoco = carI === 0;
            const frontPos = currentPos();
            reversePos(Train.BOGEY_SPAN);
            const backPos = currentPos();
            reversePos(Train.CAR_BOGEY_SPACING);
            const dir = frontPos.clone().subtract(backPos).normalize();
            const right = Train.TRAIN_UP.clone().cross(dir).normalize();
            const up = dir.clone().cross(right);
            const center = frontPos.clone().lerp(backPos, 0.5);
            const rotation = new Matrix4().set(
                ...right, 0,
                ...up, 0,
                ...dir, 0,
                0, 0, 0, 1
            );
            const position = new Matrix4().translate(center);
            const instance = position.multiplyRight(rotation);
            if (isLoco) {
                locoPos = center;
                locoInstance = instance;
            } else {
                carInstances.push(instance);
            }
        }
        const locoModel = Train.LOCO_MODELS[this.locoType];
        const s = Train.TRAIN_GEOMETRY_SHADER;
        s.setUniform("uTrainColor", Train.TRAIN_COLORS[this.color]);
        renderer.renderModel(locoModel, [locoInstance], null, s);
        renderer.renderModel(Train.CARRIAGE_MODEL, carInstances, null, s);
        this.text.pos = locoPos.clone().add(Train.TRAIN_TEXT_OFFSET);
        if (this.knownValue !== null) {
            this.text.setText(
                `${this.knownValue} ${getLocalized("pointCounterText")}`
            );
            this.text.element.classList.add("game-train-value-text");
            if (this.knownValue >= Train.GOOD_MIN_VALUE) {
                this.text.element.classList.add("game-good-train-text");
            }
            if (this.knownValue <= Train.BAD_MAX_VALUE) {
                this.text.element.classList.add("game-bad-train-text");
            }
        }
        this.text.update(renderer);
    }

    delete() {
        this.text.delete();
    }

}


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
        const min = linspline.fastMinBound(spline);
        const max = linspline.fastMaxBound(spline);
        return {
            geometry,
            minCX: Math.floor(units.toChunks(min.x)),
            minCZ: Math.floor(units.toChunks(min.z)),
            maxCX: Math.floor(units.toChunks(max.x)),
            maxCZ: Math.floor(units.toChunks(max.z)),
            tesSpline: segment.tesSpline,
            connectsLow: segment.connectsLow,
            connectsHigh: segment.connectsHigh
        };
    }

    static TRACK_HL_VERTICES_LOW = [
        { x: +0.8, y:  0.01, uv: [0.50, 0.50], muv: [0.00, 0.00] }, // [0] low right
        { x: -0.8, y:  0.01, uv: [0.50, 0.50], muv: [0.00, 0.00] }  // [1] low left
    ];
    static TRACK_HL_MAX_SEG_LEN = 2;
    static TRACK_HL_VERTICES_HIGH = [
        { x: +0.8, y:  0.01, uv: [0.50, 0.50], duv: [0.00, 0.00], muv: [0.00, 0.00] }, // [0] high right
        { x: -0.8, y:  0.01, uv: [0.50, 0.50], duv: [0.00, 0.00], muv: [0.00, 0.00] }  // [1] high left
    ];
    static BUILD_TRACK_HL_SPLINE_STEP = (quad, l, h) => {
        quad(l(1), l(0), h(0), h(1));
    }
    static TRACK_HL_MAX_GEN_LEN = 20;

    static generateSegmentHighlightMesh(segment, fromHigh) {
        const spline = segment.tesSpline;
        const geometry = linspline.generateGeometry(spline, {
            startFromHigh: fromHigh,
            segLengthLimit: TrackNetwork.TRACK_HL_MAX_SEG_LEN,
            genLengthLimit: TrackNetwork.TRACK_HL_MAX_GEN_LEN,
            up: TrackNetwork.TRACK_UP,
            lowVertices: TrackNetwork.TRACK_HL_VERTICES_LOW,
            highVertices: TrackNetwork.TRACK_HL_VERTICES_HIGH,
            buildSegment: TrackNetwork.BUILD_TRACK_HL_SPLINE_STEP,
            layout: Renderer.OBJ_LAYOUT
        });
        const min = linspline.fastMinBound(spline);
        const max = linspline.fastMaxBound(spline);
        return {
            geometry,
            minCX: Math.floor(units.toChunks(min.x)),
            minCZ: Math.floor(units.toChunks(min.z)),
            maxCX: Math.floor(units.toChunks(max.x)),
            maxCZ: Math.floor(units.toChunks(max.z))
        };
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

    buildSwitchHighlights() {
        const buildBranchHighlight = bConn => {
            return TrackNetwork.generateSegmentHighlightMesh(
                this.segments[bConn.segmentIdx], bConn.toHighEnd
            );
        };
        this.switchHighlights = this.segments.map(s => {
            const low = s.connectsLow.map(buildBranchHighlight);
            const high = s.connectsHigh.map(buildBranchHighlight);
            return { low, high };
        });
    }

    static SWITCH_SIG_S_DIST = 14; // spline start -> 1st ctrl pt
    static SWITCH_SIG_E_DIST = 5; // 1st ctrl pt -> 2nd ctrl pt
    static SWITCH_SIG_UP = new Vector3([0, 1, 0]);
    static SWITCH_SIG_RIGHT_DIST = 2;

    buildSwitchSignals(networkDetails) {
        const updateBranchSignal = (segmentIdx, toHighEnd, newState) => {
            const updates = [];
            const hasBranch = c => c.segmentIdx === segmentIdx
                && c.toHighEnd === toHighEnd;
            for (let segI = 0; segI < this.segments.length; segI += 1) {
                const seg = this.segments[segI];
                const lowBranchIdx = seg.connectsLow.findIndex(hasBranch)
                if (lowBranchIdx !== -1) {
                    updates.push({
                        connection: { segmentIdx: segI, toHighEnd: false },
                        branchIdx: newState ? lowBranchIdx : null
                    });
                }
                const highBranchIdx = seg.connectsHigh.findIndex(hasBranch)
                if (highBranchIdx !== -1) {
                    updates.push({
                        connection: { segmentIdx: segI, toHighEnd: true },
                        branchIdx: newState ? highBranchIdx : null
                    });
                }
            }
            window.socket.send(JSON.stringify({
                type: "switch_state_updates",
                updates
            }));
        };
        const advancePoint = (spline, point, dist, reverse) => {
            const d = dist * (reverse ? -1 : 1);
            linspline.advancePoint(spline, point, d);
        };
        const addBranchSignal = (segmentIdx, toHighEnd) => {
            const s = this.segments[segmentIdx].tesSpline;
            const isRight = networkDetails.segmentsRight[segmentIdx];
            const point = linspline.Point();
            if (toHighEnd) { linspline.advancePointToEnd(s, point); }
            const start = linspline.atPoint(s, point);
            advancePoint(s, point, +TrackNetwork.SWITCH_SIG_S_DIST, toHighEnd);
            advancePoint(s, point, +TrackNetwork.SWITCH_SIG_E_DIST, toHighEnd);
            advancePoint(s, point, -TrackNetwork.SWITCH_SIG_E_DIST, toHighEnd);
            const first = linspline.atPoint(s, point);
            advancePoint(s, point, +TrackNetwork.SWITCH_SIG_E_DIST, toHighEnd);
            const second = linspline.atPoint(s, point);
            const dir = second.clone().subtract(first);
            const reqDist = TrackNetwork.SWITCH_SIG_S_DIST
                + TrackNetwork.SWITCH_SIG_E_DIST;
            const startToSecond = second.clone().subtract(start);
            const missingDist = Math.max(reqDist - startToSecond.length, 0);
            const sigTrackBase = second.clone();
            if (missingDist > 1) {
                second.add(startToSecond.clone().scale(missingDist));
            }
            const sigOffset = dir.cross(TrackNetwork.SWITCH_SIG_UP)
                .normalize().scale(TrackNetwork.SWITCH_SIG_RIGHT_DIST);
            if (!isRight) { sigOffset.negate(); }
            if (toHighEnd) { sigOffset.negate(); }
            const sigPos = sigTrackBase.clone().add(sigOffset);
            const newSignal = new Signal(
                sigPos,
                ns => updateBranchSignal(segmentIdx, toHighEnd, ns)
            );
            this.signals.push(newSignal);
            return newSignal;
        };
        this.segmentSignals = new Map();
        const addBranch = c => {
            let endings = this.segmentSignals.get(c.segmentIdx);
            if (endings === undefined) {
                endings = { toLow: null, toHigh: null };
                this.segmentSignals.set(c.segmentIdx, endings);
            }
            if (!c.toHighEnd && endings.toLow === null) {
                endings.toLow = addBranchSignal(c.segmentIdx, false);
            }
            if (c.toHighEnd && endings.toHigh === null) {
                endings.toHigh = addBranchSignal(c.segmentIdx, true);
            }
        };
        for (const s of this.segments) {
            if (s.connectsLow.length >= 2) { 
                s.connectsLow.forEach(addBranch);
            }
            if (s.connectsHigh.length >= 2) {
                s.connectsHigh.forEach(addBranch);
            }
        }
    }

    constructor(worldDetails, elev) {
        this.segments = worldDetails.network.segments
            .map(s => TrackNetwork.generateSegmentMesh(s, elev));
        this.buildStationInstances(worldDetails.network, elev);
        this.sizeT = chunks.toTiles(worldDetails.terrain.sizeC);
        this.prepareTileRegionTex(worldDetails.network);
        this.visibleSwitchHighlights = [];
        this.buildSwitchHighlights();
        this.signals = [];
        this.buildSwitchSignals(worldDetails.network);
        this.regionTexts = [];
        this.trains = new Map();
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
        this.regionTexts.forEach(t => t.delete());
        this.regionTexts = [];
        const sizeC = Math.floor(tiles.toChunks(this.sizeT));
        for (let cx = 0; cx < sizeC; cx += 1) {
            for (let cz = 0; cz < sizeC; cz += 1) {
                const i = cz * sizeC + cx;
                const owner = regions.chunks[i].owner;
                const offset = i * 4;
                this.stationLocBuffData[offset + 2] = owner === null 
                    ? TrackNetwork.STATION_UNOWNED
                    : owner.id === playerId
                        ? TrackNetwork.STATION_OF_CLIENT
                        : TrackNetwork.STATION_OF_ENEMY;
                if (owner !== null && owner.id !== playerId) {
                    const center = new Vector3(
                        tiles.toUnits(this.stationLocBuffData[offset + 0]), 0,
                        tiles.toUnits(this.stationLocBuffData[offset + 1])
                    );
                    this.regionTexts.push(new RegionText(
                        center, owner.name
                    ));
                }
            }
        }
        this.stationLocBuff.upload(this.stationLocBuffData);
        const s = TrackNetwork.TILE_REGION_COMP_SHADER;
        this.tileStationMapG.render(
            s, this.tileRegionFb, 1, DepthTesting.DISABLED
        );
    }

    updateSwitchStates(switches) {
        this.visibleSwitchHighlights = switches.map(sw => {
            const segmentIdx = sw.key.segmentIdx;
            const segment = this.switchHighlights[segmentIdx];
            const branches = sw.key.toHighEnd ? segment.high : segment.low;
            return branches[sw.value];
        });
        const updateSignalState = (sigSegIdx, sigToHigh, sig) => {
            let newState = false;
            for (const sw of switches) {
                const swSeg = this.segments[sw.key.segmentIdx];
                const branches = sw.key.toHighEnd
                ? swSeg.connectsHigh : swSeg.connectsLow;
                const checkBranch = (conn, brIdx) => {
                    if (conn.segmentIdx !== sigSegIdx) { return; }
                    if (conn.toHighEnd !== sigToHigh) { return; }
                    if (sw.value !== brIdx) { return; }
                    newState = true;
                }
                branches.forEach(checkBranch);
            }
            sig.setState(newState);
        };
        for (let segI = 0; segI < this.segments.length; segI += 1) {
            const s = this.segmentSignals.get(segI);
            if (!s) { continue; }
            if (s.toLow !== null) { updateSignalState(segI, false, s.toLow); }
            if (s.toHigh !== null) { updateSignalState(segI, true, s.toHigh); }
        }
    }

    updateTrains(trains) {
        const receivedTrainIds = new Set();
        for (const entry of trains) {
            const trainId = entry.key;
            receivedTrainIds.add(trainId);
            const trainState = entry.value;
            const train = this.trains.get(trainId);
            if (train === undefined) {
                this.trains.set(trainId, new Train(trainState));
            } else {
                train.onNewState(trainState, this);
            }
        }
        for (const trainId of this.trains.keys()) {
            if (receivedTrainIds.has(trainId)) { continue; }
            this.trains.delete(trainId);
        }
    }

    updateTrainPoints(trains) {
        for (const entry of trains) {
            const train = this.trains.get(entry.trainId);
            if (!train) { continue; }
            train.knownValue = entry.numPoints;
        }
    }

    update(deltaTime) {
        for (const train of this.trains.values()) {
            train.update(this, deltaTime);
        }
    }

    static RENDER_XMIN = -2;
    static RENDER_XMAX = +2;
    static RENDER_ZMIN = -1;
    static RENDER_ZMAX = +1;

    render(renderer) {
        renderer.setGeometryUniforms(TrackNetwork.TRACK_HIGHLIGHT_SHADER);
        renderer.setGeometryUniforms(Train.TRAIN_GEOMETRY_SHADER);
        const segmentInstance = [ new Matrix4() ];
        const camChunkX = units.toChunks(renderer.camera.center.x);
        const camChunkZ = units.toChunks(renderer.camera.center.z);
        const cMinChunkX = Math.floor(camChunkX) + TrackNetwork.RENDER_XMIN;
        const cMinChunkZ = Math.floor(camChunkZ) + TrackNetwork.RENDER_ZMIN;
        const cMaxChunkX = Math.ceil(camChunkX) + TrackNetwork.RENDER_XMAX;
        const cMaxChunkZ = Math.ceil(camChunkZ) + TrackNetwork.RENDER_ZMAX;
        const isOutOfBounds = (minChunkX, minChunkZ, maxChunkX, maxChunkZ) => {
            if (maxChunkX === undefined) { maxChunkX = minChunkX; }
            if (maxChunkZ === undefined) { maxChunkZ = minChunkZ; }
            return maxChunkX < cMinChunkX || maxChunkZ < cMinChunkZ ||
                minChunkX >= cMaxChunkX || minChunkZ >= cMaxChunkZ;
        };
        for (const s of this.segments) {
            if (isOutOfBounds(s.minCX, s.minCZ, s.maxCX, s.maxCZ)) {
                continue;
            }
            renderer.renderGeometry(
                s.geometry, TrackNetwork.TRACKS_TEXTURE, segmentInstance
            );
        }
        for (const s of this.stations) {
            if (isOutOfBounds(s.chunkX, s.chunkZ)) { continue; }
            renderer.renderModel(TrackNetwork.PLATFORM_MODEL, s.platforms);
            renderer.renderModel(TrackNetwork.STATION_MODEL, s.buildings);
        }
        const hlInst = new Matrix4();
        for (const h of this.visibleSwitchHighlights) {
            if (isOutOfBounds(h.chunkX, h.chunkZ)) { continue; }
            renderer.renderGeometry(
                h.geometry, null, [hlInst], null,
                TrackNetwork.TRACK_HIGHLIGHT_SHADER
            );
        }
        for (const t of this.trains.values()) {
            if (isOutOfBounds(t.chunkX, t.chunkZ)) { continue; }
            t.render(renderer, this);
        }
        this.signals.forEach(s => s.update(renderer));
        this.regionTexts.forEach(t => t.update(renderer));
    }
 
    delete() {
        this.segments.forEach(s => s.geometry.delete());
        this.tileRegionFb.delete();
        this.tileRegionTex.delete();
        this.stationLocBuff.delete();
        this.tileStationMapG.delete();
        this.switchHighlights.forEach(s => {
            s.low.forEach(h => h.geometry.delete());
            s.high.forEach(h => h.geometry.delete());
        });
        this.signals.forEach(s => s.delete());
        this.regionTexts.forEach(t => t.delete());
        this.trains.forEach(t => t.delete());
    }

}