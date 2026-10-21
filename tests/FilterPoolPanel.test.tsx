import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Last season, Vet was on BOS earning $52.6M; Scorer has no record (not in the league)
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: async ({ playerId }: { playerId: string }) => {
    const data =
      playerId === 'Vet'
        ? { team: 'BOS', stats: { PTS: 24.4, REB: 7.8, AST: 8.2, GP: 70 } }
        : playerId === 'Scorer'
          ? undefined
          : { team: 'LAL', age: 25, stats: { PTS: 5, GP: 40 } };
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async ({ playerId }: { playerId: string }) => ({
    docs:
      playerId === 'Vet'
        ? [{ data: () => ({ salariesByYear: [{ season: lastSeason(), salary: 52_600_000 }] }) }]
        : [],
  }),
}));
vi.mock('@/data/firestorePaths', () => ({
  seasonRef: (playerId: string, seasonId: string) => ({ playerId, seasonId }),
  contractsCol: (playerId: string) => ({ playerId }),
}));

import { FilterPoolPanel } from '@/features/ranker/FilterPoolPanel';
import { getRecentPastSeasonCodes } from '@/features/ranker/hooks/useSeasonViews';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const lastSeason = () => getRecentPastSeasonCodes(1)[0];

const candidate = (
  id: string,
  stats: Record<string, number>,
  dob?: string
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
    bio: { displayName: id, dob },
    currentSeasonStats: stats,
  } as unknown as RosterManagerPlayer,
});

const candidates = [
  candidate('Scorer', { PTS: 26, GP: 20 }),
  candidate('Starter', { PTS: 21, GP: 18 }),
  candidate('Bench', { PTS: 6, GP: 20 }),
  candidate('Tiny Sample', { PTS: 31, GP: 2 }),
  // Born Jan 15, 40 years before last season's Feb 1
  candidate('Vet', { PTS: 12, GP: 20 }, `${Number(lastSeason().slice(0, 4)) + 1 - 40}-01-15`),
];

// The PPG filter row (the results table also has a PPG column header)
const ppgFilterRow = () =>
  screen.getAllByText('PPG').find((el) => el.tagName !== 'TH')
    ?.parentElement as HTMLElement;

const setMinPpg = (value: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.click(screen.getByText('Stats'));
  const ppgRow = ppgFilterRow();
  fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: 'gt' } });
  fireEvent.change(within(ppgRow).getByRole('spinbutton'), { target: { value } });
};

const addedIds = (onAdd: ReturnType<typeof vi.fn>, call = 0) =>
  onAdd.mock.calls[call][0].map((p: RosterManagerPlayer) => p.id);

describe('FilterPoolPanel', () => {
  afterEach(cleanup);

  it('adds every player matching the filters, honouring minimum games', () => {
    const onAdd = vi.fn();
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('20');

    // Tiny Sample (2 games) is excluded by the default 10-game minimum
    fireEvent.click(screen.getByText('Add all 2'));
    expect(addedIds(onAdd)).toEqual(['Scorer', 'Starter']);
  });

  it('finds a player by name search and adds just that player', () => {
    const onAdd = vi.fn();
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Search players by name'), {
      target: { value: 'star' },
    });

    expect(screen.queryByText('Bench')).toBeNull();
    fireEvent.click(screen.getByLabelText('Add Starter'));
    expect(addedIds(onAdd)).toEqual(['Starter']);
  });

  it('adds only the selected players', () => {
    const onAdd = vi.fn();
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('5');
    fireEvent.click(screen.getByLabelText('Select Bench'));
    fireEvent.click(screen.getByLabelText('Select Vet'));
    fireEvent.click(screen.getByText('Add selected (2)'));
    expect(addedIds(onAdd)).toEqual(['Bench', 'Vet']);
  });

  it('marks players already in the pool and leaves them out of add all', () => {
    const onAdd = vi.fn();
    render(
      <FilterPoolPanel candidates={candidates} poolIds={new Set(['Scorer'])} onAdd={onAdd} />
    );

    setMinPpg('20');

    expect(screen.getByText(/1 already in pool/)).toBeTruthy();
    expect(screen.getByText('In pool')).toBeTruthy();
    fireEvent.click(screen.getByText('Add all 1'));
    expect(addedIds(onAdd)).toEqual(['Starter']);
  });

  it('switching a stat back to "Any" removes that filter', () => {
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={vi.fn()} />);

    setMinPpg('20');
    const ppgRow = ppgFilterRow();
    fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: '' } });

    expect(screen.getByText('Search for a player or set a filter to see players.')).toBeTruthy();
  });

  it("shows and filters on a past season's team, salary and stats", async () => {
    const onAdd = vi.fn();
    render(<FilterPoolPanel candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: lastSeason() } });
    setMinPpg('20');

    // Only Vet averaged 20+ last season; Scorer has no record for it
    await waitFor(() => expect(screen.getByText('Add all 1')).toBeTruthy());
    const row = screen.getByText('Vet').closest('tr') as HTMLElement;
    expect(within(row).getByText('BOS')).toBeTruthy();
    expect(within(row).getByText('$52.6M')).toBeTruthy();
    expect(within(row).getByText('24.4')).toBeTruthy();
    // The season doc has no age; it comes from date of birth
    expect(within(row).getByText('40')).toBeTruthy();
  });
});
