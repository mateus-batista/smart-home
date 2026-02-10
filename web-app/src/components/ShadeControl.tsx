import { useState } from 'react';
import type { Light, DeviceState, TiltPosition } from '../types/devices';
import { Modal, ModalHeader, ModalContent } from './ui/Modal';
import { Slider } from './ui/Slider';
import { ShadeVisual } from './ui/ShadeVisual';
import { TILT_LABELS } from '../utils/shadeHelpers';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';
import { TiltBlindControl } from './ui/TiltBlindControl';
import { HideDeviceButton } from './ui/HideDeviceButton';

interface ShadeControlProps {
  device: Light;
  onUpdate: (state: Partial<DeviceState>) => void;
  onClose: () => void;
  onToggleHidden?: (hidden: boolean) => void;
}

export function ShadeControl({ device, onUpdate, onClose, onToggleHidden }: ShadeControlProps) {
  const isTilt = device.deviceType === 'Blind Tilt';

  // Tilt state
  const [localTiltPosition, setLocalTiltPosition] = useState<TiltPosition>(
    device.state.tiltPosition ?? 'open'
  );

  // Regular shade state
  const [localPosition, setLocalPosition] = useState(device.state.brightness);

  const handleTiltChange = (position: TiltPosition) => {
    setLocalTiltPosition(position);
    onUpdate({ tiltPosition: position, on: position === 'open' });
  };

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
    if (isTilt) {
      handleTiltChange('open');
    } else {
      handlePreset(100);
    }
  };

  const handleClose = () => {
    if (isTilt) {
      handleTiltChange('closed-down');
    } else {
      handlePreset(0);
    }
  };

  const getPreviewStyle = () => {
    const openness = localPosition / 100;
    const skyBlue = `hsl(210, ${60 + openness * 20}%, ${20 + openness * 30}%)`;
    return {
      backgroundColor: skyBlue,
      boxShadow: openness > 0.3 ? `0 0 60px hsla(210, 80%, 50%, ${openness * 0.3})` : 'none',
    };
  };

  const getStatusText = () => {
    if (isTilt) {
      return TILT_LABELS[localTiltPosition];
    }
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
      <ModalHeader onClose={onClose} style={isTilt ? undefined : getPreviewStyle()}>
        <div className="text-center pt-4">
          <h2 className="text-2xl font-semibold text-white drop-shadow-lg">{device.name}</h2>
          <p className="text-white/70 mt-1">
            {device.deviceType || 'Smart Shade'} • {getStatusText()}
          </p>
          {!isTilt && (
            <ShadeVisual position={localPosition} isBlindTilt={false} className="mt-4" />
          )}
        </div>
      </ModalHeader>

      {/* Controls */}
      <ModalContent>
        {isTilt ? (
          /* Tilt blind: interactive visual control */
          <TiltBlindControl
            position={localTiltPosition}
            onPositionChange={handleTiltChange}
            disabled={!device.reachable}
          />
        ) : (
          /* Regular shade controls */
          <>
            {/* Quick presets */}
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Presets</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
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
              visualOpenness={localPosition}
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
              label="Position"
              valueDisplay={`${localPosition}% open`}
              gradient="linear-gradient(to right, #374151, #3b82f6, #87ceeb)"
              hints={{ start: 'Closed', end: 'Open' }}
            />
          </>
        )}

        {/* Hide device option */}
        {onToggleHidden && (
          <HideDeviceButton hidden={!!device.hidden} onClick={handleToggleHidden} />
        )}
      </ModalContent>
    </Modal>
  );
}
