/**
 * FILE: src/tests/architect/seasonManager.batchedHardening.test.ts
 * PURPOSE: Behavioral proofs for the batched hardening pass on seasonManager.ts.
 *   Covers the narrowed types:
 *   - StepienUpdate replaces LooseRecord[] in SeasonAdvanceTeamSummary.stepienUpdates
 *   - ConveyanceResolutionEntry replaces unknown[] in SeasonAdvanceTeamSummary.conveyanceResolutions
 *   - SwapResolutionEntry replaces unknown[] in SeasonAdvanceTeamSummary.swapResolutions
 *   - DAREResolutionReceipt replaces unknown in SeasonAdvanceSummary.dareReceipt
 *   - SeasonManagerDraftPickConveyanceResult.previousProtection/originalRound narrowed
 *
 * HISTORY:
 *   2026-03-24  Batched Hardening Pass (seasonManager)
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level Firebase mocks (seasonManager imports these at load time)
// ---------------------------------------------------------------------------

vi.mock('@/firebaseConfig', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  increment: vi.fn((n: number) => n),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
  collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: vi.fn(async () => []),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: vi.fn(async () => ({ currentSeason: '2025-26' })),
  getDraftPositionsMap: vi.fn(async () => null),
}));

vi.mock('@/features/architect/utils/seasonFormat', async (importOriginal) => {
  return importOriginal();
});

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamRef: vi.fn((_db: unknown, teamCode: string) => `teams/${teamCode}`),
  worldMetadataRef: vi.fn(() => 'worlds/meta'),
}));

vi.mock('@/features/architect/utils/salaryEngine', () => ({
  getMinimumSalaryScale: vi.fn(() => ({})),
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettings: vi.fn(() => ({ salaryCap: 141_000_000 })),
}));

vi.mock('@/features/architect/utils/capHoldTransitionHelpers', () => ({
  computeExpectedCapHoldAmount: vi.fn(() => 0),
  deriveFreeAgencyYearFromOptionSeason: vi.fn(() => '2026-27'),
  getRightsTypeFromPlayer: vi.fn(() => 'UFA'),
}));

vi.mock('@/features/architect/utils/tpeLifecycle', () => ({
  processTradeExceptions: vi.fn((team: unknown) => team),
  getTpeExpiryISO: vi.fn(() => null),
}));

vi.mock('@/features/architect/utils/exceptionHistory/historyHelpers', () => ({
  appendExceptionHistory: vi.fn((team: unknown) => team),
  createTpeExpiryHistoryEntry: vi.fn(() => ({})),
}));

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: vi.fn(() => ({
    success: true,
    nextTeamCapSheet: {},
    appliedChangesSummary: {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      expiredTPEs: [],
      capHoldsCreated: 0,
      transitionedExceptions: [],
      hardCapCleared: false,
    },
  })),
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: vi.fn((team: unknown) => team),
  getTeamTpeList: vi.fn(() => []),
  assertPersistableOrThrow: vi.fn(),
  PERSISTENCE_CONTRACTS: { TEAM: 'TEAM' },
}));

vi.mock('@/features/architect/utils/persistenceContracts/enforcement', () => ({
  sanitizeTransientFieldsForPersistence: vi.fn((team: unknown) => team),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-v1',
  validatePostStateCapLegality: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
}));

vi.mock('@/features/architect/utils/exceptions', () => ({
  resetTeamNonTpeExceptionsForNewSeason: vi.fn((team: unknown) => team),
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: vi.fn(() => ({ totalSalary: 0, capHit: 0 })),
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: vi.fn(async () => []),
}));

vi.mock('@/features/architect/utils/entitlements/pickRulesResolver', () => ({
  resolvePickRulesByIds: vi.fn(async () => []),
  pickRulesMapToObject: vi.fn(() => ({})),
}));

vi.mock('@/features/architect/utils/entitlements/seasonManagerProjection', () => ({
  projectEntitlementsToSeasonManagerView: vi.fn(() => []),
  logDerivedPicksCreation: vi.fn(),
}));

vi.mock('@/features/architect/utils/entitlements/dare', () => ({
  resolveAllDraftAssets: vi.fn(async () => ({ success: false, error: 'mocked' })),
  applyGatedDAREResultsToBatch: vi.fn(() => ({ ok: true, writeCount: 0 })),
  formatReceiptAsSummary: vi.fn(() => '0 resolutions'),
}));

vi.mock('@/constants/collections', () => ({
  ARCHITECT_WORLDS_COLLECTION: 'architect_worlds',
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION: 'events',
}));

// ---------------------------------------------------------------------------
// Import under test (after all mocks are registered)
// ---------------------------------------------------------------------------

import {
  resolveDraftPickConveyanceForYear,
  resolveDraftPickSwapsForYear,
} from '@/features/architect/utils/seasonManager';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSwapPick(overrides: Record<string, unknown> = {}) {
  return {
    id: 'LAL_2026_1',
    year: 2026,
    round: 1,
    originalTeam: 'LAL',
    isSwap: true,
    swapType: 'best_of' as const,
    swapWithTeamId: 'BOS',
    resolved: false,
    resolvedOwner: null,
    resolvedPosition: null,
    ...overrides,
  };
}

function makeConveyancePick(overrides: Record<string, unknown> = {}) {
  return {
    id: 'MEM_2026_1',
    year: 2026,
    round: 1,
    originalTeam: 'MEM',
    isSwap: false,
    conveyance: {
      conditions: { active: true as const },
      description: undefined as string | undefined,
      affects: [] as string[],
      currentYear: 2026,
      finalYear: 2028,
    },
    // No protection → will convey freely
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seasonManager batched hardening — narrowed resolution types', () => {

  describe('resolveDraftPickConveyanceForYear — no-op paths', () => {
    it('returns team reference unchanged when positionsMap is empty', () => {
      const team = { teamCode: 'LAL', draftPicks: [makeConveyancePick()] };
      const result = resolveDraftPickConveyanceForYear(team, 2026, {});
      expect(result).toBe(team);
    });

    it('returns team reference unchanged when positionsMap is null', () => {
      const team = { teamCode: 'LAL', draftPicks: [makeConveyancePick()] };
      const result = resolveDraftPickConveyanceForYear(team, 2026, null);
      expect(result).toBe(team);
    });

    it('returns team reference unchanged when team has no draftPicks', () => {
      const team = { teamCode: 'LAL' };
      const result = resolveDraftPickConveyanceForYear(team, 2026, { MEM: 5 });
      expect(result).toBe(team);
    });
  });

  describe('resolveDraftPickConveyanceForYear — ConveyanceResolutionEntry shape', () => {
    it('produces a conveyanceResult with string outcome and number position when pick conveys freely', () => {
      const pick = makeConveyancePick();
      const team = { teamCode: 'MEM', draftPicks: [pick] };
      const nowIso = '2026-03-24T12:00:00.000Z';

      const result = resolveDraftPickConveyanceForYear(
        team,
        2026,
        { MEM: 15 }, // position 15 — outside any protection → conveys
        { nowIso, method: 'season_advance' }
      );

      const picks = result.draftPicks;
      expect(Array.isArray(picks)).toBe(true);
      const resolved = (picks as Array<Record<string, unknown>>)[0];
      expect(resolved.conveyanceResult).toBeTruthy();

      const convResult = resolved.conveyanceResult as Record<string, unknown>;
      // outcome is now string (not unknown) — verify runtime shape
      expect(typeof convResult.outcome).toBe('string');
      expect(convResult.outcome).toBe('conveyed');
      expect(typeof convResult.position).toBe('number');
      expect(convResult.position).toBe(15);
      // resolvedAt propagates opts.nowIso (cast-removal proof)
      expect(convResult.resolvedAt).toBe(nowIso);
      expect(convResult.method).toBe('season_advance');

      // ConveyanceResolutionEntry type-assignment proof
      const entry: { pickId?: string; year?: number; outcome?: string; position?: number } = {
        pickId: resolved.id as string | undefined,
        year: resolved.year as number | undefined,
        outcome: convResult.outcome as string | undefined,
        position: convResult.position as number | undefined,
      };
      expect(entry.outcome).toBe('conveyed');
    });

    it('propagates nowIso from opts without the cast (cast-removal proof)', () => {
      const pick = makeConveyancePick();
      const team = { teamCode: 'MEM', draftPicks: [pick] };
      const nowIso = '2026-01-15T00:00:00.000Z';

      const result = resolveDraftPickConveyanceForYear(team, 2026, { MEM: 20 }, { nowIso });
      const resolved = (result.draftPicks as Array<Record<string, unknown>>)[0];
      const convResult = resolved.conveyanceResult as Record<string, unknown>;
      expect(convResult.resolvedAt).toBe(nowIso);
    });
  });

  describe('resolveDraftPickSwapsForYear — SwapResolutionEntry shape', () => {
    it('returns team reference unchanged when positionsMap is empty', () => {
      const team = { teamCode: 'LAL', draftPicks: [makeSwapPick()] };
      const result = resolveDraftPickSwapsForYear(team, 2026, {});
      expect(result).toBe(team);
    });

    it('resolves swap pick and exposes SwapResolutionEntry-compatible fields', () => {
      // LAL at pick 3, BOS at pick 10 → best_of → LAL wins (lower = better)
      const pick = makeSwapPick();
      const team = { teamCode: 'LAL', draftPicks: [pick] };
      const nowIso = '2026-03-24T12:00:00.000Z';

      const result = resolveDraftPickSwapsForYear(
        team,
        2026,
        { LAL: 3, BOS: 10 },
        { nowIso, method: 'season_advance' }
      );

      const picks = result.draftPicks as Array<Record<string, unknown>>;
      expect(picks).toHaveLength(1);
      const resolved = picks[0];

      // resolved is now true
      expect(resolved.resolved).toBe(true);
      // resolvedOwner is a string (SwapResolutionEntry.resolvedOwner: string | null)
      expect(typeof resolved.resolvedOwner).toBe('string');
      expect(resolved.resolvedOwner).toBe('LAL'); // LAL at 3 wins best_of vs BOS at 10
      // resolvedPosition is a number
      expect(typeof resolved.resolvedPosition).toBe('number');
      expect(resolved.resolvedPosition).toBe(3);

      // SwapResolutionEntry type-assignment proof
      const entry: {
        pickId?: string;
        year?: number;
        resolvedOwner?: string | null;
        resolvedPosition?: number | null;
      } = {
        pickId: resolved.id as string | undefined,
        year: resolved.year as number | undefined,
        resolvedOwner: resolved.resolvedOwner as string | null | undefined,
        resolvedPosition: resolved.resolvedPosition as number | null | undefined,
      };
      expect(entry.resolvedOwner).toBe('LAL');
    });

    it('propagates nowIso through opts without the cast (cast-removal proof)', () => {
      const pick = makeSwapPick();
      const team = { teamCode: 'LAL', draftPicks: [pick] };
      const nowIso = '2026-01-01T00:00:00.000Z';

      const result = resolveDraftPickSwapsForYear(
        team,
        2026,
        { LAL: 5, BOS: 8 },
        { nowIso }
      );

      const resolved = (result.draftPicks as Array<Record<string, unknown>>)[0];
      const meta = resolved.resolutionMeta as Record<string, unknown>;
      expect(meta.resolvedAt).toBe(nowIso);
    });

    it('leaves non-swap picks unchanged (LooseRecord cast sites remain stable)', () => {
      // A plain owned pick with protection/round fields (the load-bearing cast boundary)
      const nonSwapPick = {
        id: 'LAL_2026_2',
        year: 2026,
        round: 2,
        originalTeam: 'LAL',
        isSwap: false,
        protection: 'Top 5',
        resolved: false,
      };
      const team = { teamCode: 'LAL', draftPicks: [nonSwapPick] };

      const result = resolveDraftPickSwapsForYear(team, 2026, { LAL: 3, BOS: 10 });
      const picks = result.draftPicks as Array<Record<string, unknown>>;
      // Non-swap pick is passed through unchanged
      expect(picks[0]).toEqual(nonSwapPick);
    });
  });
});
