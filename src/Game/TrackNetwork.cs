
using System.Numerics;
using Newtonsoft.Json;

namespace Linton.Game;


/// <summary>
/// Points to either the low or high end of a track network segment.
/// This is used to convery direction.
/// The "low" end is the point represented by the 'start'-property of the
/// segment spline, and the "high" end is the point represented by the
/// last knot point of the segment spline.
/// </summary>
/// <param name="segmentIdx">the index of the segment</param>
/// <param name="toHighEnd">whether connects to high (T) or low end (F)</param>
public readonly struct TrackConnection(int segmentIdx, bool toHighEnd)
{
    [JsonProperty("segmentIdx")]
    public readonly int SegmentIdx = segmentIdx;
    [JsonProperty("toHighEnd")]
    public readonly bool ToHighEnd = toHighEnd;
}


/// <summary>
/// Represents a track network segment, which is a single track of arbitrary
/// length. It connects to any number of other track segments on either the
/// "low" end (the 'Start' point in the segment spline) or the "high" end
/// (the knot point with the highest index in the segment spline).
/// It may optionally belong to a specific platform of a train station.
/// An end that connects to no other segments represents the track exiting the
/// game world.
/// </summary>
/// <param name="QSpline">the raw spline representing the segment</param>
/// <param name="LSpline">the tessellated spline</param>
/// <param name="ConnectsLow">connections to other segments on low end</param>
/// <param name="ConnectsHigh">connections to other segments on high end</param>
/// <param name="StationIdx">the index of the station (none = -1)</param>
/// <param name="PlatformIdx">the index of the platform (none = -1)</param>
public sealed record TrackSegment(
    [property: JsonProperty("spline")] QuadSpline QSpline,
    [property: JsonIgnore] LinSpline LSpline,
    [property: JsonProperty("connectsLow")] List<TrackConnection> ConnectsLow,
    [property: JsonProperty("connectsHigh")] List<TrackConnection> ConnectsHigh,
    [property: JsonIgnore] int StationIdx = -1,
    [property: JsonIgnore] int PlatformIdx = -1
)
{
    /// <summary>
    /// The point at the low end of the segment.
    /// (Equal to the 'Start' point of the spline) 
    /// </summary>
    [JsonIgnore]
    public Vector3 LowEnd => QSpline.Start;
    /// <summary>
    /// The point at the high end of the segment.
    /// (Equal to the knot point of the spline with the highest index)
    /// </summary>
    [JsonIgnore]
    public Vector3 HighEnd => QSpline.Segments.Last().To;
}


/// <summary>
/// Represents all state associated with a train station.
/// All track track segments whose start and end points are within
/// (or on the boundary of) the given region
/// (min is lowest, max is highest point in units) are automatically assigned
/// a platform in the station.
/// Can hold one train per platform.
/// </summary>
public sealed class TrackStation(Vector3 minPos, Vector3 maxPos)
{
    [JsonProperty("minPos")]
    public readonly Vector3 MinPos = minPos;
    [JsonProperty("maxPos")]
    public readonly Vector3 MaxPos = maxPos;
    [JsonIgnore]
    public List<Train?> Platforms = new();

    /// <summary>
    /// Returns whether the given point is within (or on the edge of) the
    /// station boundary.
    /// </summary>
    /// <param name="p">the point to check</param>
    /// <returns>whether the point is inside the station boundary</returns>
    public bool ContainsPos(Vector3 p)
        => MinPos.X <= p.X && MinPos.Z <= p.Z
        && p.X <= MaxPos.X && p.Z <= MaxPos.Z;
}


/// <summary>
/// Represents all tracks and associated state of a world's track network.
/// </summary>
public sealed class TrackNetwork
{

    /// <summary>
    /// A list of all stations on the network.
    /// </summary>
    [JsonProperty("stations")]
    public readonly List<TrackStation> Stations;

    /// <summary>
    /// A list of all segments on the network.
    /// </summary>
    [JsonProperty("segments")]
    public readonly List<TrackSegment> Segments;

