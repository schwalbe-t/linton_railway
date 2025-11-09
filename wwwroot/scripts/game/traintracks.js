
import { Matrix4, Vector3 } from "../libs/math.gl.js";
import { Geometry, Texture } from "./graphics.js";
import { Renderer } from "./renderer.js";
import { linspline, quadspline } from "./spline.js";

export class TrainTracks {

    static TRACKS_TEXTURE = null;
    static async loadResources() {
        const tracksTextureReq = Texture.loadImage("/res/textures/tracks.png");
        TrainTracks.TRACKS_TEXTURE = await tracksTextureReq;
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

    static TRACK_TESSELLATION_RES = 10;
    static TRACK_UP = new Vector3(0, 1, 0);

    static generateSegmentMesh(segment) {
        console.log(segment.spline);
        const spline = quadspline.tessellate(
            segment.spline, TrainTracks.TRACK_TESSELLATION_RES
        );
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
                spline, point, TrainTracks.TRACK_MAX_SEG_LEN
            );
            if (advanced <= 0.001) { break; }
            const high = linspline.atPoint(spline, point);
            const lowToHigh = high.clone().subtract(low).normalize();
            const highRight = lowToHigh.cross(TrainTracks.TRACK_UP).normalize();
            if (lowRight == null) { lowRight = highRight; }
            const vertPos = (origin, right, v) => right.clone().scale(v.x)
                .add([0, v.y, 0])
                .add(origin);
            const buildLowVertex = i => {
                const v = TrainTracks.TRACK_VERTICES_LOW[i];
                const pos = vertPos(low, lowRight, v);
                return { pos, uv: v.uv };
            };
            const buildHighVertex = i => {
                const v = TrainTracks.TRACK_VERTICES_HIGH[i];
                const pos = vertPos(high, highRight, v);
                const uvs = advanced / TrainTracks.TRACK_UV_DIST;
                const uv = [
                    v.uv[0] + v.suv[0] * uvs,
                    v.uv[1] + v.suv[1] * uvs
                ];
                return { pos, uv };
            };
            TrainTracks.buildTrackSplineStep(
                buildQuad, buildLowVertex, buildHighVertex
            );
            low = high;
            lowRight = highRight;
        }
        return new Geometry(Renderer.GEOMETRY_LAYOUT, vertData, elemData);
    }

    constructor(details) {
        this.segmentMeshes = details.segments
            .map(TrainTracks.generateSegmentMesh);
    }

    render(renderer) {
        const instance = [ new Matrix4() ];
        this.segmentMeshes.forEach(m => renderer.renderGeometry(
            m, TrainTracks.TRACKS_TEXTURE, instance
        ));
    }
 
    delete() {
        this.segmentMeshes.forEach(m => m.delete());
    }

}