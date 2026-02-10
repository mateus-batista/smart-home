// Shared types for smart home devices

export interface DeviceConfig {
  hue: HueConfig;
  nanoleaf: NanoleafDeviceConfig[];
}

export interface HueConfig {
  bridgeIp: string | null;
  username: string | null;
}

export interface NanoleafDeviceConfig {
  id: string;
  name: string;
  ip: string;
  authToken: string;
}

// Normalized color format used by frontend (HSL)
export interface NormalizedColor {
  hue: number;        // 0-360
  saturation: number; // 0-100
  brightness: number; // 0-100
}

// Blind Tilt positions
export type TiltPosition = 'closed-up' | 'half-open' | 'open' | 'half-closed' | 'closed-down';

// Normalized device state
export interface DeviceState {
  on: boolean;
  brightness: number; // 0-100
  tiltPosition?: TiltPosition; // Only for Blind Tilt devices
  color?: NormalizedColor;
  colorTemp?: number; // Kelvin
  colorMode?: 'hs' | 'ct' | 'effect';
}

// Device capabilities
export interface DeviceCapabilities {
  color?: boolean;      // Supports HSB color
  colorTemp?: boolean;  // Supports color temperature
}

// Generic light device
export interface Light {
  id: string;
  name: string;
  type: 'hue' | 'nanoleaf' | 'switchbot';
  deviceType?: string; // e.g., 'Curtain', 'Blind Tilt', 'Roller Shade', 'Color Bulb'
  state: DeviceState;
  reachable: boolean;
  model?: string;
  capabilities?: DeviceCapabilities;
}

// SwitchBot specific types
export interface SwitchBotConfig {
  token: string;
  secretKey: string;
}

export interface SwitchBotDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  enableCloudService: boolean;
  hubDeviceId: string;
  curtainDevicesIds?: string[];
  calibrate?: boolean;
  group?: boolean;
  master?: boolean;
  openDirection?: string;
  slidePosition?: number;
  battery?: number;
  version?: string;
}

export interface SwitchBotDeviceStatus {
  deviceId: string;
  deviceType: string;
  hubDeviceId: string;
  power?: string;
  battery?: number;
  version?: string;
  calibrate?: boolean;
  group?: boolean;
  moving?: boolean;
  slidePosition?: number;
  direction?: string; // For Blind Tilt: "up" or "down"
  brightness?: number;
  color?: string;
  colorTemperature?: number;
}

export interface SwitchBotDeviceList {
  statusCode: number;
  body: {
    deviceList: SwitchBotDevice[];
    infraredRemoteList: Array<{
      deviceId: string;
      deviceName: string;
      remoteType: string;
      hubDeviceId: string;
    }>;
  };
  message: string;
}

// Light with room and group info (returned from API)
export interface LightWithRoomAndGroups extends Light {
  roomId: string | null;
  roomName: string | null;
  hidden: boolean;
  groups: { id: string; name: string }[];
}

// Room type
export interface Room {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Device group type
export interface DeviceGroup {
  id: string;
  name: string;
  roomId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Group with devices
export interface DeviceGroupWithDevices extends DeviceGroup {
  room: Room | null;
  devices: { device: { id: string; externalId: string; name: string; type: string } }[];
}

// Hue API types
export interface HueLightState {
  on: boolean;
  bri: number;    // 0-254
  hue: number;    // 0-65535
  sat: number;    // 0-254
  ct?: number;    // 153-500 (mirek)
  colormode?: 'hs' | 'ct' | 'xy';
  reachable: boolean;
}

export interface HueLight {
  state: HueLightState;
  type: string;
  name: string;
  modelid: string;
  uniqueid: string;
}

export interface HueBridge {
  id: string;
  internalipaddress: string;
  port: number;
}

// Nanoleaf API types
export interface NanoleafState {
  on: { value: boolean };
  brightness: { value: number; min: number; max: number };
  hue: { value: number; min: number; max: number };
  sat: { value: number; min: number; max: number };
  ct: { value: number; min: number; max: number };
  colorMode: string;
}

export interface NanoleafDevice {
  name: string;
  serialNo: string;
  manufacturer: string;
  firmwareVersion: string;
  model: string;
  state: NanoleafState;
}

export interface NanoleafEffect {
  animName: string;
  animType: string;
  pluginType?: string;
}
