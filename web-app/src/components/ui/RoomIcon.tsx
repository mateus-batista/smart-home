import React, { memo } from 'react';

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function KitchenIcon() {
  return (
    <svg {...svgProps}>
      {/* Frying pan */}
      <circle cx="10" cy="12" r="7" fill="currentColor" fillOpacity="0.15" />
      <circle cx="10" cy="12" r="7" />
      <line x1="17" y1="12" x2="22" y2="12" strokeWidth="2.5" />
      {/* Steam */}
      <path d="M7 6.5c0-1 1-1.5 1-2.5" strokeOpacity="0.5" />
      <path d="M10 5.5c0-1 1-1.5 1-2.5" strokeOpacity="0.5" />
      <path d="M13 6.5c0-1 1-1.5 1-2.5" strokeOpacity="0.5" />
    </svg>
  );
}

function BedroomIcon() {
  return (
    <svg {...svgProps}>
      {/* Bed frame */}
      <path d="M3 18V10a2 2 0 012-2h14a2 2 0 012 2v8" />
      {/* Mattress top */}
      <path d="M3 14h18" />
      {/* Headboard */}
      <path d="M5 8V5a1 1 0 011-1h12a1 1 0 011 1v3" />
      {/* Pillow */}
      <rect x="6" y="9.5" width="5" height="3" rx="1.5" fill="currentColor" fillOpacity="0.2" />
      {/* Legs */}
      <line x1="4" y1="18" x2="4" y2="20" />
      <line x1="20" y1="18" x2="20" y2="20" />
    </svg>
  );
}

function LivingRoomIcon() {
  return (
    <svg {...svgProps}>
      {/* Sofa seat */}
      <path d="M4 14h16v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3z" fill="currentColor" fillOpacity="0.15" />
      {/* Backrest */}
      <path d="M6 14V9a2 2 0 012-2h8a2 2 0 012 2v5" />
      {/* Armrests */}
      <path d="M4 14v-3a2 2 0 012-2" />
      <path d="M20 14v-3a2 2 0 00-2-2" />
      {/* Cushion line */}
      <line x1="12" y1="14" x2="12" y2="8" strokeOpacity="0.3" />
      {/* Legs */}
      <line x1="6" y1="19" x2="5" y2="21" />
      <line x1="18" y1="19" x2="19" y2="21" />
    </svg>
  );
}

function BathroomIcon() {
  return (
    <svg {...svgProps}>
      {/* Bathtub body */}
      <path d="M4 12h16v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4z" fill="currentColor" fillOpacity="0.15" />
      <path d="M4 12h16" strokeWidth="2" />
      {/* Faucet */}
      <path d="M6 12V8a2 2 0 012-2h1" />
      <circle cx="10.5" cy="6" r="1" fill="currentColor" stroke="none" />
      {/* Water drops */}
      <path d="M10.5 8v2" strokeOpacity="0.4" />
      {/* Feet */}
      <path d="M7 20l-1 1" />
      <path d="M17 20l1 1" />
    </svg>
  );
}

function OfficeIcon() {
  return (
    <svg {...svgProps}>
      {/* Desk lamp arm */}
      <path d="M6 20l5-8" strokeWidth="1.8" />
      <path d="M11 12l5-6" strokeWidth="1.8" />
      {/* Lamp shade */}
      <path d="M12 6l5-2v1l-5 3-5-3v-1l5 2z" fill="currentColor" fillOpacity="0.2" />
      {/* Light glow */}
      <path d="M13 9l1 3" strokeOpacity="0.3" />
      <path d="M15 8l2 2" strokeOpacity="0.3" />
      {/* Base */}
      <ellipse cx="6" cy="20" rx="3" ry="1" />
    </svg>
  );
}

