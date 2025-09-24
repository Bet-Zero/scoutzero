/**
 * Purpose: Provide Dialog primitives (Dialog, DialogContent).
 * Inputs: open, onOpenChange, children, content props.
 * Outputs: Accessible dialog container/content.
 * Risks: None known.
 * Next TODO: Document usage patterns for portal vs inline rendering.
*/
// dialog.jsx — simple modal wrapper for CreateListModal

import React, { useEffect, useRef } from 'react';

export const Dialog = ({ open, onOpenChange, children, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }) => {
  if (!open) return null;

  const containerRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [onOpenChange]);

  const handleOverlayClick = () => {
    onOpenChange?.(false);
  };

  const handleContentClick = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={containerRef}
        className="bg-[#111] border border-white/10 rounded-lg shadow-xl p-6 max-w-md w-full focus:outline-none"
        onClick={handleContentClick} // prevent modal from closing when clicking inside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className = '', ...props }) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};
