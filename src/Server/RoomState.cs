
using System.Collections.Concurrent;
using Linton.Game;

namespace Linton.Server;


/// <summary>
/// Represents the state that a room may be in at any point in time.
/// </summary>
public abstract class RoomState
{
    
    public abstract string TypeString { get; }

    public virtual void Update(Room room) { }


    /// <summary>
    /// Represents the room dying - this means that after some duration of
    /// time the room will be closed.
    /// Changes to 'Waiting' if any user connects.
    /// The default state of a room upon creation.
    /// </summary>
    public sealed class Dying : RoomState
    {
        public override string TypeString => "dying";

        public readonly DateTime Until = DateTime.UtcNow + Room.ClosureDelay;

        public override void Update(Room room)
        {
            if (room.Connected.Count == 0) { return; }
            room.State = new Waiting();
        }
    }


    /// <summary>
    /// Represents the room not being in a game and waiting for people to
    /// get ready.
    /// Changes to 'Dying' if all present users disconnect.
    /// Changes to 'Playing' if all present users get ready.
    /// </summary>
    public sealed class Waiting : RoomState
    {
        public override string TypeString => "waiting";

        readonly ConcurrentDictionary<Guid, bool> _ready = new();

        public override void Update(Room room)
        {
            if (room.Connected.Count == 0)
            {
                room.State = new Dying();
                return;
            }
            bool allReady = _ready.Values.All(r => r);
            if (!allReady) { return; }
            Dictionary<Guid, string> playing = room.Connected
                .ToDictionary(e => e.Key, e => e.Value.Name);
            var game = new GameInstance(playing);
            room.State = new Playing(game);
        }
    }


    /// <summary>
    /// Represents the room playing the game.
    /// Changes to 'Dying' if all present users disconnect.
    /// Changes to 'Waiting' if the game ends.
    /// </summary>
    /// <param name="game">the game that is being played</param>
    public sealed class Playing(GameInstance game) : RoomState
    {
        public override string TypeString => "playing";

        public readonly GameInstance Game = game;

        public override void Update(Room room)
        {
            if (room.Connected.Count == 0)
            {
                room.State = new Dying();
                return;
            }
            Game.Update();
            if (!Game.HasEnded) { return; }
            room.LastGameTime = DateTimeOffset.Now.ToUnixTimeMilliseconds();
            room.State = new Waiting();
        }
    }

}