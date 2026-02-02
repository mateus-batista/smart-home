import { memo } from 'react';

interface CloseButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Style variant */
  variant?: 'default' | 'overlay' | 'subtle';
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

function CloseButtonComponent({
  onClick,
  disabled = false,
  variant = 'default',
  size = 'md',
  className = '',
}: CloseButtonProps) {
  const variantClasses = {
    default: 'p-2 rounded-xl hover:bg-zinc-700 text-zinc-400 hover:text-white',
    overlay: 'p-2 rounded-full bg-black/20 hover:bg-black/40 text-white',
    subtle: 'p-2 rounded-xl hover:bg-zinc-700/50 text-zinc-400 hover:text-white',
  };

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <svg
        className={sizeClasses[size]}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}

export const CloseButton = memo(CloseButtonComponent);
