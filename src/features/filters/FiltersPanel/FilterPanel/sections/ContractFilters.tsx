import React, { useState, useEffect } from 'react';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import type { PlayerFilterPanelProps } from '../../../filterTypes';

export const ContractFilters = ({ filters, setFilters }: PlayerFilterPanelProps) => {
  const [localMin, setLocalMin] = useState(String(filters.minSalary ?? ''));
  const [localMax, setLocalMax] = useState(String(filters.maxSalary ?? ''));

  useEffect(() => {
    const timeout = setTimeout(() => {
      const numericRegex = /^\d+(\.\d+)?$/;

      const minVal = numericRegex.test(localMin)
        ? parseFloat(localMin)
        : undefined;
      const maxVal = numericRegex.test(localMax)
        ? parseFloat(localMax)
        : undefined;

      setFilters((prev) => ({
        ...prev,
        minSalary: minVal,
        maxSalary: maxVal,
      }));
    }, 300);

    return () => clearTimeout(timeout);
  }, [localMin, localMax, setFilters]);

  const update = <K extends keyof PlayerFilters>(key: K, value: PlayerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const inputStyle = (val: string) =>
    `bg-[#2a2a2a] p-1 rounded w-[90px] text-xs placeholder:text-white/40 ${
      val === '' ? 'text-white/40' : 'text-white'
    }`;

  return (
    <div>
      <h2 className="text-white text-sm font-bold border-b border-white/20 pb-1 mb-3">
        Contract
      </h2>
      <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-white text-sm">
        {/* Salary Range */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Salary ($M)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              value={localMin}
              onChange={(e) => setLocalMin(e.target.value)}
              className={inputStyle(localMin)}
              placeholder="Min"
            />
            <span className="text-white/50">to</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              value={localMax}
              onChange={(e) => setLocalMax(e.target.value)}
              className={inputStyle(localMax)}
              placeholder="Max"
            />
          </div>
          {/* Include Missing Salary Toggle */}
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeMissingSalary !== false}
              onChange={(e) => update('includeMissingSalary', e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-[#2a2a2a] border-white/30 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-white/60 text-xs">
              Include players without salary data
            </span>
          </label>
        </div>

        {/* Free Agent Year → renamed to "Free Agency Summer" */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Free Agency Summer
          </label>
          <select
            value={filters.freeAgentYear ?? ''}
            onChange={(e) => update('freeAgentYear', e.target.value)}
            className="bg-[#2a2a2a] p-1 rounded"
          >
            <option value="">All</option>
            {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Free Agent Type */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Free Agent Type
          </label>
          <select
            value={filters.freeAgentType ?? ''}
            onChange={(e) => update('freeAgentType', e.target.value)}
            className="bg-[#2a2a2a] p-1 rounded"
          >
            <option value="">All</option>
            <option value="UFA">UFA</option>
            <option value="RFA">RFA</option>
            <option value="TWO_WAY">Two-Way</option>
          </select>
        </div>

        {/* Option Year - Phase 2X: explicit year for option filtering */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Option Year
          </label>
          <select
            value={filters.optionYear ?? ''}
            onChange={(e) =>
              update(
                'optionYear',
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="bg-[#2a2a2a] p-1 rounded"
          >
            <option value="">Use Season</option>
            {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((year) => (
              <option key={year} value={year}>
                {year}-{String(year + 1).slice(-2)}
              </option>
            ))}
          </select>
          <span className="text-white/30 text-[9px] mt-0.5">
            Defaults to Season if unset
          </span>
        </div>

        {/* Option Type (year-specific) */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Option Type
          </label>
          <div className="flex flex-wrap gap-1">
            {[
              { value: 'TO', label: 'Team' },
              { value: 'PO', label: 'Player' },
              { value: 'ETO', label: 'Early Term.' },
            ].map(({ value, label }) => {
              const selected = (filters.optionTypes || []).includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const current = filters.optionTypes || [];
                    const updated = selected
                      ? current.filter((v: string) => v !== value)
                      : [...current, value];
                    update('optionTypes', updated);
                  }}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a2a] text-white/60 hover:bg-[#3a3a3a]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bird Rights */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Bird Rights
          </label>
          <select
            value={filters.birdRights ?? ''}
            onChange={(e) => update('birdRights', e.target.value)}
            className="bg-[#2a2a2a] p-1 rounded"
          >
            <option value="">All</option>
            {['None', 'Non-Bird', 'Early Bird', 'Bird', 'Two-Way'].map((br) => (
              <option key={br} value={br}>
                {br}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

