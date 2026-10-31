/**
 * FILE: src/features/ranker/utils/fieldBuilder.ts
 * PURPOSE: "Build the field" for a Top-N list: locks, a line set from five ranked reference players, one "select everyone better" screen, and head-to-heads for the last spots, before the normal ranking
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; replaces trimming the pool with ranking tools (Top-N mode, "Definitely Out", anchor)
 *  - 2026-10-26: Knockout pairing in the playoff (a Top 100 playoff could take 1,000+ answers)
 *  - 2026-10-31: Reference line and one selection screen replace the cut-line rounds and the playoff
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldBuilder.tsx, src/features/ranker/RankingSession.tsx
 *  - Last spots: src/features/ranker/utils/topNSelection.ts (resolveTopN)
 *
 * HOW IT WORKS
 * Locks take guaranteed spots; everyone else is a candidate for the open
 * spots. The user ranks five reference players: the candidates around the
 * open spots plus a buffer (about a third more) by Game Score. The middle one
 * of the user's order is the line, so a Game Score outlier lands first or
 * last and never becomes it. One screen asks for everyone better than the
 * line; the rest are cut. If fewer than the open spots were selected, the
 * line was inside the list: he and everyone selected are in, and one more
 * screen asks about the rest against the next reference down. The players
 * left (open spots plus about the buffer) then face each other head to head
 * until exactly the open spots are settled (a newcomer first meets whoever is
 * last so far). Every answer is a normal comparison, so the ranking reuses
 * it, and progress is worked out from the comparison history.
 */
import type { RankerGraph, RankerPlayer } from '@/features/ranker/utils/rankingEngine';
import { resolveTopN } from '@/features/ranker/utils/topNSelection';

export type FieldStage = 'locks' | 'refs' | 'select' | 'pick' | 'done';
// Stages of the cut-line rounds before 2026-10-31; saved lists move on to 'refs'
type LegacyStage = 'cut' | 'playoff';

export type FieldState = {
  topN: number;
  stage: FieldStage;
  locks: string[];
  // Goes up with every step, so undo takes each one back
  round: number;
  // Comparison count when the step began; undo can't go below it
  roundStart: number;
  // The five reference players, by Game Score (the user's order comes from answers)
  refs: string[];
  // Select step: the "better than" player
  cutLine: string | null;
  // Players still competing: the selection's candidates, then the last-spots pool
  bubble: string[];
  // Players settled in because a line came out inside the list
  inIds: string[];
  // Players cut so far
  cutIds: string[];
  // The settled field (stage 'done')
  fieldIds: string[] | null;
  // Pool ids by stats, best first, fixed when the list was started (scored
  // for the season the pool was pulled for). Older sessions don't have it.
  order?: string[];
};

// A field as saved: older sessions may be mid-way through the cut-line rounds
export type StoredFieldState = Omit<FieldState, 'stage' | 'refs'> & {
  stage: FieldStage | LegacyStage;
  refs?: string[];
};

export type FieldAnswer = { winner: string; loser: string };

