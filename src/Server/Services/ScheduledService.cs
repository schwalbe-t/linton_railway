
namespace Linton.Server.Services;


/// <summary>
/// Abstract service responsible for running a given method at a given interval
/// (or as fast as possible).
/// </summary>
public abstract class ScheduledService : BackgroundService
{
    
    public abstract TimeSpan Interval { get; }

    public abstract void Run();

    protected override async Task ExecuteAsync(CancellationToken stopToken)
    {
        while (!stopToken.IsCancellationRequested)
        {
            try
            {
                var startTime = DateTime.UtcNow;
                Run();
                var endTime = DateTime.UtcNow;
                TimeSpan timeTaken = endTime - startTime;
                if (timeTaken >= Interval) { continue; }
                TimeSpan waitTime = Interval - timeTaken;
                await Task.Delay(waitTime, stopToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception) { }
        }
    }

}
