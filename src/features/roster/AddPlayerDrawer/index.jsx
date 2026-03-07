// src/components/roster/AddPlayerDrawer.jsx
import React, { useState, useMemo } from 'react';
import PlayerRowMini from './PlayerRowMini';
import {
  getDefaultAddPlayerFilters,
} from '@/shared/utils/filtering';
import DrawerHeader from './addPlayer/DrawerHeader';
import PlayerSearchBar from './addPlayer/PlayerSearchBar';
import FilterTabs from './addPlayer/FilterTabs';
import {
  filterRosterDrawerPlayers,
  hasActiveAddPlayerFilters,
} from '@/features/roster/utils';

const AddPlayerDrawer = ({ onClose, allPlayers, onSelect, onSelectAll }) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());

  const filteredPlayers = useMemo(() => {
    return filterRosterDrawerPlayers(allPlayers, search, filters);
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
                {search || hasActiveAddPlayerFilters(filters)
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
