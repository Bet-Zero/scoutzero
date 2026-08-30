import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTeam } from '@/features/architect/utils/teamLoader';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { capProjections } from '@/features/architect/utils/capProjections';
import type {
  NormalizedPlayer,
  TradeTeam,
} from '@/features/architect/utils/tradeMachine/constants/types';

type DocShape = Record<string, unknown> | null;

const docsByPath = new Map<string, DocShape>();
const worldMetadataById = new Map<string, { parentWorldId: string | null }>();

function seedDoc(path: string, data: DocShape): void {
  docsByPath.set(path, data);
}

function seedWorld(worldId: string, parentWorldId: string | null): void {
  worldMetadataById.set(worldId, { parentWorldId });
}

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(async (ref: { _path: string }) => {
    const data = docsByPath.get(ref._path);
    return {
      exists: () => data !== null && data !== undefined,
      data: () => data || {},
    };
  }),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: vi.fn(async (worldId: string) => {
    return worldMetadataById.get(worldId) || { parentWorldId: null };
  }),
  resolveWorldLineageIds: vi.fn(async (worldId: string) => {
    const lineage: string[] = [];
    const visited = new Set<string>();
    let currentWorldId: string | null = worldId;
    while (currentWorldId) {
      if (visited.has(currentWorldId)) {
        throw new Error(`World lineage cycle detected for ${currentWorldId}`);
      }
      visited.add(currentWorldId);
      lineage.push(currentWorldId);
      currentWorldId =
        worldMetadataById.get(currentWorldId)?.parentWorldId ?? null;
    }
    return lineage;
  }),
}));

vi.mock('@/features/architect/utils/firebaseTeamPlanHelpers', () => ({
  hydrateBaseTeam: vi.fn(
    async (teamCode: string, baseDoc: Record<string, unknown> = {}) => ({
      id: teamCode,
      teamCode,
      teamName: `Team ${teamCode}`,
      roster: [],
      players: [],
      capHolds: [],
      draftPicks: [],
      tradeExceptions: [],
      exceptions: {},
      totals: { totalSalary: 0, capHit: 0 },
      ...baseDoc,
    })
  ),
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  baseTeamRef: (teamCode: string) => ({
    _path: `architect_baseTeams/${teamCode}`,
  }),
  basePlayerRef: (playerId: string) => ({
    _path: `architect_basePlayers/${playerId}`,
  }),
  worldTeamRef: (worldId: string, teamCode: string) => ({
    _path: `architect_worlds/${worldId}/teams/${teamCode}`,
  }),
  worldTeamsCol: (worldId: string) => ({
    _path: `architect_worlds/${worldId}/teams`,
  }),
  worldPlayerRef: (worldId: string, teamCode: string, playerId: string) => ({
    _path: `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`,
  }),
}));

const SEASON = '2024-25';
const CURRENT_YEAR = 2025;
type TradeValidatorTeamState = NonNullable<TradeTeam['team']>;

function makePlayer(id: string, salary: number): NormalizedPlayer {
  return {
    id,
    player_id: id,
    name: id,
    salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    isTwoWay: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    contract: {
      salariesByYear: [{ season: SEASON, salary, capHit: salary }],
    },
  };
}

function makeTeam(
  teamCode: string,
  totalSalary: number,
  players: NormalizedPlayer[]
): TradeValidatorTeamState {
  return {
    id: teamCode,
    teamCode,
    teamName: teamCode,
    totalSalary,
    teamTotalSalary: totalSalary,
    roster: players.map((p) => String(p.player_id || p.id)),
    players,
    capHolds: [],
    draftPicks: [],
    tradeExceptions: [],
    exceptions: {},
    totals: { totalSalary, capHit: totalSalary },
  };
}

describe('World Context Parent Fallback + Cap Legality Guardrail', () => {
  beforeEach(() => {
    docsByPath.clear();
    worldMetadataById.clear();
  });

  it('loads child->parent fallback team state and enforces hard-cap legality from that state', async () => {
    seedWorld('world-child', 'world-parent');
    seedWorld('world-parent', null);

    const lakersOutgoing = makePlayer('lal_out', 10_000_000);
    const lakersSnapshotFromParent = makeTeam('LAL', 177_000_000, [
      lakersOutgoing,
    ]);
    seedDoc('architect_worlds/world-child/teams/LAL', null);
    seedDoc('architect_worlds/world-parent/teams/LAL', {
      ...lakersSnapshotFromParent,
      hardCapped: true,
    });

    const loadedLakers = await getTeam('world-child', 'LAL');
    expect(loadedLakers.teamTotalSalary).toBe(177_000_000);
    expect(loadedLakers.hardCapped).toBe(true);

    const bostonOutgoing = makePlayer('bos_out', 13_000_000);
    const boston = makeTeam('BOS', 140_000_000, [bostonOutgoing]);

    const validation = validateTrade({
      teams: [
        {
          team: loadedLakers as unknown as TradeValidatorTeamState,
          sends: [lakersOutgoing],
          hardCapped: true,
          entitlementsOut: [],
        },
        { team: boston, sends: [bostonOutgoing], entitlementsOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const lakersResult = validation.teamResults.find(
      (t: { teamId?: string }) => t.teamId === 'LAL'
    );

    expect(lakersResult?.totalSalary).toBe(177_000_000);
    expect(lakersResult?.rules?.salaryMatching?.passed).toBe(true);
    expect(lakersResult?.rules?.hardCap?.passed).toBe(false);
    expect(validation.reason).toContain('hard-cap incoming ceiling');
  });
});
