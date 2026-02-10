import type { ReactNode } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  /** Additional class names for the backdrop */
  backdropClassName?: string;
  /** Additional class names for the content container */
  contentClassName?: string;
  /** Close when clicking backdrop (default: true) */
  closeOnBackdropClick?: boolean;
  /** Maximum width class (default: 'max-w-md') */
  maxWidth?: string;
  /** Full screen on mobile (default: true) */
  mobileFullScreen?: boolean;
}

export function Modal({
  children,
  onClose,
  backdropClassName = '',
  contentClassName = '',
  closeOnBackdropClick = true,
  maxWidth = 'max-w-md',
  mobileFullScreen = true,
}: ModalProps) {
  useBodyScrollLock();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex sm:items-center justify-center sm:p-4 ${backdropClassName}`}
      onClick={handleBackdropClick}
    >
      <div
        className={`glass-surface ${mobileFullScreen ? 'glass-surface-flush w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl' : `rounded-3xl max-h-[90vh]`} ${maxWidth} sm:w-full flex flex-col overflow-hidden ${contentClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose: () => void;
  /** Custom styles for the header background */
  style?: React.CSSProperties;
  /** Additional class names */
  className?: string;
  /** Show close button (default: true) */
  showCloseButton?: boolean;
}

export function ModalHeader({
  children,
  onClose,
  style,
  className = '',
  showCloseButton = true,
}: ModalHeaderProps) {
  return (
    <div
      className={`p-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:p-8 sm:rounded-t-3xl transition-all relative shrink-0 ${className}`}
      style={style}
    >
      {showCloseButton && (
        <button
          onClick={onClose}
          className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 p-2.5 sm:p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
}

export function ModalContent({ children, className = '' }: ModalContentProps) {
  return <div className={`p-5 sm:p-6 pb-8 sm:pb-6 space-y-5 sm:space-y-6 overflow-y-auto ${className}`}>{children}</div>;
}
