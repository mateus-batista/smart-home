import { Router } from 'express';
import * as nanoleafService from '../services/nanoleaf.js';

const router = Router();

// Get all configured devices
router.get('/devices', async (req, res) => {
  try {
    const devices = await nanoleafService.getAllDeviceStates();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Authenticate with a device
router.post('/authenticate', async (req, res) => {
  try {
    const { ip, name } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'ip is required' });
    }

    const device = await nanoleafService.authenticate(ip, name);
    res.json({ success: true, device });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('pairing mode')) {
      return res.status(428).json({
        error: message,
        code: 'NOT_IN_PAIRING_MODE'
      });
    }
    res.status(500).json({ error: message });
  }
});

// Get a specific device state
router.get('/:id', async (req, res) => {
  try {
    const device = await nanoleafService.getDeviceState(req.params.id);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update device state
router.put('/:id/state', async (req, res) => {
  try {
    await nanoleafService.setDeviceState(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get available effects
router.get('/:id/effects', async (req, res) => {
  try {
    const effects = await nanoleafService.getEffects(req.params.id);
    const currentEffect = await nanoleafService.getCurrentEffect(req.params.id);
    res.json({ effects, currentEffect });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Set effect
router.put('/:id/effects', async (req, res) => {
  try {
    const { effect } = req.body;
    if (!effect) {
      return res.status(400).json({ error: 'effect is required' });
    }

    await nanoleafService.setEffect(req.params.id, effect);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Identify device (flash lights)
router.post('/:id/identify', async (req, res) => {
  try {
    await nanoleafService.identify(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Remove a device
router.delete('/:id', async (req, res) => {
  try {
    const removed = await nanoleafService.removeDevice(req.params.id);
    if (removed) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Device not found' });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
