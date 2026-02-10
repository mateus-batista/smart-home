import { useState, useMemo, memo } from 'react';
import type { DeviceGroup, Light } from '../types/devices';
import { getGroupType, getGroupIconType } from '../types/devices';
import { TILT_VISUAL_OPENNESS } from '../utils/shadeHelpers';
import { DeviceIcon } from './icons/DeviceIcons';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

interface GroupCardProps {
  group: DeviceGroup;
  devices: Light[]; // Actual device states
  onToggle: (on: boolean) => Promise<void>;
  onBrightnessChange: (brightness: number) => Promise<void>;
  onDelete: () => void;
  onEdit: () => void;
}

function GroupCardComponent({ group, devices, onToggle, onBrightnessChange, onEdit }: GroupCardProps) {
  const [isControlling, setIsControlling] = useState(false);

  const deviceCount = group.devices?.length ?? 0;

  // Get actual device objects that are in this group
  const groupDevices = useMemo(() => {
    const groupDeviceIds = new Set(group.devices?.map(d => d.device.externalId) ?? []);
    return devices.filter(d => groupDeviceIds.has(d.id));
  }, [devices, group.devices]);

  // Determine group type and icon
  const groupType = useMemo(() => getGroupType(groupDevices), [groupDevices]);
  const groupIconType = useMemo(() => getGroupIconType(groupDevices), [groupDevices]);
  const isShadeGroup = groupType === 'shade';

  // Derive state from actual devices
  const derivedState = useMemo(() => {
    if (groupDevices.length === 0) {
      return { isOn: false, anyOn: false, position: 0 };
    }
    
    const onDevices = groupDevices.filter(d => d.state.on && d.reachable);
    const anyOn = onDevices.length > 0;

    // For shades, calculate average visual openness (converting per-device brightness)
    const reachableDevices = groupDevices.filter(d => d.reachable);
    const avgPosition = reachableDevices.length > 0
      ? Math.round(reachableDevices.reduce((sum, d) => {
          if (d.deviceType === 'Blind Tilt') {
            return sum + TILT_VISUAL_OPENNESS[d.state.tiltPosition ?? 'open'];
          }
          return sum + d.state.brightness;
        }, 0) / reachableDevices.length)
      : 0;
    
    return { isOn: anyOn, anyOn, position: avgPosition };
  }, [groupDevices]);

  const { isOn, anyOn, position: derivedPosition } = derivedState;

  const handleToggle = async () => {
    if (deviceCount === 0) return;
    
    const newState = !anyOn;
    setIsControlling(true);
    try {
      await onToggle(newState);
    } finally {
      setTimeout(() => setIsControlling(false), 500);
    }
  };

  const handleOpen = async () => {
    if (deviceCount === 0) return;
    setIsControlling(true);
    try {
      await onBrightnessChange(100);
    } finally {
      setTimeout(() => setIsControlling(false), 500);
    }
  };

  const handleClose = async () => {
    if (deviceCount === 0) return;
    setIsControlling(true);
    try {
      await onBrightnessChange(0);
    } finally {
      setTimeout(() => setIsControlling(false), 500);
    }
  };

  // Generate gradient based on group name hash
  const getGradient = () => {
    const hash = group.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-amber-500/15 to-yellow-500/15',
      'from-rose-500/15 to-pink-500/15',
      'from-yellow-600/15 to-amber-400/15',
      'from-orange-500/15 to-amber-500/15',
      'from-rose-400/15 to-rose-600/15',
      'from-amber-400/15 to-orange-400/15',
    ];
    return gradients[hash % gradients.length];
  };

  // Subtle glow when on (light groups only)
  const glowStyle = isOn && !isShadeGroup
    ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.15)' }
    : {};

  return (
    <div
      onClick={onEdit}
      className={`
        aspect-square flex flex-col items-center justify-between p-3 rounded-2xl cursor-pointer
        transition-all hover:scale-[1.02] glass-card
        bg-linear-to-br ${getGradient()}
      `}
      style={glowStyle}
    >
      {/* Icon - centered and larger */}
      <div className="flex-1 flex items-center justify-center">
        <div className={`p-3 rounded-xl bg-white/10 ${isOn ? 'shadow-lg shadow-white/10' : ''}`}>
          <DeviceIcon
            iconType={groupIconType}
            isOn={isOn}
            position={derivedPosition}
          />
        </div>
      </div>

      {/* Name and count */}
      <div className="w-full text-center mb-2">
        <h3 className="font-medium text-white truncate text-sm">{group.name}</h3>
        <p className="text-xs text-zinc-500">{deviceCount} device{deviceCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Toggle for lights, Open/Close buttons for shades */}
      {isShadeGroup ? (
        <ShadeOpenCloseButtons
          visualOpenness={derivedPosition}
          onOpen={handleOpen}
          onClose={handleClose}
          disabled={deviceCount === 0}
          loading={isControlling}
          size="sm"
        />
      ) : (
        <ToggleSwitch
          on={isOn}
          onChange={handleToggle}
          disabled={deviceCount === 0}
          loading={isControlling}
        />
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export const GroupCard = memo(GroupCardComponent);
