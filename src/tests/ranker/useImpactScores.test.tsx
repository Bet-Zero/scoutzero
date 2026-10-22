import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useImpactScores } from '@/features/ranker/hooks/useImpactScores';
import { CURRENT_SEASON_CODE } from '@/features/ranker/hooks/useSeasonViews';

describe('useImpactScores', () => {
  it('picks up stored scores that change under a live subscription', async () => {
    const ids = ['a', 'b'];
    const noStats = new Map();
    const { result, rerender } = renderHook(
      ({ refreshed }) => useImpactScores(CURRENT_SEASON_CODE, ids, noStats, true, refreshed),
      { initialProps: { refreshed: new Map<string, number | null>([['a', 10], ['b', 8]]) } }
    );
    await waitFor(() => expect(result.current.scoresById?.get('a')).toBe(10));

    // A stats refresh clears a's score while the same players stay on screen
    rerender({ refreshed: new Map<string, number | null>([['a', null], ['b', 8]]) });
    await waitFor(() => expect(result.current.scoresById?.has('a')).toBe(false));
    expect(result.current.scoresById?.get('b')).toBe(8);
  });
});
