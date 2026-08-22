import { beforeEach, describe, expect, it, vi } from 'vitest';

type DocShape = Record<string, unknown> | null;

const testState = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(
    async (): Promise<{ exists: () => boolean; data: () => DocShape }> => ({
      exists: () => false,
      data: () => null,
    })
  ),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...base,
      ...override,
    })
  ),
  updateWorldStats: vi.fn(async () => undefined),
  validateTrade: vi.fn(),
  getWorldMetadata: vi.fn(async () => ({
    parentWorldId: null,
    asOfDate: '2026-07-08',
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
  runTransaction: vi.fn(
    async (
      _db: unknown,
      updateFunction: (transaction: {
        get: typeof testState.getDoc;
        set: typeof testState.batchSet;
        update: typeof testState.batchUpdate;
        delete: typeof testState.batchDelete;
      }) => Promise<unknown>
    ) =>
      updateFunction({
        get: testState.getDoc,
        set: testState.batchSet,
        update: testState.batchUpdate,
        delete: testState.batchDelete,
      })
  ),

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
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
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
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.parse('2026-08-21T18:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-08-21T18:00:00.000Z';
const SEASON_ID = '2025-26';
const WORLD_ID = 'world_current_state_normalization_closure';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationContract & Record<string, unknown> {
  return {
    contractType: 'Standard',
    signingTeam: 'LAL',
    signingDate: '2025-07-01',
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    birdRights: { status: 'Full', yearsOfService: 5 },
    totalValue: salary,
    years: 1,
    contractYears: 1,
    ...overrides,
  } as ArchitectMutationContract & Record<string, unknown>;
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
): ArchitectMutationTeamRecord & Record<string, unknown> {
  const totalSalary = players.reduce((sum, player) => {
    const contract = player.contract as
      | { salariesByYear?: Array<{ capHit?: number | string | null }> }
      | undefined;

    return (
      sum +
      Number(
        contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      )
    );
  }, 0);

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [],
    entitlementIds: [],
    cashLedger: { totalOut: 0 },
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      teamSalary: totalSalary,
      apronTeamSalary: totalSalary,
      taxSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord & Record<string, unknown>;
}

function buildTradeTeamResult({
  teamCode,
  totalSalary,
}: {
  teamCode: string;
  totalSalary: number;
}) {
  return {
    teamId: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    legal: true,
    violations: [],
    warnings: [],
    rules: {},
    salaryOut: 0,
    salaryIn: 0,
    outgoingPlayers: [],
    incomingPlayers: [],
    calculations: {
      salaryOut: 0,
      salaryIn: 0,
      salaryMatching: {
        allowedIncoming: totalSalary,
        margin: 0,
        difference: 0,
      },
    },
    totalSalary,
    projectedSalary: totalSalary,
    capRoom: 0,
    hardCapped: false,
    apronStatus: 'Below Aprons',
    faExceptionBuckets: [],
    notes: [],
    createdTPE: null,
    details: '',
    warningDetails: '',
  };
}

function getBatchSetEntry(pathFragment: string) {
  return testState.batchSet.mock.calls.find(([ref]) =>
    String(ref).includes(pathFragment)
  );
}

describe('mutationPipeline current-state normalization closure pass', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    testState.getWorldMetadata.mockResolvedValue({
      parentWorldId: null,
      asOfDate: '2026-07-08',
    });

    testState.validateTrade.mockImplementation(
      (input?: { teams?: unknown[] }) => {
        const teams = Array.isArray(input?.teams)
          ? (input.teams as Array<Record<string, unknown> | null | undefined>)
          : [];
        const legal =
          teams.length > 0 &&
          teams.every((teamTrade) => {
            const team =
              (teamTrade?.team as Record<string, unknown> | undefined) || {};
            return (
              typeof team.teamTotalSalary === 'number' &&
              team.teamTotalSalary > 0
            );
          });

        return {
          valid: legal,
          success: legal,
          legal,
          reason: legal
            ? null
            : 'teamTotalSalary must be numeric at the apply boundary',
          violations: [],
          warnings: [],
          teamResults: teams.map((teamTrade) => {
            const team =
              (teamTrade?.team as Record<string, unknown> | undefined) || {};
            const teamCode = String(teamTrade?.teamCode || team.teamCode || '');
            return buildTradeTeamResult({
              teamCode,
              totalSalary: Number(team.teamTotalSalary || 0),
            });
          }),
        };
      }
    );
  });

  it('keeps base-team preserve-only round-trip fields through apply and strips hidden/current compute-only persistence baggage', async () => {
    const initialTradeException = {
      id: 'tpe_lal_1',
      amount: 1_500_000,
      remainingAmount: 1_500_000,
      totalAmount: 1_500_000,
      createdSeason: 2026,
      createdFrom: 'Trade',
      expiresOn: '2026-07-01',
    };
    const initialExceptionHistory = [
      {
        id: 'hist_1',
        type: 'created',
        createdAt: FIXED_TIMESTAMP_ISO,
        legacyMeta: { keep: true },
      },
    ];
    const carriedPick = {
      year: 2028,
      round: 1,
      pick: null,
      owner: 'LAL',
      metadata: { source: 'test-pick' },
    };
    const team = makeTeam('LAL', [], {
      tradeExceptions: [initialTradeException],
      exceptionHistory: initialExceptionHistory,
      draftPicks: [carriedPick],
      entitlementIds: ['ent_lal_keep'],
      cashLedger: { totalOut: 250_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 4_500_000,
          remainingAmount: 4_500_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'canonical_tpe_keep', amount: 750_000 }],
      },
      legacyBaseCarrier: { shouldDrop: true },
    });

    testState.getTeam.mockResolvedValue(team);

    const result = await applyWorldMutation({
      userId: 'user_current_state_closure',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 6_000_000,
            remainingAmount: 6_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception reset'],
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const changedTeam = result.changedTeams?.[0]?.team;
    expect(changedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_lal_1',
        amount: 1_500_000,
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(changedTeam?.exceptionHistory).toEqual(initialExceptionHistory);
    expect(changedTeam?.draftPicks).toEqual([carriedPick]);
    expect(changedTeam?.entitlementIds).toEqual(['ent_lal_keep']);
    expect(changedTeam?.cashLedger).toMatchObject({ totalOut: 250_000 });
    expect(changedTeam).not.toHaveProperty('legacyBaseCarrier');

    const persistedTeamEntry = getBatchSetEntry(
      `architect_worlds/${WORLD_ID}/teams/LAL`
    );
    const persistedTeam =
      (persistedTeamEntry?.[1] as Record<string, unknown> | undefined) || {};

    expect(persistedTeam.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_lal_1',
        amount: 1_500_000,
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(persistedTeam.exceptionHistory).toEqual(initialExceptionHistory);
    expect(persistedTeam.draftPicks).toEqual([carriedPick]);
    expect(persistedTeam.entitlementIds).toEqual(['ent_lal_keep']);
    expect(persistedTeam.cashLedger).toMatchObject({ totalOut: 250_000 });
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
    expect(persistedTeam).not.toHaveProperty('legacyBaseCarrier');
    expect(
      Object.keys(persistedTeam).filter((key) =>
        key.startsWith('__currentStateBasePreserved')
      )
    ).toEqual([]);
  });

  it('keeps narrowed player normalization working for a committed signFreeAgent flow', async () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer(
      'fa_closure_1',
      'Closure Free Agent',
      0,
      null,
      {
        representation: {
          agent: 'Closure Agent',
          agency: 'Closure Agency',
        },
        source: {
          provider: 'test-suite',
          generatedAt: FIXED_TIMESTAMP_ISO,
          playerPageUrl: 'https://example.com/fa_closure_1',
        },
        lastUpdated: FIXED_TIMESTAMP_ISO,
        version: 'player-version-7',
        isTwoWay: true,
        signedDate: '2025-07-09',
        legacyPlayerEnvelope: { shouldDrop: true },
      }
    );

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'LAL') {
          return team;
        }
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_current_state_closure',
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_closure_1',
        contract: makeContract(8_500_000, {
          years: 2,
          contractYears: 2,
          totalValue: 17_000_000,
          salariesByYear: [
            {
              season: '2026-27',
              salary: 8_500_000,
              capHit: 8_500_000,
              guaranteed: true,
            },
            {
              season: '2027-28',
              salary: 8_500_000,
              capHit: 8_500_000,
              guaranteed: true,
            },
          ],
        }),
        signedUsing: 'Cap Space',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const changedPlayer = result.changedPlayers?.[0]?.player;
    expect(changedPlayer?.teamCode).toBe('LAL');
    expect(changedPlayer?.representation).toEqual({
      agent: 'Closure Agent',
      agency: 'Closure Agency',
    });
    expect(changedPlayer?.source).toMatchObject({
      provider: 'test-suite',
      playerPageUrl: 'https://example.com/fa_closure_1',
    });
    expect(changedPlayer?.lastUpdated).toBe(FIXED_TIMESTAMP_ISO);
    expect(changedPlayer?.version).toBe('player-version-7');
    expect(changedPlayer?.isTwoWay).toBe(true);
    expect(changedPlayer?.signedDate).toBe('2025-07-09');
    expect(changedPlayer).not.toHaveProperty('legacyPlayerEnvelope');

    const persistedPlayerEntry = getBatchSetEntry(
      `architect_worlds/${WORLD_ID}/teams/LAL/players/fa_closure_1`
    );
    const persistedPlayer =
      (persistedPlayerEntry?.[1] as Record<string, unknown> | undefined) || {};

    expect(persistedPlayer.teamCode).toBe('LAL');
    expect(persistedPlayer.representation).toEqual({
      agent: 'Closure Agent',
      agency: 'Closure Agency',
    });
    expect(persistedPlayer.source).toMatchObject({
      provider: 'test-suite',
      playerPageUrl: 'https://example.com/fa_closure_1',
    });
    expect(persistedPlayer).not.toHaveProperty('legacyPlayerEnvelope');
  });

  it('keeps executeTrade working when the narrowed trade-team lane bridges explicit Apron Team Salary', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL');
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'BOS');
    const teamA = makeTeam('LAL', [playerA]);
    const teamB = makeTeam('BOS', [playerB]);

    delete teamA.teamTotalSalary;
    delete teamB.teamTotalSalary;
    teamA.totals = {
      ...(teamA.totals as Record<string, unknown>),
      teamSalary: 120_000_000,
      apronTeamSalary: 120_000_000,
      taxSalary: 120_000_000,
      totalSalary: '120000000',
    } as unknown as ArchitectMutationTeamRecord['totals'];
    teamB.totals = {
      ...(teamB.totals as Record<string, unknown>),
      teamSalary: 121_000_000,
      apronTeamSalary: 121_000_000,
      taxSalary: 121_000_000,
      totalSalary: '121000000',
    } as unknown as ArchitectMutationTeamRecord['totals'];

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'LAL') return teamA;
        if (teamCode === 'BOS') return teamB;
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );

    const result = await applyWorldMutation({
      userId: 'user_current_state_closure',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { worldId: WORLD_ID },
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const bostonTeam = result.changedTeams?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const movedPlayer = bostonTeam?.players?.find(
      (player) =>
        player.player_id === 'player_a' || player.playerId === 'player_a'
    );

    expect(movedPlayer?.displayName).toBe('Player A');
    expect(
      result.changedPlayers?.find((update) => update.playerId === 'player_a')
        ?.player?.teamCode
    ).toBe('BOS');
  });
});
