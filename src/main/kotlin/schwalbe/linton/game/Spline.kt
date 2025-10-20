
package schwalbe.linton.game

import org.joml.*

// implementation of a Catmull-Rom spline
data class Spline(val points: List<Vector3fc>) {

    fun pointAt(offset: Float): Vector3fc {
        val segment: Int = offset.toInt()
        if(segment < 0) { return this.points.first() }
        if(segment >= this.points.size - 1) { return this.points.last() }
        // get knot locations
        // segment starts at p1 and ends at p2
        // p0 is the knot before p1, p3 the one after p2
        val p1: Vector3fc = this.points[segment]
        val p2: Vector3fc = this.points[segment + 1]
        val p0: Vector3fc = this.points.getOrNull(segment - 1)
            ?: Vector3f(p2).sub(p1).negate().add(p1)
        val p3: Vector3fc = this.points.getOrNull(segment + 2)
            ?: Vector3f(p1).sub(p2).negate().add(p2)
        // get velocity vectors for hermit spline
        val v1: Vector3fc = Vector3f(p2).sub(p0).mul(0.5f)
        val v2: Vector3fc = Vector3f(p3).sub(p1).mul(0.5f)
        // derive bezier control points
        val c1: Vector3fc = Vector3f(v1).div(3f).add(p1)
        val c2: Vector3fc = Vector3f(v2).negate().div(3f).add(p2)
        // cubic bezier
        val t: Float = offset - segment.toFloat()
        val u: Float = 1f - t
        val c = Vector3f()
        val r = Vector3f()
        r.add(c.set(p1).mul(   u*u*u))
        r.add(c.set(c1).mul(3f*u*u*t))
        r.add(c.set(c2).mul(3f*u*t*t))
        r.add(c.set(p2).mul(   t*t*t))
        return r
    }

    fun tessellate(resolution: Int): List<Vector3fc> {
        val subSegLen: Float = 1f / resolution.toFloat()
        val builtLen: Int = (this.points.size - 1) * resolution + 1
        val built = ArrayList<Vector3fc>(builtLen)
        for(segment in 0..<(this.points.size - 1)) {
            for(subSeg in 0..<resolution) {
                val t: Float = subSeg * subSegLen.toFloat()
                val p: Vector3fc = this.pointAt(segment.toFloat() + t)
                built.add(p)
            }
        }
        built.add(this.points.last())
        return built
    }

}