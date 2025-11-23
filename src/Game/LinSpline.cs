
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


/// <summary>
/// Represents a spline made up of simple lines.
/// </summary>
/// <param name="Start">the starting point</param>
/// <param name="Segments">the following points</param>
public sealed record LinSpline(
    [property: JsonProperty("start")] Vector3 Start,
    [property: JsonProperty("segments")] List<Vector3> Segments
)
{
    /// <summary>
    /// Returns a point along the spline.
    /// </summary>
    /// <param name="segmentI">the index of the segment</param>
    /// <param name="t">the progress along the segment</param>
    /// <returns>the point along the spline</returns>
    public Vector3 InSegment(int segmentI, float t)
    {
        if (segmentI < 0 || Segments.Count == 0) { return Start; }
        if (segmentI >= Segments.Count) { return Segments.Last(); }
        Vector3 start = segmentI == 0 ? Start
            : Segments[segmentI - 1];
        Vector3 end = Segments[segmentI];
        return Vector3.Lerp(start, end, t);
    }

    /// <summary>
    /// Returns the concrete length of one of the segments of the spline.
    /// </summary>
    /// <param name="segmentI">the index of the segment</param>
    /// <returns>the euclidian length of the segment</returns>
    public float SegmentLength(int segmentI)
    {
        Vector3 start = segmentI == 0 ? Start
            : Segments[segmentI - 1];
        Vector3 end = Segments[segmentI];
        return Vector3.Distance(start, end);
    }

    /// <summary>
    /// Returns the coordinates of a point along the spline.
    /// </summary>
    public struct Point()
    {
        [JsonProperty("segmentI")]
        public int SegmentI = 0;
        [JsonProperty("dist")]
        public float Distance = 0f;
    }

    /// <summary>
    /// Advances the given point a given distance along the spline.
    /// </summary>
    /// <param name="point">the point along the spline</param>
    /// <param name="distance">the distance to advance the point by</param>
    /// <returns>the distance that was advanced</returns>
    public float AdvancePoint(ref Point point, float distance, out bool atEnd)
    {
        if (distance < 0f)
        {
            return ReversePoint(ref point, -distance, out atEnd);
        }
        atEnd = false;
        float remDist = point.Distance + distance;
        point.Distance = 0f;
        while (point.SegmentI < Segments.Count)
        {
            float segLen = SegmentLength(point.SegmentI);
            if (segLen > remDist)
            {
                point.Distance = remDist;
                return distance;
            }
            remDist -= segLen;
            point.SegmentI += 1;
        }
        point.SegmentI = Segments.Count - 1;
        point.Distance = SegmentLength(point.SegmentI);
        atEnd = true;
        return distance - remDist;
    }

    /// <summary>
    /// Decreases the distance along the spline of the given point by the
    /// a given distance. 
    /// </summary>
    /// <param name="point">the point along the spline</param>
    /// <param name="distance">the distance to reverse the point by</param>
    /// <returns>the distance that was reversed</returns>
    public float ReversePoint(ref Point point, float distance, out bool atEnd)
    {
        if (distance < 0f)
        {
            return AdvancePoint(ref point, -distance, out atEnd);
        }
        atEnd = false;
        if (distance <= point.Distance)
        {
            point.Distance -= distance;
            return distance;
        }
        float remDist = distance - point.Distance;
        point.Distance = 0f;
        while (point.SegmentI > 0)
        {
            point.SegmentI -= 1;
            float segLen = SegmentLength(point.SegmentI);
            if (segLen > remDist)
            {
                point.Distance = segLen - remDist;
                return distance;
            }
            remDist -= segLen;
        }
        atEnd = true;
        return distance - remDist;
    }

    /// <summary>
    /// Converts the given coordinate point along the spline to concrete
    /// euclidian coordinates.
    /// </summary>
    /// <param name="point">the point along the splint</param>
    /// <returns>the concrete point</returns>
    public Vector3 AtPoint(Point point)
    {
        float t = point.Distance / SegmentLength(point.SegmentI);
        return InSegment(point.SegmentI, t);
    }

    /// <summary>
    /// Computes the length of the spline by summing up the lengths of all
    /// segments.
    /// </summary>
    /// <returns>the total length of the spline</returns>
    public float ComputeLength()
    {
        float l = 0.0f;
        for (int segI = 0; segI < Segments.Count; segI += 1)
        {
            l += SegmentLength(segI);
        }
        return l;
    }
}