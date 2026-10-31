import { describe, it, expect } from 'vitest';
import {
  assignRankerGroups,
  generateRankingFromComparisons,
  suggestNextPair,
  createClosureCache,
  type RankerComparison,
} from '@/features/ranker/utils/rankingEngine';

const players = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
  { id: '3', name: 'C' },
];

describe('ranking engine', () => {
  it('ranks players using dominance scores', () => {
    const comparisons = [
      { winner: '1', loser: '2' },
      { winner: '1', loser: '3' },
      { winner: '2', loser: '3' },
    ];
    const ranking = generateRankingFromComparisons(comparisons, players);
    expect(ranking[0].id).toBe('1');
    expect(ranking[1].id).toBe('2');
    expect(ranking[2].id).toBe('3');
  });

  it('suggests pair with least comparisons', () => {
    const comparisons = [{ winner: '1', loser: '2' }];
    const pair = suggestNextPair(comparisons, players);
    const ids = pair.map((p) => p.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  it('lets players break out of a wrong tier cutoff and slide into place', () => {
    // Truth: 1 > 3 > 2 > 4, but 2 was tagged top tier and 3 was not
    const tiered = [
      { id: '1', group: 'top' },
      { id: '2', group: 'top' },
      { id: '3', group: 'upper' },
      { id: '4', group: 'upper' },
    ];
    const comps = [
      { winner: '1', loser: '2' },
      { winner: '3', loser: '4' },
    ];

    // Edge check: worst of top vs best of the tier below
    expect(suggestNextPair(comps, tiered).map((p) => p.id)).toEqual(['2', '3']);
    comps.push({ winner: '3', loser: '2' });

    // 3 broke out, so it keeps climbing and 2 keeps sinking until both lose/win
    const next = suggestNextPair(comps, tiered).map((p) => p.id).sort();
    expect([['1', '3'], ['2', '4']]).toContainEqual(next);
    comps.push({ winner: '1', loser: '3' }, { winner: '2', loser: '4' });

    expect(suggestNextPair(comps, tiered)).toEqual([]);
    expect(
      generateRankingFromComparisons(comps, tiered).map((p) => p.id)
    ).toEqual(['1', '3', '2', '4']);
  });

  it('enforces group isolation with boundary stitching', () => {
    const groupPlayers = [
      { id: '1', name: 'T1', group: 'top' },
      { id: '2', name: 'T2', group: 'top' },
      { id: '3', name: 'U1', group: 'upper' },
      { id: '4', name: 'U2', group: 'upper' },
      { id: '5', name: 'A', group: 'anchor' },
      { id: '6', name: 'L1', group: 'lower' },
      { id: '7', name: 'L2', group: 'lower' },
      { id: '8', name: 'B1', group: 'bottom' },
      { id: '9', name: 'B2', group: 'bottom' },
    ];

    // First suggestion should be within a single group
    const first = suggestNextPair([], groupPlayers);
    expect(first[0].group).toBe(first[1].group);

    // Resolve internal group matchups
    const comps = [
      { winner: '1', loser: '2' },
      { winner: '3', loser: '4' },
      { winner: '6', loser: '7' },
      { winner: '8', loser: '9' },
      // Anchor answers: upper players beat the anchor, lower players lose
      { winner: '3', loser: '5' },
      { winner: '4', loser: '5' },
      { winner: '5', loser: '6' },
      { winner: '5', loser: '7' },
    ];

    const boundary1 = suggestNextPair(comps, groupPlayers);
    expect(new Set(boundary1.map((p) => p.group))).toEqual(
      new Set(['top', 'upper'])
    );
    expect(boundary1.map((p) => p.id).sort()).toEqual(['2', '3']);
    comps.push({ winner: boundary1[0].id, loser: boundary1[1].id });

    const boundary2 = suggestNextPair(comps, groupPlayers);
    expect(new Set(boundary2.map((p) => p.group))).toEqual(
      new Set(['lower', 'bottom'])
    );
    expect(boundary2.map((p) => p.id).sort()).toEqual(['7', '8']);
    comps.push({ winner: boundary2[0].id, loser: boundary2[1].id });

    expect(suggestNextPair(comps, groupPlayers)).toEqual([]);
  });
});

// ========== Safety Belts Tests ==========

describe('closure cache safety belts', () => {
  it('rejects cycles: addEdge returns false if edge would create cycle', () => {
    const cache = createClosureCache();
    // Add A > B and B > C
    expect(cache.addEdge('A', 'B')).toBe(true);
    expect(cache.addEdge('B', 'C')).toBe(true);
    // Now C > A would create a cycle (C -> A -> B -> C)
    expect(cache.addEdge('C', 'A')).toBe(false);
  });

  it('rejects non-string IDs', () => {
    const cache = createClosureCache();
    // Numbers should be rejected
    expect(cache.addEdge(1, 2)).toBe(false);
    // null/undefined should be rejected
    expect(cache.addEdge(null, 'A')).toBe(false);
    expect(cache.addEdge('A', undefined)).toBe(false);
    // Objects should be rejected
    expect(cache.addEdge({ id: 'A' }, 'B')).toBe(false);
  });

  it('rejects self-comparison', () => {
    const cache = createClosureCache();
    expect(cache.addEdge('A', 'A')).toBe(false);
  });

  it('rejects duplicate edges (returns false)', () => {
    const cache = createClosureCache();
    expect(cache.addEdge('A', 'B')).toBe(true);
    expect(cache.addEdge('A', 'B')).toBe(false); // already exists
  });

  it('rebuild produces same closure as incremental edges', () => {
    const comparisons = [
      { winner: 'A', loser: 'B' },
      { winner: 'B', loser: 'C' },
      { winner: 'A', loser: 'D' },
      { winner: 'D', loser: 'C' },
    ];

    // Build incrementally
    const incremental = createClosureCache();
    comparisons.forEach(({ winner, loser }) =>
      incremental.addEdge(winner, loser)
    );

    // Build via rebuild
    const rebuilt = createClosureCache();
    rebuilt.rebuild(comparisons);

    // Both should have same closure structure
    expect([...incremental.closure['A']].sort()).toEqual(
      [...rebuilt.closure['A']].sort()
    );
    expect([...incremental.closure['B']].sort()).toEqual(
      [...rebuilt.closure['B']].sort()
    );
    expect([...incremental.closure['D']].sort()).toEqual(
      [...rebuilt.closure['D']].sort()
    );
  });

  it('closure correctly tracks transitive reachability', () => {
    const cache = createClosureCache();
    cache.addEdge('A', 'B');
    cache.addEdge('B', 'C');
    cache.addEdge('C', 'D');

    // A should reach B, C, D
    expect(cache.closure['A'].has('B')).toBe(true);
    expect(cache.closure['A'].has('C')).toBe(true);
    expect(cache.closure['A'].has('D')).toBe(true);

    // B should reach C, D but not A
    expect(cache.closure['B'].has('C')).toBe(true);
    expect(cache.closure['B'].has('D')).toBe(true);
    expect(cache.closure['B']?.has('A')).toBeFalsy();
  });

  describe('a Top-N field: locks above, the open-spot winners as their own section', () => {
    // Rank to the end with truthful answers; `rank` maps id to true place
    const rankAll = (ids: string[], bubble: string[], known: RankerComparison[], rank: Record<string, number>) => {
      const cache = createClosureCache();
      const results = [...known];
      cache.rebuild(results);
      const asked: Array<[string, string]> = [];
      for (let i = 0; i < 200; i++) {
        const players = assignRankerGroups(ids.map((id) => ({ id })), results, { bubble });
        const pair = suggestNextPair(results, players, { closureCache: cache });
        if (!pair.length) break;
        const [a, b] = [pair[0].id, pair[1].id];
        asked.push([a, b]);
        const [w, l] = rank[a] < rank[b] ? [a, b] : [b, a];
        cache.addEdge(w, l);
        results.push({ winner: w, loser: l });
      }
      const order = generateRankingFromComparisons(results, ids.map((id) => ({ id })), { bubble }).map((p) => p.id);
      return { asked, order };
    };
    const locks = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const bubble = ['B1', 'B2', 'B3'];
    // The open spots come ranked: B1 > B2 > B3
    const bubbleOrder = [
      { winner: 'B1', loser: 'B2' },
      { winner: 'B2', loser: 'B3' },
    ];
    const crossings = (asked: Array<[string, string]>) =>
      asked.filter(([a, b]) => a.startsWith('L') !== b.startsWith('L'));

    it('ranks the locks, then needs one boundary check when every lock is better', () => {
      const rank = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, B1: 6, B2: 7, B3: 8 };
      const { asked, order } = rankAll([...locks, ...bubble], bubble, bubbleOrder, rank);
      expect(order).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'B1', 'B2', 'B3']);
      // The worst lock against the best of the open spots, once
      expect(crossings(asked)).toEqual([['L5', 'B1']]);
      // The open spots' own order is never asked again
      expect(asked.some(([a, b]) => a.startsWith('B') && b.startsWith('B'))).toBe(false);
    });

    it('moves open-spot winners up past the locks they beat', () => {
      const rank = { L1: 1, L2: 2, B1: 3, L3: 4, L4: 5, B2: 6, L5: 7, B3: 8 };
      const { order } = rankAll([...locks, ...bubble], bubble, bubbleOrder, rank);
      expect(order).toEqual(['L1', 'L2', 'B1', 'L3', 'L4', 'B2', 'L5', 'B3']);
    });

    it('setup tags apply to the locks; open-spot winners stay in their own section', () => {
      const grouped = assignRankerGroups(
        [{ id: 'L1' }, { id: 'L2' }, { id: 'B1' }],
        [],
        { topTier: ['L1'], bottomTier: ['B1'], bubble: ['B1'] }
      );
      expect(grouped.map((p) => p.group)).toEqual(['top', 'upper', 'bubble']);
    });
  });
});
