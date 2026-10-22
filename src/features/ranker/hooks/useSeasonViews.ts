/**
 * FILE: src/features/ranker/hooks/useSeasonViews.ts
 * PURPOSE: Load every player as of one past season (team, age, salary, stat line) so pool filters and results reflect that season
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created for the Player Ranker filter-based pool builder (stat lines only)
 *  - 2026-10-21: Renamed from useSeasonStatLines; adds the season's team, age and salary (PR #565)
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 *  - Season docs written by: player-scrape/firestore_staging/scripts/stage_player.ts
 */
import { useEffect, useState } from 'react';
import { getDoc, getDocs } from 'firebase/firestore';
import { z } from 'zod';
import { contractsCol, seasonRef } from '@/data/firestorePaths';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type { DrawerSeasonView } from '@/features/roster/utils';

export type SeasonStatLine = Record<string, number>;

export type SeasonView = DrawerSeasonView & {
  team: string | null;
  age: number | null;
  salary: number | null;
  stats: SeasonStatLine | null;
};

// Only these fields of the season doc are needed; the rest is ignored
const SeasonViewDocZ = z.object({
  team: z.string().optional(),
  age: z.number().optional(),
  stats: z.record(z.string(), z.number()).optional(),
});

const ContractSalariesDocZ = z.object({
  salariesByYear: z
    .array(
      z.object({
        season: z.string().optional(),
        salary: z.union([z.number(), z.string()]).optional().nullable(),
        voidedByExtension: z.boolean().optional(),
      })
    )
    .optional(),
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

const seasonStartYear = (seasonCode: string): number =>
  Number.parseInt(seasonCode.slice(0, 4), 10);

type SeasonDocEntry = { team: string | null; age: number | null; stats: SeasonStatLine | null };

// Season docs and contracts don't change during a session, so each is read at most once
const seasonDocCache = new Map<string, Map<string, SeasonDocEntry | null>>();
// Salary by season start year, from every contract the player has signed
const salaryCache = new Map<string, Map<number, number>>();

const inBatches = async (
  ids: readonly string[],
  load: (id: string) => Promise<void>
) => {
  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    await Promise.all(ids.slice(i, i + FETCH_CONCURRENCY).map(load));
  }
};

const loadSeasonDocs = async (seasonCode: string, playerIds: readonly string[]) => {
  let docs = seasonDocCache.get(seasonCode);
  if (!docs) {
    docs = new Map();
    seasonDocCache.set(seasonCode, docs);
  }
  const cache = docs;
  await inBatches(
    playerIds.filter((id) => !cache.has(id)),
    async (id) => {
      const snap = await getDoc(seasonRef(id, seasonCode));
      const parsed = snap.exists() ? SeasonViewDocZ.safeParse(snap.data()) : null;
      cache.set(
        id,
        parsed?.success
          ? {
              team: parsed.data.team ?? null,
              age: parsed.data.age ?? null,
              stats: parsed.data.stats ?? null,
            }
          : null
      );
    }
  );
  return cache;
};

const loadSalaries = async (playerIds: readonly string[]) => {
  await inBatches(
    playerIds.filter((id) => !salaryCache.has(id)),
    async (id) => {
      const snap = await getDocs(contractsCol(id));
      const byYear = new Map<number, number>();
      snap.docs.forEach((contractDoc) => {
        const parsed = ContractSalariesDocZ.safeParse(contractDoc.data());
        if (!parsed.success) return;
        for (const row of parsed.data.salariesByYear ?? []) {
          if (row.voidedByExtension || !row.season) continue;
          const year = seasonStartYear(row.season);
          const salary = Number(row.salary);
          if (Number.isFinite(year) && Number.isFinite(salary) && salary > 0 && !byYear.has(year)) {
            byYear.set(year, salary);
          }
        }
      });
      salaryCache.set(id, byYear);
    }
  );
};

// Stat lines only (no contract reads), for players with a record that season
export const loadSeasonStatLines = async (
  seasonCode: string,
  playerIds: readonly string[]
): Promise<Map<string, SeasonStatLine>> => {
  const docs = await loadSeasonDocs(seasonCode, playerIds);
  const lines = new Map<string, SeasonStatLine>();
  for (const id of playerIds) {
    const stats = docs.get(id)?.stats;
    if (stats) lines.set(id, stats);
  }
  return lines;
};

/**
 * Every player as of `seasonCode`. A player without a season record for it
 * (not in the league that season) is left out of the map.
 */
export const loadSeasonViews = async (
  seasonCode: string,
  playerIds: readonly string[]
): Promise<Map<string, SeasonView>> => {
  const [docs] = await Promise.all([
    loadSeasonDocs(seasonCode, playerIds),
    loadSalaries(playerIds),
  ]);
  const year = seasonStartYear(seasonCode);
  const views = new Map<string, SeasonView>();
  for (const id of playerIds) {
    const entry = docs.get(id);
    if (!entry) continue;
    views.set(id, { ...entry, salary: salaryCache.get(id)?.get(year) ?? null });
  }
  return views;
};

type SeasonViewsState = {
  viewsById: Map<string, SeasonView> | null;
  loading: boolean;
  error: string | null;
};

/**
 * Players as of `seasonCode`. Returns `viewsById: null` for the current
 * season, where each player's current data is used instead.
 */
export const useSeasonViews = (
  seasonCode: string,
  playerIds: readonly string[]
): SeasonViewsState => {
  const isCurrent = seasonCode === CURRENT_SEASON_CODE;
  // Re-load when the set of players changes, not just its size
  const idsKey = playerIds.join('|');
  const requestKey = `${seasonCode}\u0000${idsKey}`;
  const [state, setState] = useState<SeasonViewsState & { requestKey: string }>({
    viewsById: null,
    loading: false,
    error: null,
    requestKey: '',
  });

  useEffect(() => {
    if (isCurrent) {
      setState({ viewsById: null, loading: false, error: null, requestKey });
      return;
    }
    let cancelled = false;
    setState({ viewsById: null, loading: true, error: null, requestKey });
    loadSeasonViews(seasonCode, playerIds)
      .then((viewsById) => {
        if (!cancelled) {
          setState({ viewsById, loading: false, error: null, requestKey });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            viewsById: null,
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
  // back the previous request's data
  if (state.requestKey !== requestKey) {
    return { viewsById: null, loading: !isCurrent, error: null };
  }
  const { viewsById, loading, error } = state;
  return { viewsById, loading, error };
};
