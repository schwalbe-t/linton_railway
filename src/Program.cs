
using Linton.Server;
using Linton.Server.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;


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
app.UseExceptionHandler("/");
app.Use(async (context, next) =>
{
    switch (context.Request.Path)
    {
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
var physicalFileProvider = new PhysicalFileProvider(
    Path.Combine(builder.Environment.ContentRootPath, "wwwroot")
);
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".glsl"] = "text/plain";
contentTypeProvider.Mappings[".obj"] = "text/plain";
var staticFileOptions = new StaticFileOptions
{
    FileProvider = physicalFileProvider,
    ContentTypeProvider = contentTypeProvider,
    RequestPath = ""
};
if (app.Environment.IsDevelopment())
{
    physicalFileProvider.UseActivePolling = true;
    staticFileOptions.OnPrepareResponse = ctx =>
    {
        // disable browser caching
        #pragma warning disable ASP0015
        ctx.Context.Response.Headers["Cache-Control"] 
            = "no-cache, no-store, must-revalidate";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
        #pragma warning restore ASP0015
    };
}
app.UseStaticFiles(staticFileOptions);
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
app.Run();
