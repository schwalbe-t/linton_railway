
using Newtonsoft.Json;

namespace Linton.Game;


public sealed class GameState
{

    [JsonProperty("regions")]
    public readonly RegionMap Regions;

    public GameState(int sizeT, TrackNetwork trackNetwork)
    {
        Regions = new RegionMap(sizeT, trackNetwork.Stations);
    }

}