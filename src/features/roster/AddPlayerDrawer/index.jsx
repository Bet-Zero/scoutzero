// src/components/roster/AddPlayerDrawer.jsx
import React, { useState, useMemo } from 'react';
import PlayerRowMini from './PlayerRowMini';
import { expandPositionGroup } from '@/utils/roles';
import { getDefaultAddPlayerFilters } from '@/utils/filtering';
import DrawerHeader from './addPlayer/DrawerHeader';
import PlayerSearchBar from './addPlayer/PlayerSearchBar';
import FilterTabs from './addPlayer/FilterTabs';

const AddPlayerDrawer = ({ onClose, allPlayers, onSelect }) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());

  const filteredPlayers = useMemo(() => {
    const searchTerm = search.toLowerCase();
    const {
      team,
      position,
      offenseRole,
      defenseRole,
      subRoles,
      shootingProfile,
      badges,
      minSalary,
      maxSalary,
      freeAgentYear,
      freeAgentType,
    } = filters;

    const positionOptions = position ? expandPositionGroup(position) : null;

    return allPlayers
      .filter((p) => {
        if (searchTerm && !p.name.includes(searchTerm)) return false;
        const playerTeamId = (p.team || '').toLowerCase().replace(/\s+/g, '');
        if (team && playerTeamId !== team) return false;
        if (positionOptions && !positionOptions.includes(p.position))
          return false;
        if (
          offenseRole &&
          !p.offenseRoles.some((r) => r.includes(offenseRole.toLowerCase()))
        )
          return false;
        if (
          defenseRole &&
          !p.defenseRoles.some((r) => r.includes(defenseRole.toLowerCase()))
        )
          return false;
        if (
          subRoles.offense.length > 0 &&
          !subRoles.offense.every((sr) => p.offenseSubroles.includes(sr))
        )
          return false;
        if (
          subRoles.defense.length > 0 &&
          !subRoles.defense.every((sr) => p.defenseSubroles.includes(sr))
        )
          return false;
        if (
          shootingProfile &&
          p.shootingProfile !== shootingProfile.toLowerCase()
        )
          return false;
        if (badges.length > 0 && !badges.every((b) => p.badges.includes(b)))
          return false;

        if (minSalary !== undefined || maxSalary !== undefined) {
          const salaryValue =
            typeof p.salary === 'string'
              ? parseFloat(p.salary.replace(/[^0-9.]/g, '')) / 1000000
              : p.salary / 1000000;
          if (
            minSalary !== undefined &&
            (!salaryValue || salaryValue < minSalary)
          )
            return false;
          if (
            maxSalary !== undefined &&
            (!salaryValue || salaryValue > maxSalary)
          )
            return false;
        }

        if (freeAgentYear) {
          if (p.freeAgentYear === freeAgentYear) return true;
          if (p.extension?.free_agency_year?.toString() === freeAgentYear)
            return true;
          const hasOptionYear = p.options.some(
            (opt) => opt.year?.toString() === freeAgentYear
          );
          if (hasOptionYear) return true;
          return false;
        }

        if (freeAgentType) {
          if (p.freeAgentType === freeAgentType) return true;
          if (p.extension?.free_agent_type?.toLowerCase() === freeAgentType)
            return true;
          if (freeAgentType === 'to' || freeAgentType === 'po') {
            return p.options.some(
              (opt) => opt.type?.toLowerCase() === freeAgentType
            );
          }
          if (freeAgentType === '2w') {
            return (
              p.contractType?.includes('two-way') ||
              p.original.status?.toLowerCase() === 'two-way'
            );
          }
          return false;
        }

        return true;
      })
      .map((p) => p.original);
  }, [search, filters, allPlayers]);

  return (
    <div className="flex flex-col h-full">
      <DrawerHeader onClose={onClose} />
      <PlayerSearchBar
        search={search}
        onSearchChange={setSearch}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {/* Main content area with proper flex behavior */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Filters section - will expand naturally */}
        {showFilters && (
          <FilterTabs
            filters={filters}
            setFilters={setFilters}
            onCloseFilters={() => setShowFilters(false)}
          />
        )}

        {/* Players list - takes remaining space */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <PlayerRowMini
                key={player.id}
                player={player}
                onClick={() => onSelect(player)}
              />
            ))
          ) : (
            <div className="text-white/40 text-sm text-center py-6">
              {search || Object.values(filters).some(Boolean)
                ? 'No matching players found.'
                : 'No players available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPlayerDrawer;
