/**
 * FILE: src/features/ranker/hooks/useSeasonStatLines.ts
 * PURPOSE: Load one past season's stat line for every player (players_v2/{id}/seasons/{season}) so pool filters can use that season
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created for the Player Ranker filter-based pool builder
 *
 * LINKS:
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 *  - Season docs written by: player-scrape/firestore_staging/scripts/stage_player.ts
 */
import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { z } from 'zod';
import { seasonRef } from '@/data/firestorePaths';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

export type SeasonStatLine = Record<string, number>;

// Only the stat line is needed; the rest of the season doc is ignored
const SeasonStatsDocZ = z.object({
  stats: z.record(z.string(), z.number()).optional(),
});

const FETCH_CONCURRENCY = 40;

// "2026-27" style code for the season starting in `startYear`
export const seasonCodeForStartYear = (startYear: number): string =>
  toSeasonCode(startYear + 1);

export const CURRENT_SEASON_CODE = seasonCodeForStartYear(DEFAULT_SALARY_YEAR);

// Previous seasons offered by the season picker, most recent first
export const getRecentPastSeasonCodes = (count = 3): string[] =>
  Array.from({ length: count }, (_, i) =>
    seasonCodeForStartYear(DEFAULT_SALARY_YEAR - 1 - i)
  );

type SeasonCacheEntry = {
  lines: Map<string, SeasonStatLine>;
  fetched: Set<string>;
};

// Season docs don't change during a session, so each one is read at most once
const seasonCache = new Map<string, SeasonCacheEntry>();

export const loadSeasonStatLines = async (
  seasonCode: string,
  playerIds: readonly string[]
): Promise<Map<string, SeasonStatLine>> => {
  let entry = seasonCache.get(seasonCode);
  if (!entry) {
    entry = { lines: new Map(), fetched: new Set() };
    seasonCache.set(seasonCode, entry);
  }
  const { lines, fetched } = entry;
  const missing = playerIds.filter((id) => !fetched.has(id));

  for (let i = 0; i < missing.length; i += FETCH_CONCURRENCY) {
    const batch = missing.slice(i, i + FETCH_CONCURRENCY);
    const snaps = await Promise.all(
      batch.map((id) => getDoc(seasonRef(id, seasonCode)))
    );
    snaps.forEach((snap, index) => {
      const id = batch[index];
      fetched.add(id);
      if (!snap.exists()) return;
      const parsed = SeasonStatsDocZ.safeParse(snap.data());
      if (parsed.success && parsed.data.stats) {
        lines.set(id, parsed.data.stats);
      }
    });
  }

  return new Map(lines);
};

type SeasonStatLinesState = {
  statsById: Map<string, SeasonStatLine> | null;
  loading: boolean;
  error: string | null;
};

/**
 * Stat lines for `seasonCode`. Returns `statsById: null` for the current
 * season, where each player's denormalized currentSeasonStats is used instead.
 */
export const useSeasonStatLines = (
  seasonCode: string,
  playerIds: readonly string[]
): SeasonStatLinesState => {
  const isCurrent = seasonCode === CURRENT_SEASON_CODE;
  // Re-load when the set of players changes, not just its size
  const idsKey = playerIds.join('|');
  const requestKey = `${seasonCode}\u0000${idsKey}`;
  const [state, setState] = useState<
    SeasonStatLinesState & { requestKey: string }
  >({ statsById: null, loading: false, error: null, requestKey: '' });

  useEffect(() => {
    if (isCurrent) {
      setState({ statsById: null, loading: false, error: null, requestKey });
      return;
    }
    let cancelled = false;
    setState({ statsById: null, loading: true, error: null, requestKey });
    loadSeasonStatLines(seasonCode, playerIds)
      .then((statsById) => {
        if (!cancelled) {
          setState({ statsById, loading: false, error: null, requestKey });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            statsById: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            requestKey,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // playerIds is captured through requestKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, isCurrent]);

  // Until the effect catches up with a new season or player set, never hand
  // back the previous request's stats
  if (state.requestKey !== requestKey) {
    return { statsById: null, loading: !isCurrent, error: null };
  }
  const { statsById, loading, error } = state;
  return { statsById, loading, error };
};
