// src/components/filters/sections/ContractFilters.jsx
import React from 'react';

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
        <label className="block mb-1 text-white/70 text-xs">FA Type</label>
        <select
          value={filters.freeAgentType}
          onChange={(e) =>
            setFilters({ ...filters, freeAgentType: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">Any Type</option>
          <option value="UFA">UFA</option>
          <option value="RFA">RFA</option>
          <option value="TO">Team Option</option>
          <option value="PO">Player Option</option>
          <option value="2W">Two-Way</option>
          <option value="ETO">Early Termination Option</option>
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
