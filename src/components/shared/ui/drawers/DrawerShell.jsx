/**
 * Purpose: Sliding drawer container with overlay.
 * Inputs: isOpen, onClose, side/width (optional), children.
 * Outputs: Drawer panel with transition and overlay click-to-close.
 * Risks: None known.
 * Next TODO: Consider exposing width/side tokens via theme.
*/
// src/components/roster/DrawerShell.jsx
import React, { useEffect, useRef } from 'react';

const DrawerShell = ({
  isOpen,
  onClose,
  children,
  side = 'left',
  width = 300,
}) => {
  const panelRef = useRef(null);
  const previouslyFocusedElement = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElement.current = document.activeElement;

    const panel = panelRef.current;
    if (panel) {
      panel.focus({ preventScroll: true });
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ];

      const focusable = panel.querySelectorAll(focusableSelectors.join(','));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose]);

  const positionClass = side === 'right' ? 'right-0' : 'left-0';
  const translateClass = isOpen
    ? 'translate-x-0'
    : side === 'right'
      ? 'translate-x-full'
      : '-translate-x-full';

  return (
    <>
      <div
        ref={panelRef}
        className={`fixed ${positionClass} top-0 h-full bg-[#1a1a1a] border-white/10 z-20 flex flex-col transition-transform duration-200 ease-out overflow-y-auto focus:outline-none ${
          side === 'right' ? 'border-l' : 'border-r'
        } ${translateClass}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
      <div
        className={`fixed inset-0 bg-black/20 z-10 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => onClose?.()}
        role="presentation"
      />
    </>
  );
};

export default DrawerShell;
