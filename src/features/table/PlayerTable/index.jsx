/**
 * FILE: src/features/table/PlayerTable/index.jsx
 * PURPOSE: Virtualized player database table using react-window with ResizeObserver-based measurement.
 *
 * OWNERSHIP: Feature: table/virtualization
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2O - Always-on TopControlsBar + ActiveFiltersDrawer (zero layout shift)
 *  - 2026-02-01: Phase 2N-Density - Added proportional scale-based density mode (comfortable/compact)
 *  - 2026-01-31: Phase 2N - Fixed sticky header stack: overlays anchor BELOW pills bar, Filters+Sort work together
 *  - 2026-01-30: Phase 2K - Layout stabilization: overlay filters/sort + fixed-height controls shell
 *  - 2026-01-29: Phase 2E - Replaced hardcoded drawer padding with measured height via ResizeObserver
 *  - 2026-01-29: Added sticky header with z-[60], shadow, and scroll hygiene fixes (Phase 2B)
 *  - 2026-01-28: Replaced AutoSizer with useContainerDimensions hook to fix 0-height race condition
 *  - Previous: Used react-virtualized-auto-sizer which intermittently returned 0 dimensions
 *
 * LINKS:
 *  - Return Package: docs/return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md
 */
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
} from 'react';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFilteredPlayers from '@/features/table/hooks/useFilteredPlayers';
import PlayerRow from '@/features/table/PlayerTable/PlayerRow';
import FiltersPanel from '@/features/filters/FiltersPanel';
import ActiveFiltersDrawer from '@/features/filters/ActiveFiltersDrawer';
import PlayerTableHeader from '@/features/table/PlayerTable/PlayerTableHeader';
import TopControlsBar from '@/features/table/PlayerTable/PlayerTableHeader/TopControlsBar';
import PlayerDrawer from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer';
import debounce from 'lodash.debounce';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering';
import { FixedSizeList as List } from 'react-window';
import useContainerDimensions from '@/shared/hooks/useContainerDimensions';
import getPlayerId from '@/shared/utils/getPlayerId';
import usePlayerTableDensity from './hooks/usePlayerTableDensity';
import useActiveFilterCount from '@/features/filters/hooks/useActiveFilterCount';
import { useFilterDiagnostics } from '../hooks/useFilterDiagnostics';
import FilterDiagnosticsPanel from './FilterDiagnosticsPanel';

// Row Component for react-window
const Row = ({ index, style, data }) => {
  const { players, expandedPlayerId, toggleExpand } = data;
  const player = players[index];
  const playerId = getPlayerId(player);
  const isExpanded = expandedPlayerId === playerId;

  // Separate positioning style from content layout to ensure mx-auto works
  // The outer div gets the absolute positioning.
  // The inner div handles the centering constraint.
  return (
    <div style={style}>
      <PlayerRow
        player={player}
        isExpanded={isExpanded}
        onToggleExpand={() => toggleExpand(playerId)}
      />
    </div>
  );
};

// Custom Inner Element to render the Overlay Drawer
// Phase 2E: Uses measured drawer height to compute exact extra scroll space needed
const InnerElement = React.forwardRef(({ children, style, ...rest }, ref) => {
  const { expandedPlayerId, players, itemSize, drawerHeight } =
    React.useContext(DrawerContext);

  // Compute exact extra height needed to prevent drawer clipping
  // Formula: extra = max(0, drawerBottom - baseInnerHeight)
  // where drawerBottom = (expandedIndex + 1) * itemSize + drawerHeight
  let modifiedStyle = style;

  if (expandedPlayerId && drawerHeight > 0 && players.length > 0) {
    const expandedIndex = players.findIndex(
      (p) => getPlayerId(p) === expandedPlayerId
    );
    if (expandedIndex !== -1) {
      const baseInnerHeight = parseFloat(style.height) || 0;
      const drawerTop = (expandedIndex + 1) * itemSize;
      const drawerBottom = drawerTop + drawerHeight;
      const extra = Math.max(0, drawerBottom - baseInnerHeight);

      if (extra > 0) {
        modifiedStyle = { ...style, height: baseInnerHeight + extra };
      }
    }
  }

  return (
    <div ref={ref} style={modifiedStyle} {...rest}>
      {children}
      <DrawerOverlay />
    </div>
  );
});

