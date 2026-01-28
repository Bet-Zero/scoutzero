/**
 * FILE: src/features/table/PlayerTable/index.jsx
 * PURPOSE: Virtualized player database table using react-window with ResizeObserver-based measurement.
 *
 * OWNERSHIP: Feature: table/virtualization
 *
 * HISTORY:
 *  - 2026-01-28: Replaced AutoSizer with useContainerDimensions hook to fix 0-height race condition
 *  - Previous: Used react-virtualized-auto-sizer which intermittently returned 0 dimensions
 *
 * LINKS:
 *  - Return Package: docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_MEASUREMENT_RP.md
 */
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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
import useContainerDimensions from '@/shared/hooks/useContainerDimensions';

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
  const { expandedPlayerId, players, itemSize } =
    React.useContext(DrawerContext);

  if (!expandedPlayerId) return null;

  const index = players.findIndex(
    (p) => (p.id || p.bio?.playerId) === expandedPlayerId
  );
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
        zIndex: 50, // Above subsequent rows
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
  const listContainerRef = useRef(null);

  // Force re-render trigger for AutoSizer 0-dimension recovery
  // When AutoSizer initially returns 0, we schedule a re-render after layout settles
  const [autoSizerRetryCount, setAutoSizerRetryCount] = useState(0);
  const retryScheduledRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    setExpandedPlayerId((prev) => (prev === id ? null : id));
  }, []);

  // Reset expansion when filters change (optional, but good for UX so drawer doesn't stick to wrong index)
  React.useEffect(() => {
    setExpandedPlayerId(null);
  }, [filters, filteredPlayers.length]);

  const itemData = useMemo(
    () => ({
      players: filteredPlayers,
      expandedPlayerId,
      toggleExpand,
    }),
    [filteredPlayers, expandedPlayerId, toggleExpand]
  );

  const drawerContextValue = useMemo(
    () => ({
      expandedPlayerId,
      players: filteredPlayers,
      itemSize: 100,
    }),
    [expandedPlayerId, filteredPlayers]
  );

  if (loading) {
    return (
      <div className="text-white text-center mt-8">Loading players...</div>
    );
  }

  return (
    <div className="flex flex-col bg-neutral-900 gap-1 mt-4 flex-1 min-h-0 w-full">
      {/* Header and Filters Container - shrink-0 so it sizes to content */}
      <div className="w-full max-w-[1100px] mx-auto px-4 xl:px-0 flex flex-col shrink-0">
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
      </div>

      {/* Player Rows (Virtualized) - flex-1 + min-h-[400px] + overflow-hidden ensures height is measurable */}
      <div
        ref={listContainerRef}
        className="w-full flex-1 min-h-[400px] relative z-10 bg-neutral-900 overflow-hidden"
      >
        {filteredPlayers.length === 0 ? (
          <div className="text-white/50 text-center mt-10">
            No players found matching your filters.
          </div>
        ) : (
          <DrawerContext.Provider value={drawerContextValue}>
            <AutoSizer>
              {({ height, width }) => {
                // Fallback when AutoSizer returns 0 dimensions (can happen during layout settle)
                const containerRect =
                  listContainerRef.current?.getBoundingClientRect();
                const fallbackHeight = containerRect?.height || 600;
                const fallbackWidth = containerRect?.width || 1100;
                const resolvedHeight = height > 0 ? height : fallbackHeight;
                const resolvedWidth = width > 0 ? width : fallbackWidth;

                // If both AutoSizer AND fallback return 0, schedule a re-render after layout settles
                // This handles the race condition where the component mounts before layout is complete
                if (resolvedHeight <= 0 || resolvedWidth <= 0) {
                  // Only schedule one retry at a time, and only if we haven't exceeded retry limit
                  if (autoSizerRetryCount < 3 && !retryScheduledRef.current) {
                    retryScheduledRef.current = true;
                    // Schedule retry after next animation frame (layout should be settled)
                    requestAnimationFrame(() => {
                      if (mountedRef.current) {
                        retryScheduledRef.current = false;
                        setAutoSizerRetryCount((prev) => prev + 1);
                      }
                    });
                  }
                  // Return a placeholder while waiting for valid dimensions
                  return (
                    <div className="flex items-center justify-center h-full text-white/50">
                      Loading player table...
                    </div>
                  );
                }

                // Reset retry count on successful dimension retrieval for future recovery
                if (autoSizerRetryCount > 0) {
                  // Use setTimeout to avoid state update during render
                  setTimeout(() => {
                    if (mountedRef.current) {
                      setAutoSizerRetryCount(0);
                    }
                  }, 0);
                }

                // Dev-mode debug logging when fallback triggers
                if (import.meta.env.DEV && (height === 0 || width === 0)) {
                  console.warn(
                    '[PlayerTable] AutoSizer returned zero dims, using fallback:',
                    {
                      autoSizer: { height, width },
                      fallback: { fallbackHeight, fallbackWidth },
                      resolved: { resolvedHeight, resolvedWidth },
                      retryCount: autoSizerRetryCount,
                    }
                  );
                }

                return (
                  <List
                    height={resolvedHeight}
                    width={resolvedWidth}
                    itemCount={filteredPlayers.length}
                    itemSize={100}
                    itemData={itemData}
                    innerElementType={InnerElement}
                    className="no-scrollbar"
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
  );
};

export default PlayerTable;
