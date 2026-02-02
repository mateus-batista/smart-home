import { memo } from 'react';

interface ShadeVisualProps {
  /** Current position of the shade (0-100) */
  position: number;
  /** Whether this is a Blind Tilt device */
  isBlindTilt: boolean;
  className?: string;
}

/** Get visual openness for display purposes */
export function getVisualOpenness(position: number, isBlindTilt: boolean): number {
  if (isBlindTilt) {
    // At 50, slats are horizontal (fully open) -> visual openness = 100
    // At 0 or 100, slats are vertical (closed) -> visual openness = 0
    const distanceFrom50 = Math.abs(position - 50);
    return Math.round(100 - distanceFrom50 * 2);
  }
  return position;
}

function ShadeVisualComponent({ position, isBlindTilt, className = '' }: ShadeVisualProps) {
  const visualOpenness = getVisualOpenness(position, isBlindTilt);

  if (isBlindTilt) {
    // Blind Tilt visual: show horizontal slats that rotate based on position
    // At 50%: slats are horizontal (fully open, letting light through)
    // At 0% or 100%: slats are vertical (closed, blocking light)
    const tiltAngle = ((position - 50) / 50) * 90; // -90 to 90 degrees
    const lightIntensity = visualOpenness / 100;

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
