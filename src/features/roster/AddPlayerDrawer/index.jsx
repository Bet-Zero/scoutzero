// src/components/roster/AddPlayerDrawer.jsx
import React, { useState, useMemo } from 'react';
import PlayerRowMini from './PlayerRowMini';
import { expandPositionGroup } from '@/shared/utils/roles';
import {
  getDefaultAddPlayerFilters,
  normalizeFreeAgentType,
  normalizeTeamCode,
  getPlayerFreeAgentType,
  playerHasOptionType,
  isPlayerTwoWay,
} from '@/shared/utils/filtering';
import DrawerHeader from './addPlayer/DrawerHeader';
import PlayerSearchBar from './addPlayer/PlayerSearchBar';
import FilterTabs from './addPlayer/FilterTabs';

const AddPlayerDrawer = ({ onClose, allPlayers, onSelect, onSelectAll }) => {
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
      freeAgentStatus,
      contractFeature,
      minHeight,
      maxHeight,
      minWeight,
      maxWeight,
      minAge,
      maxAge,
    } = filters;

    const positionOptions = position ? expandPositionGroup(position) : null;
    const normalizedTeam = normalizeTeamCode(team);
    const normalizedFreeAgentStatus = normalizeFreeAgentType(freeAgentStatus);

    return allPlayers
      .filter((p) => {
        if (searchTerm && !p.name.includes(searchTerm)) return false;
        const playerTeamCode =
          p.teamCode ||
          normalizeTeamCode(
            p.team ||
              p.original?.bio?.display?.teamId ||
              p.original?.bio?.display?.team ||
              ''
          );
        if (normalizedTeam && playerTeamCode !== normalizedTeam) return false;
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
          if (p.extension?.freeAgentYear?.toString() === freeAgentYear)
            return true;
          const hasOptionYear = p.options.some(
            (opt) => opt.year?.toString() === freeAgentYear
          );
          if (hasOptionYear) return true;
          return false;
        }

        // FA Status filter (UFA/RFA only)
        if (normalizedFreeAgentStatus) {
          const playerFaType = getPlayerFreeAgentType(p.original);
          if (playerFaType !== normalizedFreeAgentStatus) return false;
        }

        // Contract Features filter (TO/PO/ETO/Two-Way)
        if (contractFeature) {
          if (contractFeature === 'two_way') {
            if (!isPlayerTwoWay(p)) return false;
          } else {
            // TO, PO, or ETO
            if (!playerHasOptionType(p, contractFeature)) return false;
          }
        }

        // Physical filters — read from raw bio fields
        const heightVal = p.original?.bio?.height;
        const weightVal = p.original?.bio?.weight;
        const ageVal = p.original?.bio?.age;
        if (minHeight !== undefined && (heightVal == null || heightVal < minHeight)) return false;
        if (maxHeight !== undefined && (heightVal == null || heightVal > maxHeight)) return false;
        if (minWeight !== undefined && (weightVal == null || weightVal < minWeight)) return false;
        if (maxWeight !== undefined && (weightVal == null || weightVal > maxWeight)) return false;
        if (minAge !== undefined && (ageVal == null || ageVal < minAge)) return false;
        if (maxAge !== undefined && (ageVal == null || ageVal > maxAge)) return false;

        // Stat filters — read from denormalized currentSeasonStats on the raw doc
        const ss = p.original?.currentSeasonStats ?? {};
        const passStatFilter = (field, minKey, maxKey) => {
          const lo = filters[minKey];
          const hi = filters[maxKey];
          if (lo === undefined && hi === undefined) return true;
          const val = parseFloat(ss[field] ?? 0) * (field.includes('%') ? 100 : 1);
          if (lo !== undefined && val < lo) return false;
          if (hi !== undefined && val > hi) return false;
          return true;
        };
        if (!passStatFilter('PTS',  'min_PPG',  'max_PPG'))  return false;
        if (!passStatFilter('REB',  'min_RPG',  'max_RPG'))  return false;
        if (!passStatFilter('AST',  'min_APG',  'max_APG'))  return false;
        if (!passStatFilter('FG%',  'min_FGP',  'max_FGP'))  return false;
        if (!passStatFilter('3PT%', 'min_TPP',  'max_TPP'))  return false;
        if (!passStatFilter('FT%',  'min_FTP',  'max_FTP'))  return false;
        if (!passStatFilter('eFG%', 'min_eFGP', 'max_eFGP')) return false;
        if (!passStatFilter('MIN',  'min_MIN',  'max_MIN'))  return false;
        if (!passStatFilter('GP',   'min_G',    'max_G'))    return false;

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

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Add All strip — always in document flow, never displaced */}
        {onSelectAll && filteredPlayers.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-xs text-white/35">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onSelectAll(filteredPlayers)}
              className="text-xs font-semibold text-white/55 hover:text-white px-2 py-1 rounded hover:bg-white/[0.08] transition-all"
            >
              Add All ({filteredPlayers.length})
            </button>
          </div>
        )}

        {/* Player list + filter overlay share the same space */}
        <div className="relative flex-1 min-h-0">

          {/* Filter panel — floats above the player list, no layout shift */}
          {showFilters && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-[#161616] border-b border-white/10 shadow-2xl">
              <FilterTabs
                filters={filters}
                setFilters={setFilters}
                onCloseFilters={() => setShowFilters(false)}
              />
            </div>
          )}

          {/* Players list — occupies full height, stays put when filter opens */}
          <div className="h-full overflow-y-auto px-2 py-1">
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
    </div>
  );
};

export default AddPlayerDrawer;
