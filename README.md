# linton_railway
A multiplayer browser party game about managing trains on a shared network.

### Running

To run the server simply execute `dotnet run`. This will run on `https://localhost:8443` and use a self-signed certificate generated using `keytool`, which your browser may warn you about. **DO NOT USE THIS CERTIFICATE IN PRODUCTION!**

### Proxies and Networks

The server uses client IP addresses to enforce rate limiting for room creation. This however requires the server to know the client IP address, even if it sits behind a proxy. However, when the server sits behind a proxy the direct remote address of each request is the address of the proxy, which is obviously not what we need.

The server can use the `X-Forwarded-For`-header to get client IP addresses even if it does sit behind a proxy, but **this should only be enabled if the server actually sits behind a proxy**. To enable this safely the server **must not be directly publically reachable** apart from through a known and safe proxy. This would otherwise allow malicious users to modify the header to give themselves an invalid IP address.

To enable the usage of these headers to determine the client IP address when running the server behind a safe and known proxy, set the `"UseForwardedHeaders"` in `appsettings.json` to `true` or specify the `UseForwardedHeaders` environment variable to be `true`.