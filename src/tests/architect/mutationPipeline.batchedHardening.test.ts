/**
 * FILE: src/tests/architect/mutationPipeline.batchedHardening.test.ts
 * PURPOSE: Behavioral proofs for the batched hardening pass on mutationPipeline.ts.
 *   Covers the four narrowed types:
 *   - ArchitectMutationPayload.exceptionChanges: string[] | null
 *   - ArchitectMutationPayload.deadCapChanges: string[] | null
 *   - ArchitectMutationResult.warnings: (string | Record<string, unknown>)[]
 *   - ArchitectMutationTeamRecord.draftPicks: DraftPick[]
 *
 * HISTORY:
 *   2026-03-24  Batched Hardening Pass (post Chunks 1-3)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  writeBatchMock: vi.fn((): any => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  getTeamMock: vi.fn(),
  getPlayerMock: vi.fn(),
  updateWorldStatsMock: vi.fn(async (): Promise<any> => undefined),
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
  mergePlayerOverride: vi.fn((player: unknown) => player),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: harness.updateWorldStatsMock,
  getWorldMetadata: vi.fn(async () => ({})),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, legal: true, success: true })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  validateExceptions: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
}));

vi.mock('@/features/architect/utils/tradeContext', () => ({
  buildPostTradeTeamsSnapshot: harness.buildPostTradeTeamsSnapshotMock,
  validatePostTradeSnapshotForContext: harness.validatePostTradeSnapshotForContextMock,
  assertPostTradeSnapshot: harness.assertPostTradeSnapshotMock,
  assertValidatedTradeContext: harness.assertValidatedTradeContextMock,
  assertTradeComputeInputs: harness.assertTradeComputeInputsMock,
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  assertPersistableOrThrow: vi.fn(),
  normalizeTeamTpeSchema: vi.fn((team: unknown) => team),
  PERSISTENCE_CONTRACTS: {},
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: vi.fn(async () => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateMutationEntitlementInvariants: vi.fn(async () => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
}));

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';
import type { DraftPick } from '@/schemas/architect';

function makeTeam(teamCode: string): ArchitectMutationTeamRecord {
  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    exceptions: { tpe: [] },
    tradeExceptions: [],
    entitlementIds: [],
    totals: { totalSalary: 0, capHit: 0, totalCapAllocations: 0 },
  };
}

const TEST_TIMESTAMP = Date.parse('2026-03-24T12:00:00.000Z');

describe('mutationPipeline batched hardening — narrowed payload types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exceptionChanges: string[] | null', () => {
    it('flows a provided string[] through the setExceptions compute path', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'LAL',
          exceptions: { mle: { enabled: true, totalAmount: 12_900_000 }, tpe: [] },
          exceptionChanges: ['MLE updated', 'BAE updated'],
        },
        currentState: { team: makeTeam('LAL') },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      expect((result.metadata as any).exceptionChanges).toEqual([
        'MLE updated',
        'BAE updated',
      ]);
    });

    it('falls back to the default label when exceptionChanges is omitted', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: { teamCode: 'LAL', exceptions: { tpe: [] } },
        currentState: { team: makeTeam('LAL') },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      expect((result.metadata as any).exceptionChanges).toEqual([
        'Exceptions updated',
      ]);
    });
  });

  describe('deadCapChanges: string[] | null', () => {
    it('flows a provided string[] through the setDeadCap compute path', () => {
      const result = computeWorldMutation({
        mutationType: 'setDeadCap',
        payload: {
          teamCode: 'LAL',
          deadCap: [],
          deadCapChanges: ['Player waived'],
        },
        currentState: { team: makeTeam('LAL') },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      expect((result.metadata as any).deadCapChanges).toEqual(['Player waived']);
    });

    it('falls back to the default label when deadCapChanges is omitted', () => {
      const result = computeWorldMutation({
        mutationType: 'setDeadCap',
        payload: { teamCode: 'LAL', deadCap: [] },
        currentState: { team: makeTeam('LAL') },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      expect((result.metadata as any).deadCapChanges).toEqual(['Dead cap updated']);
    });
  });

  describe('warnings: (string | Record<string, unknown>)[]', () => {
    it('result.warnings from a compute path is an array whose items are strings or objects', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: { teamCode: 'LAL', exceptions: { tpe: [] } },
        currentState: { team: makeTeam('LAL') },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      // warnings must be an array (even if empty — the type contract must be satisfiable)
      const warnings = result.warnings ?? [];
      expect(Array.isArray(warnings)).toBe(true);
      for (const item of warnings) {
        const isString = typeof item === 'string';
        const isObject = typeof item === 'object' && item !== null;
        expect(isString || isObject).toBe(true);
      }
    });
  });

  describe('draftPicks: DraftPick[] — type-level proof via team record construction', () => {
    it('accepts a well-formed DraftPick[] on a team record passed as current state', () => {
      const pick: DraftPick = {
        year: 2026,
        round: 1,
        pick: null,
        owner: 'LAL',
      };

      const teamWithPicks: ArchitectMutationTeamRecord = {
        ...makeTeam('LAL'),
        draftPicks: [pick],
      };

      // Verify the narrowed draftPicks field carries through to currentState
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: { teamCode: 'LAL', exceptions: { tpe: [] } },
        currentState: { team: teamWithPicks },
        seasonId: '2025-26',
        timestamp: TEST_TIMESTAMP,
      });

      expect(result.success).toBe(true);
      // The team update preserves the draftPicks carried in from current state
      const updatedTeam = (result.teamUpdates ?? [])[0]?.team;
      expect(updatedTeam?.draftPicks).toEqual([pick]);
    });
  });
});
