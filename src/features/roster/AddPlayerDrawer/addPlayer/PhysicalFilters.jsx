import React from 'react';
import {
  generateHeightOptions,
  generateWeightOptions,
  generateAgeOptions,
} from '@/shared/utils/filtering';

const heightOptions = generateHeightOptions();
const weightOptions = generateWeightOptions();
const ageOptions = generateAgeOptions();

const RangeSelects = ({ label, minVal, maxVal, onMinChange, onMaxChange, options, minLabel, maxLabel }) => (
  <div>
    <label className="block mb-1 text-white/70 text-xs">{label}</label>
    <div className="flex items-center gap-1.5">
      <select
        value={minVal ?? ''}
        onChange={(e) => onMinChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="flex-1 bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
      >
        <option value="">{minLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="text-white/35 text-xs flex-shrink-0">–</span>
      <select
        value={maxVal ?? ''}
        onChange={(e) => onMaxChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="flex-1 bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
      >
        <option value="">{maxLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  </div>
);

const PhysicalFilters = ({ filters, setFilters }) => (
  <div className="p-2 space-y-3">
    <RangeSelects
      label="Height"
      minVal={filters.minHeight}
      maxVal={filters.maxHeight}
      onMinChange={(v) => setFilters({ ...filters, minHeight: v })}
      onMaxChange={(v) => setFilters({ ...filters, maxHeight: v })}
      options={heightOptions}
      minLabel="Min"
      maxLabel="Max"
    />
    <RangeSelects
      label="Weight"
      minVal={filters.minWeight}
      maxVal={filters.maxWeight}
      onMinChange={(v) => setFilters({ ...filters, minWeight: v })}
      onMaxChange={(v) => setFilters({ ...filters, maxWeight: v })}
      options={weightOptions}
      minLabel="Min"
      maxLabel="Max"
    />
    <RangeSelects
      label="Age"
      minVal={filters.minAge}
      maxVal={filters.maxAge}
      onMinChange={(v) => setFilters({ ...filters, minAge: v })}
      onMaxChange={(v) => setFilters({ ...filters, maxAge: v })}
      options={ageOptions}
      minLabel="Min"
      maxLabel="Max"
    />
  </div>
);

export default PhysicalFilters;
