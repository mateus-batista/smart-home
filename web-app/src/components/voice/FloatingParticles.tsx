import { useMemo } from 'react';

interface FloatingParticlesProps {
  state: 'idle' | 'listening';
}

const PARTICLE_COUNT = 16;

const PARTICLE_COLOR = 'rgba(212,160,84,0.7)';

// Deterministic pseudo-random from index
function seeded(i: number, offset: number) {
  const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function FloatingParticles({ state: _state }: FloatingParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        x: (seeded(i, 0) - 0.5) * 360,
        y: (seeded(i, 1) - 0.5) * 360,
        size: 3 + seeded(i, 2) * 3,
        duration: 8 + seeded(i, 3) * 4,
        delay: seeded(i, 4) * 3,
        driftX: (seeded(i, 5) - 0.5) * 40,
        driftY: (seeded(i, 6) - 0.5) * 40,
        driftX2: (seeded(i, 7) - 0.5) * 30,
        driftY2: (seeded(i, 8) - 0.5) * 30,
        driftX3: (seeded(i, 9) - 0.5) * 35,
        driftY3: (seeded(i, 10) - 0.5) * 35,
        orbitStart: seeded(i, 11) * 360,
        orbitRadius: 60 + seeded(i, 12) * 60,
        spiralRadius: 80 + seeded(i, 13) * 60,
        burstX: (seeded(i, 14) - 0.5) * 200,
        burstY: (seeded(i, 15) - 0.5) * 200,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-particle-drift"
          style={{
            width: p.size,
            height: p.size,
            left: `calc(50% + ${p.x}px)`,
            top: `calc(50% + ${p.y}px)`,
            backgroundColor: PARTICLE_COLOR,
            boxShadow: `0 0 ${p.size * 2}px ${PARTICLE_COLOR}`,
            opacity: 0.7,
            '--particle-duration': `${p.duration}s`,
            '--particle-delay': `${p.delay}s`,
            '--drift-x': `${p.driftX}px`,
            '--drift-y': `${p.driftY}px`,
            '--drift-x2': `${p.driftX2}px`,
            '--drift-y2': `${p.driftY2}px`,
            '--drift-x3': `${p.driftX3}px`,
            '--drift-y3': `${p.driftY3}px`,
            '--orbit-start': `${p.orbitStart}deg`,
            '--orbit-radius': `${p.orbitRadius}px`,
            '--spiral-radius': `${p.spiralRadius}px`,
            '--burst-x': `${p.burstX}px`,
            '--burst-y': `${p.burstY}px`,
            transition: 'opacity 1s',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
