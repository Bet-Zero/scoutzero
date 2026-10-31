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
          : playerId === 'MaxGuy'
            ? { team: 'DAL', stats: { PTS: 1, GP: 40 } }
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

import { PoolWorkbench } from '@/features/ranker/PoolWorkbench';
import { getRecentPastSeasonCodes } from '@/features/ranker/hooks/useSeasonViews';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const lastSeason = () => getRecentPastSeasonCodes(1)[0];

const candidate = (
  id: string,
  stats: Record<string, number>,
  dob?: string,
  age?: number,
  salary = 10_000_000
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
  salary,
  freeAgentYear: null,
  freeAgentType: '',
  contractType: '',
  extension: null,
  options: [],
  original: {
    id,
    name: id,
    age,
    bio: { displayName: id, dob },
    currentSeasonStats: stats,
  } as unknown as RosterManagerPlayer,
});

const candidates = [
  candidate('Scorer', { PTS: 26, GP: 20 }),
  candidate('Starter', { PTS: 21, GP: 18 }),
  // No date of birth; current age 30
  candidate('Bench', { PTS: 6, GP: 20 }, undefined, 30),
  candidate('Tiny Sample', { PTS: 31, GP: 2 }),
  // Born Jan 15, 40 years before last season's Feb 1
  candidate('Vet', { PTS: 12, GP: 20 }, `${Number(lastSeason().slice(0, 4)) + 1 - 40}-01-15`),
];

// The PPG filter row (the results table also has a PPG column header)
const ppgFilterRow = () =>
  screen.getAllByText('PPG').find((el) => el.tagName !== 'TH')
    ?.parentElement as HTMLElement;

const setMinPpg = (value: string) => {
  // The filters column starts open
  fireEvent.click(screen.getByText('Stats'));
  const ppgRow = ppgFilterRow();
  fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: 'gt' } });
  fireEvent.change(within(ppgRow).getByRole('spinbutton'), { target: { value } });
};

const addedIds = (onAdd: ReturnType<typeof vi.fn>, call = 0) =>
  onAdd.mock.calls[call][0].map((p: RosterManagerPlayer) => p.id);

