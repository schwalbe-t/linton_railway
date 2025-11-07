
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


public sealed class TrackNetwork
{

    public sealed record Connection(
        [property: JsonProperty("segmentIdx")] int SegmentIdx,
        [property: JsonProperty("isHigh")] bool IsHigh
    );

    public sealed record Segment(
        [property: JsonProperty("spline")] QuadSpline QSpline,
        [property: JsonIgnore] LinSpline LSpline,
        [property: JsonProperty("connectsLow")] List<Connection> ConnectsLow,
        [property: JsonProperty("connectsHigh")] List<Connection> ConnectsHigh
    );

    [JsonProperty("segments")]
    readonly List<Segment> _segments = new();

    [JsonProperty("endings")]
    readonly Dictionary<Vector3, List<Connection>> _endings = new();

    const int SEGMENT_RESOLUTION = 5;

    public List<Connection> FindEndings(Vector3 p)
    {
        if (_endings.GetValueOrDefault(p) is List<Connection> ec) { return ec; }
        var nc = new List<Connection>();
        _endings.Add(p, nc);
        return nc;
    }

    static List<Segment> BuildSegments(List<QuadSpline> splines)
        => splines.Select(
            s => new Segment(s, s.Tessellate(SEGMENT_RESOLUTION), [], [])
        )
        .ToList();

    void BuildEndings(Segment segment, int segmentIdx)
    {
        var low = segment.QSpline.Start;
        FindEndings(low).Add(new Connection(segmentIdx, IsHigh: false));
        var high = segment.QSpline.Segments.Last().To;
        FindEndings(high).Add(new Connection(segmentIdx, IsHigh: true));
    }

    void FindConnections(Segment segment, int segmentIdx)
    {
        var low = segment.QSpline.Start;
        segment.ConnectsLow.AddRange(
            FindEndings(low).Where(c => c.SegmentIdx != segmentIdx)
        );
        var high = segment.QSpline.Segments.Last().To;
        segment.ConnectsHigh.AddRange(
            FindEndings(high).Where(c => c.SegmentIdx != segmentIdx)
        );
    }

    public TrackNetwork(List<QuadSpline> splines)
    {
        _segments = BuildSegments(splines);
        for (int segmentIdx = 0; segmentIdx < _segments.Count; segmentIdx += 1)
        {
            BuildEndings(_segments[segmentIdx], segmentIdx);
        }
        for (int segmentIdx = 0; segmentIdx < _segments.Count; segmentIdx += 1)
        {
            FindConnections(_segments[segmentIdx], segmentIdx);
        }
    }

}