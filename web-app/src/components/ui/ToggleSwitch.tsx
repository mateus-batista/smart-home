import { memo } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ToggleSwitchProps {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Size variant: 'sm' (default) or 'lg' */
  size?: 'sm' | 'lg';
  /** Show loading spinner inside toggle */
  loading?: boolean;
  className?: string;
}

function ToggleSwitchComponent({
  on,
  onChange,
  disabled = false,
  size = 'sm',
  loading = false,
  className = '',
}: ToggleSwitchProps) {
  const isSmall = size === 'sm';

  const handleOn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading && !on) onChange();
  };

  const handleOff = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading && on) onChange();
  };

  return (
    <div 
      className={`
        flex rounded-full p-1 shrink-0
        ${disabled ? 'opacity-50' : ''} glass-button
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* On button */}
      <button
        onClick={handleOn}
        disabled={disabled || loading}
        className={`
          ${isSmall ? 'px-3 py-1.5' : 'px-4 py-2'}
          rounded-full font-medium transition-all flex items-center justify-center
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${on 
            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' 
            : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }
        `}
      >
        {loading && !on ? (
          <LoadingSpinner size="xs" color="white" />
        ) : (
          <svg className={isSmall ? 'w-4 h-4' : 'w-5 h-5'} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C9.24 2 7 4.24 7 7c0 1.79.94 3.36 2.35 4.25.42.26.65.72.65 1.22v.78c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-.78c0-.5.23-.96.65-1.22C16.06 10.36 17 8.79 17 7c0-2.76-2.24-5-5-5z" />
            <rect x="9" y="15" width="6" height="2" rx="1" />
            <rect x="10" y="19" width="4" height="2" rx="1" />
          </svg>
        )}
      </button>

      {/* Off button */}
      <button
        onClick={handleOff}
        disabled={disabled || loading}
        className={`
          ${isSmall ? 'px-3 py-1.5' : 'px-4 py-2'}
          rounded-full font-medium transition-all flex items-center justify-center
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${!on
            ? 'bg-zinc-600 text-white shadow-lg shadow-zinc-600/30'
            : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }
        `}
      >
        {loading && on ? (
          <LoadingSpinner size="xs" color="white" />
        ) : (
          <svg className={isSmall ? 'w-4 h-4' : 'w-5 h-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C9.24 2 7 4.24 7 7c0 1.79.94 3.36 2.35 4.25.42.26.65.72.65 1.22v.78c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-.78c0-.5.23-.96.65-1.22C16.06 10.36 17 8.79 17 7c0-2.76-2.24-5-5-5z" />
            <rect x="9" y="15" width="6" height="2" rx="1" />
            <rect x="10" y="19" width="4" height="2" rx="1" />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

export const ToggleSwitch = memo(ToggleSwitchComponent);
