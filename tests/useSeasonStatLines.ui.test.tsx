import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getDocMock = vi.fn(async ({ playerId }: { playerId: string }) => ({
  exists: () => true,
  data: () => ({ stats: { PTS: playerId === 'new' ? 22 : 10, GP: 60 } }),
}));
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
});
