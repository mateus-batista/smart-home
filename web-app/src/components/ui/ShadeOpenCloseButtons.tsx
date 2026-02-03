import { memo, useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type LoadingAction = 'open' | 'close' | null;

interface ShadeOpenCloseButtonsProps {
  /** Current visual openness (0-100) */
  visualOpenness: number;
  /** Called when Open button is clicked */
  onOpen: (e: React.MouseEvent | React.TouchEvent) => void;
  /** Called when Close button is clicked */
  onClose: (e: React.MouseEvent | React.TouchEvent) => void;
  disabled?: boolean;
  /** Show loading state (true = use internal tracking, 'open'/'close' = specific button) */
  loading?: boolean | LoadingAction;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function ShadeOpenCloseButtonsComponent({
  visualOpenness,
  onOpen,
  onClose,
  disabled = false,
  loading = false,
  size = 'sm',
  className = '',
}: ShadeOpenCloseButtonsProps) {
  // Track which button was pressed locally for better UX
  const [activeAction, setActiveAction] = useState<LoadingAction>(null);

  const isFullyOpen = visualOpenness >= 100;
  const isFullyClosed = visualOpenness <= 0;

  // Determine loading state for each button
  const isLoading = loading === true || (typeof loading === 'string' && loading !== null);
  const openLoading = loading === true ? activeAction === 'open' : loading === 'open';
  const closeLoading = loading === true ? activeAction === 'close' : loading === 'close';

  // Reset active action when loading finishes (deferred to avoid sync setState in render)
  useEffect(() => {
    if (!isLoading && activeAction !== null) {
      const timer = setTimeout(() => setActiveAction(null), 0);
      return () => clearTimeout(timer);
    }
  }, [isLoading, activeAction]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLoading) {
      setActiveAction('open');
      onOpen(e);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLoading) {
      setActiveAction('close');
      onClose(e);
    }
  };

  // Large variant - full width buttons with labels
  if (size === 'lg') {
    return (
      <div className={`flex gap-3 ${className}`}>
        <button
          onClick={handleOpen}
          disabled={disabled || isLoading}
          className={`flex-1 py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isFullyOpen
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-transparent'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {openLoading ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          )}
          Open
        </button>
        <button
          onClick={handleClose}
          disabled={disabled || isLoading}
          className={`flex-1 py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isFullyClosed
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-transparent'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {closeLoading ? (
            <LoadingSpinner size="sm" color="white" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          Close
        </button>
      </div>
    );
  }

  // Small/medium variant - Segmented toggle
  const isSmall = size === 'sm';
  
  return (
    <div 
      className={`
        flex rounded-full p-1 shrink-0
        ${disabled ? 'opacity-50 bg-zinc-800' : 'bg-zinc-800'}
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Open button */}
      <button
        onClick={handleOpen}
        disabled={disabled || isLoading}
        className={`
          ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
          rounded-full font-medium transition-all flex items-center justify-center gap-1.5
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${isFullyOpen 
            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' 
            : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          }
        `}
      >
        {openLoading ? (
          <LoadingSpinner size="xs" color={isFullyOpen ? 'white' : 'zinc'} />
        ) : (
          <svg className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        )}
      </button>

      {/* Close button */}
      <button
        onClick={handleClose}
        disabled={disabled || isLoading}
        className={`
          ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
          rounded-full font-medium transition-all flex items-center justify-center gap-1.5
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${isFullyClosed 
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
            : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          }
        `}
      >
        {closeLoading ? (
          <LoadingSpinner size="xs" color={isFullyClosed ? 'white' : 'zinc'} />
        ) : (
          <svg className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export const ShadeOpenCloseButtons = memo(ShadeOpenCloseButtonsComponent);
