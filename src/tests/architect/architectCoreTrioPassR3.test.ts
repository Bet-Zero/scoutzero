import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(),
  mergePlayerOverride: vi.fn(
    (
      snapshotPlayer: Record<string, unknown>,
      overridePlayer: Record<string, unknown>
    ) => ({
      ...snapshotPlayer,
      ...overridePlayer,
    })
  ),
  getWorldMetadata: vi.fn(),
  getDraftPositionsMap: vi.fn(),
  updateWorldStats: vi.fn(async (): Promise<void> => undefined),
  validateTrade: vi.fn(),
  buildPostTradeTeamsSnapshot: vi.fn(),
  validatePostTradeSnapshotForContext: vi.fn(),
  assertPostTradeSnapshot: vi.fn(),
  assertValidatedTradeContext: vi.fn(),
  assertTradeComputeInputs: vi.fn(),
  validatePostStateCapLegality: vi.fn(),
  computeTeamCapTotals: vi.fn(),
  resolveOffseasonTransition: vi.fn(),
  validateMutationLeagueInvariants: vi.fn(),
  validateMutationEntitlementInvariants: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: mocks.batchSet,
    update: mocks.batchUpdate,
    commit: mocks.batchCommit,
  })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  increment: vi.fn((value: number) => value),
  collection: vi.fn((_db: unknown, ...segments: string[]) =>
    segments.join('/')
  ),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: mocks.getTeam,
  getPlayer: mocks.getPlayer,
  getLeague: mocks.getLeague,
  mergePlayerOverride: mocks.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: mocks.getWorldMetadata,
  getDraftPositionsMap: mocks.getDraftPositionsMap,
  updateWorldStats: mocks.updateWorldStats,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: mocks.validateTrade,
}));

vi.mock('@/features/architect/utils/tradeContext', () => ({
  buildPostTradeTeamsSnapshot: mocks.buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext:
    mocks.validatePostTradeSnapshotForContext,
  assertPostTradeSnapshot: mocks.assertPostTradeSnapshot,
  assertValidatedTradeContext: mocks.assertValidatedTradeContext,
  assertTradeComputeInputs: mocks.assertTradeComputeInputs,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: mocks.validatePostStateCapLegality,
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: mocks.computeTeamCapTotals,
}));

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: mocks.resolveOffseasonTransition,
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/tradeMachine/utils/capSettingsProvider')
      >();

    return {
      ...actual,
      getCapSettings: vi.fn(() => ({
        settings: {
          floor: 120_000_000,
          salaryCap: 141_000_000,
          luxuryTax: 170_000_000,
          firstApron: 178_000_000,
          secondApron: 188_000_000,
        },
        source: 'test',
      })),
    };
  }
);

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: (team: Record<string, unknown>) => team,
  getTeamTpeList: (): Array<Record<string, unknown>> => [],
  assertPersistableOrThrow: vi.fn((): void => undefined),
  PERSISTENCE_CONTRACTS: {
    TEAM: {},
    EVENT: {},
  },
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamRef: vi.fn(
    (worldId: string, teamCode: string) =>
      `architect_worlds/${worldId}/teams/${teamCode}`
  ),
  worldPlayerRef: vi.fn(
    (worldId: string, teamCode: string, playerId: string) =>
      `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`
  ),
  worldMetadataRef: vi.fn((worldId: string) => `architect_worlds/${worldId}`),
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: mocks.validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants:
    mocks.validateMutationEntitlementInvariants,
}));

import { computeExpectedCapHoldAmount, getRightsTypeFromPlayer } from '@/features/architect/utils/capHoldTransitionHelpers';
import { validateOptionDecision } from '@/features/architect/utils/capLegalityValidation';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';

function makeTeam(teamCode: string) {
  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    season: '2025-26',
    roster: [] as unknown[],
    players: [] as Array<Record<string, unknown>>,
    capHolds: [] as Array<Record<string, unknown>>,
    deadCap: [] as Array<Record<string, unknown>>,
    draftPicks: [] as Array<Record<string, unknown>>,
    tradeExceptions: [] as Array<Record<string, unknown>>,
    exceptionHistory: [] as Array<Record<string, unknown>>,
    entitlementIds: [] as string[],
    exceptions: { tpe: [] as Array<Record<string, unknown>> },
    totals: { totalSalary: 0, capHit: 0, totalCapAllocations: 0 },
  };
}

