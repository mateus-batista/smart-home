import { Router } from 'express';
import * as hueService from '../services/hue.js';

const router = Router();

// Check if Hue is configured
router.get('/status', async (req, res) => {
  res.json({ configured: await hueService.isConfigured() });
});

// Discover bridges on the network
router.get('/discover', async (req, res) => {
  try {
    const bridges = await hueService.discoverBridges();
    res.json(bridges);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Authenticate with a bridge (user must press bridge button first)
router.post('/authenticate', async (req, res) => {
  try {
    const { bridgeIp } = req.body;
    if (!bridgeIp) {
      return res.status(400).json({ error: 'bridgeIp is required' });
    }

    const username = await hueService.createUser(bridgeIp);
    res.json({ success: true, username });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('link button')) {
      return res.status(428).json({ 
        error: 'Please press the link button on the Hue bridge and try again',
        code: 'LINK_BUTTON_NOT_PRESSED'
      });
    }
    res.status(500).json({ error: message });
  }
});

// Get all lights
router.get('/lights', async (req, res) => {
  try {
    const lights = await hueService.getLights();
    res.json(lights);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific light
router.get('/lights/:id', async (req, res) => {
  try {
    const light = await hueService.getLight(req.params.id);
    res.json(light);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update light state
router.put('/lights/:id', async (req, res) => {
  try {
    await hueService.setLightState(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all groups (rooms)
router.get('/groups', async (req, res) => {
  try {
    const groups = await hueService.getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update group state
router.put('/groups/:id', async (req, res) => {
  try {
    await hueService.setGroupState(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
