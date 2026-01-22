/**
 * FILE: src/shared/components/ui/Modal.jsx
 * PURPOSE: Centered modal overlay with close behavior, focus trap, and a11y support.
 * OWNERSHIP: Shared/ui
 *
 * HISTORY:
 *  - 2026-01-22: HOTFIX - Fixed focus trap to prevent focus escaping to background buttons
 *  - 2026-01-22: Phase 4 - Added ESC close and focus management basics
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useRef, useEffect, useCallback } from 'react';

const Modal = ({ title, children, onClose }) => {
  const modalRef = useRef(null);
  const openerRef = useRef(null);
  const hasInitializedRef = useRef(false);
  // Store onClose in a ref so effects don't re-run when it changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ONE-TIME initialization effect (runs only on mount)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Capture opener element ONCE on mount
    openerRef.current = document.activeElement;

    // Focus the first meaningful input (prefer textarea), fallback to modal container
    const focusFirst = () => {
      const container = modalRef.current;
      if (!container) return;

      // Prefer textarea first (for blurb editing), then other focusable elements
      const textarea = container.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        return;
      }

      const focusable = container.querySelector(
        'input, select, button:not([aria-label="Close dialog"]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
        return;
      }

      // Fallback: focus the modal container itself
      container.focus();
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(focusFirst);
  }, []); // Empty deps = mount only

  // Click outside handler (stable via ref)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // No deps needed - uses ref

  // Keyboard handler for Escape (stable via ref)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // No deps needed - uses ref

  // Focus trap: redirect focus back inside modal if it escapes
  useEffect(() => {
    const handleFocusIn = (event) => {
      const container = modalRef.current;
      if (!container) return;

      // If focus moved outside the modal, bring it back
      if (!container.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();

        // Try to focus textarea first, then modal container
        const textarea = container.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        } else {
          container.focus();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, []);

  // Restore focus to opener ONLY on unmount (modal close)
  useEffect(() => {
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function') {
        // Use setTimeout to ensure focus restoration happens after modal is fully removed
        setTimeout(() => {
          try {
            opener.focus();
          } catch {
            // Opener may have been removed from DOM
          }
        }, 0);
      }
    };
  }, []); // Empty deps = unmount only

  // Prevent keydown events from bubbling to parent handlers (e.g., arrow key navigation)
  const handleContainerKeyDown = useCallback((event) => {
    // Stop propagation for all keys except Escape (which is handled globally)
    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }, []);

  const ariaLabel = typeof title === 'string' ? title : 'Dialog';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
      onKeyDown={handleContainerKeyDown}
    >
      <div
        ref={modalRef}
        className="bg-neutral-800 text-white rounded-2xl shadow-lg p-6 max-w-xl w-full relative"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-xl font-bold hover:text-red-500"
          type="button"
          aria-label="Close dialog"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
