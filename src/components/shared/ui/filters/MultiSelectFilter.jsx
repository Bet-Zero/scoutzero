/**
 * Purpose: Single-select dropdown (name implies multi-select).
 * Inputs: value, onChange, options (object or primitive), placeholder.
 * Outputs: <select> control with styled options.
 * Risks: Name/API mismatch.
 * Next TODO: Rename or add multiple support.
*/
import React from 'react';
import clsx from 'clsx';

const MultiSelectFilter = ({
  label,
  value,
  options = [],
  onChange,
  allLabel = 'All',
  containerClass = '',
  selectClass = '',
}) => {
  const selectId = React.useId();
  const isPlaceholder = value === '' || value === null || value === undefined;

  const handleChange = React.useCallback(
    (event) => {
      if (!onChange) return;
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <div className={`flex flex-col ${containerClass}`.trim()}>
      {label ? (
        <label className="block mb-1 text-white/70 text-xs" htmlFor={selectId}>
          {label}
        </label>
      ) : (
        <label className="sr-only" htmlFor={selectId}>
          Filter options
        </label>
      )}
      <select
        value={value}
        onChange={handleChange}
        className={clsx(
          'bg-[#2a2a2a] px-2 py-1 rounded text-xs',
          selectClass,
          isPlaceholder ? 'text-white not-italic' : 'text-white not-italic'
        )}
        id={selectId}
        aria-label={label || 'Filter options'}
      >
        <option value="">{allLabel || 'All options'}</option>
        {options.map((opt) => {
          const isObj = typeof opt === 'object';
          const val = isObj ? opt.id : opt;
          const optionLabel = isObj ? opt.teamName || opt.label : opt;
          return (
            <option key={val} value={val}>
              {optionLabel ?? String(val)}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default MultiSelectFilter;
