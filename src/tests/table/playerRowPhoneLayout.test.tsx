import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoizedPlayerRow as PlayerRow } from '@/features/table/PlayerTable/PlayerRow';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';

vi.mock('@/features/lists/AddToListButton', () => ({
  AddToListButton: () => null,
}));

const player = {
  id: 'test_player',
  name: 'Test Player',
  formattedPosition: 'PG',
  age: 27.6,
  PPG: 31.24,
  RPG: 5.06,
  APG: 6.4,
  offenseRole: 'Primary Ball Handler',
  defenseRole: 'Point of Attack',
  overallGrade: 96,
  bio: { displayName: 'Test Player', height: 78, weight: 195 },
  currentContractView: { currentSalary: 38_300_000, yearsRemaining: 3 },
} as unknown as SimplePlayer;

const setPhoneViewport = (isPhone: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isPhone,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
};

const renderRow = (sortBy?: string, onToggleExpand = () => {}) =>
  render(
    <MemoryRouter>
      <PlayerRow
        player={player}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
        sortBy={sortBy}
      />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PlayerRow phone layout', () => {
  it('keeps the desktop strip with all three box-score stats on wide screens', () => {
    setPhoneViewport(false);
    renderRow();
    expect(screen.getByText('PPG')).toBeTruthy();
    expect(screen.getByText('RPG')).toBeTruthy();
    expect(screen.getByText('APG')).toBeTruthy();
  });

  it('shows name, contract, roles, grade and PPG by default on phones', () => {
    setPhoneViewport(true);
    renderRow('name');
    expect(screen.getByRole('button', { name: 'Test Player' })).toBeTruthy();
    expect(screen.getByText('$38.3M')).toBeTruthy();
    expect(screen.getByText('Primary Ball Handler')).toBeTruthy();
    expect(screen.getByText('Point of Attack')).toBeTruthy();
    expect(screen.getByTitle('Overall Grade').textContent).toBe('96');
    expect(screen.getByText('PPG')).toBeTruthy();
    expect(screen.getByText('31.2')).toBeTruthy();
    expect(screen.queryByText('RPG')).toBeNull();
  });

  it('shows the stat the table is sorted by on phones', () => {
    setPhoneViewport(true);
    renderRow('REB');
    expect(screen.getByText('RPG')).toBeTruthy();
    expect(screen.getByText('5.1')).toBeTruthy();
    cleanup();

    renderRow('age');
    expect(screen.getByText('AGE')).toBeTruthy();
    expect(screen.getByText('27')).toBeTruthy();
  });

  it('opens the drawer once from a row tap or the chevron on phones', () => {
    setPhoneViewport(true);
    const onToggleExpand = vi.fn();
    renderRow(undefined, onToggleExpand);
    fireEvent.click(screen.getByText('$38.3M'));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Expand player details' }));
    expect(onToggleExpand).toHaveBeenCalledTimes(2);
  });
});
