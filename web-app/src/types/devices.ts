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

// Light device types (for icons)
export const LIGHT_DEVICE_TYPES = ['Color Bulb', 'Strip Light', 'Ceiling Light', 'Plug Mini'];

// Helper to check if a device is a shade
export function isShadeDevice(device: Light): boolean {
  if (device.deviceType && SHADE_DEVICE_TYPES.includes(device.deviceType)) {
    return true;
  }
  const nameLower = device.name.toLowerCase();
  return ['shade', 'curtain', 'blind', 'persiana', 'cortina'].some(kw => nameLower.includes(kw));
}

// Group type enum
export type GroupType = 'light' | 'shade' | 'mixed' | 'empty';

// Get the type of a group based on its devices
export function getGroupType(devices: Light[]): GroupType {
  if (devices.length === 0) return 'empty';

  const shadeCount = devices.filter(d => isShadeDevice(d)).length;
  const lightCount = devices.length - shadeCount;

  if (shadeCount === devices.length) return 'shade';
  if (lightCount === devices.length) return 'light';
  return 'mixed'; // Shouldn't happen with enforcement, but just in case
}

// Check if a device can be added to a group (type enforcement)
export function canAddDeviceToGroup(device: Light, existingDevices: Light[]): { allowed: boolean; reason?: string } {
  if (existingDevices.length === 0) {
    return { allowed: true };
  }

  const groupType = getGroupType(existingDevices);
  const deviceIsShade = isShadeDevice(device);

  if (groupType === 'shade' && !deviceIsShade) {
    return {
      allowed: false,
      reason: 'This group contains shades. Only shade devices can be added.'
    };
  }

  if (groupType === 'light' && deviceIsShade) {
    return {
      allowed: false,
      reason: 'This group contains lights. Only light devices can be added.'
    };
  }

  return { allowed: true };
}

// Get specific device icon type for more granular icons
export type DeviceIconType = 'bulb' | 'strip' | 'nanoleaf' | 'blind-tilt' | 'curtain' | 'roller-shade' | 'generic-light' | 'generic-shade';

export function getDeviceIconType(device: Light): DeviceIconType {
  // Check specific device types first
  if (device.deviceType === 'Blind Tilt') return 'blind-tilt';
  if (device.deviceType === 'Curtain' || device.deviceType === 'Curtain3') return 'curtain';
  if (device.deviceType === 'Roller Shade') return 'roller-shade';
  if (device.deviceType === 'Color Bulb') return 'bulb';
  if (device.deviceType === 'Strip Light') return 'strip';

  // Check by type
  if (device.type === 'nanoleaf') return 'nanoleaf';
  if (device.type === 'hue') return 'bulb'; // Default Hue lights to bulb icon

  // Fallback based on shade detection
  if (isShadeDevice(device)) return 'generic-shade';
  return 'bulb'; // Default to bulb for unknown lights
}

// Get the dominant icon type for a group
export function getGroupIconType(devices: Light[]): DeviceIconType | 'empty' {
  if (devices.length === 0) return 'empty';

  // Count icon types
  const iconCounts = new Map<DeviceIconType, number>();
  for (const device of devices) {
    const iconType = getDeviceIconType(device);
    iconCounts.set(iconType, (iconCounts.get(iconType) || 0) + 1);
  }

  // Return the most common icon type
  let maxCount = 0;
  let dominantIcon: DeviceIconType = 'generic-light';
  for (const [iconType, count] of iconCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantIcon = iconType;
    }
  }

  return dominantIcon;
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