// Separate component to consume context and render drawer
// Phase 2E: Uses ResizeObserver to measure actual drawer height
const DrawerOverlay = () => {
  const { expandedPlayerId, players, itemSize, setDrawerHeight } =
    React.useContext(DrawerContext);
  const drawerRef = useRef(null);

  // Measure drawer height using ResizeObserver
  useLayoutEffect(() => {
    if (!expandedPlayerId || !drawerRef.current) {
      return;
    }

    const element = drawerRef.current;
    let lastHeight = 0;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        // Only update if height actually changed (avoid rerender loops)
        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          setDrawerHeight(newHeight);
        }
      }
    });

    observer.observe(element);

    // Initial measurement
    const initialHeight = element.getBoundingClientRect().height;
    if (initialHeight !== lastHeight) {
      lastHeight = initialHeight;
      setDrawerHeight(initialHeight);
    }

    return () => {
      observer.disconnect();
    };
  }, [expandedPlayerId, setDrawerHeight]);

  if (!expandedPlayerId) return null;

  const index = players.findIndex((p) => getPlayerId(p) === expandedPlayerId);
  if (index === -1) return null;

  const player = players[index];
  const top = (index + 1) * itemSize; // Position right below the row

  return (
    <div
      ref={drawerRef}
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // Phase 2O: Renamed for clarity
  const [showActiveFiltersDrawer, setShowActiveFiltersDrawer] = useState(false); // Phase 2O: New drawer state
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [drawerHeight, setDrawerHeight] = useState(0); // Phase 2E: Measured drawer height
  const listContainerRef = useRef(null);
  const listRef = useRef(null); // Phase 2N-Density: Ref for react-window List to control scroll

  // Phase 2N-Density: Density mode hook
  const {
    mode: densityMode,
    setMode: setDensityMode,
    scale,
  } = usePlayerTableDensity();

  const { width, height, ready } = useContainerDimensions(listContainerRef);

  // Phase 2O: Active filter count for badge
  const activeFilterCount = useActiveFilterCount(
    filters,
    getDefaultPlayerFilters,
    ['nameSearch', 'salaryYear', 'sortBy', 'sortAsc']
  );

  // Phase 2N-Density: Compute scaled dimensions for react-window
  // The list renders at "virtual" larger dimensions, then CSS transform scales it down
  const scaledWidth = useMemo(() => Math.floor(width / scale), [width, scale]);
  const scaledHeight = useMemo(
    () => Math.floor(height / scale),
    [height, scale]
  );

  // Phase 2N-Density: Scroll position stability when switching density
  const lastFirstVisibleIndex = useRef(0);

  // Track first visible index on scroll
  const handleScroll = useCallback(({ scrollOffset }) => {
    // Calculate first visible index based on current itemSize (100) and scroll
    const firstVisible = Math.floor(scrollOffset / 100);
    lastFirstVisibleIndex.current = firstVisible;
  }, []);

  // When density changes, restore scroll position
  useEffect(() => {
    if (listRef.current && lastFirstVisibleIndex.current > 0) {
      // Small delay to let the scale change apply
      requestAnimationFrame(() => {
        listRef.current.scrollToItem(lastFirstVisibleIndex.current, 'start');
      });
    }
  }, [scale]);

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

  // Phase 2S: Dev diagnostics for filter debugging (only active with ?debugFilters=1)
  const diagnostics = useFilterDiagnostics(players, filteredPlayers, filters);

  const handleSearchChange = (e) => {
    debouncedSearchUpdate(e.target.value);
  };

  const handleCloseFilters = () => {
    setShowAdvancedFilters(false);
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

  // Phase 2E: Reset drawer height when expansion changes
  React.useEffect(() => {
    if (!expandedPlayerId) {
      setDrawerHeight(0);
    }
  }, [expandedPlayerId]);

  const drawerContextValue = useMemo(
    () => ({
      expandedPlayerId,
      players: filteredPlayers,
      itemSize: 100,
      drawerHeight,
      setDrawerHeight,
    }),
    [expandedPlayerId, filteredPlayers, drawerHeight]
  );

  return (
    <div className="flex flex-col bg-neutral-900 flex-1 min-h-0 w-full overflow-hidden">
      {/* Phase 2O: Sticky Header Section - simplified with always-on TopControlsBar */}
      <div className="sticky top-0 z-[60] bg-neutral-900 shrink-0 border-b border-neutral-700/50 shadow-sm pt-2">
        <div className="w-full max-w-[1100px] mx-auto px-4 xl:px-0 flex flex-col gap-2 pb-2">
          {/* Title row with search and density */}
          <PlayerTableHeader
            filteredCount={filteredPlayers.length}
            onSearchChange={handleSearchChange}
            densityMode={densityMode}
            onDensityChange={setDensityMode}
          />

          {/* Phase 2O: Always-visible controls bar - filters left, sort right */}
          <TopControlsBar
            filters={filters}
            setFilters={debouncedSetFilters}
            activeFilterCount={activeFilterCount}
            onOpenAdvancedFilters={() => setShowAdvancedFilters(true)}
            onOpenActiveFilters={() => setShowActiveFiltersDrawer(true)}
          />
        </div>
      </div>

      {/* Phase 2O: Advanced FilterPanel (fixed overlay) */}
      {showAdvancedFilters && (
        <FiltersPanel
          filters={filters}
          setFilters={debouncedSetFilters}
          getDefaultFilters={getDefaultPlayerFilters}
          isOpen={showAdvancedFilters}
          showFullFilters={true}
          setShowFullFilters={() => {}}
          onClose={handleCloseFilters}
          onClearFilters={handleClearAllFilters}
        />
      )}

      {/* Phase 2O: Active Filters Drawer (right-side overlay) */}
      <ActiveFiltersDrawer
        open={showActiveFiltersDrawer}
        onClose={() => setShowActiveFiltersDrawer(false)}
        filters={filters}
        setFilters={debouncedSetFilters}
        getDefaultFilters={getDefaultPlayerFilters}
        excludeFromDisplay={['nameSearch', 'salaryYear', 'sortBy', 'sortAsc']}
        onClearFilters={handleClearAllFilters}
      />

      {/* Player Rows (Virtualized) - flex-1 + min-h-0 + overflow-hidden ensures height is measurable */}
      <div
        ref={listContainerRef}
        className="w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden"
      >
        {loading || !ready ? (
          <div className="flex items-center justify-center h-full text-white/50">
            Loading players...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-white/50 text-center mt-10">
            No players found matching your filters.
          </div>
        ) : (
          /* Phase 2N-Density: Scaled rendering stage
           * The outer container is the measured viewport (width × height)
           * The inner "stage" is scaled up (scaledWidth × scaledHeight) and then CSS-scaled down
           * Result: react-window renders more rows (like browser zoom-out) without changing PlayerRow
           */
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: scaledWidth,
              height: scaledHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <DrawerContext.Provider value={drawerContextValue}>
              <List
                ref={listRef}
                height={scaledHeight}
                width={scaledWidth}
                itemCount={filteredPlayers.length}
                itemSize={100}
                itemData={itemData}
                innerElementType={InnerElement}
                className="no-scrollbar"
                onScroll={handleScroll}
              >
                {Row}
              </List>
            </DrawerContext.Provider>
          </div>
        )}
      </div>

      {/* Phase 2S: Dev diagnostics panel (only renders with ?debugFilters=1) */}
      <FilterDiagnosticsPanel diagnostics={diagnostics} />
    </div>
  );
};

export default PlayerTable;
