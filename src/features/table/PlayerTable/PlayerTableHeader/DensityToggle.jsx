/**
 * FILE: src/features/table/PlayerTable/PlayerTableHeader/DensityToggle.jsx
 * PURPOSE: Segmented control for switching between Comfortable and Compact density modes.
 *
 * OWNERSHIP: Feature: table/density
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2N-Density - Created for density mode toggle UI
 *
 * LINKS:
 *  - Return Package: return_packages/scouting/PHASE_2N_DENSITY_MODE_RETURN_PACKAGE.md
 */
import React from 'react';
import { DENSITY_MODES } from '../hooks/usePlayerTableDensity';

const DensityToggle = ({ mode, setMode }) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-neutral-500 mr-1">Density:</span>
      <div className="flex rounded-md overflow-hidden border border-neutral-700">
        <button
          onClick={() => setMode(DENSITY_MODES.COMFORTABLE)}
          className={`px-2 py-1 text-xs transition-all duration-150 ${
            mode === DENSITY_MODES.COMFORTABLE
              ? 'bg-neutral-700 text-white'
              : 'bg-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
          }`}
          aria-label="Comfortable density"
          aria-pressed={mode === DENSITY_MODES.COMFORTABLE}
        >
          Comfortable
        </button>
        <button
          onClick={() => setMode(DENSITY_MODES.COMPACT)}
          className={`px-2 py-1 text-xs transition-all duration-150 ${
            mode === DENSITY_MODES.COMPACT
              ? 'bg-neutral-700 text-white'
              : 'bg-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
          }`}
          aria-label="Compact density"
          aria-pressed={mode === DENSITY_MODES.COMPACT}
        >
          Compact
        </button>
      </div>
    </div>
  );
};

export default DensityToggle;