    /// <summary>
    /// Maps a point in the world to any segments whose "low" or "high"
    /// endings are located at that same point.
    /// </summary>
    [JsonProperty("endings")]
    public readonly Dictionary<Vector3, List<TrackConnection>> Endings = new();

    /// <summary>
    /// A list of all ways to enter the network.
    /// </summary>
    [JsonIgnore]
    public readonly List<TrackConnection> Entrances = new();

    /// <summary>
    /// Returns a list of all "low" or "high" endings of any track segments
    /// at the given point. If the point is not a key inside of 'Endings',
    /// a new list is inserted into the dictionary.
    /// </summary>
    /// <param name="p">the point to look up</param>
    /// <returns>all segment endings at that location</returns>
    public List<TrackConnection> FindEndings(Vector3 p)
    {
        if (Endings.GetValueOrDefault(p) is List<TrackConnection> ec)
        {
            return ec;
        }
        var nc = new List<TrackConnection>();
        Endings.Add(p, nc);
        return nc;
    }

    /// <summary>
    /// The resolution of the server-side tessellation applied to track
    /// segment splines.
    /// </summary>
    public const int SEGMENT_RESOLUTION = 5;

    /// <summary>
    /// Returns a track segment (without any connections) that represents
    /// the given quad spline.
    /// </summary>
    /// <param name="spline">the spline</param>
    /// <returns>the equivalent segment</returns>
    TrackSegment BuildSegment(QuadSpline spline)
    {
        Vector3 low = spline.Start;
        Vector3 high = spline.Segments.Last().To;
        int stationIdx = Stations
            .FindIndex(s => s.ContainsPos(low) && s.ContainsPos(high));
        int platformIdx = -1;
        if (stationIdx != -1)
        {
            TrackStation station = Stations[stationIdx];
            platformIdx = station.Platforms.Count;
            station.Platforms.Add(null);
        }
        return new TrackSegment(
            QSpline: spline, LSpline: spline.Tessellate(SEGMENT_RESOLUTION),
            ConnectsLow: [], ConnectsHigh: [],
            StationIdx: stationIdx, PlatformIdx: platformIdx
        );
    }

    /// <summary>
    /// Adds the high and low endings of the given track segment to the
    /// track network endings dictionary.
    /// </summary>
    /// <param name="segment">the segment</param>
    /// <param name="segmentIdx">the segment index</param>
    void BuildEndings(TrackSegment segment, int segmentIdx)
    {
        FindEndings(segment.LowEnd).Add(new TrackConnection(segmentIdx, false));
        FindEndings(segment.HighEnd).Add(new TrackConnection(segmentIdx, true));
    }

    /// <summary>
    /// Populates the "low" and "high" connections lists of the given
    /// segment.
    /// </summary>
    /// <param name="segment">the segment</param>
    /// <param name="segmentIdx">the segment index</param>
    void FindConnections(TrackSegment segment, int segmentIdx)
    {
        segment.ConnectsLow.AddRange(
            FindEndings(segment.LowEnd).Where(c => c.SegmentIdx != segmentIdx)
        );
        segment.ConnectsHigh.AddRange(
            FindEndings(segment.HighEnd).Where(c => c.SegmentIdx != segmentIdx)
        );
    }

    /// <summary>
    /// Constructs a new track network.
    /// </summary>
    /// <param name="splines">the segment splines</param>
    /// <param name="stations">the stations</param>
    /// <param name="entrances">positions of entrances</param>
    public TrackNetwork(
        List<QuadSpline> splines, List<TrackStation> stations,
        List<Vector3> entrances
    )
    {
        Stations = stations;
        Segments = splines.Select(BuildSegment).ToList();
        for (int segmentIdx = 0; segmentIdx < Segments.Count; segmentIdx += 1)
        {
            BuildEndings(Segments[segmentIdx], segmentIdx);
        }
        for (int segmentIdx = 0; segmentIdx < Segments.Count; segmentIdx += 1)
        {
            FindConnections(Segments[segmentIdx], segmentIdx);
        }
        entrances.ForEach(e => Entrances.AddRange(FindEndings(e)));
    }

}