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
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateFor<TMutationType extends ComputeArgs['mutationType']> =
  Extract<ComputeArgs, { mutationType: TMutationType }>['currentState'];
type SetExceptionsCurrentState = CurrentStateFor<'setExceptions'>;
type SignFreeAgentCurrentState = CurrentStateFor<'signFreeAgent'>;
type SignAndTradeCurrentState = CurrentStateFor<'signAndTrade'>;

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-08-21T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-08-21T12:00:00.000Z';
const WORLD_ID = 'world_internal_current_state_projection';

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
    birdRights: makeBirdRights(),
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
  overrides: Partial<ArchitectMutationPlayerRecord> &
    Record<string, unknown> = {}
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
      yearsExperience: 4,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: teamCode ? null : 'UFA',
      },
    },
    birdRights: makeBirdRights(),
    ...overrides,
  } as ArchitectMutationPlayerRecord & Record<string, unknown>;
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
    teamTotalSalary: totalSalary,
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
    exceptions: { room: null, mle: null, bae: null, tpe: [] },
    totals: {
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

beforeEach(() => {
  vi.clearAllMocks();

  testState.batchCommit.mockResolvedValue(undefined);
  testState.getDoc.mockResolvedValue({
    exists: () => false,
    data: () => null,
  });
  testState.getWorldMetadata.mockResolvedValue({
    parentWorldId: null,
    asOfDate: '2026-07-08',
  });
  testState.validateTrade.mockImplementation(
    (input?: { teams?: unknown[] }) => {
      const teams = Array.isArray(input?.teams)
        ? (input.teams as Array<Record<string, unknown> | null | undefined>)
        : [];

      return {
        valid: true,
        success: true,
        legal: true,
        reason: null,
        violations: [],
        warnings: [],
        teamResults: teams.map((teamTrade) => {
          const team =
            (teamTrade?.team as Record<string, unknown> | undefined) || {};
          const totals =
            (team.totals as Record<string, unknown> | undefined) || {};
          const teamCode = String(teamTrade?.teamCode || team.teamCode || '');
          return buildTradeTeamResult({
            teamCode,
            totalSalary: Number(
              team.teamTotalSalary || totals.totalSalary || 0
            ),
          });
        }),
      };
    }
  );
});

describe('mutationPipeline internal current-state projection', () => {
  it('keeps loader-originated team breadth at the read boundary while preserving committed reload material', async () => {
    const preservedHistory = [
      {
        historyKey: 'hist_keep',
        type: 'TPE_CREATED',
        teamCode: 'LAL',
        timestamp: FIXED_TIMESTAMP_ISO,
      },
    ];
    const carriedPick = {
      year: 2029,
      round: 1,
      pick: null,
      owner: 'LAL',
      metadata: { source: 'projection-pass-test' },
    };
    const team = makeTeam('LAL', [], {
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 1_500_000,
          totalAmount: 1_500_000,
          remainingAmount: 1_500_000,
          usedAmount: 0,
          createdSeason: 2026,
          expiresOn: '2026-07-01',
        },
      ],
      exceptionHistory: preservedHistory,
      draftPicks: [carriedPick],
      entitlementIds: ['ent_keep'],
      cashLedger: { totalOut: 500_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
      },
      legacyProjectionEnvelope: { shouldDrop: true },
    });

    testState.getTeam.mockResolvedValue(team);

    const result = await applyWorldMutation({
      userId: 'user_projection_team',
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

    const committedTeam = findCommittedTeamSnapshot(result.changedTeams, 'LAL');
    const reloadTeam =
      buildGeneralMutationDashboardReloadTeamSnapshot(committedTeam);

    expect(committedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_keep',
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(committedTeam?.exceptionHistory).toEqual(preservedHistory);
    expect(committedTeam?.draftPicks).toEqual([carriedPick]);
    expect(committedTeam?.entitlementIds).toEqual(['ent_keep']);
    expect(reloadTeam?.exceptionHistory).toEqual(preservedHistory);
    expect(reloadTeam?.draftPicks).toEqual([carriedPick]);
    expect(reloadTeam?.entitlementIds).toEqual(['ent_keep']);

    const persistedTeam =
      (getBatchSetEntry(`architect_worlds/${WORLD_ID}/teams/LAL`)?.[1] as
        | Record<string, unknown>
        | undefined) || {};

    expect(persistedTeam.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_keep',
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(persistedTeam.exceptionHistory).toEqual(preservedHistory);
    expect(persistedTeam.draftPicks).toEqual([carriedPick]);
    expect(persistedTeam.entitlementIds).toEqual(['ent_keep']);
    expect(persistedTeam).not.toHaveProperty('legacyProjectionEnvelope');
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
  });

  it('keeps the player-side projection path working for signFreeAgent and strips loader-only baggage', async () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer(
      'fa_projection_1',
      'Projection Free Agent',
      0,
      null,
      {
        representation: {
          agent: 'Projection Agent',
          agency: 'Projection Agency',
        },
        source: {
          provider: 'test-suite',
          generatedAt: FIXED_TIMESTAMP_ISO,
          playerPageUrl: 'https://example.com/fa_projection_1',
        },
        lastUpdated: FIXED_TIMESTAMP_ISO,
        version: 'player-version-9',
        isTwoWay: true,
        signedDate: '2025-07-09',
        legacyPlayerProjectionEnvelope: { shouldDrop: true },
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
      userId: 'user_projection_player',
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_projection_1',
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
      agent: 'Projection Agent',
      agency: 'Projection Agency',
    });
    expect(changedPlayer?.source).toMatchObject({
      provider: 'test-suite',
      playerPageUrl: 'https://example.com/fa_projection_1',
    });
    expect(changedPlayer?.lastUpdated).toBe(FIXED_TIMESTAMP_ISO);
    expect(changedPlayer?.version).toBe('player-version-9');
    expect(changedPlayer?.isTwoWay).toBe(true);
    expect(changedPlayer?.signedDate).toBe('2025-07-09');
    expect(changedPlayer).not.toHaveProperty('legacyPlayerProjectionEnvelope');

    const persistedPlayer =
      (getBatchSetEntry(
        `architect_worlds/${WORLD_ID}/teams/LAL/players/fa_projection_1`
      )?.[1] as Record<string, unknown> | undefined) || {};

    expect(persistedPlayer.teamCode).toBe('LAL');
    expect(persistedPlayer.representation).toEqual({
      agent: 'Projection Agent',
      agency: 'Projection Agency',
    });
    expect(persistedPlayer.source).toMatchObject({
      provider: 'test-suite',
      playerPageUrl: 'https://example.com/fa_projection_1',
    });
    expect(persistedPlayer).not.toHaveProperty(
      'legacyPlayerProjectionEnvelope'
    );
  });

  it('keeps the narrowed trade-side projection working through sign-and-trade compute handoff', () => {
    const satPlayer = makePlayer('sat_player', 'SAT Player', 0, null, {
      contract: {
        contractType: 'Free Agent',
      },
      freeAgency: {
        type: 'Unrestricted',
        year: 2026,
      },
      birdRights: makeBirdRights(),
    });
    const sourceTeam = makeTeam('LAL', [], {
      capHolds: [
        {
          playerId: 'sat_player',
          playerName: 'SAT Player',
          season: SEASON_ID,
          amount: 12_000_000,
          active: true,
          isSigned: false,
        },
      ],
      exceptionHistory: [
        {
          historyKey: 'sat_history',
          type: 'SAT_PREP',
          timestamp: FIXED_TIMESTAMP_ISO,
        },
      ],
      legacyTradeProjectionEnvelope: { shouldDrop: true },
    });
    const destinationTeam = makeTeam('BOS', [
      makePlayer('counter', 'Counter Player', 14_000_000, 'BOS'),
    ]);

    const result = computeWorldMutation({
      mutationType: 'signAndTrade',
      payload: {
        teamCode: 'LAL',
        destinationTeamCode: 'BOS',
        playerId: 'sat_player',
        signedUsing: 'Bird Rights',
        contract: makeContract(15_000_000, {
          contractType: 'Sign & Trade',
          years: 3,
          contractYears: 3,
          totalValue: 47_250_000,
          salariesByYear: [
            {
              season: SEASON_ID,
              salary: 15_000_000,
              capHit: 15_000_000,
              guaranteed: true,
              guaranteedAmount: 15_000_000,
            },
            {
              season: '2026-27',
              salary: 15_750_000,
              capHit: 15_750_000,
              guaranteed: true,
              guaranteedAmount: 15_750_000,
            },
            {
              season: '2027-28',
              salary: 16_500_000,
              capHit: 16_500_000,
              guaranteed: true,
              guaranteedAmount: 16_500_000,
            },
          ],
        }),
      },
      currentState: {
        team: sourceTeam as SignAndTradeCurrentState['team'],
        player: satPlayer as SignAndTradeCurrentState['player'],
        destinationTeam:
          destinationTeam as SignAndTradeCurrentState['destinationTeam'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);

    const sourceUpdate = result.teamUpdates?.find(
      (update) => update.teamCode === 'LAL'
    )?.team;
    const destinationUpdate = result.teamUpdates?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'sat_player'
    )?.player;

    expect(sourceUpdate?.roster).not.toContain('sat_player');
    expect(
      sourceUpdate?.capHolds?.some((hold) => hold.playerId === 'sat_player')
    ).toBe(false);
    expect(destinationUpdate?.roster).toContain('sat_player');
    expect(
      destinationUpdate?.players?.some(
        (player) => player.player_id === 'sat_player'
      )
    ).toBe(true);
    expect(movedPlayer?.teamCode).toBe('BOS');
    expect(movedPlayer?.contract?.contractType).toBe('Sign & Trade');
    expect(
      sourceUpdate &&
        Object.prototype.hasOwnProperty.call(
          sourceUpdate,
          'legacyTradeProjectionEnvelope'
        )
    ).toBe(false);
  });
});
