/**
 * Purpose: Render min/max selects and report changes.
 * Inputs: options[], minKey, maxKey, value(s), update(), allowNullMax.
 * Outputs: onChange callbacks with normalized values.
 * Risks: Unset vs 0 conflation; type inconsistencies; weak label association.
 * Next TODO: Normalize to number|null; fix placeholder logic; link labels via id.
 */
import React from 'react';

type RangeOption = {
  label: string;
  value: number | string;
};

type RangeFilterMap = Partial<Record<string, unknown>>;

type RangeSelectorProps = {
  label?: React.ReactNode;
  minKey: string;
  maxKey: string;
  filters?: RangeFilterMap;
  options?: RangeOption[];
  update: (key: string, value: number | string | null) => void;
  allowNullMax?: boolean;
};

const selectValue = (value: unknown): string | number => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return '';
};

export const RangeSelector = ({
  label,
  minKey,
  maxKey,
  filters = {},
  options = [],
  update,
  allowNullMax = false,
}: RangeSelectorProps) => {
  const handleMinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    update(minKey, e.target.value ? parseInt(e.target.value, 10) : 0);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
      ? parseInt(e.target.value, 10)
      : allowNullMax
        ? null
        : '';
    update(maxKey, value);
  };

  const minValue = selectValue(filters[minKey]);
  const maxValue = selectValue(filters[maxKey]);

  return (
    <div className="flex flex-col">
      <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <select
          value={minValue}
          onChange={handleMinChange}
          className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
            !filters[minKey] ? 'text-white/40' : 'text-white'
          }`}
        >
          <option value="" disabled hidden>
            Min
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-white/50 text-xs">to</span>
        <select
          value={maxValue}
          onChange={handleMaxChange}
          className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
            filters[maxKey] === null || !filters[maxKey]
              ? 'text-white/40'
              : 'text-white'
          }`}
        >
          <option value="" disabled hidden>
            Max
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

