import { useMemo } from 'react';

interface CircularWaveformProps {
  isRecording: boolean;
}

const BAR_COUNT = 28;
const RADIUS = 100;

export function CircularWaveform({ isRecording }: CircularWaveformProps) {
  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => ({
        angle: (360 / BAR_COUNT) * i,
        delay: i * (1.4 / BAR_COUNT),
      })),
    [],
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: isRecording ? 1 : 0 }}
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            transform: `rotate(${bar.angle}deg) translateY(-${RADIUS}px)`,
          }}
        >
          <div
            className="w-[3px] h-4 rounded-full"
            style={{
              backgroundColor: 'rgba(242,47,116,0.8)',
              animation: isRecording
                ? `waveform-circular 1.4s ease-in-out infinite ${bar.delay}s`
                : 'none',
              transformOrigin: 'center center',
            }}
          />
        </div>
      ))}
    </div>
  );
}
