# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack IoT smart home control system with multi-device integration (Philips Hue, Nanoleaf, SwitchBot), voice assistant, and local-first architecture (no cloud dependency).

## Commands

### Server (Express API - port 3001)
```bash
cd server
npm run dev              # Start with hot reload
npm test                 # Run tests (vitest)
npm run test:watch       # Watch mode testing
npm run db:generate      # Generate Prisma client
npm run db:push          # Sync schema with database
npm run db:migrate       # Create database migrations
npm run db:studio        # Open Prisma Studio UI
```

### Web App (React/Vite - port 5173)
```bash
cd web-app
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint checks
```

### Voice Assistant (Python/FastAPI - port 3002)
```bash
cd voice-assistant
uv sync                  # Install dependencies
uv sync --extra tts      # Include Text-to-Speech
uv sync --extra dev      # Include dev tools
uv run belle             # Start voice assistant
uv run pytest            # Run tests
uv run ruff format .     # Format code
uv run ruff check --fix  # Lint with fixes
```

### Service Management
```bash
docker compose up -d                    # Start PostgreSQL (port 5433)
./scripts/smart-home.sh start           # Start all services
./scripts/smart-home.sh stop            # Stop all services
./scripts/smart-home.sh logs <service>  # View service logs
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web App       │────▶│  Express API    │────▶│  PostgreSQL     │
│   React/Vite    │     │  Port 3001      │     │  Port 5433      │
│   Port 5173     │     └────────┬────────┘     └─────────────────┘
└─────────────────┘              │
                                 ├───▶ Philips Hue Bridge (local)
┌─────────────────┐              ├───▶ Nanoleaf (local API)
│  Voice Assistant│──────────────┘───▶ SwitchBot (cloud API)
│  FastAPI/MLX    │
│  Port 3002      │
└─────────────────┘
```

### Server (`server/src/`)
- **routes/** - HTTP route handlers for each device type and resource
- **services/** - Business logic and device API integrations (hue.ts, nanoleaf.ts, switchbot.ts)
- **types/** - Shared TypeScript interfaces
- **prisma/schema.prisma** - Database schema (Room, Device, DeviceGroup)

### Web App (`web-app/src/`)
- **components/** - React UI components (DeviceCard, RoomView, LightControl, etc.)
- **hooks/** - Custom hooks (useDevices, useRooms, useGroups, useVoiceAssistant)
- **services/api.ts** - Fetch wrapper for backend API

### Voice Assistant (`voice-assistant/src/belle/`)
- **main.py** - FastAPI entry point with WebSocket endpoint
- **stt.py** - Whisper speech-to-text
- **llm.py** - Qwen LLM for function calling
- **tools/** - Device/room/group control functions

## Key Patterns

### Unified Device Interface
All devices (Hue, Nanoleaf, SwitchBot) are normalized to a common `Light` interface with:
- `id`, `externalId`, `name`, `type`
- `state`: `{ on, brightness, color: { hue, saturation, lightness } }`
- `reachable`, `roomId`, `hidden`

### Service Layer Architecture
Routes handle HTTP concerns; services contain business logic and external API calls. Device state is synced to the database for room/group enrichment.

### Voice Assistant
- Uses MLX for local AI inference (Whisper STT, Qwen LLM)
- LLM function calling maps voice commands to device control
- WebSocket for real-time audio communication
- Bilingual: English and Portuguese

## Environment Variables

Server requires:
- `DATABASE_URL` - PostgreSQL connection string
- `HUE_BRIDGE_IP`, `HUE_USERNAME` - Philips Hue credentials
- `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET` - SwitchBot API credentials
- Nanoleaf devices configured via `/api/nanoleaf/authenticate`
