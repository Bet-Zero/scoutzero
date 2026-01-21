/**
 * FILE: src/features/profile/SaveStatusIndicator.jsx
 * PURPOSE: Minimal save status indicator for profile autosave feedback.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 2 save flow reliability
 *
 * LINKS:
 *  - Plan: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_2_RP.md
 */

import React from 'react';

/**
 * Minimal save status indicator component.
 * Shows: idle (nothing), saving..., saved, or error state.
 *
 * @param {Object} props
 * @param {'idle'|'saving'|'saved'|'error'} props.saveState - Current save state
 * @param {string|null} props.saveError - Error message if save failed
 */
const SaveStatusIndicator = ({ saveState, saveError }) => {
  // Don't render anything in idle state
  if (saveState === 'idle') {
    return null;
  }

  const getStateStyles = () => {
    switch (saveState) {
      case 'saving':
        return 'text-yellow-400';
      case 'saved':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-white/40';
    }
  };

  const getStateText = () => {
    switch (saveState) {
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'Saved';
      case 'error':
        return saveError
          ? `Save failed: ${saveError.slice(0, 50)}`
          : 'Save failed';
      default:
        return '';
    }
  };

  return (
    <div
      className={`text-xs font-medium px-3 py-1 rounded-full ${getStateStyles()}`}
      role="status"
      aria-live="polite"
    >
      {getStateText()}
    </div>
  );
};

export default SaveStatusIndicator;
