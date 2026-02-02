import { prisma } from './database.js';

export interface CreateRoomInput {
  name: string;
}

export interface UpdateRoomInput {
  name?: string;
}

/**
 * Get all rooms with their devices.
 */
export async function getAllRooms() {
  return prisma.room.findMany({
    include: {
      devices: true,
      groups: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get a single room by ID.
 */
export async function getRoomById(id: string) {
  return prisma.room.findUnique({
    where: { id },
    include: {
      devices: true,
      groups: true,
    },
  });
}

/**
 * Create a new room.
 */
export async function createRoom(input: CreateRoomInput) {
  return prisma.room.create({
    data: {
      name: input.name,
    },
    include: {
      devices: true,
      groups: true,
    },
  });
}

/**
 * Update a room.
 */
export async function updateRoom(id: string, input: UpdateRoomInput) {
  return prisma.room.update({
    where: { id },
    data: input,
    include: {
      devices: true,
      groups: true,
    },
  });
}

/**
 * Delete a room.
 * Devices in the room will have their roomId set to null.
 */
export async function deleteRoom(id: string) {
  return prisma.room.delete({
    where: { id },
  });
}
