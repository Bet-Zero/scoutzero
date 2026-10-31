import { describe, expect, it } from 'vitest';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';
import {
  createFieldState,
  finishCut,
  finishPlayoff,
  lowerCutLine,
  nextRound,
  planCut,
  playoffStatus,
  poolBestFirst,
  quickSort,
  quickSortAnswers,
  roundStatus,
  startBubble,
  trimCount,
  undoFloor,
  type FieldState,
} from '@/features/ranker/utils/fieldBuilder';

// p1 is truly the best, p2 next, and so on; `statsOrder` is what the app
// believes (close to the truth but not equal) and drives cut-line suggestions
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const truth = (id: string) => Number(id.slice(1));

// Run the field builder to the end, answering every matchup truthfully.
// With `quick`, each round starts with the quick sort, where the user moves
// exactly the players stats put on the wrong side; `taps` counts what the
// user does (answers, moves and confirms).
const build = (
  pool: string[],
  topN: number,
  locks: string[],
  statsOrder: string[] = pool,
  chooseCutLine?: (state: FieldState) => string | undefined,
  quick = false
) => {
  const cache = createClosureCache();
  let comparisons = 0;
  let playoffAnswers = 0;
  let taps = 0;
  const answer = (a: string, b: string) => {
    const [w, l] = truth(a) < truth(b) ? [a, b] : [b, a];
    expect(cache.addEdge(w, l)).toBe(true);
    comparisons += 1;
  };
  let state: FieldState = { ...createFieldState(topN), locks };
  state = startBubble(state, statsOrder, comparisons, undefined);
  if (chooseCutLine && state.stage === 'cut')
    state = { ...state, cutLine: chooseCutLine(state) ?? state.cutLine };
  let rounds = 0;
  while (state.stage === 'cut') {
    let status = roundStatus(state, cache.closure, statsOrder);
    const sort = quick ? quickSort(state, status, statsOrder) : null;
    if (sort) {
      const cutLine = state.cutLine as string;
      const wrongSide = (id: string, above: boolean) =>
        truth(id) < truth(cutLine) !== above;
      const moved = new Set([
        ...sort.above.filter((id) => wrongSide(id, true)),
        ...sort.below.filter((id) => wrongSide(id, false)),
      ]);
      taps += moved.size + 1;
      for (const a of quickSortAnswers(cutLine, sort, moved))
        if (cache.addEdge(a.winner, a.loser)) comparisons += 1;
      state = { ...state, sortedAt: comparisons };
      status = roundStatus(state, cache.closure, statsOrder);
      // Every clear call is placed: only close calls are left to ask
      if (status.next) expect(sort.close).toContain(status.next);
    }
    while (status.next) {
      answer(status.next, state.cutLine as string);
      taps += 1;
      status = roundStatus(state, cache.closure, statsOrder);
    }
    rounds += 1;
    const plan = planCut(state, status, cache.closure, statsOrder);
    // Always take the suggested next step, as a user tapping the main button would
    if (plan.next === 'lower')
      state = lowerCutLine(state, status, statsOrder, comparisons);
    else if (plan.next === 'round')
      state = nextRound(state, status, plan, comparisons);
    else state = finishCut(state, status, plan, comparisons);
    expect(rounds).toBeLessThan(12);
  }
  if (state.stage === 'playoff' && state.playoff) {
    let status = playoffStatus(state.playoff, cache.closure, statsOrder);
    while (status.pair) {
      answer(status.pair[0], status.pair[1]);
      playoffAnswers += 1;
      taps += 1;
      status = playoffStatus(state.playoff, cache.closure, statsOrder);
    }
    state = finishPlayoff(state, status.decided);
  }
  return { state, comparisons, rounds, playoffAnswers, taps };
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

// A slightly shuffled stats order: neighbours swapped
const nearlySorted = (pool: string[]) => {
  const order = [...pool];
  for (let i = 0; i + 1 < order.length; i += 3)
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
  return order;
};

describe('fieldBuilder', () => {
  it('settles exactly the true top N, keeping the locks', () => {
    const pool = ids(180);
    const { state, comparisons } = build(
      pool,
      100,
      ids(55),
      nearlySorted(pool)
    );
    expect(state.stage).toBe('done');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(100)));
    expect(state.cutIds).toHaveLength(80);
    // Far fewer answers than ranking 180 players for 100 spots
    expect(comparisons).toBeLessThan(200);
  });

  it('keeps the playoff short when a big bubble lands just over the open spots', () => {
    // 110 survivors for 100 spots: the playoff must drop 10. Pitting one
    // player against everyone used to cost over 1,000 answers here.
    const pool = ids(150);
    const { state, playoffAnswers } = build(pool, 100, [], noisyOrder(pool, 8, 39695));
    expect(state.stage).toBe('done');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(100)));
    expect(playoffAnswers).toBeGreaterThan(0);
    expect(playoffAnswers).toBeLessThan(250);
  });

  it('drops the weakest survivors in the playoff when too many beat the cut line', () => {
    const pool = ids(60);
    // A low cut line: p30 is chosen when 15 spots are open after 5 locks
    const { state } = build(pool, 20, ids(5), pool, () => 'p30');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(20)));
  });

  it('brings back the best of the cut when the cut line was too high', () => {
    const pool = ids(60);
    const statsOrder = nearlySorted(pool);
    // A high cut line: p10 when 15 spots are open; lowering it settles the rest
    const { state } = build(pool, 20, ids(5), statsOrder, () => 'p10');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(20)));
  });

  it('adds back players in the playoff when a round leaves too few', () => {
    const cache = createClosureCache();
    const pool = ids(30);
    let state: FieldState = { ...createFieldState(10), locks: ids(2) };
    state = startBubble(state, pool, 0, 'p6');
    let status = roundStatus(state, cache.closure, pool);
    while (status.next) {
      const [w, l] =
        truth(status.next) < truth('p6')
          ? [status.next, 'p6']
          : ['p6', status.next];
      cache.addEdge(w, l);
      status = roundStatus(state, cache.closure, pool);
    }
    // p3-p5 beat p6: 4 survivors (with p6) for 8 spots, so 4 come back
    state = finishCut(
      state,
      status,
      planCut(state, status, cache.closure, pool),
      28
    );
    expect(state.stage).toBe('playoff');
    expect(state.playoff).toMatchObject({ mode: 'add', count: 4 });
    expect(undoFloor(state)).toBe(28);
    let po = playoffStatus(state.playoff!, cache.closure, pool);
    while (po.pair) {
      const [a, b] = po.pair;
      cache.addEdge(truth(a) < truth(b) ? a : b, truth(a) < truth(b) ? b : a);
      po = playoffStatus(state.playoff!, cache.closure, pool);
    }
    state = finishPlayoff(state, po.decided);
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(10)));
    expect(state.cutIds).not.toContain('p7');
  });

  it('orders the pool by the saved order, then by score, then pool order', () => {
    const score = (id: string) => ({ b: 5, c: 9 })[id] ?? -Infinity;
    expect(poolBestFirst(['a', 'b', 'c', 'd'], score)).toEqual(['c', 'b', 'a', 'd']);
    // A saved order wins; players it doesn't cover follow by score
    expect(poolBestFirst(['a', 'b', 'c', 'd'], score, ['d', 'a'])).toEqual(['d', 'a', 'c', 'b']);
  });

  it('settles at once when the locks fill the list or everyone fits', () => {
    const full = startBubble(
      { ...createFieldState(3), locks: ['p1', 'p2', 'p3'] },
      ids(10),
      0
    );
    expect(full.stage).toBe('done');
    expect(full.fieldIds).toEqual(['p1', 'p2', 'p3']);
    expect(full.cutIds).toHaveLength(7);

    const fits = startBubble(
      { ...createFieldState(8), locks: ['p1'] },
      ids(6),
      0
    );
    expect(fits.stage).toBe('done');
    expect(fits.fieldIds).toHaveLength(6);
  });

  it('settles without a playoff when the only extra survivor is the cut line itself', () => {
    const cache = createClosureCache();
    const pool = ids(20);
    let state = startBubble(
      { ...createFieldState(10), locks: ids(3) },
      pool,
      0,
      'p11'
    );
    let status = roundStatus(state, cache.closure, pool);
    while (status.next) {
      const [w, l] =
        truth(status.next) < 11 ? [status.next, 'p11'] : ['p11', status.next];
      cache.addEdge(w, l);
      status = roundStatus(state, cache.closure, pool);
    }
    // p4-p10 beat p11: 8 survivors with p11 for 7 spots, and p11 is below all 7
    const plan = planCut(state, status, cache.closure, pool);
    expect(plan).toMatchObject({ next: 'done', sureOut: ['p11'] });
    state = finishCut(state, status, plan, 17);
    expect(state.stage).toBe('done');
    expect(new Set(state.fieldIds)).toEqual(new Set(ids(10)));
    expect(state.cutIds).toContain('p11');
  });

  it('never loops between a high and a low cut line: settled players step aside', () => {
    // 45 spots; a high cut line leaves too few, the lowered one too many.
    // Re-suggesting the high cut line would ask nothing new, forever.
    const pool = ids(120);
    const cache = createClosureCache();
    let comparisons = 0;
    const answerRound = (state: FieldState) => {
      let status = roundStatus(state, cache.closure, pool);
      while (status.next) {
        const [a, b] = [status.next, state.cutLine as string];
        cache.addEdge(truth(a) < truth(b) ? a : b, truth(a) < truth(b) ? b : a);
        comparisons += 1;
        status = roundStatus(state, cache.closure, pool);
      }
      return status;
    };
    let state = startBubble(
      { ...createFieldState(100), locks: ids(55) },
      pool,
      0,
      'p96'
    );
    let status = answerRound(state);
    expect(planCut(state, status, cache.closure, pool).next).toBe('lower');
    state = lowerCutLine(state, status, pool, comparisons, 'p107');
    status = answerRound(state);
    const plan = planCut(state, status, cache.closure, pool);
    // p56-p95 beat p96 and p96 beat p97-p106: 41 in for sure, p107 out, 10 open for 4 spots
    expect(plan.sureIn).toHaveLength(41);
    expect(plan.sureOut).toEqual(['p107']);
    expect(plan.open).toEqual(ids(106).slice(96));
    expect(plan.spots).toBe(4);
    expect(plan.cutLine).not.toBe('p96');
    if (plan.next === 'round') {
      state = nextRound(state, status, plan, comparisons);
      expect(state.bubble).toEqual(plan.open);
    }
  });

  it('quick sort settles the same exact field with far fewer taps', () => {
    for (const [topN, poolSize, locks, spread] of [
      [25, 55, 8, 4],
      [50, 95, 15, 8],
      [100, 170, 40, 15],
    ]) {
      let plainTaps = 0;
      let quickTaps = 0;
      for (const seed of [11, 22, 33, 44, 55]) {
        const pool = ids(poolSize);
        const order = noisyOrder(pool, spread, seed * topN);
        const plain = build(pool, topN, ids(locks), order);
        const quick = build(pool, topN, ids(locks), order, undefined, true);
        expect(new Set(quick.state.fieldIds)).toEqual(new Set(ids(topN)));
        plainTaps += plain.comparisons;
        quickTaps += quick.taps;
      }
      // Simulation: roughly half the taps; pin a clear margin
      expect(quickTaps).toBeLessThan(plainTaps * 0.7);
    }
  });

  it('quick sort places only players far from the cut line, once per round', () => {
    const cache = createClosureCache();
    const pool = ids(20);
    // p6 is the cut line for 5 spots; the window is 4 places either side
    let state = startBubble(createFieldState(5), pool, 0);
    expect(state.cutLine).toBe('p6');
    const status = roundStatus(state, cache.closure, pool);
    const sort = quickSort(state, status, pool);
    expect(sort).toEqual({
      above: ['p1'],
      below: ids(20).slice(10),
      close: ['p2', 'p3', 'p4', 'p5', 'p7', 'p8', 'p9', 'p10'],
    });
    // Done for this round: not offered again, and undo stops after it
    state = { ...state, sortedAt: 11 };
    expect(quickSort(state, status, pool)).toBeNull();
    expect(undoFloor(state)).toBe(11);
    // Too few clear calls for a list: everyone is asked head to head
    const small = startBubble(createFieldState(4), ids(10), 0);
    expect(quickSort(small, roundStatus(small, cache.closure, ids(10)), ids(10))).toBeNull();
  });

  it("quick sort answers put the user's moves first, so a clash keeps the user's call", () => {
    const sort = { above: ['a', 'b'], below: ['y', 'z'], close: [] };
    expect(quickSortAnswers('c', sort, new Set(['b', 'y']))).toEqual([
      { winner: 'c', loser: 'b' },
      { winner: 'y', loser: 'c' },
      { winner: 'a', loser: 'c' },
      { winner: 'c', loser: 'z' },
    ]);
    // An earlier answer says z beat y. Moving z up while y stays below by
    // stats can't both hold: z's move is kept and y follows from it.
    const cache = createClosureCache();
    cache.addEdge('y', 'z');
    const added = quickSortAnswers('c', { above: [], below: ['y', 'z'], close: [] }, new Set(['z']))
      .filter((a) => cache.addEdge(a.winner, a.loser));
    expect(added).toEqual([{ winner: 'z', loser: 'c' }]);
    expect(cache.closure.y?.has('c')).toBe(true);
  });

  it('a new round or the playoff starts without the quick sort mark', () => {
    const cache = createClosureCache();
    const pool = ids(40);
    let state = startBubble(createFieldState(10), pool, 0, 'p30');
    let status = roundStatus(state, cache.closure, pool);
    while (status.next) {
      cache.addEdge(status.next, 'p30');
      status = roundStatus(state, cache.closure, pool);
    }
    state = { ...state, sortedAt: 5 };
    const plan = planCut(state, status, cache.closure, pool);
    expect('sortedAt' in nextRound(state, status, plan, 39)).toBe(false);
    expect('sortedAt' in lowerCutLine(state, status, pool, 39)).toBe(false);
    expect('sortedAt' in finishCut(state, status, plan, 39)).toBe(false);
  });

  it('counts the players left to trim at every step', () => {
    const cache = createClosureCache();
    const pool = ids(30);
    let state: FieldState = { ...createFieldState(10), locks: ids(2) };
    expect(trimCount(state, cache.closure, pool)).toEqual({ total: 20, cut: 0, left: 20 });
    // A high cut line: p6 beats p7-p30, so 24 are out mid-round, 4 too many
    state = startBubble(state, pool, 0, 'p6');
    let status = roundStatus(state, cache.closure, pool);
    while (status.next) {
      const [w, l] = truth(status.next) < 6 ? [status.next, 'p6'] : ['p6', status.next];
      cache.addEdge(w, l);
      status = roundStatus(state, cache.closure, pool);
    }
    expect(trimCount(state, cache.closure, pool)).toEqual({ total: 20, cut: 24, left: -4 });
    // The playoff brings 4 back; each one decided counts down
    state = finishCut(state, status, planCut(state, status, cache.closure, pool), 28);
    expect(state.playoff).toMatchObject({ mode: 'add', count: 4 });
    expect(trimCount(state, cache.closure, pool).left).toBe(-4);
    let po = playoffStatus(state.playoff!, cache.closure, pool);
    while (po.pair) {
      const [a, b] = po.pair;
      cache.addEdge(truth(a) < truth(b) ? a : b, truth(a) < truth(b) ? b : a);
      po = playoffStatus(state.playoff!, cache.closure, pool);
    }
    expect(trimCount(state, cache.closure, pool).left).toBe(0);
    state = finishPlayoff(state, po.decided);
    expect(trimCount(state, cache.closure, pool)).toEqual({ total: 20, cut: 20, left: 0 });
  });
});
