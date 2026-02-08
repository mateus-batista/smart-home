import { memo } from 'react';
import { X } from 'lucide-react';

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
    default: 'p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white',
    overlay: 'p-2 rounded-full bg-black/20 hover:bg-black/40 text-white',
    subtle: 'p-2 rounded-xl hover:bg-white/8 text-zinc-400 hover:text-white',
  };

  const sizeMap = {
    sm: 20,
    md: 24,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <X size={sizeMap[size]} strokeWidth={2} />
    </button>
  );
}

export const CloseButton = memo(CloseButtonComponent);
