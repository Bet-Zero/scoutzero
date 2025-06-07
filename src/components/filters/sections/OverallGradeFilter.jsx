import React from 'react';

const OverallGradeFilter = ({ filters, setFilters }) => {
  const min = filters.min_overall_grade ?? '';
  const max = filters.max_overall_grade ?? '';

  const update = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === '' ? undefined : parseInt(value),
    }));
  };

  const inputStyle = (val) =>
    `bg-[#2a2a2a] p-1 rounded w-[70px] text-xs placeholder:text-white/40 ${
      val === '' ? 'text-white/40' : 'text-white'
    }`;

  return (
    <div>
      <h2 className="text-white text-sm font-bold mb-3">Overall Grade</h2>
      <div className="flex gap-x-2 items-end text-xs">
        <div className="flex flex-col">
          <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
            Min
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={min}
            onChange={(e) => update('min_overall_grade', e.target.value)}
            placeholder="Min"
            className={inputStyle(min)}
          />
        </div>
        <div className="text-white/50 text-[11px] mb-1 pt-3">to</div>
        <div className="flex flex-col">
          <label className="text-white mb-1 text-[11px] tracking-wide uppercase">
            Max
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={max}
            onChange={(e) => update('max_overall_grade', e.target.value)}
            placeholder="Max"
            className={inputStyle(max)}
          />
        </div>
      </div>
    </div>
  );
};

export default OverallGradeFilter;
