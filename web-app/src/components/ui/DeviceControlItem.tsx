import { memo } from 'react';
import type { Light } from '../../types/devices';
import { isShadeDevice } from '../../types/devices';
import { ToggleSwitch } from './ToggleSwitch';
import { InlineSlider } from './Slider';
import { ShadeOpenCloseButtons } from './ShadeOpenCloseButtons';
import { StatusDot } from './StatusDot';

interface DeviceControlItemProps {
  device: Light;
  /** Pending brightness value while user is dragging slider */
  pendingBrightness?: number;
  /** Called when device power is toggled */
  onToggle: (device: Light) => void;
  /** Called while brightness slider is being dragged */
  onBrightnessChange: (deviceId: string, brightness: number) => void;
  /** Called when brightness slider is released */
  onBrightnessCommit: (deviceId: string, brightness: number) => void;
  /** Called for shade open/close buttons */
  onShadePreset?: (deviceId: string, brightness: number) => void;
  className?: string;
}

function DeviceControlItemComponent({
  device,
  pendingBrightness,
  onToggle,
  onBrightnessChange,
  onBrightnessCommit,
  onShadePreset,
  className = '',
}: DeviceControlItemProps) {
  const isShade = isShadeDevice(device);
  const displayValue = pendingBrightness ?? device.state.brightness;

  const handleToggle = () => {
    onToggle(device);
  };

  const handleOpen = () => {
    onShadePreset?.(device.id, 100);
  };

  const handleClose = () => {
    onShadePreset?.(device.id, 0);
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        device.state.on && device.reachable
          ? 'bg-zinc-800/80 border-zinc-600'
          : 'bg-zinc-800/40 border-zinc-700/50'
      } ${!device.reachable ? 'opacity-60' : ''} ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <StatusDot connected={device.reachable} />
          <div>
            <p className="font-medium text-white">{device.name}</p>
            <p className="text-xs text-zinc-500">
              {isShade ? 'Shade' : 'Light'}
              {!device.reachable && ' • Offline'}
            </p>
          </div>
        </div>

        {/* Toggle for lights, Open/Close for shades */}
        {isShade ? (
          <ShadeOpenCloseButtons
            visualOpenness={device.state.brightness}
            onOpen={handleOpen}
            onClose={handleClose}
            disabled={!device.reachable}
            size="sm"
          />
        ) : (
          <ToggleSwitch
            on={device.state.on}
            onChange={handleToggle}
            disabled={!device.reachable}
          />
        )}
      </div>

      {/* Brightness/Position Slider */}
      {device.reachable && (
        <InlineSlider
          value={displayValue}
          onChange={(value) => onBrightnessChange(device.id, value)}
          onCommit={() => onBrightnessCommit(device.id, displayValue)}
          min={0}
          max={100}
          disabled={!device.reachable}
          label={isShade ? 'Position' : 'Brightness'}
          valueDisplay={`${displayValue}%`}
          fillColor={isShade ? 'rgba(59, 130, 246, 0.6)' : 'rgba(251, 191, 36, 0.6)'}
        />
      )}
    </div>
  );
}

export const DeviceControlItem = memo(DeviceControlItemComponent);
