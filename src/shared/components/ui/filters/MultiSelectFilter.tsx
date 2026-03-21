/**
 * Purpose: Single-select dropdown (name implies multi-select).
 * Inputs: value, onChange, options (object or primitive), placeholder.
 * Outputs: <select> control with styled options.
 * Risks: Name/API mismatch; label not linked; undefined label text edge cases.
 * Next TODO: Rename or add multiple support; add htmlFor/id; provide label fallback.
 */
import React from 'react';
import clsx from 'clsx';

type MultiSelectFilterProps = {
  label?: any;
  value?: any;
  options?: any[];
  onChange?: any;
  allLabel?: string;
  containerClass?: string;
  selectClass?: string;
  valueKey?: string;
  labelKey?: string;
};

const MultiSelectFilter = ({
  label,
  value,
  options = [],
  onChange,
  allLabel = 'All',
  containerClass = '',
  selectClass = '',
  valueKey = 'id',
  labelKey = 'teamName',
}: MultiSelectFilterProps) => {
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
          const val = isObj ? (opt[valueKey] ?? opt.id) : opt;
          const optLabel = isObj ? opt[labelKey] || opt.label : opt;
          return (
            <option key={val} value={val}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default MultiSelectFilter;
