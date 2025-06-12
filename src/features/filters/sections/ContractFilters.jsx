import React, { useState, useEffect } from 'react';

const ContractFilters = ({ filters, setFilters }) => {
  const [localMin, setLocalMin] = useState(filters.minSalary ?? '');
  const [localMax, setLocalMax] = useState(filters.maxSalary ?? '');

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

  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const inputStyle = (val) =>
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
        </div>

        {/* Free Agent Year */}
        <div className="flex flex-col">
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Free Agent Year
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
            <option value="TO">Team Option</option>
            <option value="PO">Player Option</option>
            <option value="2W">Two-Way</option>
          </select>
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

export default ContractFilters;
