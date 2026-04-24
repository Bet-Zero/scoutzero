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
              ...((base.bio as Record<string, unknown> | null | undefined) ||
                {}),
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
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
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
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPayload,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateFor<TMutationType extends ComputeArgs['mutationType']> =
  Extract<ComputeArgs, { mutationType: TMutationType }>['currentState'];
type SignFreeAgentCurrentState = CurrentStateFor<'signFreeAgent'>;
type SetDeadCapCurrentState = CurrentStateFor<'setDeadCap'>;

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-16T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-16T12:00:00.000Z';
const WORLD_ID = 'world_payload_ingress_boundary';

function makeBirdRights(
  overrides: Partial<ArchitectMutationBirdRights> = {}
): ArchitectMutationBirdRights {
  return {
    status: 'Full',
    type: 'Full Bird',
    yearsOfService: 6,
    yearsWithTeam: 3,
    ...overrides,
  };
}

function makeContract(
  salary: number,
  overrides: Partial<ArchitectMutationContract> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    years: 1,
    contractYears: 1,
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    ...overrides,
  };
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Partial<ArchitectMutationPlayerRecord> & Record<string, unknown> = {}
): ArchitectMutationPlayerRecord & Record<string, unknown> {
  return {
    player_id: id,
    id,
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
      displayName: name,
      playerId: id,
      position: 'SF',
      age: 27,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: teamCode ? null : 'UFA',
      },
    },
    birdRights: makeBirdRights(),
    representation: {
      agent: `${name} Agent`,
      agency: 'Agency',
    },
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<ArchitectMutationPlayerRecord & Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> & Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        player.contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      ),
    0
  );

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    deadCap: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    cashLedger: { totalOut: 0 },
    exceptions: { room: null, mle: null, bae: null, tpe: [] },
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
  const match = testState.batchSet.mock.calls.find(([path]) =>
    String(path).includes(`/teams/${teamCode}`)
  );

  if (!match) {
    throw new Error(`Missing persisted team write for ${teamCode}`);
  }

  return match[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.batchCommit.mockResolvedValue(undefined);
  testState.getDoc.mockResolvedValue({
    exists: () => false,
    data: () => null,
  });
  testState.getWorldMetadata.mockResolvedValue({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  });
});

describe('mutationPipeline payload ingress boundary', () => {
  it('keeps sign-free-agent payload ingress narrow while preserving commit and reload continuity', async () => {
    const existingPlayer = makePlayer('starter_1', 'Starter One', 10_000_000, 'LAL');
    const freeAgent = makePlayer('fa_payload', 'Payload Free Agent', 0, null, {
      contract: null,
      freeAgency: 'UFA',
      birdRights: { status: 'Full' },
    });
    const initialTeam = makeTeam('LAL', [existingPlayer], {
      capHolds: [
        {
          playerId: 'fa_payload',
          playerName: 'Payload Free Agent',
          amount: 4_000_000,
          type: 'FA Cap Hold',
          season: SEASON_ID,
          active: true,
        },
      ],
      draftPicks: [
        { id: 'pick_keep', year: 2028, round: 1, pick: null, owner: 'LAL' },
      ],
      entitlementIds: ['entitlement_keep'],
      cashLedger: { totalOut: 1_000_000 },
    });

    testState.getTeam.mockResolvedValue(initialTeam);
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_payload_ingress_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_payload',
        contract: makeContract(6_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 12_000_000,
        }),
        signedUsing: 'Minimum',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const committedTeam = findCommittedTeamSnapshot(result.changedTeams, 'LAL');
    expect(committedTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_payload'
    );
    expect(committedTeam?.capHolds).toEqual([]);
    expect(committedTeam?.draftPicks).toEqual([
      { id: 'pick_keep', year: 2028, round: 1, pick: null, owner: 'LAL' },
    ]);
    expect(committedTeam?.entitlementIds).toEqual(['entitlement_keep']);

    const reloadTeam =
      committedTeam &&
      buildGeneralMutationDashboardReloadTeamSnapshot(committedTeam);
    expect(reloadTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_payload'
    );
    expect(reloadTeam?.capHolds).toEqual([]);
    expect(reloadTeam?.draftPicks).toEqual(committedTeam?.draftPicks);

    const persistedTeam = getPersistedTeamWrite('LAL');
    expect(persistedTeam.players).toEqual(committedTeam?.players);
    expect(persistedTeam.draftPicks).toEqual(committedTeam?.draftPicks);
    expect(persistedTeam.entitlementIds).toEqual(committedTeam?.entitlementIds);
    expect(persistedTeam.cashLedger).toEqual({ totalOut: 1_000_000 });
  });

  it('runs manual dead-cap compute through a different payload shape', () => {
    const team = makeTeam('LAL', [], {
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
      },
      deadCap: [],
    });
    const deadCap = [
      {
        playerId: 'dead_cap_1',
        playerName: 'Dead Cap One',
        amountByYear: [
          {
            season: SEASON_ID,
            amount: 2_000_000,
            isStretched: false,
          },
        ],
      },
    ];

    const result = computeWorldMutation({
      mutationType: 'setDeadCap',
      payload: {
        teamCode: 'LAL',
        deadCap,
        deadCapChanges: ['Dead cap updated'],
      },
      currentState: {
        team: team as SetDeadCapCurrentState['team'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates?.[0]?.team?.deadCap).toEqual(deadCap);
    expect(result.teamUpdates?.[0]?.team?.exceptions).toMatchObject({
      room: {
        totalAmount: 5_000_000,
        remainingAmount: 5_000_000,
        usedAmount: 0,
      },
      tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
    });
    expect(result.metadata).toMatchObject({
      actionType: 'setDeadCap',
      teamCode: 'LAL',
      deadCapChanges: ['Dead cap updated'],
    });
  });

  it('tolerates mixed public payload compatibility at the adapter edge without leaking unrelated fields into lane output', () => {
    const freeAgent = makePlayer('fa_outer', 'Free Agent Outer', 0, null);
    const team = makeTeam('LAL', [], {
      deadCap: [],
      exceptions: {
        room: null,
        tpe: [],
      },
    });
    const mixedPayload: ArchitectMutationPayload = {
      teamCode: 'LAL',
      playerId: 'fa_outer',
      contract: makeContract(2_000_000),
      signedUsing: 'Minimum',
      destinationTeamCode: 'BAD',
      deadCap: [
        {
          playerId: 'should_not_apply',
          playerName: 'Should Not Apply',
          amountByYear: [
            {
              season: SEASON_ID,
              amount: 9_000_000,
              isStretched: false,
            },
          ],
        },
      ],
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 9_000_000,
          remainingAmount: 9_000_000,
          usedAmount: 0,
        },
      },
      teams: [
        {
          teamCode: 'BAD',
          sends: [{ id: 'ignored_trade_player', player_id: 'ignored_trade_player' }],
          receives: [],
        },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: mixedPayload,
      currentState: {
        team: team as SignFreeAgentCurrentState['team'],
        player: freeAgent as SignFreeAgentCurrentState['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual(['LAL']);
    expect(result.teamUpdates?.[0]?.team?.roster).toContain('fa_outer');
    expect(result.teamUpdates?.[0]?.team?.deadCap).toEqual([]);
    expect(result.teamUpdates?.[0]?.team?.exceptions?.room).not.toEqual(
      expect.objectContaining({ totalAmount: 9_000_000 })
    );
    expect(result.playerUpdates?.[0]?.player?.teamCode).toBe('LAL');
    expect(result.metadata).toMatchObject({
      type: 'signing',
      teamCode: 'LAL',
      playerId: 'fa_outer',
    });
  });
});
