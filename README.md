# linton_railway
A multiplayer browser party game about managing trains on a shared network.

### Running

To run the server simply execute `./gradlew bootRun`. This will run on `https://localhost:8443` and use a self-signed certificate generated using `keytool`, which your browser may warn you about. **DO NOT USE THIS CERTIFICATE IN PRODUCTION!**

You may specify the following environment variables before running:
- `LINTON_PORT` - The port to run on (you'll most likely want `443`)
- `LINTON_KEYSTORE_PATH` - The path to the certificate keystore
- `LINTON_KEYSTORE_PASSWORD` - The password to the keystore
