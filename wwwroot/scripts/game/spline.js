
import { Vector3 } from "../libs/math.gl.js";
import { Geometry } from "./graphics.js";

export const quadspline = Object.freeze({

    inSegment: function(spline, segmentI, t) {
        if (segmentI < 0 || spline.segments.length === 0) {
            return spline.start.clone();
        }
        if (segmentI >= spline.segments.length) {
            return spline.segments.at(-1).to.clone();
        }
        const start = segmentI === 0? spline.start 
            : spline.segments[segmentI - 1].to;
        const segment = spline.segments[segmentI];
        // quadratic bezier
        const u = 1.0 - t;
        const c = new Vector3()
        const r = new Vector3()
        r.add(c.copy(start       ).scale(      u * u));
        r.add(c.copy(segment.ctrl).scale(2.0 * u * t));
        r.add(c.copy(segment.to  ).scale(      t * t));
        return r;
    },

    tessellate: function(spline, numSegPoints) {
        const segPointDist = 1 / numSegPoints;
        const builtLen = spline.segments.length * numSegPoints;
        const builtSegments = new Array(builtLen);
        for (let segI = 0; segI < spline.segments.length; segI += 1) {
            for (let subSegI = 1; subSegI <= numSegPoints; subSegI += 1) {
                const t = subSegI * segPointDist;
                const p = quadspline.inSegment(spline, segI, t);
                builtSegments[segI * numSegPoints + subSegI - 1] = p;
            }
        }
        return {
            start: new Vector3().copy(spline.start),
            segments: builtSegments
        };
    }

});

