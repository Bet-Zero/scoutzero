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

describe('suggestedPoolSize', () => {
  it('adds a buffer that grows with the list size', () => {
    expect([10, 20, 50, 100].map(suggestedPoolSize)).toEqual([26, 42, 85, 150]);
    expect(suggestedPoolSize(1)).toBe(11);
  });
});

describe('loadImpactScores', () => {
  const lastSeason = getRecentPastSeasonCodes(1)[0];
  const docs: Record<string, unknown> = {
    [`star|${lastSeason}`]: { stats: { PTS: 30, GP: 70 } },
    [`star|${CURRENT_SEASON_CODE}`]: { stats: { PTS: 20, GP: 20 } },
    [`rookie|${CURRENT_SEASON_CODE}`]: { stats: { PTS: 12, GP: 8 } },
    [`vet|${lastSeason}`]: { stats: { PTS: 15, GP: 50 } },
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
      ['star', 'rookie', 'vet', 'fallback', 'nobody'],
      new Map([['fallback', { PTS: 9, GP: 10 }]])
    );
    expect(Object.fromEntries(scores)).toEqual({
      star: 25, // half and half at 20 games
      rookie: 12,
      vet: 15,
      fallback: 9,
    });
  });

  it('scores a past season on its own', async () => {
    const scores = await loadImpactScores(lastSeason, ['star', 'rookie', 'vet'], new Map());
    expect(Object.fromEntries(scores)).toEqual({ star: 30, vet: 15 });
  });
});
