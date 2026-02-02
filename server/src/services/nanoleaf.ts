import axios from 'axios';
import type { NanoleafDevice, Light, DeviceState, NanoleafDeviceConfig } from '../types/index.js';
import { nanoleafToNormalized, normalizedToNanoleaf } from '../utils/colorConversion.js';
import { getNanoleafDevices, getNanoleafDevice, addNanoleafDevice, removeNanoleafDevice } from '../utils/configManager.js';
import { randomUUID } from 'crypto';

// Create axios instance for Nanoleaf requests
const nanoleafClient = axios.create({
  timeout: 10000,
});

// Nanoleaf API runs on port 16021
const NANOLEAF_PORT = 16021;

async function nanoleafRequest<T>(
  device: NanoleafDeviceConfig,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object
): Promise<T> {
  const url = `http://${device.ip}:${NANOLEAF_PORT}/api/v1/${device.authToken}${path}`;

  const response = await nanoleafClient.request<T>({
    url,
    method,
    data: body,
    validateStatus: (status) => status < 500, // Don't throw on 4xx
  });

  if (response.status >= 400) {
    throw new Error(`Nanoleaf API error: ${response.status} ${response.statusText}`);
  }

  return response.data ?? ({} as T);
}

// Authenticate with a Nanoleaf device (device must be in pairing mode)
export async function authenticate(ip: string, name?: string): Promise<NanoleafDeviceConfig> {
  const url = `http://${ip}:${NANOLEAF_PORT}/api/v1/new`;

  console.log(`[Nanoleaf] Attempting to authenticate with ${ip}:${NANOLEAF_PORT}...`);

  let response;
  try {
    response = await nanoleafClient.post<{ auth_token: string }>(url, null, {
      validateStatus: () => true, // Don't throw on any status
    });
  } catch (err) {
    const error = err as Error;
    console.error(`[Nanoleaf] Connection failed:`, error.message);
    throw new Error(`Cannot connect to Nanoleaf at ${ip}:${NANOLEAF_PORT}. Make sure the IP is correct and the device is on.`);
  }

  console.log(`[Nanoleaf] Response status: ${response.status}`);

  if (response.status === 403) {
    throw new Error('Device not in pairing mode. Hold power button for 5-7 seconds or use the Nanoleaf app.');
  }

  if (response.status >= 400) {
    throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`);
  }

  const result = response.data;
  console.log(`[Nanoleaf] Response data:`, result);

  if (!result.auth_token) {
    throw new Error('No auth token received from device');
  }

  // Get device info to get the name
  const deviceConfig: NanoleafDeviceConfig = {
    id: randomUUID(),
    name: name || 'Nanoleaf Device',
    ip,
    authToken: result.auth_token,
  };

  // Try to get the actual device name
  try {
    const deviceInfo = await nanoleafRequest<NanoleafDevice>(deviceConfig, 'GET', '/');
    deviceConfig.name = name || deviceInfo.name || 'Nanoleaf Device';
  } catch {
    // Use default name if we can't get device info
  }

  // Save to config
  await addNanoleafDevice(deviceConfig);

  return deviceConfig;
}

// Get all configured Nanoleaf devices
export async function getDevices(): Promise<NanoleafDeviceConfig[]> {
  return await getNanoleafDevices();
}

// Get device state as normalized Light
export async function getDeviceState(id: string): Promise<Light> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  const info = await nanoleafRequest<NanoleafDevice>(device, 'GET', '/');

  return {
    id: device.id,
    name: device.name,
    type: 'nanoleaf' as const,
    state: nanoleafStateToNormalized(info.state),
    reachable: true,
    model: info.model,
    capabilities: {
      color: true,      // Nanoleaf Shapes/Canvas support color
      colorTemp: true,  // They also support color temperature
    },
  };
}

// Get all devices with their states
export async function getAllDeviceStates(): Promise<Light[]> {
  const devices = await getNanoleafDevices();
  const lights: Light[] = [];

  for (const device of devices) {
    try {
      const light = await getDeviceState(device.id);
      lights.push(light);
    } catch {
      // Device might be offline, add with unreachable state
      lights.push({
        id: device.id,
        name: device.name,
        type: 'nanoleaf' as const,
        state: { on: false, brightness: 0 },
        reachable: false,
        capabilities: { color: true, colorTemp: true },
      });
    }
  }

  return lights;
}

// Set device state
export async function setDeviceState(
  id: string,
  state: Partial<DeviceState>
): Promise<void> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  const nanoleafState: Record<string, object> = {};

  if (state.on !== undefined) {
    nanoleafState.on = { value: state.on };
  }

  if (state.brightness !== undefined) {
    nanoleafState.brightness = { value: state.brightness };
  }

  if (state.color) {
    const nanoleafColor = normalizedToNanoleaf(state.color);
    nanoleafState.hue = { value: nanoleafColor.hue };
    nanoleafState.sat = { value: nanoleafColor.sat };
  }

  if (state.colorTemp) {
    // Nanoleaf uses Kelvin directly but with different range (1200-6500)
    const ct = Math.max(1200, Math.min(6500, state.colorTemp));
    nanoleafState.ct = { value: ct };
  }

  await nanoleafRequest(device, 'PUT', '/state', nanoleafState);
}

// Get available effects
export async function getEffects(id: string): Promise<string[]> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  const result = await nanoleafRequest<{ effectsList: string[] }>(
    device,
    'GET',
    '/effects/effectsList'
  );

  return result.effectsList || [];
}

// Get current effect
export async function getCurrentEffect(id: string): Promise<string> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  const result = await nanoleafRequest<string>(device, 'GET', '/effects/select');
  return result;
}

// Set effect
export async function setEffect(id: string, effectName: string): Promise<void> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  await nanoleafRequest(device, 'PUT', '/effects', { select: effectName });
}

// Remove a device
export async function removeDevice(id: string): Promise<boolean> {
  return await removeNanoleafDevice(id);
}

// Identify device (flash lights)
export async function identify(id: string): Promise<void> {
  const device = await getNanoleafDevice(id);
  if (!device) {
    throw new Error(`Nanoleaf device not found: ${id}`);
  }

  await nanoleafRequest(device, 'PUT', '/identify', {});
}

// Helper to convert Nanoleaf state to normalized format
function nanoleafStateToNormalized(state: NanoleafDevice['state']): DeviceState {
  const normalized: DeviceState = {
    on: state.on.value,
    brightness: state.brightness.value,
  };

  if (state.colorMode === 'hs') {
    normalized.color = nanoleafToNormalized(
      state.hue.value,
      state.sat.value,
      state.brightness.value
    );
    normalized.colorMode = 'hs';
  } else if (state.colorMode === 'ct') {
    normalized.colorTemp = state.ct.value;
    normalized.colorMode = 'ct';
  } else if (state.colorMode === 'effect') {
    normalized.colorMode = 'effect';
  }

  return normalized;
}
