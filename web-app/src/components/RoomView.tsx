import { useMemo, useState, useRef, useEffect } from 'react';
import type { Room, Light, DeviceGroup } from '../types/devices';
import { isShadeDevice } from '../types/devices';
import { DeviceCard } from './DeviceCard';
import { ShadeCard } from './ShadeCard';
import { GroupCard } from './GroupCard';
import { getRoomIcon } from '../utils/rooms';
import { LoadingSpinner } from './ui/LoadingSpinner';

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
  onCreateRoom: (name: string) => Promise<Room>;
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
  onCreateRoom,
  onDeleteRoom,
  onRefresh,
}: RoomViewProps) {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating
  useEffect(() => {
    if (isCreatingRoom && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingRoom]);

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

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsLoading(true);
    try {
      await onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setIsCreatingRoom(false);
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Add room button */}
      <div className="mt-6 pt-6 border-t border-zinc-800">
        {isCreatingRoom ? (
          <div className="flex items-center gap-2 max-w-sm">
            <input
              ref={inputRef}
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRoom();
                if (e.key === 'Escape') {
                  setIsCreatingRoom(false);
                  setNewRoomName('');
                }
              }}
              placeholder="Room name..."
              className="flex-1 py-2.5 px-4 bg-zinc-800 border border-zinc-600 rounded-xl text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
            />
            <button
              onClick={handleCreateRoom}
              disabled={isLoading || !newRoomName.trim()}
              className="p-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 rounded-xl transition-colors"
            >
              {isLoading ? (
                <LoadingSpinner size="md" color="white" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <button
              onClick={() => {
                setIsCreatingRoom(false);
                setNewRoomName('');
              }}
              className="p-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingRoom(true)}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700 hover:border-zinc-500 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Room</span>
          </button>
        )}
      </div>
    </div>
  );
}
