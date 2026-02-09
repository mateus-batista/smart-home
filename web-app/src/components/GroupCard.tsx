import { useState, useMemo, memo } from 'react';
import type { DeviceGroup, Light, DeviceIconType } from '../types/devices';
import { getGroupType, getGroupIconType } from '../types/devices';
import { getVisualOpenness } from '../utils/shadeHelpers';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

// Icon component that renders appropriate icon based on device type
function GroupIcon({ iconType, isOn, position }: { iconType: DeviceIconType | 'empty'; isOn: boolean; position: number }) {
  const shadeActive = position > 50;
  const base = "w-8 h-8 transition-colors";
  const lc = "round" as const; // strokeLinecap/strokeLinejoin shorthand

  switch (iconType) {
    case 'bulb':
      return (
        <svg className={`${base} ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Bulb body */}
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.25 : 0} />
          {/* Glow rays */}
          {isOn && (
            <>
              <path d="M12 0v1" strokeOpacity="0.4" />
              <path d="M4.2 4.2l.7.7" strokeOpacity="0.4" />
              <path d="M1 12h1" strokeOpacity="0.4" />
              <path d="M22 12h1" strokeOpacity="0.4" />
              <path d="M19.1 4.9l-.7.7" strokeOpacity="0.4" />
            </>
          )}
        </svg>
      );

    case 'strip':
      return (
        <svg className={`${base} ${isOn ? 'text-violet-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* LED strip body */}
          <rect x="1" y="9.5" width="22" height="5" rx="2.5" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
          {/* Individual LEDs */}
          <circle cx="5.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
          <circle cx="9.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
          <circle cx="13.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
          <circle cx="17.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
          {/* Glow halos when on */}
          {isOn && (
            <>
              <circle cx="5.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
              <circle cx="9.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
              <circle cx="13.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
              <circle cx="17.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
            </>
          )}
        </svg>
      );

    case 'nanoleaf':
      return (
        <svg className={`${base} ${isOn ? 'text-emerald-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Top panel */}
          <path d="M12 2L6 12h12L12 2z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
          {/* Bottom-left panel */}
          <path d="M6 12l-3 9h9L6 12z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
          {/* Bottom-right panel */}
          <path d="M18 12l-6 9h9l-3-9z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.25 : 0} />
        </svg>
      );

    case 'blind-tilt':
      return (
        <svg className={`${base} ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Window frame */}
          <rect x="3" y="2" width="18" height="20" rx="2.5" />
          {/* Horizontal slats — rotate when active (open) */}
          <g transform={`rotate(${shadeActive ? 20 : 0} 12 7)`}><line x1="6" y1="7" x2="18" y2="7" strokeWidth="1.8" /></g>
          <g transform={`rotate(${shadeActive ? 20 : 0} 12 11)`}><line x1="6" y1="11" x2="18" y2="11" strokeWidth="1.8" /></g>
          <g transform={`rotate(${shadeActive ? 20 : 0} 12 15)`}><line x1="6" y1="15" x2="18" y2="15" strokeWidth="1.8" /></g>
          <g transform={`rotate(${shadeActive ? 20 : 0} 12 19)`}><line x1="6" y1="19" x2="18" y2="19" strokeWidth="1.8" /></g>
        </svg>
      );

    case 'curtain':
      return (
        <svg className={`${base} ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Curtain rod */}
          <line x1="2" y1="3" x2="22" y2="3" strokeWidth="2" />
          <circle cx="2" cy="3" r="1" fill="currentColor" stroke="none" />
          <circle cx="22" cy="3" r="1" fill="currentColor" stroke="none" />
          {/* Left drape */}
          <path d={shadeActive ? "M3 3c0 0 2 8 1 18" : "M3 3c0 0 6 6 5 18"} fill="currentColor" fillOpacity={shadeActive ? 0.15 : 0.3} />
          <path d={shadeActive ? "M5 3c0 0 2 8 1 18" : "M8 3c0 0 4 6 2 18"} fill="currentColor" fillOpacity={shadeActive ? 0.1 : 0.2} />
          {/* Right drape */}
          <path d={shadeActive ? "M21 3c0 0 -2 8 -1 18" : "M21 3c0 0 -6 6 -5 18"} fill="currentColor" fillOpacity={shadeActive ? 0.15 : 0.3} />
          <path d={shadeActive ? "M19 3c0 0 -2 8 -1 18" : "M16 3c0 0 -4 6 -2 18"} fill="currentColor" fillOpacity={shadeActive ? 0.1 : 0.2} />
        </svg>
      );

    case 'roller-shade': {
      const fabricH = Math.max(2, 16 - (position / 100) * 14);
      return (
        <svg className={`${base} ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Window frame */}
          <rect x="3" y="2" width="18" height="20" rx="2.5" />
          {/* Roller tube */}
          <rect x="4" y="3" width="16" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.35" stroke="none" />
          {/* Shade fabric */}
          <rect x="5" y="5.5" width="14" height={fabricH} rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="none" />
          {/* Bottom bar / pull */}
          <line x1="5" y1={5.5 + fabricH} x2="19" y2={5.5 + fabricH} strokeWidth="1.5" strokeOpacity="0.5" />
        </svg>
      );
    }

    case 'generic-shade': {
      const shadeH = Math.max(2, 16 - (position / 100) * 14);
      return (
        <svg className={`${base} ${shadeActive ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Window frame */}
          <rect x="3" y="2" width="18" height="20" rx="2.5" />
          {/* Window cross panes */}
          <line x1="12" y1="2" x2="12" y2="22" strokeOpacity="0.2" />
          <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.2" />
          {/* Shade overlay */}
          <rect x="3.75" y="2.75" width="16.5" height={shadeH} rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />
        </svg>
      );
    }

    case 'generic-light':
    case 'empty':
    default:
      return (
        <svg className={`${base} ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={lc} strokeLinejoin={lc}>
          {/* Pendant lamp */}
          <line x1="12" y1="1" x2="12" y2="5" />
          <path d="M7 5h10l-2 8H9L7 5z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.25 : 0} />
          <ellipse cx="12" cy="13" rx="3" ry="1" />
          {/* Glow */}
          {isOn && (
            <>
              <path d="M8 15l-2 5" strokeOpacity="0.3" />
              <path d="M16 15l2 5" strokeOpacity="0.3" />
              <path d="M12 14v6" strokeOpacity="0.3" />
            </>
          )}
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

    // For shades, calculate average visual openness (converting per-device brightness)
    const reachableDevices = groupDevices.filter(d => d.reachable);
    const avgPosition = reachableDevices.length > 0
      ? Math.round(reachableDevices.reduce((sum, d) => sum + getVisualOpenness(d.state.brightness, d.deviceType === 'Blind Tilt'), 0) / reachableDevices.length)
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

  return (
    <div
      onClick={onEdit}
      className={`
        aspect-square flex flex-col items-center justify-between p-3 rounded-2xl cursor-pointer
        transition-all hover:scale-[1.02] glass-card
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
