// src/components/filters/FilterPanelCondensed.jsx

import React from 'react';
import { teamOptions } from '@/utils/filtering';
import {
  offensiveRoles,
  defensiveRoles,
  shootingProfileTiers,
} from '@/utils/roles';

const FilterPanelCondensed = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass =
    'w-[140px] bg-[#2a2a2a] text-white text-sm px-2 py-1 rounded-md border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a]';

  return (
    <div className="w-full max-w-[1100px] mx-auto bg-[#1a1a1a] border border-white/10 rounded-md pl-2 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Team */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.team || ''}
            onChange={(e) => update('team', e.target.value || null)}
            className={selectClass}
          >
            <option value="">All Teams</option>
            {teamOptions.sort().map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        {/* Position */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.position || ''}
            onChange={(e) => update('position', e.target.value || null)}
            className={selectClass}
          >
            <option value="">All Positions</option>
            <option value="PG">Point Guard</option>
            <option value="SG">Shooting Guard</option>
            <option value="SF">Small Forward</option>
            <option value="PF">Power Forward</option>
            <option value="C">Center</option>
          </select>
        </div>

        {/* Offense Role */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.offenseRole || ''}
            onChange={(e) => update('offenseRole', e.target.value || null)}
            className={selectClass}
          >
            <option value="">Offensive Role</option>
            {offensiveRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Defense Role */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.defenseRole || ''}
            onChange={(e) => update('defenseRole', e.target.value || null)}
            className={selectClass}
          >
            <option value="">Defensive Role</option>
            {defensiveRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Shooting Profile */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.shootingProfile || ''}
            onChange={(e) => update('shootingProfile', e.target.value || null)}
            className={selectClass}
          >
            <option value="">Shooting Profile</option>
            {shootingProfileTiers.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        </div>

        {/* Free Agent Year */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.freeAgentYear || ''}
            onChange={(e) => update('freeAgentYear', e.target.value || null)}
            className={selectClass}
          >
            <option value="">FA Year</option>
            {[2024, 2025, 2026, 2027, 2028, 2029].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Free Agent Type */}
        <div className="flex flex-col shrink-0">
          <select
            value={filters.freeAgentType || ''}
            onChange={(e) => update('freeAgentType', e.target.value || null)}
            className={selectClass}
          >
            <option value="">FA Type</option>
            <option value="UFA">Unrestricted</option>
            <option value="RFA">Restricted</option>
            <option value="TO">Team Option</option>
            <option value="PO">Player Option</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterPanelCondensed;
