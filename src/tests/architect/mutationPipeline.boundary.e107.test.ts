import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  writeBatchMock: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  getTeamMock: vi.fn(),
  getPlayerMock: vi.fn(),
  updateWorldStatsMock: vi.fn(async () => undefined),
  buildPostTradeTeamsSnapshotMock: vi.fn(),
  validatePostTradeSnapshotForContextMock: vi.fn(),
  assertPostTradeSnapshotMock: vi.fn(),
  assertValidatedTradeContextMock: vi.fn(),
  assertTradeComputeInputsMock: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: harness.writeBatchMock,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: harness.getTeamMock,
  getPlayer: harness.getPlayerMock,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: harness.updateWorldStatsMock,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, legal: true, success: true })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOptionDecision: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
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

vi.mock('@/features/architect/utils/tradeContext', () => ({
  buildPostTradeTeamsSnapshot: harness.buildPostTradeTeamsSnapshotMock,
  validatePostTradeSnapshotForContext:
    harness.validatePostTradeSnapshotForContextMock,
  assertPostTradeSnapshot: harness.assertPostTradeSnapshotMock,
  assertValidatedTradeContext: harness.assertValidatedTradeContextMock,
  assertTradeComputeInputs: harness.assertTradeComputeInputsMock,
}));

import * as mutationPipelineModule from '@/features/architect/utils/mutationPipeline';
import {
  applyWorldMutation,
  buildWorldMutationEventPayload,
  computeWorldMutation,
  resolveWorldAsOfDate,
} from '@/features/architect/utils/mutationPipeline';

function makeTeam(teamCode: string) {
  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    entitlementIds: [],
    exceptions: { tpe: [] },
    totals: { totalSalary: 0, capHit: 0 },
  };
}

describe('E107 mutationPipeline boundary proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    harness.buildPostTradeTeamsSnapshotMock.mockImplementation(() => ({
      teamUpdates: [
        { teamCode: 'LAL', team: makeTeam('LAL') },
        { teamCode: 'BOS', team: makeTeam('BOS') },
      ],
      validationTeams: [{ receives: [] }, { receives: [] }],
    }));

    harness.validatePostTradeSnapshotForContextMock.mockImplementation(() => ({
      legal: true,
      success: true,
      warnings: [],
      violations: [],
      _isValidatedTradeContext: true,
      teamResults: [
        { rules: { tradeExceptions: {} } },
        { rules: { tradeExceptions: {} } },
      ],
      validationTeams: [{ receives: [] }, { receives: [] }],
    }));

    harness.getTeamMock.mockImplementation(async (_worldId: string, teamCode: string) =>
      makeTeam(teamCode)
    );
    harness.getPlayerMock.mockResolvedValue({
      player_id: 'player_1',
      id: 'player_1',
      displayName: 'Player One',
      teamCode: 'LAL',
      contract: { birdRights: { status: 'Full' } },
    });
  });

  it('loads the authoritative module with the retained named export surface', () => {
    expect(Object.keys(mutationPipelineModule).sort()).toEqual([
      'FORBIDDEN_TRANSIENT_KEYS',
      'applyWorldMutation',
      'buildPostTradeTeamsSnapshot',
      'buildWorldMutationEventPayload',
      'computeWorldMutation',
      'resolveWorldAsOfDate',
      'sanitizeTransientFieldsForPersistence',
      'validatePostTradeSnapshotForContext',
    ]);
  });

  it('keeps resolveWorldAsOfDate callable', () => {
    const result = resolveWorldAsOfDate({
      payloadAsOfDate: '2026-03-15',
      worldAsOfDate: '2026-03-01',
    });

    expect(result).toEqual({
      asOfDate: '2026-03-15',
      defaulted: false,
    });
  });

  it('keeps buildWorldMutationEventPayload callable with the TS authority', () => {
    const event = buildWorldMutationEventPayload({
      mutationType: 'executeTrade',
      eventId: 'evt_trade',
      seasonId: '2025-26',
      worldId: 'world_1',
      timestamp: Date.parse('2026-03-15T12:00:00.000Z'),
      computeResult: {
        metadata: { summary: 'Trade Executed vs BOS' },
        teamUpdates: [{ teamCode: 'LAL' }, { teamCode: 'BOS' }],
        playerUpdates: [{ playerId: 'player_1' }],
      },
      auditContext: {
        operationId: 'op_trade',
        teamCodes: ['LAL', 'BOS'],
        beforeTotalsByTeam: { LAL: { totalCapAllocations: 150 } },
        afterTotalsByTeam: { LAL: { totalCapAllocations: 149 } },
      },
    });

    expect(event.eventId).toBe('evt_trade');
    expect(event.mutationType).toBe('executeTrade');
    expect(event.teamCodes).toEqual(['LAL', 'BOS']);
    expect(event.playerIds).toEqual(['player_1']);
  });

  it('keeps the executeTrade compute pathway callable under mocked trade-context conditions', () => {
    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          { teamCode: 'LAL', sends: [], entitlementsOut: [] },
          { teamCode: 'BOS', sends: [], entitlementsOut: [] },
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
      worldId: 'world_1',
    });

    expect(result.success).toBe(true);
    expect(result.metadata.type).toBe('trade');
    expect(result.teamUpdates).toHaveLength(2);
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(harness.buildPostTradeTeamsSnapshotMock).toHaveBeenCalledTimes(1);
    expect(
      harness.validatePostTradeSnapshotForContextMock
    ).toHaveBeenCalledTimes(1);
  });

  it('keeps a non-trade compute pathway callable', () => {
    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          mle: {
            enabled: true,
            totalAmount: 12_900_000,
            usedAmount: 0,
            seasonKey: '2025-26',
          },
        },
      },
      currentState: {
        team: makeTeam('LAL'),
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-15T12:00:00.000Z'),
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates[0].team.exceptions.mle.totalAmount).toBe(
      12_900_000
    );
  });

  it('keeps applyWorldMutation fail-closed before writes when worldId is missing', async () => {
    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: '',
      seasonId: '2025-26',
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {},
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('worldId is required');
    expect(harness.writeBatchMock).not.toHaveBeenCalled();
  });

  it('keeps the .js shim pointed at the same effective boundary', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/mutationPipeline.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Object.keys(mutationPipelineModule).sort()
    );
    expect(explicitJsModule.computeWorldMutation).toBe(computeWorldMutation);
    expect(explicitJsModule.applyWorldMutation).toBe(applyWorldMutation);
  });
});
