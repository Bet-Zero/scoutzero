/**
 * FILE: src/features/table/PlayerTable/hooks/usePlayerTableDensity.js
 * PURPOSE: Manages density mode preference (comfortable/compact) for PlayerTable with localStorage persistence.
 *
 * OWNERSHIP: Feature: table/density
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2N-Density - Created for proportional scale-based density mode
 *
 * LINKS:
 *  - Return Package: return_packages/scouting/PHASE_2N_DENSITY_MODE_RETURN_PACKAGE.md
 */
import { useState, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'players_density_mode';

/**
 * Density mode values
 * @type {Object}
 */
export const DENSITY_MODES = {
  COMFORTABLE: 'comfortable',
  COMPACT: 'compact',
};

/**
 * Scale factors for each density mode
 * @type {Object}
 */
export const DENSITY_SCALES = {
  [DENSITY_MODES.COMFORTABLE]: 1.0,
  [DENSITY_MODES.COMPACT]: 0.75,
};

/**
 * Hook to manage density mode preference with localStorage persistence.
 *
 * @returns {{
 *   mode: string,
 *   setMode: function,
 *   scale: number,
 *   isCompact: boolean
 * }}
 */
export function usePlayerTableDensity() {
  // Initialize from localStorage or default to comfortable
  const [mode, setModeInternal] = useState(() => {
    if (typeof window === 'undefined') return DENSITY_MODES.COMFORTABLE;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (
        stored === DENSITY_MODES.COMPACT ||
        stored === DENSITY_MODES.COMFORTABLE
      ) {
        return stored;
      }
    } catch {
      // localStorage not available
    }
    return DENSITY_MODES.COMFORTABLE;
  });

  // Persist to localStorage when mode changes
  const setMode = useCallback((newMode) => {
    if (
      newMode !== DENSITY_MODES.COMFORTABLE &&
      newMode !== DENSITY_MODES.COMPACT
    ) {
      console.warn(`Invalid density mode: ${newMode}`);
      return;
    }
    setModeInternal(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage not available
    }
  }, []);

  // Compute scale based on mode
  const scale = useMemo(() => {
    return DENSITY_SCALES[mode] ?? 1.0;
  }, [mode]);

  // Convenience boolean
  const isCompact = mode === DENSITY_MODES.COMPACT;

  return {
    mode,
    setMode,
    scale,
    isCompact,
  };
}

export default usePlayerTableDensity;
