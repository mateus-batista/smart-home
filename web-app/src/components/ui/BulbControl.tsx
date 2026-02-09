interface BulbControlProps {
  brightness: number; // 0-100
  onBrightnessChange: (brightness: number) => void;
  disabled?: boolean;
  color?: { hue: number; saturation: number; brightness: number } | null;
}

// Top = 100 (brightest), bottom = 0 (off) → tap upward to brighten
const ZONES = [
  { value: 100, label: 'Full Brightness' },
  { value: 75, label: 'Bright' },
  { value: 50, label: 'Medium' },
  { value: 25, label: 'Dim' },
  { value: 0, label: 'Off' },
];

const TRANSITION = 'all 1.4s cubic-bezier(0.22, 1, 0.36, 1)';

const GLASS_SIZE = 160;

function getActiveZone(brightness: number): number {
  let closest = ZONES[0].value;
  let minDist = Math.abs(brightness - closest);
  for (const zone of ZONES) {
    const dist = Math.abs(brightness - zone.value);
    if (dist < minDist) {
      minDist = dist;
      closest = zone.value;
    }
  }
  return closest;
}

function getStatusLabel(activeValue: number): string {
  const zone = ZONES.find((z) => z.value === activeValue);
  return zone?.label ?? `${activeValue}%`;
}

