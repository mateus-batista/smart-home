# Smart Home Control

A full-stack IoT smart home control system with multi-device integration, voice assistant, and local-first architecture.

## Features

- Control Philips Hue lights (on/off, brightness, color, color temperature)
- Control Nanoleaf panels (on/off, brightness, color, effects)
- Control SwitchBot devices (lights, shades, curtains, blinds, plugs)
- Voice assistant (Belle) with speech-to-text and LLM-powered commands
  - Local inference via MLX (Whisper STT, Qwen LLM)
  - Cloud LLM providers (OpenAI, Anthropic) as optional alternatives
- Room and device group management
- Responsive design works on desktop and mobile
- Local-first — no cloud dependency for core device control

## Prerequisites

- Node.js 18+
- PostgreSQL (via Docker Compose)
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (for voice assistant)
- Philips Hue Bridge (for Hue devices)
- Nanoleaf panels connected to your local network
- SwitchBot Hub (for SwitchBot devices)

## Getting Started

### 1. Install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install web app dependencies
cd ../web-app
npm install
```

### 2. Start the server

```bash
cd server
npm run dev
```

The server will start on http://localhost:3001

### 3. Start the web app

In a separate terminal:

```bash
cd web-app
npm run dev
```

The web app will start on http://localhost:5173

### 4. Set up your devices

1. Open the web app in your browser
2. Follow the setup wizard to connect your devices:
   - **Philips Hue**: Click "Set up Philips Hue", select your bridge, press the link button on the bridge
   - **Nanoleaf**: Enter the device IP, put the device in pairing mode (hold power button 5-7 seconds), then connect

## API Endpoints

### General

- `GET /api/status` - Get configuration status
- `GET /api/devices` - Get all devices
- `PUT /api/devices/:id` - Update device state

### Philips Hue

- `GET /api/hue/discover` - Discover bridges on network
- `POST /api/hue/authenticate` - Authenticate with a bridge
- `GET /api/hue/lights` - Get all lights
- `PUT /api/hue/lights/:id` - Update light state
- `GET /api/hue/groups` - Get all groups (rooms)
- `PUT /api/hue/groups/:id` - Update group state

### Nanoleaf

- `GET /api/nanoleaf/devices` - Get all devices
- `POST /api/nanoleaf/authenticate` - Authenticate with a device
- `PUT /api/nanoleaf/:id/state` - Update device state
- `GET /api/nanoleaf/:id/effects` - Get available effects
- `PUT /api/nanoleaf/:id/effects` - Set effect

### SwitchBot

- `GET /api/switchbot/devices` - Get all devices
- `GET /api/switchbot/devices/:id` - Get device status
- `PUT /api/switchbot/devices/:id` - Update device state
- `POST /api/switchbot/devices/:id/command` - Send device command

### Voice Assistant

- `GET /health` - Health check
- `POST /transcribe` - Speech-to-text
- `POST /chat` - Text chat with Belle
- `POST /voice` - Full voice pipeline (STT → LLM → TTS)
- `WS /ws` - WebSocket for real-time voice interaction

## Device State Format

All device states use a normalized format:

```json
{
  "on": true,
  "brightness": 75,
  "color": {
    "hue": 180,
    "saturation": 100,
    "brightness": 75
  }
}
```

- `on`: boolean - Power state
- `brightness`: 0-100 - Brightness percentage
- `color.hue`: 0-360 - Color hue in degrees
- `color.saturation`: 0-100 - Color saturation percentage

## Project Structure

```
smart-home/
├── web-app/              # React + Vite + Tailwind frontend
│   └── src/
│       ├── components/     # UI components
│       ├── hooks/          # React hooks
│       ├── services/       # API client
│       └── utils/          # Utilities
├── server/               # Express + Prisma backend
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Device integrations (Hue, Nanoleaf, SwitchBot)
│       ├── prisma/         # Database schema
│       ├── types/          # TypeScript types
│       └── utils/          # Utilities
└── voice-assistant/      # Python FastAPI voice assistant
    └── src/belle/
        ├── main.py         # FastAPI entry point
        ├── stt.py          # Whisper speech-to-text
        ├── llm/            # LLM providers (local, OpenAI, Anthropic)
        ├── tools/          # Device/room/group control functions
        └── tts.py          # Text-to-speech (optional)
```

## Troubleshooting

### Server not connecting

Make sure the server is running on port 3001. Check the terminal for any error messages.

### Hue bridge not found

1. Ensure your Hue bridge is connected to the same network
2. Try discovering using https://discovery.meethue.com
3. Check your router's DHCP table for the bridge IP

### Nanoleaf not connecting

1. Make sure you've put the device in pairing mode (hold power button 5-7 seconds)
2. Verify the IP address is correct
3. Check that the device is on the same network

### SwitchBot not responding

1. Verify your `SWITCHBOT_TOKEN` and `SWITCHBOT_SECRET` are set in the server `.env`
2. Ensure the SwitchBot Hub is online and connected to the internet
3. Check that devices are linked to the hub in the SwitchBot app

### CORS errors

The backend server handles CORS. Make sure you're accessing the web app through the dev server (not opening the HTML file directly).
