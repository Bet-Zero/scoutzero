import React from 'react';
import MultiSelectFilter from '@/components/shared/ui/filters/MultiSelectFilter';
import BadgeFilterSelect from '@/components/shared/ui/filters/BadgeFilterSelect';
import { teamOptions } from '@/utils/filtering';
import { shootingProfiles } from '@/utils/roles';

const BasicFilters = ({ filters, setFilters }) => {
  return (
    <div className="p-2 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MultiSelectFilter
          label="Team"
          value={filters.team}
          options={teamOptions.sort()}
          onChange={(val) => setFilters({ ...filters, team: val })}
          allLabel="All Teams"
        />
        <div>
          <label className="block mb-1 text-white/70 text-xs">Position</label>
          <select
            value={filters.position}
            onChange={(e) => setFilters({ ...filters, position: e.target.value })}
            className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
          >
            <option value="">All Positions</option>
            <option value="group_guard">Guards (PG/SG/G)</option>
            <option value="group_wing">Wings (SG/SF/G/F)</option>
            <option value="group_forward">Forwards (SF/PF/F)</option>
            <option value="group_big">Bigs (F/C/C)</option>
            <option value="PG">Point Guard</option>
            <option value="SG">Shooting Guard</option>
            <option value="SF">Small Forward</option>
            <option value="PF">Power Forward</option>
            <option value="C">Center</option>
          </select>
        </div>
      </div>

      <MultiSelectFilter
        label="Shooting"
        value={filters.shootingProfile}
        options={shootingProfiles}
        onChange={(val) => setFilters({ ...filters, shootingProfile: val })}
        allLabel="All Profiles"
      />

      <div className="border-t border-white/10 my-2" />

      <BadgeFilterSelect
        selected={filters.badges}
        onChange={(badges) => setFilters({ ...filters, badges })}
        buttonClass="w-full"
        gridClass="mt-1"
        cols={2}
      />
    </div>
  );
};

export default BasicFilters;
