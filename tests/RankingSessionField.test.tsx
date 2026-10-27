import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RankingSession } from '@/features/ranker/RankingSession';
import { RankerSetupDataZ } from '@/firebase/rankerHelpers';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';
import { createFieldState } from '@/features/ranker/utils/fieldBuilder';

const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
const pool = names.map((name) => ({ id: name.toLowerCase(), name }));

// Oracle: the true order differs from pool order, so the cut needs a playoff
const truth = ['Alpha', 'Echo', 'Beta', 'Gamma', 'Delta', 'Foxtrot', 'Golf', 'Hotel'];
const pickBetter = () => {
  const buttons = [...document.querySelectorAll('.compare-button')];
  if (buttons.length < 2) return false;
  const rank = (b: Element) => truth.findIndex((n) => (b.textContent ?? '').includes(n));
  fireEvent.click(rank(buttons[0]) < rank(buttons[1]) ? buttons[0] : buttons[1]);
  return true;
};

// Latest value of a key across partial autosaves
const lastSaved = (autosave: ReturnType<typeof vi.fn>, key: string) =>
  [...autosave.mock.calls].reverse().find(([patch]) => key in patch)?.[0][key];

describe('RankingSession Top-N field', () => {
  afterEach(cleanup);

  it('builds the field with either/or answers, then ranks only the field with those answers kept', () => {
    const autosave = vi.fn();
    render(<RankingSession playerPool={pool} listSize={3} autosave={autosave} />);

    // Step 1: lock Alpha; the other 7 are the bubble for 2 spots
    expect(screen.getByRole('heading', { name: /definitely in/ })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Lock Alpha'));
    expect(screen.getByText('7 players in the bubble for 2 spots.')).toBeTruthy();
    fireEvent.click(screen.getByText('Next: cut the bubble →'));

    // Step 2: everyone faces the cut-line player once
    expect(screen.getByRole('heading', { name: /Cut the bubble/ })).toBeTruthy();
    for (let i = 0; i < 30 && pickBetter(); i++);
    fireEvent.click(screen.getByRole('button', { name: /Continue to the last spots|Continue to ranking setup|Run round/ }));
    for (let i = 0; i < 30; i++) {
      if (!pickBetter()) {
        const next = screen.queryByRole('button', { name: /Run round|Continue to the last spots/ });
        if (!next) break;
        fireEvent.click(next);
      }
    }

    // Step 3 ends with exactly 3 and hands off to setup
    fireEvent.click(screen.getByText('Continue to ranking setup →'));
    expect(screen.getByRole('heading', { name: 'Ranking setup for your Top 3' })).toBeTruthy();
    const tagged = within(screen.getByTestId('tier-tagging'));
    for (const name of ['Alpha', 'Echo', 'Beta']) expect(tagged.getByText(name)).toBeTruthy();
    for (const name of ['Gamma', 'Delta', 'Hotel']) expect(tagged.queryByText(name)).toBeNull();

    const fieldAnswers = lastSaved(autosave, 'results').length;
    expect(fieldAnswers).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/Start Ranking/));

    const saved = { setupData: lastSaved(autosave, 'setupData'), results: lastSaved(autosave, 'results'), seedCount: lastSaved(autosave, 'seedCount') };
    expect(saved.setupData.configured).toBe(true);
    expect(saved.setupData.field.stage).toBe('done');
    expect([...saved.setupData.field.fieldIds].sort()).toEqual(['alpha', 'beta', 'echo']);
    // Field answers carry into the ranking as undo-proof seeds
    expect(saved.results.length).toBeGreaterThanOrEqual(fieldAnswers);
    expect(saved.seedCount).toBe(saved.results.length);
    // The saved-session schema keeps the field
    expect(RankerSetupDataZ.parse(saved.setupData).field?.fieldIds).toEqual(saved.setupData.field.fieldIds);

    // Ranking the field reaches a result with the cut players listed
    for (let i = 0; i < 20 && pickBetter(); i++);
    expect(screen.getByText('Your Top 3')).toBeTruthy();
    expect(screen.getByText(/Didn't make your Top 3 \(5\)/)).toBeTruthy();
  });

  it("doesn't offer #1 or last-place lock-ins that the field answers already rule out", () => {
    // Field: Alpha, Beta, Gamma (Delta was cut). Beta beat Alpha; Gamma beat Delta.
    const results = [
      { winner: 'beta', loser: 'alpha' },
      { winner: 'gamma', loser: 'delta' },
    ];
    const closureCache = createClosureCache();
    closureCache.rebuild(results);
    const field = {
      ...createFieldState(3),
      stage: 'done' as const,
      fieldIds: ['alpha', 'beta', 'gamma'],
      cutIds: ['delta'],
    };
    render(
      <RankingSession
        playerPool={pool.slice(0, 4)}
        resumedSessionData={{
          name: 'My Top 3',
          playerPoolIds: ['alpha', 'beta', 'gamma', 'delta'],
          setupData: { field },
          results,
          skippedPairs: new Set(),
          anchorDone: false,
          isFinished: false,
          adjustments: null,
          seedCount: 0,
          finishedAt: null,
          draftUpdatedAt: Date.now(),
          firestoreSessionId: null,
          savedListId: null,
          savedListName: null,
          closureCache,
        }}
        autosave={vi.fn()}
      />
    );

    const [first, last] = within(screen.getByTestId('locks')).getAllByRole('combobox');
    const choices = (select: HTMLElement) =>
      [...(select as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);
    // Alpha already lost to Beta, so can't be #1
    expect(choices(first)).toEqual(['beta', 'gamma']);
    // Beta already beat Alpha, so can't be last; beating a cut player doesn't count
    expect(choices(last)).toEqual(['alpha', 'gamma']);
    expect(screen.getByText(/haven.t put below anyone can be #1/)).toBeTruthy();
  });
});
