import { memo } from 'react';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Gradient background for the track (CSS gradient string) */
  gradient?: string;
  /** Label text shown on the left side of the header */
  label?: string;
  /** Value display (e.g., "75%", "3000K") - shown on the right side of the header */
  valueDisplay?: string;
  /** Hint text labels for the slider ends */
  hints?: { start?: string; middle?: string; end?: string };
  className?: string;
}

function SliderComponent({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  disabled = false,
  gradient,
  label,
  valueDisplay,
  hints,
  className = '',
}: SliderProps) {
  const handleCommit = () => {
    if (onCommit) onCommit();
  };

  return (
    <div className={className}>
      {(label || valueDisplay) && (
        <div className="flex justify-between mb-3">
          {label && <span className="text-lg font-medium">{label}</span>}
          {valueDisplay && <span className="text-zinc-400">{valueDisplay}</span>}
        </div>
      )}
      <div className="relative">
        {gradient && (
          <div
            className="absolute inset-0 rounded-lg h-2 top-3 pointer-events-none"
            style={{ background: gradient }}
          />
        )}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          disabled={disabled}
          className={`w-full ${gradient ? 'relative z-10' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        />
      </div>
      {hints && (
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>{hints.start}</span>
          {hints.middle && <span>{hints.middle}</span>}
          <span>{hints.end}</span>
        </div>
      )}
    </div>
  );
}

export const Slider = memo(SliderComponent);

/** Inline slider variant without header, for use in lists */
interface InlineSliderProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Label shown to the left of the slider */
  label?: string;
  /** Value display shown to the right (e.g., "75%") */
  valueDisplay?: string;
  /** Fill color or gradient for the track */
  fillColor?: string;
  className?: string;
}

function InlineSliderComponent({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  disabled = false,
  label,
  valueDisplay,
  fillColor = 'rgba(255,255,255,0.4)',
  className = '',
}: InlineSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && <span className="text-xs text-zinc-500 w-16">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        disabled={disabled}
        className={`flex-1 h-2 bg-zinc-700 rounded-full appearance-none
          [&::-webkit-slider-thumb]:appearance-none 
          [&::-webkit-slider-thumb]:w-4 
          [&::-webkit-slider-thumb]:h-4 
          [&::-webkit-slider-thumb]:rounded-full 
          [&::-webkit-slider-thumb]:bg-white 
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          background: `linear-gradient(to right, ${fillColor} ${percent}%, rgba(255,255,255,0.1) ${percent}%)`,
        }}
      />
      {valueDisplay && <span className="text-xs text-zinc-400 w-10 text-right">{valueDisplay}</span>}
    </div>
  );
}

export const InlineSlider = memo(InlineSliderComponent);