export function BulbControl({
  brightness,
  onBrightnessChange,
  disabled = false,
  color,
}: BulbControlProps) {
  const activeValue = getActiveZone(brightness);
  const t = activeValue / 100;

  const warmHue = color?.hue ?? 38;
  const warmSat = color?.saturation ?? 90;

  const glowRadius = 25 + t * 100;
  const glowOpacity = t * 0.65;

  const bulbL = t > 0 ? 50 + t * 42 : 16;
  const bulbS = t > 0 ? warmSat : 0;
  const bulbHue = t > 0 ? warmHue : 220;

  // Room silhouette reactivity
  const roomBgL = 3 + t * 10;
  const silL = 6 + t * 10;
  const moonOp = 0.3 + (1 - t) * 0.35;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Scene container with room background */}
      <div
        className="relative w-full max-w-xs overflow-hidden"
        style={{
          borderRadius: '20px',
          aspectRatio: '3 / 4',
        }}
      >
        {/* Room background — wall with subtle warm tint when lit */}
        <div
          className="absolute inset-0"
          style={{
            transition: TRANSITION,
            background: `
              radial-gradient(ellipse 80% 60% at 50% 45%,
                hsla(${warmHue}, ${warmSat}%, ${20 + t * 35}%, ${t * 0.5}) 0%,
                transparent 100%),
              linear-gradient(180deg,
                hsl(220, 18%, ${roomBgL + 2}%) 0%,
                hsl(225, 14%, ${roomBgL}%) 60%,
                hsl(220, 12%, ${roomBgL - 1}%) 100%)`,
          }}
        />

        {/* Wall texture — subtle vertical noise */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.03 + t * 0.02,
            background: `repeating-linear-gradient(90deg,
              transparent 0px,
              rgba(255,255,255,0.03) 1px,
              transparent 2px,
              transparent 8px)`,
            pointerEvents: 'none',
          }}
        />

        {/* Ceiling shadow — darker at top for depth */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: '15%',
            transition: TRANSITION,
            background: `linear-gradient(180deg,
              hsla(220, 20%, ${roomBgL - 2}%, 0.6) 0%,
              transparent 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Floor — darker, wood-tone */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '22%',
            transition: TRANSITION,
            background: `linear-gradient(180deg,
              hsl(25, 12%, ${silL - 2}%) 0%,
              hsl(20, 14%, ${silL - 3}%) 100%)`,
          }}
        />

        {/* Floor highlight — warm light reflection on floor */}
        <div
          className="absolute bottom-0 inset-x-0"
          style={{
            height: '22%',
            transition: TRANSITION,
            background: `radial-gradient(ellipse 60% 80% at 50% 0%,
              hsla(${warmHue}, ${warmSat}%, 50%, ${t * 0.12}) 0%,
              transparent 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Baseboard */}
        <div
          className="absolute inset-x-0"
          style={{
            bottom: '22%',
            height: '2%',
            transition: TRANSITION,
            background: `linear-gradient(180deg,
              hsl(220, 8%, ${silL + 5}%) 0%,
              hsl(220, 8%, ${silL + 2}%) 50%,
              hsl(25, 10%, ${silL}%) 100%)`,
            boxShadow: `0 -1px 3px rgba(0,0,0,0.15)`,
          }}
        />

        {/* ── Window with curtains — upper right ── */}
        <div
          className="absolute"
          style={{ top: '4%', right: '5%', width: '24%', height: '32%', transition: TRANSITION }}
        >
          {/* Window frame outer */}
          <div
            className="absolute"
            style={{
              top: '8%', left: '14%', right: '14%', bottom: '0%',
              borderRadius: '2px',
              border: `2px solid hsl(220, 8%, ${silL + 7}%)`,
              transition: TRANSITION,
              boxShadow: `inset 0 0 8px rgba(0,0,0,0.2)`,
            }}
          >
            {/* Night sky / moonlight through glass */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: '1px',
                transition: TRANSITION,
                background: `linear-gradient(180deg,
                  hsla(215, 35%, ${16 + (1-t)*8}%, ${moonOp}) 0%,
                  hsla(220, 30%, ${12 + (1-t)*6}%, ${moonOp * 0.8}) 100%)`,
                boxShadow: `0 0 ${8 + (1 - t) * 16}px hsla(210, 45%, 55%, ${(1 - t) * 0.15})`,
              }}
            />
            {/* Crossbars */}
            <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2" style={{ width: '2px', background: `hsl(220, 8%, ${silL + 8}%)`, transition: TRANSITION }} />
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2" style={{ height: '2px', background: `hsl(220, 8%, ${silL + 8}%)`, transition: TRANSITION }} />
            {/* Stars */}
            <div className="absolute" style={{ top: '18%', left: '22%', width: '2px', height: '2px', borderRadius: '50%', background: `rgba(255,255,255,${(1-t)*0.35})`, transition: TRANSITION }} />
            <div className="absolute" style={{ top: '30%', right: '28%', width: '1.5px', height: '1.5px', borderRadius: '50%', background: `rgba(255,255,255,${(1-t)*0.25})`, transition: TRANSITION }} />
          </div>
          {/* Left curtain */}
          <div
            className="absolute"
            style={{
              top: '4%', left: '0%', width: '20%', bottom: '0%',
              transition: TRANSITION,
              borderRadius: '2px 0 0 2px',
              background: `linear-gradient(90deg,
                hsl(220, 12%, ${silL + 2}%) 0%,
                hsl(220, 10%, ${silL}%) 40%,
                hsl(220, 12%, ${silL + 1}%) 100%)`,
              boxShadow: `2px 0 4px rgba(0,0,0,0.1)`,
            }}
          />
          {/* Right curtain */}
          <div
            className="absolute"
            style={{
              top: '4%', right: '0%', width: '20%', bottom: '0%',
              transition: TRANSITION,
              borderRadius: '0 2px 2px 0',
              background: `linear-gradient(270deg,
                hsl(220, 12%, ${silL + 2}%) 0%,
                hsl(220, 10%, ${silL}%) 40%,
                hsl(220, 12%, ${silL + 1}%) 100%)`,
              boxShadow: `-2px 0 4px rgba(0,0,0,0.1)`,
            }}
          />
          {/* Curtain rod */}
          <div
            className="absolute"
            style={{
              top: '2%', left: '-4%', right: '-4%', height: '3%',
              borderRadius: '2px',
              background: `linear-gradient(180deg, hsl(35, 8%, ${silL + 10}%) 0%, hsl(35, 6%, ${silL + 6}%) 100%)`,
              transition: TRANSITION,
            }}
          />
          {/* Moonlight spill on wall */}
          <div
            className="absolute"
            style={{
              top: '0%', left: '10%', right: '10%', bottom: '-20%',
              transition: TRANSITION,
              background: `linear-gradient(180deg,
                hsla(210, 30%, 60%, ${(1-t) * 0.04}) 0%,
                transparent 100%)`,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* ── Picture frames — upper left wall ── */}
        {/* Large frame */}
        <div
          className="absolute"
          style={{
            top: '8%', left: '6%', width: '18%', height: '14%',
            transition: TRANSITION,
            borderRadius: '1px',
            border: `2px solid hsl(30, 10%, ${silL + 7}%)`,
            boxShadow: `1px 2px 4px rgba(0,0,0,0.2)`,
          }}
        >
          {/* Inner mat */}
          <div className="absolute inset-[12%]" style={{ border: `1px solid hsl(220, 6%, ${silL + 4}%)`, background: `hsl(220, 10%, ${silL + 1}%)`, transition: TRANSITION }} />
        </div>
        {/* Small frame */}
        <div
          className="absolute"
          style={{
            top: '10%', left: '27%', width: '10%', height: '10%',
            transition: TRANSITION,
            borderRadius: '1px',
            border: `1.5px solid hsl(30, 10%, ${silL + 6}%)`,
            boxShadow: `1px 2px 3px rgba(0,0,0,0.15)`,
          }}
        >
          <div className="absolute inset-[14%]" style={{ background: `hsl(220, 8%, ${silL + 2}%)`, transition: TRANSITION }} />
        </div>

        {/* ── Rug — on the floor, under the couch area ── */}
        <div
          className="absolute"
          style={{
            bottom: '4%', left: '4%', right: '28%', height: '12%',
            transition: TRANSITION,
            borderRadius: '3px',
            background: `linear-gradient(180deg,
              hsl(15, 18%, ${silL + 1}%) 0%,
              hsl(12, 20%, ${silL}%) 50%,
              hsl(15, 18%, ${silL + 1}%) 100%)`,
            boxShadow: `inset 0 1px 3px rgba(0,0,0,0.15)`,
          }}
        >
          {/* Rug border pattern */}
          <div className="absolute inset-[8%]" style={{ border: `1px solid hsl(15, 12%, ${silL + 3}%)`, borderRadius: '2px', transition: TRANSITION }} />
        </div>

        {/* ── Couch — with gradients and cushions ── */}
        <div
          className="absolute"
          style={{ bottom: '10%', left: '6%', width: '40%', height: '16%', transition: TRANSITION }}
        >
          {/* Back */}
          <div
            className="absolute inset-x-[5%] top-0 h-[52%]"
            style={{
              borderRadius: '5px 5px 0 0',
              background: `linear-gradient(180deg,
                hsl(220, 12%, ${silL + 1}%) 0%,
                hsl(220, 10%, ${silL - 1}%) 100%)`,
              boxShadow: `inset 0 2px 4px rgba(255,255,255,0.02)`,
              transition: TRANSITION,
            }}
          />
          {/* Seat */}
          <div
            className="absolute inset-x-0 bottom-0 h-[55%]"
            style={{
              borderRadius: '3px',
              background: `linear-gradient(180deg,
                hsl(220, 10%, ${silL + 1}%) 0%,
                hsl(220, 10%, ${silL - 1}%) 100%)`,
              boxShadow: `inset 0 2px 6px rgba(0,0,0,0.15)`,
              transition: TRANSITION,
            }}
          />
          {/* Left armrest */}
          <div
            className="absolute"
            style={{
              top: '8%', left: '-3%', width: '10%', bottom: 0,
              borderRadius: '4px 0 0 3px',
              background: `linear-gradient(90deg, hsl(220, 12%, ${silL}%) 0%, hsl(220, 10%, ${silL - 1}%) 100%)`,
              transition: TRANSITION,
            }}
          />
          {/* Right armrest */}
          <div
            className="absolute"
            style={{
              top: '8%', right: '-3%', width: '10%', bottom: 0,
              borderRadius: '0 4px 3px 0',
              background: `linear-gradient(270deg, hsl(220, 12%, ${silL}%) 0%, hsl(220, 10%, ${silL - 1}%) 100%)`,
              transition: TRANSITION,
            }}
          />
          {/* Cushion left */}
          <div
            className="absolute"
            style={{
              top: '6%', left: '10%', width: '26%', height: '42%',
              borderRadius: '4px',
              background: `linear-gradient(150deg, hsl(220, 14%, ${silL + 2}%) 0%, hsl(220, 10%, ${silL}%) 100%)`,
              boxShadow: `inset 0 1px 2px rgba(255,255,255,0.03), 1px 1px 3px rgba(0,0,0,0.1)`,
              transition: TRANSITION,
            }}
          />
          {/* Cushion right */}
          <div
            className="absolute"
            style={{
              top: '8%', left: '40%', width: '26%', height: '40%',
              borderRadius: '4px',
              background: `linear-gradient(150deg, hsl(220, 14%, ${silL + 2}%) 0%, hsl(220, 10%, ${silL}%) 100%)`,
              boxShadow: `inset 0 1px 2px rgba(255,255,255,0.03), 1px 1px 3px rgba(0,0,0,0.1)`,
              transition: TRANSITION,
            }}
          />
          {/* Couch legs */}
          <div className="absolute" style={{ bottom: '-6%', left: '5%', width: '4%', height: '8%', borderRadius: '0 0 1px 1px', background: `hsl(25, 12%, ${silL - 2}%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ bottom: '-6%', right: '5%', width: '4%', height: '8%', borderRadius: '0 0 1px 1px', background: `hsl(25, 12%, ${silL - 2}%)`, transition: TRANSITION }} />
        </div>

        {/* ── Side table + plant ── */}
        <div
          className="absolute"
          style={{ bottom: '10%', right: '6%', width: '20%', height: '20%', transition: TRANSITION }}
        >
          {/* Table top */}
          <div
            className="absolute bottom-[40%] inset-x-0 h-[6%]"
            style={{
              borderRadius: '2px',
              background: `linear-gradient(180deg, hsl(25, 15%, ${silL + 4}%) 0%, hsl(25, 12%, ${silL + 2}%) 100%)`,
              boxShadow: `0 1px 3px rgba(0,0,0,0.15)`,
              transition: TRANSITION,
            }}
          />
          {/* Table legs */}
          <div className="absolute" style={{ bottom: 0, left: '12%', width: '3%', top: '46%', background: `hsl(25, 12%, ${silL + 1}%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ bottom: 0, right: '12%', width: '3%', top: '46%', background: `hsl(25, 12%, ${silL + 1}%)`, transition: TRANSITION }} />
          {/* Table crossbar */}
          <div className="absolute" style={{ bottom: '12%', left: '14%', right: '14%', height: '2%', background: `hsl(25, 10%, ${silL}%)`, transition: TRANSITION }} />
          {/* Pot */}
          <div
            className="absolute"
            style={{
              bottom: '46%', left: '24%', right: '24%', height: '14%',
              borderRadius: '2px 2px 4px 4px',
              background: `linear-gradient(180deg, hsl(15, 30%, ${silL + 5}%) 0%, hsl(12, 25%, ${silL + 2}%) 100%)`,
              boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.1)`,
              transition: TRANSITION,
            }}
          />
          {/* Pot rim */}
          <div
            className="absolute"
            style={{
              bottom: '58%', left: '20%', right: '20%', height: '4%',
              borderRadius: '2px',
              background: `hsl(15, 28%, ${silL + 6}%)`,
              transition: TRANSITION,
            }}
          />
          {/* Plant stem */}
          <div className="absolute" style={{ bottom: '62%', left: '48%', width: '2px', height: '20%', background: `hsl(130, 20%, ${silL + 3}%)`, transition: TRANSITION }} />
          {/* Leaf 1 — left, large */}
          <div
            className="absolute"
            style={{
              bottom: '72%', left: '10%', width: '42%', height: '28%',
              borderRadius: '50% 50% 50% 10%', transform: 'rotate(-25deg)',
              background: `linear-gradient(135deg, hsl(135, 28%, ${silL + 5}%) 0%, hsl(140, 22%, ${silL + 2}%) 100%)`,
              transition: TRANSITION,
            }}
          />
          {/* Leaf 2 — right */}
          <div
            className="absolute"
            style={{
              bottom: '74%', right: '8%', width: '38%', height: '24%',
              borderRadius: '50% 50% 10% 50%', transform: 'rotate(20deg)',
              background: `linear-gradient(225deg, hsl(130, 25%, ${silL + 4}%) 0%, hsl(138, 20%, ${silL + 2}%) 100%)`,
              transition: TRANSITION,
            }}
          />
          {/* Leaf 3 — top, small */}
          <div
            className="absolute"
            style={{
              bottom: '80%', left: '28%', width: '30%', height: '20%',
              borderRadius: '50% 50% 30% 50%', transform: 'rotate(-5deg)',
              background: `linear-gradient(180deg, hsl(132, 24%, ${silL + 5}%) 0%, hsl(140, 18%, ${silL + 3}%) 100%)`,
              transition: TRANSITION,
            }}
          />
        </div>

        {/* ── Bookshelf — left wall ── */}
        <div
          className="absolute"
          style={{ top: '26%', left: '5%', width: '22%', height: '30%', transition: TRANSITION }}
        >
          {/* Shelf body */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '2px',
              background: `linear-gradient(90deg,
                hsl(25, 14%, ${silL + 2}%) 0%,
                hsl(25, 10%, ${silL + 4}%) 50%,
                hsl(25, 14%, ${silL + 2}%) 100%)`,
              boxShadow: `2px 2px 6px rgba(0,0,0,0.2), inset 0 0 8px rgba(0,0,0,0.1)`,
              transition: TRANSITION,
            }}
          />
          {/* Shelves */}
          <div className="absolute left-0 right-0" style={{ top: '33%', height: '2px', background: `hsl(25, 12%, ${silL + 5}%)`, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: TRANSITION }} />
          <div className="absolute left-0 right-0" style={{ top: '66%', height: '2px', background: `hsl(25, 12%, ${silL + 5}%)`, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: TRANSITION }} />
          {/* Books row 1 */}
          <div className="absolute" style={{ top: '4%', left: '8%', width: '20%', height: '27%', borderRadius: '1px', background: `linear-gradient(90deg, hsl(350, 18%, ${silL + 2}%) 0%, hsl(350, 14%, ${silL}%) 100%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '6%', left: '30%', width: '16%', height: '25%', borderRadius: '1px', background: `hsl(210, 16%, ${silL + 2}%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '3%', left: '48%', width: '22%', height: '28%', borderRadius: '1px', background: `linear-gradient(90deg, hsl(40, 14%, ${silL + 1}%) 0%, hsl(35, 12%, ${silL}%) 100%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '8%', left: '72%', width: '18%', height: '23%', borderRadius: '1px', background: `hsl(160, 10%, ${silL + 1}%)`, transition: TRANSITION }} />
          {/* Books row 2 */}
          <div className="absolute" style={{ top: '37%', left: '6%', width: '24%', height: '27%', borderRadius: '1px', background: `hsl(220, 14%, ${silL + 1}%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '39%', left: '34%', width: '18%', height: '24%', borderRadius: '1px', background: `linear-gradient(90deg, hsl(20, 16%, ${silL + 2}%) 0%, hsl(15, 14%, ${silL}%) 100%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '36%', left: '56%', width: '14%', height: '28%', borderRadius: '1px', background: `hsl(280, 10%, ${silL + 1}%)`, transition: TRANSITION }} />
          {/* Decorative object on shelf 2 */}
          <div className="absolute" style={{ top: '38%', left: '74%', width: '16%', height: '20%', borderRadius: '50% 50% 2px 2px', background: `hsl(30, 14%, ${silL + 3}%)`, transition: TRANSITION }} />
          {/* Books row 3 */}
          <div className="absolute" style={{ top: '70%', left: '10%', width: '18%', height: '26%', borderRadius: '1px', background: `hsl(180, 10%, ${silL + 1}%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '72%', left: '32%', width: '22%', height: '24%', borderRadius: '1px', background: `linear-gradient(90deg, hsl(0, 12%, ${silL + 2}%) 0%, hsl(355, 10%, ${silL}%) 100%)`, transition: TRANSITION }} />
          <div className="absolute" style={{ top: '71%', left: '58%', width: '20%', height: '25%', borderRadius: '1px', background: `hsl(50, 10%, ${silL + 1}%)`, transition: TRANSITION }} />
        </div>

        {/* ── Floor lamp with shade — right of center ── */}
        <div
          className="absolute"
          style={{ bottom: '22%', right: '30%', transition: TRANSITION }}
        >
          {/* Shade */}
          <div
            style={{
              width: '22px',
              height: '16px',
              margin: '0 auto',
              borderRadius: '2px 2px 4px 4px',
              background: `linear-gradient(180deg,
                hsl(40, 18%, ${silL + 6}%) 0%,
                hsl(35, 14%, ${silL + 3}%) 100%)`,
              boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)`,
              transition: TRANSITION,
            }}
          />
          {/* Pole */}
          <div style={{ width: '2px', height: '38px', margin: '0 auto', background: `linear-gradient(180deg, hsl(35, 8%, ${silL + 5}%) 0%, hsl(35, 6%, ${silL + 3}%) 100%)`, transition: TRANSITION }} />
          {/* Base */}
          <div style={{ width: '16px', height: '4px', borderRadius: '2px', background: `linear-gradient(180deg, hsl(35, 8%, ${silL + 4}%) 0%, hsl(35, 6%, ${silL + 2}%) 100%)`, transition: TRANSITION }} />
        </div>

        {/* Light cone from bulb */}
        <div
          className="absolute"
          style={{
            top: '45%',
            left: '12%',
            right: '12%',
            bottom: '0%',
            transition: TRANSITION,
            opacity: t * 0.1,
            background: `linear-gradient(180deg,
              hsla(${warmHue}, ${warmSat}%, 65%, 0.6) 0%,
              hsla(${warmHue}, ${warmSat * 0.5}%, 45%, 0) 100%)`,
            clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Wall light spill — soft light hitting the wall behind the bulb */}
        <div
          className="absolute"
          style={{
            top: '10%',
            left: '25%',
            right: '25%',
            height: '40%',
            transition: TRANSITION,
            borderRadius: '50%',
            background: `radial-gradient(circle,
              hsla(${warmHue}, ${warmSat}%, 60%, ${t * 0.08}) 0%,
              transparent 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* ── Floating Bulb (centered, z-10) ── */}
        <div
          className="absolute z-10"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Ambient glow behind glass */}
          <div
            className="absolute"
            style={{
              transition: TRANSITION,
              top: `${GLASS_SIZE / 2 - (GLASS_SIZE * (0.7 + t * 0.4)) / 2}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${GLASS_SIZE * (0.7 + t * 0.7)}px`,
              height: `${GLASS_SIZE * (0.7 + t * 0.7)}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle,
                hsla(${warmHue}, ${warmSat}%, 60%, ${glowOpacity * 0.4}) 0%,
                hsla(${warmHue}, ${warmSat}%, 50%, ${glowOpacity * 0.15}) 50%,
                transparent 100%)`,
            }}
          />

          {/* Glass envelope — circular */}
          <div
            className="relative"
            style={{
              width: `${GLASS_SIZE}px`,
              height: `${GLASS_SIZE}px`,
              transition: TRANSITION,
              borderRadius: '50%',
              background: t > 0
                ? `radial-gradient(circle at 48% 46%,
                    hsla(${warmHue}, ${bulbS}%, ${bulbL}%, 1) 0%,
                    hsla(${warmHue}, ${bulbS * 0.8}%, ${bulbL * 0.75}%, 0.95) 35%,
                    hsla(${warmHue}, ${bulbS * 0.6}%, ${bulbL * 0.55}%, 0.9) 65%,
                    hsla(${warmHue}, ${bulbS * 0.4}%, ${bulbL * 0.35}%, 0.85) 100%)`
                : `radial-gradient(circle at 48% 46%,
                    hsl(220, 6%, 22%) 0%,
                    hsl(220, 8%, 15%) 45%,
                    hsl(220, 10%, 10%) 100%)`,
              boxShadow: t > 0
                ? `0 0 ${glowRadius}px ${glowRadius * 0.4}px hsla(${warmHue}, ${warmSat}%, 55%, ${glowOpacity * 0.5}),
                   0 0 ${glowRadius * 0.4}px ${glowRadius * 0.15}px hsla(${warmHue}, ${warmSat}%, 75%, ${glowOpacity * 0.3}),
                   inset 0 -8px 22px hsla(${warmHue}, ${warmSat}%, 90%, ${t * 0.1}),
                   inset 0 8px 18px hsla(${warmHue}, ${warmSat}%, 25%, 0.1)`
                : `inset 0 -6px 12px rgba(255,255,255,0.03),
                   inset 0 6px 12px rgba(0,0,0,0.15),
                   0 4px 20px rgba(0,0,0,0.25)`,
            }}
          >
            {/* Glass specular highlight */}
            <div
              className="absolute"
              style={{
                top: '13%',
                left: '19%',
                width: '30%',
                height: '26%',
                borderRadius: '50%',
                transition: TRANSITION,
                background: `radial-gradient(ellipse at 50% 50%,
                  rgba(255,255,255,${0.06 + t * 0.16}) 0%,
                  transparent 100%)`,
              }}
            />

            {/* Filament (visible when dim or off) */}
            {t <= 0.3 && (
              <div
                className="absolute"
                style={{
                  top: '30%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '34px',
                  height: '38px',
                  opacity: t > 0 ? 0.7 : 0.2,
                  transition: TRANSITION,
                }}
              >
                <div className="absolute" style={{ left: '30%', top: 0, width: '1px', height: '100%', background: `hsla(${warmHue}, ${t > 0 ? 60 : 0}%, ${t > 0 ? 45 : 25}%, ${t > 0 ? 0.5 : 0.3})` }} />
                <div className="absolute" style={{ right: '30%', top: 0, width: '1px', height: '100%', background: `hsla(${warmHue}, ${t > 0 ? 60 : 0}%, ${t > 0 ? 45 : 25}%, ${t > 0 ? 0.5 : 0.3})` }} />
                <div
                  className="absolute"
                  style={{
                    top: '18%', left: '18%', right: '18%', height: '58%',
                    borderRadius: '50%',
                    border: `1.5px solid hsla(${warmHue}, ${t > 0 ? 80 : 0}%, ${t > 0 ? 50 : 22}%, ${t > 0 ? 0.6 : 0.25})`,
                    borderBottom: 'none',
                  }}
                />
              </div>
            )}

            {/* ── Tap zones inside the glass ── */}
            <div
              className="absolute inset-0 flex flex-col z-20 overflow-hidden"
              style={{ borderRadius: '50%' }}
            >
              {ZONES.map((zone) => (
                <button
                  key={zone.value}
                  onClick={() => !disabled && onBrightnessChange(zone.value)}
                  disabled={disabled}
                  style={{ pointerEvents: 'auto' }}
                  className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                    zone.value !== activeValue ? 'hover:bg-white/[0.04]' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Neck */}
          <div
            style={{
              width: '50px',
              height: '14px',
              marginTop: '-4px',
              background: `linear-gradient(180deg,
                hsl(${bulbHue}, ${Math.max(bulbS * 0.4, 5)}%, ${Math.min(bulbL * 0.7, 50)}%) 0%,
                hsl(${bulbHue}, ${Math.max(bulbS * 0.3, 5)}%, ${Math.min(bulbL * 0.6, 40)}%) 100%)`,
              borderRadius: '6px 6px 0 0',
              transition: TRANSITION,
            }}
          />

          {/* Screw threads */}
          <div
            style={{
              width: '46px',
              height: '26px',
              background: `repeating-linear-gradient(180deg,
                hsl(40, 8%, 55%) 0px,
                hsl(38, 10%, 46%) 3px,
                hsl(40, 7%, 54%) 5px,
                hsl(38, 10%, 48%) 7px,
                hsl(40, 8%, 55%) 10px)`,
              borderRadius: '3px',
              boxShadow: 'inset 0 0 4px rgba(0,0,0,0.15)',
            }}
          />

          {/* Insulator ring */}
          <div
            style={{
              width: '28px',
              height: '5px',
              background: 'hsl(220, 8%, 18%)',
              borderRadius: '1px',
            }}
          />

          {/* Contact tip */}
          <div
            style={{
              width: '12px',
              height: '8px',
              borderRadius: '0 0 3px 3px',
              background: 'linear-gradient(180deg, hsl(35, 6%, 48%) 0%, hsl(35, 8%, 56%) 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </div>

      </div>

      {/* Status label */}
      <p className="text-sm text-zinc-400">{getStatusLabel(activeValue)}</p>
    </div>
  );
}
