// Drives whole ranker sessions with a "perfect answer" oracle and checks the
// final order matches the true order for every kind of setup hint.
import { describe, it, expect } from 'vitest';
import {
  assignRankerGroups,
  buildAnchorComparisons,
  buildLockInComparisons,
  createClosureCache,
  generateRankingFromComparisons,
  suggestNextPair,
  type RankerComparison,
  type RankingGenerationOptions,
} from '@/features/ranker/utils/rankingEngine';

// Small deterministic PRNG so failures are reproducible
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

const runSession = (
  truth: string[],
  setup: RankingGenerationOptions,
  random: () => number
) => {
  const players = shuffle(truth, random).map((id) => ({ id }));
  const rank = (id: string) => truth.indexOf(id);
  const answer = (a: string, b: string): RankerComparison =>
    rank(a) < rank(b) ? { winner: a, loser: b } : { winner: b, loser: a };

  const cache = createClosureCache();
  const results: RankerComparison[] = [];
  const record = (c: RankerComparison) => {
    if (cache.addEdge(c.winner, c.loser)) results.push(c);
  };

  buildLockInComparisons(players, setup).forEach(record);
  if (setup.anchor) {
    const anchor = setup.anchor;
    const tagged = new Set(
      [
        ...(setup.topTier ?? []),
        ...(setup.bottomTier ?? []),
        setup.firstPlace,
        setup.lastPlace,
      ].filter(Boolean)
    );
    const untagged = players.filter((p) => p.id !== anchor && !tagged.has(p.id));
    const better = untagged.filter((p) => rank(p.id) < rank(anchor)).map((p) => p.id);
    buildAnchorComparisons(anchor, untagged, better).forEach(record);
  }

  let asked = 0;
  for (;;) {
    const pair = suggestNextPair(results, assignRankerGroups(players, results, setup), {
      closureCache: cache,
    });
    if (pair.length === 0) break;
    const result = answer(pair[0].id, pair[1].id);
    expect(cache.addEdge(result.winner, result.loser)).toBe(true);
    results.push(result);
    asked++;
    if (asked > 1000) throw new Error('session did not finish');
  }

  return {
    order: generateRankingFromComparisons(results, players, setup).map((p) => p.id),
    asked,
  };
};

const TRUTH = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('ranker sessions end to end', () => {
  const cases: Array<[string, RankingGenerationOptions]> = [
    ['no hints', {}],
    ['anchor only', { anchor: 'd' }],
    ['correct tiers', { topTier: ['a', 'b'], bottomTier: ['g', 'h'] }],
    ['top tier with a wrong tag', { topTier: ['a', 'c'] }],
    ['wrong top tag plus anchor', { topTier: ['a', 'c'], anchor: 'e' }],
    ['wrong bottom tag plus anchor', { bottomTier: ['f', 'h'], anchor: 'd' }],
    ['#1 lock-in', { firstPlace: 'a' }],
    ['#1 lock-in plus top tier', { firstPlace: 'a', topTier: ['b'] }],
    ['last-place lock-in plus bottom tier', { lastPlace: 'h', bottomTier: ['g'] }],
    [
      'last-place lock-in, bottom tier and anchor',
      { lastPlace: 'h', bottomTier: ['g'], anchor: 'd' },
    ],
    ['tiers completely backwards', { topTier: ['g', 'h'], bottomTier: ['a', 'b'] }],
    ['backwards tiers plus anchor', { topTier: ['h'], bottomTier: ['a'], anchor: 'c' }],
  ];

  it.each(cases)('produces the true order: %s', (_label, setup) => {
    const { order } = runSession(TRUTH, setup, createRandom(7));
    expect(order).toEqual(TRUTH);
  });

  it('correct tiers save comparisons compared with no hints', () => {
    const plain = runSession(TRUTH, {}, createRandom(3));
    const tiered = runSession(
      TRUTH,
      { topTier: ['a', 'b'], bottomTier: ['g', 'h'] },
      createRandom(3)
    );
    expect(tiered.asked).toBeLessThan(plain.asked);
  });

  it('stays exact across random pools and random (often wrong) tier tags', () => {
    const random = createRandom(2026);
    for (let run = 0; run < 300; run++) {
      const size = 3 + (run % 18);
      const truth = Array.from({ length: size }, (_, i) => `p${i}`);
      const pool = shuffle(truth, random);
      const take = () => pool.splice(Math.floor(random() * pool.length), 1)[0];
      const cap = Math.max(1, Math.round(size * 0.25));
      const setup: RankingGenerationOptions = {};
      // Lock-ins are statements of fact, so they are always truthful here
      if (random() < 0.3) {
        setup.firstPlace = truth[0];
        pool.splice(pool.indexOf(truth[0]), 1);
      }
      if (random() < 0.3) {
        setup.lastPlace = truth[size - 1];
        pool.splice(pool.indexOf(truth[size - 1]), 1);
      }
      if (random() < 0.5 && pool.length > 0) setup.anchor = take();
      setup.topTier = Array.from({ length: Math.floor(random() * (cap + 1)) }, take).filter(
        Boolean
      );
      setup.bottomTier = Array.from(
        { length: Math.floor(random() * (cap + 1)) },
        take
      ).filter(Boolean);

      expect(runSession(truth, setup, random).order).toEqual(truth);
    }
  });
});
