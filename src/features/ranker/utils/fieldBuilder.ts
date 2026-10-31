/**
 * FILE: src/features/ranker/utils/fieldBuilder.ts
 * PURPOSE: "Build the field" for a Top-N list: locks, cut-line rounds and a last-spots playoff that settle exactly N players with either/or answers, before the normal ranking
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; replaces trimming the pool with ranking tools (Top-N mode, "Definitely Out", anchor)
 *  - 2026-10-26: Knockout pairing in the playoff (a Top 100 playoff could take 1,000+ answers)
 *  - 2026-10-31: Quick sort places the clear calls of a round in one go; trim count
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldBuilder.tsx, src/features/ranker/RankingSession.tsx
 *
 * HOW IT WORKS
 * Locks take guaranteed spots. Every other player is in the bubble, which is
 * trimmed in rounds: each bubble player faces the round's cut-line player
 * once, winners stay and losers are cut. Players far from the cut line by
 * stats are placed in one quick sort (stats side by default, the user moves
 * the exceptions); only the close calls are asked one at a time. After a round, survivors whose
 * answers already settle them (enough players known below, or above) step
 * aside, so the next round only deals with the open ones. Once those are
 * close to the open spots, a playoff among only the closest players drops the
 * weakest (or brings back the best of the cut) until exactly N remain. Every answer is a
 * normal comparison, so the ranking reuses it. Progress is worked out from the
 * comparison history (the transitive closure), which makes undo just work.
 */
import type { RankerGraph } from '@/features/ranker/utils/rankingEngine';

export type FieldStage = 'locks' | 'cut' | 'playoff' | 'done';

export type FieldPlayoff = {
  // Drop the weakest of an oversized bubble, or add the best of the cut
  mode: 'drop' | 'add';
  set: string[];
  count: number;
  // Add mode: the survivors, who are already in
  keep: string[];
  // Comparison count when the playoff began; undo can't go below it
  start: number;
};

export type FieldState = {
  topN: number;
  stage: FieldStage;
  locks: string[];
  round: number;
  cutLine: string | null;
  // This round's players, cut line included
  bubble: string[];
  // Comparison count when the round began; undo can't go below it
  roundStart: number;
  // Comparison count right after this round's quick sort; unset until then
  sortedAt?: number;
  // Bubble players the answers settled in, set aside like locks
  inIds: string[];
  // Players cut so far, in the order they were cut
  cutIds: string[];
  playoff: FieldPlayoff | null;
  // The settled field (stage 'done')
  fieldIds: string[] | null;
  // Pool ids by stats, best first, fixed when the list was started (scored
  // for the season the pool was pulled for). Older sessions don't have it.
  order?: string[];
};

export const createFieldState = (topN: number, order?: string[]): FieldState => ({
  topN,
  stage: 'locks',
  locks: [],
  round: 0,
  cutLine: null,
  bubble: [],
  roundStart: 0,
  inIds: [],
  cutIds: [],
  playoff: null,
  fieldIds: null,
  ...(order ? { order } : {}),
});

// Pool ids best-first: by `saved` order where it covers them, then by
// score (higher first), then pool order
export const poolBestFirst = (
  ids: readonly string[],
  score: (id: string) => number,
  saved?: readonly string[]
): string[] => {
  const savedAt = new Map((saved ?? []).map((id, i) => [id, i]));
  return ids
    .map((id, i) => ({ id, at: savedAt.get(id) ?? Infinity, s: score(id), i }))
    .sort((a, b) => a.at - b.at || b.s - a.s || a.i - b.i)
    .map(({ id }) => id);
};

const knownBetter = (closure: RankerGraph, a: string, b: string): boolean =>
  Boolean(closure[a]?.has(b));

export const spotsLeft = (state: FieldState): number =>
  Math.max(0, state.topN - state.locks.length - state.inIds.length);

// The survivors are near enough to the open spots for the playoff to finish
export const isCloseEnough = (survivors: number, spots: number): boolean =>
  survivors >= spots &&
  survivors <= spots + Math.max(4, Math.round(spots * 0.12));

// Cut-line suggestion: the player just past the open spots, by stats order
export const suggestCutLine = (
  bestFirst: readonly string[],
  spots: number
): string | null =>
  bestFirst.length ? bestFirst[Math.min(bestFirst.length - 1, spots)] : null;

// Finish with the locks, the players settled in, and `members`
const settle = (
  state: FieldState,
  members: string[],
  cutIds: string[]
): FieldState => ({
  ...state,
  stage: 'done',
  cutLine: null,
  bubble: [],
  playoff: null,
  cutIds,
  fieldIds: [...state.locks, ...state.inIds, ...members],
});

