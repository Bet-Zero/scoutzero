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

  return (
    <PlayerRow
      style={style}
      player={player}
      isExpanded={isExpanded}
      onToggleExpand={() => toggleExpand(player.id || player.bio?.playerId)}
    />
  );
};

// Custom Inner Element to render the Overlay Drawer
const InnerElement = React.forwardRef(({ children, style, ...rest }, ref) => {
  const { data } = rest; // react-window passes itemData as `data` prop to innerElementType if using standard approach? 
  // Actually, react-window ONLY passes `style` and `ref`? No.
  // Wait, react-window passes `style` (height/width) to innerElementType.
  // It DOES NOT pass `itemData` to innerElementType automatically.
  // We need to pass it via context or just use closure if defined inside.
  // But definition inside causes remounts.
  // Better to use `outerElementType`? No, drawer needs to scroll WITH list.
  // So `innerElementType` is correct (it's the scrollable content container).
  
  // Actually, let's look at `data` prop. 
  // FixedSizeList passes `innerProps`? No.
  // We can attach the data to the list via a context or prop if we really need to, 
  // OR we can just render the drawer *outside* the list if it wasn't inline.
  // BUT the requirement is "scrolls with list".
  
  // Strategy: The Drawer needs to catch the "expanded" item. 
  // We can pass `expandedPlayerId` and `players` to the LIST.
  // Does `List` pass extra props to innerElementType? 
  // "Any standard props (like style, className) will be passed through to the innerElementType".
  // So if we pass `drawerData={{ ... }}` to `<List>`, it usually gets passed down?
  // No, `List` only passes specific props.
  
  // However, we can use `React.forwardRef` and closure if we define it inside useMemo or component?
  // Let's try passing it as a prop to List `innerDataContext` (custom prop) -> might work if List spreads rest?
  // List does NOT spread rest to innerElementType.
  
  // ALTERNATIVE: Use `react-window` context or just define the component function *inside* the parent (memoized) with access to scope.
  // Creating a new component type on every render kills performance (remounts list).
  // So we must genericize it.
  
  // Let's use a CustomList wrapper or just a mutable ref?
  // Actually, we can use the `children` prop of the List to render custom things? No, `children` is the Row renderer.
  
  // BACKUP PLAN: Custom InnerElement defined *outside*.
  // How does it get data?
  // We can attach data to the `style` object? No, hacky.
  // We can use a React Context! 
  // `<DrawerContext.Provider value={{ expandedPlayerId, players, toggleExpand }}>` wrap the List.
  // InnerElement consumes context.
  
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
    <div className="flex flex-col items-center bg-neutral-900 gap-1 mt-4 h-[calc(100vh-100px)]">
      <div className="w-full max-w-[1100px] mx-auto flex-shrink-0">
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

        {/* Sort Panel Toggle */}
        {showSort && (
          <div className="mb-4">
            <ViewControls filters={filters} setFilters={debouncedSetFilters} />
          </div>
        )}
      </div>

      {/* Player Rows (Virtualized) */}
      <div className="w-full h-full relative z-10 flex-grow">
        <DrawerContext.Provider value={drawerContextValue}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                width={width}
                itemCount={filteredPlayers.length}
                itemSize={100}
                itemData={itemData}
                innerElementType={InnerElement}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </DrawerContext.Provider>
      </div>
    </div>
  );
};

export default PlayerTable;
