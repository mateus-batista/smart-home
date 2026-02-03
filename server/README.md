# Smart Home Server

Express.js API server for smart home device control with multi-device integration.

## Features

- **Unified Device API**: Single interface for Philips Hue, Nanoleaf, and SwitchBot devices
- **Room Management**: Organize devices into rooms for group control
- **Device Groups**: Create custom groups for scenes and automation
- **Real-time Sync**: Device states synced to PostgreSQL for fast queries
- **Local-First**: Direct communication with local devices (no cloud dependency for Hue/Nanoleaf)

## Requirements

- Node.js 18+
- PostgreSQL (via Docker or local install)
- Device bridges/hubs on local network

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Start PostgreSQL (if using Docker)
docker compose up -d

# Push database schema
npm run db:push
```

## Configuration

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/smart_home"

# Philips Hue
HUE_BRIDGE_IP=192.168.1.x
HUE_USERNAME=your-hue-username

# SwitchBot (optional)
SWITCHBOT_TOKEN=your-token
SWITCHBOT_SECRET=your-secret
```

### Getting Hue Credentials

1. Find your bridge IP at https://discovery.meethue.com/
2. Press the link button on your Hue bridge
3. POST to `http://<bridge-ip>/api` with `{"devicetype": "smart-home#server"}`
4. Use the returned username in `HUE_USERNAME`

### Nanoleaf Setup

Nanoleaf devices are configured per-device via the API:

```bash
# Hold power button for 5-7 seconds until LED flashes
curl -X POST http://localhost:3001/api/nanoleaf/authenticate \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.x", "name": "Living Room Panels"}'
```

## Usage

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start

# Run tests
npm test
npm run test:watch
```

## API Endpoints

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:id` | Get device by ID |
| PUT | `/api/devices/:id` | Update device state |

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List all rooms with devices |
| POST | `/api/rooms` | Create a room |
| PUT | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Delete room |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Create a group |
| PUT | `/api/groups/:id/state` | Control all devices in group |
| DELETE | `/api/groups/:id` | Delete group |

### Device-Specific

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hue/lights` | List Hue lights |
| POST | `/api/hue/sync` | Sync Hue devices to database |
| GET | `/api/nanoleaf/devices` | List Nanoleaf devices |
| POST | `/api/nanoleaf/authenticate` | Add new Nanoleaf device |
| GET | `/api/switchbot/devices` | List SwitchBot devices |

## Device State Format

All devices use a unified state format:

```json
{
  "id": "uuid",
  "externalId": "hue-1",
  "name": "Kitchen Light",
  "type": "light",
  "manufacturer": "hue",
  "state": {
    "on": true,
    "brightness": 75,
    "color": {
      "hue": 180,
      "saturation": 50,
      "lightness": 50
    },
    "colorTemp": 4000
  },
  "reachable": true,
  "roomId": "room-uuid"
}
```

## Project Structure

```
server/
├── src/
│   ├── index.ts          # Express app entry point
│   ├── routes/           # HTTP route handlers
│   │   ├── hue.ts        # Philips Hue endpoints
│   │   ├── nanoleaf.ts   # Nanoleaf endpoints
│   │   ├── switchbot.ts  # SwitchBot endpoints
│   │   ├── rooms.ts      # Room management
│   │   └── groups.ts     # Group management
│   ├── services/         # Business logic
│   │   ├── hue.ts        # Hue API integration
│   │   ├── nanoleaf.ts   # Nanoleaf API integration
│   │   └── switchbot.ts  # SwitchBot API integration
│   └── types/            # TypeScript interfaces
├── prisma/
│   └── schema.prisma     # Database schema
└── package.json
```

## Database Commands

```bash
npm run db:generate   # Generate Prisma client after schema changes
npm run db:push       # Push schema to database (dev)
npm run db:migrate    # Create migration (production)
npm run db:studio     # Open Prisma Studio GUI
```

## License

MIT
