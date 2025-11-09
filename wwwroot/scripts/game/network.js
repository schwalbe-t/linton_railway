
import { Matrix4, Vector3 } from "../libs/math.gl.js";
import {
    Geometry, Model, Texture, TextureFilter, TextureFormat
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { linspline, quadspline } from "./spline.js";
import { HeightMap, units } from "./terrain.js";

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
        TrackNetwork.TRACKS_TEXTURE = await tracksTextureReq;
        TrackNetwork.PLATFORM_MODEL = await platformModelReq;
        TrackNetwork.STATION_MODEL = await stationModelReq;
    }

    // X+ is towards the right in the direction of low -> high
    static TRACK_VERTICES_LOW = [
        // ballast top plane
        { x: +0.8, y:  0.0, uv: [0.00, 1.00] }, // [0] low right
        { x: -0.8, y:  0.0, uv: [0.25, 1.00] }, // [1] low left
        // ballast right plane
        { x: +0.8, y:  0.0, uv: [0.50, 1.00] }, // [2] low top
        { x: +1.6, y: -4.0, uv: [0.50, 0.50] }, // [3] low bottom
        // ballast left plane
        { x: -0.8, y:  0.0, uv: [1.00, 1.00] }, // [4] low top
        { x: -1.6, y: -4.0, uv: [1.00, 0.50] }  // [5] low bottom
    ];
    static TRACK_MAX_SEG_LEN = 2;
    static TRACK_UV_DIST = 4;
    // - 'uv' is the base tex coordinate for the vertex
    // - 'suv' is added to the tex coordinate for the vertex based on the
    //   distance to the "low" vertex with the same index
    //   (if the distance is the const uv dist, all is added, otherwise less)
    static TRACK_VERTICES_HIGH = [
        // ballast top plane
        { x: +0.8, y:  0.0, uv: [0.00, 1.00], suv: [ 0.00, -1.00] }, // [0] high right
        { x: -0.8, y:  0.0, uv: [0.25, 1.00], suv: [ 0.00, -1.00] }, // [1] high left
        // ballast right plane
        { x: +0.8, y:  0.0, uv: [0.50, 1.00], suv: [+0.50,  0.00] }, // [2] high top
        { x: +1.6, y: -4.0, uv: [0.50, 0.50], suv: [+0.50,  0.00] }, // [3] high bottom
        // ballast left plane
        { x: -0.8, y:  0.0, uv: [1.00, 1.00], suv: [-0.50,  0.00] }, // [4] high top
        { x: -1.6, y: -4.0, uv: [1.00, 0.50], suv: [-0.50,  0.00] }  // [5] high bottom
    ];

    static BRIDGE_TERRAIN_ELEV = -3.0;
    static BRIDGE_UV_OFFSET = [0.00, -0.50];

    // - 'quad' is a function that builds a quad using the given vertices
    // - 'l' is a function that receives an index of an entry in
    // 'TRACK_VERTICES_LOW' and returns the value that 'quad' expects for it
    // - 'h' is a function that receives an index of an entry in
    // 'TRACK_VERTICES_HIGH' and returns the value that 'quad' expects for it
    static buildTrackSplineStep(quad, l, h) {
        quad(l(1), l(0), h(0), h(1)); // ballast top plane
        quad(l(2), l(3), h(3), h(2)); // ballast right plane
        quad(h(4), h(5), l(5), l(4)); // ballast left plane
    }

    static TRACK_UP = new Vector3(0, 1, 0);

    static generateSegmentMesh(segment, elev) {
        const spline = segment.tesSpline;
        let low = spline.start;
        let lowRight = null;
        let point = linspline.Point();
        const vertData = [];
        let nextVertIdx = 0;
        const elemData = [];
        const buildQuad = (a, b, c, d) => {
            const ba = a.pos.clone().subtract(b.pos);
            const bc = c.pos.clone().subtract(b.pos);
            const norm = bc.cross(ba).normalize();
            const o = nextVertIdx;
            vertData.push(
                ...a.pos, ...norm, ...a.uv, // [0]
                ...b.pos, ...norm, ...b.uv, // [1]
                ...c.pos, ...norm, ...c.uv, // [2]
                ...d.pos, ...norm, ...d.uv  // [3]
            );
            nextVertIdx += 4;
            elemData.push(
                o+0, o+1, o+2,
                o+0, o+2, o+3
            );
        };
        for (;;) {
            const advanced = linspline.advancePoint(
                spline, point, TrackNetwork.TRACK_MAX_SEG_LEN
            );
            if (advanced <= 0.001) { break; }
            const high = linspline.atPoint(spline, point);
            const lowToHigh = high.clone().subtract(low).normalize();
            const highRight = lowToHigh.cross(TrackNetwork.TRACK_UP)
                .normalize();
            if (lowRight == null) { lowRight = highRight; }
            const lowTileX = Math.round(units.toTiles(low.x));
            const lowTileZ = Math.round(units.toTiles(low.z));
            const highTileX = Math.round(units.toTiles(high.x));
            const highTileZ = Math.round(units.toTiles(high.z));
            const minElev = Math.min(
                elev.at(lowTileX, lowTileZ), elev.at(highTileX, highTileZ)
            );
            const isBridge = minElev <= TrackNetwork.BRIDGE_TERRAIN_ELEV;
            const bridgeU = isBridge ? TrackNetwork.BRIDGE_UV_OFFSET[0] : 0;
            const bridgeV = isBridge ? TrackNetwork.BRIDGE_UV_OFFSET[1] : 0;
            const vertPos = (origin, right, v) => right.clone().scale(v.x)
                .add([0, v.y, 0])
                .add(origin);
            const buildLowVertex = i => {
                const v = TrackNetwork.TRACK_VERTICES_LOW[i];
                const pos = vertPos(low, lowRight, v);
                const uv = [v.uv[0] + bridgeU, v.uv[1] + bridgeV];
                return { pos, uv };
            };
            const buildHighVertex = i => {
                const v = TrackNetwork.TRACK_VERTICES_HIGH[i];
                const pos = vertPos(high, highRight, v);
                const uvs = advanced / TrackNetwork.TRACK_UV_DIST;
                const uv = [
                    v.uv[0] + v.suv[0] * uvs + bridgeU,
                    v.uv[1] + v.suv[1] * uvs + bridgeV
                ];
                return { pos, uv };
            };
            TrackNetwork.buildTrackSplineStep(
                buildQuad, buildLowVertex, buildHighVertex
            );
            low = high;
            lowRight = highRight;
        }
        return new Geometry(Renderer.GEOMETRY_LAYOUT, vertData, elemData);
    }

    static PLATFORM_MODEL_LENGTH = 5; // in units
    static STATION_MODEL_WIDTH = 5; // in units
    static PLATFORM_DISTANCE = 10; // distance between platforms in units

    buildStationInstances(networkDetails, elev) {
        this.platformInstances = [];
        this.stationInstances = [];
        for (const station of networkDetails.stations) {
            const along = station.isAlongZ
                ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
            const across = station.isAlongZ
                ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
            const center = new Vector3(station.minPos)
                .lerp(station.maxPos, 0.5)
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
                    this.platformInstances.push(instance);
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
            this.stationInstances.push(bdInstance);
        }
    }

    constructor(networkDetails, elev) {
        this.segmentMeshes = networkDetails.segments
            .map(s => TrackNetwork.generateSegmentMesh(s, elev));
        this.buildStationInstances(networkDetails, elev);
    }

    render(renderer) {
        const identityInstance = [ new Matrix4() ];
        this.segmentMeshes.forEach(m => renderer.renderGeometry(
            m, TrackNetwork.TRACKS_TEXTURE, identityInstance
        ));
        renderer.renderModel(
            TrackNetwork.PLATFORM_MODEL, this.platformInstances
        );
        renderer.renderModel(
            TrackNetwork.STATION_MODEL, this.stationInstances
        );
    }
 
    delete() {
        this.segmentMeshes.forEach(m => m.delete());
    }

}