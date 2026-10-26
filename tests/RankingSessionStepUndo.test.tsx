import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RankingSession } from '@/features/ranker/RankingSession';
import { RankerSetupDataZ } from '@/firebase/rankerHelpers';

const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
const pool = names.map((name) => ({ id: name.toLowerCase(), name }));

// Oracle: the true order differs from pool order
const truth = ['Alpha', 'Echo', 'Beta', 'Gamma', 'Delta', 'Foxtrot', 'Golf', 'Hotel'];
const compareButtons = () => [...document.querySelectorAll('.compare-button')];
const pickBetter = () => {
  const buttons = compareButtons();
  if (buttons.length < 2) return false;
  const rank = (b: Element) => truth.findIndex((n) => (b.textContent ?? '').includes(n));
  fireEvent.click(rank(buttons[0]) < rank(buttons[1]) ? buttons[0] : buttons[1]);
  return true;
};

// Latest value of a key across partial autosaves
const lastSaved = (autosave: ReturnType<typeof vi.fn>, key: string) =>
  [...autosave.mock.calls].reverse().find(([patch]) => key in patch)?.[0][key];

const roundSummary = () => screen.queryByRole('heading', { name: /beat .* · \d+ cut/ });
const undoButton = () => screen.getByRole('button', { name: /^(Undo|Go back a step)$/ });

// Lock Alpha and answer round one of a Top 3 field
const startField = (autosave = vi.fn(), extra: Record<string, unknown> = {}) => {
  render(<RankingSession playerPool={pool} listSize={3} autosave={autosave} {...extra} />);
  fireEvent.click(screen.getByLabelText('Lock Alpha'));
  fireEvent.click(screen.getByText('Next: cut the bubble →'));
  return autosave;
};

// Answer everything up to the ranking setup screen
const finishField = () => {
  for (let i = 0; i < 40; i++) {
    if (pickBetter()) continue;
    const next = screen.queryByRole('button', {
      name: /Run round|Continue to the last spots|Try a lower cut line|Continue to ranking setup/,
    });
    if (!next) break;
    fireEvent.click(next);
  }
};

