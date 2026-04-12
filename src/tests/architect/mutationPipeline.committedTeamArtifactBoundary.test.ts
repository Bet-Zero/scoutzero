import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(async () => ({
    exists: () => false,
    data: () => null,
  })),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async (): Promise<unknown[]> => []),
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...base,
      ...override,
      bio:
        base.bio || override.bio
          ? {
              ...((base.bio as Record<string, unknown> | null | undefined) || {}),
              ...((override.bio as Record<string, unknown> | null | undefined) ||
                {}),
            }
          : undefined,
      contract:
        base.contract || override.contract
          ? {
              ...((base.contract as Record<string, unknown> | null | undefined) ||
                {}),
              ...((override.contract as Record<string, unknown> | null | undefined) ||
                {}),
            }
          : undefined,
    })
  ),
  updateWorldStats: vi.fn(async () => undefined),
  validateTrade: vi.fn(),
  getWorldMetadata: vi.fn(async () => ({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  })),
}));

vi.mock('@/firebaseConfig', () => ({
  db: 'db',
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: testState.batchSet,
    update: testState.batchUpdate,
    delete: testState.batchDelete,
    commit: testState.batchCommit,
  })),
  getDoc: testState.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
  doc: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: testState.getTeam,
  getPlayer: testState.getPlayer,
  getLeague: testState.getLeague,
  mergePlayerOverride: testState.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: testState.updateWorldStats,
  getWorldMetadata: testState.getWorldMetadata,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: testState.validateTrade,
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  assertPersistableOrThrow: vi.fn(),
  normalizeTeamTpeSchema: vi.fn((team: unknown) => team),
  PERSISTENCE_CONTRACTS: {},
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: vi.fn(async () => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateMutationEntitlementInvariants: vi.fn(async () => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateTradeApplyExclusivity: vi.fn(async () => ({
    valid: true,
    teamViolations: [],
  })),
}));

import {
  applyWorldMutation,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  type ArchitectMutationContract,
} from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.parse('2026-04-10T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-10T12:00:00.000Z';
const SEASON_ID = '2025-26';
const WORLD_ID = 'world_committed_team_artifact_boundary';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    totalValue: salary,
    years: 1,
    contractYears: 1,
    birdRights: { status: 'Full', yearsOfService: 5 },
    ...overrides,
  } as ArchitectMutationContract;
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    player_id: id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary, { signingTeam: teamCode }),
    bio: {
      playerId: id,
      displayName: name,
      position: 'SF',
      yearsExperience: 4,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: 'UFA',
      },
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const totalSalary = players.reduce((sum, player) => {
    const contract = player.contract as
      | { salariesByYear?: Array<{ capHit?: number | string | null }> }
      | undefined;
    return sum + Number(contract?.salariesByYear?.[0]?.capHit || 0);
  }, 0);

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [
      {
        playerId: 'fa_boundary',
        playerName: 'Boundary Free Agent',
        amount: 4_000_000,
        type: 'FA Cap Hold',
        season: SEASON_ID,
        active: true,
      },
    ],
    deadCap: [],
    tradeExceptions: [
      {
        id: 'tpe_keep',
        amount: 5_000_000,
        remainingAmount: 5_000_000,
        createdSeason: 2025,
      },
    ],
    cashLedger: { totalOut: 1_000_000 },
    exceptionHistory: [
      {
        historyKey: 'history_keep',
        type: 'tpe-created',
        producerSpecific: { preserved: true },
      },
    ],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [{ id: 'pick_keep', year: 2028, round: 1, owner: teamCode }],
    entitlementIds: ['entitlement_keep'],
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    teamTotalSalary: totalSalary,
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function getPersistedTeamWrite(teamCode: string): Record<string, unknown> {
  const matchingCall = testState.batchSet.mock.calls.find(([path]) =>
    String(path).includes(`/teams/${teamCode}`)
  );
  return (matchingCall?.[1] || {}) as Record<string, unknown>;
}

function getHiddenCarrierKeys(value: Record<string, unknown> | null | undefined) {
  return Object.keys(value || {}).filter((key) =>
    key.startsWith('__currentStateBasePreserved')
  );
}

describe('mutationPipeline committed team artifact boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.getWorldMetadata.mockResolvedValue({
      parentWorldId: null,
      asOfDate: '2026-07-01',
    });
  });

  it('commits a real mutation through the narrowed team artifact used by persistence and dashboard reload', async () => {
    const existingPlayer = makePlayer(
      'starter_1',
      'Starter One',
      10_000_000,
      'LAL'
    );
    const freeAgent = makePlayer('fa_boundary', 'Boundary Free Agent', 0, null, {
      contract: null,
      freeAgency: 'UFA',
      birdRights: { status: 'Full' },
    });
    const initialTeam = makeTeam('LAL', [existingPlayer]);

    testState.getTeam.mockResolvedValue(initialTeam);
    testState.getPlayer.mockResolvedValue(freeAgent);

    const computeResult = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_boundary',
        contract: makeContract(6_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 12_000_000,
        }),
        signedUsing: 'Cap Space',
      },
      currentState: {
        team: initialTeam,
        player: freeAgent,
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(computeResult.success).toBe(true);
    const computedTeam = computeResult.teamUpdates?.[0]?.team;
    expect(computedTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_boundary'
    );
    expect(computedTeam as Record<string, unknown>).not.toHaveProperty('id');

    const result = await applyWorldMutation({
      userId: 'user_committed_team_artifact',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_boundary',
        contract: makeContract(6_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 12_000_000,
        }),
        signedUsing: 'Cap Space',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const committedTeam = findCommittedTeamSnapshot(
      result.changedTeams,
      'LAL'
    );
    expect(committedTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_boundary'
    );
    expect(committedTeam?.capHolds).toEqual([]);
    expect(committedTeam?.draftPicks).toEqual([
      { id: 'pick_keep', year: 2028, round: 1, pick: null, owner: 'LAL' },
    ]);
    expect(committedTeam?.entitlementIds).toEqual(['entitlement_keep']);
    expect(committedTeam?.exceptionHistory?.[0]).toMatchObject({
      historyKey: 'history_keep',
      producerSpecific: { preserved: true },
    });

    const committedTeamRecord = committedTeam as Record<string, unknown>;
    expect(committedTeamRecord).not.toHaveProperty('teamTotalSalary');
    expect(getHiddenCarrierKeys(committedTeamRecord)).toEqual([]);

    const persistedTeam = getPersistedTeamWrite('LAL');
    expect(persistedTeam.players).toEqual(committedTeam?.players);
    expect(persistedTeam.draftPicks).toEqual(committedTeam?.draftPicks);
    expect(persistedTeam.entitlementIds).toEqual(committedTeam?.entitlementIds);
    expect(persistedTeam.exceptionHistory).toEqual(
      committedTeam?.exceptionHistory
    );
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
    expect(getHiddenCarrierKeys(persistedTeam)).toEqual([]);

    const missedTeam = findCommittedTeamSnapshot(result.changedTeams, 'BOS');
    expect(missedTeam).toBeNull();
  });
});
