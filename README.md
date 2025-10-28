# linton_railway
A multiplayer browser party game about managing trains on a shared network.

### Running

To run the server simply execute `dotnet run`. This will run on `https://localhost:8443` and use a self-signed certificate generated using `keytool`, which your browser may warn you about. **DO NOT USE THIS CERTIFICATE IN PRODUCTION!**

### Proxies and Networks

The server uses client IP addresses to enforce rate limiting for room creation. This however requires the server to know the client IP address, even if it sits behind a proxy. Since the server can't blindly trust requests, known proxies and networks that can be trusted to correctly specify the `X-Forwarded-For`-header need to be specified in `appsettings.json` under the `"ForwardedHeaders"`-field:

```json
"ForwardedHeaders": {
    "KnownProxies": [
        "10.0.0.100", 
        "10.0.0.101"
    ],
    "KnownNetworks": [
        { "Prefix": "10.0.0.0", "PrefixLength": 8 }
    ]
}
```