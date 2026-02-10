import { memo } from 'react';
import type { Light } from '../types/devices';
import { getDeviceIconType } from '../types/devices';
import { DeviceIcon } from './icons/DeviceIcons';
import { ToggleSwitch } from './ui/ToggleSwitch';

interface DeviceCardProps {
  device: Light;
  onToggle: () => void;
  onBrightnessChange: (brightness: number) => void;
  onClick: () => void;
  onAssignRoom?: () => void;
}

function DeviceCardComponent({ device, onToggle, onClick }: DeviceCardProps) {
  const { state, name, reachable } = device;

  const isOn = state.on && reachable;
  const iconType = getDeviceIconType(device);

  // Subtle glow when on
  const glowStyle = state.on && reachable
    ? state.color
      ? { boxShadow: `0 0 20px hsla(${state.color.hue}, ${state.color.saturation}%, 50%, 0.2)` }
      : { boxShadow: '0 0 20px rgba(251, 191, 36, 0.15)' }
    : {};

  return (
    <div
      className={`
        aspect-square flex flex-col items-center justify-between p-3 rounded-2xl cursor-pointer
        transition-all hover:scale-[1.02] glass-card
        ${!reachable ? 'opacity-60' : ''}
      `}
      style={glowStyle}
      onClick={onClick}
    >
      {/* Icon - centered and larger */}
      <div className="flex-1 flex items-center justify-center">
        <div
          className={`p-3 rounded-xl ${isOn ? 'bg-white/10' : 'bg-zinc-700/50'}`}
          style={
            state.on && state.color
              ? { backgroundColor: `hsla(${state.color.hue}, ${state.color.saturation}%, 50%, 0.2)` }
              : {}
          }
        >
          <DeviceIcon iconType={iconType} isOn={isOn} />
        </div>
      </div>

      {/* Name */}
      <div className="w-full text-center mb-2">
        <h3 className="font-medium text-white truncate text-sm">{name}</h3>
        {!reachable && <p className="text-xs text-zinc-500">Offline</p>}
      </div>

      {/* Toggle */}
      <ToggleSwitch
        on={state.on}
        onChange={onToggle}
        disabled={!reachable}
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export const DeviceCard = memo(DeviceCardComponent);
