
import { Vector3 } from "../libs/math.gl.js";

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
        return start.lerp(end, t);
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

    advancePoint: function(spline, point, dist) {
        let remDist = dist + point.dist;
        point.dist = 0.0;
        while (point.segmentI < spline.segments.length) {
            const segLen = linspline.segmentLength(spline, point.segmentI);
            if (segLen > remDist) {
                point.dist = remDist
                return
            }
            remDist -= segLen;
            point.segmentI += 1;
        }
        point.segmentI = spline.segments.length - 1;
        point.dist = linspline.segmentLength(spline, point.segmentI);
    },

    atPoint: function(spline, point) {
        const t = point.dist / linspline.segmentLength(spline, point.segmentI);
        return linspline.inSegment(spline, point.segmentI, t);
    }

});
