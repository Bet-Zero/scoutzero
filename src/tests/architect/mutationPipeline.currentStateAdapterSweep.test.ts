import { beforeEach, describe, expect, it, vi } from 'vitest';

type DocShape = Record<string, unknown> | null;

const testState = vi.hoisted(() => ({
  docsByPath: new Map<string, DocShape>(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(async (): Promise<{ exists: () => boolean; data: () => DocShape }> => ({
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

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-03-25T12:00:00.000Z';
const SEASON_ID = '2025-26';
const WORLD_ID = 'world_current_state_adapter_sweep';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
  };
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
    },
    representation: {
      agent: 'Boundary Agent',
      agency: 'Boundary Agency',
    },
    source: {
      provider: 'test-suite',
      generatedAt: FIXED_TIMESTAMP_ISO,
      playerPageUrl: `https://example.com/${id}`,
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
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { mle: null, bae: null, tpe: [] },
    deadCap: [],
    teamTotalSalary: totalSalary,
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
  };
}

function buildTradeTeamResult({
  teamCode,
  totalSalary,
  incomingPlayers = [],
  tradeExceptionsRule,
}: {
  teamCode: string;
  totalSalary: number;
  incomingPlayers?: Array<Record<string, unknown>>;
  tradeExceptionsRule?: Record<string, unknown>;
}) {
  return {
    teamId: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    legal: true,
    violations: [],
    warnings: [],
    rules: tradeExceptionsRule
      ? { tradeExceptions: tradeExceptionsRule }
      : {},
    salaryOut: 0,
    salaryIn: 0,
    outgoingPlayers: [],
    incomingPlayers,
    calculations: {
      salaryOut: 0,
      salaryIn: 0,
      projectedSalary: totalSalary,
    },
  };
}

function getTeamSetPayload(teamCode: string): Record<string, unknown> | undefined {
  const entry = testState.batchSet.mock.calls.find(([ref]) => {
    const path = String(ref);
    return (
      path.includes(`architect_worlds/${WORLD_ID}/teams/${teamCode}`) &&
      !path.includes('/players/')
    );
  });

  return entry?.[1] as Record<string, unknown> | undefined;
}

describe('mutationPipeline current-state adapter sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.docsByPath.clear();

    testState.getWorldMetadata.mockResolvedValue({
      parentWorldId: null,
      asOfDate: '2026-07-01',
    });

    testState.validateTrade.mockImplementation((input?: { teams?: unknown[] }) => {
      const teams = Array.isArray(input?.teams)
        ? (input.teams as Array<Record<string, unknown> | null | undefined>)
        : [];
      const legal =
        teams.length > 0 &&
        teams.every((teamTrade) => {
          const team = (teamTrade?.team || {}) as Record<string, unknown>;
          return typeof team.teamTotalSalary === 'number' && team.teamTotalSalary > 0;
        });

      return {
        valid: legal,
        success: legal,
        legal,
        reason: legal ? null : 'teamTotalSalary must be numeric at the apply boundary',
        violations: [],
        warnings: [],
        teamResults: teams.map((teamTrade) => {
          const team = (teamTrade?.team || {}) as Record<string, unknown>;
          const teamCode = String(teamTrade?.teamCode || team.teamCode || '');
          return buildTradeTeamResult({
            teamCode,
            totalSalary: Number(team.teamTotalSalary || 0),
          });
        }),
      };
    });
  });

  it('signFreeAgent omits trade-only team lane fields from the persisted team write while keeping broad player fields', async () => {
    const existingTwoWay = makePlayer('two_way_keep', 'Two Way Keep', 900_000, 'LAL', {
      isTwoWay: true,
    });
    const team = makeTeam('LAL', [], {
      twoWayPlayers: [existingTwoWay],
      teamTotalSalary: 120_000_000,
    });
    const freeAgent = makePlayer('fa_1', 'Free Agent One', 0, null, {
      freeAgency: { type: 'Unrestricted', year: 2026 },
    });

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') {
        return team;
      }
      throw new Error(`Unexpected team load: ${teamCode}`);
    });
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_adapter_sweep',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_1',
        contract: makeContract(8_500_000, {
          years: 2,
          contractYears: 2,
          totalValue: 17_000_000,
        }),
        signedUsing: 'Cap Space',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.changedTeams?.[0]?.team?.roster).toContain('fa_1');
    expect(result.changedPlayers?.[0]?.player?.representation).toEqual({
      agent: 'Boundary Agent',
      agency: 'Boundary Agency',
    });

    const persistedTeam = getTeamSetPayload('LAL');
    expect(persistedTeam).toBeDefined();
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
    expect(persistedTeam).not.toHaveProperty('twoWayPlayers');
  });

  it('executeTrade bridges explicit Apron Team Salary for validation and preserves two-way player movement in public output', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      isTwoWay: true,
    });
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
    };
    teamB.totals = {
      ...(teamB.totals as Record<string, unknown>),
      teamSalary: 121_000_000,
      apronTeamSalary: 121_000_000,
      taxSalary: 121_000_000,
      totalSalary: '121000000',
    };

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') return teamA;
      if (teamCode === 'BOS') return teamB;
      throw new Error(`Unexpected team load: ${teamCode}`);
    });

    const result = await applyWorldMutation({
      userId: 'user_adapter_sweep',
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
    expect(
      bostonTeam?.players?.some(
        (player) => player.playerId === 'player_a' || player.player_id === 'player_a'
      )
    ).toBe(true);
    expect(
      bostonTeam?.twoWayPlayers?.some(
        (player) => player.playerId === 'player_a' || player.player_id === 'player_a'
      )
    ).toBe(true);
  });

  it('executeTrade still consumes legacy mixed tradeExceptions inputs through authoritative apply-time receives', async () => {
    const playerA = makePlayer('player_a', 'Player A', 3_000_000, 'LAL');
    const playerB = makePlayer('player_b', 'Player B', 3_000_000, 'BOS');
    const teamA = makeTeam('LAL', [playerA]);
    const teamB = makeTeam('BOS', [playerB], {
      tradeExceptions: [
        {
          id: 'tpe_bos',
          amount: '5000000',
          totalAmount: '5000000',
          remainingAmount: '5000000',
          usedAmount: '0',
          createdSeason: '2025',
          expiresOn: '2026-07-01',
          createdFrom: 'Earlier Trade',
        },
      ],
    });

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') return teamA;
      if (teamCode === 'BOS') return teamB;
      throw new Error(`Unexpected team load: ${teamCode}`);
    });

    testState.validateTrade.mockImplementationOnce((input?: { teams?: unknown[] }) => {
      const teams = Array.isArray(input?.teams)
        ? (input.teams as Array<Record<string, unknown> | null | undefined>)
        : [];
      const lalSalary = Number(
        ((teams[0]?.team || {}) as Record<string, unknown>).teamTotalSalary || 0
      );
      const bosSalary = Number(
        ((teams[1]?.team || {}) as Record<string, unknown>).teamTotalSalary || 0
      );

      return {
        valid: true,
        success: true,
        legal: true,
        reason: null,
        violations: [],
        warnings: [],
        teamResults: [
          buildTradeTeamResult({
            teamCode: 'LAL',
            totalSalary: lalSalary,
          }),
          buildTradeTeamResult({
            teamCode: 'BOS',
            totalSalary: bosSalary,
            incomingPlayers: [
              {
                player_id: 'player_a',
                id: 'player_a',
                playerId: 'player_a',
                name: 'Player A',
                displayName: 'Player A',
                absorptionMode: 'TPE',
                tpeId: 'tpe_bos',
                matchIncoming: 3_000_000,
              },
            ],
            tradeExceptionsRule: {},
          }),
        ],
      };
    });

    const result = await applyWorldMutation({
      userId: 'user_adapter_sweep',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [playerA],
            receives: [],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [playerB],
            receives: [],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { worldId: WORLD_ID },
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedBostonTeam = result.changedTeams?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const consumedTpe = updatedBostonTeam?.tradeExceptions?.find(
      (exception) => exception.id === 'tpe_bos'
    );

    expect(consumedTpe?.remainingAmount).toBe(2_000_000);
    expect(consumedTpe?.usedAmount).toBe(3_000_000);
  });
});
