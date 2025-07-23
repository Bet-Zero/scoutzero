// src/components/filters/sections/BasicFilters.jsx
import React from 'react';
import MultiSelectFilter from '@/components/shared/ui/filters/MultiSelectFilter';
import BadgeFilterSelect from '@/components/shared/ui/filters/BadgeFilterSelect';
import { teamOptions } from '@/utils/filtering';
import { shootingProfileTiers } from '@/utils/roles';

const BasicFilters = ({ filters, setFilters }) => {
  return (
    <div className="p-2 space-y-3">
      {/* First Filter Row (matches ContractFilters' FA Year + FA Type structure) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block mb-1 text-white/70 text-xs">Team</label>
          <select
            value={filters.team}
            onChange={(e) => setFilters({ ...filters, team: e.target.value })}
            className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
          >
            <option value="">All Teams</option>
            {teamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.teamName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-white/70 text-xs">Position</label>
          <select
            value={filters.position}
            onChange={(e) =>
              setFilters({ ...filters, position: e.target.value })
            }
            className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
          >
            <option value="">All Positions</option>
            {['Guard', 'Wing', 'Forward', 'Big', 'Center'].map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Second Filter (matches other tabs' single-select structure) */}
      <div>
        <label className="block mb-1 text-white/70 text-xs">Shooting</label>
        <select
          value={filters.shootingProfile}
          onChange={(e) =>
            setFilters({ ...filters, shootingProfile: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">All Profiles</option>
          {shootingProfileTiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </div>
      {/* Divider (EXACTLY matches other tabs) */}
      <div className="border-t border-white/10 my-2" />

      {/* Badge Filter - Updated with max-height and overflow */}
      <div className="flex flex-col">
        <BadgeFilterSelect
          selected={filters.badges}
          onChange={(badges) => setFilters({ ...filters, badges })}
          buttonClass="w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs flex justify-between items-center"
          gridClass="mt-1 max-h-60 overflow-y-auto bg-[#2a2a2a] p-2 rounded grid-cols-2 gap-2"
          labelClass="text-xs"
          badgeClass="flex items-center px-2 py-1 rounded cursor-pointer text-xs"
          selectedBadgeClass="bg-yellow-500 text-black font-semibold"
          unselectedBadgeClass="bg-[#333] text-white/70 hover:bg-[#3a3a3a]"
          cols={2}
        />
      </div>
    </div>
  );
};

export default BasicFilters;
