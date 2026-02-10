import { useMemo } from 'react';
import type { TiltPosition } from '../../types/devices';
import { TILT_LABELS, TILT_POSITION_ORDER } from '../../utils/shadeHelpers';

interface TiltBlindControlProps {
  position: TiltPosition;
  onPositionChange: (position: TiltPosition) => void;
  disabled?: boolean;
}

const SLAT_COUNT = 18;
const TRANSITION = 'all 1.4s cubic-bezier(0.22, 1, 0.36, 1)';

const SLAT_ANGLES: Record<TiltPosition, number> = {
  'closed-up': 40,
  'half-open': 20,
  'open': 0,
  'half-closed': -20,
  'closed-down': -40,
};

const OPENNESS: Record<TiltPosition, number> = {
  'closed-up': 0,
  'half-open': 0.5,
  'open': 1,
  'half-closed': 0.5,
  'closed-down': 0,
};

/** Sun or moon position based on current time of day */
function useCelestial() {
  return useMemo(() => {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    const isDay = hours >= 6 && hours < 18;

    const progress = isDay
      ? (hours - 6) / 12
      : hours >= 18
        ? (hours - 18) / 12
        : (hours + 6) / 12;

    // Arc across the sky
    const x = 12 + progress * 76;
    const y = 12 + (1 - Math.sin(progress * Math.PI)) * 42;

    return { isDay, x, y };
  }, []);
}

// --- Frame colors (warm off-white, like painted wood) ---
const FRAME = {
  highlight: '#e8e3da',
  body: '#d4cec4',
  shadow: '#b8b2a6',
  inner: '#a8a294',
  sill: '#ddd8ce',
};

