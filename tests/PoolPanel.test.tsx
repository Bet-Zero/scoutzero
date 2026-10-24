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

describe('PoolPanel', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('switches between list and tiles, remembers the choice, and removes players', () => {
    const onRemove = vi.fn();
    render(
      <PoolPanel pool={pool} onRemove={onRemove} onClear={vi.fn()} onStart={vi.fn()} />
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
      <PoolPanel pool={pool.slice(0, 1)} onRemove={vi.fn()} onClear={vi.fn()} onStart={onStart} />
    );
    const start = screen.getByRole('button', { name: 'Start Ranking →' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText('Add at least 2 players to begin')).toBeTruthy();

    rerender(<PoolPanel pool={pool} onRemove={vi.fn()} onClear={vi.fn()} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Ranking →' }));
    expect(onStart).toHaveBeenCalled();
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
