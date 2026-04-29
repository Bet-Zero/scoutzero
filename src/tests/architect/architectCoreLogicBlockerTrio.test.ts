import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(),
  mergePlayerOverride: vi.fn(
    (snapshotPlayer: Record<string, unknown>, overridePlayer: Record<string, unknown>) => ({
      ...snapshotPlayer,
      ...overridePlayer,
    })
  ),
  getWorldMetadata: vi.fn(),
  getDraftPositionsMap: vi.fn(),
  updateWorldStats: vi.fn(async (): Promise<void> => undefined),
  validateTrade: vi.fn(),
  buildTradeApplyPreparation: vi.fn(),
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
  collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
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
  buildTradeApplyPreparation: mocks.buildTradeApplyPreparation,
  buildPostTradeTeamsSnapshot: mocks.buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext: mocks.validatePostTradeSnapshotForContext,
  assertPostTradeSnapshot: mocks.assertPostTradeSnapshot,
  assertValidatedTradeContext: mocks.assertValidatedTradeContext,
  assertTradeComputeInputs: mocks.assertTradeComputeInputs,
}));

vi.mock(
  '@/features/architect/utils/tradeContext/tradeContext',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/tradeContext/tradeContext')
      >();

    return {
      ...actual,
      buildTradeApplyPreparation: mocks.buildTradeApplyPreparation,
    };
  }
);

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
  getTeamTpeList: (): unknown[] => [],
  assertPersistableOrThrow: vi.fn((): void => undefined),
  PERSISTENCE_CONTRACTS: {
    TEAM: {},
    EVENT: {},
  },
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamRef: vi.fn((worldId: string, teamCode: string) => `architect_worlds/${worldId}/teams/${teamCode}`),
  worldPlayerRef: vi.fn((worldId: string, playerId: string) => `architect_worlds/${worldId}/players/${playerId}`),
  worldMetadataRef: vi.fn((worldId: string) => `architect_worlds/${worldId}`),
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: mocks.validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants: mocks.validateMutationEntitlementInvariants,
}));

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';
import { validateOptionDecision } from '@/features/architect/utils/capLegalityValidation';

function makeTeam(teamCode: string) {
  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    season: '2025-26',
    roster: [] as string[],
    players: [] as Array<Record<string, unknown>>,
    capHolds: [] as Array<Record<string, unknown>>,
    deadCap: [] as Array<Record<string, unknown>>,
    draftPicks: [],
    tradeExceptions: [] as Array<Record<string, unknown>>,
    exceptionHistory: [] as Array<Record<string, unknown>>,
    entitlementIds: [] as string[],
    exceptions: { tpe: [] as Array<Record<string, unknown>> },
    totals: { totalSalary: 0, capHit: 0, totalCapAllocations: 0 },
  };
}

