import { useState } from 'react';
import type { Light, DeviceState } from '../types/devices';
import { Modal, ModalHeader, ModalContent } from './ui/Modal';
import { Slider } from './ui/Slider';
import { ShadeVisual } from './ui/ShadeVisual';
import { getVisualOpenness } from '../utils/shadeHelpers';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';

interface ShadeControlProps {
  device: Light;
  onUpdate: (state: Partial<DeviceState>) => void;
  onClose: () => void;
  onToggleHidden?: (hidden: boolean) => void;
}

// Check if device is a Blind Tilt type
function isBlindTilt(device: Light): boolean {
  return device.deviceType === 'Blind Tilt';
}

export function ShadeControl({ device, onUpdate, onClose, onToggleHidden }: ShadeControlProps) {
  // Position: brightness maps to openness (100 = fully open, 0 = closed)
  // For Blind Tilt: 50 = fully open (horizontal slats)
  const [localPosition, setLocalPosition] = useState(device.state.brightness);
  const isTilt = isBlindTilt(device);
  const visualOpenness = getVisualOpenness(localPosition);

  const handlePositionChange = (position: number) => {
    setLocalPosition(position);
  };

  const handlePositionCommit = () => {
    onUpdate({ brightness: localPosition, on: localPosition > 0 });
  };

  const handlePreset = (position: number) => {
    setLocalPosition(position);
    onUpdate({ brightness: position, on: position > 0 });
  };

  const handleOpen = () => {
    handlePreset(100);
  };

  const handleClose = () => {
    handlePreset(0);
  };

  const getPreviewStyle = () => {
    // Sky blue gradient based on visual openness
    const openness = visualOpenness / 100;
    const skyBlue = `hsl(210, ${60 + openness * 20}%, ${20 + openness * 30}%)`;
    return {
      backgroundColor: skyBlue,
      boxShadow: openness > 0.3 ? `0 0 60px hsla(210, 80%, 50%, ${openness * 0.3})` : 'none',
    };
  };

  const getStatusText = () => {
    // Same logic for both Blind Tilt and regular shades: 0 = closed, 100 = open
    if (localPosition >= 100) return 'Fully Open';
    if (localPosition <= 0) return 'Fully Closed';
    return `${localPosition}% Open`;
  };

  const handleToggleHidden = () => {
    if (onToggleHidden) {
      onToggleHidden(!device.hidden);
      onClose();
    }
  };

  return (
    <Modal onClose={onClose}>
      {/* Header with preview */}
      <ModalHeader onClose={onClose} style={getPreviewStyle()}>
        <div className="text-center pt-4">
          <h2 className="text-2xl font-semibold text-white drop-shadow-lg">{device.name}</h2>
          <p className="text-white/70 mt-1">
            {device.deviceType || 'Smart Shade'} • {getStatusText()}
          </p>
          <ShadeVisual position={localPosition} isBlindTilt={isTilt} className="mt-4" />
        </div>
      </ModalHeader>

      {/* Controls */}
      <ModalContent>
        {/* Quick presets */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Presets</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
                  // Same presets for both Blind Tilt and regular shades: 0 = closed, 100 = open
                  { label: 'Closed', value: 0, icon: '🌙' },
                  { label: '25%', value: 25, icon: '🌤️' },
                  { label: '50%', value: 50, icon: '⛅' },
                  { label: '75%', value: 75, icon: '🌥️' },
                ].map(({ label, value, icon }) => (
              <button
                key={value}
                onClick={() => handlePreset(value)}
                disabled={!device.reachable}
                className={`p-3 rounded-xl text-center transition-all ${
                  localPosition === value
                    ? 'bg-blue-500/30 border-blue-500 border'
                    : 'glass-pill hover:bg-white/10'
                } ${!device.reachable ? 'opacity-50' : ''}`}
              >
                <span className="text-xl">{icon}</span>
                <p className="text-xs mt-1">{label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Open/Close buttons */}
        <ShadeOpenCloseButtons
          visualOpenness={visualOpenness}
          onOpen={handleOpen}
          onClose={handleClose}
          disabled={!device.reachable}
          size="lg"
        />

        {/* Position slider */}
        <Slider
          value={localPosition}
          onChange={handlePositionChange}
          onCommit={handlePositionCommit}
          min={0}
          max={100}
          disabled={!device.reachable}
          label={isTilt ? 'Tilt Angle' : 'Position'}
          valueDisplay={`${visualOpenness}% open`}
          gradient="linear-gradient(to right, #374151, #3b82f6, #87ceeb)"
          hints={{ start: 'Closed', end: 'Open' }}
        />

        {/* Device info */}
        <div className="pt-4 border-t border-white/[0.06]">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Type</span>
            <span className="text-zinc-300">{device.deviceType || 'Smart Shade'}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-zinc-500">Status</span>
            <span className={device.reachable ? 'text-amber-400' : 'text-red-400'}>
              {device.reachable ? 'Online' : 'Offline'}
            </span>
          </div>
          {device.roomName && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-zinc-500">Room</span>
              <span className="text-zinc-300">{device.roomName}</span>
            </div>
          )}
        </div>

        {/* Hide device option */}
        {onToggleHidden && (
          <div className="pt-4 border-t border-white/[0.06]">
            <button
              onClick={handleToggleHidden}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
                device.hidden
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'glass-pill text-zinc-400 hover:bg-white/10 hover:text-zinc-300'
              }`}
            >
              {device.hidden ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show Device
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide Device
                </>
              )}
            </button>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
