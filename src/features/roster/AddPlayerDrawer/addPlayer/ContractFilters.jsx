// src/components/filters/sections/ContractFilters.jsx
import React from 'react';
import { normalizeFreeAgentType } from '@/shared/utils/filtering';

const ContractFilters = ({ filters, setFilters }) => (
  <div className="p-2 space-y-3">
    {/* First Section - Matches other tabs */}
    <div className="space-y-3">
      <div>
        <label className="block mb-1 text-white/70 text-xs">FA Year</label>
        <select
          value={filters.freeAgentYear}
          onChange={(e) =>
            setFilters({ ...filters, freeAgentYear: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">Any</option>
          {[2025, 2026, 2027, 2028, 2029, 2030, 2031].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1 text-white/70 text-xs">FA Status</label>
        <select
          value={filters.freeAgentStatus || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              freeAgentStatus: normalizeFreeAgentType(e.target.value),
            })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">Any</option>
          <option value="ufa">UFA (Unrestricted)</option>
          <option value="rfa">RFA (Restricted)</option>
        </select>
      </div>

      <div>
        <label className="block mb-1 text-white/70 text-xs">
          Contract Features
        </label>
        <select
          value={filters.contractFeature || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              contractFeature: e.target.value,
            })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">Any</option>
          <option value="to">Team Option</option>
          <option value="po">Player Option</option>
          <option value="eto">ETO</option>
          <option value="two_way">Two-Way</option>
        </select>
      </div>
    </div>

    {/* Divider - Perfectly aligned */}
    <div className="border-t border-white/10 my-2" />

    {/* Revised Salary Section */}
    <div className="flex items-center gap-1">
      <input
        type="number"
        placeholder="Min"
        value={filters.minSalary ?? ''}
        onChange={(e) =>
          setFilters({
            ...filters,
            minSalary: e.target.value ? parseFloat(e.target.value) : undefined,
          })
        }
        className="w-[70px] bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
      />
      <span className="text-white/40 text-xs">to</span>
      <input
        type="number"
        placeholder="Max"
        value={filters.maxSalary ?? ''}
        onChange={(e) =>
          setFilters({
            ...filters,
            maxSalary: e.target.value ? parseFloat(e.target.value) : undefined,
          })
        }
        className="w-[70px] bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
      />
      <span className="text-white/30 text-xs italic ml-1">(Salary $M)</span>
    </div>
  </div>
);

export default ContractFilters;
