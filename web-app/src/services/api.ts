import type { Light, DeviceState, HueBridge, ApiStatus, EffectsResponse, NanoleafDeviceConfig, Room, DeviceGroup } from '../types/devices';

// Use environment variable if set, otherwise fall back to relative URL (Vite proxy)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Status & Health
export async function getStatus(): Promise<ApiStatus> {
  return fetchApi<ApiStatus>('/status');
}

export async function getHealth(): Promise<{ status: string; hueConfigured: boolean; nanoleafDevices: number }> {
  return fetchApi('/health');
}

// All Devices
export async function getAllDevices(): Promise<Light[]> {
  return fetchApi<Light[]>('/devices');
}

export async function updateDevice(id: string, state: Partial<DeviceState>): Promise<void> {
  await fetchApi(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function setDeviceVisibility(id: string, hidden: boolean): Promise<void> {
  await fetchApi(`/devices/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ hidden }),
  });
}

// Hue
export async function discoverHueBridges(): Promise<HueBridge[]> {
  return fetchApi<HueBridge[]>('/hue/discover');
}

export async function authenticateHue(bridgeIp: string): Promise<{ success: boolean; username: string }> {
  return fetchApi('/hue/authenticate', {
    method: 'POST',
    body: JSON.stringify({ bridgeIp }),
  });
}

export async function getHueLights(): Promise<Light[]> {
  return fetchApi<Light[]>('/hue/lights');
}

export async function updateHueLight(id: string, state: Partial<DeviceState>): Promise<void> {
  await fetchApi(`/hue/lights/${id}`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function getHueGroups(): Promise<Array<{ id: string; name: string; lights: string[] }>> {
  return fetchApi('/hue/groups');
}

export async function updateHueGroup(id: string, state: Partial<DeviceState>): Promise<void> {
  await fetchApi(`/hue/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

// Nanoleaf
export async function getNanoleafDevices(): Promise<Light[]> {
  return fetchApi<Light[]>('/nanoleaf/devices');
}

export async function authenticateNanoleaf(ip: string, name?: string): Promise<{ success: boolean; device: NanoleafDeviceConfig }> {
  return fetchApi('/nanoleaf/authenticate', {
    method: 'POST',
    body: JSON.stringify({ ip, name }),
  });
}

export async function updateNanoleafDevice(id: string, state: Partial<DeviceState>): Promise<void> {
  await fetchApi(`/nanoleaf/${id}/state`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export async function getNanoleafEffects(id: string): Promise<EffectsResponse> {
  return fetchApi<EffectsResponse>(`/nanoleaf/${id}/effects`);
}

export async function setNanoleafEffect(id: string, effect: string): Promise<void> {
  await fetchApi(`/nanoleaf/${id}/effects`, {
    method: 'PUT',
    body: JSON.stringify({ effect }),
  });
}

export async function identifyNanoleaf(id: string): Promise<void> {
  await fetchApi(`/nanoleaf/${id}/identify`, {
    method: 'POST',
  });
}

export async function removeNanoleafDevice(id: string): Promise<void> {
  await fetchApi(`/nanoleaf/${id}`, {
    method: 'DELETE',
  });
}

// Rooms
export async function getRooms(): Promise<Room[]> {
  return fetchApi<Room[]>('/rooms');
}

export async function getRoom(id: string): Promise<Room> {
  return fetchApi<Room>(`/rooms/${id}`);
}

export async function createRoom(name: string): Promise<Room> {
  return fetchApi<Room>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateRoom(id: string, data: { name?: string }): Promise<Room> {
  return fetchApi<Room>(`/rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRoom(id: string): Promise<void> {
  await fetchApi(`/rooms/${id}`, {
    method: 'DELETE',
  });
}

export async function assignDeviceToRoom(roomId: string, deviceExternalId: string): Promise<void> {
  await fetchApi(`/rooms/${roomId}/devices/${deviceExternalId}`, {
    method: 'PUT',
  });
}

export async function removeDeviceFromRoom(roomId: string, deviceExternalId: string): Promise<void> {
  await fetchApi(`/rooms/${roomId}/devices/${deviceExternalId}`, {
    method: 'DELETE',
  });
}

// Device Groups
export async function getGroups(): Promise<DeviceGroup[]> {
  return fetchApi<DeviceGroup[]>('/groups');
}

export async function getGroup(id: string): Promise<DeviceGroup> {
  return fetchApi<DeviceGroup>(`/groups/${id}`);
}

export async function createGroup(name: string, roomId?: string | null): Promise<DeviceGroup> {
  return fetchApi<DeviceGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, roomId }),
  });
}

export async function updateGroup(id: string, data: { name?: string; roomId?: string | null }): Promise<DeviceGroup> {
  return fetchApi<DeviceGroup>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(id: string): Promise<void> {
  await fetchApi(`/groups/${id}`, {
    method: 'DELETE',
  });
}

export async function addDeviceToGroup(groupId: string, deviceExternalId: string): Promise<void> {
  await fetchApi(`/groups/${groupId}/devices`, {
    method: 'POST',
    body: JSON.stringify({ deviceExternalId }),
  });
}

export async function removeDeviceFromGroup(groupId: string, deviceExternalId: string): Promise<void> {
  await fetchApi(`/groups/${groupId}/devices/${deviceExternalId}`, {
    method: 'DELETE',
  });
}

export async function setGroupState(groupId: string, state: Partial<DeviceState>): Promise<{ results: Array<{ deviceId: string; success: boolean; error?: string }> }> {
  return fetchApi(`/groups/${groupId}/state`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}
