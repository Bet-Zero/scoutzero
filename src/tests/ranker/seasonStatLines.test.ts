import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocMock = vi.fn();
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: (ref: unknown) => getDocMock(ref),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
}));

import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
  loadSeasonStatLines,
} from '@/features/ranker/hooks/useSeasonStatLines';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

const docs: Record<string, unknown> = {
  'a|2025-26': { stats: { PTS: 21.5, GP: 70 }, team: 'LAL' },
  'b|2025-26': { team: 'BOS' },
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

describe('season stat lines', () => {
  it('labels the current and past seasons from the current season year', () => {
    const next = String((DEFAULT_SALARY_YEAR + 1) % 100).padStart(2, '0');
    expect(CURRENT_SEASON_CODE).toBe(`${DEFAULT_SALARY_YEAR}-${next}`);
    expect(getRecentPastSeasonCodes(2)[0]).toBe(
      `${DEFAULT_SALARY_YEAR - 1}-${String(DEFAULT_SALARY_YEAR % 100).padStart(2, '0')}`
    );
  });

  it('reads each player season doc once and keeps only stat lines', async () => {
    const lines = await loadSeasonStatLines('2025-26', ['a', 'b', 'c']);
    expect(Object.fromEntries(lines)).toEqual({ a: { PTS: 21.5, GP: 70 } });
    expect(getDocMock).toHaveBeenCalledTimes(3);

    // Cached: a second request with one new player reads only that player
    await loadSeasonStatLines('2025-26', ['a', 'b', 'c', 'd']);
    expect(getDocMock).toHaveBeenCalledTimes(4);
  });
});
