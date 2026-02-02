import { useState, useEffect, useCallback } from 'react';
import type { Room } from '../types/devices';
import * as api from '../services/api';

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getRooms();
      setRooms(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const createRoom = useCallback(async (name: string) => {
    const room = await api.createRoom(name);
    setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)));
    return room;
  }, []);

  const updateRoom = useCallback(async (id: string, data: { name?: string }) => {
    const room = await api.updateRoom(id, data);
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? room : r)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return room;
  }, []);

  const deleteRoom = useCallback(async (id: string) => {
    await api.deleteRoom(id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const assignDeviceToRoom = useCallback(async (roomId: string, deviceExternalId: string) => {
    await api.assignDeviceToRoom(roomId, deviceExternalId);
    await fetchRooms();
  }, [fetchRooms]);

  const removeDeviceFromRoom = useCallback(async (roomId: string, deviceExternalId: string) => {
    await api.removeDeviceFromRoom(roomId, deviceExternalId);
    await fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    error,
    refresh: fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    assignDeviceToRoom,
    removeDeviceFromRoom,
  };
}