describe('Architect core logic blocker trio proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.computeTeamCapTotals.mockImplementation(
      (team: Record<string, unknown>, year: number) => ({
        yearKey: year,
        playersTotal: 0,
        deadMoneyTotal: 0,
        capHoldsTotal: Array.isArray(team.capHolds) ? team.capHolds.length * 1_000_000 : 0,
        incompleteChargesTotal: 0,
        totalCapAllocations: 120_000_000,
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

  it('keeps the executeTrade compute path on the strengthened trade-context contracts', () => {
    mocks.validateTrade.mockReturnValue({
      valid: true,
      legal: true,
      success: true,
    });

    const postTradeSnapshot = {
      teamUpdates: [
        { teamCode: 'LAL', team: makeTeam('LAL') },
        { teamCode: 'BOS', team: makeTeam('BOS') },
      ],
      validationTeams: [
        { teamCode: 'LAL', team: makeTeam('LAL'), sends: [], receives: [], picksOut: [], picksIn: [] },
        { teamCode: 'BOS', team: makeTeam('BOS'), sends: [], receives: [], picksOut: [], picksIn: [] },
      ],
      payloadTeams: [
        { teamCode: 'LAL', sends: [], receives: [], picksOut: [], picksIn: [] },
        { teamCode: 'BOS', sends: [], receives: [], picksOut: [], picksIn: [] },
      ],
    };

    const validatedContext = {
      legal: true,
      valid: true,
      violations: [],
      warnings: [],
      teamResults: [
        { rules: { tradeExceptions: {} } },
        { rules: { tradeExceptions: {} } },
      ],
      summaryByTeamIndex: [],
      validationTeams: [
        { teamCode: 'LAL', team: makeTeam('LAL'), sends: [], receives: [], picksOut: [], picksIn: [] },
        { teamCode: 'BOS', team: makeTeam('BOS'), sends: [], receives: [], picksOut: [], picksIn: [] },
      ],
      tradeReceipt: null,
      _isValidatedTradeContext: true,
    };

    mocks.buildTradeApplyPreparation.mockReturnValue({
      postTradeSnapshot,
      validatedContext,
      validationPayload: {
        teams: [
          { teamCode: 'LAL', sends: [], receives: [], picksOut: [], picksIn: [], entitlementsOut: [] },
          { teamCode: 'BOS', sends: [], receives: [], picksOut: [], picksIn: [], entitlementsOut: [] },
        ],
      },
    });

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          { teamCode: 'LAL', sends: [], receives: [], picksOut: [], picksIn: [], entitlementsOut: [] },
          { teamCode: 'BOS', sends: [], receives: [], picksOut: [], picksIn: [], entitlementsOut: [] },
        ],
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: makeTeam('LAL') },
          { teamCode: 'BOS', team: makeTeam('BOS') },
        ],
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-15T12:00:00.000Z'),
      worldId: 'world_trio_trade',
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.type).toBe('trade');
    expect(result.teamUpdates).toHaveLength(2);
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(mocks.buildTradeApplyPreparation).toHaveBeenCalledTimes(1);
  });

  it('keeps the season-advance handoff/result path on the narrowed Offseason contracts', async () => {
    mocks.getWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
    mocks.getDraftPositionsMap.mockResolvedValue({});
    mocks.getLeague.mockResolvedValue([
      makeTeam('BOS'),
    ]);
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
    expect(result.summary).toBeDefined();
    expect(result.summary?.transitionedExceptions).toEqual(['room']);
    expect(result.summary?.expiredTPEs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tpe_1', teamCode: 'BOS' }),
      ])
    );
    expect(mocks.resolveOffseasonTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        optionDecisions: {
          player_1: { decision: 'decline', season: '2025-26' },
        },
        context: expect.objectContaining({
          worldId: 'world_trio_season',
          teamCode: 'BOS',
        }),
      })
    );
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
  });

  it('keeps mutation-shaped option validation working with numeric roster entries', () => {
    const originalPlayer = {
      player_id: '101',
      id: '101',
      displayName: 'Option Player',
      contract: {
        birdRights: { status: 'Full Bird' },
        salariesByYear: [
          { season: '2024-25', salary: 10_000_000 },
          { season: '2025-26', salary: 11_000_000, option: 'PO' },
        ],
      },
    };

    const updatedPlayer = {
      ...originalPlayer,
      contract: {
        ...originalPlayer.contract,
        salariesByYear: [
          { season: '2024-25', salary: 10_000_000 },
          {
            season: '2025-26',
            salary: 11_000_000,
            option: 'PO',
            optionUsed: true,
          },
        ],
      },
    };

    const result = validateOptionDecision({
      originalTeam: {
        teamCode: 'LAL',
        players: [originalPlayer],
        roster: [101],
        capHolds: [],
      },
      updatedTeam: {
        teamCode: 'LAL',
        players: [updatedPlayer],
        roster: [101],
        capHolds: [],
      },
      originalPlayer,
      updatedPlayer,
      accepted: true,
      targetYear: '2026',
      currentYear: '2025',
    });

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
