import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: (ref: unknown) => getDocMock(ref),
  getDocs: (ref: unknown) => getDocsMock(ref),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
  contractsCol: (playerId: string) => ({ playerId }),
}));

import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
  loadSeasonStatLines,
  loadSeasonViews,
} from '@/features/ranker/hooks/useSeasonViews';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

const seasonDocs: Record<string, unknown> = {
  'a|2025-26': { stats: { PTS: 21.5, GP: 70 }, team: 'LAL', age: 41 },
  'b|2025-26': { team: 'BOS' },
};

const contracts: Record<string, unknown[]> = {
  // An expired deal that covered 2025-26, and the current one after it
  a: [
    { salariesByYear: [{ season: '2026-27', salary: 30_000_000 }] },
    {
      salariesByYear: [
        { season: '2024-25', salary: 48_700_000 },
        { season: '2025-26', salary: 52_600_000 },
      ],
    },
  ],
  // An extension voided this row; there is no 2025-26 salary
  b: [{ salariesByYear: [{ season: '2025-26', salary: 9_000_000, voidedByExtension: true }] }],
};

beforeEach(() => {
  getDocMock.mockReset();
  getDocMock.mockImplementation(
    async ({ playerId, seasonId }: { playerId: string; seasonId: string }) => {
      const data = seasonDocs[`${playerId}|${seasonId}`];
      return { exists: () => data !== undefined, data: () => data };
    }
  );
  getDocsMock.mockReset();
  getDocsMock.mockImplementation(async ({ playerId }: { playerId: string }) => ({
    docs: (contracts[playerId] ?? []).map((data) => ({ data: () => data })),
  }));
});

describe('season views', () => {
  it('labels the current and past seasons from the current season year', () => {
    const next = String((DEFAULT_SALARY_YEAR + 1) % 100).padStart(2, '0');
    expect(CURRENT_SEASON_CODE).toBe(`${DEFAULT_SALARY_YEAR}-${next}`);
    expect(getRecentPastSeasonCodes(2)[0]).toBe(
      `${DEFAULT_SALARY_YEAR - 1}-${String(DEFAULT_SALARY_YEAR % 100).padStart(2, '0')}`
    );
  });

  it("returns each player's team, age, salary and stats for the season", async () => {
    const views = await loadSeasonViews('2025-26', ['a', 'b', 'c']);
    expect(Object.fromEntries(views)).toEqual({
      a: { team: 'LAL', age: 41, salary: 52_600_000, stats: { PTS: 21.5, GP: 70 } },
      b: { team: 'BOS', age: null, salary: null, stats: null },
      // c has no 2025-26 record and is left out
    });
  });

  it('reads each season doc and contract list at most once', async () => {
    // Earlier tests may have cached some reads; count from a fresh player set
    await loadSeasonViews('2023-24', ['x', 'y']);
    const docReads = getDocMock.mock.calls.length;
    const contractReads = getDocsMock.mock.calls.length;
    expect(docReads).toBe(2);
    expect(contractReads).toBe(2);

    await loadSeasonViews('2023-24', ['x', 'y', 'z']);
    expect(getDocMock.mock.calls.length).toBe(docReads + 1);
    expect(getDocsMock.mock.calls.length).toBe(contractReads + 1);

    // Contracts are shared across seasons; only the new season's docs are read
    await loadSeasonViews('2022-23', ['x', 'y', 'z']);
    expect(getDocsMock.mock.calls.length).toBe(contractReads + 1);
  });

  it('shares a read already in flight and never has more than 150 at once', async () => {
    let inFlight = 0;
    let peak = 0;
    getDocMock.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return { exists: () => false, data: () => undefined };
    });
    const ids = Array.from({ length: 400 }, (_, i) => `q${i}`);
    // Two overlapping loads of the same players (e.g. preload and a click)
    await Promise.all([
      loadSeasonStatLines('2017-18', ids),
      loadSeasonStatLines('2017-18', ids),
    ]);
    expect(getDocMock).toHaveBeenCalledTimes(400);
    expect(peak).toBeLessThanOrEqual(150);
    expect(peak).toBeGreaterThan(40);
  });
});
