/**
 * Purpose: UI control to select a season year.
 * Inputs: year, onChange, min/max, options.
 * Outputs: Controlled selector (dropdown/segmented control).
 * Risks: A11y/keyboard unknown; range edges; styling consistency.
 * Next TODO: Confirm control type; add labels/keyboard; prop types/TS & edge tests.
 */
// src/components/shared/SeasonYearSelect.tsx

import React from 'react';
import {
  seasonEndYearsFromCaps,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';

type CapProjectionsLike = Record<string, unknown> | null | undefined;

export type SeasonYearSelectProps = {
  capProjections: CapProjectionsLike;
  value: number | string;
  onChange: (year: number) => void;
  label?: React.ReactNode;
};

export const SeasonYearSelect = ({
  capProjections,
  value,
  onChange,
  label = 'Season',
}: SeasonYearSelectProps) => {
  const options = React.useMemo(
    () => seasonEndYearsFromCaps(capProjections),
    [capProjections]
  );

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      {label}
      <select
        className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {toSeasonKey(y)}
          </option>
        ))}
      </select>
    </label>
  );
};

