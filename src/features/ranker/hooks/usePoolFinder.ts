/**
 * FILE: src/features/ranker/hooks/usePoolFinder.ts
 * PURPOSE: State and results for the ranker's player finder: name search, filters, season, minimum games and the Top-N preset
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created as part of FilterPoolPanel.tsx (PR #565)
 *  - 2026-10-22: Top-N preset, best-paid candidates, near misses, preloaded and stored scores
 *  - 2026-10-24: Extracted from FilterPoolPanel.tsx for the workbench layout
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
import { selectTopNCandidates, suggestedPoolSize } from '../utils/playerImpact';
import type { PoolSearchRow } from '../PoolSearchResults';

export const DEFAULT_MIN_GAMES = 10;

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
  }, [
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
    impact.scoresById,
  ]);

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
    setPoolSize,
    active,
    rows,
    nearMisses,
    loading: loading || waitingForSeason || impact.loading || waitingForScores,
    error: error ?? impact.error,
  };
};

export type PoolFinder = ReturnType<typeof usePoolFinder>;
