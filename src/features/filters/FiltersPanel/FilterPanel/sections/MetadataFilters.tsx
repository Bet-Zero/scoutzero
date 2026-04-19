// src/components/filters/sections/MetadataFilters.tsx

import React from 'react';
import MultiSelectFilter from '@/shared/components/ui/filters/MultiSelectFilter';
import { TeamListFull } from '@/constants/teamList';

const MetadataFilters = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-white text-sm">
        {/* Team Dropdown */}
        <MultiSelectFilter
          label="Team"
          value={filters.team || ''}
          options={TeamListFull}
          onChange={(val) => update('team', val)}
          allLabel="All"
          selectClass="w-[125px]"
          valueKey="code"
          labelKey="teamName"
        />

        {/* Position Dropdown */}
        <MultiSelectFilter
          label="Position"
          value={filters.position || ''}
          options={['Guard', 'Wing', 'Forward', 'Big', 'Center']}
          onChange={(val) => update('position', val)}
          allLabel="All"
          selectClass="w-[125px]"
        />
      </div>

      {/* Show Free Agents Checkbox */}
      <div className="flex items-center gap-2 text-white text-sm">
        <input
          type="checkbox"
          id="showFreeAgents"
          checked={filters.showFreeAgents}
          onChange={(e) => update('showFreeAgents', e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <label htmlFor="showFreeAgents" className="cursor-pointer">
          Show Free Agents
        </label>
      </div>
    </div>
  );
};

export default MetadataFilters;