// Leave the locks step: start round one, or settle at once if the locks fill the list
export const startBubble = (
  state: FieldState,
  poolBestFirst: readonly string[],
  comparisonCount: number,
  cutLine?: string | null
): FieldState => {
  const locks = new Set(state.locks);
  const bubble = poolBestFirst.filter((id) => !locks.has(id));
  const spots = spotsLeft(state);
  // The locks fill the list: everyone else is cut
  if (spots === 0) return settle(state, [], bubble);
  // Everyone left fits: nothing to trim
  if (bubble.length <= spots) return settle(state, bubble, []);
  return {
    ...state,
    stage: 'cut',
    round: 1,
    bubble,
    cutLine: cutLine ?? suggestCutLine(bubble, spots),
    roundStart: comparisonCount,
  };
};

export type RoundStatus = {
  // Bubble players facing the cut line, best-first
  queue: string[];
  stayed: string[];
  out: string[];
  // Next player to face the cut line, or null once the round is answered
  next: string | null;
};

export const roundStatus = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[]
): RoundStatus => {
  const cutLine = state.cutLine;
  const inRound = new Set(state.bubble);
  const queue = bestFirst.filter((id) => inRound.has(id) && id !== cutLine);
  if (!cutLine) return { queue, stayed: [], out: [], next: null };
  const stayed = queue.filter((id) => knownBetter(closure, id, cutLine));
  const out = queue.filter((id) => knownBetter(closure, cutLine, id));
  const next =
    queue.find((id) => !stayed.includes(id) && !out.includes(id)) ?? null;
  return { queue, stayed, out, next };
};

// Quick sort: a round's players this far from the cut line by stats are
// placed in one go, so only the closest are asked one at a time. Simulated
// against noisy stats orders this roughly halves the answers for a Top 25 to
// Top 100 while keeping the near misses head to head.
export const QUICK_SORT_MIN = 6;
export const closeCallWindow = (roundSize: number): number =>
  Math.max(3, Math.round(roundSize * 0.2));

export type QuickSort = {
  // Unanswered players clearly above / below the cut line by stats, best-first
  above: string[];
  below: string[];
  // Players near the cut line, asked one at a time afterwards
  close: string[];
};

// The quick sort this round still needs, or null (already done, or too few
// clear calls to be worth a list)
export const quickSort = (
  state: FieldState,
  status: RoundStatus,
  bestFirst: readonly string[]
): QuickSort | null => {
  const cutLine = state.cutLine;
  if (!cutLine || state.sortedAt !== undefined) return null;
  const inRound = new Set(state.bubble);
  const round = bestFirst.filter((id) => inRound.has(id));
  const at = new Map(round.map((id, i) => [id, i]));
  const line = at.get(cutLine);
  if (line === undefined) return null;
  const window = closeCallWindow(round.length);
  const settled = new Set([...status.stayed, ...status.out]);
  const sort: QuickSort = { above: [], below: [], close: [] };
  for (const id of status.queue) {
    if (settled.has(id)) continue;
    const gap = (at.get(id) as number) - line;
    if (gap < -window) sort.above.push(id);
    else if (gap > window) sort.below.push(id);
    else sort.close.push(id);
  }
  return sort.above.length + sort.below.length >= QUICK_SORT_MIN ? sort : null;
};

export type FieldAnswer = { winner: string; loser: string };

// The quick sort's answers against the cut line. `moved` are the players the
// user put on the other side; they go first so, if they clash with earlier
// answers, the user's own call wins over a stats default.
export const quickSortAnswers = (
  cutLine: string,
  sort: QuickSort,
  moved: ReadonlySet<string>
): FieldAnswer[] => {
  const answer = (id: string, above: boolean): FieldAnswer =>
    above ? { winner: id, loser: cutLine } : { winner: cutLine, loser: id };
  const placed = [
    ...sort.above.map((id) => answer(id, !moved.has(id))),
    ...sort.below.map((id) => answer(id, moved.has(id))),
  ];
  const isMoved = (a: FieldAnswer) =>
    moved.has(a.winner === cutLine ? a.loser : a.winner);
  return [...placed.filter(isMoved), ...placed.filter((a) => !isMoved(a))];
};

// Swap the cut-line player before the round's first answer
export const changeCutLine = (
  state: FieldState,
  cutLine: string
): FieldState =>
  state.bubble.includes(cutLine) ? { ...state, cutLine } : state;

