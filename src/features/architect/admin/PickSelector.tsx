/**
 * FILE: src/features/architect/admin/PickSelector.tsx
 * PURPOSE: Team / Year / Round pick selector that generates canonical pick IDs
 *          without requiring users to type raw IDs.
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *
 * Uses generatePickId() from pickIdUtils.js for canonical format: {TEAM}_{YEAR}_{ROUND}
 * Team list sourced from TeamListFull (src/constants/teamList.js).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { TeamListFull } from '@/constants/teamList';
import { generatePickId } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Parse an existing canonical pick ID into its parts. */
function parsePickId(pickId: string): {
  team: string;
  year: string;
  round: string;
} {
  if (!pickId) return { team: '', year: '', round: '' };
  const parts = pickId.split('_');
  if (parts.length === 3) {
    return { team: parts[0], year: parts[1], round: parts[2] };
  }
  return { team: '', year: '', round: '' };
}

// Sorted team codes for the dropdown
const TEAM_OPTIONS = TeamListFull.map(
  (t: { code: string; teamName: string }) => ({
    code: t.code,
    name: t.teamName,
  })
).sort((a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code)
);

// Year range: 2024 → 2033 (covers reasonable NBA draft horizon)
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => 2024 + i);

// ─── component ───────────────────────────────────────────────────────────────

interface PickSelectorProps {
  /** Current canonical pick ID value (e.g. "BOS_2027_1") */
  value: string;
  /** Called with the new canonical pick ID whenever a selector changes */
  onChange: (pickId: string) => void;
  /** Pre-fill team if available from context */
  defaultTeam?: string;
  /** Pre-fill year if available from context */
  defaultYear?: number;
  /** Label displayed above the selectors */
  label?: string;
  /** Disable all inputs */
  disabled?: boolean;
  /** Field-level error string (displayed below selectors) */
  error?: string;
}

export const PickSelector: React.FC<PickSelectorProps> = ({
  value,
  onChange,
  defaultTeam,
  defaultYear,
  label,
  disabled = false,
  error,
}) => {
  const [showRaw, setShowRaw] = useState(false);

  // Derive current selector values from the pick ID
  const parsed = useMemo(() => {
    const p = parsePickId(value);
    return {
      team: p.team || defaultTeam || '',
      year: p.year || (defaultYear ? String(defaultYear) : ''),
      round: p.round || '1',
    };
  }, [value, defaultTeam, defaultYear]);

  const buildPickId = useCallback(
    (team: string, year: string, round: string) => {
      if (!team || !year || !round) return '';
      return generatePickId({
        originalTeam: team,
        year: Number(year),
        round: Number(round),
      });
    },
    []
  );

  const handleTeamChange = (newTeam: string) => {
    onChange(buildPickId(newTeam, parsed.year, parsed.round));
  };

  const handleYearChange = (newYear: string) => {
    onChange(buildPickId(parsed.team, newYear, parsed.round));
  };

  const handleRoundChange = (newRound: string) => {
    onChange(buildPickId(parsed.team, parsed.year, newRound));
  };

  const handleRawChange = (raw: string) => {
    onChange(raw.trim());
  };

  return (
    <div data-testid="pick-selector">
      {label && (
        <label className="block text-xs text-white/60 mb-1.5 font-medium">
          {label}
        </label>
      )}

      {/* Dropdown selectors */}
      <div className="grid grid-cols-3 gap-2">
        {/* Team */}
        <div>
          <label className="block text-[10px] text-white/40 mb-0.5">Team</label>
          <select
            value={parsed.team}
            onChange={(e) => handleTeamChange(e.target.value)}
            disabled={disabled}
            data-testid="pick-selector-team"
            className="w-full px-2 py-1.5 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select...</option>
            {TEAM_OPTIONS.map((t: { code: string; name: string }) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-[10px] text-white/40 mb-0.5">Year</label>
          <select
            value={parsed.year}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={disabled}
            data-testid="pick-selector-year"
            className="w-full px-2 py-1.5 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select...</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Round */}
        <div>
          <label className="block text-[10px] text-white/40 mb-0.5">
            Round
          </label>
          <select
            value={parsed.round}
            onChange={(e) => handleRoundChange(e.target.value)}
            disabled={disabled}
            data-testid="pick-selector-round"
            className="w-full px-2 py-1.5 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
          >
            <option value="1">1st Round</option>
            <option value="2">2nd Round</option>
          </select>
        </div>
      </div>

      {/* Generated ID display */}
      {value && (
        <div className="mt-1.5 text-[10px] text-white/40 font-mono">
          Pick ID: <span className="text-white/70">{value}</span>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}

      {/* Advanced: raw ID toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 underline"
      >
        {showRaw ? 'Hide' : 'Advanced: edit raw pick ID'}
      </button>

      {showRaw && (
        <input
          value={value}
          onChange={(e) => handleRawChange(e.target.value)}
          disabled={disabled}
          data-testid="pick-selector-raw"
          placeholder="e.g. BOS_2027_1"
          className="mt-1 w-full px-2 py-1 rounded bg-[#0d0d0d] text-white text-xs font-mono border border-white/10 focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
};
