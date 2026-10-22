// Drives Top-N sessions with a "perfect answer" oracle and checks the result
// is exactly the true top N in order, for every kind of setup hint.
import { describe, it, expect } from 'vitest';
import {
  assignRankerGroups,
  buildAnchorComparisons,
  buildLockInComparisons,
  createClosureCache,
  getSkipKey,
  suggestNextPair,
  type RankerComparison,
  type RankingGenerationOptions,
} from '@/features/ranker/utils/rankingEngine';
import {
  effectiveTopN,
  estimateTopNRemaining,
  manualCutIds,
  resolveTopN,
  suggestTopNPair,
} from '@/features/ranker/utils/topNSelection';

const createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

type Mode = { topN: number } | { full: true };

const runSession = (
  truth: string[],
  setup: RankingGenerationOptions,
  mode: Mode,
  random: () => number
) => {
  const players = shuffle(truth, random).map((id) => ({ id }));
  const rank = (id: string) => truth.indexOf(id);
  const cache = createClosureCache();
  const results: RankerComparison[] = [];
  const record = (c: RankerComparison) => {
    if (cache.addEdge(c.winner, c.loser)) results.push(c);
  };
  buildLockInComparisons(players, setup).forEach(record);
  if (setup.anchor) {
    const anchor = setup.anchor;
    const others = players.filter(
      (p) => p.id !== anchor && p.id !== setup.firstPlace && p.id !== setup.lastPlace
    );
    const better = others.filter((p) => rank(p.id) < rank(anchor)).map((p) => p.id);
    buildAnchorComparisons(anchor, others, better).forEach(record);
  }
  const seeds = results.length;

  for (let guard = 0; guard < 20000; guard++) {
    const grouped = assignRankerGroups(players, results, setup);
    const pair =
      'topN' in mode
        ? suggestTopNPair(grouped, mode.topN, cache.closure)
        : suggestNextPair(results, grouped, { closureCache: cache });
    if (!pair.length) {
      return { picks: results.length - seeds, grouped };
    }
    const [a, b] = pair;
    record(rank(a.id) < rank(b.id) ? { winner: a.id, loser: b.id } : { winner: b.id, loser: a.id });
  }
  throw new Error('session did not finish');
};

const randomSetup = (truth: string[], random: () => number): RankingGenerationOptions => {
  const ids = shuffle(truth, random);
  const firstPlace = random() < 0.3 ? truth[0] : null;
  const lastPlace = random() < 0.3 ? truth[truth.length - 1] : null;
  const free = ids.filter((id) => id !== firstPlace && id !== lastPlace);
  const anchor = random() < 0.4 ? free.pop() ?? null : null;
  // Tags are roughly right but sometimes wrong
  const topTier = free.filter((id) => truth.indexOf(id) < truth.length / 3 ? random() < 0.5 : random() < 0.05);
  const bottomTier = free.filter((id) => !topTier.includes(id) && (truth.indexOf(id) > (2 * truth.length) / 3 ? random() < 0.5 : random() < 0.05));
  return { topTier, bottomTier, anchor, firstPlace, lastPlace };
};

