import { memo } from 'react';
import type { Light, DeviceState } from '../types/devices';
import { getDeviceIconType } from '../types/devices';
import { TILT_VISUAL_OPENNESS } from '../utils/shadeHelpers';
import { DeviceIcon } from './icons/DeviceIcons';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

interface ShadeCardProps {
  device: Light;
  onUpdate: (state: Partial<DeviceState>) => void;
  onClick: () => void;
  onAssignRoom?: () => void;
}

function ShadeCardComponent({ device, onUpdate, onClick }: ShadeCardProps) {
  const { state, name, reachable } = device;
  const isTilt = device.deviceType === 'Blind Tilt';
  const iconType = getDeviceIconType(device);

  // Visual openness for glow and icon (0-100)
  const visualOpenness = isTilt
    ? TILT_VISUAL_OPENNESS[state.tiltPosition ?? 'open']
    : state.brightness;

  // Subtle glow when open
  const glowStyle = reachable && visualOpenness > 0
    ? { boxShadow: `0 0 20px rgba(59, 130, 246, ${(visualOpenness / 100) * 0.15})` }
    : {};

  const handleOpen = () => {
    if (isTilt) {
      onUpdate({ tiltPosition: 'open', on: true });
    } else {
      onUpdate({ brightness: 100, on: true });
    }
  };

  const handleClose = () => {
    if (isTilt) {
      onUpdate({ tiltPosition: 'closed-down', on: false });
    } else {
      onUpdate({ brightness: 0, on: false });
    }
  };

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
        <div className={`p-3 rounded-xl ${visualOpenness > 50 ? 'bg-blue-500/20' : 'bg-zinc-700/50'}`}>
          <DeviceIcon iconType={iconType} isOn={true} position={visualOpenness} />
        </div>
      </div>

      {/* Name */}
      <div className="w-full text-center mb-2">
        <h3 className="font-medium text-white truncate text-sm">{name}</h3>
        {!reachable && <p className="text-xs text-zinc-500">Offline</p>}
      </div>

      {/* Open/Close buttons */}
      <ShadeOpenCloseButtons
        visualOpenness={visualOpenness}
        onOpen={handleOpen}
        onClose={handleClose}
        disabled={!reachable}
        size="sm"
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const ShadeCard = memo(ShadeCardComponent);
