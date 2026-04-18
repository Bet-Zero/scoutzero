/**
 * FILE: src/features/table/PlayerTable/hooks/usePlayerTableDensity.ts
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

export const DENSITY_MODES = {
  COMFORTABLE: 'comfortable',
  COMPACT: 'compact',
} as const;

export type DensityMode =
  (typeof DENSITY_MODES)[keyof typeof DENSITY_MODES];

export const DENSITY_SCALES: Record<DensityMode, number> = {
  [DENSITY_MODES.COMFORTABLE]: 1.0,
  [DENSITY_MODES.COMPACT]: 0.75,
};

export type UsePlayerTableDensityResult = {
  mode: DensityMode;
  setMode: (newMode: string) => void;
  scale: number;
  isCompact: boolean;
};

const isDensityMode = (value: string | null): value is DensityMode =>
  value === DENSITY_MODES.COMPACT || value === DENSITY_MODES.COMFORTABLE;

export function usePlayerTableDensity(): UsePlayerTableDensityResult {
  // Initialize from localStorage or default to comfortable
  const [mode, setModeInternal] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') return DENSITY_MODES.COMFORTABLE;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isDensityMode(stored)) {
        return stored;
      }
    } catch {
      // localStorage not available
    }
    return DENSITY_MODES.COMFORTABLE;
  });

  // Persist to localStorage when mode changes
  const setMode = useCallback((newMode: string) => {
    if (!isDensityMode(newMode)) {
      console.warn(`Invalid density mode: ${newMode}`);
      return;
    }
    setModeInternal(newMode);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newMode);
      }
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
