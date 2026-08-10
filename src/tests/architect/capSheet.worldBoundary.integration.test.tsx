// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useArchitectState } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import { getTeam } from '@/features/architect/utils/teamLoader';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';

const stateMocks = vi.hoisted(() => ({
  docsByPath: new Map<string, Record<string, unknown> | null>(),
  worldMetadataById: new Map<
    string,
    { parentWorldId: string | null; asOfDate?: string | null }
  >(),
  getLeague: vi.fn(),
  loadTeamCapSheet: vi.fn(),
}));

function seedDoc(path: string, data: Record<string, unknown> | null): void {
  stateMocks.docsByPath.set(path, data);
}

function seedWorld(
  worldId: string,
  parentWorldId: string | null,
  asOfDate: string | null = null
): void {
  stateMocks.worldMetadataById.set(worldId, { parentWorldId, asOfDate });
}

function buildTeamSnapshot(
  label: string,
  salary: number
): Record<string, unknown> {
  const playerId = `${label.toLowerCase()}_player`;
  return {
    teamCode: 'LAL',
    teamName: `${label} Lakers`,
    roster: [playerId],
    players: [
      {
        id: playerId,
        player_id: playerId,
        name: playerId,
        displayName: `${label} Player`,
        contract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary,
              capHit: salary,
              guaranteed: true,
            },
          ],
        },
      },
    ],
    deadCap: [],
    capHolds: [],
    exceptions: {},
    totals: {},
  };
}

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(async (ref: { _path: string }) => {
    const data = stateMocks.docsByPath.get(ref._path);
    return {
      exists: () => data !== null && data !== undefined,
      data: () => data || {},
    };
  }),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: vi.fn(async (worldId: string) => {
    const metadata =
      stateMocks.worldMetadataById.get(worldId) || {
        parentWorldId: null,
        asOfDate: null,
      };

    return {
      ...metadata,
      contractBaselineVersion: 2,
      contractSourceRelease: {
        releaseId: 'test-contract-source-release',
        releaseVersion: 1,
        releaseDigest: `sha256:${'1'.repeat(64)}`,
      },
      contractBaselineEffectiveAt: '2026-06-05T12:19:56.526Z',
      contractBaselineSalaryCapYear: 2026,
      contractBaselineCoverage: {
        total: 1,
        complete: 1,
        needsInput: 0,
      },
    };
  }),
  updateWorldAsOfDate: vi.fn(async () => undefined),
}));

vi.mock('@/features/architect/utils/firebaseTeamPlanHelpers', () => ({
  hydrateBaseTeam: vi.fn(
    async (teamCode: string, baseDoc: Record<string, unknown> = {}) => ({
      id: teamCode,
      teamCode,
      teamName: `Base ${teamCode}`,
      roster: [],
      players: [],
      capHolds: [],
      deadCap: [],
      exceptions: {},
      totals: {},
      ...baseDoc,
    })
  ),
  loadTeamCapSheet: (...args: unknown[]) => stateMocks.loadTeamCapSheet(...args),
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  baseTeamRef: (teamCode: string) => ({ _path: `architect_baseTeams/${teamCode}` }),
  basePlayerRef: (playerId: string) => ({ _path: `architect_basePlayers/${playerId}` }),
  worldTeamRef: (worldId: string, teamCode: string) => ({
    _path: `architect_worlds/${worldId}/teams/${teamCode}`,
  }),
  worldTeamsCol: (worldId: string) => ({ _path: `architect_worlds/${worldId}/teams` }),
  worldPlayerRef: (worldId: string, teamCode: string, playerId: string) => ({
    _path: `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`,
  }),
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

vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => {
  const useArchitectPlayerData = () => ({
    players: [],
    loading: false,
    error: null,
  });
  return { default: useArchitectPlayerData, useArchitectPlayerData };
});

describe('Cap Sheet world boundary integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateMocks.docsByPath.clear();
    stateMocks.worldMetadataById.clear();

    const baseTeam = buildTeamSnapshot('Base', 12_000_000);
    stateMocks.loadTeamCapSheet.mockResolvedValue(baseTeam);
    stateMocks.getLeague.mockResolvedValue([
      {
        teamCode: 'LAL',
        roster: baseTeam.roster,
        players: baseTeam.players,
      },
    ]);
  });

  it('uses world snapshot when worldId is active in architect state', async () => {
    const baseTeam = buildTeamSnapshot('Base', 12_000_000);
    const worldTeam = buildTeamSnapshot('World Override', 18_000_000);

    stateMocks.loadTeamCapSheet.mockResolvedValue(baseTeam);
    seedWorld('world-child', 'world-parent', '2026-08-01');
    seedWorld('world-parent', null, '2026-07-01');
    seedDoc('architect_worlds/world-child/teams/LAL', worldTeam);

    const { result, unmount } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.teamCapSheet?.teamName).toBe('Base Lakers');

    act(() => {
      result.current.activeWorldOwner.setActiveWorld('world-child');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.teamCapSheet?.teamName).toBe('World Override Lakers');
      expect(result.current.worldAsOfDate).toBe('2026-08-01');
    });

    act(() => {
      unmount();
    });
  });

  it('follows world -> parent -> base fallback chain deterministically', async () => {
    const baseTeam = buildTeamSnapshot('Base Fallback', 10_000_000);
    const parentTeam = buildTeamSnapshot('Parent Fallback', 14_000_000);
    const childTeam = buildTeamSnapshot('Child Override', 20_000_000);

    seedWorld('world-child', 'world-parent');
    seedWorld('world-parent', null);
    seedDoc('architect_baseTeams/LAL', baseTeam);
    seedDoc('architect_worlds/world-parent/teams/LAL', parentTeam);
    seedDoc('architect_worlds/world-child/teams/LAL', childTeam);

    const childResolved = await getTeam('world-child', 'LAL');
    expect(childResolved.teamName).toBe('Child Override Lakers');

    seedDoc('architect_worlds/world-child/teams/LAL', null);
    const parentResolved = await loadWorldTeamData('world-child', 'LAL');
    expect(parentResolved?.teamName).toBe('Parent Fallback Lakers');

    seedDoc('architect_worlds/world-parent/teams/LAL', null);
    const baseResolved = await loadWorldTeamData('world-child', 'LAL');
    expect(baseResolved?.teamName).toBe('Base Fallback Lakers');
  });
});