describe('Top-N selection', () => {
  it('returns exactly the true top N in order and cuts everyone else, with any setup hints and skips', () => {
    const random = createRandom(11);
    for (let trial = 0; trial < 300; trial++) {
      const size = 3 + Math.floor(random() * 30);
      const topN = 1 + Math.floor(random() * (size - 1));
      const truth = Array.from({ length: size }, (_, i) => `p${i}`);
      const setup = randomSetup(truth, random);
      const players = shuffle(truth, random).map((id) => ({ id }));
      const rank = (id: string) => truth.indexOf(id);
      const cache = createClosureCache();
      const results: RankerComparison[] = [];
      const record = (c: RankerComparison) => {
        if (cache.addEdge(c.winner, c.loser)) results.push(c);
      };
      buildLockInComparisons(players, setup).forEach(record);
      if (setup.anchor) {
        const anchor = setup.anchor;
        const others = players.filter(
          (p) => p.id !== anchor && p.id !== setup.firstPlace && p.id !== setup.lastPlace
        );
        buildAnchorComparisons(anchor, others, others.filter((p) => rank(p.id) < rank(anchor)).map((p) => p.id)).forEach(record);
      }
      const skipped = new Set<string>();
      for (let step = 0; ; step++) {
        const grouped = assignRankerGroups(players, results, setup);
        const pair = suggestTopNPair(grouped, topN, cache.closure, skipped);
        if (!pair.length) break;
        const [a, b] = pair;
        // Every third session skips every fourth matchup once
        if (trial % 3 === 0 && step % 4 === 0 && !skipped.has(getSkipKey(a.id, b.id))) {
          skipped.add(getSkipKey(a.id, b.id));
          continue;
        }
        skipped.clear();
        record(rank(a.id) < rank(b.id) ? { winner: a.id, loser: b.id } : { winner: b.id, loser: a.id });
      }
      const final = resolveTopN(assignRankerGroups(players, results, setup), topN, cache.closure);
      expect(final.ranked.map((p) => p.id)).toEqual(truth.slice(0, topN));
      expect(final.cut.map((p) => p.id).sort()).toEqual(truth.slice(topN).sort());
      expect(final.pending).toEqual([]);
      expect(estimateTopNRemaining(final, topN)).toBe(0);
    }
  });

  it('needs fewer matchups than a full ranking', () => {
    const random = createRandom(3);
    let full = 0;
    let top = 0;
    for (let trial = 0; trial < 20; trial++) {
      const truth = Array.from({ length: 42 }, (_, i) => `p${i}`);
      const seed = Math.floor(random() * 1e9);
      full += runSession(truth, {}, { full: true }, createRandom(seed)).picks;
      top += runSession(truth, {}, { topN: 20 }, createRandom(seed)).picks;
    }
    expect(top).toBeLessThan(full * 0.8);
  });

  it('cuts a last-place lock-in without asking about them', () => {
    const players = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    const cache = createClosureCache();
    buildLockInComparisons(players, { lastPlace: 'd' }).forEach((c) =>
      cache.addEdge(c.winner, c.loser)
    );
    const resolution = resolveTopN(players, 2, cache.closure);
    expect(resolution.cut.map((p) => p.id)).toEqual(['d']);
    expect(resolution.nextPair.map((p) => p.id)).not.toContain('d');
  });

  it('offers a skipped matchup again when nothing else is left', () => {
    const players = [{ id: 'a' }, { id: 'b' }];
    const cache = createClosureCache();
    const skipped = new Set([getSkipKey('a', 'b')]);
    expect(suggestTopNPair(players, 1, cache.closure, skipped).map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('only trims when N is smaller than the pool', () => {
    expect(effectiveTopN(10, 26)).toBe(10);
    expect(effectiveTopN(26, 26)).toBeNull();
    expect(effectiveTopN(0, 26)).toBeNull();
    expect(effectiveTopN(null, 26)).toBeNull();
    expect(effectiveTopN(2.5, 26)).toBeNull();
  });

  it('cuts hand-picked players without any matchups and still finds the top N', () => {
    const random = createRandom(5);
    for (let trial = 0; trial < 100; trial++) {
      const truth = Array.from({ length: 20 }, (_, i) => `p${i}`);
      const players = shuffle(truth, random).map((id) => ({ id }));
      // The user rules out a handful who really don't make a Top 5
      const outs = new Set(shuffle(truth.slice(5), random).slice(0, 8));
      const rank = (id: string) => truth.indexOf(id);
      const cache = createClosureCache();
      for (;;) {
        const pair = suggestTopNPair(players, 5, cache.closure, new Set(), outs);
        if (!pair.length) break;
        const [a, b] = pair;
        expect(outs.has(a.id) || outs.has(b.id)).toBe(false);
        const [w, l] = rank(a.id) < rank(b.id) ? [a, b] : [b, a];
        cache.addEdge(w.id, l.id);
      }
      const final = resolveTopN(players, 5, cache.closure, new Set(), outs);
      expect(final.ranked.map((p) => p.id)).toEqual(truth.slice(0, 5));
      expect(final.cut).toHaveLength(15);
    }
  });

  it('collects hand cuts from every cut action', () => {
    expect([...manualCutIds([{ ids: ['a'], at: -1 }, { ids: ['b', 'c'], at: 4 }])]).toEqual(['a', 'b', 'c']);
    expect(manualCutIds(undefined).size).toBe(0);
  });

  it("a hand-cut player doesn't push anyone else out", () => {
    // Top 2 of A, B, C with A > C and B > C known; the user cuts A
    const players = ['a', 'b', 'c'].map((id) => ({ id }));
    const cache = createClosureCache();
    cache.addEdge('a', 'c');
    cache.addEdge('b', 'c');
    const resolution = resolveTopN(players, 2, cache.closure, new Set(), new Set(['a']));
    expect(resolution.cut.map((p) => p.id)).toEqual(['a']);
    expect(resolution.ranked.map((p) => p.id)).toEqual(['b', 'c']);
  });
});
