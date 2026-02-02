import axios from 'axios';
import https from 'https';
import type { HueBridge, HueLight, Light, DeviceState, DeviceCapabilities } from '../types/index.js';
import { hueToNormalized, normalizedToHue, mirekToKelvin, kelvinToMirek } from '../utils/colorConversion.js';
import { getHueConfig, setHueConfig } from '../utils/configManager.js';

// Create axios instance for Hue bridge requests (accepts self-signed certificates)
const hueClient = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});

async function hueRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object
): Promise<T> {
  const config = await getHueConfig();
  if (!config.bridgeIp) {
    throw new Error('Hue bridge not configured');
  }

  const url = `https://${config.bridgeIp}${path}`;
  const response = await hueClient.request<T>({
    url,
    method,
    data: body,
  });

  return response.data;
}

// Discover Hue bridges on the network
export async function discoverBridges(): Promise<HueBridge[]> {
  const response = await axios.get<HueBridge[]>('https://discovery.meethue.com');
  return response.data;
}

// Create a new user on the bridge (requires button press)
export async function createUser(bridgeIp: string): Promise<string> {
  const url = `https://${bridgeIp}/api`;

  const response = await hueClient.post<Array<{ success?: { username: string }; error?: { description: string } }>>(
    url,
    { devicetype: 'smart-home#web' }
  );

  const result = response.data;

  if (result[0]?.error) {
    throw new Error(result[0].error.description);
  }

  if (result[0]?.success?.username) {
    // Save the configuration
    await setHueConfig({
      bridgeIp,
      username: result[0].success.username,
    });
    return result[0].success.username;
  }

  throw new Error('Unexpected response from Hue bridge');
}

// Get all lights from the bridge
export async function getLights(): Promise<Light[]> {
  const config = await getHueConfig();
  if (!config.username) {
    throw new Error('Hue not authenticated');
  }

  const hueLights = await hueRequest<Record<string, HueLight>>(
    'GET',
    `/api/${config.username}/lights`
  );

  return Object.entries(hueLights).map(([id, light]) => ({
    id: `hue-${id}`,
    name: light.name,
    type: 'hue' as const,
    state: hueStateToNormalized(light.state),
    reachable: light.state.reachable,
    model: light.modelid,
    capabilities: getHueCapabilities(light.type),
  }));
}

// Get a specific light
export async function getLight(id: string): Promise<Light> {
  const config = await getHueConfig();
  if (!config.username) {
    throw new Error('Hue not authenticated');
  }

  const hueId = id.replace('hue-', '');
  const light = await hueRequest<HueLight>(
    'GET',
    `/api/${config.username}/lights/${hueId}`
  );

  return {
    id,
    name: light.name,
    type: 'hue' as const,
    state: hueStateToNormalized(light.state),
    reachable: light.state.reachable,
    model: light.modelid,
    capabilities: getHueCapabilities(light.type),
  };
}

// Set light state
export async function setLightState(
  id: string,
  state: Partial<DeviceState>
): Promise<void> {
  const config = await getHueConfig();
  if (!config.username) {
    throw new Error('Hue not authenticated');
  }

  const hueId = id.replace('hue-', '');
  const hueState: Record<string, unknown> = {};

  if (state.on !== undefined) {
    hueState.on = state.on;
  }

  if (state.brightness !== undefined) {
    hueState.bri = Math.round((state.brightness / 100) * 254);
  }

  if (state.color) {
    const hueColor = normalizedToHue(state.color);
    hueState.hue = hueColor.hue;
    hueState.sat = hueColor.sat;
  }

  if (state.colorTemp) {
    hueState.ct = kelvinToMirek(state.colorTemp);
  }

  console.log(`[Hue] Setting light ${hueId} state:`, JSON.stringify(hueState));

  const result = await hueRequest(
    'PUT',
    `/api/${config.username}/lights/${hueId}/state`,
    hueState
  );

  console.log(`[Hue] Response:`, JSON.stringify(result));
}

// Get all groups (rooms)
export async function getGroups(): Promise<Array<{ id: string; name: string; lights: string[] }>> {
  const config = await getHueConfig();
  if (!config.username) {
    throw new Error('Hue not authenticated');
  }

  const groups = await hueRequest<Record<string, { name: string; lights: string[] }>>(
    'GET',
    `/api/${config.username}/groups`
  );

  return Object.entries(groups).map(([id, group]) => ({
    id: `hue-group-${id}`,
    name: group.name,
    lights: group.lights.map((l) => `hue-${l}`),
  }));
}

// Set group state
export async function setGroupState(
  id: string,
  state: Partial<DeviceState>
): Promise<void> {
  const config = await getHueConfig();
  if (!config.username) {
    throw new Error('Hue not authenticated');
  }

  const groupId = id.replace('hue-group-', '');
  const hueState: Record<string, unknown> = {};

  if (state.on !== undefined) {
    hueState.on = state.on;
  }

  if (state.brightness !== undefined) {
    hueState.bri = Math.round((state.brightness / 100) * 254);
  }

  if (state.color) {
    const hueColor = normalizedToHue(state.color);
    hueState.hue = hueColor.hue;
    hueState.sat = hueColor.sat;
  }

  await hueRequest(
    'PUT',
    `/api/${config.username}/groups/${groupId}/action`,
    hueState
  );
}

// Check if Hue is configured
export async function isConfigured(): Promise<boolean> {
  const config = await getHueConfig();
  return !!(config.bridgeIp && config.username);
}

// Helper to determine Hue light capabilities based on type
function getHueCapabilities(lightType: string): DeviceCapabilities {
  const type = lightType.toLowerCase();

  // Extended color light - supports both color and color temperature
  if (type.includes('extended color')) {
    return { color: true, colorTemp: true };
  }

  // Color light - supports color but not color temperature
  if (type.includes('color light') && !type.includes('temperature')) {
    return { color: true, colorTemp: false };
  }

  // Color temperature light - supports color temperature only
  if (type.includes('color temperature') || type.includes('white ambiance')) {
    return { color: false, colorTemp: true };
  }

  // Dimmable light - brightness only
  return { color: false, colorTemp: false };
}

// Helper to convert Hue state to normalized format
function hueStateToNormalized(state: HueLight['state']): DeviceState {
  const normalized: DeviceState = {
    on: state.on,
    brightness: Math.round((state.bri / 254) * 100),
  };

  if (state.colormode === 'hs' || state.colormode === 'xy') {
    normalized.color = hueToNormalized(state.hue, state.sat, state.bri);
    normalized.colorMode = 'hs';
  } else if (state.colormode === 'ct' && state.ct) {
    normalized.colorTemp = mirekToKelvin(state.ct);
    normalized.colorMode = 'ct';
  }

  return normalized;
}
