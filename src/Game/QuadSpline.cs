
using System.Collections.Immutable;
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


/// <summary>
/// Represents a spline built using a chain of quadratic bezier curves.
/// </summary>
/// <param name="Start">the starting point</param>
/// <param name="Segments">the following segments</param>
public sealed record QuadSpline(
    [property: JsonProperty("start")] Vector3 Start,
    [property: JsonProperty("segments")] List<QuadSpline.Segment> Segments
)
{
    /// <summary>
    /// Represents a chained bezier curve in the spline.
    /// Each segment starts at the end point of the previous segment
    /// (or the start of the spline).
    /// </summary>
    /// <param name="Ctrl">the control point</param>
    /// <param name="To">the ending point of the segment</param>
    public sealed record Segment(
        [property: JsonProperty("ctrl")] Vector3 Ctrl,
        [property: JsonProperty("to")] Vector3 To
    );

    /// <summary>
    /// Returns a point along the spline.
    /// </summary>
    /// <param name="segmentI">the index of the segment</param>
    /// <param name="t">the progress along the segment</param>
    /// <returns>the point along the spline</returns>
    public Vector3 InSegment(int segmentI, float t)
    {
        if (segmentI < 0 || Segments.Count == 0) { return Start; }
        if (segmentI >= Segments.Count) { return Segments.Last().To; }
        Vector3 start = segmentI == 0 ? Start
            : Segments[segmentI - 1].To;
        Segment segment = Segments[segmentI];
        float u = 1f - t;
        return start * (u * u)
            + segment.Ctrl * (2f * u * t)
            + segment.To * (t * t);
    }

    /// <summary>
    /// Turns this quadratic bezier spline into a spline made of lines.
    /// </summary>
    /// <param name="numSegPoints">the number of points in each segment</param>
    /// <returns>the linear spline</returns>
    public LinSpline Tessellate(int numSegPoints)
    {
        float segPointDist = 1f / numSegPoints;
        int builtSegCount = Segments.Count * numSegPoints;
        List<Vector3> builtSegments = new(builtSegCount);
        for (int segI = 0; segI < Segments.Count; segI += 1)
        {
            for (int subSegI = 0; subSegI < numSegPoints; subSegI += 1)
            {
                float t = subSegI * segPointDist;
                builtSegments.Add(InSegment(segI, t));
            }
        }
        return new LinSpline(Start, builtSegments.ToImmutableList());
    }
}