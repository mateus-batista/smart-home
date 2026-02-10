import type { Light, DeviceGroup } from '../types/devices';
import { DeviceCard } from './DeviceCard';
import { ShadeCard } from './ShadeCard';
import { GroupCard } from './GroupCard';
import { RoomIcon } from './ui/RoomIcon';

export interface RoomSectionProps {
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
  onSetGroupState: (groupId: string, state: Partial<Light['state']>) => Promise<unknown>;
  onRefresh: () => void;
}

export function RoomSection({
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
            onUpdate={(state) => onUpdateDevice(shade.id, state)}
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
