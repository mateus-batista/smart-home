/**
 * SwitchBot API Service
 * Handles communication with SwitchBot devices via their cloud API.
 * API Documentation: https://github.com/OpenWonderLabs/SwitchBotAPI
 */

import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  Light,
  DeviceState,
  TiltPosition,
  SwitchBotDevice,
  SwitchBotDeviceStatus,
  SwitchBotDeviceList 
} from '../types/index.js';

const SWITCHBOT_API_URL = 'https://api.switch-bot.com/v1.1';

// Device type constants (exported for testing)
export const SHADE_TYPES = ['Curtain', 'Curtain3', 'Blind Tilt', 'Roller Shade'];
export const LIGHT_TYPES = ['Color Bulb', 'Strip Light', 'Ceiling Light', 'Ceiling Light Pro'];

// Get credentials from environment
function getCredentials() {
  const token = process.env.SWITCHBOT_TOKEN;
  const secretKey = process.env.SWITCHBOT_SECRET_KEY;
  
  if (!token || !secretKey) {
    return null;
  }
  
  return { token, secretKey };
}

// Generate authentication headers for SwitchBot API
function generateAuthHeaders(): Record<string, string> {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error('SwitchBot credentials not configured');
  }

  const { token, secretKey } = credentials;
  const t = Date.now();
  const nonce = uuidv4();
  const data = token + t + nonce;

  // Create HMAC-SHA256 signature
  const sign = crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('base64');

  return {
    'Authorization': token,
    'sign': sign,
    'nonce': nonce,
    't': t.toString(),
    'Content-Type': 'application/json',
  };
}

// Make authenticated request to SwitchBot API
async function switchBotRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<T> {
  const headers = generateAuthHeaders();
  const url = `${SWITCHBOT_API_URL}${path}`;

  const response = await axios.request<T>({
    url,
    method,
    headers,
    data: body,
    timeout: 15000,
  });

  return response.data;
}

// Check if SwitchBot is configured
export function isConfigured(): boolean {
  return getCredentials() !== null;
}

// Get all SwitchBot devices
export async function getDevices(): Promise<SwitchBotDevice[]> {
  const response = await switchBotRequest<SwitchBotDeviceList>('GET', '/devices');
  
  if (response.statusCode !== 100) {
    throw new Error(`SwitchBot API error: ${response.message}`);
  }

  return response.body.deviceList;
}

// Get device status
export async function getDeviceStatus(deviceId: string): Promise<SwitchBotDeviceStatus> {
  const response = await switchBotRequest<{
    statusCode: number;
    body: SwitchBotDeviceStatus;
    message: string;
  }>('GET', `/devices/${deviceId}/status`);

  if (response.statusCode !== 100) {
    throw new Error(`SwitchBot API error: ${response.message}`);
  }

  return response.body;
}

// Send command to device
export async function sendCommand(
  deviceId: string,
  command: string,
  parameter: string | object = 'default',
  commandType: string = 'command'
): Promise<void> {
  const response = await switchBotRequest<{
    statusCode: number;
    body: object;
    message: string;
  }>('POST', `/devices/${deviceId}/commands`, {
    command,
    parameter,
    commandType,
  });

  if (response.statusCode !== 100) {
    throw new Error(`SwitchBot command failed: ${response.message}`);
  }
}

// Convert SwitchBot device to normalized Light format
function switchBotToLight(device: SwitchBotDevice, status?: SwitchBotDeviceStatus): Light {
  const isShade = SHADE_TYPES.includes(device.deviceType);
  const isLight = LIGHT_TYPES.includes(device.deviceType);

  // Determine state based on device type
  let state: DeviceState;
  
  if (isShade) {
    const position = status?.slidePosition ?? device.slidePosition ?? 0;
    
    let openness: number;
    
    if (device.deviceType === 'Blind Tilt') {
      const direction = (status?.direction ?? 'down').toLowerCase();
      const tiltPosition = parseTiltStatus(direction, position);
      state = {
        on: tiltPosition === 'open',
        brightness: 0,
        tiltPosition,
      };
    } else {
      // Curtain/Roller Shade: slidePosition 0 = closed, 100 = fully open
      state = {
        on: position > 0,
        brightness: position,
      };
    }
  } else if (isLight && status) {
    state = {
      on: status.power === 'on',
      brightness: status.brightness ?? 100,
    };
    if (status.color) {
      const [r, g, b] = status.color.split(':').map(Number);
      // Convert RGB to HSL (simplified)
      state.color = rgbToHsl(r, g, b);
    }
    if (status.colorTemperature) {
      state.colorTemp = status.colorTemperature;
    }
  } else {
    state = {
      on: status ? status.power === 'on' : true,
      brightness: status?.brightness ?? 100,
    };
  }

  return {
    id: `switchbot-${device.deviceId}`,
    name: device.deviceName,
    type: 'switchbot',
    deviceType: device.deviceType,
    state,
    reachable: device.enableCloudService,
    model: device.deviceType,
    capabilities: {
      color: isLight && (device.deviceType === 'Color Bulb' || device.deviceType === 'Strip Light'),
      colorTemp: isLight,
    },
  };
}

