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
