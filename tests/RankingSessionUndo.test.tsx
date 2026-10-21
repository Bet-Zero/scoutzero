import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RankingSession } from '@/features/ranker/RankingSession';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';
import type { HydratedRankerDraft } from '@/features/ranker/hooks/useRankerSession';

const players = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
  { id: 'd', name: 'Delta' },
];

// Setup locked Alpha in at #1, which seeded three comparisons
const seeds = [
  { winner: 'a', loser: 'b' },
  { winner: 'a', loser: 'c' },
  { winner: 'a', loser: 'd' },
];

const resumed = (): HydratedRankerDraft => {
  const closureCache = createClosureCache();
  closureCache.rebuild(seeds);
  return {
    name: 'Test',
    playerPoolIds: ['a', 'b', 'c', 'd'],
    setupData: { topTier: [], bottomTier: [], anchor: null, firstPlace: 'a', lastPlace: null },
    results: seeds,
    skippedPairs: new Set(),
    anchorDone: true,
    isFinished: false,
    adjustments: null,
    seedCount: 3,
    finishedAt: null,
    draftUpdatedAt: Date.now(),
    firestoreSessionId: null,
    savedListId: null,
    savedListName: null,
    closureCache,
  };
};

describe('RankingSession undo', () => {
  afterEach(cleanup);

  it('only undoes head-to-head picks, never the setup seeds', () => {
    const autosave = vi.fn();
    render(
      <RankingSession
        playerPool={players}
        resumedSessionData={resumed()}
        autosave={autosave}
      />
    );

    // Only seeds so far: nothing to undo
    expect(screen.queryByText('Undo')).toBeNull();

    const pickLeft = () =>
      fireEvent.click(document.querySelectorAll('.compare-button')[0]);

    pickLeft();
    expect(autosave).toHaveBeenLastCalledWith(
      expect.objectContaining({ results: expect.arrayContaining(seeds) })
    );
    expect(autosave.mock.lastCall?.[0].results).toHaveLength(4);

    // One pick made: it can be undone, back down to the seeds and no further
    fireEvent.click(screen.getByText('Undo'));
    expect(autosave.mock.lastCall?.[0].results).toEqual(seeds);
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('offers a way back to the pool', () => {
    const onExit = vi.fn();
    render(
      <RankingSession playerPool={players} resumedSessionData={resumed()} onExit={onExit} />
    );
    fireEvent.click(screen.getByText('← Back to pool'));
    expect(onExit).toHaveBeenCalled();
  });
});
