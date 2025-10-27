
package schwalbe.linton.game

import org.joml.*
import kotlinx.serialization.Serializable

fun Vector3fc.serialize(): List<Float> = listOf(this.x(), this.y(), this.z())


data class QuadSpline(
    val start: Vector3fc, val segments: List<QuadSpline.Segment>
) {
    data class Segment(val ctrl: Vector3fc, val to: Vector3fc)

    fun inSegment(segmentI: Int, t: Float): Vector3fc {
        if(segmentI < 0 || this.segments.size == 0) {
            return this.start
        }
        if(segmentI >= this.segments.size) {
            return this.segments[this.segments.size - 1].to
        }
        val start = if(segmentI == 0) this.start 
            else this.segments[segmentI - 1].to
        val segment = this.segments[segmentI]
        // quadratic bezier
        val u: Float = 1f - t
        val c = Vector3f()
        val r = Vector3f()
        r.add(c.set(start       ).mul(     u * u))
        r.add(c.set(segment.ctrl).mul(2f * u * t))
        r.add(c.set(segment.to  ).mul(     t * t))
        return r
    }

    fun tessellate(numSegPoints: Int): LinSpline {
        val segPointDist: Float = 1f / numSegPoints.toFloat()
        val builtLen: Int = this.segments.size * numSegPoints;
        val builtSegments = ArrayList<Vector3fc>(builtLen)
        for(segmentI in this.segments.indices) {
            for(subSegI in 1..numSegPoints) {
                val t: Float = subSegI.toFloat() * segPointDist
                val p: Vector3fc = this.inSegment(segmentI, t)
                builtSegments.add(p)
            }
        }
        return LinSpline(this.start, builtSegments)
    }


    @Serializable
    data class Serialized(
        val start: List<Float>, 
        val segments: List<QuadSpline.Serialized.Segment>
    ) {
        @Serializable
        data class Segment(val ctrl: List<Float>, val to: List<Float>)
    }

    fun serialize(): QuadSpline.Serialized = QuadSpline.Serialized(
        this.start.serialize(),
        this.segments.map { s -> QuadSpline.Serialized.Segment(
            s.ctrl.serialize(), s.to.serialize()
        ) }
    )

}

@Serializable
data class LinSpline(val start: Vector3fc, val segments: List<Vector3fc>) {

    companion object {
        fun lerp(a: Vector3fc, b: Vector3fc, t: Float): Vector3fc {
            if(t <= 0f) { return a; }
            if(t >= 1f) { return b; }
            return Vector3f(a).mul(1f - t).add(Vector3f(b).mul(t))
        }
    }

    fun inSegment(segmentI: Int, t: Float): Vector3fc {
        if(segmentI < 0 || this.segments.size == 0) {
            return this.start
        }
        if(segmentI >= this.segments.size) {
            return this.segments[this.segments.size - 1]
        }
        val start = if(segmentI == 0) this.start 
            else this.segments[segmentI - 1]
        val end = this.segments[segmentI]
        return LinSpline.lerp(start, end, t)
    }

    fun segmentLength(segmentI: Int): Float {
        val end = this.segments[segmentI]
        val start = if(segmentI == 0) this.start
            else this.segments[segmentI - 1]
        return start.distance(end)
    }

    data class Point(var segmentI: Int = 0, var dist: Float = 0f)

    fun advancePoint(p: Point, dist: Float) {
        var remDist: Float = dist + p.dist
        p.dist = 0f
        while(p.segmentI < this.segments.size) {
            val segLen: Float = this.segmentLength(p.segmentI)
            if(segLen > remDist) {
                p.dist = remDist
                return 
            }
            remDist -= segLen
            p.segmentI += 1
        }
        p.segmentI = this.segments.size - 1
        p.dist = this.segmentLength(p.segmentI)
    }

    fun atPoint(p: Point): Vector3fc {
        val t: Float = p.dist / this.segmentLength(p.segmentI)
        return this.inSegment(p.segmentI, t)
    }

}
