
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

namespace Linton.Server;

public sealed class ForwardedHeadersConfig
{
    private ForwardedHeadersConfig() { }

    public void ConfigureForwardedHeaders(WebApplicationBuilder builder)
    {
        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor
                | ForwardedHeaders.XForwardedProto
        };
        var section = builder.Configuration.GetSection("ForwardedHeaders");
        foreach ()
    }
}