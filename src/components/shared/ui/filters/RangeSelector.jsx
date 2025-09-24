/**
 * Purpose: Render min/max selects and report changes.
 * Inputs: options[], minKey, maxKey, value(s), update(), allowNullMax.
 * Outputs: onChange callbacks with normalized values.
 * Risks: None known.
 * Next TODO: Consider tighter prop typing & tests.
 */
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
  const baseId = React.useId();

  const handleMinChange = (event) => {
    if (!update) return;
    const { value } = event.target;
    if (value === '') {
      update(minKey, null);
      return;
    }
    const parsed = parseInt(value, 10);
    update(minKey, Number.isNaN(parsed) ? null : parsed);
  };

  const handleMaxChange = (event) => {
    if (!update) return;
    const { value } = event.target;
    if (value === '') {
      update(maxKey, allowNullMax ? null : '');
      return;
    }
    const parsed = parseInt(value, 10);
    update(maxKey, Number.isNaN(parsed) ? (allowNullMax ? null : '') : parsed);
  };

  const minValueRaw = filters?.[minKey];
  const maxValueRaw = filters?.[maxKey];

  const minValue =
    typeof minValueRaw === 'number' && !Number.isNaN(minValueRaw)
      ? String(minValueRaw)
      : '';
  const maxValue =
    typeof maxValueRaw === 'number' && !Number.isNaN(maxValueRaw)
      ? String(maxValueRaw)
      : allowNullMax && maxValueRaw === null
        ? ''
        : '';

  return (
    <div className="flex flex-col">
      <label
        className="text-white mb-1 text-[11px] tracking-wide uppercase"
        htmlFor={`${baseId}-min`}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label={label || 'Value range'}
      >
        <select
          id={`${baseId}-min`}
          value={minValue}
          onChange={handleMinChange}
          className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
            minValue === '' ? 'text-white/40' : 'text-white'
          }`}
        >
          <option value="">Min</option>
          {options.map(({ value, label: optionLabel }) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
        <span className="text-white/50 text-xs" aria-hidden="true">
          to
        </span>
        <select
          id={`${baseId}-max`}
          value={maxValue}
          onChange={handleMaxChange}
          className={`bg-[#2a2a2a] p-1 rounded w-[80px] text-xs ${
            maxValue === '' ? 'text-white/40' : 'text-white'
          }`}
        >
          <option value="">Max</option>
          {options.map(({ value, label: optionLabel }) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RangeSelector;
