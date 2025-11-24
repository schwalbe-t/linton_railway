
using Newtonsoft.Json;

namespace Linton.Game;


public class Player(Guid id, string name)
{
    [JsonProperty("id")]
    public readonly Guid Id = id;
    
    [JsonProperty("name")]
    public readonly string Name = name;
    
    [JsonIgnore]
    readonly Lock _lock = new();

    [JsonIgnore]
    bool _isConnected = true;
    [JsonIgnore]
    public bool IsConnected
    {
        get { lock (_lock) { return _isConnected; } }
        set { lock (_lock) { _isConnected = value; } }
    }

    [JsonIgnore]
    int _numPoints = 0;
    [JsonIgnore]
    public int NumPoints
    {
        get { lock (_lock) { return _numPoints; } }
        set { lock (_lock) { _numPoints = value; } }
    }

    public int IncrementPoints(int n)
    {
        lock (_lock)
        {
            _numPoints += n;
            return _numPoints;
        }
    }

}