import { memo } from 'react';

interface StatusDotProps {
  /** Whether the entity is connected/reachable */
  connected: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Add a border (useful when overlaying on colored backgrounds) */
  bordered?: boolean;
  className?: string;
}

function StatusDotComponent({
  connected,
  size = 'md',
  bordered = false,
  className = '',
}: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div
      className={`
        rounded-full
        ${sizeClasses[size]}
        ${connected ? 'bg-green-500' : 'bg-zinc-500'}
        ${bordered ? 'border-2 border-zinc-950' : ''}
        ${className}
      `}
    />
  );
}

export const StatusDot = memo(StatusDotComponent);
