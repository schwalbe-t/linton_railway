
namespace Linton.Server.Services;


public sealed class RoomUpdateService(ILogger<RoomUpdateService> logger) 
    : ScheduledService
{

    readonly ILogger<RoomUpdateService> _logger = logger;

    public override TimeSpan Interval => TimeSpan.FromMilliseconds(500);

    public override void Run()
    {
        Parallel.ForEach(RoomRegistry.Rooms, entry =>
        {
            try
            {
                entry.Value.Update();
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex, "Room {RoomId} threw an uncaught exception during state update!",
                    entry.Key
                );
                entry.Value.BroadcastRoomCrash();
                RoomRegistry.CloseRoom(entry.Key);
            }
        });
    }

}