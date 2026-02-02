// Normalized color format used by frontend (HSL)
export interface NormalizedColor {
  hue: number;        // 0-360
  saturation: number; // 0-100
  brightness: number; // 0-100
}

// Normalized device state
export interface DeviceState {
  on: boolean;
  brightness: number; // 0-100
  color?: NormalizedColor;
  colorTemp?: number; // Kelvin
  colorMode?: 'hs' | 'ct' | 'effect';
}

// Generic device (lights, shades, etc.)
export interface Light {
  id: string;
  name: string;
  type: 'hue' | 'nanoleaf' | 'switchbot';
  deviceType?: string; // e.g., 'Curtain', 'Blind Tilt', 'Roller Shade', 'Color Bulb'
  state: DeviceState;
  reachable: boolean;
  model?: string;
  capabilities?: {
    color?: boolean;      // Supports HSB color
    colorTemp?: boolean;  // Supports color temperature
  };
  // Room and group info from database
  roomId?: string | null;
  roomName?: string | null;
  hidden?: boolean;
  groups?: { id: string; name: string }[];
}

// Shade device types
export const SHADE_DEVICE_TYPES = ['Curtain', 'Curtain3', 'Blind Tilt', 'Roller Shade'];

// Helper to check if a device is a shade
export function isShadeDevice(device: Light): boolean {
  if (device.deviceType && SHADE_DEVICE_TYPES.includes(device.deviceType)) {
    return true;
  }
  const nameLower = device.name.toLowerCase();
  return ['shade', 'curtain', 'blind', 'persiana', 'cortina'].some(kw => nameLower.includes(kw));
}

// Room type
export interface Room {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  devices?: Light[];
  groups?: DeviceGroup[];
}

// Device group type
export interface DeviceGroup {
  id: string;
  name: string;
  roomId: string | null;
  createdAt: string;
  updatedAt: string;
  room?: Room | null;
  devices?: { device: { id: string; externalId: string; name: string; type: string } }[];
}

// Hue Bridge discovery
export interface HueBridge {
  id: string;
  internalipaddress: string;
  port: number;
}

// Nanoleaf device config
export interface NanoleafDeviceConfig {
  id: string;
  name: string;
  ip: string;
  authToken: string;
}

// API status response
export interface ApiStatus {
  hue: {
    configured: boolean;
  };
  nanoleaf: {
    configured: boolean;
    deviceCount: number;
  };
  switchbot?: {
    configured: boolean;
  };
}

// Effects response
export interface EffectsResponse {
  effects: string[];
  currentEffect: string;
}
