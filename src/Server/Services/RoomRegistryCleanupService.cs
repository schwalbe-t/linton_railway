
namespace Linton.Server.Services;


public sealed class RoomRegistryCleanupService(
    ILogger<RoomRegistryCleanupService> logger
) : ScheduledService
{

    readonly ILogger<RoomRegistryCleanupService> _logger = logger;

    public override TimeSpan Interval => TimeSpan.FromMinutes(5);

    public override void Run()
    {
        try
        {
            RoomRegistry.RunCleanup();
        }
        catch(Exception ex)
        {
            _logger.LogCritical(
                ex, "Cleanup service encountered uncaught exception!"
            );
        }
    }

}
