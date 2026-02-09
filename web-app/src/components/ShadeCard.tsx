import { memo } from 'react';
import type { Light } from '../types/devices';
import { getVisualOpenness } from '../utils/shadeHelpers';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

interface ShadeCardProps {
  device: Light;
  onPositionChange: (position: number) => void;
  onClick: () => void;
  onAssignRoom?: () => void;
}

// Check if device is a Blind Tilt type
function isBlindTilt(device: Light): boolean {
  return device.deviceType === 'Blind Tilt';
}

function ShadeCardComponent({ device, onPositionChange, onClick }: ShadeCardProps) {
  const { state, name, reachable } = device;
  const position = state.brightness;
  const isTilt = isBlindTilt(device);
  const visualOpenness = getVisualOpenness(position, isTilt);

  // Get shade icon based on position
  const getShadeIcon = () => {
    const openPercent = visualOpenness;
    return (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect 
          x="4" 
          y="4" 
          width="16" 
          height={16 - (openPercent / 100) * 14} 
          fill="currentColor" 
          opacity="0.6"
        />
        <line x1="12" y1="3" x2="12" y2="21" strokeOpacity="0.3" />
        <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.3" />
      </svg>
    );
  };

  // Subtle glow when open
  const glowStyle = reachable && visualOpenness > 0
    ? { boxShadow: `0 0 20px rgba(59, 130, 246, ${(visualOpenness / 100) * 0.15})` }
    : {};

  const handleOpen = () => {
    onPositionChange(isTilt ? 0 : 100);
  };

  const handleClose = () => {
    onPositionChange(isTilt ? 100 : 0); // closes down for Blind Tilt
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
          <span className={visualOpenness > 0 ? 'text-blue-400' : 'text-zinc-500'}>
            {getShadeIcon()}
          </span>
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
