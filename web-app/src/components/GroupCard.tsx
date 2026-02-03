import { useState, useMemo, memo } from 'react';
import type { DeviceGroup, Light, DeviceIconType } from '../types/devices';
import { getGroupType, getGroupIconType } from '../types/devices';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

// Icon component that renders appropriate icon based on device type
function GroupIcon({ iconType, isOn, position }: { iconType: DeviceIconType | 'empty'; isOn: boolean; position: number }) {
  const shadeActive = position > 50;

  switch (iconType) {
    case 'bulb':
      // Light bulb icon
      return (
        <svg className={`w-8 h-8 transition-colors ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v1m0 18v1m9-10h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6a6 6 0 00-3 11.197V19a1 1 0 001 1h4a1 1 0 001-1v-1.803A6 6 0 0012 6z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
        </svg>
      );

    case 'strip':
      // Strip light icon
      return (
        <svg className={`w-8 h-8 transition-colors ${isOn ? 'text-violet-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="10" width="20" height="4" rx="1" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
          {isOn && (
            <>
              <circle cx="6" cy="12" r="1" fill="currentColor" />
              <circle cx="10" cy="12" r="1" fill="currentColor" />
              <circle cx="14" cy="12" r="1" fill="currentColor" />
              <circle cx="18" cy="12" r="1" fill="currentColor" />
            </>
          )}
        </svg>
      );

    case 'nanoleaf':
      // Nanoleaf panels icon (triangles)
      return (
        <svg className={`w-8 h-8 transition-colors ${isOn ? 'text-green-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3L4 17h16L12 3z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
          <path d="M8 17l4 4 4-4" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
        </svg>
      );

    case 'blind-tilt':
      // Blind tilt icon with horizontal slats
      return (
        <svg className={`w-8 h-8 transition-colors ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          {/* Tilted slats */}
          <line x1="5" y1="7" x2="19" y2="7" strokeWidth="2" transform={`rotate(${shadeActive ? 15 : 0} 12 7)`} />
          <line x1="5" y1="11" x2="19" y2="11" strokeWidth="2" transform={`rotate(${shadeActive ? 15 : 0} 12 11)`} />
          <line x1="5" y1="15" x2="19" y2="15" strokeWidth="2" transform={`rotate(${shadeActive ? 15 : 0} 12 15)`} />
        </svg>
      );

    case 'curtain':
      // Curtain icon
      return (
        <svg className={`w-8 h-8 transition-colors ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          {/* Curtain panels */}
          <path d={`M3 3 Q7 12, 3 21`} fill="currentColor" fillOpacity={shadeActive ? 0.2 : 0.4} />
          <path d={`M21 3 Q17 12, 21 21`} fill="currentColor" fillOpacity={shadeActive ? 0.2 : 0.4} />
          {!shadeActive && (
            <>
              <path d="M8 3 Q10 12, 8 21" fill="currentColor" fillOpacity="0.3" />
              <path d="M16 3 Q14 12, 16 21" fill="currentColor" fillOpacity="0.3" />
            </>
          )}
        </svg>
      );

    case 'roller-shade':
      // Roller shade icon
      return (
        <svg className={`w-8 h-8 transition-colors ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          {/* Shade fabric */}
          <rect x="4" y="4" width="16" height={16 - (position / 100) * 14} fill="currentColor" fillOpacity="0.4" />
          {/* Pull cord */}
          <line x1="12" y1={6 + (16 - (position / 100) * 14)} x2="12" y2="19" strokeWidth="1" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </svg>
      );

    case 'generic-shade':
      // Generic shade/window icon
      return (
        <svg className={`w-8 h-8 transition-colors ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="4" y="4" width="16" height={16 - (position / 100) * 14} fill="currentColor" fillOpacity="0.4" />
          <line x1="12" y1="3" x2="12" y2="21" strokeOpacity="0.3" />
          <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.3" />
        </svg>
      );

    case 'generic-light':
    case 'empty':
    default:
      // Light bulb icon (default for lights)
      return (
        <svg className={`w-8 h-8 transition-colors ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v1m0 18v1m9-10h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6a6 6 0 00-3 11.197V19a1 1 0 001 1h4a1 1 0 001-1v-1.803A6 6 0 0012 6z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
        </svg>
      );
  }
}

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

    // For shades, calculate average position
    const reachableDevices = groupDevices.filter(d => d.reachable);
    const avgPosition = reachableDevices.length > 0
      ? Math.round(reachableDevices.reduce((sum, d) => sum + d.state.brightness, 0) / reachableDevices.length)
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
      'from-purple-500/15 to-pink-500/15',
      'from-blue-500/15 to-cyan-500/15',
      'from-amber-500/15 to-orange-500/15',
      'from-green-500/15 to-emerald-500/15',
      'from-rose-500/15 to-red-500/15',
      'from-indigo-500/15 to-violet-500/15',
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div
      onClick={onEdit}
      className={`
        aspect-square flex flex-col items-center justify-between p-3 rounded-xl cursor-pointer
        transition-all hover:scale-[1.02] border border-white/10
        bg-linear-to-br ${getGradient()}
      `}
    >
      {/* Icon - centered and larger */}
      <div className="flex-1 flex items-center justify-center">
        <div className={`p-3 rounded-xl bg-white/10 ${isOn ? 'shadow-lg shadow-white/10' : ''}`}>
          <GroupIcon
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
