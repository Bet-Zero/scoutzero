/**
 * Purpose: UI control to select a season year.
 * Inputs: year, onChange, min/max, options.
 * Outputs: Controlled selector (dropdown/segmented control).
 * Risks: None known.
 * Next TODO: Confirm control type; prop types/TS & edge tests.
 */
// src/components/shared/SeasonYearSelect.jsx

import React from 'react';
import { seasonEndYearsFromCaps, toSeasonKey } from '@/utils/seasonUtils';

const SeasonYearSelect = ({
  capProjections,
  value,
  onChange,
  label = 'Season',
  placeholder = 'Select season',
}) => {
  const selectId = React.useId();

  const options = React.useMemo(() => {
    const computed = seasonEndYearsFromCaps(capProjections);
    return Array.isArray(computed) ? computed : [];
  }, [capProjections]);

  const handleChange = React.useCallback(
    (event) => {
      if (!onChange) return;
      const nextValue = parseInt(event.target.value, 10);
      if (Number.isNaN(nextValue)) {
        onChange(null);
        return;
      }
      onChange(nextValue);
    },
    [onChange]
  );

  const normalizedValue = React.useMemo(() => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? '' : parsed;
    }
    return '';
  }, [value]);

  return (
    <label className="flex items-center gap-2 text-sm font-medium" htmlFor={selectId}>
      {label}
      <select
        id={selectId}
        className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
        value={normalizedValue}
        onChange={handleChange}
        disabled={!options.length}
        aria-label={label || 'Season year'}
      >
        <option value="">
          {placeholder}
        </option>
        {options.map((year) => (
          <option key={year} value={year}>
            {toSeasonKey(year)}
          </option>
        ))}
      </select>
    </label>
  );
};

export default SeasonYearSelect;
