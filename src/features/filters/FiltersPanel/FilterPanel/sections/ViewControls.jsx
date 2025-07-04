import React from 'react';

const ViewControls = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass =
    'bg-[#2a2a2a] text-white text-sm px-2 py-1 border border-black focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a]';

  return (
    <div className="-mb-[24px] px-4 py-1 rounded-sm flex flex-wrap gap-1 text-sm text-white items-end">
      {/* Salary Year Selector */}
      <div className="flex flex-col">
        <select
          value={filters.salaryYear}
          onChange={(e) => update('salaryYear', parseInt(e.target.value))}
          className={selectClass}
        >
          {[2024, 2025, 2026, 2027, 2028, 2029].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Sort By Selector */}
      <div className="flex flex-col">
        <select
          value={filters.sortBy ?? ''}
          onChange={(e) => update('sortBy', e.target.value)}
          className={selectClass}
        >
          <option value="">Default (A-Z)</option>
          <option value="name">Name</option>
          <option value="height">Height</option>
          <option value="weight">Weight</option>
          <option value="age">Age</option>
          <option value="salary">Salary</option>
          <option value="PTS">PTS</option>
          <option value="TRB">TRB</option>
          <option value="AST">AST</option>
          <option value="FG%">FG%</option>
          <option value="3P%">3P%</option>
          <option value="FT%">FT%</option>
          <option value="eFG%">eFG%</option>
          <option value="MP">Minutes</option>
          <option value="Defense">Defense</option>
          <option value="Energy">Energy</option>
          <option value="Feel">Feel</option>
          <option value="IQ">IQ</option>
          <option value="Passing">Passing</option>
          <option value="Playmaking">Playmaking</option>
          <option value="Rebounding">Rebounding</option>
          <option value="Shooting">Shooting</option>
          <option value="shootingProfile">Shooting Profile</option>
          <option value="yearsRemaining">Years Remaining</option>
          <option value="totalContract">Total Contract Value</option>
          <option value="overall">Overall Grade</option>
        </select>
      </div>

      {/* Sort Order Toggle */}
      <div className="flex flex-col">
        <button
          onClick={() => update('sortAsc', !filters.sortAsc)}
          className="px-2 py-1 bg-[#2a2a2a] w-[100px] text-white text-xs hover:bg-[#3a3a3a] border border-black"
        >
          {filters.sortAsc ? '↑ Ascending' : '↓ Descending'}
        </button>
      </div>
    </div>
  );
};

export default ViewControls;
