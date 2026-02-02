# Smart Home Control

A simple web app to control your Philips Hue and Nanoleaf smart devices from your local network.

## Features

- Control Philips Hue lights (on/off, brightness, color)
- Control Nanoleaf panels (on/off, brightness, color, effects)
- Responsive design works on desktop and mobile
- Local network only - no cloud dependency

## Prerequisites

- Node.js 18+
- Philips Hue Bridge (for Hue devices)
- Nanoleaf panels connected to your local network

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
├── web-app/           # React + Vite + Tailwind frontend
│   └── src/
│       ├── components/  # UI components
│       ├── hooks/       # React hooks
│       ├── services/    # API client
│       └── types/       # TypeScript types
└── server/            # Express backend
    └── src/
        ├── routes/      # API routes
        ├── services/    # Device integrations
        ├── types/       # TypeScript types
        └── utils/       # Utilities
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

### CORS errors

The backend server handles CORS. Make sure you're accessing the web app through the dev server (not opening the HTML file directly).
