import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { LocalDraftBanner } from '@/features/ranker/LocalDraftBanner';

const results = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ winner: `w${i}`, loser: `l${i}` }));

describe('LocalDraftBanner', () => {
  afterEach(cleanup);

  it("counts the user's answers, not the results a #1 lock-in adds", () => {
    // Locking in #1 in a 20-player pool added 19 results; then 12 answers
    render(
      <LocalDraftBanner
        draft={{
          name: 'My Rankings',
          playerPoolIds: Array.from({ length: 20 }, (_, i) => `p${i}`),
          results: results(31),
          seedCount: 19,
          setupData: { steps: [{ setupData: null, results: 0 }] },
          draftUpdatedAt: Date.now(),
        }}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByText(/· 12 answers · 20\s+players/)).toBeTruthy();
    expect(screen.queryByText(/comparisons/)).toBeNull();
  });
});
