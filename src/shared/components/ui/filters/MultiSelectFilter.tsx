/**
 * Purpose: Single-select dropdown (name implies multi-select).
 * Inputs: value, onChange, options (object or primitive), placeholder.
 * Outputs: <select> control with styled options.
 * Risks: Name/API mismatch; label not linked; undefined label text edge cases.
 * Next TODO: Rename or add multiple support; add htmlFor/id; provide label fallback.
 */
import React from 'react';
import clsx from 'clsx';

type MultiSelectFilterValue = string | number;
type MultiSelectFilterOptionObject = {
  id?: MultiSelectFilterValue;
  value?: MultiSelectFilterValue;
  code?: string;
  teamId?: string;
  label?: string;
  name?: string;
  teamName?: string;
};
type MultiSelectFilterOption =
  | MultiSelectFilterValue
  | MultiSelectFilterOptionObject;
type MultiSelectFilterValueKey = 'id' | 'value' | 'code' | 'teamId';
type MultiSelectFilterLabelKey = 'label' | 'name' | 'teamName' | 'code' | 'value';

type MultiSelectFilterProps = {
  label?: React.ReactNode;
  value?: MultiSelectFilterValue | '';
  options?: readonly MultiSelectFilterOption[];
  onChange?: (value: string) => void;
  allLabel?: string;
  containerClass?: string;
  selectClass?: string;
  valueKey?: MultiSelectFilterValueKey;
  labelKey?: MultiSelectFilterLabelKey;
};

const isOptionObject = (
  option: MultiSelectFilterOption
): option is MultiSelectFilterOptionObject =>
  typeof option === 'object' && option !== null;

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
        onChange={(e) => onChange?.(e.target.value)}
        className={clsx(
          'bg-[#2a2a2a] px-2 py-1 rounded text-xs',
          selectClass,
          isPlaceholder ? 'text-white not-italic' : 'text-white not-italic'
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => {
          const val = isOptionObject(opt) ? (opt[valueKey] ?? opt.id ?? '') : opt;
          const optLabel = isOptionObject(opt)
            ? opt[labelKey] ?? opt.label ?? String(val)
            : opt;
          return (
            <option key={String(val)} value={String(val)}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default MultiSelectFilter;