export const linspline = Object.freeze({

    inSegment: function(spline, segmentI, t) {
        if (segmentI < 0 || spline.segments.length === 0) {
            return spline.start;
        }
        if (segmentI >= spline.segments.length) {
            return spline.segments.at(-1);
        }
        const start = segmentI === 0? spline.start
            : spline.segments[segmentI - 1];
        const end = spline.segments[segmentI];
        return start.clone().lerp(end, t);
    },

    segmentLength: function(spline, segmentI) {
        const end = spline.segments[segmentI];
        const start = segmentI === 0? spline.start
            : spline.segments[segmentI - 1];
        return start.distance(end);
    },

    Point: function() {
        return { segmentI: 0, dist: 0.0 };
    },

    advancePointToEnd: function(spline, point) {
        point.segmentI = spline.segments.length - 1;
        point.dist = linspline.segmentLength(spline, point.segmentI);
    },

    advancePoint: function(spline, point, dist) {
        if (dist < 0) { return linspline.reversePoint(spline, point, -dist); }
        let remDist = dist + point.dist;
        point.dist = 0.0;
        while (point.segmentI < spline.segments.length) {
            const segLen = linspline.segmentLength(spline, point.segmentI);
            if (segLen > remDist) {
                point.dist = remDist;
                return dist;
            }
            remDist -= segLen;
            point.segmentI += 1;
        }
        linspline.advancePointToEnd(spline, point);
        return dist - remDist;
    },

    atPoint: function(spline, point) {
        const t = point.dist / linspline.segmentLength(spline, point.segmentI);
        return linspline.inSegment(spline, point.segmentI, t);
    },
    
    totalLength: function(spline) {
        let totalLength = 0;
        for (let segI = 0; segI < spline.segments.length; segI += 1) {
            totalLength += linspline.segmentLength(spline, segI);
        }
        return totalLength;
    },

    // Options:
    // startFromHigh (false)      - whether to mesh from low to high (false)
    //                              or high to low (true)
    // genLengthLimit (spl. len)  - length limit for the entire generated mesh
    // segLengthLimit (1.0)       - length limit for each mesh segment
    // uvDistance (1.0)           - distance which maps to 1 DUV
    // modifyFunc ((a, b) => 0.0) - function that returns the factor of MUV
    //                              added for start and end points
    // up (new Vector3(0, 1, 0))  - the relative "up" direction
    // lowVertices ([])           - list of low vertices
    // highVertices ([])          - list of high vertices
    // buildSegment (() => {})    - a function that builds the geometry of
    //                              each segment
    // layout ([])                - OBJ vertex layout array
    // 
    // Vertex options (all vertices):
    // x   - offset left (< 0) or right (> 0) of spline (scales orthogonal)
    // y   - offset above (> 0) or below (< 0) of spline (scales 'up')
    // uv  - base vertex UV coordinate
    // muv - UV offset added based on modification function
    // 
    // Vertex options (only high vertices):
    // duv - UV offset added based on distance between high and low
    //
    // Build Segment Function Arguments:
    // quad - function that takes four vertices (CCW winding order) and builds
    //        a quad from them
    // low  - function that takes the index of a vertex in the low vertices list
    //        and returns the equivalent vertex used for 'quad'
    // high - function that takes the index of a vertex in the high vertices
    //        list and returns the equivalent vertex used for 'quad'
    generateGeometry: function(spline, options = {}) {
        const splineLen = linspline.totalLength(spline);
        const startFromHigh = options.startFromHigh || false;
        const genLengthLimit = options.genLengthLimit || splineLen;
        const segLengthLimit = options.segLengthLimit || 1.0;
        const uvDistance = options.uvDistance || 1.0;
        const modifyFunc = options.modifyFunc || ((_1, _2) => 0.0);
        const up = options.up || new Vector3(0, 1, 0);
        const lowVertices = options.lowVertices || [];
        const highVertices = options.highVertices || [];
        const buildSegment = options.buildSegment || (() => {});
        const layout = options.layout || [];
        let point = linspline.Point();
        if (startFromHigh) {
            linspline.advancePoint(spline, point, splineLen - genLengthLimit);
        }
        let low = linspline.atPoint(spline, point);
        let lowRight = null;
        const vertData = [];
        let nextVertIdx = 0;
        const elemData = [];
        const buildQuad = (a, b, c, d) => {
            const ba = a.pos.clone().subtract(b.pos);
            const bc = c.pos.clone().subtract(b.pos);
            const norm = bc.cross(ba).normalize();
            const o = nextVertIdx;
            for (const v of [a, b, c, d]) {
                for (const property of layout) {
                    vertData.push(...property.select(v.pos, v.uv, norm));
                }
            }
            nextVertIdx += 4;
            elemData.push(
                o+0, o+1, o+2,
                o+0, o+2, o+3
            );
        };
        let remGenLen = genLengthLimit;
        for (;;) {
            const highOff = Math.min(remGenLen, segLengthLimit);
            const advanced = linspline.advancePoint(spline, point, highOff);
            if (advanced <= 0.001) { break; }
            remGenLen -= advanced;
            const high = linspline.atPoint(spline, point);
            const lowToHigh = high.clone().subtract(low).normalize();
            const highRight = lowToHigh.cross(up).normalize();
            if (lowRight == null) { lowRight = highRight; }
            const muvFac = modifyFunc(low, high);
            const duvFac = advanced / uvDistance;
            const vertPos = (origin, right, v) => right.clone().scale(v.x)
                .add(up.clone().scale(v.y))
                .add(origin);
            const buildLowVertex = i => {
                const v = lowVertices[i];
                const pos = vertPos(low, lowRight, v);
                const uv = [
                    v.uv[0] + v.muv[0] * muvFac,
                    v.uv[1] + v.muv[1] * muvFac
                ];
                return { pos, uv };
            };
            const buildHighVertex = i => {
                const v = highVertices[i];
                const pos = vertPos(high, highRight, v);
                const uv = [
                    v.uv[0] + v.muv[0] * muvFac + v.duv[0] * duvFac,
                    v.uv[1] + v.muv[1] * muvFac + v.duv[1] * duvFac
                ];
                return { pos, uv };
            };
            buildSegment(buildQuad, buildLowVertex, buildHighVertex);
            low = high;
            lowRight = highRight;
        }
        return new Geometry(layout.map(p => p.size), vertData, elemData);
    }

});
