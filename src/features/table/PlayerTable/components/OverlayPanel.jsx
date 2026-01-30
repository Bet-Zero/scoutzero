/**
 * FILE: src/features/table/PlayerTable/components/OverlayPanel.jsx
 * PURPOSE: Reusable overlay panel with click-outside and Escape key handling.
 *          Used for Filters and Sort panels to prevent layout shift.
 *
 * OWNERSHIP: Feature: table/PlayerTable
 *
 * HISTORY:
 *  - 2026-01-30: Phase 2K - Created for layout stabilization (overlay filters/sort)
 */
import React, { useRef, useEffect } from 'react';

const OverlayPanel = ({ children, onClose, className = '' }) => {
  const panelRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Small delay to avoid immediate close from the toggle click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={`bg-neutral-900 border border-white/10 rounded-md shadow-xl max-h-[300px] overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
};

export default OverlayPanel;
