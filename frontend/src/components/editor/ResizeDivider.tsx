/**
 * ResizeDivider Component
 *
 * A draggable divider between two panels. Supports both vertical (left/right)
 * and horizontal (top/bottom) orientations.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeDividerProps {
  /** 'vertical' splits left/right, 'horizontal' splits top/bottom */
  orientation?: 'vertical' | 'horizontal';
  /** Called continuously while dragging, with the mouse position in px relative to the container */
  onResize: (positionPx: number) => void;
  className?: string;
}

export const ResizeDivider: React.FC<ResizeDividerProps> = ({
  orientation = 'vertical',
  onResize,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);

  const getPosition = useCallback((clientX: number, clientY: number) => {
    const container = dividerRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (orientation === 'vertical') {
      onResize(clientX - rect.left);
    } else {
      onResize(clientY - rect.top);
    }
  }, [onResize, orientation]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => getPosition(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        getPosition(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleEnd = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, getPosition]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`${isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        ${isDragging ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}
        hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors shrink-0
        ${className || ''}`}
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
    />
  );
};
