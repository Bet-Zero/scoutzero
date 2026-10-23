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
 *  - 2026-10-22: Preload this season's scores in the background
 *  - 2026-10-22: Use scores stored by the stats refresh when present
 *  - 2026-10-23: Layout pass: labelled season and Top-N controls, shared panel style
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Filter engine: src/features/roster/utils/rosterBuilderHelpers.ts (filterRosterDrawerPlayers)
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Search, SlidersHorizontal } from 'lucide-react';
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
import {
  loadImpactScores,
  storedRankerScore,
  useImpactScores,
} from './hooks/useImpactScores';
import { selectTopNCandidates, suggestedPoolSize } from './utils/playerImpact';
import { PoolSearchResults, type PoolSearchRow } from './PoolSearchResults';
import { FieldLabel, RankerPanel, chipClass, fieldClass } from './RankerPanel';

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

// Explanatory note under the controls
const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="flex gap-2 mb-4 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/45 text-xs leading-relaxed">
    <Info className="w-3.5 h-3.5 mt-px flex-shrink-0 text-white/30" />
    <span>{children}</span>
  </p>
);

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
  // Scores stored on player records by the stats refresh (no reads needed)
  const refreshedScoresById = useMemo(() => {
    const scores = new Map<string, number | null>();
    candidates.forEach((c) => {
      const score = storedRankerScore(c.original);
      if (score !== undefined) scores.set(c.id, score);
    });
    return scores;
  }, [candidates]);
  const impact = useImpactScores(
    season,
    candidateIds,
    currentStatsById,
    topN !== null,
    refreshedScoresById
  );

  // Warm up this season's scores in the background so a Top-N click is quick
  useEffect(() => {
    if (candidateIds.length === 0) return;
    const timer = setTimeout(() => {
      loadImpactScores(
        CURRENT_SEASON_CODE,
        candidateIds,
        currentStatsById,
        refreshedScoresById
      ).catch(() => {
        // The Top-N click loads (and reports errors) on its own
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [candidateIds, currentStatsById, refreshedScoresById]);
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
    <RankerPanel
      title="Find players"
      description="Search by name, filter by stats and roles, or pull the best players by score."
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players by name"
            aria-label="Search players by name"
            className={`${fieldClass} w-full pl-9 pr-3 py-2`}
          />
        </label>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            anyFilter || filtersOpen
              ? 'border-white/40 bg-white/[0.06] text-white'
              : 'border-white/[0.1] text-white/60 hover:text-white hover:border-white/25'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters{anyFilter ? ' (on)' : ''}
          {filtersOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-4">
        <div>
          <FieldLabel htmlFor="ranker-season">Season</FieldLabel>
          <div className="relative">
            <select
              id="ranker-season"
              aria-label="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className={`${fieldClass} h-9 appearance-none pl-3 pr-8 cursor-pointer`}
            >
              {SEASON_OPTIONS.map((code) => (
                <option key={code} value={code} className="bg-[#1a1a1a]">
                  {code}
                  {code === CURRENT_SEASON_CODE ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>
        </div>

        <div role="group" aria-labelledby="ranker-top-n-label">
          <span
            id="ranker-top-n-label"
            className="block text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35 mb-1.5"
          >
            Top-N pool
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {TOP_N_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => chooseTopN(topN === n ? null : n)}
                aria-pressed={topN === n}
                className={chipClass(topN === n)}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>

        {topN !== null && (
          <div className="flex items-end gap-3">
            <div>
              <FieldLabel htmlFor="ranker-candidates">Candidates</FieldLabel>
              <input
                id="ranker-candidates"
                type="number"
                min={topN}
                value={poolSize}
                onChange={(e) =>
                  setPoolSize(Math.max(topN, Number(e.target.value) || topN))
                }
                aria-label="Candidates to pull"
                className={`${fieldClass} h-9 w-20 px-2.5`}
              />
            </div>
            <button
              onClick={() => chooseTopN(null)}
              className="h-9 text-xs text-white/40 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {topN !== null && (
        <Note>
          Everyone in the top {poolSize} by Game Score per game
          {isPastSeason ? ` in ${season}` : ' (this season, leaning on last season until about 20 games are played)'}
          , plus everyone in the top {poolSize} by salary, after any search or
          filters. A player&apos;s best of the three seasons before counts too,
          and pay catches stars box scores undervalue (defense, injuries).
          Untick anyone who won&apos;t make your Top {topN}, and check the
          &ldquo;just missed&rdquo; list underneath for anyone else.
        </Note>
      )}

      {isPastSeason && (
        <Note>
          Team, age, salary and stats are as of {season}; players without a{' '}
          {season} record are hidden. Position, roles, badges, height/weight and
          contract-status filters use current data.
        </Note>
      )}

      {filtersOpen && (
        <div className="mb-4 rounded-lg border border-white/10 overflow-hidden">
          <label className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/60 bg-white/[0.03] border-b border-white/10">
            Min games
            <input
              type="number"
              min={0}
              value={minGames}
              onChange={(e) => setMinGames(Math.max(0, Number(e.target.value) || 0))}
              className={`${fieldClass} w-16 px-2 py-1 text-xs`}
            />
            <span className="text-white/30">(only with stat filters)</span>
          </label>
          <FilterTabs
            filters={filters}
            setFilters={setFilters}
            onCloseFilters={() => setFiltersOpen(false)}
          />
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
    </RankerPanel>
  );
};

