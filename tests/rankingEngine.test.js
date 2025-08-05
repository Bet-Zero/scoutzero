import { describe, it, expect } from 'vitest';
import {
  generateRankingFromComparisons,
  suggestNextPair,
} from '@/utils/ranker/rankingEngine.js';

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

  it('segments players and adjusts boundary', () => {
    const allPlayers = [
      { id: '1', name: 'Top' },
      { id: '2', name: 'Upper' },
      { id: '3', name: 'Anchor' },
      { id: '4', name: 'Lower' },
      { id: '5', name: 'Bottom' },
    ];
    const comps = [
      { winner: '2', loser: '3' },
      { winner: '3', loser: '4' },
      { winner: '1', loser: '2' },
      { winner: '4', loser: '2' },
    ];
    const ranking = generateRankingFromComparisons(comps, allPlayers, {
      topTier: ['1'],
      bottomTier: ['5'],
      anchor: '3',
    });
    expect(ranking.map((p) => p.id)).toEqual(['1', '4', '3', '2', '5']);
  });
});
