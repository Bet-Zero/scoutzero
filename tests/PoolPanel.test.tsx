import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoolPanel } from '@/features/ranker/PoolPanel';
import { PoolSourceMenus } from '@/features/ranker/PoolSourceMenus';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const player = (id: string, name: string) =>
  ({
    id,
    name,
    bio: { displayName: name, position: 'PG', display: { teamId: 'BOS' } },
  }) as unknown as RosterManagerPlayer;

const pool = [player('a', 'Jayson Tatum'), player('b', 'Jaylen Brown')];
const noList = { listSize: null, onListSizeChange: vi.fn() };

describe('PoolPanel', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('switches between list and tiles, remembers the choice, and removes players', () => {
    const onRemove = vi.fn();
    render(
      <PoolPanel pool={pool} onRemove={onRemove} onClear={vi.fn()} onStart={vi.fn()} {...noList} />
    );

    expect(screen.getByText('Jayson Tatum')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tiles' }));
    // Tiles split the name: first name above, last name below
    expect(screen.getByText('TATUM')).toBeTruthy();
    expect(localStorage.getItem('ranker.poolView')).toBe('tiles');

    fireEvent.click(screen.getByLabelText('Remove Jaylen Brown'));
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('only allows starting with at least two players', () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <PoolPanel pool={pool.slice(0, 1)} onRemove={vi.fn()} onClear={vi.fn()} onStart={onStart} {...noList} />
    );
    const start = screen.getByRole('button', { name: 'Start Ranking →' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText('Add at least 2 players to begin')).toBeTruthy();

    rerender(<PoolPanel pool={pool} onRemove={vi.fn()} onClear={vi.fn()} onStart={onStart} {...noList} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Ranking →' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('picks a list length above Start Ranking, offering only sizes shorter than the pool', () => {
    const big = Array.from({ length: 30 }, (_, i) => player(`p${i}`, `Player ${i}`));
    const onListSizeChange = vi.fn();
    const panel = (listSize: number | null) => (
      <PoolPanel
        pool={big}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onStart={vi.fn()}
        listSize={listSize}
        onListSizeChange={onListSizeChange}
      />
    );
    const { rerender } = render(panel(null));
    const select = screen.getByLabelText('List') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(['Rank everyone (30)', 'Top 10', 'Top 20', 'Custom…']);

    fireEvent.change(select, { target: { value: '20' } });
    expect(onListSizeChange).toHaveBeenLastCalledWith(20);
    rerender(panel(20));
    expect(screen.getByText(/Builds your Top 20 first/)).toBeTruthy();

    // A custom size is capped below the pool size
    fireEvent.change(select, { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Custom list size'), { target: { value: '45' } });
    expect(onListSizeChange).toHaveBeenLastCalledWith(29);
    // A one-player list isn't offered: typing 1 (on the way to 15) keeps the digit but sets nothing
    fireEvent.change(screen.getByLabelText('Custom list size'), { target: { value: '1' } });
    expect(onListSizeChange).toHaveBeenLastCalledWith(null);
    expect((screen.getByLabelText('Custom list size') as HTMLInputElement).value).toBe('1');

    // A Top-N pull from outside leaves custom entry for its preset
    rerender(panel(10));
    expect(select.value).toBe('10');
    expect(screen.queryByLabelText('Custom list size')).toBeNull();

    // A Top-N pull bigger than the pool ranks everyone
    rerender(panel(50));
    expect(screen.queryByText(/Builds your Top/)).toBeNull();
  });
});

describe('PoolSourceMenus', () => {
  afterEach(cleanup);

  it('adds a whole team from the Team menu and closes it', () => {
    const onAddTeam = vi.fn();
    render(
      <PoolSourceMenus lists={[]} signedIn={false} onAddTeam={onAddTeam} onAddList={vi.fn()} />
    );

    const teamButton = screen.getByRole('button', { name: 'Team' });
    fireEvent.click(teamButton);
    fireEvent.click(screen.getByLabelText('Add the Boston Celtics roster'));
    expect(onAddTeam).toHaveBeenCalledWith('celtics');
    expect(screen.queryByRole('region', { name: 'Add a whole roster' })).toBeNull();
    expect(document.activeElement).toBe(teamButton);
  });

  it('moves focus into an opened menu and back to its button on Escape', () => {
    render(
      <PoolSourceMenus lists={[]} signedIn={false} onAddTeam={vi.fn()} onAddList={vi.fn()} />
    );
    const teamButton = screen.getByRole('button', { name: 'Team' });
    fireEvent.click(teamButton);
    expect(teamButton.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Add the Atlanta Hawks roster'));

    // Focus leaving to nowhere (Safari doesn't focus clicked buttons) keeps it open
    fireEvent.blur(screen.getByLabelText('Add the Atlanta Hawks roster'), { relatedTarget: null });
    expect(screen.getByRole('region', { name: 'Add a whole roster' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Add a whole roster' })).toBeNull();
    expect(document.activeElement).toBe(teamButton);
  });

  it('closes when focus tabs out to another control', () => {
    render(
      <>
        <PoolSourceMenus lists={[]} signedIn={false} onAddTeam={vi.fn()} onAddList={vi.fn()} />
        <button>Elsewhere</button>
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    fireEvent.blur(screen.getByLabelText('Add the Atlanta Hawks roster'), {
      relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }),
    });
    expect(screen.queryByRole('region', { name: 'Add a whole roster' })).toBeNull();
  });

  it('asks signed-out users to sign in before importing lists', () => {
    render(
      <PoolSourceMenus lists={[]} signedIn={false} onAddTeam={vi.fn()} onAddList={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByText('Sign in to import your saved lists.')).toBeTruthy();
  });
});