describe('PoolWorkbench', () => {
  afterEach(() => {
    cleanup();
    // Top-N scores are cached in the browser; keep tests independent
    localStorage.clear();
  });

  it('hides the filters column without dropping active filters', () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('20');
    fireEvent.click(screen.getByRole('button', { name: 'Hide filters' }));

    expect(screen.queryByText('Stats')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show filters (on)' })).toBeTruthy();
    fireEvent.click(screen.getByText('Add all 2'));
    expect(addedIds(onAdd)).toEqual(['Scorer', 'Starter']);
  });

  it('adds every player matching the filters, honouring minimum games', () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('20');

    // Tiny Sample (2 games) is excluded by the default 10-game minimum
    fireEvent.click(screen.getByText('Add all 2'));
    expect(addedIds(onAdd)).toEqual(['Scorer', 'Starter']);
  });

  it('finds a player by name search and adds just that player', () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Search players by name'), {
      target: { value: 'star' },
    });

    expect(screen.queryByText('Bench')).toBeNull();
    fireEvent.click(screen.getByLabelText('Add Starter'));
    expect(addedIds(onAdd)).toEqual(['Starter']);
  });

  it('adds only the selected players', () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    setMinPpg('5');
    fireEvent.click(screen.getByLabelText('Select Bench'));
    fireEvent.click(screen.getByLabelText('Select Vet'));
    fireEvent.click(screen.getByText('Add selected (2)'));
    expect(addedIds(onAdd)).toEqual(['Bench', 'Vet']);
  });

  it('marks players already in the pool and leaves them out of add all', () => {
    const onAdd = vi.fn();
    render(
      <PoolWorkbench candidates={candidates} poolIds={new Set(['Scorer'])} onAdd={onAdd} />
    );

    setMinPpg('20');

    expect(screen.getByText(/1 already in pool/)).toBeTruthy();
    expect(screen.getByText('In pool')).toBeTruthy();
    fireEvent.click(screen.getByText('Add all 1'));
    expect(addedIds(onAdd)).toEqual(['Starter']);
  });

  it('switching a stat back to "Any" removes that filter', () => {
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={vi.fn()} />);

    setMinPpg('20');
    const ppgRow = ppgFilterRow();
    fireEvent.change(within(ppgRow).getByRole('combobox'), { target: { value: '' } });

    expect(screen.getByText('Search for a player or set a filter to see players.')).toBeTruthy();
  });

  it("shows and filters on a past season's team, salary and stats", async () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

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

  it('prefers a stored season age over an estimate when there is no date of birth', async () => {
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: lastSeason() } });
    fireEvent.change(screen.getByLabelText('Search players by name'), {
      target: { value: 'bench' },
    });

    // The season doc says 25; the estimate (30 minus one season) would be 29
    await waitFor(() => expect(screen.getByText('Bench')).toBeTruthy());
    const row = screen.getByText('Bench').closest('tr') as HTMLElement;
    expect(within(row).getByText('25')).toBeTruthy();
  });

  it('Top-N preset pulls the best scorers, pre-ticked, to untick and add', async () => {
    const onAdd = vi.fn();
    render(<PoolWorkbench candidates={candidates} poolIds={new Set()} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: lastSeason() } });
    fireEvent.click(screen.getByText('Top 10'));

    // Scorer has no record that season; Vet's 24.4 PPG line scores highest
    await waitFor(() => expect(screen.getByText('Add selected (4)')).toBeTruthy());
    // Everyone starts ticked, so only the ticked can be added (no "Add all")
    expect(screen.queryByText(/^Add all/)).toBeNull();
    // The usual candidates are ticked, and the count says so
    expect(screen.getByLabelText<HTMLInputElement>('How many of the top to tick').value).toBe('4');
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('Vet')).toBeTruthy();
    // Rank column (after the checkbox)
    expect(firstRow.querySelectorAll('td')[1].textContent).toBe('1');
    expect(screen.queryByText('Scorer')).toBeNull();

    fireEvent.click(screen.getByLabelText('Select Bench'));
    fireEvent.click(screen.getByText('Add selected (3)'));
    expect(addedIds(onAdd)).toEqual(['Vet', 'Starter', 'Tiny Sample']);
  });

  it('Top-N lists everyone: the best paid are ticked too, and the rest can be ticked by hand', async () => {
    const onAdd = vi.fn();
    const crowd = [
      ...Array.from({ length: 34 }, (_, i) =>
        candidate(`Filler ${i}`, { PTS: 5, GP: 40 }, undefined, undefined, 1_000_000)
      ),
      // Weak box score, top salary
      candidate('MaxGuy', { PTS: 1, GP: 40 }, undefined, undefined, 60_000_000),
    ];
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Top 10'));

    // 26 by stats plus MaxGuy by pay start ticked; all 35 are listed
    await waitFor(() => expect(screen.getByText('Add selected (27)')).toBeTruthy());
    expect(screen.getAllByRole('row')).toHaveLength(36);
    const row = screen.getByText('MaxGuy').closest('tr') as HTMLElement;
    expect(row.querySelectorAll('td')[1].textContent).toBe('2');
    expect(screen.getByLabelText<HTMLInputElement>('Select Filler 33').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Select Filler 33'));
    fireEvent.click(screen.getByText('Add selected (28)'));
    expect(addedIds(onAdd)).toContain('Filler 33');
    expect(addedIds(onAdd)).toHaveLength(28);
  });

  it('Top-N pulls leave out players without a team unless asked, and set the list size', async () => {
    const onTopNChange = vi.fn();
    const unsigned = { ...candidate('Unsigned', { PTS: 30, GP: 20 }), team: '', teamCode: '' };
    render(
      <PoolWorkbench
        candidates={[...candidates, unsigned]}
        poolIds={new Set()}
        onAdd={vi.fn()}
        onTopNChange={onTopNChange}
      />
    );
    fireEvent.click(screen.getByText('Top 10'));
    expect(onTopNChange).toHaveBeenLastCalledWith(10);

    const toggle = await screen.findByLabelText(/Include players without a team \(1\)/);
    expect(screen.queryByText('Unsigned')).toBeNull();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('Unsigned')).toBeTruthy());
  });

  it('ticks exactly the top N on request, and the count matches the ticks', async () => {
    const crowd = Array.from({ length: 40 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.5, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText('Top 10'));
    const box = await screen.findByLabelText<HTMLInputElement>('How many of the top to tick');
    expect(box.value).toBe('26');
    expect(screen.getByText('Add selected (26)')).toBeTruthy();

    fireEvent.change(box, { target: { value: '15' } });
    // Typing alone changes nothing; the button (or Enter) applies it
    expect(screen.getByText('Add selected (26)')).toBeTruthy();
    fireEvent.click(screen.getByText('Tick only the top'));
    expect(screen.getByText('Add selected (15)')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 14').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 15').checked).toBe(false);
  });

  it('adding one player with + keeps everyone else ticked', async () => {
    const onAdd = vi.fn();
    const crowd = Array.from({ length: 40 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.5, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Top 10'));
    await screen.findByText('Add selected (26)');
    // An unticked player, then a ticked one
    fireEvent.click(screen.getByLabelText('Add Player 30'));
    expect(addedIds(onAdd)).toEqual(['Player 30']);
    expect(screen.getByText('Add selected (26)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add Player 3'));
    expect(screen.getByText('Add selected (25)')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 4').checked).toBe(true);
  });

  it('shift-click ticks or unticks a whole run', async () => {
    const crowd = Array.from({ length: 40 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.5, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText('Top 10'));
    await screen.findByText('Add selected (26)');
    // Untick Player 10, then shift-click Player 19: 10-19 are unticked
    fireEvent.click(screen.getByLabelText('Select Player 10'));
    fireEvent.click(screen.getByLabelText('Select Player 19'), { shiftKey: true });
    expect(screen.getByText('Add selected (16)')).toBeTruthy();
    for (const i of [10, 15, 19])
      expect(screen.getByLabelText<HTMLInputElement>(`Select Player ${i}`).checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 20').checked).toBe(true);
    // And back on: tick 30, shift-click 34
    fireEvent.click(screen.getByLabelText('Select Player 30'));
    fireEvent.click(screen.getByLabelText('Select Player 34'), { shiftKey: true });
    expect(screen.getByText('Add selected (21)')).toBeTruthy();
  });

  it('dragging down the boxes paints a run', async () => {
    const crowd = Array.from({ length: 40 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.5, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText('Top 10'));
    await screen.findByText('Add selected (26)');
    const cell = (i: number) =>
      screen.getByLabelText(`Select Player ${i}`).closest('td') as HTMLElement;
    // Press on 30 (unticked), move over 31 and jump to 35: 30-35 are ticked
    fireEvent.pointerDown(cell(30), { button: 0, pointerType: 'mouse' });
    fireEvent.pointerOver(cell(31));
    fireEvent.pointerOver(cell(35));
    fireEvent.pointerUp(window);
    expect(screen.getByText('Add selected (32)')).toBeTruthy();
    for (const i of [30, 33, 35])
      expect(screen.getByLabelText<HTMLInputElement>(`Select Player ${i}`).checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 36').checked).toBe(false);
  });

  it('a search narrows the list without losing ticks; tick or untick everyone shown', async () => {
    const onAdd = vi.fn();
    const crowd = Array.from({ length: 40 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.5, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Top 10'));
    await screen.findByText('Add selected (26)');
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Player 1' } });
    // Player 1 and 10-19 are shown; the other ticks are kept but out of view
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(12));
    expect(screen.getByText(/\(15 not shown\)/)).toBeTruthy();
    fireEvent.click(screen.getByText('Untick all shown'));
    expect(screen.getByText('Add selected (15)')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '' } });
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(41));
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 12').checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>('Select Player 2').checked).toBe(true);
    fireEvent.click(screen.getByText('Add selected (15)'));
    expect(addedIds(onAdd)).not.toContain('Player 12');
  });

  it('sorting by Yr brings rookies and second-year players together', async () => {
    const withYears = (id: string, pts: number, yearsPro: number) => {
      const c = candidate(id, { PTS: pts, GP: 40 });
      return {
        ...c,
        original: {
          ...c.original,
          bio: { ...c.original.bio, display: { yearsPro } },
        } as unknown as RosterManagerPlayer,
      };
    };
    render(
      <PoolWorkbench
        candidates={[
          withYears('Veteran', 25, 9),
          withYears('Rookie', 8, 0),
          withYears('Sophomore', 10, 1),
          withYears('Middle', 15, 5),
        ]}
        poolIds={new Set()}
        onAdd={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Top 10'));
    await screen.findByText('Add selected (4)');
    const names = () =>
      screen.getAllByRole('row').slice(1).map((r) => r.querySelectorAll('td')[2].textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Yr' }));
    expect(names()).toEqual(['Rookie', 'Sophomore', 'Middle', 'Veteran']);
    const rookie = screen.getByText('Rookie').closest('tr') as HTMLElement;
    expect(rookie.querySelectorAll('td')[4].textContent).toBe('R');
  });

  it('a Top-N list shows every ticked candidate, so nobody is added unseen', async () => {
    const onAdd = vi.fn();
    const crowd = Array.from({ length: 80 }, (_, i) =>
      candidate(`Player ${i}`, { PTS: 30 - i * 0.1, GP: 40 })
    );
    render(<PoolWorkbench candidates={crowd} poolIds={new Set()} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Top 50'));

    await waitFor(() => expect(screen.getByText('Add selected (80)')).toBeTruthy());
    // All 80 rows are on screen (plus the header row), with no "show more"
    expect(screen.getAllByRole('row')).toHaveLength(81);
    expect(screen.queryByText(/^Show /)).toBeNull();
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /^80 players · 80 ticked/.test(el.textContent ?? ''))
    ).toBeTruthy();

    // Unticking one far down the list leaves exactly the rest
    fireEvent.click(screen.getByLabelText('Select Player 79'));
    fireEvent.click(screen.getByText('Add selected (79)'));
    expect(addedIds(onAdd)).toHaveLength(79);
    expect(addedIds(onAdd)).not.toContain('Player 79');
  });
});
