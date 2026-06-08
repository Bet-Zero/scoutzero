// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeamRosterView from '@/pages/TeamRosterView';
import RostersHome from '@/pages/RostersHome';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  fetchAllRosterProjects,
  loadRosterProject,
  renameRosterProject,
  updateRosterProject,
} from '@/firebase/rosterHelpers';

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});

vi.mock('@/shared/hooks/useSimplePlayerData', () => {
  const useSimplePlayerData = vi.fn();
  return { default: useSimplePlayerData, useSimplePlayerData };
});

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/firebase/rosterHelpers', () => ({
  createRosterProject: vi.fn(),
  deleteRosterProject: vi.fn(),
  fetchAllRosterProjects: vi.fn(),
  loadRosterProject: vi.fn(),
  renameRosterProject: vi.fn(),
  updateRosterProject: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

vi.mock('@/shared/components/ui/drawers/DrawerShell', () => {
  const DrawerShell = ({ isOpen, children }) =>
    isOpen ? <div>{children}</div> : null;
  return { default: DrawerShell, DrawerShell };
});

vi.mock('@/features/lists/ListSearchBar', () => {
  const ListSearchBar = () => (
    <div data-testid="roster-search-bar">Roster search</div>
  );
  return { default: ListSearchBar, ListSearchBar };
});

const mockedUseSimplePlayerData = vi.mocked(useSimplePlayerData);
const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchAllRosterProjects = vi.mocked(fetchAllRosterProjects);
const mockedLoadRosterProject = vi.mocked(loadRosterProject);
const mockedRenameRosterProject = vi.mocked(renameRosterProject);
const mockedUpdateRosterProject = vi.mocked(updateRosterProject);

const createTimestamp = (date) => ({
  toDate: () => date,
});

const createPlayer = (id, teamCode = 'LAL') => ({
  id,
  name: `Player ${id}`,
  bio: {
    playerId: id,
    displayName: `Player ${id}`,
    position: 'G',
    display: {
      team: teamCode,
      teamId: teamCode,
    },
  },
  currentSeasonStats: {
    MIN: '30.0',
  },
  currentContractView: {
    salaryByYear: {
      2025: 10_000_000,
    },
  },
});

const renderRosterRoute = (initialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/roster/:rosterId" element={<TeamRosterView />} />
      </Routes>
    </MemoryRouter>
  );

const renderRosterHome = () =>
  render(
    <MemoryRouter initialEntries={['/rosters']}>
      <Routes>
        <Route path="/rosters" element={<RostersHome />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: { uid: 'user-1' },
    userId: 'user-1',
    loading: false,
  });
  mockedUseSimplePlayerData.mockReturnValue({
    players: [],
    loading: false,
    error: null,
  });
  mockedFetchAllRosterProjects.mockReset();
  mockedLoadRosterProject.mockReset();
  mockedRenameRosterProject.mockReset();
  mockedUpdateRosterProject.mockReset();
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Roster Builder saved-roster flows', () => {
  it('deep-links saved rosters by route id, disables team changes, preserves missing players, and overwrites with unresolved ids intact', async () => {
    const knownPlayer = createPlayer('known-player');

    mockedUseSimplePlayerData.mockReturnValue({
      players: [knownPlayer],
      loading: false,
      error: null,
    });
    mockedFetchAllRosterProjects.mockResolvedValue([
      {
        id: 'saved-roster',
        name: 'Saved Roster',
        team: 'lakers',
        starters: ['known-player', 'missing-player-id'],
        rotation: [],
        bench: [],
      },
    ]);
    mockedLoadRosterProject.mockResolvedValue({
      id: 'saved-roster',
      name: 'Saved Roster',
      team: 'lakers',
      starters: ['known-player', 'missing-player-id'],
      rotation: [],
      bench: [],
    });
    mockedUpdateRosterProject.mockResolvedValue(undefined);

    renderRosterRoute('/roster/saved-roster');

    await waitFor(() => {
      expect(mockedLoadRosterProject).toHaveBeenCalledWith(
        'saved-roster',
        'user-1'
      );
    });

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing IDs: missing-player-id/i)).toBeInTheDocument();

    const [teamSelect] = screen.getAllByRole('combobox');
    expect(teamSelect).toBeDisabled();
    expect(teamSelect).toHaveValue('lakers');

    fireEvent.click(screen.getByRole('button', { name: 'Save Roster' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Overwrite' }));

    await waitFor(() => {
      expect(mockedUpdateRosterProject).toHaveBeenCalledWith(
        'saved-roster',
        'user-1',
        expect.objectContaining({
          team: 'lakers',
          starters: expect.arrayContaining([
            'known-player',
            'missing-player-id',
          ]),
        })
      );
    });
  });

  it('disables the global add button when the roster is already full', async () => {
    const fullRosterPlayers = Array.from({ length: 15 }, (_, index) =>
      createPlayer(`full-player-${index + 1}`)
    );

    mockedUseSimplePlayerData.mockReturnValue({
      players: fullRosterPlayers,
      loading: false,
      error: null,
    });
    mockedFetchAllRosterProjects.mockResolvedValue([
      {
        id: 'full-roster',
        name: 'Full Roster',
        team: 'lakers',
      },
    ]);
    mockedLoadRosterProject.mockResolvedValue({
      id: 'full-roster',
      name: 'Full Roster',
      team: 'lakers',
      starters: fullRosterPlayers.slice(0, 5).map((player) => player.id),
      rotation: fullRosterPlayers.slice(5, 9).map((player) => player.id),
      bench: fullRosterPlayers.slice(9, 15).map((player) => player.id),
    });

    renderRosterRoute('/roster/full-roster');

    const addButton = await screen.findByRole('button', {
      name: 'Roster is full. Remove a player to add another.',
    });

    expect(addButton).toBeDisabled();
  });
});

describe('Rosters Home rename flow', () => {
  it('refreshes updated metadata after a rename through roster helpers', async () => {
    mockedFetchAllRosterProjects
      .mockResolvedValueOnce([
        {
          id: 'roster-1',
          name: 'Original Name',
          team: 'lakers',
          starters: [],
          rotation: [],
          bench: [],
          updatedAt: createTimestamp(new Date(2026, 2, 1, 10, 0, 0)),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'roster-1',
          name: 'Renamed Roster',
          team: 'lakers',
          starters: [],
          rotation: [],
          bench: [],
          updatedAt: createTimestamp(new Date(2026, 2, 1, 14, 30, 0)),
        },
      ]);
    mockedRenameRosterProject.mockResolvedValue(undefined);

    renderRosterHome();

    expect(await screen.findByText('Original Name')).toBeInTheDocument();
    const initialUpdatedText = screen.getByText(/Last updated /i).textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByPlaceholderText('New name'), {
      target: { value: 'Renamed Roster' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedRenameRosterProject).toHaveBeenCalledWith(
        'roster-1',
        'Renamed Roster',
        'user-1'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Renamed Roster')).toBeInTheDocument();
    });

    expect(screen.getByText(/Last updated /i).textContent).not.toBe(
      initialUpdatedText
    );
  });
});
