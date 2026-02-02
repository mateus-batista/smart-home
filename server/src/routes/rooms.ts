import { Router } from 'express';
import * as roomsService from '../services/rooms.js';
import { assignDeviceToRoomByExternalId, getDevicesByRoom } from '../services/deviceSync.js';

const router = Router();

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await roomsService.getAllRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific room
router.get('/:id', async (req, res) => {
  try {
    const room = await roomsService.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get devices in a room
router.get('/:id/devices', async (req, res) => {
  try {
    const devices = await getDevicesByRoom(req.params.id);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const room = await roomsService.createRoom({ name });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a room
router.put('/:id', async (req, res) => {
  try {
    const room = await roomsService.updateRoom(req.params.id, req.body);
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete a room
router.delete('/:id', async (req, res) => {
  try {
    await roomsService.deleteRoom(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Assign a device to a room (by device external ID)
router.put('/:roomId/devices/:deviceExternalId', async (req, res) => {
  try {
    await assignDeviceToRoomByExternalId(req.params.deviceExternalId, req.params.roomId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Remove a device from a room (set room to null)
router.delete('/:roomId/devices/:deviceExternalId', async (req, res) => {
  try {
    await assignDeviceToRoomByExternalId(req.params.deviceExternalId, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
