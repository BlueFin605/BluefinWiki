import React, { useEffect, useRef } from 'react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 'left' slides from left (default), 'bottom' slides from bottom */
  side?: 'left' | 'bottom';
}

/**
 * Slide-in drawer overlay for mobile viewports.
 * Renders children in a fixed panel with a dimmed backdrop.
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  children,
  side = 'left',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const isLeft = side === 'left';

  const panelClasses = isLeft
    ? `fixed inset-y-0 left-0 w-[85vw] max-w-[360px] transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`
    : `fixed inset-x-0 bottom-0 max-h-[85vh] transform transition-transform duration-300 ease-in-out rounded-t-2xl ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`;

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-40' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`${panelClasses} bg-white dark:bg-gray-900 shadow-xl z-10 flex flex-col`}
      >
        {children}
      </div>
    </div>
  );
};
