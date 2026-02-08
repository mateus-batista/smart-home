import { memo } from 'react';
import type { Light } from '../types/devices';
import { ToggleSwitch } from './ui/ToggleSwitch';

interface DeviceCardProps {
  device: Light;
  onToggle: () => void;
  onBrightnessChange: (brightness: number) => void;
  onClick: () => void;
  onAssignRoom?: () => void;
}

function DeviceCardComponent({ device, onToggle, onClick }: DeviceCardProps) {
  const { state, name, type, reachable } = device;

  const getIconColor = () => {
    if (!state.on || !reachable) return 'text-zinc-500';
    if (state.color) return 'text-white';
    return 'text-amber-400';
  };

  const getTypeIcon = () => {
    if (type === 'nanoleaf') {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 19h20L12 2zm0 4l6.5 11h-13L12 6z" />
        </svg>
      );
    }
    if (type === 'switchbot') {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="9" opacity="0.3" />
          <circle cx="12" cy="12" r="5" />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm2 15H10v-1h4v1zm0-2H10v-1h4v1zm1.5-4.59l-.5.34V12h-6v-1.25l-.5-.34A4.996 4.996 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.62-.78 3.14-2.5 4.41z" />
      </svg>
    );
  };

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
          className={`p-3 rounded-xl ${state.on && reachable ? 'bg-white/10' : 'bg-zinc-700/50'}`}
          style={
            state.on && state.color
              ? { backgroundColor: `hsla(${state.color.hue}, ${state.color.saturation}%, 50%, 0.2)` }
              : {}
          }
        >
          <span className={getIconColor()}>{getTypeIcon()}</span>
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
