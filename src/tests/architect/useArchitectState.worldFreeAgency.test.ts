// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useArchitectState } from '@/features/architect/GMDashboard/hooks/useArchitectState';

const stateMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  getWorldMetadata: vi.fn(),
  updateWorldAsOfDate: vi.fn(),
  getLeague: vi.fn(),
  useArchitectPlayerData: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: stateMocks.loadWorldTeamData,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: stateMocks.getWorldMetadata,
  updateWorldAsOfDate: stateMocks.updateWorldAsOfDate,
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

// updated: Wave 3 export-shape change — useArchitectPlayerData is now a named export (see commits 10f5fed7, 692f4f8a)
vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  useArchitectPlayerData: () => stateMocks.useArchitectPlayerData(),
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

function createDeferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

describe('useArchitectState world-aware free agency pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    stateMocks.useArchitectPlayerData.mockReturnValue({
      players: playersFixture,
      loading: false,
      error: null,
    });
    stateMocks.loadWorldTeamData.mockResolvedValue(teamFixture);
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-01',
      currentSeason: '2025-26',
    });
    stateMocks.updateWorldAsOfDate.mockResolvedValue(undefined);
  });

  it('excludes world-rostered players and includes unrostered players after refresh', async () => {
    // Mock drift fix (Stage 6B): use a stable mockResolvedValue for the
    // initial-load + setActiveWorld phase, then swap the mock to the
    // post-refresh state before refreshWorldRosterIndex() is called.
    // The product code can call getLeague more than twice across React
    // render lifecycles, so we keep each phase's value stable instead of
    // relying on a fragile mockResolvedValueOnce chain.
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_a');
      expect(playerIds).toContain('player_b');
      expect(playerIds).toContain('player_c');
    });

    // Swap the mock to the post-refresh state before triggering the refresh.
    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a', 'player_b'],
        players: [{ id: 'player_a' }, { id: 'player_b' }],
      },
    ]);

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
    // Mock drift fix (Stage 6B): the initial failing call must reject;
    // any subsequent calls (including the recovery refresh) get the
    // stable post-recovery resolved value via .mockResolvedValue.
    stateMocks.getLeague.mockReset();
    stateMocks.getLeague.mockRejectedValueOnce(
      new Error('league unavailable')
    );
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
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

  it('reapplies committed world team, metadata, and roster/player truth through one coordinated reload helper', async () => {
    const committedTeam = {
      ...teamFixture,
      season: '2026-27',
      source: {
        type: 'changed-teams',
        lastModifiedAt: '2026-07-02T00:00:00.000Z',
      },
    };

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-02',
      currentSeason: '2026-27',
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-02');
    });

    stateMocks.loadWorldTeamData.mockClear();
    stateMocks.getLeague.mockClear();
    stateMocks.getWorldMetadata.mockClear();

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a', 'player_b'],
        players: [
          { id: 'player_a', player_id: 'player_a' },
          {
            id: 'player_b',
            player_id: 'player_b',
            name: 'Reloaded World Override',
            bio: { playerId: 'player_b' },
            contract: {
              salariesByYear: [{ season: '2028-29', salary: 22_500_000 }],
            },
          },
        ],
      },
    ]);
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-03',
      currentSeason: '2026-27',
    });

    let reloadResult:
      | Awaited<ReturnType<typeof result.current.reloadActiveWorldTeamData>>
      | null = null;
    await act(async () => {
      reloadResult = await result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: committedTeam as any,
        committedTeamSource: 'changedTeams',
        committedWorldMetadata: {
          currentSeason: '2026-27',
        },
      });
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_b');
    });

    expect(reloadResult).toEqual({
      outcome: 'applied',
      committedWorldTeam: {
        committedTeam,
        committedTeamSource: 'changedTeams',
      },
    });
    expect(stateMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(stateMocks.getLeague).toHaveBeenCalledWith('world_1');
    expect(stateMocks.getWorldMetadata).toHaveBeenCalledWith('world_1');
    expect(result.current.teamCapSheet).toEqual(committedTeam);
    expect(result.current.worldCurrentSeason).toBe('2026-27');
    expect(result.current.worldAsOfDate).toBe('2026-07-03');
    expect(result.current.playersMap.player_b?.name).toBe(
      'Reloaded World Override'
    );
    expect(
      result.current.playersMap.player_b?.contract?.salariesByYear?.[0]?.season
    ).toBe('2028-29');
  });

  it('can reapply committed team and metadata truth without republishing the roster bundle', async () => {
    const committedTeam = {
      ...teamFixture,
      offerSheets: [
        ...teamFixture.offerSheets,
        {
          id: 'os_outgoing_2',
          playerId: 'player_c',
          playerName: 'Natural Free Agent',
          offeringTeamCode: 'LAL',
          homeTeamCode: 'ATL',
          seasonKey: '2027-28',
          status: 'PENDING_MATCH',
        },
      ],
    };

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).toContain('player_b');
    });

    stateMocks.getLeague.mockClear();
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-02',
      currentSeason: '2025-26',
    });

    await act(async () => {
      await result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: committedTeam as any,
        committedWorldMetadata: {
          currentSeason: '2025-26',
        },
        refreshRosterBundle: false,
      });
    });

    const playerIds = result.current.freeAgents.map(
      (p) => p.id || p.player_id || p.name
    );
    expect(stateMocks.getLeague).not.toHaveBeenCalled();
    expect(playerIds).toContain('player_b');
    expect(result.current.teamCapSheet?.offerSheets).toEqual(
      committedTeam.offerSheets
    );
    expect(result.current.worldAsOfDate).toBe('2026-07-02');
  });

  it('keeps committed world metadata staged when coordinated reload fails after a successful world aftermath', async () => {
    const metadataLoad = createDeferred<{
      createdBy: string;
      isArchived: boolean;
      asOfDate: string;
      currentSeason: string;
    }>();
    const reloadError = new Error('metadata unavailable');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let blockReloadMetadata = false;

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockImplementation(async (activeWorldId) => {
      if (activeWorldId === 'world_1' && blockReloadMetadata) {
        return metadataLoad.promise;
      }

      return {
        createdBy: 'user_1',
        isArchived: false,
        asOfDate: '2026-07-01',
        currentSeason: '2025-26',
      };
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldCurrentSeason).toBe('2025-26');
    });

    let reloadPromise!: Promise<unknown>;
    act(() => {
      blockReloadMetadata = true;
      reloadPromise = result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: {
          ...teamFixture,
          season: '2026-27',
        } as any,
        committedWorldMetadata: {
          currentSeason: '2026-27',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.worldCurrentSeason).toBe('2026-27');
    });

    metadataLoad.reject(reloadError);

    await expect(reloadPromise).rejects.toThrow('metadata unavailable');
    expect(result.current.worldCurrentSeason).toBe('2026-27');
    expect(result.current.worldAsOfDate).toBe('2026-07-01');
    consoleErrorSpy.mockRestore();
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
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

  it('restores a persisted active world through the hook owner seam', async () => {
    window.localStorage.setItem('architect.activeWorldId.user_1', 'world_1');
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
      expect(result.current.worldId).toBe('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
      expect(result.current.worldCurrentSeason).toBe('2025-26');
    });
    expect(result.current.worldModeBoundary.kind).toBe('world');
    expect(result.current.worldModeBoundary.worldId).toBe('world_1');
    expect(typeof result.current.worldModeBoundary.onReloadWorldData).toBe(
      'function'
    );
    expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
      'world_1'
    );
  });

  it('clears invalid persisted active worlds in the hook instead of the selector', async () => {
    window.localStorage.setItem('architect.activeWorldId.user_1', 'world_ghost');
    stateMocks.getWorldMetadata.mockRejectedValueOnce(
      new Error('world missing')
    );

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

    await waitFor(() => {
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        null
      );
    });
    expect(result.current.worldId).toBeNull();
    expect(result.current.worldAsOfDate).toBeNull();
    expect(result.current.worldModeBoundary).toEqual({
      kind: 'sandbox',
      worldId: null,
      onReloadWorldData: null,
    });
  });

  it('clears archived persisted active worlds during restore in the hook owner seam', async () => {
    window.localStorage.setItem('architect.activeWorldId.user_1', 'world_1');
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: true,
      asOfDate: '2026-07-01',
    });

    const { result } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        null
      );
    });

    expect(result.current.worldId).toBeNull();
    expect(result.current.worldAsOfDate).toBeNull();
    expect(result.current.worldModeBoundary.kind).toBe('sandbox');
  });

  it('persists switched active worlds and clears storage when switching back to sandbox', async () => {
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        'world_1'
      );
    });

    act(() => {
      result.current.activeWorldOwner.setActiveWorld(null);
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        null
      );
    });

    expect(result.current.worldId).toBeNull();
    expect(result.current.worldAsOfDate).toBeNull();
    expect(result.current.worldTimeOwner.worldId).toBeNull();
    expect(result.current.worldTimeOwner.asOfDate).toBeNull();
    expect(result.current.worldModeBoundary).toEqual({
      kind: 'sandbox',
      worldId: null,
      onReloadWorldData: null,
    });
  });

  it('clears world-derived transient state before the next world finishes loading', async () => {
    const world2TeamLoad = createDeferred<typeof teamFixture>();
    const world2LeagueLoad = createDeferred<
      Array<{
        teamCode: string;
        roster: string[];
        players: Array<{ id: string }>;
      }>
    >();

    stateMocks.loadWorldTeamData.mockImplementation(async (worldId) => {
      if (worldId === 'world_2') {
        return world2TeamLoad.promise;
      }

      return teamFixture;
    });

    stateMocks.getLeague.mockImplementation(async (worldId) => {
      if (worldId === 'world_2') {
        return world2LeagueLoad.promise;
      }

      return [
        {
          teamCode: 'LAL',
          roster: ['player_a'],
          players: [{ id: 'player_a' }],
        },
      ];
    });

    stateMocks.getWorldMetadata.mockImplementation(async (worldId) => ({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: worldId === 'world_2' ? '2026-08-01' : '2026-07-01',
    }));

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).toContain('player_b');
    });

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2');
    });

    expect(result.current.worldId).toBe('world_2');
    expect(result.current.worldAsOfDate).toBeNull();
    expect(result.current.worldTimeOwner.asOfDate).toBeNull();
    expect(result.current.freeAgents).toEqual([]);
    expect(result.current.worldModeBoundary.kind).toBe('world');
    expect(result.current.worldModeBoundary.worldId).toBe('world_2');

    await act(async () => {
      world2TeamLoad.resolve(teamFixture);
      world2LeagueLoad.resolve([
        {
          teamCode: 'LAL',
          roster: ['player_a', 'player_b'],
          players: [{ id: 'player_a' }, { id: 'player_b' }],
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-08-01');
    });

    await waitFor(() => {
      const playerIds = result.current.freeAgents.map(
        (p) => p.id || p.player_id || p.name
      );
      expect(playerIds).not.toContain('player_b');
    });
  });

  it('invalidates archived active worlds after selection and clears persisted storage', async () => {
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

    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: true,
      asOfDate: '2026-07-01',
    });

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldId).toBeNull();
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        null
      );
    });

    expect(result.current.worldAsOfDate).toBeNull();
    expect(result.current.worldModeBoundary.kind).toBe('sandbox');
  });

  it('owns world-date metadata mutation in worldTimeOwner.updateAsOfDate', async () => {
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    await act(async () => {
      await result.current.worldTimeOwner.updateAsOfDate('2026-07-15');
    });

    expect(stateMocks.updateWorldAsOfDate).toHaveBeenCalledWith(
      'world_1',
      '2026-07-15'
    );
    expect(result.current.worldAsOfDate).toBe('2026-07-15');
  });

  it('keeps owner-driven date-update progress explicit while metadata writes are pending', async () => {
    const metadataWrite = createDeferred<void>();

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.updateWorldAsOfDate.mockReturnValueOnce(metadataWrite.promise);

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    let mutationPromise!: Promise<string>;

    act(() => {
      mutationPromise = result.current.worldTimeOwner.updateAsOfDate(
        '2026-07-15'
      );
    });

    await waitFor(() => {
      expect(result.current.worldTimeOwner.isUpdatingAsOfDate).toBe(true);
    });

    metadataWrite.resolve(undefined);

    await act(async () => {
      await mutationPromise;
    });

    await waitFor(() => {
      expect(result.current.worldTimeOwner.isUpdatingAsOfDate).toBe(false);
    });
    expect(result.current.worldAsOfDate).toBe('2026-07-15');
  });

  it('does not publish a stale saved world date after the active world changes mid-save', async () => {
    const metadataWrite = createDeferred<void>();

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockImplementation(async (activeWorldId) => ({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: activeWorldId === 'world_2' ? '2026-08-01' : '2026-07-01',
      currentSeason: activeWorldId === 'world_2' ? '2026-27' : '2025-26',
    }));
    stateMocks.updateWorldAsOfDate.mockReturnValueOnce(metadataWrite.promise);

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    let mutationPromise!: Promise<string>;
    act(() => {
      mutationPromise = result.current.worldTimeOwner.updateAsOfDate(
        '2026-07-15'
      );
    });

    await waitFor(() => {
      expect(result.current.worldTimeOwner.isUpdatingAsOfDate).toBe(true);
    });

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2');
    });

    await waitFor(() => {
      expect(result.current.worldId).toBe('world_2');
      expect(result.current.worldTimeOwner.isUpdatingAsOfDate).toBe(false);
      expect(result.current.worldAsOfDate).toBe('2026-08-01');
    });

    metadataWrite.resolve(undefined);

    await act(async () => {
      await mutationPromise;
    });

    expect(stateMocks.updateWorldAsOfDate).toHaveBeenCalledWith(
      'world_1',
      '2026-07-15'
    );
    expect(result.current.worldId).toBe('world_2');
    expect(result.current.worldAsOfDate).toBe('2026-08-01');
  });

  it('reports when a newer coordinated reload supersedes an older world request', async () => {
    const firstReloadMetadata = createDeferred<{
      createdBy: string;
      isArchived: boolean;
      asOfDate: string;
      currentSeason: string;
    }>();
    let blockFirstReloadMetadata = false;
    let blockedReloadConsumed = false;
    let worldMetadataResponse = {
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-01',
      currentSeason: '2025-26',
    };

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockImplementation(async (activeWorldId) => {
      if (
        activeWorldId === 'world_1' &&
        blockFirstReloadMetadata &&
        !blockedReloadConsumed
      ) {
        blockedReloadConsumed = true;
        return firstReloadMetadata.promise;
      }

      return worldMetadataResponse;
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    const firstCommittedTeam = {
      ...teamFixture,
      season: '2026-27',
    };
    const secondCommittedTeam = {
      ...teamFixture,
      season: '2027-28',
    };

    let firstReloadPromise!: Promise<
      | Awaited<ReturnType<typeof result.current.reloadActiveWorldTeamData>>
      | null
    >;
    act(() => {
      blockFirstReloadMetadata = true;
      firstReloadPromise = result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: firstCommittedTeam as any,
        committedWorldMetadata: {
          currentSeason: '2026-27',
        },
        refreshRosterBundle: false,
      });
    });

    await waitFor(() => {
      expect(result.current.worldCurrentSeason).toBe('2026-27');
    });

    worldMetadataResponse = {
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-05',
      currentSeason: '2027-28',
    };

    let secondReloadResult:
      | Awaited<ReturnType<typeof result.current.reloadActiveWorldTeamData>>
      | null = null;
    await act(async () => {
      secondReloadResult = await result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: secondCommittedTeam as any,
        committedWorldMetadata: {
          currentSeason: '2027-28',
        },
        refreshRosterBundle: false,
      });
    });

    expect(secondReloadResult).toEqual({
      outcome: 'applied',
      committedWorldTeam: {
        committedTeam: secondCommittedTeam,
        committedTeamSource: 'changedTeams',
      },
    });
    expect(result.current.teamCapSheet?.season).toBe('2027-28');
    expect(result.current.worldCurrentSeason).toBe('2027-28');
    expect(result.current.worldAsOfDate).toBe('2026-07-05');

    firstReloadMetadata.resolve({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-04',
      currentSeason: '2026-27',
    });

    await expect(firstReloadPromise).resolves.toEqual({
      outcome: 'stale-drop',
      reason: 'superseded-by-newer-request',
    });
    expect(result.current.teamCapSheet?.season).toBe('2027-28');
    expect(result.current.worldCurrentSeason).toBe('2027-28');
    expect(result.current.worldAsOfDate).toBe('2026-07-05');
  });

  it('drops stale coordinated reload completions after switching back to sandbox', async () => {
    const metadataLoad = createDeferred<{
      createdBy: string;
      isArchived: boolean;
      asOfDate: string;
      currentSeason: string;
    }>();
    let blockReloadMetadata = false;

    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockImplementation(async (activeWorldId) => {
      if (activeWorldId === 'world_1' && blockReloadMetadata) {
        return metadataLoad.promise;
      }

      return {
        createdBy: 'user_1',
        isArchived: false,
        asOfDate: '2026-07-01',
        currentSeason: '2025-26',
      };
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    let reloadPromise!: Promise<
      | Awaited<ReturnType<typeof result.current.reloadActiveWorldTeamData>>
      | null
    >;
    act(() => {
      blockReloadMetadata = true;
      reloadPromise = result.current.reloadActiveWorldTeamData({
        committedTeamSnapshot: {
          ...teamFixture,
          season: '2026-27',
        } as any,
        committedWorldMetadata: {
          currentSeason: '2026-27',
        },
      });
    });

    act(() => {
      result.current.activeWorldOwner.setActiveWorld(null);
    });

    await waitFor(() => {
      expect(result.current.worldModeBoundary.kind).toBe('sandbox');
      expect(result.current.worldAsOfDate).toBeNull();
    });

    metadataLoad.resolve({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-07-04',
      currentSeason: '2026-27',
    });

    await expect(reloadPromise).resolves.toEqual({
      outcome: 'stale-drop',
      reason: 'active-world-changed',
    });
    expect(result.current.worldId).toBeNull();
    expect(result.current.teamCapSheet?.season).not.toBe('2026-27');
    expect(result.current.worldCurrentSeason).toBeNull();
  });

  it('requires an authoritative saved world date before +1 day can mutate world time', async () => {
    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: null,
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBeNull();
    });

    let thrownError: unknown = null;

    await act(async () => {
      try {
        await result.current.worldTimeOwner.advanceByOneDay();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      'Set a world date before advancing time'
    );
    expect(stateMocks.updateWorldAsOfDate).not.toHaveBeenCalled();
  });

  it('owns +1 day world-date mutation in worldTimeOwner.advanceByOneDay', async () => {
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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-07-01');
    });

    await act(async () => {
      await result.current.worldTimeOwner.advanceByOneDay();
    });

    expect(stateMocks.updateWorldAsOfDate).toHaveBeenCalledWith(
      'world_1',
      '2026-07-02'
    );
    expect(result.current.worldAsOfDate).toBe('2026-07-02');
  });

  it('advances +1 day from the saved ISO world date without local-time drift', async () => {
    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: ['player_a'],
        players: [{ id: 'player_a' }],
      },
    ]);
    stateMocks.getWorldMetadata.mockResolvedValue({
      createdBy: 'user_1',
      isArchived: false,
      asOfDate: '2026-03-08',
    });

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
      result.current.activeWorldOwner.setActiveWorld('world_1');
    });

    await waitFor(() => {
      expect(result.current.worldAsOfDate).toBe('2026-03-08');
    });

    await act(async () => {
      await result.current.worldTimeOwner.advanceByOneDay();
    });

    expect(stateMocks.updateWorldAsOfDate).toHaveBeenCalledWith(
      'world_1',
      '2026-03-09'
    );
    expect(result.current.worldAsOfDate).toBe('2026-03-09');
  });
});
