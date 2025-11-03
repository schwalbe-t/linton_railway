
namespace Linton.Server.Services;


public sealed class SessionRegistryCleanupService(
    ILogger<SessionRegistryCleanupService> logger
) : ScheduledService
{

    readonly ILogger<SessionRegistryCleanupService> _logger = logger;

    public override TimeSpan Interval => TimeSpan.FromMinutes(10);

    public override void Run()
    {
        try
        {
            SessionRegistry.RunCleanup();
        }
        catch(Exception ex)
        {
            _logger.LogCritical(
                ex, "Session cleanup service encountered uncaught exception!"
            );
        }
    }

}
