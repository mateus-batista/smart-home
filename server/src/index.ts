import express from 'express';
import cors from 'cors';
import hueRoutes from './routes/hue.js';
import nanoleafRoutes from './routes/nanoleaf.js';
import switchbotRoutes from './routes/switchbot.js';
import roomsRoutes from './routes/rooms.js';
import groupsRoutes from './routes/groups.js';
import * as hueService from './services/hue.js';
import * as nanoleafService from './services/nanoleaf.js';
import * as switchbotService from './services/switchbot.js';
import { connectDatabase } from './services/database.js';
import { syncDevices, getDevicesFromDb, setDeviceHidden } from './services/deviceSync.js';
import { migrateConfig } from './utils/migrateConfig.js';
import type { Light } from './types/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/hue', hueRoutes);
app.use('/api/nanoleaf', nanoleafRoutes);
app.use('/api/switchbot', switchbotRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/groups', groupsRoutes);

// Combined endpoint to get all devices
app.get('/api/devices', async (req, res) => {
  try {
    const devices: Light[] = [];

    // Get Hue lights if configured
    if (await hueService.isConfigured()) {
      try {
        const hueLights = await hueService.getLights();
        devices.push(...hueLights);
      } catch (error) {
        console.error('Error fetching Hue lights:', error);
      }
    }

    // Get Nanoleaf devices
    try {
      const nanoleafDevices = await nanoleafService.getAllDeviceStates();
      devices.push(...nanoleafDevices);
    } catch (error) {
      console.error('Error fetching Nanoleaf devices:', error);
    }

    // Get SwitchBot devices if configured
    if (switchbotService.isConfigured()) {
      try {
        const switchbotDevices = await switchbotService.getAllDeviceStates();
        devices.push(...switchbotDevices);
      } catch (error) {
        console.error('Error fetching SwitchBot devices:', error);
      }
    }

    // Sync devices to database (upsert)
    if (devices.length > 0) {
      try {
        await syncDevices(devices);
      } catch (error) {
        console.error('Error syncing devices to database:', error);
      }
    }

    // Fetch devices from DB to include room/group info
    try {
      const dbDevices = await getDevicesFromDb();
      const dbDeviceMap = new Map(dbDevices.map(d => [d.externalId, d]));

      // Merge DB data with live device data
      const enrichedDevices = devices.map(device => {
        const dbDevice = dbDeviceMap.get(device.id);
        return {
          ...device,
          roomId: dbDevice?.roomId ?? null,
          roomName: dbDevice?.room?.name ?? null,
          hidden: dbDevice?.hidden ?? false,
          groups: dbDevice?.groups?.map(g => ({
            id: g.group.id,
            name: g.group.name,
          })) ?? [],
        };
      });

      res.json(enrichedDevices);
    } catch (error) {
      console.error('Error fetching DB device data:', error);
      // Fall back to devices without room/group info
      res.json(devices.map(d => ({ ...d, roomId: null, roomName: null, hidden: false, groups: [] })));
    }
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
    } else {
      await nanoleafService.setDeviceState(id, req.body);
    }

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

    const hueConfigured = await hueService.isConfigured();
    const nanoleafDevices = await nanoleafService.getDevices();

    app.listen(PORT, () => {
      console.log(`Smart Home server running on http://localhost:${PORT}`);
      console.log(`   Hue configured: ${hueConfigured}`);
      console.log(`   Nanoleaf devices: ${nanoleafDevices.length}`);
      console.log(`   SwitchBot configured: ${switchbotService.isConfigured()}`);
      console.log(`   Database: connected`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
