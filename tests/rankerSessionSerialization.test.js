// tests/rankerSessionSerialization.test.js
// Tests for session state serialization/deserialization (skippedPairs, closure rebuild, etc.)

import { describe, it, expect } from 'vitest';
import {
  serializeSkippedPairs,
  deserializeSkippedPairs,
  serializeAdjustments,
} from '@/firebase/rankerHelpers';
import {
  createClosureCache,
  suggestNextPair,
} from '@/features/ranker/utils/rankingEngine';

describe('skippedPairs serialization', () => {
  it('serializes Set to array', () => {
    const set = new Set(['a<>b', 'c<>d', 'e<>f']);
    const arr = serializeSkippedPairs(set);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(3);
    expect(arr).toContain('a<>b');
    expect(arr).toContain('c<>d');
    expect(arr).toContain('e<>f');
  });

  it('deserializes array to Set', () => {
    const arr = ['a<>b', 'c<>d', 'e<>f'];
    const set = deserializeSkippedPairs(arr);
    expect(set instanceof Set).toBe(true);
    expect(set.size).toBe(3);
    expect(set.has('a<>b')).toBe(true);
    expect(set.has('c<>d')).toBe(true);
    expect(set.has('e<>f')).toBe(true);
  });

  it('round-trips correctly', () => {
    const original = new Set(['x<>y', 'z<>w']);
    const serialized = serializeSkippedPairs(original);
    const deserialized = deserializeSkippedPairs(serialized);
    expect([...deserialized].sort()).toEqual([...original].sort());
  });

  it('handles empty Set', () => {
    const empty = new Set();
    const arr = serializeSkippedPairs(empty);
    expect(arr).toEqual([]);
    const back = deserializeSkippedPairs(arr);
    expect(back.size).toBe(0);
  });

  it('handles null/undefined gracefully', () => {
    expect(serializeSkippedPairs(null)).toEqual([]);
    expect(serializeSkippedPairs(undefined)).toEqual([]);
    expect(deserializeSkippedPairs(null).size).toBe(0);
    expect(deserializeSkippedPairs(undefined).size).toBe(0);
  });
});

describe('adjustments serialization', () => {
  it('extracts player IDs from ranking array', () => {
    const ranking = [
      { id: 'player1', name: 'A' },
      { id: 'player2', name: 'B' },
      { id: 'player3', name: 'C' },
    ];
    const ids = serializeAdjustments(ranking);
    expect(ids).toEqual(['player1', 'player2', 'player3']);
  });

  it('returns null for null/undefined input', () => {
    expect(serializeAdjustments(null)).toBe(null);
    expect(serializeAdjustments(undefined)).toBe(null);
  });

  it('handles empty array', () => {
    expect(serializeAdjustments([])).toEqual([]);
  });
});

describe('closure cache rebuild', () => {
  it('rebuild produces same reachability as incremental adds', () => {
    const results = [
      { winner: 'A', loser: 'B' },
      { winner: 'B', loser: 'C' },
      { winner: 'C', loser: 'D' },
      { winner: 'A', loser: 'E' },
    ];

    // Incremental
    const inc = createClosureCache();
    results.forEach(({ winner, loser }) => inc.addEdge(winner, loser));

    // Rebuild
    const reb = createClosureCache();
    reb.rebuild(results);

    // Compare closures
    const nodes = ['A', 'B', 'C', 'D', 'E'];
    nodes.forEach((node) => {
      const incSet = inc.closure[node] || new Set();
      const rebSet = reb.closure[node] || new Set();
      expect([...incSet].sort()).toEqual([...rebSet].sort());
    });
  });

  it('rebuild from empty produces empty closure', () => {
    const cache = createClosureCache();
    cache.rebuild([]);
    expect(Object.keys(cache.closure)).toHaveLength(0);
  });

  it('rebuild clears previous state', () => {
    const cache = createClosureCache();
    cache.addEdge('X', 'Y');
    expect(cache.closure['X']?.has('Y')).toBe(true);

    // Rebuild with different data
    cache.rebuild([{ winner: 'A', loser: 'B' }]);
    expect(cache.closure['X']).toBeUndefined();
    expect(cache.closure['A']?.has('B')).toBe(true);
  });
});

describe('resume with skippedPairs', () => {
  const players = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
    { id: '4', name: 'D' },
  ];

  it('on reload, suggestNextPair respects skippedPairs', () => {
    // Setup: some comparisons done, one pair skipped
    const results = [{ winner: '1', loser: '2' }];
    const skippedPairs = new Set(['1<>3']); // 1 vs 3 was skipped

    // Rebuild closure
    const cache = createClosureCache();
    cache.rebuild(results);

    // Get next pair
    const next = suggestNextPair(results, players, {
      skippedPairs,
      closureCache: cache,
    });

    // Next pair should NOT be 1 vs 3 (or 3 vs 1)
    if (next.length === 2) {
      const key =
        next[0].id < next[1].id
          ? `${next[0].id}<>${next[1].id}`
          : `${next[1].id}<>${next[0].id}`;
      expect(key).not.toBe('1<>3');
    }
  });

  it('does not return already-decided pair after reload', () => {
    const results = [
      { winner: '1', loser: '2' },
      { winner: '1', loser: '3' },
      { winner: '2', loser: '3' },
    ];

    const cache = createClosureCache();
    cache.rebuild(results);

    // After these comparisons, 1-2, 1-3, 2-3 are all decided
    // 1 beats everyone, 2 beats 3
    // Only undecided pairs involve player 4

    const next = suggestNextPair(results, players, { closureCache: cache });

    if (next.length === 2) {
      // At least one should be player 4
      expect(next.some((p) => p.id === '4')).toBe(true);
    }
  });
});
