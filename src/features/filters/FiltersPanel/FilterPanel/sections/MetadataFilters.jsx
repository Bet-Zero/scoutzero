// src/components/filters/sections/MetadataFilters.jsx

import React from 'react';
import MultiSelectFilter from '@/components/shared/ui/filters/MultiSelectFilter';
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
    </div>
  );
};

export default MetadataFilters;
