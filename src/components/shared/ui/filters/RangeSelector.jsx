import React from 'react';

const RangeSelector = ({
  label,
  minKey,
  maxKey,
  filters,
  options,
  update,
  allowNullMax = false,
}) => {
  const handleMinChange = (e) => {
    update(minKey, e.target.value ? parseInt(e.target.value, 10) : 0);
  };

  const handleMaxChange = (e) => {
    const value = e.target.value
      ? parseInt(e.target.value, 10)
      : allowNullMax
        ? null
        : '';
    update(maxKey, value);
  };

  const minValue = filters[minKey] || '';
  const maxValue =
    filters[maxKey] !== null && filters[maxKey] !== undefined
      ? filters[maxKey]
      : '';

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
          {options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
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
          {options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RangeSelector;