export function TiltBlindControl({
  position,
  onPositionChange,
  disabled = false,
}: TiltBlindControlProps) {
  const angle = SLAT_ANGLES[position];
  const openness = OPENNESS[position];
  const { isDay, x: sunX, y: sunY } = useCelestial();

  const skyTopL = isDay ? 18 + openness * 32 : 6 + openness * 10;
  const skyBotL = isDay ? 10 + openness * 22 : 4 + openness * 6;
  const skySat = isDay ? 70 : 40;
  const skyHue = isDay ? 210 : 220;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative max-w-xs w-full">
        {/* ── Window frame ── */}
        <div
          style={{
            borderRadius: '10px',
            padding: '7px',
            background: `linear-gradient(180deg, ${FRAME.highlight} 0%, ${FRAME.body} 40%, ${FRAME.shadow} 100%)`,
            boxShadow: `
              0 6px 24px rgba(0,0,0,0.25),
              0 1px 4px rgba(0,0,0,0.15),
              inset 0 1px 0 rgba(255,255,255,0.5)`,
          }}
        >
          {/* Inner recess (depth between frame and glass) */}
          <div
            style={{
              borderRadius: '6px',
              padding: '3px',
              background: `linear-gradient(180deg, ${FRAME.inner} 0%, ${FRAME.shadow} 100%)`,
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.35), inset 0 0 2px rgba(0,0,0,0.15)',
            }}
          >
            {/* Glass/blind area */}
            <div
              className="relative overflow-hidden"
              style={{ borderRadius: '4px', aspectRatio: '3 / 4', perspective: '500px' }}
            >
              {/* ── Sky ── */}
              <div
                className="absolute inset-0"
                style={{
                  transition: TRANSITION,
                  background: `linear-gradient(180deg,
                    hsl(${skyHue}, ${skySat}%, ${skyTopL}%) 0%,
                    hsl(${skyHue}, ${skySat - 15}%, ${skyBotL}%) 100%)`,
                }}
              />

              {/* Celestial body */}
              <div
                className="absolute"
                style={{
                  left: `${sunX}%`,
                  top: `${sunY}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: TRANSITION,
                  opacity: 0.12 + openness * 0.88,
                }}
              >
                {isDay ? (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #fde68a 0%, #f59e0b 55%, #d97706 100%)',
                      boxShadow: `0 0 ${10 + openness * 24}px ${3 + openness * 10}px rgba(251,191,36,${0.15 + openness * 0.45})`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #eef0f4 0%, #d4d8e0 100%)',
                      boxShadow: `inset -5px 2px 0 0 hsl(${skyHue}, ${skySat}%, ${skyTopL - 2}%), 0 0 ${6 + openness * 16}px ${2 + openness * 7}px rgba(210,218,230,${0.12 + openness * 0.3})`,
                    }}
                  />
                )}
              </div>

              {/* ── Headrail ── */}
              <div
                className="absolute top-0 left-0 right-0 z-10"
                style={{
                  height: '12px',
                  background: `linear-gradient(180deg,
                    hsl(35, 8%, 84%) 0%,
                    hsl(35, 6%, 76%) 50%,
                    hsl(35, 8%, 72%) 100%)`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                }}
              />

              {/* ── Slats ── */}
              <div
                className="absolute left-0 right-0 flex flex-col"
                style={{
                  top: '12px',
                  bottom: '0px',
                  gap: '0px',
                  padding: '0 2px',
                }}
              >
                {Array.from({ length: SLAT_COUNT }, (_, i) => {
                  const isBottomRail = i === SLAT_COUNT - 1;
                  // Gradient direction flips with tilt: light catches the exposed face
                  const gradDir = angle >= 0 ? '180deg' : '0deg';
                  const alt = (i % 2) * 2;

                  return (
                    <div
                      key={i}
                      style={{
                        flex: isBottomRail ? '0 0 10px' : '1',
                        marginTop: i === 0 ? 0 : `${-8 + openness * 22}px`,
                        transition: TRANSITION,
                        transform: `rotateX(${angle}deg)`,
                        transformOrigin: 'center center',
                        background: isBottomRail
                          ? `linear-gradient(${gradDir},
                              hsl(35, 8%, 82%) 0%,
                              hsl(35, 6%, 72%) 50%,
                              hsl(35, 8%, 68%) 100%)`
                          : `linear-gradient(${gradDir},
                              hsl(35, 10%, ${82 + alt}%) 0%,
                              hsl(35, 6%, ${72 + alt}%) 40%,
                              hsl(35, 5%, ${68 + alt}%) 60%,
                              hsl(35, 8%, ${74 + alt}%) 100%)`,
                        borderRadius: isBottomRail ? '0 0 1px 1px' : '0.5px',
                        boxShadow:
                          angle !== 0
                            ? `0 ${angle < 0 ? 3 : -3}px ${isBottomRail ? 6 : 4}px rgba(0,0,0,${0.1 + Math.abs(angle) / 150})`
                            : '0 1px 1px rgba(0,0,0,0.12)',
                      }}
                    />
                  );
                })}
              </div>

              {/* ── Ladder cords ── */}
              {[14, 86].map((xPct) => (
                <div
                  key={xPct}
                  className="absolute"
                  style={{
                    left: `${xPct}%`,
                    top: '12px',
                    bottom: 0,
                    width: '1px',
                    transition: TRANSITION,
                    background: `linear-gradient(180deg,
                      rgba(140,130,118,${0.15 + openness * 0.25}) 0%,
                      rgba(140,130,118,${0.1 + openness * 0.2}) 100%)`,
                  }}
                />
              ))}

              {/* ── Tilt wand (left side) ── */}
              <div
                className="absolute z-10"
                style={{
                  left: '5px',
                  top: '12px',
                  bottom: '20%',
                  width: '2px',
                  borderRadius: '1px',
                  background: `linear-gradient(180deg,
                    hsl(35, 6%, 78%) 0%,
                    hsl(35, 6%, 68%) 100%)`,
                  opacity: 0.5 + openness * 0.3,
                  transition: TRANSITION,
                }}
              >
                {/* Wand tip */}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2"
                  style={{
                    width: '4px',
                    height: '6px',
                    borderRadius: '0 0 2px 2px',
                    background: 'linear-gradient(180deg, hsl(35, 6%, 75%) 0%, hsl(35, 6%, 65%) 100%)',
                  }}
                />
              </div>

              {/* ── Invisible tap zones ── */}
              <div className="absolute inset-0 flex flex-col z-20">
                {TILT_POSITION_ORDER.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => !disabled && onPositionChange(pos)}
                    disabled={disabled}
                    className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                      pos !== position ? 'hover:bg-white/[0.04]' : ''
                    }`}
                  />
                ))}
              </div>

              {/* ── Active zone indicator ── */}
              <div
                className="absolute right-0 w-1 rounded-l z-20"
                style={{
                  transition: TRANSITION,
                  top: `${(TILT_POSITION_ORDER.indexOf(position) / (TILT_POSITION_ORDER.length - 1)) * 80 + 10}%`,
                  height: '12px',
                  transform: 'translateY(-50%)',
                  background: 'linear-gradient(180deg, #38bdf8, #0ea5e9)',
                  boxShadow: '0 0 8px rgba(56,189,248,0.5), -1px 0 4px rgba(56,189,248,0.3)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Window sill ── */}
        <div
          style={{
            marginTop: '-1px',
            marginLeft: '2px',
            marginRight: '2px',
            height: '10px',
            borderRadius: '0 0 8px 8px',
            background: `linear-gradient(180deg, ${FRAME.sill} 0%, ${FRAME.body} 40%, ${FRAME.shadow} 100%)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        />
      </div>

      {/* Status label */}
      <p className="text-sm text-zinc-400">{TILT_LABELS[position]}</p>
    </div>
  );
}
