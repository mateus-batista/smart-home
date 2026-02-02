import { prisma } from '../services/database.js';
import type { HueConfig, NanoleafDeviceConfig } from '../types/index.js';

export async function getHueConfig(): Promise<HueConfig> {
  const config = await prisma.hueBridgeConfig.findUnique({
    where: { id: 'singleton' },
  });

  return {
    bridgeIp: config?.bridgeIp ?? null,
    username: config?.username ?? null,
  };
}

export async function setHueConfig(hueConfig: Partial<HueConfig>): Promise<void> {
  await prisma.hueBridgeConfig.upsert({
    where: { id: 'singleton' },
    update: {
      bridgeIp: hueConfig.bridgeIp,
      username: hueConfig.username,
    },
    create: {
      id: 'singleton',
      bridgeIp: hueConfig.bridgeIp,
      username: hueConfig.username,
    },
  });
}

export async function getNanoleafDevices(): Promise<NanoleafDeviceConfig[]> {
  const devices = await prisma.nanoleafConfig.findMany();
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    ip: d.ip,
    authToken: d.authToken,
  }));
}

export async function getNanoleafDevice(id: string): Promise<NanoleafDeviceConfig | undefined> {
  const device = await prisma.nanoleafConfig.findUnique({
    where: { id },
  });

  if (!device) {
    return undefined;
  }

  return {
    id: device.id,
    name: device.name,
    ip: device.ip,
    authToken: device.authToken,
  };
}

export async function addNanoleafDevice(device: NanoleafDeviceConfig): Promise<void> {
  await prisma.nanoleafConfig.upsert({
    where: { ip: device.ip },
    update: {
      name: device.name,
      authToken: device.authToken,
    },
    create: {
      id: device.id,
      name: device.name,
      ip: device.ip,
      authToken: device.authToken,
    },
  });
}

export async function removeNanoleafDevice(id: string): Promise<boolean> {
  try {
    await prisma.nanoleafConfig.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}
