import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RankingSetup } from '@/features/ranker/RankingSetup';

const samplePlayers = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

describe('RankingSetup', () => {
  afterEach(cleanup);

  it('captures selections and submits', () => {
    const handle = vi.fn();
    render(<RankingSetup playerPool={samplePlayers} onComplete={handle} />);
    const tierSection = screen.getByTestId('tier-tagging');
    // Click the TOP button for "Alpha" to mark as top-tier
    const topButtons = within(tierSection).getAllByText('TOP');
    fireEvent.click(topButtons[0]);
    fireEvent.click(screen.getByText(/Start/));
    expect(handle).toHaveBeenCalledWith({
      topTier: ['1'],
      bottomTier: [],
      anchor: null,
      firstPlace: null,
      lastPlace: null,
      topN: null,
    });
  });

  it('keeps the anchor and lock-ins on different players, and out of the tiers', () => {
    const players = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
      { id: '4', name: 'Delta' },
    ];
    const handle = vi.fn();
    render(<RankingSetup playerPool={players} onComplete={handle} />);

    const tierSection = screen.getByTestId('tier-tagging');
    fireEvent.click(within(tierSection).getAllByText('TOP')[0]);

    // Making Alpha the anchor removes their tier tag and blocks re-tagging
    const anchorSelect = within(screen.getByTestId('anchor')).getByRole('combobox');
    fireEvent.change(anchorSelect, { target: { value: '1' } });
    const firstTop = within(tierSection).getAllByText('TOP')[0] as HTMLButtonElement;
    expect(firstTop.disabled).toBe(true);

    // Alpha is no longer offered as #1 or last place
    const [firstSelect, lastSelect] = within(screen.getByTestId('locks')).getAllByRole(
      'combobox'
    );
    const optionValues = (select: HTMLElement) =>
      within(select)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value);
    expect(optionValues(firstSelect)).not.toContain('1');

    fireEvent.change(firstSelect, { target: { value: '2' } });
    expect(optionValues(lastSelect)).not.toContain('2');

    fireEvent.click(screen.getByText(/Start/));
    expect(handle).toHaveBeenCalledWith({
      topTier: [],
      bottomTier: [],
      anchor: '1',
      firstPlace: '2',
      lastPlace: null,
      topN: null,
    });
  });

  it('disables tagging once a tier is full instead of silently ignoring taps', () => {
    const players = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
      { id: '4', name: 'Delta' },
    ];
    render(<RankingSetup playerPool={players} onComplete={vi.fn()} />);
    const tierSection = screen.getByTestId('tier-tagging');
    const topButtons = within(tierSection).getAllByText('TOP');
    const bottomButtons = within(tierSection).getAllByText('BOT');

    // 4 players → 1 per tier
    fireEvent.click(topButtons[0]);
    expect((topButtons[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(bottomButtons[1]);
    // Bottom is now full, so Alpha (top) can't be moved to bottom and keeps its tag
    expect((bottomButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((topButtons[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends a Top-N list length only when it trims the pool', () => {
    const players = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `P${i}` }));
    const handle = vi.fn();
    render(<RankingSetup playerPool={players} onComplete={handle} />);

    // Only presets smaller than the pool are offered
    expect(screen.queryByText('Top 20')).toBeNull();
    fireEvent.click(screen.getByText('Top 10'));
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(handle.mock.lastCall?.[0].topN).toBe(10);

    fireEvent.change(screen.getByLabelText('Top N list length'), { target: { value: '12' } });
    expect(screen.getByText(/everyone will be ranked/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(handle.mock.lastCall?.[0].topN).toBeNull();
  });

  it('Top-N setup can rule players out before ranking', () => {
    const players = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `P${i}` }));
    const handle = vi.fn();
    render(<RankingSetup playerPool={players} onComplete={handle} />);

    // Only shown for a Top-N list
    expect(screen.queryByTestId('definitely-out')).toBeNull();
    fireEvent.click(screen.getByText('Top 10'));
    const out = screen.getByTestId('definitely-out');
    fireEvent.click(within(out).getByText('P11'));
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(handle.mock.lastCall?.[0].cuts).toEqual([{ ids: ['11'], at: -1 }]);

    // Cutting down below 10 left isn't applied
    fireEvent.click(within(out).getByText('P10'));
    fireEvent.click(within(out).getByText('P9'));
    expect(screen.getByText(/won't be applied/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Start Ranking/));
    expect(handle.mock.lastCall?.[0].cuts).toBeUndefined();
  });
});