// Get all devices with their current states (as Light objects)
export async function getAllDeviceStates(): Promise<Light[]> {
  const devices = await getDevices();
  const lights: Light[] = [];

  for (const device of devices) {
    try {
      // Get status for supported device types
      if ([...SHADE_TYPES, ...LIGHT_TYPES, 'Plug', 'Plug Mini (US)', 'Plug Mini (JP)', 'Plug Mini (EU)'].includes(device.deviceType)) {
        const status = await getDeviceStatus(device.deviceId);
        lights.push(switchBotToLight(device, status));
      } else {
        // Include device without detailed status
        lights.push(switchBotToLight(device));
      }
    } catch (error) {
      console.error(`[SwitchBot] Error getting status for ${device.deviceName}:`, error);
      // Still include the device with basic info
      lights.push(switchBotToLight(device));
    }
  }

  return lights;
}

// Set device state (generic handler)
export async function setDeviceState(id: string, state: Partial<DeviceState>): Promise<void> {
  const deviceId = id.replace('switchbot-', '');
  
  // Get device info to determine type
  const devices = await getDevices();
  const device = devices.find(d => d.deviceId === deviceId);
  
  if (!device) {
    throw new Error(`SwitchBot device ${deviceId} not found`);
  }

  const isShade = SHADE_TYPES.includes(device.deviceType);
  const isLight = LIGHT_TYPES.includes(device.deviceType);

  if (isShade) {
    await setShadeState(deviceId, device.deviceType, state);
  } else if (isLight) {
    await setLightState(deviceId, state);
  } else if (device.deviceType.includes('Plug')) {
    await setPlugState(deviceId, state);
  } else {
    throw new Error(`Unsupported device type: ${device.deviceType}`);
  }
}

// Control shades (Curtain, Blind Tilt, Roller Shade)
async function setShadeState(
  deviceId: string, 
  deviceType: string,
  state: Partial<DeviceState>
): Promise<void> {
  const cmd = getShadeCommand(deviceType, state);
  if (cmd) {
    await sendCommand(deviceId, cmd.command, cmd.parameter);
  }
}

// Control lights (Color Bulb, Strip Light, etc.)
async function setLightState(deviceId: string, state: Partial<DeviceState>): Promise<void> {
  if (state.on !== undefined) {
    await sendCommand(deviceId, state.on ? 'turnOn' : 'turnOff');
  }
  
  if (state.brightness !== undefined) {
    await sendCommand(deviceId, 'setBrightness', state.brightness.toString());
  }
  
  if (state.color) {
    const rgb = hslToRgb(state.color.hue, state.color.saturation, state.color.brightness);
    await sendCommand(deviceId, 'setColor', `${rgb.r}:${rgb.g}:${rgb.b}`);
  }
  
  if (state.colorTemp) {
    await sendCommand(deviceId, 'setColorTemperature', state.colorTemp.toString());
  }
}

// Control plugs
async function setPlugState(deviceId: string, state: Partial<DeviceState>): Promise<void> {
  if (state.on !== undefined) {
    await sendCommand(deviceId, state.on ? 'turnOn' : 'turnOff');
  }
}

/**
 * Blind Tilt: 5 discrete positions.
 *
 * position     | command (send) | API reports (direction, slidePosition)
 * -------------|----------------|---------------------------------------
 * closed-up    | up;0           | Up, 100
 * half-open    | up;50          | Up, 75
 * open         | down;100       | Down, 50
 * half-closed  | down;33        | Down, 16
 * closed-down  | down;0         | Down, 0
 */
export const TILT_COMMANDS: Record<TiltPosition, string> = {
  'closed-up':   'up;0',
  'half-open':   'up;50',
  'open':        'down;100',
  'half-closed': 'down;33',
  'closed-down': 'down;0',
};

/** Parse SwitchBot API status into the nearest tilt position */
export function parseTiltStatus(direction: string, slidePosition: number): TiltPosition {
  if (direction === 'up') {
    return slidePosition >= 88 ? 'closed-up' : 'half-open';
  }
  // direction === 'down'
  if (slidePosition >= 34) return 'open';
  if (slidePosition >= 8) return 'half-closed';
  return 'closed-down';
}

/**
 * Get the command parameters for a shade device based on type and state.
 * 
 * @param deviceType - The type of shade device
 * @param state - The desired device state
 * @returns Object with command and parameter, or null if no command needed
 */
export function getShadeCommand(
  deviceType: string,
  state: Partial<DeviceState>
): { command: string; parameter: string } | null {
  if (deviceType === 'Blind Tilt') {
    if (state.tiltPosition) {
      return { command: 'setPosition', parameter: TILT_COMMANDS[state.tiltPosition] };
    }
    if (state.on !== undefined) {
      return { command: 'setPosition', parameter: TILT_COMMANDS[state.on ? 'open' : 'closed-down'] };
    }
    return null;
  }

  // Curtain and Roller Shade
  if (state.on !== undefined) {
    if (state.on) {
      if (deviceType === 'Curtain' || deviceType === 'Curtain3') {
        return { command: 'turnOn', parameter: 'default' };
      } else {
        return { command: 'fullyOpen', parameter: 'default' };
      }
    } else {
      if (deviceType === 'Curtain' || deviceType === 'Curtain3') {
        return { command: 'turnOff', parameter: 'default' };
      } else {
        return { command: 'closeDown', parameter: 'default' };
      }
    }
  }

  if (state.brightness !== undefined) {
    return { command: 'setPosition', parameter: `0,ff,${state.brightness}` };
  }

  return null;
}

// Helper: RGB to HSL conversion
export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    hue: Math.round(h * 360),
    saturation: Math.round(s * 100),
    brightness: Math.round(l * 100),
  };
}

// Helper: HSL to RGB conversion
export function hslToRgb(h: number, s: number, l: number) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