describe('Architect core trio pass R3 proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.computeTeamCapTotals.mockImplementation(
      (team: Record<string, unknown>, year: number) => ({
        yearKey: year,
        playersTotal: Array.isArray(team.players) ? team.players.length : 0,
        deadMoneyTotal: Array.isArray(team.deadCap) ? team.deadCap.length : 0,
        capHoldsTotal: Array.isArray(team.capHolds)
          ? team.capHolds.length * 1_000_000
          : 0,
        incompleteChargesTotal: 0,
        totalCapAllocations: 120_000_000,
        totalSalary: 120_000_000,
        capHit: 120_000_000,
        salaryCap: 141_000_000,
        luxuryTax: 170_000_000,
        firstApron: 178_000_000,
        secondApron: 188_000_000,
      })
    );

    mocks.validatePostStateCapLegality.mockReturnValue({
      valid: true,
      violations: [],
      warnings: [],
    });

    mocks.validateMutationLeagueInvariants.mockReturnValue({
      valid: true,
      violations: [],
    });
    mocks.validateMutationEntitlementInvariants.mockReturnValue({
      valid: true,
      violations: [],
    });
  });

  it('returns a waived team state with the player removed and dead cap added', () => {
    const waivePlayer = {
      player_id: 'player_1',
      id: 'player_1',
      displayName: 'Boundary Waive',
      contract: {
        guaranteedValue: 18_000_000,
        salariesByYear: [
          {
            season: '2025-26',
            salary: 12_000_000,
            capHit: 12_000_000,
            guaranteed: true,
          },
          {
            season: '2026-27',
            salary: 6_000_000,
            capHit: 6_000_000,
            guaranteed: true,
          },
        ],
      },
    };

    const result = computeWorldMutation({
      mutationType: 'waivePlayer',
      payload: {
        teamCode: 'LAL',
        playerId: 'player_1',
        stretch: false,
      },
      currentState: {
        teamCode: 'LAL',
        team: {
          ...makeTeam('LAL'),
          roster: ['player_1', 'player_2'],
          players: [
            waivePlayer,
            {
              player_id: 'player_2',
              displayName: 'Stay Put',
              contract: {
                salariesByYear: [
                  {
                    season: '2025-26',
                    salary: 5_000_000,
                    capHit: 5_000_000,
                    guaranteed: true,
                  },
                ],
              },
            },
          ],
        },
        player: waivePlayer,
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-15T12:00:00.000Z'),
    });

    const updatedTeam = result.teamUpdates?.[0]?.team;

    expect(result.success).toBe(true);
    expect(updatedTeam?.roster).toEqual(['player_2']);
    expect(updatedTeam?.players).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ player_id: 'player_1' }),
      ])
    );
    expect(updatedTeam?.deadCap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: 'player_1',
          originalSalary: 18_000_000,
          amountByYear: [
            expect.objectContaining({
              season: '2025-26',
              amount: 18_000_000,
            }),
          ],
        }),
      ])
    );
    expect(updatedTeam?.source).toEqual(
      expect.objectContaining({
        type: 'world-snapshot',
        lastModifiedAt: '2026-03-15T12:00:00.000Z',
      })
    );
    expect(updatedTeam?.totals).toEqual(
      expect.objectContaining({
        totalCapAllocations: 120_000_000,
      })
    );
  });

  it('validates a declined option through the public validator result', () => {
    const originalPlayer = {
      player_id: 'player_1',
      displayName: 'Option Boundary',
      teamCode: 'LAL',
      contract: {
        birdRights: {
          status: 'Full Bird',
          yearsWithTeam: 3,
        },
        salariesByYear: [
          {
            season: '2025-26',
            salary: 10_000_000,
            capHit: 10_000_000,
            guaranteed: true,
          },
          {
            season: '2026-27',
            salary: 11_000_000,
            capHit: 11_000_000,
            option: 'Player Option',
          },
        ],
      },
    };

    const expectedCapHold = computeExpectedCapHoldAmount({
      player: originalPlayer,
      lastSalary: 10_000_000,
      rules: null,
      rightsType: getRightsTypeFromPlayer(originalPlayer),
    });

    const result = validateOptionDecision({
      originalTeam: {
        teamCode: 'LAL',
        roster: ['player_1'],
        players: [originalPlayer],
        capHolds: [],
      },
      updatedTeam: {
        teamCode: 'LAL',
        roster: [],
        players: [],
        capHolds: [
          {
            playerId: 'player_1',
            playerName: 'Option Boundary',
            amount: expectedCapHold.amount,
            active: true,
            isSigned: false,
            season: '2026-27',
            type: 'FA Cap Hold',
          },
        ],
      },
      originalPlayer,
      updatedPlayer: {
        ...originalPlayer,
        contract: {
          birdRights: {
            status: 'Full Bird',
            yearsWithTeam: 3,
          },
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
          freeAgency: {
            year: 2026,
            type: 'UFA',
          },
        },
      },
      accepted: false,
      targetYear: 2027,
      currentYear: 2026,
    });

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'cap_hold_creation',
        }),
      ])
    );
  });

  it('returns the advanced season summary through advanceSeasonInWorld', async () => {
    mocks.getWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
    mocks.getDraftPositionsMap.mockResolvedValue({});
    mocks.getLeague.mockResolvedValue([makeTeam('BOS')]);
    mocks.resolveOffseasonTransition.mockImplementation(
      ({
        teamCapSheet,
        context,
      }: {
        teamCapSheet: Record<string, unknown>;
        context: { worldId?: string | null; teamCode?: string | null };
      }) => ({
        success: true,
        nextTeamCapSheet: {
          ...teamCapSheet,
          season: '2026-27',
        },
        appliedChangesSummary: {
          exercisedOptions: [],
          declinedOptions: [],
          expiredContracts: [],
          expiredTPEs: [
            {
              id: 'tpe_1',
              createdFrom: 'trade',
              seasonKey: '2025-26',
              totalAmount: 5_000_000,
              usedAmount: 0,
              remainingAmount: 5_000_000,
              expiresOn: '2026-07-01T00:00:00.000Z',
              teamCode: context.teamCode,
            },
          ],
          capHoldsCreated: 0,
          transitionedExceptions: ['room'],
          hardCapCleared: true,
        },
      })
    );

    const result = await advanceSeasonInWorld('world_trio_season', {
      optionDecisions: {
        player_1: { decision: 'decline', season: '2025-26' },
      },
    });

    expect(result.success).toBe(true);
    expect(result.toSeason).toBe('2026-27');
    expect(result.summary.transitionedExceptions).toEqual(['room']);
    expect(result.summary.expiredTPEs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tpe_1', teamCode: 'BOS' }),
      ])
    );
  });
});
