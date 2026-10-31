/**
 * FILE: src/features/ranker/hooks/usePoolFinder.ts
 * PURPOSE: State and results for the ranker's player finder: name search, filters, season, minimum games and the Top-N preset
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created as part of FilterPoolPanel.tsx (PR #565)
 *  - 2026-10-22: Top-N preset, best-paid candidates, near misses, preloaded and stored scores
 *  - 2026-10-24: Extracted from FilterPoolPanel.tsx for the workbench layout
 *  - 2026-10-31: Top-N lists everyone (the usual candidates start ticked); search only narrows what's shown; experience per row
 *
 * LINKS:
 *  - Filter engine: src/features/roster/utils/rosterBuilderHelpers.ts (filterRosterDrawerPlayers)
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultAddPlayerFilters,
  normalizeTeamCode,
} from '@/shared/utils/filtering';
import { TeamListFull } from '@/constants/teamList';
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
  useSeasonViews,
  type SeasonView,
} from './useSeasonViews';
import {
  loadImpactScores,
  storedRankerScore,
  useImpactScores,
} from './useImpactScores';
import { defaultTickCount, rankTopNPool, suggestedPoolSize } from '../utils/playerImpact';
import { seasonInLeague } from '../utils/seasonInLeague';
import type { PoolSearchRow } from '../PoolSearchResults';

export const DEFAULT_MIN_GAMES = 10;

const TEAM_CODES = new Set(TeamListFull.map((t) => t.code.toUpperCase()));
// Retired and unsigned players carry no current team
const hasCurrentTeam = (row: Pick<PoolSearchRow, 'team'>): boolean =>
  Boolean(row.team && TEAM_CODES.has(row.team.toUpperCase()));

type Candidate = RosterDrawerPlayer<RosterManagerPlayer>;

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
    stats: (candidate.original.currentSeasonStats ??
      null) as PoolSearchRow['stats'],
  };
};

export const usePoolFinder = (
  candidates: Candidate[],
  poolIds: ReadonlySet<string>
) => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());
  const [season, setSeason] = useState(CURRENT_SEASON_CODE);
  const [minGames, setMinGames] = useState(DEFAULT_MIN_GAMES);
  // Top-N preset: the list size, and how many candidates to pull for it
  const [topN, setTopN] = useState<number | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  // Top-N pulls leave out players without a current team unless asked
  const [includeTeamless, setIncludeTeamless] = useState(false);
  const chooseTopN = (n: number | null) => {
    setTopN(n);
    if (n !== null) setPoolSize(suggestedPoolSize(n));
  };

  const candidateIds = useMemo(() => candidates.map((p) => p.id), [candidates]);
  const isPastSeason = season !== CURRENT_SEASON_CODE;
  const {
    viewsById: loadedViews,
    loading,
    error,
  } = useSeasonViews(season, candidateIds);
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
      const age = original?.bio?.dob
        ? (derived ?? view.age)
        : (view.age ?? derived);
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

  const { rows, universe, defaultTicked, hiddenTeamless } = useMemo<{
    // What's shown (a Top-N list narrowed by any search)
    rows: PoolSearchRow[];
    // Everyone the list is about: a Top-N list's whole ranking, or the matches
    universe: PoolSearchRow[];
    // Top-N: the usual candidates, ticked to start with
    defaultTicked: string[];
    hiddenTeamless: number;
  }>(() => {
    const none = { rows: [], universe: [], defaultTicked: [], hiddenTeamless: 0 };
    if (!active || waitingForSeason || waitingForScores) return none;
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const scores = impact.scoresById;
    const ranking = topN !== null && Boolean(scores);
    const options = {
      seasonById: viewsById,
      minGames: statFiltersActive ? minGames : 0,
    };
    // A Top-N list ranks everyone the filters allow; search only narrows the view
    const matches = filterRosterDrawerPlayers(
      candidates,
      ranking ? '' : searchTerm,
      filters,
      options
    ).flatMap((player) => {
      const candidate = byId.get(player.id);
      if (!candidate) return [];
      const view = viewsById?.get(player.id);
      const row = view ? { player, ...view } : currentRow(candidate);
      return [
        {
          ...row,
          inPool: poolIds.has(player.id),
          exp: seasonInLeague(candidate.original, season),
        },
      ];
    });
    if (!ranking || !scores)
      return { rows: matches, universe: matches, defaultTicked: [], hiddenTeamless: 0 };
    // This season, retired and unsigned players don't take candidate spots
    const eligible =
      isPastSeason || includeTeamless
        ? matches
        : matches.filter(hasCurrentTeam);
    // Everyone, ordered by their better place by stats or by pay; the top
    // `poolSize` by either start ticked
    const ranked = rankTopNPool(
      eligible.map((row) => ({ ...row, id: row.player.id })),
      scores
    );
    const shownIds = searchTerm
      ? new Set(
          filterRosterDrawerPlayers(candidates, searchTerm, filters, options).map(
            (p) => p.id
          )
        )
      : null;
    return {
      rows: shownIds ? ranked.filter((r) => shownIds.has(r.player.id)) : ranked,
      universe: ranked,
      defaultTicked: ranked
        .slice(0, defaultTickCount(ranked, poolSize))
        .map((r) => r.player.id),
      hiddenTeamless: matches.length - eligible.length,
    };
  }, [
    isPastSeason,
    includeTeamless,
    active,
    waitingForSeason,
    waitingForScores,
    candidates,
    searchTerm,
    filters,
    viewsById,
    statFiltersActive,
    minGames,
    poolIds,
    topN,
    poolSize,
    season,
    impact.scoresById,
  ]);
  // Ticks start over when the list itself changes (not when searching it)
  const universeKey = useMemo(
    () =>
      topN === null
        ? 'matches'
        : `top ${topN}: ${universe.map((r) => r.player.id).join(',')}`,
    [topN, universe]
  );

  return {
    search,
    setSearch,
    filters,
    setFilters,
    anyFilter,
    season,
    setSeason,
    isPastSeason,
    minGames,
    setMinGames,
    topN,
    chooseTopN,
    poolSize,
    active,
    rows,
    universe,
    defaultTicked,
    universeKey,
    includeTeamless,
    setIncludeTeamless,
    hiddenTeamless,
    loading: loading || waitingForSeason || impact.loading || waitingForScores,
    error: error ?? impact.error,
  };
};

export type PoolFinder = ReturnType<typeof usePoolFinder>;
