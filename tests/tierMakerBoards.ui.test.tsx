// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TierMakerBoard } from '@/features/tierMaker/TierMakerBoard';
import { TieramidBoard } from '@/features/tierMaker/TieramidBoard';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { useFirebaseQuery } from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';

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

vi.mock('@/shared/hooks/useFirebaseQuery', () => {
  const useFirebaseQuery = vi.fn();
  return { default: useFirebaseQuery, useFirebaseQuery };
});

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/firebase/listHelpers', () => ({
  fetchTierList: vi.fn(),
  saveTierList: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

vi.mock('@/features/lists/TierPlayerTile', () => {
  const TierPlayerTile = ({ player }) => (
    <div data-testid={`tier-player-${player.player_id || player.id}`}>
      {player.bio?.displayName || player.name || player.id}
    </div>
  );
  return { default: TierPlayerTile, TierPlayerTile };
});

vi.mock('@/features/tierMaker/TieramidPlayerTile', () => {
  const TieramidPlayerTile = ({ player }) => (
    <div data-testid={`tieramid-player-${player.player_id || player.id}`}>
      {player.bio?.displayName || player.name || player.id}
    </div>
  );
  return { default: TieramidPlayerTile, TieramidPlayerTile };
});

vi.mock('@/shared/components/ui/drawers/DrawerShell', () => {
  const DrawerShell = ({ children }) => <div>{children}</div>;
  return { default: DrawerShell, DrawerShell };
});

vi.mock('@/shared/components/ui/drawers/OpenDrawerButton', () => {
  const OpenDrawerButton = ({ onClick }) => (
    <button onClick={onClick}>Open Drawer</button>
  );
  return { default: OpenDrawerButton, OpenDrawerButton };
});

vi.mock('@/features/roster/AddPlayerDrawer', () => {
  const AddPlayerDrawer = () => <div>Add Player Drawer</div>;
  return { default: AddPlayerDrawer, AddPlayerDrawer };
});

vi.mock('@/features/roster/AddPlayerDrawer/index.jsx', () => {
  const AddPlayerDrawer = () => <div>Add Player Drawer</div>;
  return { default: AddPlayerDrawer, AddPlayerDrawer };
});

vi.mock('@/features/tierMaker/CreateTierListModal', () => {
  const CreateTierListModal = () => null;
  return { default: CreateTierListModal, CreateTierListModal };
});

const mockedUseSimplePlayerData = vi.mocked(useSimplePlayerData);
const mockedUseFirebaseQuery = vi.mocked(useFirebaseQuery);
const mockedUseAuth = vi.mocked(useAuth);

const PLAYER_FIXTURES = [
  {
    id: 'p1',
    name: 'Player One',
    bio: {
      displayName: 'Player One',
      display: {
        team: 'AAA',
        teamId: 'AAA',
      },
    },
  },
  {
    id: 'p2',
    name: 'Player Two',
    bio: {
      displayName: 'Player Two',
      display: {
        team: 'BBB',
        teamId: 'BBB',
      },
    },
  },
  {
    id: 'p3',
    name: 'Player Three',
    bio: {
      displayName: 'Player Three',
      display: {
        team: 'CCC',
        teamId: 'CCC',
      },
    },
  },
];

beforeEach(() => {
  mockedUseSimplePlayerData.mockReturnValue({
    players: PLAYER_FIXTURES,
    loading: false,
    error: null,
  });
  mockedUseFirebaseQuery.mockReturnValue({
    data: [],
    loading: false,
    error: null,
  });
  mockedUseAuth.mockReturnValue({
    userId: 'user-1',
    loading: false,
  });
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Tiermaker board controls', () => {
  it('hides Pool entirely in screenshot mode', async () => {
    render(
      <TierMakerBoard
        isDraftMode
        draftData={{
          tiers: {
            Top: ['p1'],
            Pool: ['p2'],
          },
          tierOrder: ['Top', 'Pool'],
        }}
      />
    );

    await screen.findByTestId('tier-player-p2');
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot View' }));

    await waitFor(() => {
      expect(screen.queryByText(/^Pool$/)).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('tier-player-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('tier-player-p2')).not.toBeInTheDocument();
  });

  it('uses position-based controls for renamed top tiers and Pool', async () => {
    render(
      <TierMakerBoard
        isDraftMode
        draftData={{
          tiers: {
            Top: ['p1'],
            Pool: ['p2'],
          },
          tierOrder: ['Top', 'Pool'],
        }}
      />
    );

    const topPlayerCard = (await screen.findByTestId('tier-player-p1')).closest(
      '.relative'
    );
    const poolPlayerCard = screen.getByTestId('tier-player-p2').closest('.relative');

    expect(within(topPlayerCard).queryByText('↑')).not.toBeInTheDocument();
    expect(within(topPlayerCard).getByText('↓')).toBeInTheDocument();
    expect(within(poolPlayerCard).queryByText('✕')).not.toBeInTheDocument();
  });
});

describe('Tieramid board controls', () => {
  it('disables impossible edge moves while keeping the controls visible', async () => {
    render(
      <TieramidBoard
        isDraftMode
        draftData={{
          rows: {
            Row1: ['p1'],
            Row2: ['p2', 'p3'],
            Pool: [],
          },
          rowOrder: ['Row1', 'Row2', 'Pool'],
        }}
      />
    );

    const topPlayerCard = (await screen.findByTestId('tieramid-player-p1')).closest(
      '.relative'
    );
    const bottomLeftCard = screen
      .getByTestId('tieramid-player-p2')
      .closest('.relative');
    const bottomRightCard = screen
      .getByTestId('tieramid-player-p3')
      .closest('.relative');

    expect(within(topPlayerCard).getByTitle('Move Up')).toBeDisabled();
    expect(within(topPlayerCard).getByTitle('Move Left')).toBeDisabled();
    expect(within(bottomLeftCard).getByTitle('Move Down')).toBeDisabled();
    expect(within(bottomLeftCard).getByTitle('Move Left')).toBeDisabled();
    expect(within(bottomRightCard).getByTitle('Move Down')).toBeDisabled();
    expect(within(bottomRightCard).getByTitle('Move Right')).toBeDisabled();
  });
});
