import { memo, type ReactNode } from 'react';

interface EmptyStateProps {
  /** Icon to display (React node, typically an SVG) */
  icon: ReactNode;
  /** Main message text */
  title: string;
  /** Secondary description text */
  description?: string;
  /** Optional action button */
  action?: ReactNode;
  className?: string;
}

function EmptyStateComponent({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
        <span className="w-8 h-8 text-zinc-600">{icon}</span>
      </div>
      <p className="text-zinc-400 font-medium">{title}</p>
      {description && <p className="text-zinc-500 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);

// Re-export icons from separate file
export { EmptyStateIcons } from './EmptyStateIcons';
