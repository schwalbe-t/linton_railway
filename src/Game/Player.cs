
namespace Linton.Game;


public class Player(Guid id, string name)
{
    public readonly Guid Id = id;
    public readonly string Name = name;
    public bool IsConnected = true;
}