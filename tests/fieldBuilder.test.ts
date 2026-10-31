import { describe, expect, it } from 'vitest';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';
import {
  afterSelect,
  backupLine,
  createFieldState,
  finishPick,
  lineOf,
  normalizeField,
  pickReferences,
  pickStatus,
  poolBestFirst,
  refsStatus,
  selectionAnswers,
  selectStatus,
  startRefs,
  startSelect,
  trimCount,
  undoFloor,
  type FieldState,
  type StoredFieldState,
} from '@/features/ranker/utils/fieldBuilder';

// p1 is truly the best, p2 next, and so on; `statsOrder` is what the app
// believes (Game Score: close to the truth but not equal)
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const truth = (id: string) => Number(id.slice(1));

type Cache = ReturnType<typeof createClosureCache>;
const answer = (cache: Cache, a: string, b: string) => {
  const [w, l] = truth(a) < truth(b) ? [a, b] : [b, a];
  expect(cache.addEdge(w, l)).toBe(true);
};

// The selection screen, answered truthfully; returns the answers recorded
const select = (cache: Cache, state: FieldState, statsOrder: string[]) => {
  const line = state.cutLine as string;
  const { open } = selectStatus(state, cache.closure, statsOrder);
  const chosen = new Set(open.filter((id) => truth(id) < truth(line)));
  const answers = selectionAnswers(line, open, chosen);
  answers.forEach(({ winner, loser }) => cache.addEdge(winner, loser));
  return answers.length;
};

// Run the field builder to the end as a truthful user would
const build = (
  pool: string[],
  topN: number,
  locks: string[],
  statsOrder: string[] = pool
) => {
  const cache = createClosureCache();
  let questions = 0;
  let screens = 0;
  let count = 0;
  let state: FieldState = { ...createFieldState(topN), locks };
  state = startRefs(state, statsOrder, 0);
  if (state.stage === 'refs') {
    let refs = refsStatus(state, cache.closure);
    while (refs.pair) {
      answer(cache, ...refs.pair);
      questions += 1;
      refs = refsStatus(state, cache.closure);
    }
    count = questions;
    state = startSelect(state, refs.ranked, count);
  }
  let poolAfterFirstScreen = 0;
  while (state.stage === 'select') {
    count += select(cache, state, statsOrder);
    screens += 1;
    state = afterSelect(state, cache.closure, statsOrder, count);
    if (screens === 1) poolAfterFirstScreen = state.bubble.length;
    expect(screens).toBeLessThan(5);
  }
  if (state.stage === 'pick') {
    let pick = pickStatus(state, cache.closure, statsOrder);
    while (pick.pair) {
      answer(cache, ...pick.pair);
      questions += 1;
      pick = pickStatus(state, cache.closure, statsOrder);
    }
    state = finishPick(state, pick);
  }
  return { state, questions, screens, poolAfterFirstScreen };
};

// Small deterministic PRNG so failures are reproducible
const createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A realistically noisy stats order: each player is typically `spread` places off
const noisyOrder = (pool: string[], spread: number, seed: number) => {
  const random = createRandom(seed);
  const noise = () =>
    Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  return pool
    .map((id) => ({ id, s: truth(id) + noise() * spread }))
    .sort((a, b) => a.s - b.s)
    .map(({ id }) => id);
};