export type CutPlan = {
  // What to offer next: the field is set, a lower cut line (too few
  // survived), the playoff (close enough), or another round
  next: 'done' | 'lower' | 'playoff' | 'round';
  // Survivors the answers already settle: enough players known below them
  // to be in for sure, or enough known above them to be out
  sureIn: string[];
  sureOut: string[];
  // Everyone else still competes for `spots`, best-first
  open: string[];
  spots: number;
  // Cut line for another round: an open player with a matchup still unanswered
  cutLine: string | null;
};

const unanswered = (closure: RankerGraph, a: string, b: string): boolean =>
  !knownBetter(closure, a, b) && !knownBetter(closure, b, a);

// Nearest to `spots` in the open players' stats order, among players who'd
// still face someone new (so a round always learns something)
const pickCutLine = (
  open: readonly string[],
  spots: number,
  closure: RankerGraph
): string | null => {
  const useful = (x: string) =>
    open.some((y) => y !== x && unanswered(closure, x, y));
  for (let d = 0; d < open.length; d++) {
    for (const i of d === 0 ? [spots] : [spots - d, spots + d]) {
      if (i >= 0 && i < open.length && useful(open[i])) return open[i];
    }
  }
  return null;
};

// The round is answered: work out who's settled and what comes next
export const planCut = (
  state: FieldState,
  status: RoundStatus,
  closure: RankerGraph,
  bestFirst: readonly string[]
): CutPlan => {
  const total = spotsLeft(state);
  const alive = new Set([...status.stayed, state.cutLine as string]);
  const survivors = bestFirst.filter((id) => alive.has(id));
  if (survivors.length < total)
    return {
      next: 'lower',
      sureIn: [],
      sureOut: [],
      open: survivors,
      spots: total,
      cutLine: null,
    };
  const extra = survivors.length - total;
  const count = (pred: (y: string) => boolean) => survivors.filter(pred).length;
  const sureIn = survivors.filter(
    (x) => count((y) => knownBetter(closure, x, y)) >= extra
  );
  const sureOut = survivors.filter(
    (x) => count((y) => knownBetter(closure, y, x)) >= total
  );
  const settled = new Set([...sureIn, ...sureOut]);
  const open = survivors.filter((id) => !settled.has(id));
  const spots = total - sureIn.length;
  const base = { sureIn, sureOut, open, spots };
  if (open.length === spots) return { ...base, next: 'done', cutLine: null };
  if (isCloseEnough(open.length, spots))
    return { ...base, next: 'playoff', cutLine: null };
  const cutLine = pickCutLine(open, spots, closure);
  return { ...base, next: cutLine ? 'round' : 'playoff', cutLine };
};

// A new round starts without a quick sort (the key is left out, not
// undefined, so the saved session stays valid)
const unsorted = (state: FieldState): FieldState => {
  const next = { ...state };
  delete next.sortedAt;
  return next;
};

// Another round among the open survivors, with a stronger cut line
export const nextRound = (
  state: FieldState,
  status: RoundStatus,
  plan: CutPlan,
  comparisonCount: number,
  cutLine?: string | null
): FieldState => ({
  ...unsorted(state),
  round: state.round + 1,
  inIds: [...state.inIds, ...plan.sureIn],
  cutIds: [...state.cutIds, ...status.out, ...plan.sureOut],
  bubble: plan.open,
  cutLine: cutLine ?? plan.cutLine,
  roundStart: comparisonCount,
});

// Too few survived: run the round again with a lower cut line. Answers that
// already settle a player against the new cut line aren't asked again.
export const lowerCutLine = (
  state: FieldState,
  status: RoundStatus,
  bestFirst: readonly string[],
  comparisonCount: number,
  cutLine?: string | null
): FieldState => {
  const bubble = bestFirst.filter((id) => state.bubble.includes(id));
  const below = bubble.filter((id) => status.out.includes(id));
  const suggested =
    cutLine ??
    below[
      Math.min(
        below.length - 1,
        Math.max(0, spotsLeft(state) - status.stayed.length - 1)
      )
    ] ??
    state.cutLine;
  return {
    ...unsorted(state),
    round: state.round + 1,
    bubble,
    cutLine: suggested,
    roundStart: comparisonCount,
  };
};

