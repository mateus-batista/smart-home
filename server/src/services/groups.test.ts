/**
 * Tests for groups service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client - must be before imports
vi.mock('./database.js', () => ({
  prisma: {
    deviceGroup: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    deviceGroupMembership: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Import after mock
import * as groupsService from './groups.js';
import { prisma } from './database.js';

// Type assertion for mocked prisma
const mockPrisma = prisma as unknown as {
  deviceGroup: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  deviceGroupMembership: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Groups Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllGroups', () => {
    it('should return all groups with rooms and devices', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Living Room Lights',
          roomId: 'room-1',
          room: { id: 'room-1', name: 'Living Room' },
          devices: [
            {
              device: { id: 'device-1', externalId: 'hue-1', name: 'Light 1' },
            },
          ],
        },
      ];

      mockPrisma.deviceGroup.findMany.mockResolvedValue(mockGroups);

      const result = await groupsService.getAllGroups();

      expect(result).toEqual(mockGroups);
      expect(mockPrisma.deviceGroup.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe('getGroupById', () => {
    it('should return a group by ID', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        roomId: null,
        room: null,
        devices: [],
      };

      mockPrisma.deviceGroup.findUnique.mockResolvedValue(mockGroup);

      const result = await groupsService.getGroupById('group-1');

      expect(result).toEqual(mockGroup);
      expect(mockPrisma.deviceGroup.findUnique).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        include: {
          room: true,
          devices: {
            include: {
              device: true,
            },
          },
        },
      });
    });

    it('should return null for non-existent group', async () => {
      mockPrisma.deviceGroup.findUnique.mockResolvedValue(null);

      const result = await groupsService.getGroupById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createGroup', () => {
    it('should create a group with name only', async () => {
      const mockGroup = {
        id: 'new-group',
        name: 'New Group',
        roomId: null,
        room: null,
        devices: [],
      };

      mockPrisma.deviceGroup.create.mockResolvedValue(mockGroup);

      const result = await groupsService.createGroup({ name: 'New Group' });

      expect(result).toEqual(mockGroup);
      expect(mockPrisma.deviceGroup.create).toHaveBeenCalledWith({
        data: {
          name: 'New Group',
          roomId: undefined,
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
    });

    it('should create a group with room assignment', async () => {
      const mockGroup = {
        id: 'new-group',
        name: 'Kitchen Lights',
        roomId: 'room-kitchen',
        room: { id: 'room-kitchen', name: 'Kitchen' },
        devices: [],
      };

      mockPrisma.deviceGroup.create.mockResolvedValue(mockGroup);

      const result = await groupsService.createGroup({
        name: 'Kitchen Lights',
        roomId: 'room-kitchen',
      });

      expect(result).toEqual(mockGroup);
      expect(mockPrisma.deviceGroup.create).toHaveBeenCalledWith({
        data: {
          name: 'Kitchen Lights',
          roomId: 'room-kitchen',
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
    });
  });

  describe('updateGroup', () => {
    it('should update a group name', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Updated Name',
        roomId: null,
        room: null,
        devices: [],
      };

      mockPrisma.deviceGroup.update.mockResolvedValue(mockGroup);

      const result = await groupsService.updateGroup('group-1', {
        name: 'Updated Name',
      });

      expect(result).toEqual(mockGroup);
      expect(mockPrisma.deviceGroup.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { name: 'Updated Name' },
        include: {
          room: true,
          devices: {
            include: {
              device: true,
            },
          },
        },
      });
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group', async () => {
      mockPrisma.deviceGroup.delete.mockResolvedValue({ id: 'group-1' });

      await groupsService.deleteGroup('group-1');

      expect(mockPrisma.deviceGroup.delete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
    });
  });

  describe('addDeviceToGroup', () => {
    it('should add a device to a group', async () => {
      const mockMembership = {
        deviceId: 'device-1',
        groupId: 'group-1',
      };

      mockPrisma.deviceGroupMembership.create.mockResolvedValue(mockMembership);

      const result = await groupsService.addDeviceToGroup('group-1', 'device-1');

      expect(result).toEqual(mockMembership);
      expect(mockPrisma.deviceGroupMembership.create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-1',
          deviceId: 'device-1',
        },
      });
    });
  });

  describe('removeDeviceFromGroup', () => {
    it('should remove a device from a group', async () => {
      const mockMembership = {
        deviceId: 'device-1',
        groupId: 'group-1',
      };

      mockPrisma.deviceGroupMembership.delete.mockResolvedValue(mockMembership);

      const result = await groupsService.removeDeviceFromGroup('group-1', 'device-1');

      expect(result).toEqual(mockMembership);
      expect(mockPrisma.deviceGroupMembership.delete).toHaveBeenCalledWith({
        where: {
          deviceId_groupId: {
            deviceId: 'device-1',
            groupId: 'group-1',
          },
        },
      });
    });

    it('should return null when membership does not exist (P2025 error)', async () => {
      const prismaError = new Error('Record not found');
      (prismaError as Error & { code: string }).code = 'P2025';
      mockPrisma.deviceGroupMembership.delete.mockRejectedValue(prismaError);

      const result = await groupsService.removeDeviceFromGroup('group-1', 'device-1');

      expect(result).toBeNull();
    });

    it('should rethrow other errors', async () => {
      const genericError = new Error('Database connection failed');
      mockPrisma.deviceGroupMembership.delete.mockRejectedValue(genericError);

      await expect(
        groupsService.removeDeviceFromGroup('group-1', 'device-1')
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getDevicesInGroup', () => {
    it('should return all devices in a group', async () => {
      const mockMemberships = [
        {
          device: {
            id: 'device-1',
            externalId: 'hue-1',
            name: 'Light 1',
            room: { id: 'room-1', name: 'Living Room' },
          },
        },
        {
          device: {
            id: 'device-2',
            externalId: 'hue-2',
            name: 'Light 2',
            room: null,
          },
        },
      ];

      mockPrisma.deviceGroupMembership.findMany.mockResolvedValue(mockMemberships);

      const result = await groupsService.getDevicesInGroup('group-1');

      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('hue-1');
      expect(result[1].externalId).toBe('hue-2');
    });
  });

  describe('getGroupsByRoom', () => {
    it('should return groups for a specific room', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Group 1',
          roomId: 'room-1',
          room: { id: 'room-1', name: 'Living Room' },
          devices: [],
        },
      ];

      mockPrisma.deviceGroup.findMany.mockResolvedValue(mockGroups);

      const result = await groupsService.getGroupsByRoom('room-1');

      expect(result).toEqual(mockGroups);
      expect(mockPrisma.deviceGroup.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
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
    });
  });
});
