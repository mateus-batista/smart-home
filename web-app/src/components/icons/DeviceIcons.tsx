import type { DeviceIconType } from '../../types/devices';

interface DeviceIconProps {
  iconType: DeviceIconType | 'empty';
  isOn: boolean;
  position?: number; // 0-100, for shades (visual openness)
  className?: string;
}

const LC = 'round' as const;

function BulbIcon({ isOn, className }: { isOn: boolean; className: string }) {
  return (
    <svg className={`${className} ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Glass envelope */}
      <path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
      {/* Tungsten filament zigzag */}
      <path d="M10 7.5l1 1.5-1 1.5 1 1.5-1 1.5" strokeWidth="1" strokeOpacity={isOn ? 0.8 : 0.4} fill="none" />
      <path d="M14 7.5l-1 1.5 1 1.5-1 1.5 1 1.5" strokeWidth="1" strokeOpacity={isOn ? 0.8 : 0.4} fill="none" />
      {/* Filament anchor points */}
      <line x1="10" y1="7.5" x2="12" y2="6.5" strokeWidth="0.8" strokeOpacity={isOn ? 0.6 : 0.3} />
      <line x1="14" y1="7.5" x2="12" y2="6.5" strokeWidth="0.8" strokeOpacity={isOn ? 0.6 : 0.3} />
      {/* Screw base threads */}
      <path d="M9 18h6" />
      <path d="M9.5 19.2h5" strokeWidth="1" />
      <path d="M10 20.4h4" strokeWidth="1" />
      <path d="M10.5 21.5h3" strokeWidth="1" />
      {/* Glow rays when on */}
      {isOn && (
        <>
          <line x1="12" y1="0" x2="12" y2="1" strokeOpacity="0.35" />
          <line x1="4.2" y1="4.2" x2="4.9" y2="4.9" strokeOpacity="0.35" />
          <line x1="0.5" y1="12" x2="1.5" y2="12" strokeOpacity="0.35" />
          <line x1="22.5" y1="12" x2="23.5" y2="12" strokeOpacity="0.35" />
          <line x1="19.8" y1="4.2" x2="19.1" y2="4.9" strokeOpacity="0.35" />
        </>
      )}
    </svg>
  );
}

function NanoleafIcon({ isOn, className }: { isOn: boolean; className: string }) {
  return (
    <svg className={`${className} ${isOn ? 'text-emerald-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Top panel */}
      <path d="M12 1.5L5.5 12h13L12 1.5z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.3 : 0} />
      {/* Bottom-left panel */}
      <path d="M5.5 12L2.5 21.5h9L5.5 12z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
      {/* Bottom-right panel */}
      <path d="M18.5 12L12.5 21.5h9L18.5 12z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.25 : 0} />
      {/* Panel gap lines for tessellation feel */}
      <line x1="5.5" y1="12" x2="18.5" y2="12" strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="12" y1="1.5" x2="5.5" y2="12" strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="12" y1="1.5" x2="18.5" y2="12" strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="5.5" y1="12" x2="11.5" y2="21.5" strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="18.5" y1="12" x2="12.5" y2="21.5" strokeOpacity="0.5" strokeWidth="1.2" />
      {/* Inner panel detail lines */}
      <line x1="8.75" y1="6.75" x2="12" y2="12" strokeOpacity="0.15" strokeWidth="0.8" />
      <line x1="15.25" y1="6.75" x2="12" y2="12" strokeOpacity="0.15" strokeWidth="0.8" />
      {/* Edge glow when on */}
      {isOn && (
        <path d="M12 1.5L5.5 12 2.5 21.5h9l1-9.5 6 9.5h3L18.5 12z" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" fill="none" />
      )}
    </svg>
  );
}

function BlindTiltIcon({ isOn, position = 0, className }: { isOn: boolean; position: number; className: string }) {
  const active = position > 50;
  const slatAngle = active ? 25 : 0;
  return (
    <svg className={`${className} ${active ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Window frame */}
      <rect x="3" y="2" width="18" height="20" rx="2.5" />
      {/* Slats with thickness (rectangles that rotate) */}
      {[6, 9.5, 13, 16.5].map((y, i) => (
        <g key={i} transform={`rotate(${slatAngle} 12 ${y})`}>
          <rect x="5.5" y={y - 0.7} width="13" height="1.4" rx="0.4" fill="currentColor" fillOpacity={isOn ? 0.25 : 0.15} stroke="currentColor" strokeWidth="0.8" />
        </g>
      ))}
      {/* Tilt wand */}
      <line x1="20" y1="5" x2="20" y2="19" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="20" cy="19" r="0.8" fill="currentColor" fillOpacity="0.4" stroke="none" />
    </svg>
  );
}

function CurtainIcon({ position = 0, className }: { isOn: boolean; position: number; className: string }) {
  const active = position > 50;
  return (
    <svg className={`${className} ${active ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Curtain rod */}
      <line x1="1.5" y1="3" x2="22.5" y2="3" strokeWidth="1.8" />
      {/* Finials */}
      <circle cx="1.5" cy="3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="22.5" cy="3" r="1.2" fill="currentColor" stroke="none" />
      {/* Rod rings */}
      <circle cx="5" cy="3" r="0.5" strokeWidth="0.6" fill="none" strokeOpacity="0.5" />
      <circle cx="8" cy="3" r="0.5" strokeWidth="0.6" fill="none" strokeOpacity="0.5" />
      <circle cx="16" cy="3" r="0.5" strokeWidth="0.6" fill="none" strokeOpacity="0.5" />
      <circle cx="19" cy="3" r="0.5" strokeWidth="0.6" fill="none" strokeOpacity="0.5" />
      {/* Left drape with fabric folds */}
      <path d={active ? 'M3 3.5c0 0 1.5 7 0.5 18' : 'M3 3.5c0 0 6 5 5 18'} fill="currentColor" fillOpacity={active ? 0.12 : 0.25} />
      <path d={active ? 'M4.5 3.5c0 0 1.5 7 0.5 18' : 'M6 3.5c0 0 5 5 3 18'} fill="currentColor" fillOpacity={active ? 0.08 : 0.18} />
      <path d={active ? 'M6 3.5c0 0 1 7 0 18' : 'M9 3.5c0 0 3 5 1 18'} fill="currentColor" fillOpacity={active ? 0.05 : 0.12} />
      {/* Right drape with fabric folds */}
      <path d={active ? 'M21 3.5c0 0 -1.5 7 -0.5 18' : 'M21 3.5c0 0 -6 5 -5 18'} fill="currentColor" fillOpacity={active ? 0.12 : 0.25} />
      <path d={active ? 'M19.5 3.5c0 0 -1.5 7 -0.5 18' : 'M18 3.5c0 0 -5 5 -3 18'} fill="currentColor" fillOpacity={active ? 0.08 : 0.18} />
      <path d={active ? 'M18 3.5c0 0 -1 7 0 18' : 'M15 3.5c0 0 -3 5 -1 18'} fill="currentColor" fillOpacity={active ? 0.05 : 0.12} />
      {/* Tie-backs when open */}
      {active && (
        <>
          <path d="M2 14c1.5-0.5 2.5-0.5 4 0" strokeWidth="1" strokeOpacity="0.4" fill="none" />
          <path d="M22 14c-1.5-0.5 -2.5-0.5 -4 0" strokeWidth="1" strokeOpacity="0.4" fill="none" />
        </>
      )}
    </svg>
  );
}

function RollerShadeIcon({ position = 0, className }: { isOn: boolean; position: number; className: string }) {
  const active = position > 50;
  const fabricH = Math.max(2, 16 - (position / 100) * 14);
  return (
    <svg className={`${className} ${active ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Window frame */}
      <rect x="3" y="2" width="18" height="20" rx="2.5" />
      {/* Roller tube with diameter */}
      <rect x="4" y="3" width="16" height="2.8" rx="1.4" fill="currentColor" fillOpacity="0.35" stroke="none" />
      <line x1="4" y1="4.4" x2="20" y2="4.4" strokeWidth="0.5" strokeOpacity="0.2" />
      {/* Shade fabric */}
      <rect x="5" y="5.8" width="14" height={fabricH} rx="0.5" fill="currentColor" fillOpacity="0.22" stroke="none" />
      {/* Fabric texture lines */}
      {fabricH > 4 && (
        <>
          <line x1="5.5" y1={5.8 + fabricH * 0.33} x2="18.5" y2={5.8 + fabricH * 0.33} strokeWidth="0.4" strokeOpacity="0.12" />
          <line x1="5.5" y1={5.8 + fabricH * 0.66} x2="18.5" y2={5.8 + fabricH * 0.66} strokeWidth="0.4" strokeOpacity="0.12" />
        </>
      )}
      {/* Bottom bar */}
      <line x1="5" y1={5.8 + fabricH} x2="19" y2={5.8 + fabricH} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Pull cord */}
      <line x1="18" y1={5.8 + fabricH} x2="18" y2={Math.min(5.8 + fabricH + 3, 21)} strokeWidth="0.7" strokeOpacity="0.3" />
      <circle cx="18" cy={Math.min(5.8 + fabricH + 3, 21)} r="0.6" fill="currentColor" fillOpacity="0.3" stroke="none" />
    </svg>
  );
}

function GenericShadeIcon({ position = 0, className }: { isOn: boolean; position: number; className: string }) {
  const active = position > 50;
  const shadeH = Math.max(2, 16 - (position / 100) * 14);
  return (
    <svg className={`${className} ${active ? 'text-blue-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Window frame */}
      <rect x="3" y="2" width="18" height="20" rx="2.5" />
      {/* Window cross panes */}
      <line x1="12" y1="2" x2="12" y2="22" strokeOpacity="0.2" />
      <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.2" />
      {/* Shade overlay */}
      <rect x="3.75" y="2.75" width="16.5" height={shadeH} rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />
    </svg>
  );
}

function StripIcon({ isOn, className }: { isOn: boolean; className: string }) {
  return (
    <svg className={`${className} ${isOn ? 'text-violet-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* LED strip body */}
      <rect x="1" y="9.5" width="22" height="5" rx="2.5" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.2 : 0} />
      {/* Individual LEDs */}
      <circle cx="5.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
      <circle cx="9.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
      <circle cx="13.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
      <circle cx="17.5" cy="12" r={isOn ? 1.4 : 1} fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.9 : 0} />
      {/* Glow halos when on */}
      {isOn && (
        <>
          <circle cx="5.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
          <circle cx="9.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
          <circle cx="13.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
          <circle cx="17.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="none" />
        </>
      )}
    </svg>
  );
}

function GenericLightIcon({ isOn, className }: { isOn: boolean; className: string }) {
  return (
    <svg className={`${className} ${isOn ? 'text-amber-400' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={LC} strokeLinejoin={LC}>
      {/* Pendant cord */}
      <line x1="12" y1="1" x2="12" y2="5" />
      {/* Lamp shade */}
      <path d="M7 5h10l-2 8H9L7 5z" fill={isOn ? 'currentColor' : 'none'} fillOpacity={isOn ? 0.25 : 0} />
      <ellipse cx="12" cy="13" rx="3" ry="1" />
      {/* Glow rays */}
      {isOn && (
        <>
          <path d="M8 15l-2 5" strokeOpacity="0.3" />
          <path d="M16 15l2 5" strokeOpacity="0.3" />
          <path d="M12 14v6" strokeOpacity="0.3" />
        </>
      )}
    </svg>
  );
}

export function DeviceIcon({ iconType, isOn, position = 0, className = 'w-8 h-8' }: DeviceIconProps) {
  const cls = `${className} transition-colors`;

  switch (iconType) {
    case 'bulb':
      return <BulbIcon isOn={isOn} className={cls} />;
    case 'nanoleaf':
      return <NanoleafIcon isOn={isOn} className={cls} />;
    case 'blind-tilt':
      return <BlindTiltIcon isOn={isOn} position={position} className={cls} />;
    case 'curtain':
      return <CurtainIcon isOn={isOn} position={position} className={cls} />;
    case 'roller-shade':
      return <RollerShadeIcon isOn={isOn} position={position} className={cls} />;
    case 'generic-shade':
      return <GenericShadeIcon isOn={isOn} position={position} className={cls} />;
    case 'strip':
      return <StripIcon isOn={isOn} className={cls} />;
    case 'generic-light':
    case 'empty':
    default:
      return <GenericLightIcon isOn={isOn} className={cls} />;
  }
}
