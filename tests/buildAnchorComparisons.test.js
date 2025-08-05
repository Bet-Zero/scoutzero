import { describe, it, expect } from 'vitest';
import { buildAnchorComparisons } from '@/utils/ranker/rankingEngine.js';

describe('buildAnchorComparisons', () => {
  it('creates directional relationships against anchor', () => {
    const players = [
      { id: '1' },
      { id: '2' },
    ];
    const comps = buildAnchorComparisons('A', players, ['1']);
    expect(comps).toEqual([
      { winner: '1', loser: 'A' },
      { winner: 'A', loser: '2' },
    ]);
  });
});
