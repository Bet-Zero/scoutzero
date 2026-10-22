/**
 * FILE: src/features/ranker/utils/topNSelection.ts
 * PURPOSE: "Top N" ranking mode: find and order only the best N players of a pool, cutting anyone who can no longer make the list
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created for the Top-N ranking mode
 *  - 2026-10-22: Players the user cuts by hand are skipped
 *
 * LINKS:
 *  - Full-ranking engine: src/features/ranker/utils/rankingEngine.ts
 *
 * HOW IT WORKS
 * Players are taken one at a time, setup groups first (top tier, then the
 * middle, then the bottom tier), in pool order within a group. Each is placed
 * into a best-first list of at most N by binary search; once the list is full
 * a newcomer is first matched against the current Nth place, so a player who
 * can't make the list costs a single matchup. Anyone with N players known
 * (directly or by transitivity) to be better is cut and never shown again.
 * Every decision comes from the comparison history, so the walk is replayed
 * from scratch on each call and undo just works.
 */
import {
  getSkipKey,
  RANKER_GROUP_ORDER,
  type RankerGraph,
  type RankerPair,
  type RankerPlayer,
} from './rankingEngine';

export type TopNResolution = {
  // Best-first, at most N; complete once nextPair is empty and nothing is pending
  ranked: RankerPlayer[];
  // Players who can't make the list
  cut: RankerPlayer[];
  // Players not yet placed (only while matchups remain)
  pending: RankerPlayer[];
  nextPair: RankerPair;
};

const groupIndex = (group: string | null | undefined): number => {
  const index = RANKER_GROUP_ORDER.indexOf(
    (group ?? '') as (typeof RANKER_GROUP_ORDER)[number]
  );
  return index === -1 ? RANKER_GROUP_ORDER.indexOf('upper') : index;
};

// Number of players known to be better than each player
export const countKnownAbove = (
  players: readonly RankerPlayer[],
  closure: RankerGraph
): Map<string, number> => {
  const above = new Map(players.map((p) => [p.id, 0]));
  for (const p of players) {
    closure[p.id]?.forEach((loser) => {
      if (above.has(loser)) above.set(loser, (above.get(loser) ?? 0) + 1);
    });
  }
  return above;
};

export const resolveTopN = (
  players: readonly RankerPlayer[],
  topN: number,
  closure: RankerGraph,
  skipSet: ReadonlySet<string> = new Set(),
  // Players the user ruled out themselves: cut without any matchups
  manualCuts: ReadonlySet<string> = new Set()
): TopNResolution => {
  const n = Math.max(1, Math.floor(topN));
  const beats = (a: string, b: string): boolean => Boolean(closure[a]?.has(b));
  const above = countKnownAbove(players, closure);

  const order = players
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        groupIndex(a.player.group) - groupIndex(b.player.group) || a.index - b.index
    )
    .map(({ player }) => player);

  const ranked: RankerPlayer[] = [];
  const cut: RankerPlayer[] = [];
  const pending: RankerPlayer[] = [];
  let nextPair: RankerPair = [];

  for (const p of order) {
    if (manualCuts.has(p.id) || (above.get(p.id) ?? 0) >= n) {
      cut.push(p);
      continue;
    }
    // Once a matchup is needed, everyone still unplaced is pending
    if (nextPair.length) {
      pending.push(p);
      continue;
    }

    // p belongs somewhere in ranked[lo..hi]; start from what is already known
    let lo = 0;
    let hi = ranked.length;
    ranked.forEach((q, i) => {
      if (beats(q.id, p.id)) lo = Math.max(lo, i + 1);
      else if (beats(p.id, q.id)) hi = Math.min(hi, i);
    });

    let blocked = false;
    while (lo < hi) {
      // With a full list, test the cutoff first: most newcomers stop there
      const probe =
        ranked.length >= n && hi === ranked.length
          ? ranked.length - 1
          : Math.floor((lo + hi) / 2);
      const q = ranked[probe];
      if (beats(q.id, p.id)) {
        lo = probe + 1;
      } else if (beats(p.id, q.id)) {
        hi = probe;
      } else {
        // Ask this matchup, or any other open one in range if it was skipped
        const candidates = [probe];
        for (let i = lo; i < hi; i++) if (i !== probe) candidates.push(i);
        const open = candidates.find(
          (i) => !skipSet.has(getSkipKey(ranked[i].id, p.id))
        );
        if (open !== undefined) nextPair = [ranked[open], p];
        else blocked = true;
        break;
      }
    }

    if (nextPair.length || blocked) {
      pending.push(p);
      continue;
    }

    if (lo >= n) {
      // Below the full list's Nth place: N players are better
      cut.push(p);
      continue;
    }
    ranked.splice(lo, 0, p);
    if (ranked.length > n) {
      const dropped = ranked.pop();
      if (dropped) cut.push(dropped);
    }
  }

  return { ranked, cut, pending, nextPair };
};

// Rough number of matchups left: binary-search insertions for players still
// unplaced, each starting with one cutoff check once the list is full
export const estimateTopNRemaining = (
  resolution: TopNResolution,
  topN: number
): number => {
  const pending = resolution.pending.length;
  if (pending === 0 && resolution.nextPair.length === 0) return 0;
  const listSize = Math.min(topN, resolution.ranked.length + pending);
  const perInsert = Math.max(1, Math.ceil(Math.log2(listSize + 1)));
  const open = resolution.ranked.length < topN ? perInsert : 1.5;
  return Math.max(1, Math.round(pending * open));
};

// Next matchup for a Top-N session; [] when the list is settled. Skipped
// matchups are avoided while others remain, then offered again.
export const suggestTopNPair = (
  players: readonly RankerPlayer[],
  topN: number,
  closure: RankerGraph,
  skipSet: ReadonlySet<string> = new Set(),
  manualCuts: ReadonlySet<string> = new Set()
): RankerPair => {
  if (players.length < 2) return [];
  const first = resolveTopN(players, topN, closure, skipSet, manualCuts);
  if (first.nextPair.length || first.pending.length === 0) return first.nextPair;
  return resolveTopN(players, topN, closure, new Set(), manualCuts).nextPair;
};

export type TopNCut = { ids: string[]; at: number };

// Players cut by hand. `at` is the number of results when the cut was made
// (-1 for cuts made in setup, which undo never removes).
export const manualCutIds = (cuts: readonly TopNCut[] | null | undefined): Set<string> =>
  new Set((cuts ?? []).flatMap((cut) => cut.ids));

// A Top-N size that actually trims the pool, or null for a full ranking
export const effectiveTopN = (
  topN: unknown,
  poolSize: number
): number | null =>
  typeof topN === 'number' && Number.isInteger(topN) && topN >= 1 && topN < poolSize
    ? topN
    : null;