export const createFieldState = (topN: number, order?: string[]): FieldState => ({
  topN,
  stage: 'locks',
  locks: [],
  round: 0,
  roundStart: 0,
  refs: [],
  cutLine: null,
  bubble: [],
  inIds: [],
  cutIds: [],
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

const known = (closure: RankerGraph, a: string, b: string): boolean =>
  knownBetter(closure, a, b) || knownBetter(closure, b, a);

// The top-N engine only reads ids (and groups, which field players don't have)
const asPlayers = (ids: readonly string[]): RankerPlayer[] =>
  ids.map((id) => ({ id }) as RankerPlayer);

const inOrder = (ids: Iterable<string>, bestFirst: readonly string[]): string[] => {
  const set = new Set(ids);
  return bestFirst.filter((id) => set.has(id));
};

export const spotsLeft = (state: Pick<FieldState, 'topN' | 'locks' | 'inIds'>): number =>
  Math.max(0, state.topN - state.locks.length - state.inIds.length);

export const REFERENCE_COUNT = 5;

// How far past the open spots the line aims: about a third more, at least 3.
// Simulated on 100 candidates for 29 spots, a buffer of 10 leaves about 40
// for the last spots, and the line lands inside the list 3-30% of the time
// (the backup screen covers that).
export const lineBuffer = (spots: number): number =>
  Math.max(3, Math.round(spots / 3));

// The candidates (best-first) to rank for the line: centred on the open
// spots plus the buffer, all past the open spots. None when there are too
// few candidates for that; the last spots then take everyone.
export const pickReferences = (
  candidates: readonly string[],
  spots: number
): string[] => {
  if (candidates.length < spots + REFERENCE_COUNT) return [];
  const half = Math.floor(REFERENCE_COUNT / 2);
  const centre = spots + lineBuffer(spots) - 1;
  const start = Math.max(
    spots,
    Math.min(centre - half, candidates.length - REFERENCE_COUNT)
  );
  return candidates.slice(start, start + REFERENCE_COUNT);
};

// Finish with the locks, the players settled in, and `members`
const settle = (
  state: FieldState,
  members: string[],
  cutIds: string[]
): FieldState => ({
  ...state,
  stage: 'done',
  round: state.round + 1,
  cutLine: null,
  bubble: [],
  cutIds,
  fieldIds: [...state.locks, ...state.inIds, ...members],
});

// The last spots among `pool`, or settle at once when the pool fits
const toPick = (
  state: FieldState,
  pool: string[],
  cutIds: string[],
  comparisonCount: number
): FieldState => {
  if (pool.length <= spotsLeft(state)) return settle(state, pool, cutIds);
  return {
    ...state,
    stage: 'pick',
    round: state.round + 1,
    roundStart: comparisonCount,
    cutLine: null,
    bubble: pool,
    cutIds,
  };
};

// Leave the locks step: rank the references, or settle / go to the last
// spots when there's nothing to draw a line through
export const startRefs = (
  state: FieldState,
  bestFirst: readonly string[],
  comparisonCount: number
): FieldState => {
  const locks = new Set(state.locks);
  const candidates = bestFirst.filter((id) => !locks.has(id));
  const spots = spotsLeft(state);
  // The locks fill the list: everyone else is cut
  if (spots === 0) return settle(state, [], candidates);
  const refs = pickReferences(candidates, spots);
  if (!refs.length) return toPick(state, candidates, [], comparisonCount);
  return {
    ...state,
    stage: 'refs',
    round: state.round + 1,
    roundStart: comparisonCount,
    refs,
    cutLine: null,
    bubble: candidates,
  };
};

export type RefsStatus = {
  // The references in the user's order, best first (complete once pair is null)
  ranked: string[];
  pair: [string, string] | null;
};

export const refsStatus = (
  state: FieldState,
  closure: RankerGraph
): RefsStatus => {
  const res = resolveTopN(asPlayers(state.refs), state.refs.length, closure);
  const pair = res.nextPair.length
    ? ([res.nextPair[0].id, res.nextPair[1].id] as [string, string])
    : null;
  return { ranked: res.ranked.map((p) => p.id), pair };
};

// The middle of the user's order
export const lineOf = (ranked: readonly string[]): string | null =>
  ranked.length ? ranked[Math.floor(ranked.length / 2)] : null;

// The references are ranked: open the selection screen with the middle one
export const startSelect = (
  state: FieldState,
  ranked: readonly string[],
  comparisonCount: number
): FieldState => ({
  ...state,
  stage: 'select',
  round: state.round + 1,
  roundStart: comparisonCount,
  cutLine: lineOf(ranked),
});

export type SelectStatus = {
  // Players to choose from, best by Game Score first
  open: string[];
  // Already settled against the line by earlier answers (the references)
  better: string[];
  worse: string[];
};

export const selectStatus = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[]
): SelectStatus => {
  const line = state.cutLine;
  const others = inOrder(state.bubble, bestFirst).filter((id) => id !== line);
  if (!line) return { open: others, better: [], worse: [] };
  return {
    open: others.filter((id) => !known(closure, id, line)),
    better: others.filter((id) => knownBetter(closure, id, line)),
    worse: others.filter((id) => knownBetter(closure, line, id)),
  };
};

// The next line down if this one comes out inside the list: the next
// reference in the user's order, among the players below it
export const backupLine = (
  state: FieldState,
  closure: RankerGraph
): string | null => {
  const line = state.cutLine;
  if (!line) return null;
  const { ranked } = refsStatus(state, closure);
  const remaining = new Set(state.bubble);
  return (
    ranked
      .slice(ranked.indexOf(line) + 1)
      .find((id) => remaining.has(id)) ?? null
  );
};

// The selection's answers: everyone selected beat the line, and the line
// beat everyone else on the screen
export const selectionAnswers = (
  line: string,
  open: readonly string[],
  selected: ReadonlySet<string>
): FieldAnswer[] =>
  open.map((id) =>
    selected.has(id)
      ? { winner: id, loser: line }
      : { winner: line, loser: id }
  );

// After the selection's answers are in: cut the rest and go to the last
// spots, or (line inside the list) settle the line and everyone above it,
// then one more screen for the rest against the next reference down
export const afterSelect = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[],
  comparisonCount: number
): FieldState => {
  const line = state.cutLine;
  if (!line) return state;
  const others = inOrder(state.bubble, bestFirst).filter((id) => id !== line);
  // Anyone not settled against the line stays in the running, to be safe
  const above = others.filter((id) => !knownBetter(closure, line, id));
  const below = others.filter((id) => knownBetter(closure, line, id));
  const spots = spotsLeft(state);
  if (above.length >= spots)
    return toPick(state, above, [...state.cutIds, line, ...below], comparisonCount);

  // Fewer than the open spots beat the line: they and the line are in
  const settledIn = { ...state, inIds: [...state.inIds, ...above, line] };
  const rest = { ...settledIn, bubble: below };
  const left = spotsLeft(rest);
  if (left === 0) return settle(rest, [], [...state.cutIds, ...below]);
  if (below.length <= left) return settle(rest, below, state.cutIds);
  const next = backupLine({ ...state, bubble: below }, closure);
  if (!next) return toPick(rest, below, state.cutIds, comparisonCount);
  return {
    ...rest,
    stage: 'select',
    round: state.round + 1,
    roundStart: comparisonCount,
    cutLine: next,
  };
};

