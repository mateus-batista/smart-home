import { useState } from 'react';
import type { Light, DeviceState } from '../types/devices';
import { ColorPicker } from './ColorPicker';
import { useNanoleafEffects } from '../hooks/useDevices';
import { Modal, ModalHeader, ModalContent } from './ui/Modal';
import { Slider } from './ui/Slider';
import { BulbControl } from './ui/BulbControl';

interface LightControlProps {
  device: Light;
  onUpdate: (state: Partial<DeviceState>) => void;
  onClose: () => void;
  onToggleHidden?: (hidden: boolean) => void;
}

export function LightControl({ device, onUpdate, onClose, onToggleHidden }: LightControlProps) {
  // Initialize localState once from device.state, don't sync afterwards
  // This prevents state from being overwritten while user is actively controlling
  const [localState, setLocalState] = useState(() => {
    console.log('[LightControl] Initializing with device.state:', device.state);
    return device.state;
  });
  const { effects, currentEffect, selectEffect, loading: effectsLoading } = useNanoleafEffects(
    device.type === 'nanoleaf' ? device.id : null
  );

  // Determine device capabilities
  const supportsColor = device.capabilities?.color ?? false;
  const supportsColorTemp = device.capabilities?.colorTemp ?? false;

  const handleBrightnessChange = (brightness: number) => {
    setLocalState((prev) => ({ ...prev, brightness }));
  };

  const handleBrightnessCommit = () => {
    onUpdate({ brightness: localState.brightness, on: localState.brightness > 0 });
  };

  const handleColorChange = (hue: number, saturation: number) => {
    setLocalState((prev) => ({
      ...prev,
      color: { hue, saturation, brightness: prev.brightness },
      colorMode: 'hs',
    }));
    onUpdate({ color: { hue, saturation, brightness: localState.brightness } });
  };

  const handleColorTempChange = (colorTemp: number) => {
    setLocalState((prev) => ({ ...prev, colorTemp, colorMode: 'ct' }));
  };

  const handleColorTempCommit = () => {
    console.log('[LightControl] Committing colorTemp:', localState.colorTemp);
    // Send colorTemp with on:true to ensure the light stays on
    onUpdate({ colorTemp: localState.colorTemp, on: true });
  };

  // Convert Kelvin to a warm-to-cool percentage for the slider
  const kelvinToPercent = (kelvin: number) => {
    // Range: 2000K (warm) to 6500K (cool)
    return Math.round(((kelvin - 2000) / 4500) * 100);
  };

  const percentToKelvin = (percent: number) => {
    return Math.round(2000 + (percent / 100) * 4500);
  };

  const getPreviewStyle = () => {
    if (!localState.on) return { backgroundColor: '#27272a' };
    
    if (localState.colorMode === 'hs' && localState.color) {
      const { hue, saturation } = localState.color;
      const lightness = 30 + (localState.brightness / 100) * 40;
      return {
        backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        boxShadow: `0 0 60px hsla(${hue}, ${saturation}%, 50%, 0.4)`,
      };
    }
    
    // Color temperature mode or default warm white
    const temp = localState.colorTemp || 3000;
    // Map temperature to a color (warm orange to cool blue-white)
    const warmth = 1 - (temp - 2000) / 4500;
    const hue = 30 + warmth * 10; // 30-40 range for warm
    const saturation = warmth * 60 + 20; // More saturated when warm
    const lightness = 40 + (localState.brightness / 100) * 35;
    
    return {
      backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      boxShadow: `0 0 60px hsla(${hue}, ${saturation}%, 50%, 0.3)`,
    };
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
        <div className="text-center pt-8">
          <h2 className="text-2xl font-semibold text-white drop-shadow-lg">{device.name}</h2>
          <p className="text-white/70 capitalize mt-1">
            {device.type === 'nanoleaf' ? 'Nanoleaf' : device.type === 'switchbot' ? 'SwitchBot' : 'Philips Hue'} • {device.model || 'Light'}
          </p>
        </div>
      </ModalHeader>

      {/* Controls */}
      <ModalContent>
        {/* Bulb visualization (non-Nanoleaf lights) */}
        {device.type !== 'nanoleaf' && (
          <BulbControl
            brightness={localState.brightness}
            onBrightnessChange={(brightness) => {
              setLocalState((prev) => ({ ...prev, brightness, on: brightness > 0 }));
              onUpdate({ brightness, on: brightness > 0 });
            }}
            disabled={!device.reachable}
            color={localState.colorMode === 'hs' && localState.color ? localState.color : null}
          />
        )}

        {/* Brightness slider (Nanoleaf only — panels, not bulbs) */}
        {device.type === 'nanoleaf' && (
          <Slider
            value={localState.brightness}
            onChange={handleBrightnessChange}
            onCommit={handleBrightnessCommit}
            min={1}
            max={100}
            disabled={!device.reachable || !localState.on}
            label="Brightness"
            valueDisplay={`${localState.brightness}%`}
            gradient="linear-gradient(to right, #27272a, #78716c, #fbbf24, #fef3c7)"
            hints={{ start: 'Dim', end: 'Bright' }}
          />
        )}

        {/* Color Temperature (for devices that support it) */}
        {supportsColorTemp && (
          <Slider
            value={kelvinToPercent(localState.colorTemp || 3000)}
            onChange={(percent) => handleColorTempChange(percentToKelvin(percent))}
            onCommit={handleColorTempCommit}
            min={0}
            max={100}
            disabled={!device.reachable || !localState.on}
            label="Color Temperature"
            valueDisplay={`${localState.colorTemp || 3000}K`}
            gradient="linear-gradient(to right, #ff9329, #fff5e6, #c9e2ff)"
            hints={{ start: 'Warm', end: 'Cool' }}
          />
        )}

        {/* Color picker (for devices that support color) */}
        {supportsColor && (
          <div>
            <h3 className="text-lg font-medium mb-4">Color</h3>
            <div className="flex justify-center">
              <ColorPicker
                hue={localState.color?.hue ?? 30}
                saturation={localState.color?.saturation ?? 100}
                onChange={handleColorChange}
                disabled={!device.reachable || !localState.on}
              />
            </div>
          </div>
        )}

        {/* Effects (Nanoleaf only) */}
        {device.type === 'nanoleaf' && (
          <div>
            <h3 className="text-lg font-medium mb-3">Effects</h3>
            {effectsLoading ? (
              <div className="text-zinc-400">Loading effects...</div>
            ) : effects.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {effects.map((effect) => (
                  <button
                    key={effect}
                    onClick={() => selectEffect(effect)}
                    disabled={!device.reachable || !localState.on}
                    className={`p-3 rounded-xl text-left text-sm transition-all ${
                      currentEffect === effect
                        ? 'bg-amber-500/20 border-amber-500 border'
                        : 'glass-pill hover:bg-white/10'
                    } ${!device.reachable || !localState.on ? 'opacity-50' : ''}`}
                  >
                    {effect}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-zinc-400">No effects available</div>
            )}
          </div>
        )}

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
