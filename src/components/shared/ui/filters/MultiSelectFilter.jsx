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
  const isPlaceholder = value === '';

  return (
    <div className={`flex flex-col ${containerClass}`.trim()}>
      {label && (
        <label className="block mb-1 text-white/70 text-xs">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'bg-[#2a2a2a] px-2 py-1 rounded text-xs',
          selectClass,
          isPlaceholder ? 'text-white not-italic' : 'text-white not-italic'
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => {
          const isObj = typeof opt === 'object';
          const val = isObj ? opt.id : opt;
          const label = isObj ? opt.teamName || opt.label : opt;
          return (
            <option key={val} value={val}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default MultiSelectFilter;
