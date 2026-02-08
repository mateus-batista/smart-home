import { memo } from 'react';

interface LoadingSpinnerProps {
  /** Size variant: 'xs', 'sm', 'md', 'lg' */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Color variant */
  color?: 'white' | 'zinc' | 'primary' | 'red' | 'green' | 'blue';
  className?: string;
}

function LoadingSpinnerComponent({
  size = 'sm',
  color = 'white',
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'w-2.5 h-2.5 border-2',
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-2',
  };

  const colorClasses = {
    white: 'border-white/30 border-t-white',
    zinc: 'border-zinc-300 border-t-zinc-600',
    primary: 'border-violet-300 border-t-violet-500',
    red: 'border-red-400/30 border-t-red-400',
    green: 'border-amber-400/30 border-t-amber-400',
    blue: 'border-blue-400/30 border-t-blue-400',
  };

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  );
}

export const LoadingSpinner = memo(LoadingSpinnerComponent);
