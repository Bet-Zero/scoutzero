/**
 * FILE: src/features/table/PlayerTable/components/HeaderPopover.jsx
 * PURPOSE: Portal-based popover that renders ABOVE the player list area to avoid overlap.
 *          Opens upward from the header controls, ensuring zero layout shift and no row coverage.
 *
 * OWNERSHIP: Feature: table/PlayerTable
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2O - Created for upward floating popover (Filters/Sort panels)
 *
 * LINKS:
 *  - Return Package: return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_CONTROLS_POPOVER_RETURN_PACKAGE.md
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * HeaderPopover - Renders children in a portal, positioned ABOVE the list area.
 *
 * @param {boolean} open - Whether the popover is visible
 * @param {function} onClose - Called when user clicks outside or presses Escape
 * @param {React.RefObject} anchorRef - Ref to the header controls container (for width/X positioning)
 * @param {number} maxBottomY - The Y pixel where the list begins; popover must stay ABOVE this
 * @param {React.ReactNode} children - Content to render inside the popover
 */
const HeaderPopover = ({ open, onClose, anchorRef, maxBottomY, children }) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState(null);

  // Calculate position based on anchor and maxBottomY
  const updatePosition = useCallback(() => {
    if (!anchorRef?.current || maxBottomY == null) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();

    // Popover must satisfy: popoverBottom <= listTopY - 8 (8px gap)
    // Using fixed positioning:
    // - bottom = window.innerHeight - (maxBottomY - 8)
    // - maxHeight = (maxBottomY - 8) - some top breathing room
    const listTopY = maxBottomY;
    const gapFromList = 8;
    const topBreathingRoom = 60; // Keep some space from absolute top of viewport

    setPosition({
      left: anchorRect.left,
      width: anchorRect.width,
      bottom: window.innerHeight - (listTopY - gapFromList),
      maxHeight: Math.max(100, listTopY - gapFromList - topBreathingRoom),
    });
  }, [anchorRef, maxBottomY]);

  // Update position on open and on resize/scroll
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();

    // Update on resize
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updatePosition]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      // Ignore if click is inside the popover
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      // Ignore if click is inside the anchor area (toggle buttons)
      if (anchorRef?.current && anchorRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };

    // Small delay to avoid immediate close from the toggle click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorRef]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Don't render if not open or position not calculated
  if (!open || !position) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: position.left,
        width: position.width,
        bottom: position.bottom,
        maxHeight: position.maxHeight,
        zIndex: 9999, // Above everything including sticky headers
      }}
      className="bg-neutral-900 border border-white/20 rounded-md shadow-2xl overflow-y-auto"
    >
      {children}
    </div>
  );

  return createPortal(popoverContent, document.body);
};

export default HeaderPopover;
