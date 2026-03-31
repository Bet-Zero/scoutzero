// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useArchitectState } from '@/features/architect/GMDashboard/hooks/useArchitectState';

const stateMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  getWorldMetadata: vi.fn(),
  getLeague: vi.fn(),
  useArchitectPlayerData: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: stateMocks.loadWorldTeamData,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: stateMocks.getWorldMetadata,
}));

vi.mock('@/features/architect/utils/teamLoader', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/architect/utils/teamLoader')
  >('@/features/architect/utils/teamLoader');
  return {
    ...actual,
    getLeague: stateMocks.getLeague,
  };
});

vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  default: () => stateMocks.useArchitectPlayerData(),
}));

const playersFixture = [
  {
    id: 'player_a',
    player_id: 'player_a',
    name: 'Rostered Player',
    contract: {
      salariesByYear: [{ season: '2027-28', salary: 20_000_000 }],
    },
  },
  {
    id: 'player_b',
    player_id: 'player_b',
    name: 'World Released Player',
    contract: {
      salariesByYear: [{ season: '2027-28', salary: 18_000_000 }],
    },
  },
  {
    id: 'player_c',
    player_id: 'player_c',
    name: 'Natural Free Agent',
    contract: null,
  },
];

const teamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: ['player_a'],
  players: [],
  offerSheets: [
    {
      id: 'os_outgoing_1',
      playerId: 'player_b',
      playerName: 'World Released Player',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      seasonKey: '2027-28',
      status: 'PENDING_MATCH',
    },
  ],
  incomingOfferSheets: [
    {
      id: 'os_incoming_1',
      playerId: 'player_z',
      playerName: 'Incoming Offer Player',
      offeringTeamCode: 'BOS',
      homeTeamCode: 'LAL',
      seasonKey: '2027-28',
      status: 'PENDING_MATCH',
    },
  ],
  capHolds: [],
  exceptions: {},
  totals: {},
};

describe('useArchitectState world-aware free agency pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    stateMocks.useArchitectPlayerData.mockReturnValue({
      players: playersFixture,
      loading: false,
      error: null,
    });
    stateMocks.loadWorldTeamData.mockResolvedValue(teamFixture);
    stateMocks.getWorldMetadata.mockResolvedValue({ asOfDate: '2026-07-01' });
  });

  it('excludes world-rostered players and includes unrostered players after refresh', async () => {
    stateMocks.getLeague
      .mockResolvedValueOnce([
        {
          teamCode: 'LAL',
          roster: ['player_a'],
          players: [{ id: 'player_a' }],
        },
      ])
      .mockResolvedValueOnce([
        {
          teamCode: 'LAL',
          roster: ['player_a', 'player_b'],
          players: [{ id: 'player_a' }, { id: 'player_b' }],
        },
      ]);

    const { result } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setWorldId('world_1');
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_a');
      expect(playerIds).toContain('player_b');
      expect(playerIds).toContain('player_c');
    });

    await act(async () => {
      await result.current.refreshWorldRosterIndex();
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_b');
    });
  });

  it('fails closed on world roster index load failure and recovers on successful refresh', async () => {
    stateMocks.getLeague
      .mockRejectedValueOnce(new Error('league unavailable'))
      .mockResolvedValueOnce([
        {
          teamCode: 'LAL',
          roster: ['player_a'],
          players: [{ id: 'player_a' }],
        },
      ]);

    const { result } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setWorldId('world_1');
    });

    await waitFor(() => {
      expect(result.current.freeAgents).toEqual([]);
    });

    await act(async () => {
      await result.current.refreshWorldRosterIndex();
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_a');
      expect(playerIds).toContain('player_b');
      expect(playerIds).toContain('player_c');
    });
  });

  it('preserves hydrated offer-sheet arrays through world load and roster-index refresh', async () => {
    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);

    const { result } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setWorldId('world_1');
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet?.offerSheets).toEqual(
        teamFixture.offerSheets
      );
      expect(result.current.teamCapSheet?.incomingOfferSheets).toEqual(
        teamFixture.incomingOfferSheets
      );
    });

    await act(async () => {
      await result.current.refreshWorldRosterIndex();
    });

    expect(result.current.teamCapSheet?.offerSheets).toEqual(
      teamFixture.offerSheets
    );
    expect(result.current.teamCapSheet?.incomingOfferSheets).toEqual(
      teamFixture.incomingOfferSheets
    );
  });
});
