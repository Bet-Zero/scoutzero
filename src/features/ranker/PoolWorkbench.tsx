/**
 * FILE: src/features/ranker/PoolWorkbench.tsx
 * PURPOSE: The Player Ranker pool builder as one screen: toolbar on top, then filters, results and the pool side by side, each scrolling on its own
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Find Players panel created as FilterPoolPanel.tsx (PR #565)
 *  - 2026-10-24: Replaced by this workbench layout; finder state lives in hooks/usePoolFinder.ts
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { FilterTabs } from '@/features/roster/AddPlayerDrawer/addPlayer/FilterTabs';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { usePoolFinder, type PoolFinder } from './hooks/usePoolFinder';
import { PoolSearchResults } from './PoolSearchResults';
import { PoolToolbar } from './PoolToolbar';
import { Pane, PaneHeader, fieldClass } from './RankerPanel';

type PoolWorkbenchProps = {
  candidates: Array<RosterDrawerPlayer<RosterManagerPlayer>>;
  poolIds: ReadonlySet<string>;
  onAdd: (players: RosterManagerPlayer[]) => void;
  // Add-team / add-list / saved menus for the toolbar
  menus?: React.ReactNode;
  // The pool column
  pool?: React.ReactNode;
};

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 text-xs leading-relaxed text-white/45">
    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/30" />
    <div className="min-w-0">{children}</div>
  </div>
);

// Top-N size and explanation, and the past-season caveat, above the results
const ResultsHeader = ({ finder }: { finder: PoolFinder }) => {
  const { topN, poolSize, setPoolSize, isPastSeason, season } = finder;
  const [explained, setExplained] = useState(false);
  if (topN === null && !isPastSeason) return null;
  return (
    <div className="flex flex-shrink-0 flex-col gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.015]">
      {topN !== null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-semibold text-white">
            Top {topN} pool
          </span>
          <label className="flex items-center gap-2 text-xs text-white/55">
            Candidates
            <input
              type="number"
              min={topN}
              value={poolSize}
              onChange={(e) =>
                setPoolSize(Math.max(topN, Number(e.target.value) || topN))
              }
              aria-label="Candidates to pull"
              className={`${fieldClass} !h-8 w-20 px-2.5`}
            />
          </label>
          <span className="text-xs text-white/45">
            Untick anyone who won&apos;t make it.
          </span>
          <span className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setExplained((v) => !v)}
              aria-expanded={explained}
              className="text-xs text-white/50 hover:text-white"
            >
              How players are picked
            </button>
            <button
              onClick={() => finder.chooseTopN(null)}
              className="text-xs text-white/40 hover:text-white"
            >
              Clear
            </button>
          </span>
        </div>
      )}
      {topN !== null && explained && (
        <Note>
          Everyone in the top {poolSize} by Game Score per game
          {isPastSeason
            ? ` in ${season}`
            : ' (this season, leaning on last season until about 20 games are played)'}
          , plus everyone in the top {poolSize} by salary, after any search or
          filters. A player&apos;s best of the three seasons before counts too,
          and pay catches stars box scores undervalue (defense, injuries). Check
          the &ldquo;just missed&rdquo; list under the table for anyone else.
        </Note>
      )}
      {isPastSeason && (
        <Note>
          Team, age, salary and stats are as of {season}; players without a{' '}
          {season} record are hidden. Position, roles, badges, height/weight and
          contract-status filters use current data.
        </Note>
      )}
    </div>
  );
};

export const PoolWorkbench = ({
  candidates,
  poolIds,
  onAdd,
  menus = null,
  pool = null,
}: PoolWorkbenchProps) => {
  const finder = usePoolFinder(candidates, poolIds);
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
            active={finder.active}
            loading={finder.loading}
            error={finder.error}
            preselect={finder.topN !== null}
            season={finder.season}
            rows={finder.rows}
            nearMisses={finder.nearMisses}
            onAdd={onAdd}
            header={<ResultsHeader finder={finder} />}
          />
        </Pane>

        {pool}
      </div>
    </div>
  );
};
