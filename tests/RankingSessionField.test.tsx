import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RankingSession } from '@/features/ranker/RankingSession';
import { RankerSetupDataZ } from '@/firebase/rankerHelpers';

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
});
