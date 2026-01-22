/**
 * FILE: src/shared/components/ui/Modal.jsx
 * PURPOSE: Centered modal overlay with close behavior and basic a11y support.
 * OWNERSHIP: Shared/ui
 *
 * HISTORY:
 *  - 2026-01-22: Phase 4 - Added ESC close and focus management basics
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useRef, useEffect } from 'react';

const Modal = ({ title, children, onClose }) => {
  const modalRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    openerRef.current = document.activeElement;

    const focusTarget =
      modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || modalRef.current;

    if (focusTarget?.focus) {
      focusTarget.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function') {
        opener.focus();
      }
    };
  }, [onClose]);

  const ariaLabel = typeof title === 'string' ? title : 'Dialog';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
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
