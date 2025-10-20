
import { Vector3 } from "../libs/math.gl.js";

export const catmullRom = {

    pointAt: function(points, offset) {
        const segment = Math.trunc(offset)
        if(segment < 0) { return points[0]; }
        if(segment >= points.length - 1) { return points.at(-1); }
        // get knot locations
        // segment starts at p1 and ends at p2
        // p0 is the knot before p1, p3 the one after p2
        const p1 = points[segment];
        const p2 = points[segment + 1];
        const p0 = points[segment - 1]
            || p2.clone().subtract(p1).negate().add(p1);
        const p3 = points[segment + 2]
            || p1.clone().subtract(p2).negate().add(p2);
        // get velocity vectors for hermit spline
        const v1 = p2.clone().subtract(p0).scale(0.5);
        const v2 = p3.clone().subtract(p1).scale(0.5);
        // derive bezier control points
        const c1 = v1.clone().scale(+1/3).add(p1);
        const c2 = v2.clone().scale(-1/3).add(p2);
        // cubic bezier
        const t = offset - segment;
        const u = 1 - t;
        return new Vector3()
            .add(p1.clone().scale(  u*u*u))
            .add(c1.clone().scale(3*u*u*t))
            .add(c2.clone().scale(3*u*t*t))
            .add(p2.clone().scale(  t*t*t));
    },

    tessellate: function(points, resolution) {
        const subSegLen = 1 / resolution;
        const builtLen = (points.length - 1) * resolution + 1;
        const built = new Array(builtLen - 1);
        for(let segment = 0; segment < points.length - 1; segment += 1) {
            for(let subSeg = 0; subSeg < resolution; subSeg += 1) {
                const t = subSeg * subSegLen;
                const p = this.pointAt(points, segment + t);
                const i = segment * resolution + subSeg;
                built[i] = p;
            }
        }
        built.push(points.at(-1));
        return built;
    }

};

export const linear = {

    pointAt: function(offset) {
        // TODO!
    }

};