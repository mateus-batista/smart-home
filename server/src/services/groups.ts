import { prisma } from './database.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface CreateGroupInput {
  name: string;
  roomId?: string | null;
}

export interface UpdateGroupInput {
  name?: string;
  roomId?: string | null;
}

/**
 * Get all device groups with their devices.
 */
export async function getAllGroups() {
  return prisma.deviceGroup.findMany({
    include: {
      room: true,
      devices: {
        include: {
          device: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get a single group by ID.
 */
export async function getGroupById(id: string) {
  return prisma.deviceGroup.findUnique({
    where: { id },
    include: {
      room: true,
      devices: {
        include: {
          device: true,
        },
      },
    },
  });
}

/**
 * Create a new device group.
 */
export async function createGroup(input: CreateGroupInput) {
  return prisma.deviceGroup.create({
    data: {
      name: input.name,
      roomId: input.roomId,
    },
    include: {
      room: true,
      devices: {
        include: {
          device: true,
        },
      },
    },
  });
}

/**
 * Update a device group.
 */
export async function updateGroup(id: string, input: UpdateGroupInput) {
  return prisma.deviceGroup.update({
    where: { id },
    data: input,
    include: {
      room: true,
      devices: {
        include: {
          device: true,
        },
      },
    },
  });
}

/**
 * Delete a device group.
 */
export async function deleteGroup(id: string) {
  return prisma.deviceGroup.delete({
    where: { id },
  });
}

/**
 * Add a device to a group.
 */
export async function addDeviceToGroup(groupId: string, deviceId: string) {
  return prisma.deviceGroupMembership.create({
    data: {
      groupId,
      deviceId,
    },
  });
}

/**
 * Remove a device from a group.
 */
export async function removeDeviceFromGroup(groupId: string, deviceId: string) {
  return prisma.deviceGroupMembership.delete({
    where: {
      deviceId_groupId: {
        deviceId,
        groupId,
      },
    },
  });
}

/**
 * Get all devices in a group.
 */
export async function getDevicesInGroup(groupId: string) {
  const memberships = await prisma.deviceGroupMembership.findMany({
    where: { groupId },
    include: {
      device: {
        include: {
          room: true,
        },
      },
    },
  });

  return memberships.map((m: { device: Prisma.DeviceGetPayload<{ include: { room: true } }> }) => m.device);
}

/**
 * Get groups for a specific room.
 */
export async function getGroupsByRoom(roomId: string) {
  return prisma.deviceGroup.findMany({
    where: { roomId },
    include: {
      room: true,
      devices: {
        include: {
          device: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}
