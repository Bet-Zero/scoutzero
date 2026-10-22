/**
 * FILE: src/features/ranker/hooks/useImpactScores.ts
 * PURPOSE: Stats-only impact score per player for one season, used to pull the likely Top-N candidates into the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created for the Top-N pool preset
 *
 * LINKS:
 *  - Score: src/features/ranker/utils/playerImpact.ts
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 */
import { useEffect, useState } from 'react';
import {
  CURRENT_SEASON_CODE,
  loadSeasonStatLines,
  seasonCodeForStartYear,
} from './useSeasonViews';
import {
  blendedImpactScore,
  gameScorePerGame,
  type ImpactStatLine,
} from '../utils/playerImpact';

type ImpactScoresState = {
  scoresById: Map<string, number> | null;
  loading: boolean;
  error: string | null;
};

const previousSeasonCode = (seasonCode: string): string =>
  seasonCodeForStartYear(Number.parseInt(seasonCode.slice(0, 4), 10) - 1);

/**
 * Scores for `seasonCode`. A past season is scored on its own stat line.
 * The current season blends in last season until enough games are played,
 * falling back to each player's denormalized current stats when the season
 * doc is missing.
 */
export const loadImpactScores = async (
  seasonCode: string,
  playerIds: readonly string[],
  currentStatsById: ReadonlyMap<string, ImpactStatLine | null | undefined>
): Promise<Map<string, number>> => {
  const scores = new Map<string, number>();
  if (seasonCode !== CURRENT_SEASON_CODE) {
    const lines = await loadSeasonStatLines(seasonCode, playerIds);
    lines.forEach((line, id) => {
      const score = gameScorePerGame(line);
      if (score !== null) scores.set(id, score);
    });
    return scores;
  }
  const [current, previous] = await Promise.all([
    loadSeasonStatLines(seasonCode, playerIds),
    loadSeasonStatLines(previousSeasonCode(seasonCode), playerIds),
  ]);
  for (const id of playerIds) {
    const score = blendedImpactScore(
      current.get(id) ?? currentStatsById.get(id),
      previous.get(id)
    );
    if (score !== null) scores.set(id, score);
  }
  return scores;
};

export const useImpactScores = (
  seasonCode: string,
  playerIds: readonly string[],
  currentStatsById: ReadonlyMap<string, ImpactStatLine | null | undefined>,
  enabled: boolean
): ImpactScoresState => {
  const requestKey = enabled ? `${seasonCode}\u0000${playerIds.join('|')}` : '';
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
    loadImpactScores(seasonCode, playerIds, currentStatsById)
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
    // playerIds and seasonCode are captured through requestKey; current stats
    // only matter as a fallback and change with the same player set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (!requestKey) return { scoresById: null, loading: false, error: null };
  // Never hand back another season's or player set's scores
  if (state.requestKey !== requestKey) return { scoresById: null, loading: true, error: null };
  const { scoresById, loading, error } = state;
  return { scoresById, loading, error };
};
