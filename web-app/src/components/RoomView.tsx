import { useMemo, useState } from 'react';
import type { Room, Light, DeviceGroup } from '../types/devices';
import { isShadeDevice } from '../types/devices';
import { DeviceCard } from './DeviceCard';
import { ShadeCard } from './ShadeCard';
import { GroupCard } from './GroupCard';
import { getRoomIcon } from '../utils/rooms';

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
  icon: string;
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
  isCollapsible?: boolean;
}

function RoomSection({
  icon,
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
  isCollapsible = true,
}: RoomSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalDevices = lights.length + shades.length;
  const hasContent = totalDevices > 0 || groups.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mb-8">
      {/* Room header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
          className={`flex items-center gap-3 ${isCollapsible ? 'hover:opacity-80' : ''} transition-opacity`}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-xl">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {title}
              {isCollapsible && (
                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </h2>
            <p className="text-xs text-zinc-500">
              {totalDevices} device{totalDevices !== 1 ? 's' : ''}
              {groups.length > 0 && ` • ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </button>
      </div>

      {/* Content - All devices and groups in a single grid */}
      {!isCollapsed && (
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
      )}
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
      icon: string;
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
        icon: getRoomIcon(room.name),
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
        icon: '📦',
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
          icon={data.icon}
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
          isCollapsible={roomData.length > 1}
        />
      ))}

      {/* Empty state when no rooms have devices */}
      {roomData.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center text-3xl">
            🏠
          </div>
          <p className="text-zinc-400 font-medium">No rooms with devices</p>
          <p className="text-zinc-500 text-sm mt-1">Create a room and assign devices to it</p>
        </div>
      )}
    </div>
  );
}
