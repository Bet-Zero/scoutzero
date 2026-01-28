import React, { useState, useMemo, useCallback } from 'react';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFilteredPlayers from '@/features/table/hooks/useFilteredPlayers';
import PlayerRow from '@/features/table/PlayerTable/PlayerRow';
import FiltersPanel from '@/features/filters/FiltersPanel';
import ActiveFiltersDisplay from '@/features/filters/ActiveFiltersDisplay';
import ViewControls from '@/features/filters/FiltersPanel/FilterPanel/sections/ViewControls';
import PlayerTableHeader from '@/features/table/PlayerTable/PlayerTableHeader';
import PlayerDrawer from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer';
import debounce from 'lodash.debounce';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering';
import { FixedSizeList as List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

// Row Component for react-window
const Row = ({ index, style, data }) => {
  const { players, expandedPlayerId, toggleExpand } = data;
  const player = players[index];
  const isExpanded = expandedPlayerId === (player.id || player.bio?.playerId);

  // Separate positioning style from content layout to ensure mx-auto works
  // The outer div gets the absolute positioning.
  // The inner div handles the centering constraint.
  return (
    <div style={style}>
      <PlayerRow
        player={player}
        isExpanded={isExpanded}
        onToggleExpand={() => toggleExpand(player.id || player.bio?.playerId)}
      />
    </div>
  );
};

// Custom Inner Element to render the Overlay Drawer
const InnerElement = React.forwardRef(({ children, style, ...rest }, ref) => {
  return (
    <div ref={ref} style={style} {...rest}>
      {children}
      <DrawerOverlay />
    </div>
  );
});

// Separate component to consume context and render drawer
const DrawerOverlay = () => {
  const { expandedPlayerId, players, itemSize } = React.useContext(DrawerContext);
  
  if (!expandedPlayerId) return null;

  const index = players.findIndex(p => (p.id || p.bio?.playerId) === expandedPlayerId);
  if (index === -1) return null;

  const player = players[index];
  const top = (index + 1) * itemSize; // Position right below the row

  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: top, 
        left: 0, 
        width: '100%',
        height: 'auto',
        zIndex: 50 // Above subsequent rows
      }}
    >
      <div className="w-full max-w-[1100px] mx-auto bg-[#111] border-x border-b border-black shadow-xl">
        <PlayerDrawer player={player} />
      </div>
    </div>
  );
};

const DrawerContext = React.createContext(null);

const PlayerTable = () => {
  const [filters, setFilters] = useState(getDefaultPlayerFilters());
  const { players, loading } = useSimplePlayerData();
  const [showFilters, setShowFilters] = useState(false);
  const [showFullFilters, setShowFullFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);

  // Debounce filters
  const debouncedSetFilters = useMemo(
    () => debounce(setFilters, 300),
    [setFilters]
  );


  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((searchValue) => {
        setFilters((prev) => ({ ...prev, nameSearch: searchValue }));
      }, 200),
    []
  );

  const handleClearAllFilters = () => {
    debouncedSetFilters.cancel();
    setFilters(getDefaultPlayerFilters());
  };

  const filteredPlayers = useFilteredPlayers(players, filters);

  const handleSearchChange = (e) => {
    debouncedSearchUpdate(e.target.value);
  };

  const handleCloseFilters = () => {
    setShowFilters(false);
    setShowFullFilters(false);
  };
  
  const toggleExpand = useCallback((id) => {
    setExpandedPlayerId(prev => prev === id ? null : id);
  }, []);

  // Reset expansion when filters change (optional, but good for UX so drawer doesn't stick to wrong index)
  React.useEffect(() => {
    setExpandedPlayerId(null);
  }, [filters, filteredPlayers.length]);

  const itemData = useMemo(() => ({
    players: filteredPlayers,
    expandedPlayerId,
    toggleExpand
  }), [filteredPlayers, expandedPlayerId, toggleExpand]);

  const drawerContextValue = useMemo(() => ({
    expandedPlayerId,
    players: filteredPlayers,
    itemSize: 100
  }), [expandedPlayerId, filteredPlayers]);

  if (loading) {
    return (
      <div className="text-white text-center mt-8">Loading players...</div>
    );
  }

  return (
    <div className="flex flex-col bg-neutral-900 gap-1 mt-4 h-[calc(100vh_-_100px)] lg:h-[calc(100vh_-_80px)] w-full"> 
      {/* Header and Filters Container */}
      <div className="w-full max-w-[1100px] mx-auto px-4 xl:px-0 flex flex-col flex-1 min-h-0">
        <PlayerTableHeader
          filteredCount={filteredPlayers.length}
          onSearchChange={handleSearchChange}
          showFilters={showFilters}
          showSort={showSort}
          onToggleFilters={() => setShowFilters((prev) => !prev)}
          onToggleSort={() => setShowSort((prev) => !prev)}
        />

        <ActiveFiltersDisplay
          filters={filters}
          setFilters={debouncedSetFilters}
          getDefaultFilters={getDefaultPlayerFilters}
          excludeFromDisplay={['nameSearch', 'salaryYear', 'sortBy', 'sortAsc']}
          onClearFilters={handleClearAllFilters}
        />

        {showFilters && (
          <div className="mb-4">
            <FiltersPanel
              filters={filters}
              setFilters={debouncedSetFilters}
              getDefaultFilters={getDefaultPlayerFilters}
              isOpen={showFilters}
              showFullFilters={showFullFilters}
              setShowFullFilters={setShowFullFilters}
              onClose={handleCloseFilters}
              onClearFilters={handleClearAllFilters}
            />
          </div>
        )}

        {/* View Controls */}
        {showSort && (
          <div className="mb-4">
            <ViewControls filters={filters} setFilters={debouncedSetFilters} />
          </div>
        )}


      {/* Player Rows (Virtualized) */}
      <div className="w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden">
        {filteredPlayers.length === 0 ? (
          <div className="text-white/50 text-center mt-10">
            No players found matching your filters.
          </div>
        ) : (
          <DrawerContext.Provider value={drawerContextValue}>
            <AutoSizer>
              {({ height, width }) => {
                // Safety fallbacks to prevent invisible list if measurement fails
                const safeHeight = height || 600;
                const safeWidth = width || 1100;

                return (
                  <List
                    height={safeHeight}
                    width={safeWidth}
                    itemCount={filteredPlayers.length}
                    itemSize={100}
                    itemData={itemData}
                    innerElementType={InnerElement}
                    className="no-scrollbar" // Optional custom scrollbar hiding if needed
                  >
                    {Row}
                  </List>
                );
              }}
            </AutoSizer>
          </DrawerContext.Provider>
        )}
      </div>
      </div>
    </div>
  );
};

export default PlayerTable;
