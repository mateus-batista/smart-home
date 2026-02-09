import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import hueRoutes from './routes/hue.js';
import nanoleafRoutes from './routes/nanoleaf.js';
import switchbotRoutes from './routes/switchbot.js';
import roomsRoutes from './routes/rooms.js';
import groupsRoutes from './routes/groups.js';
import * as hueService from './services/hue.js';
import * as nanoleafService from './services/nanoleaf.js';
import * as switchbotService from './services/switchbot.js';
import { connectDatabase } from './services/database.js';
import { setDeviceHidden } from './services/deviceSync.js';
import { migrateConfig } from './utils/migrateConfig.js';
import { PollingManager } from './services/polling/index.js';
import { setupWebSocket, type WebSocketBroadcaster } from './services/websocket/index.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;


// Initialize polling manager (singleton)
const pollingManager = new PollingManager();
let wsBroadcaster: WebSocketBroadcaster;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/hue', hueRoutes);
app.use('/api/nanoleaf', nanoleafRoutes);
app.use('/api/switchbot', switchbotRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/groups', groupsRoutes);

// Combined endpoint to get all devices (returns cached state from polling)
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await pollingManager.getAllDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update any device by ID
app.put('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('hue-')) {
      await hueService.setLightState(id, req.body);
    } else if (id.startsWith('switchbot-')) {
      await switchbotService.setDeviceState(id, req.body);
      // Blind Tilt status API is unreliable — use optimistic state
      if (req.body.brightness !== undefined) {
        pollingManager.setOptimisticState(id, {
          brightness: req.body.brightness,
          on: req.body.brightness === 0,
        });
      }
    } else {
      await nanoleafService.setDeviceState(id, req.body);
    }

    // Trigger immediate refresh to update cached state
    pollingManager.triggerImmediateRefresh(id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Set device visibility (hidden status)
app.put('/api/devices/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { hidden } = req.body;

    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    await setDeviceHidden(id, hidden);
    res.json({ success: true, hidden });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const nanoleafDevices = await nanoleafService.getDevices();
  res.json({
    status: 'ok',
    hueConfigured: await hueService.isConfigured(),
    nanoleafDevices: nanoleafDevices.length,
    switchbotConfigured: switchbotService.isConfigured()
  });
});

// Status endpoint for setup
app.get('/api/status', async (req, res) => {
  const nanoleafDevices = await nanoleafService.getDevices();
  res.json({
    hue: {
      configured: await hueService.isConfigured()
    },
    nanoleaf: {
      configured: nanoleafDevices.length > 0,
      deviceCount: nanoleafDevices.length
    },
    switchbot: {
      configured: switchbotService.isConfigured()
    }
  });
});

// Start server with database connection
async function start() {
  try {
    await connectDatabase();

    // Migrate config from JSON to database if needed
    await migrateConfig();

    // Set up WebSocket support
    wsBroadcaster = setupWebSocket(server, pollingManager);

    const hueConfigured = await hueService.isConfigured();
    const nanoleafDevices = await nanoleafService.getDevices();

    server.listen(PORT, () => {
      console.log(`Smart Home server running on http://localhost:${PORT}`);
      console.log(`   Hue configured: ${hueConfigured}`);
      console.log(`   Nanoleaf devices: ${nanoleafDevices.length}`);
      console.log(`   SwitchBot configured: ${switchbotService.isConfigured()}`);
      console.log(`   Database: connected`);
      console.log(`   WebSocket: /ws/devices`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
