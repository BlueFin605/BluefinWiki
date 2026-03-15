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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = dividerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (orientation === 'vertical') {
        onResize(e.clientX - rect.left);
      } else {
        onResize(e.clientY - rect.top);
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, orientation]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      className={`${isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        ${isDragging ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}
        hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors shrink-0
        ${className || ''}`}
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
    />
  );
};
