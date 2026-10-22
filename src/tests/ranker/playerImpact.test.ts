import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocMock = vi.fn();
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: (ref: unknown) => getDocMock(ref),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
  contractsCol: (playerId: string) => ({ playerId }),
}));

import {
  blendedImpactScore,
  gameScorePerGame,
  recentPeakScore,
  selectTopNCandidates,
  suggestedPoolSize,
} from '@/features/ranker/utils/playerImpact';
import { loadImpactScores } from '@/features/ranker/hooks/useImpactScores';
import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
} from '@/features/ranker/hooks/useSeasonViews';

describe('gameScorePerGame', () => {
  it('applies the Game Score formula to a per-game line', () => {
    const line = {
      PTS: 25, FGM: 9, FGA: 18, FTM: 5, FTA: 6, ORB: 1, DRB: 6,
      STL: 1, AST: 7, BLK: 1, PF: 2, TOV: 3, GP: 60,
    };
    // 25 + 3.6 − 12.6 − 0.4 + 0.7 + 1.8 + 1 + 4.9 + 0.7 − 0.8 − 3
    expect(gameScorePerGame(line)).toBeCloseTo(20.9, 5);
  });

  it('weights total rebounds 0.4 without the offensive/defensive split', () => {
    expect(gameScorePerGame({ PTS: 10, REB: 10, GP: 20 })).toBeCloseTo(14, 5);
  });

  it('needs points and at least 5 games', () => {
    expect(gameScorePerGame({ REB: 10, GP: 30 })).toBeNull();
    expect(gameScorePerGame({ PTS: 30, GP: 4 })).toBeNull();
    expect(gameScorePerGame(null)).toBeNull();
  });
});

describe('blendedImpactScore', () => {
  it('leans on last season early and on this season later', () => {
    const lastSeason = { PTS: 20, GP: 70 };
    expect(blendedImpactScore({ PTS: 10, GP: 5 }, lastSeason)).toBeCloseTo(18, 5); // 5/25 weight
    expect(blendedImpactScore({ PTS: 10, GP: 60 }, lastSeason)).toBeCloseTo(12.5, 5); // 60/80
  });

  it('uses whichever season can be scored', () => {
    expect(blendedImpactScore(null, { PTS: 20, GP: 70 })).toBe(20);
    expect(blendedImpactScore({ PTS: 10, GP: 2 }, { PTS: 20, GP: 70 })).toBe(20);
    expect(blendedImpactScore({ PTS: 10, GP: 8 }, null)).toBe(10);
    expect(blendedImpactScore(null, null)).toBeNull();
  });
});

describe('recentPeakScore', () => {
  it('keeps the recent score unless an earlier season was better', () => {
    expect(recentPeakScore(20, [{ PTS: 18, GP: 70 }])).toBe(20);
    // A down year: last season's 26 (−5%) beats this year's 20
    expect(recentPeakScore(20, [{ PTS: 26, GP: 70 }])).toBeCloseTo(24.7, 5);
  });

  it('scores a player who missed the recent seasons from an earlier one', () => {
    // Out all of last season, healthy two seasons ago
    expect(recentPeakScore(null, [null, { PTS: 25, GP: 60 }])).toBeCloseTo(22.5625, 5);
  });

  it('ignores short earlier seasons', () => {
    expect(recentPeakScore(10, [{ PTS: 30, GP: 12 }])).toBe(10);
    expect(recentPeakScore(null, [{ PTS: 30, GP: 12 }])).toBeNull();
  });
});

describe('suggestedPoolSize', () => {
  it('adds a buffer that grows with the list size', () => {
    expect([10, 20, 50, 100].map(suggestedPoolSize)).toEqual([26, 42, 85, 150]);
    expect(suggestedPoolSize(1)).toBe(11);
  });
});

