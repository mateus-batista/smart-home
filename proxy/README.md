# Smart Home HTTPS Proxy

A reverse proxy that enables HTTPS access to the Smart Home services, required for mobile microphone access.

## Setup

```bash
cd proxy
npm install
npm run generate-certs  # Or certs are auto-generated on first run
```

## Usage

1. Start all services first:
   - `server/` on port 3001
   - `voice-assistant/` on port 3002
   - `web-app/` on port 5173

2. Start the proxy:
   ```bash
   npm start
   ```

3. Access from any device:
   - **Desktop**: https://localhost or https://192.168.x.x
   - **Mobile**: https://192.168.x.x

4. Accept the self-signed certificate warning in your browser

## Routes

| Path | Destination |
|------|-------------|
| `/api/*` | http://localhost:3001 (Smart Home Server) |
| `/ws` | ws://localhost:3002 (Voice Assistant WebSocket) |
| `/*` | http://localhost:5173 (Web App) |

## Configuration

Environment variables:
- `PROXY_PORT` - HTTPS port (default: 443)
- `WEB_APP_URL` - Web app URL (default: http://localhost:5173)
- `SERVER_URL` - Server URL (default: http://localhost:3001)
- `VOICE_ASSISTANT_URL` - Voice assistant URL (default: http://localhost:3002)

## Note

Port 443 requires sudo on macOS. To use a different port:
```bash
PROXY_PORT=8443 npm start
```
Then access via https://192.168.x.x:8443
