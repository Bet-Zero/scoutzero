import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterPoolPanel } from '@/features/ranker/FilterPoolPanel';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const candidate = (
  id: string,
  stats: Record<string, number>
): RosterDrawerPlayer<RosterManagerPlayer> => ({
  id,
  name: id.toLowerCase(),
  team: 'lal',
  teamCode: 'LAL',
  position: 'G',
  offenseRoles: [],
  defenseRoles: [],
  offenseSubroles: [],
  defenseSubroles: [],
  shootingProfile: '',
  badges: [],
  salary: 10_000_000,
  freeAgentYear: null,
  freeAgentType: '',
  contractType: '',
  extension: null,
  options: [],
  original: {
    id,
    name: id,
    bio: { displayName: id },
    currentSeasonStats: stats,
  } as unknown as RosterManagerPlayer,
});

const candidates = [
  candidate('Scorer', { PTS: 26, GP: 20 }),
  candidate('Starter', { PTS: 21, GP: 18 }),
  candidate('Bench', { PTS: 6, GP: 20 }),
  candidate('Tiny Sample', { PTS: 31, GP: 2 }),
];

const setMinPpg = (value: string) => {
  fireEvent.click(screen.getByText('Build Pool From Filters'));
  fireEvent.click(screen.getByText('Stats'));
  const ppgRow = screen.getByText('PPG').parentElement as HTMLElement;
  fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: 'gt' } });
  fireEvent.change(within(ppgRow).getByRole('spinbutton'), { target: { value } });
};

describe('FilterPoolPanel', () => {
  afterEach(cleanup);

  it('adds every player matching the filters, honouring minimum games', () => {
    const onAdd = vi.fn();
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('20');

    // Tiny Sample (2 games) is excluded by the default 10-game minimum
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByText('Add 2 to pool'));
    expect(onAdd.mock.calls[0][0].map((p: RosterManagerPlayer) => p.id)).toEqual([
      'Scorer',
      'Starter',
    ]);
  });

  it('only adds players not already in the pool', () => {
    const onAdd = vi.fn();
    render(
      <FilterPoolPanel candidates={candidates} poolIds={new Set(['Scorer'])} onAdd={onAdd} />
    );

    setMinPpg('20');

    expect(screen.getByText(/1 already in pool/)).toBeTruthy();
    fireEvent.click(screen.getByText('Add 1 to pool'));
    expect(onAdd.mock.calls[0][0].map((p: RosterManagerPlayer) => p.id)).toEqual([
      'Starter',
    ]);
  });

  it('switching a stat back to "Any" removes that filter', () => {
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={vi.fn()} />);

    setMinPpg('20');
    const ppgRow = screen.getByText('PPG').parentElement as HTMLElement;
    fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: '' } });

    expect(screen.getByText('Set a filter to see matching players.')).toBeTruthy();
  });
});
