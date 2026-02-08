interface VoiceOrbProps {
  state: 'idle' | 'listening';
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'lg';
}

const baseColors = {
  roseColor: '#d4a054',
  petalHighlight: '#e8c078',
  glowColor: 'rgba(212, 160, 84, 0.3)',
  activeGlowColor: 'rgba(212, 160, 84, 0.5)',
  stemColor: '#5a8a4a',
  leafColor: '#4a7a3a',
  dropShadow: 'drop-shadow(0 0 8px rgba(212, 160, 84, 0.5))',
  activeDropShadow: 'drop-shadow(0 0 16px rgba(212, 160, 84, 0.7))',
} as const;

const sizeConfig = {
  sm: {
    container: 'w-20 h-20',
    sparkleCount: 3,
    orbitRadius: 34,
    sparkleSize: 3,
    petalCount: 2,
  },
  lg: {
    container: 'w-44 h-44',
    sparkleCount: 6,
    orbitRadius: 72,
    sparkleSize: 4,
    petalCount: 3,
  },
} as const;

function RoseSVG({ color, highlight, stemColor, leafColor, dropShadow, breatheIntensity, breatheDuration }: {
  color: string;
  highlight: string;
  stemColor: string;
  leafColor: string;
  dropShadow: string;
  breatheIntensity: string;
  breatheDuration: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="w-full h-full"
      style={{
        animation: `rose-breathe ${breatheDuration} ease-in-out infinite`,
        filter: dropShadow,
        transition: 'filter 1s ease',
        '--breathe-intensity': breatheIntensity,
      } as React.CSSProperties}
    >
      {/* Stem */}
      <path
        d="M32 56 C32 48, 30 42, 32 34"
        stroke={stemColor}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        style={{ transition: 'stroke 1s ease' }}
      />
      {/* Left leaf */}
      <path
        d="M31 46 C26 44, 22 46, 20 48 C22 45, 26 42, 31 44"
        fill={leafColor}
        style={{ transition: 'fill 1s ease' }}
      />
      {/* Right leaf */}
      <path
        d="M33 42 C38 40, 42 42, 44 44 C42 41, 38 38, 33 40"
        fill={leafColor}
        style={{ transition: 'fill 1s ease' }}
      />

      {/* Outer petals (3 large) */}
      <ellipse cx="22" cy="26" rx="9" ry="12"
        transform="rotate(-25, 22, 26)"
        fill={color} opacity="0.85"
        style={{ transition: 'fill 1s ease' }}
      />
      <ellipse cx="42" cy="26" rx="9" ry="12"
        transform="rotate(25, 42, 26)"
        fill={color} opacity="0.85"
        style={{ transition: 'fill 1s ease' }}
      />
      <ellipse cx="32" cy="18" rx="10" ry="11"
        fill={color} opacity="0.9"
        style={{ transition: 'fill 1s ease' }}
      />

      {/* Middle petals (3 medium) */}
      <ellipse cx="26" cy="22" rx="7" ry="9"
        transform="rotate(-10, 26, 22)"
        fill={highlight} opacity="0.7"
        style={{ transition: 'fill 1s ease' }}
      />
      <ellipse cx="38" cy="22" rx="7" ry="9"
        transform="rotate(10, 38, 22)"
        fill={highlight} opacity="0.7"
        style={{ transition: 'fill 1s ease' }}
      />
      <ellipse cx="32" cy="28" rx="7" ry="8"
        fill={highlight} opacity="0.65"
        style={{ transition: 'fill 1s ease' }}
      />

      {/* Inner petals (small, tight) */}
      <ellipse cx="30" cy="24" rx="4" ry="6"
        transform="rotate(-15, 30, 24)"
        fill={highlight} opacity="0.9"
        style={{ transition: 'fill 1s ease' }}
      />
      <ellipse cx="34" cy="24" rx="4" ry="6"
        transform="rotate(15, 34, 24)"
        fill={highlight} opacity="0.9"
        style={{ transition: 'fill 1s ease' }}
      />

      {/* Center spiral */}
      <circle cx="32" cy="23" r="2.5"
        fill={highlight} opacity="0.95"
        style={{ transition: 'fill 1s ease' }}
      />
    </svg>
  );
}