describe('RankingSession: undo takes back step buttons', () => {
  afterEach(cleanup);

  it('undo after moving on from a round returns to that round, answers intact', () => {
    const autosave = startField();
    for (let i = 0; i < 30 && pickBetter(); i++);
    expect(roundSummary()).toBeTruthy();
    const answers = lastSaved(autosave, 'results').length;

    // Press whichever step button the round offers, then take it back
    fireEvent.click(
      screen.getByRole('button', {
        name: /Run round|Continue to the last spots|Try a lower cut line|Continue to ranking setup/,
      })
    );
    expect(roundSummary()).toBeNull();
    fireEvent.click(undoButton());
    expect(roundSummary()).toBeTruthy();
    expect(lastSaved(autosave, 'results')).toHaveLength(answers);
    expect(lastSaved(autosave, 'setupData').steps).toHaveLength(1);

    // Then the round's own answers can be taken back one at a time
    fireEvent.click(screen.getByText('Undo last answer'));
    expect(compareButtons()).toHaveLength(2);
    expect(lastSaved(autosave, 'results')).toHaveLength(answers - 1);
  });

  it('back to locks takes back the step instead of adding one', () => {
    const autosave = startField();
    fireEvent.click(screen.getByText('← Back to locks'));
    expect(screen.getByRole('heading', { name: /definitely in/ })).toBeTruthy();
    expect(lastSaved(autosave, 'setupData').steps).toBeUndefined();
    // Alpha is still locked
    expect(screen.getByText('7 players in the bubble for 2 spots.')).toBeTruthy();
  });

  it('from the ranking: undo returns to setup with the choices kept, then back to the field', () => {
    const autosave = startField();
    finishField();
    expect(screen.getByRole('heading', { name: 'Ranking setup for your Top 3' })).toBeTruthy();
    const fieldAnswers = lastSaved(autosave, 'results').length;

    // Lock Echo in at #1 and start
    const [firstPlace] = within(screen.getByTestId('locks')).getAllByRole('combobox');
    fireEvent.change(firstPlace, { target: { value: 'echo' } });
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(lastSaved(autosave, 'seedCount')).toBeGreaterThan(fieldAnswers);

    // No picks yet: undo goes back to setup, dropping only the lock-in seeds
    fireEvent.click(undoButton());
    expect(screen.getByRole('heading', { name: 'Ranking setup for your Top 3' })).toBeTruthy();
    expect(lastSaved(autosave, 'results')).toHaveLength(fieldAnswers);
    expect(
      (within(screen.getByTestId('locks')).getAllByRole('combobox')[0] as HTMLSelectElement).value
    ).toBe('echo');

    // And from setup back into building the field
    fireEvent.click(screen.getByText('← Back to building the field'));
    expect(screen.getByRole('heading', { name: /Playoff for the last spots|Cut the bubble/ })).toBeTruthy();
  });

  it('the anchor screen can go back to setup, keeping the anchor', () => {
    render(<RankingSession playerPool={pool.slice(0, 5)} autosave={vi.fn()} />);
    const [anchorSelect] = within(screen.getByTestId('anchor')).getAllByRole('combobox');
    fireEvent.change(anchorSelect, { target: { value: 'gamma' } });
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(screen.getByText('Anchor Comparison')).toBeTruthy();

    fireEvent.click(screen.getByText('← Back to ranking setup'));
    expect(screen.getByText('Pre-Ranking Setup')).toBeTruthy();
    expect(
      (within(screen.getByTestId('anchor')).getAllByRole('combobox')[0] as HTMLSelectElement).value
    ).toBe('gamma');
  });

  it('the saved session keeps its steps', () => {
    const autosave = startField();
    for (let i = 0; i < 30 && pickBetter(); i++);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Run round|Continue to the last spots|Try a lower cut line|Continue to ranking setup/,
      })
    );
    const parsed = RankerSetupDataZ.parse(lastSaved(autosave, 'setupData'));
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps?.[0].setupData?.field?.stage).toBe('locks');
  });
});

describe('RankingSession: field order, cut list and saving progress', () => {
  afterEach(cleanup);

  it('orders the field by the order fixed at Start and saves it with the field', () => {
    const autosave = vi.fn();
    const order = [...pool].reverse().map((p) => p.id);
    render(<RankingSession playerPool={pool} listSize={3} poolOrder={order} autosave={autosave} />);
    const locks = screen.getAllByRole('button', { name: /^Lock / });
    expect(locks[0].getAttribute('aria-label')).toBe('Lock Hotel');
    expect(lastSaved(autosave, 'setupData').field.order).toEqual(order);
  });

  it("lists the players who didn't make it closest first", () => {
    startField();
    finishField();
    fireEvent.click(screen.getByText(/Start Ranking/));
    for (let i = 0; i < 20 && pickBetter(); i++);
    fireEvent.click(screen.getByText(/Didn't make your Top 3/));
    const details = screen.getByText(/Didn't make your Top 3/).closest('details') as HTMLElement;
    const shown = [...details.querySelectorAll('span')].map((s) => s.textContent);
    // Gamma is the next-best player; Hotel the worst
    expect(shown[0]).toBe('Gamma');
    expect(shown[shown.length - 1]).toBe('Hotel');
  });

  it('owners can save progress before the ranking is finished', () => {
    const saveToFirestore = vi.fn();
    startField(vi.fn(), { isOwner: true, saveToFirestore });
    fireEvent.click(screen.getByText('Save progress'));
    expect(saveToFirestore).toHaveBeenCalled();
  });

  it('others never see the save button', () => {
    startField(vi.fn(), { isOwner: false, saveToFirestore: vi.fn() });
    expect(screen.queryByText('Save progress')).toBeNull();
  });
});
