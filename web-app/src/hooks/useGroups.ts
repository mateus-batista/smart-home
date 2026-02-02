import { useState, useEffect, useCallback } from 'react';
import type { DeviceGroup, DeviceState } from '../types/devices';
import * as api from '../services/api';

export function useGroups() {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = useCallback(async (name: string, roomId?: string | null) => {
    const group = await api.createGroup(name, roomId);
    setGroups((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
    return group;
  }, []);

  const updateGroup = useCallback(async (id: string, data: { name?: string; roomId?: string | null }) => {
    const group = await api.updateGroup(id, data);
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? group : g)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return group;
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    await api.deleteGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addDeviceToGroup = useCallback(async (groupId: string, deviceExternalId: string) => {
    await api.addDeviceToGroup(groupId, deviceExternalId);
    await fetchGroups();
  }, [fetchGroups]);

  const removeDeviceFromGroup = useCallback(async (groupId: string, deviceExternalId: string) => {
    await api.removeDeviceFromGroup(groupId, deviceExternalId);
    await fetchGroups();
  }, [fetchGroups]);

  const setGroupState = useCallback(async (groupId: string, state: Partial<DeviceState>) => {
    return api.setGroupState(groupId, state);
  }, []);

  return {
    groups,
    loading,
    error,
    refresh: fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addDeviceToGroup,
    removeDeviceFromGroup,
    setGroupState,
  };
}
