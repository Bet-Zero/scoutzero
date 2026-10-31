/**
 * FILE: src/features/ranker/utils/playerImpact.ts
 * PURPOSE: Stats-only "who's good" score for seeding Top-N ranker pools: Game Score per game, blended across the current and previous season
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created for the Top-N pool preset
 *  - 2026-10-22: Best recent season counts too, so injured or down-year stars aren't left out
 *  - 2026-10-22: Pool is the union of the best by stats and the best paid, plus a near-miss list
 *  - 2026-10-22: rankerScoreFromSeasons, shared with the stats refresh that stores each player's score
 *
 * LINKS:
 *  - Used in: src/features/ranker/hooks/usePoolFinder.ts, src/features/ranker/hooks/useImpactScores.ts
 *  - Stored by: scripts/dev/rankerScore.ts (stats refresh)
 */

export type ImpactStatLine = Record<string, number | string | null | undefined>;

// Seasons with fewer games than this are too small a sample to score
export const MIN_SCORED_GAMES = 5;
// Games of the current season it takes to count as much as last season
const CURRENT_SEASON_RAMP_GAMES = 20;
// An earlier season needs this many games to stand in for a player's level
export const MIN_PEAK_GAMES = 20;
// Each season further back counts for 5% less (age, decline)
const PEAK_DECAY_PER_SEASON = 0.95;

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

/**
 * Score that doesn't forget injured or down-year players: the higher of the
 * recent score and the best of the earlier seasons (most recent first, each
 * needing MIN_PEAK_GAMES games), discounted 5% per season back.
 */
export const recentPeakScore = (
  recent: number | null,
  earlierSeasons: ReadonlyArray<ImpactStatLine | null | undefined>
): number | null => {
  let best = recent;
  earlierSeasons.forEach((line, index) => {
    const games = line ? num(line, 'GP') : null;
    if (!line || games === null || games < MIN_PEAK_GAMES) return;
    const score = gameScorePerGame(line);
    if (score === null) return;
    const discounted = score * PEAK_DECAY_PER_SEASON ** (index + 1);
    if (best === null || discounted > best) best = discounted;
  });
  return best;
};

// Bump whenever the score formula changes: stored scores from another
// version are ignored and recomputed
export const RANKER_SCORE_FORMULA_VERSION = 1;
// Seasons before the chosen one that can stand in for a player's level
export const RANKER_EARLIER_SEASONS = 3;

// "2025-26", "2024-25", … for the seasons before `seasonCode`, most recent first
export const earlierSeasonCodes = (
  seasonCode: string,
  count = RANKER_EARLIER_SEASONS
): string[] => {
  const startYear = Number.parseInt(seasonCode.slice(0, 4), 10);
  return Array.from({ length: count }, (_, i) => {
    const year = startYear - 1 - i;
    return `${year}-${String(year + 1).slice(-2)}`;
  });
};

/**
 * The Top-N score for one player and season: the season's own Game Score
 * (for the current season, blended with last season until about 20 games
 * are played), or the best of the seasons before if that's higher. The one
 * formula used both in the app and by the stats refresh that stores it.
 */
export const rankerScoreFromSeasons = (
  chosen: ImpactStatLine | null | undefined,
  // The seasons before the chosen one, most recent first
  earlier: ReadonlyArray<ImpactStatLine | null | undefined>,
  { isCurrentSeason }: { isCurrentSeason: boolean }
): number | null => {
  const recent = isCurrentSeason
    ? blendedImpactScore(chosen, earlier[0])
    : gameScorePerGame(chosen);
  return recentPeakScore(recent, earlier);
};

// Candidates to pull for a Top-N list: N plus a buffer that grows with √N
// (Top 10 → 26, Top 20 → 42, Top 50 → 85, Top 100 → 150)
export const suggestedPoolSize = (topN: number): number =>
  Math.max(1, Math.round(topN)) + Math.max(10, Math.round(5 * Math.sqrt(Math.max(1, topN))));

export type TopNCandidate = { id: string; salary: number | null };

export type RankedCandidate<T> = T & {
  // 1-based place by stats score / by salary (null when there's no score or salary)
  statsRank: number | null;
  payRank: number | null;
  // Position in the pool or near-miss list
  rank: number;
  // The better of statsRank and payRank: everyone within the top `poolSize`
  // by either has best <= poolSize
  best: number;
  score?: number;
};

const rankBy = <T extends TopNCandidate>(
  rows: readonly T[],
  value: (row: T) => number | null | undefined,
  counts: (v: number) => boolean
): Map<string, number> => {
  const ranked = rows
    .map((row) => ({ id: row.id, v: value(row) }))
    .filter((r): r is { id: string; v: number } => typeof r.v === 'number' && counts(r.v))
    .sort((a, b) => b.v - a.v);
  return new Map(ranked.map((r, i) => [r.id, i + 1]));
};

/**
 * Everyone with a stats score or a salary, ordered by their better rank of
 * the two (stats rank breaks ties, then pay rank). A Top-N list shows them
 * all; the top `poolSize` by either (a prefix of this order) start ticked.
 */
export const rankTopNPool = <T extends TopNCandidate>(
  rows: readonly T[],
  scores: ReadonlyMap<string, number>
): Array<RankedCandidate<T>> => {
  // Any real score ranks (a poor one still beats no score); only actual pay ranks
  const statsRanks = rankBy(rows, (row) => scores.get(row.id), Number.isFinite);
  const payRanks = rankBy(rows, (row) => row.salary, (v) => v > 0);
  return rows
    .map((row) => {
      const statsRank = statsRanks.get(row.id) ?? null;
      const payRank = payRanks.get(row.id) ?? null;
      const best = Math.min(statsRank ?? Infinity, payRank ?? Infinity);
      return { row, statsRank, payRank, best };
    })
    .filter((r) => Number.isFinite(r.best))
    .sort(
      (a, b) =>
        a.best - b.best ||
        (a.statsRank ?? Infinity) - (b.statsRank ?? Infinity) ||
        (a.payRank ?? Infinity) - (b.payRank ?? Infinity)
    )
    .map((r, i) => {
      const score = scores.get(r.row.id);
      return {
        ...r.row,
        statsRank: r.statsRank,
        payRank: r.payRank,
        best: r.best,
        rank: i + 1,
        ...(score !== undefined ? { score } : {}),
      };
    });
};

// How many of a ranked Top-N list start ticked: everyone in the top
// `poolSize` by stats or by salary
export const defaultTickCount = (
  ranked: ReadonlyArray<{ best: number }>,
  poolSize: number
): number => ranked.filter((r) => r.best <= poolSize).length;

/**
 * Candidates for a Top-N list, cast wide so no one who could make it is
 * missing: everyone in the top `poolSize` by stats score AND everyone in the
 * top `poolSize` by salary (pay catches stars box scores undervalue, like
 * defenders or players coming back from injury). Ordered by their better
 * rank of the two. The next `nearMissCount` players are returned separately
 * so they can be scanned and added by hand.
 */
export const selectTopNCandidates = <T extends TopNCandidate>(
  rows: readonly T[],
  scores: ReadonlyMap<string, number>,
  poolSize: number,
  nearMissCount = 25
): { pool: Array<RankedCandidate<T>>; nearMisses: Array<RankedCandidate<T>> } => {
  const ranked = rankTopNPool(rows, scores);
  const inPool = ranked.filter((r) => r.best <= poolSize);
  const rest = ranked.filter((r) => r.best > poolSize).slice(0, nearMissCount);
  return { pool: inPool, nearMisses: rest };
};
