import { useMemo } from 'react';
import type { Room, Light, DeviceGroup } from '../types/devices';
import { isShadeDevice } from '../types/devices';
import { RoomSection } from './RoomSection';

interface RoomViewProps {
  rooms: Room[];
  devices: Light[];
  allDevices: Light[]; // All devices including hidden (for group operations)
  groups: DeviceGroup[];
  onToggleDevice: (deviceId: string) => void;
  onSetBrightness: (deviceId: string, brightness: number) => void;
  onUpdateDevice: (deviceId: string, state: Partial<Light['state']>) => Promise<void>;
  onSelectDevice: (device: Light) => void;
  onSelectShade: (device: Light) => void;
  onAssignDeviceRoom: (device: Light) => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onSetGroupState: (groupId: string, state: Partial<Light['state']>) => Promise<unknown>;
  onDeleteRoom: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export function RoomView({
  rooms,
  devices,
  allDevices,
  groups,
  onToggleDevice,
  onUpdateDevice,
  onSelectDevice,
  onSelectShade,
  onAssignDeviceRoom,
  onEditGroup,
  onDeleteGroup,
  onSetGroupState,
  onDeleteRoom: _onDeleteRoom,
  onRefresh,
}: RoomViewProps) {
  // onDeleteRoom is available for future use
  void _onDeleteRoom;
  // Organize devices and groups by room
  const roomData = useMemo(() => {
    const data: Array<{
      room: Room | null;
      title: string;
      lights: Light[];
      shades: Light[];
      groups: DeviceGroup[];
    }> = [];

    // Add each room with its devices and groups
    for (const room of rooms) {
      const roomDevices = devices.filter((d) => d.roomId === room.id);
      const roomGroups = groups.filter((g) => g.roomId === room.id);

      data.push({
        room,
        title: room.name,
        lights: roomDevices.filter((d) => !isShadeDevice(d)),
        shades: roomDevices.filter((d) => isShadeDevice(d)),
        groups: roomGroups,
      });
    }

    // Add unassigned devices and groups at the end
    const unassignedDevices = devices.filter((d) => !d.roomId);
    const unassignedGroups = groups.filter((g) => !g.roomId);

    if (unassignedDevices.length > 0 || unassignedGroups.length > 0) {
      data.push({
        room: null,
        title: 'Unassigned',
        lights: unassignedDevices.filter((d) => !isShadeDevice(d)),
        shades: unassignedDevices.filter((d) => isShadeDevice(d)),
        groups: unassignedGroups,
      });
    }

    return data;
  }, [rooms, devices, groups]);

  return (
    <div>
      {/* Room sections */}
      {roomData.map((data) => (
        <RoomSection
          key={data.room?.id ?? 'unassigned'}
          title={data.title}
          lights={data.lights}
          shades={data.shades}
          groups={data.groups}
          allDevices={allDevices}
          onToggleDevice={onToggleDevice}
          onUpdateDevice={onUpdateDevice}
          onSelectDevice={onSelectDevice}
          onSelectShade={onSelectShade}
          onAssignDeviceRoom={onAssignDeviceRoom}
          onEditGroup={onEditGroup}
          onDeleteGroup={onDeleteGroup}
          onSetGroupState={onSetGroupState}
          onRefresh={onRefresh}
        />
      ))}

      {/* Empty state when no rooms have devices */}
      {roomData.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass-pill flex items-center justify-center text-3xl">
            🏠
          </div>
          <p className="text-zinc-400 font-medium">No rooms with devices</p>
          <p className="text-zinc-500 text-sm mt-1">Create a room and assign devices to it</p>
        </div>
      )}
    </div>
  );
}
