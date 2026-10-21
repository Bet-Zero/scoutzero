import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let holdSeason: string | null = null;
let releaseHeld: (() => void) | null = null;
const getDocMock = vi.fn(
  async ({ playerId, seasonId }: { playerId: string; seasonId: string }) => {
    if (seasonId === holdSeason) {
      await new Promise<void>((resolve) => {
        releaseHeld = resolve;
      });
    }
    const pts = playerId === 'new' ? 22 : seasonId === holdSeason ? 15 : 10;
    return { exists: () => true, data: () => ({ stats: { PTS: pts, GP: 60 } }) };
  }
);
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: (ref: { playerId: string }) => getDocMock(ref),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
}));

import {
  getRecentPastSeasonCodes,
  useSeasonStatLines,
} from '@/features/ranker/hooks/useSeasonStatLines';

describe('useSeasonStatLines', () => {
  it('loads stats for a player swapped in while the count stays the same', async () => {
    const season = getRecentPastSeasonCodes(1)[0];
    const { result, rerender } = renderHook(
      ({ ids }) => useSeasonStatLines(season, ids),
      { initialProps: { ids: ['a', 'old'] } }
    );
    await waitFor(() => expect(result.current.statsById?.has('old')).toBe(true));

    rerender({ ids: ['a', 'new'] });
    await waitFor(() => expect(result.current.statsById?.get('new')).toEqual({ PTS: 22, GP: 60 }));
  });

  it('never returns the previous season while a new season loads', async () => {
    const [olderSeason, oldestSeason] = getRecentPastSeasonCodes(3).slice(1);
    holdSeason = oldestSeason;
    const { result, rerender } = renderHook(
      ({ season }) => useSeasonStatLines(season, ['p1']),
      { initialProps: { season: olderSeason } }
    );
    await waitFor(() => expect(result.current.statsById?.get('p1')?.PTS).toBe(10));

    rerender({ season: oldestSeason });
    expect(result.current.statsById).toBeNull();
    expect(result.current.loading).toBe(true);

    releaseHeld?.();
    await waitFor(() => expect(result.current.statsById?.get('p1')?.PTS).toBe(15));
  });
});
