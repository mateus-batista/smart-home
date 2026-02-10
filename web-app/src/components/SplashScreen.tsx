import { useState, useEffect } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const holdTimer = setTimeout(() => setFading(true), 800);
    const doneTimer = setTimeout(onDone, 1400);
    return () => { clearTimeout(holdTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(to bottom right, #09090b, #18181b, #09090b)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.12), transparent 70%)' }} />
      {/* Icon */}
      <div className="relative z-10">
        <svg width="96" height="96" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splash-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24"/>
              <stop offset="100%" stopColor="#ca8a04"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#splash-bg)"/>
          <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M6 14.5L16 7l10 7.5"/>
            <path d="M8.5 13V24a1 1 0 001 1h13a1 1 0 001-1V13"/>
            <path d="M13 19.5a4 4 0 015.5 0"/>
            <path d="M11.2 17.5a7 7 0 019.6 0"/>
            <circle cx="16" cy="21.5" r="0.9" fill="#fff" stroke="none"/>
          </g>
        </svg>
      </div>
      {/* App name */}
      <p className="relative z-10 mt-6 text-white/90 text-lg font-semibold tracking-widest">Smart Home</p>
    </div>
  );
}
