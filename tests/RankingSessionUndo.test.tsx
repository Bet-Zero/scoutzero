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

  it('Top-N mode stops once the top N are known and lists the rest as cut', () => {
    const closureCache = createClosureCache();
    const markFinished = vi.fn();
    render(
      <RankingSession
        playerPool={players}
        resumedSessionData={{
          ...resumed(),
          setupData: { topTier: [], bottomTier: [], anchor: null, firstPlace: null, lastPlace: null, topN: 2 },
          results: [],
          seedCount: 0,
          closureCache,
        }}
        markFinished={markFinished}
      />
    );

    // Oracle: Alpha > Beta > Gamma > Delta
    const order = ['Alpha', 'Beta', 'Gamma', 'Delta'];
    for (let i = 0; i < 20 && !markFinished.mock.calls.length; i++) {
      const buttons = document.querySelectorAll('.compare-button');
      const names = [...buttons].map((b) => b.textContent ?? '');
      const better = order.findIndex((n) => names[0].includes(n)) < order.findIndex((n) => names[1].includes(n)) ? 0 : 1;
      fireEvent.click(buttons[better]);
    }

    expect(markFinished).toHaveBeenCalled();
    expect(screen.getByText('Your Top 2')).toBeTruthy();
    expect(screen.getByText(/Didn't make your Top 2 \(2\)/)).toBeTruthy();
  });

  it('Top-N mode can cut both players of a matchup, and undo brings them back', () => {
    const autosave = vi.fn();
    const pool = [...players, { id: 'e', name: 'Echo' }, { id: 'f', name: 'Foxtrot' }];
    render(
      <RankingSession
        playerPool={pool}
        resumedSessionData={{
          ...resumed(),
          playerPoolIds: pool.map((p) => p.id),
          setupData: { topTier: [], bottomTier: [], anchor: null, firstPlace: null, lastPlace: null, topN: 2 },
          results: [],
          seedCount: 0,
          closureCache: createClosureCache(),
        }}
        autosave={autosave}
      />
    );

    const shown = () =>
      [...document.querySelectorAll('.compare-button')].map((b) => b.textContent ?? '');
    const before = shown();
    fireEvent.click(screen.getByText('Neither makes my Top 2'));
    const cut = autosave.mock.lastCall?.[0].setupData.cuts;
    expect(cut).toEqual([{ ids: expect.any(Array), at: 0 }]);
    expect(cut[0].ids).toHaveLength(2);
    // Neither cut player is shown again
    expect(shown().join('')).not.toBe(before.join(''));

    fireEvent.click(screen.getByText('Undo'));
    expect(autosave.mock.lastCall?.[0].setupData.cuts).toEqual([]);
    expect(shown()).toEqual(before);
  });

  it('Top-N cut buttons never leave fewer than N players', () => {
    render(
      <RankingSession
        playerPool={players}
        resumedSessionData={{
          ...resumed(),
          setupData: { topTier: [], bottomTier: [], anchor: null, firstPlace: null, lastPlace: null, topN: 3 },
          results: [],
          seedCount: 0,
          closureCache: createClosureCache(),
        }}
      />
    );
    // 4 players, Top 3: one can be cut, two can't
    expect(screen.getByText('Neither makes my Top 3').closest('button')?.disabled).toBe(true);
    expect(screen.getAllByText(/^Cut /)[0].closest('button')?.disabled).toBe(false);
  });

  it('a cut that finishes the session can be undone from the results', () => {
    const autosave = vi.fn();
    const three = players.slice(0, 3);
    // Top 2 of three players, with Alpha > Beta already known
    const cache = createClosureCache();
    cache.rebuild([{ winner: 'a', loser: 'b' }]);
    render(
      <RankingSession
        playerPool={three}
        resumedSessionData={{
          ...resumed(),
          playerPoolIds: ['a', 'b', 'c'],
          setupData: { topTier: [], bottomTier: [], anchor: null, firstPlace: null, lastPlace: null, topN: 2 },
          results: [{ winner: 'a', loser: 'b' }],
          seedCount: 1,
          closureCache: cache,
        }}
        autosave={autosave}
      />
    );

    // Cutting Gamma leaves Alpha and Beta: the Top 2 is settled
    fireEvent.click(screen.getByText('Cut Gamma'));
    expect(screen.getByText('Your Top 2')).toBeTruthy();

    fireEvent.click(screen.getByText('↶ Undo last step'));
    expect(screen.queryByText('Your Top 2')).toBeNull();
    expect(screen.getByText('Cut Gamma')).toBeTruthy();
    // A hand-adjusted order is dropped along with the undone step
    expect(autosave).toHaveBeenLastCalledWith(expect.objectContaining({ adjustments: null }));
  });
});
