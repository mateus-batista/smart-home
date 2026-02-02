import { useState, useMemo, memo } from 'react';
import type { DeviceGroup, Light } from '../types/devices';
import { isShadeDevice } from '../types/devices';
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
  const groupDeviceIds = new Set(group.devices?.map(d => d.device.externalId) ?? []);
  
  // Get actual device objects that are in this group
  const groupDevices = useMemo(() => 
    devices.filter(d => groupDeviceIds.has(d.id)),
    [devices, groupDeviceIds]
  );

  // Check if this is a shade group (majority of devices are shades)
  const isShadeGroup = useMemo(() => {
    if (groupDevices.length === 0) return false;
    const shadeCount = groupDevices.filter(d => isShadeDevice(d)).length;
    return shadeCount > groupDevices.length / 2;
  }, [groupDevices]);

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
          {isShadeGroup ? (
            <svg 
              className={`w-8 h-8 transition-colors ${derivedPosition > 50 ? 'text-blue-400' : 'text-zinc-400'}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect 
                x="4" 
                y="4" 
                width="16" 
                height={16 - (derivedPosition / 100) * 14} 
                fill="currentColor" 
                opacity="0.4"
              />
              <line x1="12" y1="3" x2="12" y2="21" strokeOpacity="0.3" />
              <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.3" />
            </svg>
          ) : (
            <svg 
              className={`w-8 h-8 transition-colors ${isOn ? 'text-white' : 'text-zinc-400'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
          )}
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
