import { Router } from 'express';
import * as groupsService from '../services/groups.js';
import { getDeviceByExternalId } from '../services/deviceSync.js';
import * as hueService from '../services/hue.js';
import * as nanoleafService from '../services/nanoleaf.js';
import * as switchbotService from '../services/switchbot.js';
import type { DeviceState } from '../types/index.js';

const router = Router();

// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await groupsService.getAllGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific group
router.get('/:id', async (req, res) => {
  try {
    const group = await groupsService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, roomId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const group = await groupsService.createGroup({ name, roomId });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a group
router.put('/:id', async (req, res) => {
  try {
    const group = await groupsService.updateGroup(req.params.id, req.body);
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete a group
router.delete('/:id', async (req, res) => {
  try {
    // Check if group exists first
    const group = await groupsService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    await groupsService.deleteGroup(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add a device to a group (by device external ID)
router.post('/:groupId/devices', async (req, res) => {
  try {
    const { deviceExternalId } = req.body;
    if (!deviceExternalId) {
      return res.status(400).json({ error: 'deviceExternalId is required' });
    }

    const device = await getDeviceByExternalId(deviceExternalId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await groupsService.addDeviceToGroup(req.params.groupId, device.id);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Remove a device from a group (by device external ID)
router.delete('/:groupId/devices/:deviceExternalId', async (req, res) => {
  try {
    const device = await getDeviceByExternalId(req.params.deviceExternalId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const result = await groupsService.removeDeviceFromGroup(req.params.groupId, device.id);
    if (!result) {
      return res.status(404).json({ error: 'Device is not in this group' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Control all devices in a group (set state)
router.put('/:id/state', async (req, res) => {
  try {
    const group = await groupsService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const state: Partial<DeviceState> = req.body;
    const results: { deviceId: string; success: boolean; error?: string }[] = [];

    // Control each device in the group
    for (const membership of group.devices) {
      const device = membership.device;
      try {
        if (device.type === 'hue') {
          // Extract the hue light ID from externalId (format: "hue-{id}")
          const hueId = device.externalId.replace('hue-', '');
          await hueService.setLightState(hueId, state);
          results.push({ deviceId: device.externalId, success: true });
        } else if (device.type === 'nanoleaf') {
          await nanoleafService.setDeviceState(device.externalId, state);
          results.push({ deviceId: device.externalId, success: true });
        } else if (device.type === 'switchbot') {
          await switchbotService.setDeviceState(device.externalId, state);
          results.push({ deviceId: device.externalId, success: true });
        }
      } catch (error) {
        results.push({
          deviceId: device.externalId,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
