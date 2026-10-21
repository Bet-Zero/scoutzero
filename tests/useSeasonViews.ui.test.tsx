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
  getDocs: async () => ({ docs: [] }),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
  contractsCol: (playerId: string) => ({ playerId }),
}));

import {
  getRecentPastSeasonCodes,
  useSeasonViews,
} from '@/features/ranker/hooks/useSeasonViews';

describe('useSeasonViews', () => {
  it('loads a player swapped in while the count stays the same', async () => {
    const season = getRecentPastSeasonCodes(1)[0];
    const { result, rerender } = renderHook(
      ({ ids }) => useSeasonViews(season, ids),
      { initialProps: { ids: ['a', 'old'] } }
    );
    await waitFor(() => expect(result.current.viewsById?.has('old')).toBe(true));

    rerender({ ids: ['a', 'new'] });
    await waitFor(() =>
      expect(result.current.viewsById?.get('new')?.stats).toEqual({ PTS: 22, GP: 60 })
    );
  });

  it('never returns the previous season while a new season loads', async () => {
    const [olderSeason, oldestSeason] = getRecentPastSeasonCodes(3).slice(1);
    holdSeason = oldestSeason;
    const { result, rerender } = renderHook(
      ({ season }) => useSeasonViews(season, ['p1']),
      { initialProps: { season: olderSeason } }
    );
    await waitFor(() => expect(result.current.viewsById?.get('p1')?.stats?.PTS).toBe(10));

    rerender({ season: oldestSeason });
    expect(result.current.viewsById).toBeNull();
    expect(result.current.loading).toBe(true);

    releaseHeld?.();
    await waitFor(() => expect(result.current.viewsById?.get('p1')?.stats?.PTS).toBe(15));
  });
});
