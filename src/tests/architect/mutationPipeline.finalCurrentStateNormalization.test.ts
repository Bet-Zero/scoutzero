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

vi.mock('@/features/architect/utils/tradeContext/tradeExecutionAuthority', () => ({
  evaluateTradeSnapshotValidationStage: vi.fn(),
  validateTradeExecutionAuthority: vi.fn(
    async ({
      computeResult,
    }: {
      computeResult: {
        teamUpdates?: Array<{
          teamCode?: string | null;
          team?: Record<string, unknown> | null;
        }>;
      };
    }) => {
      const afterTeamsByCode = Object.fromEntries(
        (computeResult.teamUpdates || [])
          .filter((update) => update?.teamCode && update.team)
          .map((update) => [String(update.teamCode), update.team])
      );

      return {
        valid: true,
        warnings: [],
        violations: [],
        auditArtifacts: {
          afterTeamsByCode,
          beforeTotalsByTeam: {},
          afterTotalsByTeam: {},
          postStateValid: true,
          postStateViolations: [],
          postStateWarnings: [],
        },
      };
    }
  ),
}));

vi.mock(
  '@/features/architect/utils/tradeContext/tradeContext',
  async () => {
    const actual =
      await vi.importActual<
        typeof import('@/features/architect/utils/tradeContext/tradeContext')
      >('@/features/architect/utils/tradeContext/tradeContext');

    return {
      ...actual,
      buildTradeApplyPreparation: vi.fn(
        ({
          payload,
          currentState,
          seasonId,
          timestamp,
          asOfDate,
        }: Parameters<typeof actual.buildTradeApplyPreparation>[0]) => {
          const postTradeSnapshot = actual.buildPostTradeTeamsSnapshot({
            payload,
            currentState,
            seasonId,
            timestamp,
          });
          const teamResults = (payload.teams || []).map(() => ({
            rules: { tradeExceptions: false },
            createdTPE: null,
          }));
          const validationTeams = (payload.teams || []).map(
            (_teamTrade, teamIndex) => ({
              receives: (payload.teams || []).flatMap((otherTeam, otherIndex) =>
                otherIndex === teamIndex ? [] : otherTeam.sends || []
              ),
            })
          );

          return {
            postTradeSnapshot,
            validatedContext: {
              legal: true,
              reason: null,
              error: null,
              violations: [],
              warnings: [],
              teamResults,
              validationTeams,
              _rawValidation: {
                legal: true,
                teamResults,
              },
              _isValidatedTradeContext: true,
            },
            validationPayload: {
              asOfDate: asOfDate ?? null,
            },
          };
        }
      ),
    };
  }
);

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

import { applyWorldMutation, computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];

const FIXED_TIMESTAMP = Date.parse('2026-04-11T14:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-11T14:00:00.000Z';
const SEASON_ID = '2025-26';
const WORLD_ID = 'world_final_current_state_normalization';

function makeSalaryRow(
  season: string,
  salary: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: null,
    ...overrides,
  };
}

