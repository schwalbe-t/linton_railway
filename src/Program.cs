
var builder = WebApplication.CreateBuilder(args);
builder.Services
    .AddControllers()
    .AddNewtonsoftJson();
var app = builder.Build();
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
app.MapControllers();
app.Run();
