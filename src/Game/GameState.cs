
using System.Collections.Concurrent;
using Newtonsoft.Json;

namespace Linton.Game;


public sealed class GameState
{

    [JsonProperty("regions")]
    public readonly RegionMap Regions;

    [JsonProperty("switches")]
    public readonly ConcurrentDictionary<TrackConnection, ushort> Switches
        = new();

    public GameState(int sizeT, TrackNetwork trackNetwork)
    {
        Regions = new RegionMap(sizeT, trackNetwork.Stations);
        // TODO: temporary for testing
        Random rng = new();
        for (int segI = 0; segI < trackNetwork.Segments.Count; segI += 1)
        {
            TrackSegment seg = trackNetwork.Segments[segI];
            if (seg.ConnectsLow.Count >= 2)
            {
                ushort i = (ushort)rng.Next(seg.ConnectsLow.Count);
                Switches[new TrackConnection(segI, false)] = i;
            }
            if (seg.ConnectsHigh.Count >= 2)
            {
                ushort i = (ushort)rng.Next(seg.ConnectsHigh.Count);
                Switches[new TrackConnection(segI, true)] = i;
            }
        }
    }

}