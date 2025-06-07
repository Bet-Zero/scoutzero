import React from 'react';
import MetadataFilters from './sections/MetadataFilters';
import PhysicalFilters from './sections/PhysicalFilters';
import ContractFilters from './sections/ContractFilters';
import RoleFilters from './sections/RoleFilters';
import StatFilters from './sections/StatFilters';
import TraitFilters from './sections/TraitFilters';
import OverallGradeFilter from './sections/OverallGradeFilter';
import BadgeFilters from './sections/BadgeFilters';

const FilterPanel = ({ filters, setFilters, getDefaultFilters, onClose }) => {
  return (
    <div className="w-full max-w-[1100px] mx-auto mt-4">
      <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-md space-y-6">
        {/* Top Section – Subtle Box */}
        <div className="bg-[#1f1f1f] border border-white/5 rounded-md p-4 space-y-6">
          <MetadataFilters filters={filters} setFilters={setFilters} />
          <RoleFilters filters={filters} setFilters={setFilters} />
          <ContractFilters filters={filters} setFilters={setFilters} />
        </div>

        {/* Divider Line */}
        <div className="border-t border-white/10 my-4" />

        {/* Advanced Filters – Prominent Box */}
        <details className="group">
          <summary className="cursor-pointer text-white font-semibold text-sm hover:text-white/80 list-none flex items-center justify-between px-2 py-2 bg-[#222] rounded-md">
            <span>Advanced</span>
            <span className="text-white/40 group-open:rotate-90 transition-transform duration-200">
              ▶
            </span>
          </summary>

          <div className="mt-4 p-4 rounded-md bg-[#121212] border border-white/10 space-y-6">
            <PhysicalFilters filters={filters} setFilters={setFilters} />
            <OverallGradeFilter filters={filters} setFilters={setFilters} />
            <TraitFilters filters={filters} setFilters={setFilters} />
            <StatFilters filters={filters} setFilters={setFilters} />

            {/* Divider before Badges */}
            <div className="border-t border-white/10 my-2" />
            <BadgeFilters filters={filters} setFilters={setFilters} />
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setFilters(getDefaultFilters())}
            className="px-4 py-2 border border-black text-white/50 rounded text-sm hover:bg-[#2a2a2a] transition-colors"
          >
            Clear All Filters
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2a2a2a] text-white rounded text-sm hover:bg-[#3a3a3a] transition-colors"
          >
            Close Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