function SparkleRings({ size, sparkleSpeed }: {
  size: 'sm' | 'lg';
  sparkleSpeed: string;
}) {
  const sz = sizeConfig[size];

  const ringTilts = [
    { zPre: 0, xTilt: 55, zPost: 0 },
    { zPre: 60, xTilt: 55, zPost: -60 },
    { zPre: -60, xTilt: 55, zPost: 60 },
  ];
  const containerSize = size === 'lg' ? 200 : 100;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: containerSize,
        height: containerSize,
        perspective: 600,
        zIndex: 3,
      }}
    >
      {ringTilts.map((tilt, ringIdx) => (
        <div
          key={ringIdx}
          className="absolute inset-0"
          style={{
            transform: `rotateZ(${tilt.zPre}deg) rotateX(${tilt.xTilt}deg) rotateZ(${tilt.zPost}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {Array.from({ length: sz.sparkleCount }).map((_, i) => {
            const startAngle = (360 / sz.sparkleCount) * i;
            return (
              <div
                key={i}
                className="absolute animate-sparkle-orbit"
                style={{
                  width: sz.sparkleSize,
                  height: sz.sparkleSize,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,220,150,0.6))',
                  boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                  left: '50%',
                  top: '50%',
                  marginLeft: -sz.sparkleSize / 2,
                  marginTop: -sz.sparkleSize / 2,
                  '--orbit-start': `${startAngle}deg`,
                  '--orbit-radius': `${sz.orbitRadius}px`,
                  '--sparkle-speed': sparkleSpeed,
                  animationDelay: `${(ringIdx * 0.4) + (i * 0.15)}s`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FallingPetals({ size, color, visible }: { size: 'sm' | 'lg'; color: string; visible: boolean }) {
  const sz = sizeConfig[size];
  return (
    <>
      {Array.from({ length: sz.petalCount }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-petal-fall"
          style={{
            width: 6,
            height: 8,
            borderRadius: '50% 50% 50% 0',
            background: color,
            left: `${40 + i * 12}%`,
            top: '35%',
            opacity: visible ? 0.7 : 0,
            transition: 'opacity 1s ease',
            '--petal-duration': `${3.5 + i * 0.8}s`,
            '--petal-delay': `${i * 1.2}s`,
            zIndex: 4,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

export function VoiceOrb({ state, active = false, onClick, disabled = false, size = 'sm' }: VoiceOrbProps) {
  const sz = sizeConfig[size];
  const isActive = active || state === 'listening';

  return (
    <div className="relative flex items-center justify-center">
      {/* Sparkle orbiting rings — outside button to avoid clipping */}
      <SparkleRings
        size={size}
        sparkleSpeed={isActive ? '3s' : '8s'}
      />

      {/* Main button container */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative ${sz.container} flex items-center justify-center rounded-full
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        `}
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.06), rgba(0,0,0,0.2) 70%)',
          boxShadow: `0 0 30px ${isActive ? baseColors.activeGlowColor : baseColors.glowColor}, inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.15)`,
          border: '1px solid rgba(255,255,255,0.1)',
          transition: 'box-shadow 1s ease, transform 0.15s ease',
        }}
      >
        {/* Rose */}
        <div className="relative z-[1]" style={{ width: '70%', height: '70%' }}>
          <RoseSVG
            color={baseColors.roseColor}
            highlight={baseColors.petalHighlight}
            stemColor={baseColors.stemColor}
            leafColor={baseColors.leafColor}
            dropShadow={isActive ? baseColors.activeDropShadow : baseColors.dropShadow}
            breatheIntensity={isActive ? '1.06' : '1.03'}
            breatheDuration={isActive ? '1.5s' : '4s'}
          />
        </div>

        {/* Falling petals — always rendered, opacity transitions */}
        <FallingPetals size={size} color={baseColors.roseColor} visible={!isActive} />
      </button>
    </div>
  );
}
