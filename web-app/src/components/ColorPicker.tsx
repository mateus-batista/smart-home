import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react';

interface ColorPickerProps {
  hue: number;
  saturation: number;
  onChange: (hue: number, saturation: number) => void;
  disabled?: boolean;
}

// Pre-render the color wheel once and cache it
let cachedWheelImage: ImageData | null = null;

function getColorWheelImage(size: number, radius: number): ImageData {
  if (cachedWheelImage && cachedWheelImage.width === size) {
    return cachedWheelImage;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d')!;
  const centerX = size / 2;
  const centerY = size / 2;

  // Draw color wheel using ImageData for better performance
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (angle < 0) angle += 360;
        const sat = (distance / radius) * 100;

        // HSL to RGB conversion
        const h = angle / 360;
        const s = sat / 100;
        const l = 0.5;

        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }

        const idx = (y * size + x) * 4;
        data[idx] = Math.round(r * 255);
        data[idx + 1] = Math.round(g * 255);
        data[idx + 2] = Math.round(b * 255);
        data[idx + 3] = 255;
      }
    }
  }

  cachedWheelImage = imageData;
  return imageData;
}

function ColorPickerComponent({ hue, saturation, onChange, disabled }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Memoize indicator position calculation
  const indicatorPosition = useMemo(() => {
    const size = 200;
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;
    const indicatorAngle = ((hue - 90) * Math.PI) / 180;
    const indicatorRadius = (saturation / 100) * radius;
    return {
      x: centerX + indicatorRadius * Math.cos(indicatorAngle),
      y: centerY + indicatorRadius * Math.sin(indicatorAngle),
    };
  }, [hue, saturation]);

  // Draw the color wheel - only redraws indicator, wheel is cached
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const radius = size / 2 - 10;

    // Draw cached color wheel
    const wheelImage = getColorWheelImage(size, radius);
    ctx.putImageData(wheelImage, 0, 0);

    // Draw indicator circle
    const { x: indicatorX, y: indicatorY } = indicatorPosition;

    // Outer circle (shadow)
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 14, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Inner circle (white)
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Color indicator
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, 50%)`;
    ctx.fill();
  }, [hue, saturation, indicatorPosition]);

  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - canvas.width / 2;
      const y = clientY - rect.top - canvas.height / 2;

      const radius = canvas.width / 2 - 10;
      let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;

      const distance = Math.sqrt(x * x + y * y);
      const sat = Math.min(100, (distance / radius) * 100);

      onChange(Math.round(angle), Math.round(sat));
    },
    [disabled, onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleInteraction(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        handleInteraction(e.clientX, e.clientY);
      }
    },
    [isDragging, handleInteraction]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const touch = e.touches[0];
    handleInteraction(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleInteraction(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`relative ${disabled ? 'opacity-50' : ''}`}>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        className="color-picker-canvas rounded-full"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ColorPicker = memo(ColorPickerComponent);
