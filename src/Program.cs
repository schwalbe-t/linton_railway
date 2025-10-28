
using Linton.Server;
using Linton.Server.Services;
using Microsoft.AspNetCore.HttpOverrides;


var builder = WebApplication.CreateBuilder(args);
bool useForwardedHeaders = builder.Configuration
    .GetValue<bool>("UseForwardedHeaders");
if (useForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor 
            | ForwardedHeaders.XForwardedProto;
    });

}
builder.Services.AddControllers()
    .AddNewtonsoftJson();
builder.Services.AddHostedService<RoomUpdateService>();
builder.Services.AddHostedService<RoomRegistryCleanupService>();

var app = builder.Build();
app.UseWebSockets();
var roomSocketController = new RoomSocketController(
    app.Services.GetRequiredService<ILogger<RoomSocketController>>()
);
app.Map("/ws/room", roomSocketController.TryCreateConnection);
if (useForwardedHeaders)
{
    app.UseForwardedHeaders();
}
app.MapControllers();
app.Use(async (context, next) =>
{
    switch(context.Request.Path) {
        case "/":
        case "/join":
            context.Request.Path = "/index.html";
            break;
        case "/room":
            context.Request.Path = "/room.html";
            break;
    }
    await next();
});
app.UseStaticFiles();
app.Run();
