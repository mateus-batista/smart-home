import { memo } from 'react';

interface ShadeVisualProps {
  /** Current position of the shade (0-100) */
  position: number;
  /** Whether this is a Blind Tilt device */
  isBlindTilt: boolean;
  className?: string;
}

function ShadeVisualComponent({ position, isBlindTilt, className = '' }: ShadeVisualProps) {
  if (isBlindTilt) {
    // Blind Tilt visual: show horizontal slats that rotate based on position
    // At 0%: slats are horizontal (closed, blocking light)
    // At 100%: slats are tilted down (fully open, letting light through)
    const tiltAngle = (position / 100) * 90 - 45; // -45 to 45 degrees (horizontal to tilted)
    const lightIntensity = position / 100;

    return (
      <div className={`relative w-32 h-40 mx-auto ${className}`}>
        {/* Window frame */}
        <div className="absolute inset-0 border-4 border-white/30 rounded-lg overflow-hidden">
          {/* Sky/light coming through */}
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              background: `linear-gradient(180deg,
                rgba(135, 206, 250, ${lightIntensity * 0.8}) 0%,
                rgba(255, 255, 255, ${lightIntensity * 0.3}) 100%)`,
            }}
          />
          {/* Blind slats */}
          <div className="absolute inset-0 flex flex-col justify-evenly py-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-full h-2 bg-zinc-400 transition-all duration-300"
                style={{
                  transform: `perspective(100px) rotateX(${tiltAngle}deg)`,
                  opacity: 0.9,
                  boxShadow: tiltAngle !== 0 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Regular shade visual (Curtain, Roller Shade)
  const shadeHeight = 100 - position;

  return (
    <div className={`relative w-32 h-40 mx-auto ${className}`}>
      {/* Window frame */}
      <div className="absolute inset-0 border-4 border-white/30 rounded-lg overflow-hidden">
        {/* Sky/light coming through */}
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            background: `linear-gradient(180deg,
              rgba(135, 206, 250, ${(position / 100) * 0.8}) 0%,
              rgba(255, 255, 255, ${(position / 100) * 0.3}) 100%)`,
          }}
        />
        {/* The shade itself */}
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-zinc-600 to-zinc-700 transition-all duration-300"
          style={{ height: `${shadeHeight}%` }}
        >
          {/* Shade texture lines */}
          {[...Array(Math.floor(shadeHeight / 10))].map((_, i) => (
            <div
              key={i}
              className="w-full h-px bg-zinc-500/30"
              style={{ marginTop: `${i * 10}%` }}
            />
          ))}
          {/* Pull cord */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2">
            <div className="w-1 h-4 bg-white/50 rounded-full" />
            <div className="w-3 h-3 bg-white/70 rounded-full mx-auto -mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ShadeVisual = memo(ShadeVisualComponent);
