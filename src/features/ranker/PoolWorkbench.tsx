/**
 * FILE: src/features/ranker/PoolWorkbench.tsx
 * PURPOSE: The Player Ranker pool builder as one screen: toolbar on top, then filters, results and the pool side by side, each scrolling on its own
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Find Players panel created as FilterPoolPanel.tsx (PR #565)
 *  - 2026-10-24: Replaced by this workbench layout; finder state lives in hooks/usePoolFinder.ts
 *  - 2026-10-26: Added players carry their Top-N score for the chosen season
 *  - 2026-10-31: Top-N lists show everyone with the usual candidates ticked; ticks start over when the list changes
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useEffect, useState } from 'react';
import { FilterTabs } from '@/features/roster/AddPlayerDrawer/addPlayer/FilterTabs';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { usePoolFinder } from './hooks/usePoolFinder';
import { ResultsHeader } from './PoolResultsHeader';
import { PoolSearchResults } from './PoolSearchResults';
import { PoolToolbar } from './PoolToolbar';
import { Pane, PaneHeader, fieldClass } from './RankerPanel';

type PoolWorkbenchProps = {
  candidates: Array<RosterDrawerPlayer<RosterManagerPlayer>>;
  poolIds: ReadonlySet<string>;
  // Top-N pulls pass each player's stats score for the chosen season
  onAdd: (
    players: RosterManagerPlayer[],
    scores?: ReadonlyMap<string, number>
  ) => void;
  // Add-team / add-list / saved menus for the toolbar
  menus?: React.ReactNode;
  // The pool column
  pool?: React.ReactNode;
  // Told when a Top-N preset is picked, so the list size can follow it
  onTopNChange?: (topN: number) => void;
};

export const PoolWorkbench = ({
  candidates,
  poolIds,
  onAdd,
  menus = null,
  pool = null,
  onTopNChange,
}: PoolWorkbenchProps) => {
  const finder = usePoolFinder(candidates, poolIds);
  const addWithScores = (players: RosterManagerPlayer[]) => {
    const scores = new Map<string, number>();
    finder.universe.forEach((row) => {
      if (typeof row.score === 'number') scores.set(row.player.id, row.score);
    });
    onAdd(players, scores);
  };
  useEffect(() => {
    if (finder.topN !== null) onTopNChange?.(finder.topN);
  }, [finder.topN, onTopNChange]);
  // Open beside the results on wide screens; on phones they'd push results down
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(min-width: 1024px)').matches
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-1 lg:min-h-0">
      <PoolToolbar
        finder={finder}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      >
        {menus}
      </PoolToolbar>

      <div
        className={`grid grid-cols-1 gap-3 lg:flex-1 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)] ${
          filtersOpen
            ? 'lg:grid-cols-[236px_minmax(0,1fr)_288px]'
            : 'lg:grid-cols-[minmax(0,1fr)_288px]'
        }`}
      >
        {filtersOpen && (
          <Pane aria-label="Filters" className="max-h-[60vh] lg:max-h-none">
            <PaneHeader
              title="Filters"
              aside={
                <label
                  className="flex items-center gap-1.5 text-[11px] text-white/45"
                  title="Only applies with stat filters"
                >
                  Min games
                  <input
                    type="number"
                    min={0}
                    value={finder.minGames}
                    onChange={(e) =>
                      finder.setMinGames(
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    aria-label="Minimum games (with stat filters)"
                    className={`${fieldClass} !h-7 w-12 px-1.5 text-xs`}
                  />
                </label>
              }
            />
            <div className="flex-1 min-h-0">
              <FilterTabs
                filters={finder.filters}
                setFilters={finder.setFilters}
                variant="column"
              />
            </div>
          </Pane>
        )}

        <Pane
          aria-label="Results"
          className="min-h-[360px] max-h-[75vh] lg:max-h-none"
        >
          <PoolSearchResults
            // Ticks start over when the list itself changes, not on a search
            key={finder.universeKey}
            active={finder.active}
            loading={finder.loading}
            error={finder.error}
            preselect={finder.topN !== null}
            season={finder.season}
            rows={finder.rows}
            universe={finder.universe}
            defaultTicked={finder.defaultTicked}
            onAdd={addWithScores}
            header={<ResultsHeader finder={finder} />}
          />
        </Pane>

        {pool}
      </div>
    </div>
  );
};