// Settle the field, or hand the closest players to the playoff
export const finishCut = (
  state: FieldState,
  status: RoundStatus,
  plan: CutPlan,
  comparisonCount: number
): FieldState => {
  const cutIds = [...state.cutIds, ...status.out, ...plan.sureOut];
  const next = {
    ...unsorted(state),
    inIds: [...state.inIds, ...plan.sureIn],
    cutIds,
  };
  if (plan.open.length === plan.spots) return settle(next, plan.open, cutIds);
  const playoff: FieldPlayoff =
    plan.open.length > plan.spots
      ? {
          mode: 'drop',
          set: plan.open,
          count: plan.open.length - plan.spots,
          keep: [],
          start: comparisonCount,
        }
      : {
          mode: 'add',
          set: cutIds,
          count: plan.spots - plan.open.length,
          keep: plan.open,
          start: comparisonCount,
        };
  return {
    ...next,
    stage: 'playoff',
    playoff,
    cutLine: null,
    bubble: [],
  };
};

export type PlayoffStatus = {
  // Players the answers have settled so far (dropped, or brought back)
  decided: string[];
  pair: [string, string] | null;
};

export const playoffStatus = (
  playoff: FieldPlayoff,
  closure: RankerGraph,
  bestFirst: readonly string[]
): PlayoffStatus => {
  const rank = new Map(bestFirst.map((id, i) => [id, i]));
  const order = (ids: string[]) =>
    [...ids].sort(
      (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity)
    );
  const decided: string[] = [];
  while (decided.length < playoff.count) {
    const rest = playoff.set.filter((id) => !decided.includes(id));
    // Drop: nobody left is known worse. Add: nobody left is known better.
    const candidates =
      playoff.mode === 'drop'
        ? rest.filter(
            (x) => !rest.some((y) => y !== x && knownBetter(closure, x, y))
          )
        : rest.filter(
            (x) => !rest.some((y) => y !== x && knownBetter(closure, y, x))
          );
    if (candidates.length === 0) break;
    if (candidates.length === 1) {
      decided.push(candidates[0]);
      continue;
    }
    // Knockout: pair the candidates who've lost the fewest matchups so far
    // (dropping: fewest known better; adding: fewest known worse). Always
    // pitting one player against everyone means each later drop starts
    // almost from scratch; a bracket leaves the runners-up already sorted.
    const losses = (x: string) =>
      rest.filter((y) =>
        y !== x &&
        (playoff.mode === 'drop' ? knownBetter(closure, y, x) : knownBetter(closure, x, y))
      ).length;
    const byStats = order(candidates);
    // Ties go to the likeliest answers: weakest by stats when dropping, strongest when adding
    const likely = playoff.mode === 'drop' ? byStats.reverse() : byStats;
    const lost = new Map(likely.map((id) => [id, losses(id)]));
    const pair = likely
      .map((id, i) => ({ id, i }))
      .sort((a, b) => (lost.get(a.id) ?? 0) - (lost.get(b.id) ?? 0) || a.i - b.i)
      .slice(0, 2)
      .map(({ id }) => id);
    return { decided, pair: [pair[0], pair[1]] };
  }
  return { decided, pair: null };
};

export const finishPlayoff = (
  state: FieldState,
  decided: readonly string[]
): FieldState => {
  const playoff = state.playoff;
  if (!playoff) return state;
  const settled = new Set(decided);
  if (playoff.mode === 'drop') {
    return settle(
      state,
      playoff.set.filter((id) => !settled.has(id)),
      [...state.cutIds, ...decided]
    );
  }
  return settle(
    state,
    [...playoff.keep, ...decided],
    state.cutIds.filter((id) => !settled.has(id))
  );
};

// Comparisons below this count belong to finished steps and can't be undone
export const undoFloor = (state: FieldState): number => {
  if (state.stage === 'cut') return state.sortedAt ?? state.roundStart;
  if (state.stage === 'playoff' && state.playoff) return state.playoff.start;
  return Infinity;
};

export type TrimCount = {
  // Players the pool must lose to reach the list size
  total: number;
  // Cut so far, counting this round's and the playoff's answers
  cut: number;
  // Still to trim; below zero, that many come back
  left: number;
};

export const trimCount = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[]
): TrimCount => {
  const total = Math.max(0, bestFirst.length - state.topN);
  let cut = state.cutIds.length;
  if (state.stage === 'cut')
    cut += roundStatus(state, closure, bestFirst).out.length;
  if (state.stage === 'playoff' && state.playoff) {
    const decided = playoffStatus(state.playoff, closure, bestFirst).decided
      .length;
    cut += state.playoff.mode === 'drop' ? decided : -decided;
  }
  return { total, cut, left: total - cut };
};