function GarageIcon() {
  return (
    <svg {...svgProps}>
      {/* Garage frame */}
      <path d="M3 21V6l9-4 9 4v15" />
      {/* Garage door */}
      <rect x="5" y="9" width="14" height="12" rx="1" fill="currentColor" fillOpacity="0.1" />
      {/* Door slats */}
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="15" x2="19" y2="15" />
      <line x1="5" y1="18" x2="19" y2="18" />
      {/* Handle */}
      <circle cx="16" cy="16.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GardenIcon() {
  return (
    <svg {...svgProps}>
      {/* Flower stem */}
      <path d="M12 22v-10" strokeWidth="1.8" />
      {/* Leaves */}
      <path d="M12 18c-3-1-4-4-3-6" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 16c3-1 4-4 3-6" fill="currentColor" fillOpacity="0.15" />
      {/* Flower petals */}
      <circle cx="12" cy="8" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="9.5" cy="6.5" r="2" fill="currentColor" fillOpacity="0.15" />
      <circle cx="14.5" cy="6.5" r="2" fill="currentColor" fillOpacity="0.15" />
      <circle cx="10" cy="9.5" r="2" fill="currentColor" fillOpacity="0.15" />
      <circle cx="14" cy="9.5" r="2" fill="currentColor" fillOpacity="0.15" />
      {/* Center */}
      <circle cx="12" cy="8" r="1.5" fill="currentColor" fillOpacity="0.4" stroke="none" />
    </svg>
  );
}

function BalconyIcon() {
  return (
    <svg {...svgProps}>
      {/* Railing */}
      <line x1="2" y1="14" x2="22" y2="14" strokeWidth="2" />
      {/* Balusters */}
      <line x1="5" y1="14" x2="5" y2="21" />
      <line x1="9" y1="14" x2="9" y2="21" />
      <line x1="13" y1="14" x2="13" y2="21" />
      <line x1="17" y1="14" x2="17" y2="21" />
      {/* Bottom rail */}
      <line x1="3" y1="21" x2="21" y2="21" strokeWidth="1.5" />
      {/* Sun */}
      <circle cx="12" cy="7" r="3" fill="currentColor" fillOpacity="0.25" />
      {/* Rays */}
      <line x1="12" y1="2" x2="12" y2="3" strokeOpacity="0.4" />
      <line x1="7" y1="4" x2="8" y2="5" strokeOpacity="0.4" />
      <line x1="17" y1="4" x2="16" y2="5" strokeOpacity="0.4" />
      <line x1="5" y1="7" x2="6" y2="7" strokeOpacity="0.4" />
      <line x1="19" y1="7" x2="18" y2="7" strokeOpacity="0.4" />
    </svg>
  );
}

function DiningIcon() {
  return (
    <svg {...svgProps}>
      {/* Candelabra — very Belle! */}
      {/* Base */}
      <ellipse cx="12" cy="21" rx="4" ry="1" />
      {/* Stem */}
      <line x1="12" y1="21" x2="12" y2="10" strokeWidth="1.5" />
      {/* Arms */}
      <path d="M12 12c-3 0-5-1-6-3" />
      <path d="M12 12c3 0 5-1 6-3" />
      {/* Candle holders */}
      <rect x="5" y="7" width="2" height="3" rx="0.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="11" y="6" width="2" height="4" rx="0.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="17" y="7" width="2" height="3" rx="0.5" fill="currentColor" fillOpacity="0.2" />
      {/* Flames */}
      <path d="M6 7c0-1.5 0.5-2.5 0.5-2.5S7 5.5 7 7" fill="currentColor" fillOpacity="0.3" stroke="none" />
      <path d="M12 6c0-1.5 0.5-2.5 0.5-2.5S13 4.5 13 6" fill="currentColor" fillOpacity="0.3" stroke="none" />
      <path d="M18 7c0-1.5 0.5-2.5 0.5-2.5S19 5.5 19 7" fill="currentColor" fillOpacity="0.3" stroke="none" />
    </svg>
  );
}

function DefaultRoomIcon() {
  return (
    <svg {...svgProps}>
      {/* House */}
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5" />
      {/* Door */}
      <rect x="10" y="14" width="4" height="6" rx="0.5" fill="currentColor" fillOpacity="0.15" />
      {/* Window */}
      <rect x="6.5" y="11" width="3.5" height="3" rx="0.5" fill="currentColor" fillOpacity="0.1" />
    </svg>
  );
}

function UnassignedIcon() {
  return (
    <svg {...svgProps}>
      {/* Open box */}
      <path d="M21 8V21H3V8" />
      <path d="M1 3h22v5H1V3z" fill="currentColor" fillOpacity="0.15" />
      <path d="M1 3h22v5H1z" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

const iconMap: Record<string, () => React.JSX.Element> = {
  kitchen: KitchenIcon,
  bedroom: BedroomIcon,
  'living room': LivingRoomIcon,
  bathroom: BathroomIcon,
  office: OfficeIcon,
  garage: GarageIcon,
  garden: GardenIcon,
  balcony: BalconyIcon,
  dining: DiningIcon,
  unassigned: UnassignedIcon,
};

function getIconComponent(name: string): () => React.JSX.Element {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return Icon;
  }
  return DefaultRoomIcon;
}

interface RoomIconProps {
  name: string;
  className?: string;
}

function RoomIconComponent({ name, className = 'w-5 h-5' }: RoomIconProps) {
  const Icon = getIconComponent(name);
  return (
    <span className={`inline-flex ${className}`}>
      <Icon />
    </span>
  );
}

export const RoomIcon = memo(RoomIconComponent);
