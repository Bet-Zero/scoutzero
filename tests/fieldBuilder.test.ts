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
  roundStatus,
  startBubble,
  undoFloor,
  type FieldState,
} from '@/features/ranker/utils/fieldBuilder';

// p1 is truly the best, p2 next, and so on; `statsOrder` is what the app
// believes (close to the truth but not equal) and drives cut-line suggestions
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const truth = (id: string) => Number(id.slice(1));

// Run the field builder to the end, answering every matchup truthfully
const build = (
  pool: string[],
  topN: number,
  locks: string[],
  statsOrder: string[] = pool,
  chooseCutLine?: (state: FieldState) => string | undefined
) => {
  const cache = createClosureCache();
  let comparisons = 0;
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
    while (status.next) {
      answer(status.next, state.cutLine as string);
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
      status = playoffStatus(state.playoff, cache.closure, statsOrder);
    }
    state = finishPlayoff(state, status.decided);
  }
  return { state, comparisons, rounds };
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
});
