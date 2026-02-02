import { prisma } from './database.js';
import type { Light, DeviceState } from '../types/index.js';

/**
 * Sync a device from external APIs to the database.
 * Creates the device if it doesn't exist, updates it if it does.
 */
export async function syncDevice(light: Light): Promise<void> {
  const externalId = light.id;

  await prisma.device.upsert({
    where: { externalId },
    create: {
      externalId,
      name: light.name,
      type: light.type,
      lastKnownState: light.state as unknown as object,
      reachable: light.reachable,
      lastSeenAt: new Date(),
    },
    update: {
      name: light.name,
      lastKnownState: light.state as unknown as object,
      reachable: light.reachable,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Sync multiple devices from external APIs to the database.
 */
export async function syncDevices(lights: Light[]): Promise<void> {
  await Promise.all(lights.map(syncDevice));
}

/**
 * Get all devices from the database with their room and group assignments.
 */
export async function getDevicesFromDb() {
  return prisma.device.findMany({
    include: {
      room: true,
      groups: {
        include: {
          group: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get a single device by its external ID (the ID used by Hue/Nanoleaf).
 */
export async function getDeviceByExternalId(externalId: string) {
  return prisma.device.findUnique({
    where: { externalId },
    include: {
      room: true,
      groups: {
        include: {
          group: true,
        },
      },
    },
  });
}

/**
 * Get a single device by its internal database ID.
 */
export async function getDeviceById(id: string) {
  return prisma.device.findUnique({
    where: { id },
    include: {
      room: true,
      groups: {
        include: {
          group: true,
        },
      },
    },
  });
}

/**
 * Assign a device to a room.
 */
export async function assignDeviceToRoom(
  deviceId: string,
  roomId: string | null
): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: { roomId },
  });
}

/**
 * Assign a device to a room by external ID.
 */
export async function assignDeviceToRoomByExternalId(
  externalId: string,
  roomId: string | null
): Promise<void> {
  await prisma.device.update({
    where: { externalId },
    data: { roomId },
  });
}

/**
 * Update the last known state for a device.
 */
export async function updateDeviceState(
  externalId: string,
  state: DeviceState,
  reachable: boolean
): Promise<void> {
  await prisma.device.update({
    where: { externalId },
    data: {
      lastKnownState: state as unknown as object,
      reachable,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Get devices by room ID.
 */
export async function getDevicesByRoom(roomId: string) {
  return prisma.device.findMany({
    where: { roomId },
    include: {
      room: true,
      groups: {
        include: {
          group: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get devices without a room assignment.
 */
export async function getUnassignedDevices() {
  return prisma.device.findMany({
    where: { roomId: null },
    include: {
      groups: {
        include: {
          group: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Set the hidden status for a device by external ID.
 */
export async function setDeviceHidden(
  externalId: string,
  hidden: boolean
): Promise<void> {
  await prisma.device.update({
    where: { externalId },
    data: { hidden },
  });
}
