import React from 'react';

const MultiSelectFilter = ({
  label,
  value,
  options = [],
  onChange,
  allLabel = 'All',
  containerClass = '',
  selectClass = '',
}) => (
  <div className={`flex flex-col ${containerClass}`.trim()}>
    {label && (
      <label className="block mb-1 text-white/70 text-xs">{label}</label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs ${selectClass}`.trim()}
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

export default MultiSelectFilter;