describe('fieldBuilder', () => {
  it('settles exactly the true top N with one selection screen and few questions', () => {
    // 71 locks, 100 candidates for 29 spots
    const pool = ids(171);
    let total = 0;
    let screens = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const order = noisyOrder(pool, 10, seed);
      const run = build(pool, 100, order.filter((id) => truth(id) <= 71), order);
      expect(run.state.stage).toBe('done');
      expect(new Set(run.state.fieldIds)).toEqual(new Set(ids(100)));
      expect(run.state.cutIds).toHaveLength(71);
      total += run.questions;
      screens += run.screens;
    }
    // Simulated around 140 questions; the old cut-line rounds took ~180 just to pick
    expect(total / 8).toBeLessThan(175);
    expect(screens / 8).toBeLessThan(1.5);
  });

  it('stays exact when Game Score is rough or misjudges players badly', () => {
    const pool = ids(171);
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const order = noisyOrder(pool, 25, seed);
      // A few badly overrated players jump far up the stats order
      const overrated = ['p150', 'p140', 'p130'];
      const rest = order.filter((id) => !overrated.includes(id));
      const misjudged = [...rest.slice(0, 80), ...overrated, ...rest.slice(80)];
      const run = build(pool, 100, ids(60), misjudged);
      expect(new Set(run.state.fieldIds)).toEqual(new Set(ids(100)));
    }
  });

  it('takes the five references around the open spots plus a third, past the open spots', () => {
    const candidates = ids(100);
    // 29 spots + 10 buffer = #39: candidates #37-41
    expect(pickReferences(candidates, 29)).toEqual(['p37', 'p38', 'p39', 'p40', 'p41']);
    // Near the end of the pool the five slide up, never into the open spots
    expect(pickReferences(ids(35), 29)).toEqual(['p31', 'p32', 'p33', 'p34', 'p35']);
    // Too few past the open spots: no line, everyone goes to the last spots
    expect(pickReferences(ids(33), 29)).toEqual([]);
    const state = startRefs(createFieldState(31), ids(33), 0);
    expect(state).toMatchObject({ stage: 'pick', bubble: ids(33) });
  });

  it("makes the middle of the user's order the line, so an outlier can't be it", () => {
    const cache = createClosureCache();
    // By Game Score p37-p41; truly p41 is far better than the rest
    const order = [...ids(36), 'p41', 'p37', 'p38', 'p39', 'p40', ...ids(100).slice(41)];
    let state = startRefs(createFieldState(29), order, 0);
    expect(state.refs).toEqual(['p41', 'p37', 'p38', 'p39', 'p40']);
    let refs = refsStatus(state, cache.closure);
    while (refs.pair) {
      answer(cache, ...refs.pair);
      refs = refsStatus(state, cache.closure);
    }
    expect(refs.ranked).toEqual(['p37', 'p38', 'p39', 'p40', 'p41']);
    expect(lineOf(refs.ranked)).toBe('p39');
    state = startSelect(state, refs.ranked, 7);
    expect(state).toMatchObject({ stage: 'select', cutLine: 'p39' });
    expect(undoFloor(state)).toBe(7);
    // The other references are already placed against the line
    const status = selectStatus(state, cache.closure, order);
    expect(status.better).toEqual(['p37', 'p38']);
    expect(status.worse).toEqual(['p41', 'p40']);
    expect(status.open).toHaveLength(95);
  });

  it('cuts everyone not selected and sends the rest to the last spots', () => {
    const cache = createClosureCache();
    const pool = ids(100);
    let state = startSelect(startRefs(createFieldState(29), pool, 0), ['p37', 'p38', 'p39', 'p40', 'p41'], 0);
    const count = select(cache, state, pool);
    state = afterSelect(state, cache.closure, pool, count);
    // p1-p38 beat p39: 38 for 29 spots; p39 and below are cut
    expect(state).toMatchObject({ stage: 'pick', bubble: ids(38), roundStart: count });
    expect(state.cutIds).toHaveLength(62);
    expect(trimCount(state, cache.closure, pool)).toEqual({ total: 71, cut: 62, left: 9 });
  });

  it('a line inside the list settles him and everyone above, then asks about the rest against the next reference', () => {
    const cache = createClosureCache();
    const pool = ids(100);
    // The user's order puts p20 in the middle: he's inside the 29
    const ranked = ['p10', 'p15', 'p20', 'p50', 'p60'];
    for (let i = 0; i + 1 < ranked.length; i++) answer(cache, ranked[i], ranked[i + 1]);
    let state = {
      ...startRefs(createFieldState(29), pool, 0),
      refs: ['p50', 'p20', 'p10', 'p60', 'p15'],
    };
    state = startSelect(state, refsStatus(state, cache.closure).ranked, 4);
    expect(state.cutLine).toBe('p20');
    let count = 4 + select(cache, state, pool);
    state = afterSelect(state, cache.closure, pool, count);
    // p1-p19 and p20 are in; 9 spots left among p21-p100, against p50
    expect(state.inIds).toHaveLength(20);
    expect(state).toMatchObject({ stage: 'select', cutLine: 'p50', bubble: ids(100).slice(20) });
    expect(backupLine(state, cache.closure)).toBe('p60');
    count += select(cache, state, pool);
    state = afterSelect(state, cache.closure, pool, count);
    expect(state).toMatchObject({ stage: 'pick', bubble: ids(49).slice(20) });
    let pick = pickStatus(state, cache.closure, pool);
    while (pick.pair) {
      answer(cache, ...pick.pair);
      pick = pickStatus(state, cache.closure, pool);
    }
    state = finishPick(state, pick);
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(29)));
    expect(trimCount(state, cache.closure, pool).left).toBe(0);
  });

  it('settles at once when the line and those above fill the spots exactly', () => {
    const cache = createClosureCache();
    const pool = ids(60);
    let state = startSelect(startRefs(createFieldState(10), pool, 0), ['p8', 'p10', 'p12'], 0);
    state = { ...state, cutLine: 'p10' };
    const count = select(cache, state, pool);
    state = afterSelect(state, cache.closure, pool, count);
    expect(state.stage).toBe('done');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(10)));
    expect(state.cutIds).toHaveLength(50);
  });

  it('settles at once when the locks fill the list or everyone fits', () => {
    const full = startRefs({ ...createFieldState(3), locks: ['p1', 'p2', 'p3'] }, ids(10), 0);
    expect(full.stage).toBe('done');
    expect(full.fieldIds).toEqual(['p1', 'p2', 'p3']);
    expect(full.cutIds).toHaveLength(7);
    const fits = startRefs({ ...createFieldState(8), locks: ['p1'] }, ids(6), 0);
    expect(fits.stage).toBe('done');
    expect(fits.fieldIds).toHaveLength(6);
  });

  it('records the selection as answers against the line', () => {
    expect(selectionAnswers('x', ['a', 'b', 'c'], new Set(['b']))).toEqual([
      { winner: 'x', loser: 'a' },
      { winner: 'b', loser: 'x' },
      { winner: 'x', loser: 'c' },
    ]);
  });

  it('moves a list saved in the old cut-line rounds on to the references, locks kept', () => {
    const legacy: StoredFieldState = {
      ...createFieldState(10),
      stage: 'cut',
      locks: ['p1', 'p2'],
      round: 2,
      roundStart: 14,
      cutLine: 'p12',
      bubble: ids(30).slice(2),
      cutIds: ['p29'],
      refs: undefined,
    };
    const field = normalizeField(legacy, ids(30), 20);
    expect(field).toMatchObject({
      stage: 'refs',
      locks: ['p1', 'p2'],
      roundStart: 20,
      cutIds: [],
      refs: pickReferences(ids(30).slice(2), 8),
    });
    expect(field.round).toBeGreaterThan(2);
  });

  it('orders the pool by the saved order, then by score, then pool order', () => {
    const score = (id: string) => ({ b: 5, c: 9 })[id] ?? -Infinity;
    expect(poolBestFirst(['a', 'b', 'c', 'd'], score)).toEqual(['c', 'b', 'a', 'd']);
    expect(poolBestFirst(['a', 'b', 'c', 'd'], score, ['d', 'a'])).toEqual(['d', 'a', 'c', 'b']);
  });
});
