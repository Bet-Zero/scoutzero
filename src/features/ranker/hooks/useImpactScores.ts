/**
 * FILE: src/features/ranker/hooks/useImpactScores.ts
 * PURPOSE: Stats-only impact score per player for one season, used to pull the likely Top-N candidates into the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created for the Top-N pool preset
 *  - 2026-10-22: Also reads the three seasons before, so injured or down-year stars still score
 *  - 2026-10-22: Scores cached in the browser for 12 hours, and preloadable before they're needed
 *  - 2026-10-22: Use the score the stats refresh stores on each player record; read seasons only for players without one
 *
 * LINKS:
 *  - Score: src/features/ranker/utils/playerImpact.ts
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 */
import { useEffect, useState } from 'react';
import { RankerScoreZ } from '@/schemas/players_v2';
import {
  CURRENT_SEASON_CODE,
  loadSeasonStatLines,
} from './useSeasonViews';
import {
  earlierSeasonCodes,
  RANKER_SCORE_FORMULA_VERSION,
  rankerScoreFromSeasons,
  type ImpactStatLine,
} from '../utils/playerImpact';

type ImpactScoresState = {
  scoresById: Map<string, number> | null;
  loading: boolean;
  error: string | null;
};

// Score the stats refresh stored on a player's main record, when it's for
// the current season and today's formula: a number, null (nothing to
// score), or undefined (not stored; compute it here)
export const storedRankerScore = (player: unknown): number | null | undefined => {
  const raw = (player as { rankerScore?: unknown } | null | undefined)?.rankerScore;
  if (raw === undefined) return undefined;
  const parsed = RankerScoreZ.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.season !== CURRENT_SEASON_CODE ||
    parsed.data.formulaVersion !== RANKER_SCORE_FORMULA_VERSION
  ) {
    return undefined;
  }
  return parsed.data.value;
};

const computeImpactScores = async (
  seasonCode: string,
  playerIds: readonly string[],
  currentStatsById: ReadonlyMap<string, ImpactStatLine | null | undefined>
): Promise<Map<string, number>> => {
  const isCurrent = seasonCode === CURRENT_SEASON_CODE;
  const [chosen, ...earlier] = await Promise.all(
    [seasonCode, ...earlierSeasonCodes(seasonCode)].map((code) =>
      loadSeasonStatLines(code, playerIds)
    )
  );
  const scores = new Map<string, number>();
  for (const id of playerIds) {
    const score = rankerScoreFromSeasons(
      isCurrent ? (chosen.get(id) ?? currentStatsById.get(id)) : chosen.get(id),
      earlier.map((lines) => lines.get(id)),
      { isCurrentSeason: isCurrent }
    );
    if (score !== null) scores.set(id, score);
  }
  return scores;
};

// Scores barely move within a day, so they're kept in the browser for 12
// hours: after the first load a Top-N pool is instant. Bump the version when
// the score formula changes.
const SCORE_CACHE_VERSION = RANKER_SCORE_FORMULA_VERSION;
const SCORE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type StoredScores = {
  savedAt: number;
  // Every player looked up, including those with no score
  checked: string[];
  scores: Record<string, number>;
};

const cacheKey = (seasonCode: string) =>
  `ranker_impact_v${SCORE_CACHE_VERSION}:${seasonCode}`;

const readStoredScores = (seasonCode: string): StoredScores | null => {
  try {
    const raw = localStorage.getItem(cacheKey(seasonCode));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredScores;
    if (
      typeof stored?.savedAt !== 'number' ||
      Date.now() - stored.savedAt > SCORE_CACHE_TTL_MS ||
      !Array.isArray(stored.checked) ||
      typeof stored.scores !== 'object'
    ) {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
};

const writeStoredScores = (seasonCode: string, stored: StoredScores) => {
  try {
    localStorage.setItem(cacheKey(seasonCode), JSON.stringify(stored));
  } catch {
    // Storage full or unavailable: scores are simply recomputed next time
  }
};

/**
 * Scores for `seasonCode`. A past season is scored on its own stat line; the
 * current season blends in last season until enough games are played,
 * falling back to each player's denormalized current stats when the season
 * doc is missing. Either way, a player's best of the three seasons before
 * (slightly discounted) counts if it's higher, so a star who was hurt or had
 * a down year still makes the pool. Uses the browser cache, reading only
 * players it hasn't seen.
 */
export const loadImpactScores = async (
  seasonCode: string,
  playerIds: readonly string[],
  currentStatsById: ReadonlyMap<string, ImpactStatLine | null | undefined>,
  // Scores the stats refresh stored on player records (current season only)
  refreshedScoresById: ReadonlyMap<string, number | null> = new Map()
): Promise<Map<string, number>> => {
  if (seasonCode === CURRENT_SEASON_CODE && refreshedScoresById.size > 0) {
    const fromRefresh = new Map<string, number>();
    refreshedScoresById.forEach((value, id) => {
      if (value !== null) fromRefresh.set(id, value);
    });
    const rest = playerIds.filter((id) => !refreshedScoresById.has(id));
    if (rest.length === 0) return fromRefresh;
    const computed = await loadImpactScores(seasonCode, rest, currentStatsById);
    computed.forEach((value, id) => fromRefresh.set(id, value));
    return fromRefresh;
  }
  const stored = readStoredScores(seasonCode);
  const checked = new Set(stored?.checked ?? []);
  const known: Record<string, number> = { ...(stored?.scores ?? {}) };
  const missing = playerIds.filter((id) => !checked.has(id));

  if (missing.length > 0) {
    const fresh = await computeImpactScores(seasonCode, missing, currentStatsById);
    missing.forEach((id) => checked.add(id));
    fresh.forEach((score, id) => {
      known[id] = score;
    });
    writeStoredScores(seasonCode, {
      // Keep the original age so the whole entry still expires on time
      savedAt: stored?.savedAt ?? Date.now(),
      checked: [...checked],
      scores: known,
    });
  }

  const scores = new Map<string, number>();
  for (const id of playerIds) {
    if (known[id] !== undefined) scores.set(id, known[id]);
  }
  return scores;
};

export const useImpactScores = (
  seasonCode: string,
  playerIds: readonly string[],
  currentStatsById: ReadonlyMap<string, ImpactStatLine | null | undefined>,
  enabled: boolean,
  refreshedScoresById: ReadonlyMap<string, number | null> = new Map()
): ImpactScoresState => {
  // Stored scores arrive through a live subscription; a refresh that changes
  // them must re-run the load, not just a change of season or players
  const refreshedKey = [...refreshedScoresById].map(([id, v]) => `${id}:${v}`).join('|');
  const requestKey = enabled
    ? `${seasonCode}\u0000${playerIds.join('|')}\u0000${refreshedKey}`
    : '';
  const [state, setState] = useState<ImpactScoresState & { requestKey: string }>({
    scoresById: null,
    loading: false,
    error: null,
    requestKey: '',
  });

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    setState({ scoresById: null, loading: true, error: null, requestKey });
    loadImpactScores(seasonCode, playerIds, currentStatsById, refreshedScoresById)
      .then((scoresById) => {
        if (!cancelled) setState({ scoresById, loading: false, error: null, requestKey });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            scoresById: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            requestKey,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // playerIds, seasonCode and stored scores are captured through requestKey;
    // current stats only matter as a fallback and change with the same player set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (!requestKey) return { scoresById: null, loading: false, error: null };
  // Never hand back another season's or player set's scores
  if (state.requestKey !== requestKey) return { scoresById: null, loading: true, error: null };
  const { scoresById, loading, error } = state;
  return { scoresById, loading, error };
};