describe('selectTopNCandidates', () => {
  // s1..s6 by stats; "big" has middling stats but the top salary
  const rows = [
    { id: 's1', salary: 30 },
    { id: 's2', salary: 5 },
    { id: 's3', salary: 4 },
    { id: 's4', salary: 3 },
    { id: 'big', salary: 54 },
    { id: 's5', salary: 2 },
    { id: 's6', salary: null },
    { id: 'unscored', salary: 1 },
  ];
  const scores = new Map([
    ['s1', 30], ['s2', 28], ['s3', 26], ['s4', 24], ['big', 12], ['s5', 20], ['s6', 18],
  ]);

  it('takes the best by stats and the best paid, ordered by the better rank', () => {
    const { pool, nearMisses } = selectTopNCandidates(rows, scores, 2, 3);
    // Stats top 2: s1, s2; pay top 2: big, s1
    expect(pool.map((r) => r.id)).toEqual(['s1', 'big', 's2']);
    expect(pool[1]).toMatchObject({ statsRank: 7, payRank: 1, rank: 2, score: 12 });
    // Next by better rank: s3 (stats 3, pay 3), s4 (4/4), s5 (5/6)
    expect(nearMisses.map((r) => r.id)).toEqual(['s3', 's4', 's5']);
    expect(nearMisses[0].rank).toBe(4);
  });

  it('keeps a well-paid player with no stats to score', () => {
    const { pool } = selectTopNCandidates(
      [{ id: 'hurt', salary: 50 }, { id: 'a', salary: 1 }, { id: 'b', salary: 1 }],
      new Map([['a', 20], ['b', 15]]),
      1
    );
    // Both are first on one list; the better stats rank breaks the tie
    expect(pool.map((r) => r.id)).toEqual(['a', 'hurt']);
    expect(pool[1].score).toBeUndefined();
  });
});

describe('loadImpactScores', () => {
  const [lastSeason, twoAgo] = getRecentPastSeasonCodes(2);
  const docs: Record<string, unknown> = {
    [`star|${lastSeason}`]: { stats: { PTS: 30, GP: 70 } },
    [`star|${CURRENT_SEASON_CODE}`]: { stats: { PTS: 20, GP: 20 } },
    [`rookie|${CURRENT_SEASON_CODE}`]: { stats: { PTS: 12, GP: 8 } },
    [`vet|${lastSeason}`]: { stats: { PTS: 15, GP: 50 } },
    // Hurt all of last season and so far this season
    [`hurt|${twoAgo}`]: { stats: { PTS: 26, GP: 65 } },
  };

  beforeEach(() => {
    getDocMock.mockReset();
    getDocMock.mockImplementation(
      async ({ playerId, seasonId }: { playerId: string; seasonId: string }) => {
        const data = docs[`${playerId}|${seasonId}`];
        return { exists: () => data !== undefined, data: () => data };
      }
    );
  });

  it('blends this season with last season, falling back to current stats', async () => {
    const scores = await loadImpactScores(
      CURRENT_SEASON_CODE,
      ['star', 'rookie', 'vet', 'fallback', 'hurt', 'nobody'],
      new Map([['fallback', { PTS: 9, GP: 10 }]])
    );
    expect(Object.fromEntries(scores)).toEqual({
      // Blend is 25 (half and half at 20 games), but last season's 30 (−5%) is higher
      star: 28.5,
      rookie: 12,
      vet: 15,
      fallback: 9,
      hurt: 26 * 0.95 * 0.95,
    });
  });

  it('scores a past season on its own', async () => {
    const scores = await loadImpactScores(lastSeason, ['star', 'rookie', 'vet'], new Map());
    expect(Object.fromEntries(scores)).toEqual({ star: 30, vet: 15 });
  });
});

describe('impact score cache', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    getDocMock.mockReset();
    getDocMock.mockImplementation(async () => ({
      exists: () => true,
      data: () => ({ stats: { PTS: 20, GP: 60 } }),
    }));
  });

  it('reads each player once, then serves scores from the browser cache', async () => {
    // A season no other test has loaded, so nothing is cached in memory
    const season = '2019-20';
    const first = await loadImpactScores(season, ['c1', 'c2'], new Map());
    expect(Object.fromEntries(first)).toEqual({ c1: 20, c2: 20 });
    const reads = getDocMock.mock.calls.length;
    expect(reads).toBeGreaterThan(0);

    // Same players: nothing read again; one new player: only they are read
    await loadImpactScores(season, ['c1', 'c2'], new Map());
    expect(getDocMock.mock.calls.length).toBe(reads);
    await loadImpactScores(season, ['c1', 'c2', 'c3'], new Map());
    expect(getDocMock.mock.calls.length).toBe(reads + 4); // c3 x 4 seasons
  });

  it('ignores a cache entry older than 12 hours', async () => {
    store.set(
      'ranker_impact_v1:2018-19',
      JSON.stringify({ savedAt: Date.now() - 13 * 60 * 60 * 1000, checked: ['d1'], scores: { d1: 99 } })
    );
    const scores = await loadImpactScores('2018-19', ['d1'], new Map());
    expect(scores.get('d1')).toBe(20);
  });
});