export type PickStatus = {
  // The open spots so far, best first (final once pair is null)
  ranked: string[];
  // Players who can't make it
  cut: string[];
  pair: [string, string] | null;
};

// Last spots: head to head until the open spots are settled; a newcomer
// first meets whoever is last so far
export const pickStatus = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[]
): PickStatus => {
  const pool = inOrder(state.bubble, bestFirst);
  const res = resolveTopN(asPlayers(pool), Math.max(1, spotsLeft(state)), closure);
  const pair = res.nextPair.length
    ? ([res.nextPair[0].id, res.nextPair[1].id] as [string, string])
    : null;
  return {
    ranked: res.ranked.map((p) => p.id),
    cut: res.cut.map((p) => p.id),
    pair,
  };
};

export const finishPick = (state: FieldState, status: PickStatus): FieldState =>
  settle(state, status.ranked, [...state.cutIds, ...status.cut]);

// Comparisons below this count belong to finished steps and can't be undone
export const undoFloor = (state: FieldState): number =>
  state.stage === 'refs' || state.stage === 'select' || state.stage === 'pick'
    ? state.roundStart
    : Infinity;

export const isLegacyField = (field: StoredFieldState): boolean =>
  field.stage === 'cut' || field.stage === 'playoff';

// A saved field in today's shape. One saved part-way through the old
// cut-line rounds keeps its locks and answers and moves on to the references.
export const normalizeField = (
  field: StoredFieldState,
  bestFirst: readonly string[],
  comparisonCount: number
): FieldState => {
  if (!isLegacyField(field)) return { ...(field as FieldState), refs: field.refs ?? [] };
  const base = {
    ...createFieldState(field.topN, field.order),
    locks: field.locks,
    round: field.round,
  };
  return startRefs(base, bestFirst, comparisonCount);
};

export type TrimCount = {
  // Players the pool must lose to reach the list size
  total: number;
  // Cut so far, counting the last spots' answers
  cut: number;
  // Still to trim
  left: number;
};

export const trimCount = (
  state: FieldState,
  closure: RankerGraph,
  bestFirst: readonly string[]
): TrimCount => {
  const total = Math.max(0, bestFirst.length - state.topN);
  let cut = state.cutIds.length;
  if (state.stage === 'pick') cut += pickStatus(state, closure, bestFirst).cut.length;
  return { total, cut, left: total - cut };
};
