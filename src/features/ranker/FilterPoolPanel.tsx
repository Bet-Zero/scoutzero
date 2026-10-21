/**
 * FILE: src/features/ranker/FilterPoolPanel.tsx
 * PURPOSE: Build the ranker pool from filters (stats, age, salary, roles…) and add every match at once
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created for the Player Ranker filter-based pool builder
 *
 * LINKS:
 *  - Filter engine: src/features/roster/utils/rosterBuilderHelpers.ts (filterRosterDrawerPlayers)
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { FilterTabs } from '@/features/roster/AddPlayerDrawer/addPlayer/FilterTabs';
import { getDefaultAddPlayerFilters } from '@/shared/utils/filtering';
import {
  filterRosterDrawerPlayers,
  hasActiveAddPlayerFilters,
  hasActiveStatFilters,
  type RosterDrawerPlayer,
} from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
  useSeasonStatLines,
} from './hooks/useSeasonStatLines';
import { FilterMatchPreview } from './FilterMatchPreview';

export const DEFAULT_MIN_GAMES = 10;
const SEASON_OPTIONS = [CURRENT_SEASON_CODE, ...getRecentPastSeasonCodes(3)];

type FilterPoolPanelProps = {
  candidates: Array<RosterDrawerPlayer<RosterManagerPlayer>>;
  poolIds: ReadonlySet<string>;
  onAdd: (players: RosterManagerPlayer[]) => void;
};

export const FilterPoolPanel = ({
  candidates,
  poolIds,
  onAdd,
}: FilterPoolPanelProps) => {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());
  const [season, setSeason] = useState(CURRENT_SEASON_CODE);
  const [minGames, setMinGames] = useState(DEFAULT_MIN_GAMES);

  const candidateIds = useMemo(
    () => candidates.map((p) => p.id),
    [candidates]
  );
  const statFiltersActive = hasActiveStatFilters(filters);
  // Past-season stats are only needed once a stat filter is in play
  const { statsById, loading, error } = useSeasonStatLines(
    statFiltersActive ? season : CURRENT_SEASON_CODE,
    candidateIds
  );
  const waitingForSeason =
    statFiltersActive && season !== CURRENT_SEASON_CODE && !statsById;

  const anyFilter = hasActiveAddPlayerFilters(filters);
  const matches = useMemo(() => {
    if (!anyFilter || waitingForSeason) return [];
    return filterRosterDrawerPlayers(candidates, '', filters, {
      statsById,
      minGames: statFiltersActive ? minGames : 0,
    });
  }, [anyFilter, waitingForSeason, candidates, filters, statsById, statFiltersActive, minGames]);
  const newMatches = matches.filter((p) => !poolIds.has(p.id));

  return (
    <div className="mb-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] uppercase text-white/35">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Build Pool From Filters
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5">
          <p className="text-white/40 text-xs mb-3">
            Example: Stats → PPG at least 20, Contract → salary min 15 ($M), or
            Bio → age 35+. Every player matching all filters can be added at once.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-white/60">
            <label className="flex items-center gap-2">
              Stats season
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="bg-[#2a2a2a] text-white px-2 py-1 rounded"
              >
                {SEASON_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                    {code === CURRENT_SEASON_CODE ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Min games
              <input
                type="number"
                min={0}
                value={minGames}
                onChange={(e) =>
                  setMinGames(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-16 bg-[#2a2a2a] text-white px-2 py-1 rounded"
              />
              <span className="text-white/30">(only with stat filters)</span>
            </label>
          </div>

          <div className="rounded-lg border border-white/10 overflow-hidden mb-3">
            <FilterTabs
              filters={filters}
              setFilters={setFilters}
              onCloseFilters={() => setOpen(false)}
            />
          </div>

          <FilterMatchPreview
            anyFilter={anyFilter}
            loading={loading || waitingForSeason}
            error={error}
            season={season}
            matches={matches}
            newMatches={newMatches}
            onAdd={() => onAdd(newMatches)}
          />
        </div>
      )}
    </div>
  );
};
