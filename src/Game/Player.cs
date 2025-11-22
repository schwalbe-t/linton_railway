
using Newtonsoft.Json;

namespace Linton.Game;


public class Player(Guid id, string name)
{
    [JsonProperty("id")]
    public readonly Guid Id = id;
    
    [JsonProperty("name")]
    public readonly string Name = name;
    
    [JsonIgnore]
    public bool IsConnected = true;
}