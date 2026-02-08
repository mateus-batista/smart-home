import { useMemo } from 'react';
import type { Room, Light, DeviceGroup } from '../types/devices';
import { isShadeDevice } from '../types/devices';
import { DeviceCard } from './DeviceCard';
import { ShadeCard } from './ShadeCard';
import { GroupCard } from './GroupCard';
import { RoomIcon } from './ui/RoomIcon';

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
  onSetGroupState: (groupId: string, state: { on?: boolean; brightness?: number }) => Promise<unknown>;
  onDeleteRoom: (id: string) => Promise<void>;
  onRefresh: () => void;
}

interface RoomSectionProps {
  title: string;
  lights: Light[];
  shades: Light[];
  groups: DeviceGroup[];
  allDevices: Light[];
  onToggleDevice: (deviceId: string) => void;
  onUpdateDevice: (deviceId: string, state: Partial<Light['state']>) => Promise<void>;
  onSelectDevice: (device: Light) => void;
  onSelectShade: (device: Light) => void;
  onAssignDeviceRoom: (device: Light) => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onSetGroupState: (groupId: string, state: { on?: boolean; brightness?: number }) => Promise<unknown>;
  onRefresh: () => void;
}

function RoomSection({
  title,
  lights,
  shades,
  groups,
  allDevices,
  onToggleDevice,
  onUpdateDevice,
  onSelectDevice,
  onSelectShade,
  onAssignDeviceRoom,
  onEditGroup,
  onDeleteGroup,
  onSetGroupState,
  onRefresh,
}: RoomSectionProps) {
  const totalDevices = lights.length + shades.length;
  const hasContent = totalDevices > 0 || groups.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mb-8">
      {/* Room header — pill-on-line divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-pill shrink-0">
          <RoomIcon name={title} className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="text-xs text-zinc-500 ml-1">
            {totalDevices} device{totalDevices !== 1 ? 's' : ''}
            {groups.length > 0 && ` · ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      {/* Content - All devices and groups in a single grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {/* Groups */}
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            devices={allDevices}
            onToggle={async (on) => {
              await onSetGroupState(group.id, { on });
              setTimeout(onRefresh, 300);
            }}
            onBrightnessChange={async (brightness) => {
              await onSetGroupState(group.id, { brightness });
              setTimeout(onRefresh, 300);
            }}
            onDelete={() => onDeleteGroup(group.id)}
            onEdit={() => onEditGroup(group.id)}
          />
        ))}

        {/* Shades */}
        {shades.map((shade) => (
          <ShadeCard
            key={shade.id}
            device={shade}
            onPositionChange={(position) => onUpdateDevice(shade.id, { brightness: position, on: position > 0 })}
            onClick={() => onSelectShade(shade)}
            onAssignRoom={() => onAssignDeviceRoom(shade)}
          />
        ))}

        {/* Lights */}
        {lights.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onToggle={() => onToggleDevice(device.id)}
            onBrightnessChange={() => {}}
            onClick={() => onSelectDevice(device)}
            onAssignRoom={() => onAssignDeviceRoom(device)}
          />
        ))}
      </div>
    </div>
  );
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