function makeContract(
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    contractType: 'Standard',
    signingTeam: teamCode,
    signingDate: '2025-07-01',
    salariesByYear: [makeSalaryRow(SEASON_ID, salary)],
    birdRights: { status: 'Full', yearsOfService: 5 },
    freeAgency: { type: 'UFA', year: 2027 },
    totalValue: salary,
    years: 1,
    contractYears: 1,
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
    contract: makeContract(salary, teamCode),
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
    teamTotalSalary: totalSalary,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    twoWayPlayers: [],
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

beforeEach(() => {
  vi.clearAllMocks();
  testState.getDoc.mockResolvedValue({
    exists: () => false,
    data: () => null,
  });
  testState.getLeague.mockResolvedValue([]);
  testState.getWorldMetadata.mockResolvedValue({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  });
});

describe('mutationPipeline final current-state normalization', () => {
  it('preserves base-team round-trip fields through setExceptions while dropping raw ingress baggage', () => {
    const initialExceptionHistory = [
      {
        id: 'hist_base_keep',
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
      metadata: { source: 'base-round-trip' },
    };
    const team = makeTeam('LAL', [], {
      tradeExceptions: [
        {
          id: 'tpe_base_keep',
          amount: 1_500_000,
          remainingAmount: 1_500_000,
          totalAmount: 1_500_000,
          createdSeason: 2026,
        },
      ],
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
    });

    const result = computeWorldMutation({
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
      currentState: {
        team: {
          ...team,
          legacyTeamIngressBlob: { shouldDrop: true },
        } as CurrentStateInput['team'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        enabled: true,
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
    });
    expect(updatedTeam?.exceptions?.tpe).toEqual([
      { id: 'canonical_tpe_keep', amount: 750_000 },
    ]);
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_base_keep',
        amount: 1_500_000,
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual(initialExceptionHistory);
    expect(updatedTeam?.draftPicks).toEqual([carriedPick]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_lal_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 250_000 });
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');
  });

  it('refuses ungoverned option ingress before player normalization can mutate it', () => {
    const player = makePlayer('option_1', 'Option One', 9_500_000, 'LAL', {
      contract: makeContract(9_500_000, 'LAL', {
        signingDate: '2024-07-06',
        salariesByYear: [
          makeSalaryRow('2025-26', 9_500_000),
          makeSalaryRow('2026-27', 10_750_000, {
            option: 'Player',
            optionUsed: 'declined',
            legacyRowBlob: { shouldDrop: true },
          }),
        ],
      }),
      bio: {
        displayName: 'Option One',
        playerId: 'option_1',
        position: 'SF',
        experience: '4',
        yearsExperience: 4,
        yearsPro: '5',
        ['Years Pro']: '5',
        draft: {
          year: 2022,
          round: 1,
          pick: 20,
          teamId: 'LAL',
          legacyDraftBlob: { shouldDrop: true },
        },
        display: {
          freeAgentType: 'UFA',
          freeAgentYear: 2027,
          team: 'LAL',
          teamId: 'LAL',
          yearsPro: '5',
          legacyDisplayBlob: { shouldDrop: true },
        },
        legacyBioBlob: { shouldDrop: true },
      },
    });
    const team = makeTeam('LAL', [player]);

    const result = computeWorldMutation({
      mutationType: 'optionDecision',
      payload: {
        teamCode: 'LAL',
        playerId: 'option_1',
        accepted: true,
        targetYear: 2027,
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: player as CurrentStateInput['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result).toMatchObject({
      success: false,
      error:
        'Governed option decision requires the pinned contract, explicit world date, exact notice evidence, and author provenance.',
    });
    expect(result.teamUpdates).toBeUndefined();
    expect(result.playerUpdates).toBeUndefined();
  });

  it('persists trade-team outputs with round-trip fields materialized and teamTotalSalary stripped', async () => {
    const lakersOutgoing = makePlayer('lal_trade_1', 'Laker Trade One', 10_000_000, 'LAL');
    const celticsOutgoing = makePlayer('bos_trade_1', 'Celtic Trade One', 11_000_000, 'BOS');
    const initialExceptionHistory = [
      {
        id: 'hist_trade_keep',
        type: 'existing',
        createdAt: FIXED_TIMESTAMP_ISO,
      },
    ];
    const carriedPick = {
      year: 2029,
      round: 1,
      pick: null,
      owner: 'LAL',
    };
    const lakers = makeTeam('LAL', [lakersOutgoing], {
      tradeExceptions: [
        {
          id: 'tpe_trade_keep',
          amount: 900_000,
          remainingAmount: 900_000,
          totalAmount: 900_000,
          createdSeason: 2026,
        },
      ],
      exceptionHistory: initialExceptionHistory,
      draftPicks: [carriedPick],
      entitlementIds: ['ent_lal_trade_keep'],
      cashLedger: { totalOut: 400_000 },
    });
    const celtics = makeTeam('BOS', [celticsOutgoing], {
      entitlementIds: ['ent_bos_trade_keep'],
    });

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'LAL') {
          return {
            ...lakers,
            legacyTradeIngressBlob: { shouldDrop: true },
          };
        }
        if (teamCode === 'BOS') {
          return celtics;
        }
        return null;
      }
    );

    const result = await applyWorldMutation({
      userId: 'user_final_current_state_normalization',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          { teamCode: 'LAL', sends: [lakersOutgoing] },
          { teamCode: 'BOS', sends: [celticsOutgoing] },
        ],
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const teamWriteCall = testState.batchSet.mock.calls.find(([ref]) =>
      String(ref).includes(`/teams/LAL`)
    );
    const persistedTeam = teamWriteCall?.[1] as Record<string, unknown> | undefined;

    expect(persistedTeam).toBeDefined();
    expect(persistedTeam?.players).toEqual([
      expect.objectContaining({
        player_id: 'bos_trade_1',
        teamCode: 'LAL',
      }),
    ]);
    expect(persistedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_trade_keep',
        amount: 900_000,
        remainingAmount: 900_000,
      }),
    ]);
    expect(persistedTeam?.exceptionHistory).toEqual(initialExceptionHistory);
    expect(persistedTeam?.draftPicks).toEqual([carriedPick]);
    expect(persistedTeam?.entitlementIds).toEqual(['ent_lal_trade_keep']);
    expect(persistedTeam?.cashLedger).toMatchObject({ totalOut: 400_000 });
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
    expect(persistedTeam).not.toHaveProperty('legacyTradeIngressBlob');
  });
});
