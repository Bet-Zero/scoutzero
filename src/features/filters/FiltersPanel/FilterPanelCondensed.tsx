// src/components/filters/FilterPanelCondensed.tsx

import React from 'react';
import { MultiSelectFilter } from '@/shared/components/ui/filters/MultiSelectFilter';
import { TeamListFull } from '@/constants/teamList';
import {
  offensiveRoles,
  defensiveRoles,
  shootingProfileTiers,
} from '@/shared/utils/roles';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import type { PlayerFilterPanelProps } from '../filterTypes';

export const FilterPanelCondensed = ({ filters, setFilters }: PlayerFilterPanelProps) => {
  const update = <K extends keyof PlayerFilters>(key: K, value: PlayerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass =
    'w-[140px] border border-none focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a] text-sm rounded-md placeholder:italic placeholder:text-gray-400';

  return (
    <div className="w-full max-w-[1100px] mx-auto bg-[#1a1a1a] rounded-md pl-2 py-1">
      <div className="flex flex-wrap gap-3 items-end">
        <MultiSelectFilter
          value={filters.team || ''}
          options={TeamListFull}
          onChange={(val) => update('team', String(val))}
          allLabel="All Teams"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.position || ''}
          options={['Guard', 'Wing', 'Forward', 'Big', 'Center']}
          onChange={(val) => update('position', String(val))}
          allLabel="All Positions"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.offenseRole || ''}
          options={offensiveRoles}
          onChange={(val) => update('offenseRole', String(val))}
          allLabel="Offensive Role"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.defenseRole || ''}
          options={defensiveRoles}
          onChange={(val) => update('defenseRole', String(val))}
          allLabel="Defensive Role"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.shootingProfile || ''}
          options={shootingProfileTiers}
          onChange={(val) => update('shootingProfile', String(val))}
          allLabel="Shooting Profile"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.freeAgentYear || ''}
          options={[2024, 2025, 2026, 2027, 2028, 2029]}
          onChange={(val) => update('freeAgentYear', String(val))}
          allLabel="FA Year"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.freeAgentType || ''}
          options={['UFA', 'RFA', 'TO', 'PO']}
          onChange={(val) => update('freeAgentType', String(val))}
          allLabel="FA Type"
          containerClass="shrink-0"
          selectClass={selectClass}
        />
      </div>
    </div>
  );
};

