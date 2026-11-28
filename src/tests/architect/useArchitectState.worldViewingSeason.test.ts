// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useArchitectState } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import { LOCAL_SEASON_KEY } from '@/features/architect/GMDashboard/hooks/useArchitectState.helpers';

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
  getWorldMetadata: async (worldId: string) => ({
    ...(await stateMocks.getWorldMetadata(worldId)),
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'test-contract-source-release',
      releaseVersion: 1,
      releaseDigest: `sha256:${'1'.repeat(64)}`,
    },
    contractBaselineEffectiveAt: '2026-06-05T12:19:56.526Z',
    contractBaselineSalaryCapYear: 2026,
    contractBaselineCoverage: { total: 1, complete: 1, needsInput: 0 },
  }),
  updateWorldAsOfDate: stateMocks.updateWorldAsOfDate,
}));

vi.mock('@/features/architect/utils/teamLoader', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/architect/utils/teamLoader')
  >('@/features/architect/utils/teamLoader');
  return { ...actual, getLeague: stateMocks.getLeague };
});

vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  useArchitectPlayerData: () => stateMocks.useArchitectPlayerData(),
}));

const teamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: [],
  capHolds: [],
  exceptions: {},
  totals: {},
};

const worldMetadata = (currentSeason: string, asOfDate: string) => ({
  worldName: 'Season World',
  createdBy: 'user_1',
  isArchived: false,
  asOfDate,
  currentSeason,
});

function renderState() {
  return renderHook(() =>
    useArchitectState({ teamId: 'LAL', userId: 'user_1', authLoading: false })
  );
}

describe('useArchitectState saved-world viewing season', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    stateMocks.useArchitectPlayerData.mockReturnValue({
      players: [],
      loading: false,
      error: null,
    });
    stateMocks.loadWorldTeamData.mockResolvedValue(teamFixture);
    stateMocks.getLeague.mockResolvedValue([
      { teamCode: 'LAL', roster: [], players: [] },
    ]);
    stateMocks.updateWorldAsOfDate.mockResolvedValue(undefined);
    stateMocks.getWorldMetadata.mockImplementation(async (worldId: string) =>
      worldId === 'world_2627'
        ? worldMetadata('2026-27', '2026-11-14')
        : worldMetadata('2025-26', '2026-06-05')
    );
  });

  it('opens a world on its own season instead of a season saved in this browser', async () => {
    window.localStorage.setItem(LOCAL_SEASON_KEY, '2027');
    const { result } = renderState();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentYear).toBe(2027);

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2526');
    });

    await waitFor(() => expect(result.current.currentYear).toBe(2026));
  });

  it('leaves Sandbox on its saved season', async () => {
    window.localStorage.setItem(LOCAL_SEASON_KEY, '2027');
    const { result } = renderState();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.worldId).toBeNull();
    expect(result.current.currentYear).toBe(2027);
  });

  it('honors an explicit ?season= link for the first world, then opens later worlds on their own season', async () => {
    window.history.replaceState({}, '', '/?season=2027');
    const { result } = renderState();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2526');
    });
    await waitFor(() => expect(result.current.worldId).toBe('world_2526'));
    await waitFor(() =>
      expect(stateMocks.loadWorldTeamData).toHaveBeenCalledWith(
        'world_2526',
        'LAL'
      )
    );
    expect(result.current.currentYear).toBe(2027);

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2627');
    });
    await waitFor(() => expect(result.current.worldId).toBe('world_2627'));
    act(() => {
      result.current.setCurrentYear(2028);
    });
    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2526');
    });
    await waitFor(() => expect(result.current.currentYear).toBe(2026));
  });

  it('keeps a season the viewer picks after the world opened', async () => {
    const { result } = renderState();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world_2526');
    });
    await waitFor(() => expect(result.current.currentYear).toBe(2026));

    act(() => {
      result.current.setCurrentYear(2027);
    });
    await act(async () => {
      await result.current.refreshWorldRosterIndex();
    });

    expect(result.current.currentYear).toBe(2027);
  });
});
