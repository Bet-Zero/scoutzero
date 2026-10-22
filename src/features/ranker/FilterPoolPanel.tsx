/**
 * FILE: src/features/ranker/FilterPoolPanel.tsx
 * PURPOSE: Find players for the ranker pool by name search and/or filters (stats, age, salary, roles…) as of a chosen season, then add them one at a time, by selection, or all at once
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created for the Player Ranker filter-based pool builder
 *  - 2026-10-21: Name search, click/select to add, and past seasons apply to team, age and salary as well as stats
 *  - 2026-10-21: Past-season age from date of birth (season docs rarely store one)
 *  - 2026-10-22: Top-N preset: pull the N + buffer highest-scoring players (Game Score per game)
 *  - 2026-10-22: Top-N pool also takes the best paid, and lists the near misses to add by hand
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Filter engine: src/features/roster/utils/rosterBuilderHelpers.ts (filterRosterDrawerPlayers)
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from 'lucide-react';
import { FilterTabs } from '@/features/roster/AddPlayerDrawer/addPlayer/FilterTabs';
import { getDefaultAddPlayerFilters, normalizeTeamCode } from '@/shared/utils/filtering';
import {
  filterRosterDrawerPlayers,
  getDrawerPlayerAge,
  getDrawerPlayerAgeInSeason,
  hasActiveAddPlayerFilters,
  hasActiveStatFilters,
  type RosterDrawerPlayer,
} from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
  useSeasonViews,
  type SeasonView,
} from './hooks/useSeasonViews';
import { useImpactScores } from './hooks/useImpactScores';
import { selectTopNCandidates, suggestedPoolSize } from './utils/playerImpact';
import { PoolSearchResults, type PoolSearchRow } from './PoolSearchResults';

export const DEFAULT_MIN_GAMES = 10;
const TOP_N_PRESETS = [10, 20, 50, 100];
const SEASON_OPTIONS = [CURRENT_SEASON_CODE, ...getRecentPastSeasonCodes(3)];

type Candidate = RosterDrawerPlayer<RosterManagerPlayer>;

type FilterPoolPanelProps = {
  candidates: Candidate[];
  poolIds: ReadonlySet<string>;
  onAdd: (players: RosterManagerPlayer[]) => void;
};

// The player as of the current season, in the same shape as a past-season view
const currentRow = (candidate: Candidate): Omit<PoolSearchRow, 'inPool'> => {
  const salary = Number(candidate.salary);
  return {
    player: candidate.original,
    team:
      candidate.teamCode ||
      normalizeTeamCode(
        candidate.original.bio?.display?.teamId || candidate.team || ''
      ) ||
      null,
    age: getDrawerPlayerAge(candidate.original),
    salary: Number.isFinite(salary) && salary > 0 ? salary : null,
    stats: (candidate.original.currentSeasonStats ?? null) as PoolSearchRow['stats'],
  };
};

export const FilterPoolPanel = ({
  candidates,
  poolIds,
  onAdd,
}: FilterPoolPanelProps) => {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());
  const [season, setSeason] = useState(CURRENT_SEASON_CODE);
  const [minGames, setMinGames] = useState(DEFAULT_MIN_GAMES);
  // Top-N preset: the list size, and how many candidates to pull for it
  const [topN, setTopN] = useState<number | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  const chooseTopN = (n: number | null) => {
    setTopN(n);
    if (n !== null) setPoolSize(suggestedPoolSize(n));
  };

  const candidateIds = useMemo(() => candidates.map((p) => p.id), [candidates]);
  const isPastSeason = season !== CURRENT_SEASON_CODE;
  const { viewsById: loadedViews, loading, error } = useSeasonViews(season, candidateIds);
  // Season docs rarely carry an age, so it is worked out from date of birth
  const viewsById = useMemo(() => {
    if (!loadedViews) return null;
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const views = new Map<string, SeasonView>();
    loadedViews.forEach((view, id) => {
      const original = byId.get(id)?.original;
      // Date of birth is exact; without it, a stored season age beats the
      // current-age-minus-seasons estimate
      const derived = getDrawerPlayerAgeInSeason(original, season);
      const age = original?.bio?.dob ? (derived ?? view.age) : (view.age ?? derived);
      views.set(id, { ...view, age });
    });
    return views;
  }, [loadedViews, candidates, season]);
  const waitingForSeason = isPastSeason && !viewsById;

  const statFiltersActive = hasActiveStatFilters(filters);
  const anyFilter = hasActiveAddPlayerFilters(filters);
  const searchTerm = search.trim();
  const active = anyFilter || searchTerm.length > 0 || topN !== null;

  const currentStatsById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c.original.currentSeasonStats])),
    [candidates]
  );
  const impact = useImpactScores(season, candidateIds, currentStatsById, topN !== null);
  const waitingForScores = topN !== null && !impact.scoresById;

  const { rows, nearMisses } = useMemo<{
    rows: PoolSearchRow[];
    nearMisses: PoolSearchRow[];
  }>(() => {
    const none = { rows: [], nearMisses: [] };
    if (!active || waitingForSeason || waitingForScores) return none;
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const matches = filterRosterDrawerPlayers(candidates, searchTerm, filters, {
      seasonById: viewsById,
      minGames: statFiltersActive ? minGames : 0,
    }).flatMap((player) => {
      const candidate = byId.get(player.id);
      if (!candidate) return [];
      const view = viewsById?.get(player.id);
      const row = view ? { player, ...view } : currentRow(candidate);
      return [{ ...row, inPool: poolIds.has(player.id) }];
    });
    const scores = impact.scoresById;
    if (topN === null || !scores) return { rows: matches, nearMisses: [] };
    // Best by stats plus best paid, so nobody who could make the list is missing
    const { pool, nearMisses: next } = selectTopNCandidates(
      matches.map((row) => ({ ...row, id: row.player.id })),
      scores,
      poolSize
    );
    return { rows: pool, nearMisses: next };
  }, [active, waitingForSeason, waitingForScores, candidates, searchTerm, filters, viewsById, statFiltersActive, minGames, poolIds, topN, poolSize, impact.scoresById]);

  return (
    <div className="mb-5 p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35 block mb-4">
        Find Players
      </span>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players by name"
            aria-label="Search players by name"
            className="w-full bg-white/[0.05] text-white text-sm pl-9 pr-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/60">
          Season
          <select
            aria-label="Season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="bg-[#2a2a2a] text-white px-2 py-1.5 rounded"
          >
            {SEASON_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {code}
                {code === CURRENT_SEASON_CODE ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            anyFilter
              ? 'border-white/40 text-white'
              : 'border-white/[0.1] text-white/60 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters{anyFilter ? ' (on)' : ''}
          {filtersOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-white/60">
        <span>Top-N pool</span>
        {TOP_N_PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => chooseTopN(topN === n ? null : n)}
            aria-pressed={topN === n}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              topN === n
                ? 'border-white/60 bg-white/10 text-white'
                : 'border-white/[0.1] hover:text-white'
            }`}
          >
            Top {n}
          </button>
        ))}
        {topN !== null && (
          <>
            <label className="flex items-center gap-1.5 ml-2">
              Candidates
              <input
                type="number"
                min={topN}
                value={poolSize}
                onChange={(e) =>
                  setPoolSize(Math.max(topN, Number(e.target.value) || topN))
                }
                aria-label="Candidates to pull"
                className="w-16 bg-[#2a2a2a] text-white px-2 py-1 rounded"
              />
            </label>
            <button
              onClick={() => chooseTopN(null)}
              className="text-white/40 hover:text-white"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {topN !== null && (
        <p className="text-white/40 text-xs mb-3">
          Everyone in the top {poolSize} by Game Score per game
          {isPastSeason ? ` in ${season}` : ' (this season, leaning on last season until about 20 games are played)'}
          , plus everyone in the top {poolSize} by salary, after any search or
          filters. A player&apos;s best of the three seasons before counts too,
          and pay catches stars box scores undervalue (defense, injuries).
          Untick anyone who won&apos;t make your Top {topN}, and check the
          &ldquo;just missed&rdquo; list underneath for anyone else.
        </p>
      )}

      {isPastSeason && (
        <p className="text-white/40 text-xs mb-3">
          Team, age, salary and stats are as of {season}; players without a{' '}
          {season} record are hidden. Position, roles, badges, height/weight and
          contract-status filters use current data.
        </p>
      )}

      {filtersOpen && (
        <div className="mb-3">
          <label className="flex items-center gap-2 mb-3 text-xs text-white/60">
            Min games
            <input
              type="number"
              min={0}
              value={minGames}
              onChange={(e) => setMinGames(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 bg-[#2a2a2a] text-white px-2 py-1 rounded"
            />
            <span className="text-white/30">(only with stat filters)</span>
          </label>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <FilterTabs
              filters={filters}
              setFilters={setFilters}
              onCloseFilters={() => setFiltersOpen(false)}
            />
          </div>
        </div>
      )}

      <PoolSearchResults
        active={active}
        loading={loading || waitingForSeason || impact.loading || waitingForScores}
        error={error ?? impact.error}
        preselect={topN !== null}
        season={season}
        rows={rows}
        nearMisses={nearMisses}
        onAdd={onAdd}
      />
    </div>
  );
};
