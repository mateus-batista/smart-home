import { Router } from 'express';
import * as switchbotService from '../services/switchbot.js';

const router = Router();

// Get all SwitchBot devices
router.get('/devices', async (req, res) => {
  try {
    if (!switchbotService.isConfigured()) {
      return res.status(503).json({ 
        error: 'SwitchBot not configured',
        code: 'NOT_CONFIGURED'
      });
    }

    const devices = await switchbotService.getAllDeviceStates();
    res.json(devices);
  } catch (error) {
    console.error('[SwitchBot] Error getting devices:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get device status
router.get('/devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id.replace('switchbot-', '');
    const status = await switchbotService.getDeviceStatus(deviceId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update device state
router.put('/devices/:id', async (req, res) => {
  try {
    await switchbotService.setDeviceState(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Send raw command to device
router.post('/devices/:id/command', async (req, res) => {
  try {
    const { command, parameter, commandType } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    const deviceId = req.params.id.replace('switchbot-', '');
    await switchbotService.sendCommand(deviceId, command, parameter, commandType);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Check configuration status
router.get('/status', (req, res) => {
  res.json({
    configured: switchbotService.isConfigured()
  });
});

export default router;
