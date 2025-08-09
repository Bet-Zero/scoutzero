// src/components/shared/SeasonYearSelect.jsx

import React from 'react';
import { seasonEndYearsFromCaps, toSeasonKey } from '@/utils/seasonUtils';

const SeasonYearSelect = ({
  capProjections,
  value,
  onChange,
  label = 'Season',
}) => {
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

export default SeasonYearSelect;
