# Smart Home Web App

React-based dashboard for smart home control with voice assistant integration.

## Features

- **Device Control**: Turn lights on/off, adjust brightness, change colors
- **Room View**: See and control all devices in a room at once
- **Device Groups**: Control custom groups with one tap
- **Voice Assistant**: Talk to Belle for hands-free control
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Device states refresh automatically

## Requirements

- Node.js 18+
- Smart Home Server running on `localhost:3001`
- (Optional) Voice Assistant running on `localhost:3002`

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

The app connects to the backend API at `http://localhost:3001/api` by default.

To change the API URL, update `src/services/api.ts`:

```typescript
const API_BASE = 'http://your-server:3001/api';
```

## Usage

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
web-app/
├── src/
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles (Tailwind)
│   ├── components/          # React components
│   │   ├── DeviceCard.tsx   # Individual device control
│   │   ├── RoomView.tsx     # Room with all devices
│   │   ├── GroupCard.tsx    # Device group control
│   │   ├── LightControl.tsx # Brightness/color controls
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   ├── useDevices.ts    # Device state management
│   │   ├── useRooms.ts      # Room data fetching
│   │   ├── useGroups.ts     # Group management
│   │   └── useVoiceAssistant.ts  # Voice control
│   ├── services/
│   │   └── api.ts           # Backend API client
│   ├── types/               # TypeScript interfaces
│   └── utils/               # Helper functions
├── public/                  # Static assets
└── package.json
```

## Voice Assistant Integration

The app includes a voice assistant button that connects to the Belle voice assistant:

1. Click the microphone button
2. Speak your command (e.g., "Turn on the kitchen lights")
3. Belle responds with confirmation

Voice commands support both English and Portuguese.

### WebSocket Connection

The voice assistant uses WebSocket for real-time communication:

```typescript
// From useVoiceAssistant hook
const ws = new WebSocket('ws://localhost:3002/ws');

// Send audio
ws.send(JSON.stringify({
  type: 'audio',
  data: base64Audio,
  format: 'wav'
}));

// Receive response
ws.onmessage = (event) => {
  const { transcript, response, actions } = JSON.parse(event.data);
  // Update UI based on response
};
```

## Styling

The app uses Tailwind CSS v4 for styling. Global styles are in `src/index.css`.

### Color Scheme

- Dark theme optimized for low-light use
- Accent colors indicate device states (on/off)
- Smooth animations for state transitions

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **ESLint** - Code linting

## License

MIT
