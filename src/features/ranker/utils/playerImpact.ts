/**
 * FILE: src/features/ranker/utils/playerImpact.ts
 * PURPOSE: Stats-only "who's good" score for seeding Top-N ranker pools: Game Score per game, blended across the current and previous season
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created for the Top-N pool preset
 *
 * LINKS:
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 */

export type ImpactStatLine = Record<string, number | string | null | undefined>;

// Seasons with fewer games than this are too small a sample to score
export const MIN_SCORED_GAMES = 5;
// Games of the current season it takes to count as much as last season
const CURRENT_SEASON_RAMP_GAMES = 20;

const num = (line: ImpactStatLine, key: string): number | null => {
  const raw = line[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * John Hollinger's Game Score from a per-game stat line:
 * PTS + 0.4 FGM − 0.7 FGA − 0.4 (FTA − FTM) + 0.7 ORB + 0.3 DRB + STL
 * + 0.7 AST + 0.7 BLK − 0.4 PF − TOV.
 * Missing counting stats count as zero; without the offensive/defensive
 * split, total rebounds are weighted 0.4. Returns null without points or
 * with too few games.
 */
export const gameScorePerGame = (line: ImpactStatLine | null | undefined): number | null => {
  if (!line) return null;
  const pts = num(line, 'PTS');
  const games = num(line, 'GP');
  if (pts === null || (games !== null && games < MIN_SCORED_GAMES)) return null;
  const v = (key: string) => num(line, key) ?? 0;

  const orb = num(line, 'ORB');
  const drb = num(line, 'DRB');
  const rebounds =
    orb !== null || drb !== null ? 0.7 * (orb ?? 0) + 0.3 * (drb ?? 0) : 0.4 * v('REB');

  return (
    pts +
    0.4 * v('FGM') -
    0.7 * v('FGA') -
    0.4 * (v('FTA') - v('FTM')) +
    rebounds +
    v('STL') +
    0.7 * v('AST') +
    0.7 * v('BLK') -
    0.4 * v('PF') -
    v('TOV')
  );
};

/**
 * Current-season score that leans on last season until enough games are
 * played: the current season's weight is GP / (GP + 20), so 20 games in it
 * counts as much as last season. Uses whichever season exists when only one
 * can be scored.
 */
export const blendedImpactScore = (
  current: ImpactStatLine | null | undefined,
  previous: ImpactStatLine | null | undefined
): number | null => {
  const now = gameScorePerGame(current);
  const before = gameScorePerGame(previous);
  if (now === null) return before;
  if (before === null) return now;
  const games = num(current as ImpactStatLine, 'GP') ?? 0;
  const weight = games / (games + CURRENT_SEASON_RAMP_GAMES);
  return weight * now + (1 - weight) * before;
};

// Candidates to pull for a Top-N list: N plus a buffer that grows with √N
// (Top 10 → 26, Top 20 → 42, Top 50 → 85, Top 100 → 150)
export const suggestedPoolSize = (topN: number): number =>
  Math.max(1, Math.round(topN)) + Math.max(10, Math.round(5 * Math.sqrt(Math.max(1, topN))));
