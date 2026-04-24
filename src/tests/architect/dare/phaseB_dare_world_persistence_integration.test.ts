/**
 * FILE: src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js
 * PURPOSE: Integration tests for DARE persistence during Season Advance and Trade continuity.
 *          Verifies proper hand-off between Season Manager, DARE, and Firestore.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';

type MockLeagueTeam = {
  teamCode: string;
  entitlementIds: string[];
  roster: unknown[];
  players: unknown[];
  totals: Record<string, unknown>;
};

type MockResolutionReceipt = {
  draftYear: number;
  resolvedAt: string;
  totalResolutions: number;
  byOutcome: {
    conveyed: number;
    rolled: number;
    converted: number;
    swap_resolved: number;
    expired: number;
    unchanged: number;
  };
  entries: unknown[];
  warnings: unknown[];
};

type MockDareInput = {
  teams?: MockLeagueTeam[];
};

function createMockLeagueTeam(
  teamCode: string,
  entitlementIds: string[] = []
): MockLeagueTeam {
  return {
    teamCode,
    entitlementIds,
    roster: [],
    players: [],
    totals: {},
  };
}

function findMockTeamByCode(
  teams: MockLeagueTeam[] | undefined,
  teamCode: string
): MockLeagueTeam | undefined {
  return teams?.find((team) => team.teamCode === teamCode);
}

// =============================================================================
// MOCKS
// =============================================================================

// =============================================================================
// MOCKS
// =============================================================================

const mocks = vi.hoisted(() => ({
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockGetLeague: vi.fn(),
  mockGetWorldMetadata: vi.fn(),
  mockGetDraftPositionsMap: vi.fn(),
  mockResolveAllDraftAssets: vi.fn(),
  mockResolveEntitlementsForTeam: vi.fn(),
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({
    set: mocks.mockBatchSet,
    update: mocks.mockBatchUpdate,
    delete: mocks.mockBatchDelete,
    commit: mocks.mockBatchCommit,
  }),
  doc: (_db: unknown, ...pathParts: Array<string | number>) => pathParts.join('/'),
  serverTimestamp: () => '2026-02-04T00:00:00.000Z',
  increment: (n: number) => n,
}));

vi.mock('@/firebaseConfig', () => ({
  db: { type: 'mock-firestore' },
}));

// Mock Team Loader (Read-side)
vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: mocks.mockGetLeague,
}));

// Mock World Manager
vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: mocks.mockGetWorldMetadata,
  getDraftPositionsMap: mocks.mockGetDraftPositionsMap,
}));

// Mock DARE Barrel (ensure resolveAllDraftAssets is intercepted)
vi.mock('@/features/architect/utils/entitlements/dare', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    resolveAllDraftAssets: mocks.mockResolveAllDraftAssets,
  };
});

// Mock Entitlement Resolver (prevent crash in team processing)
vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: mocks.mockResolveEntitlementsForTeam,
}));

// Mock Season Manager dependencies that are not under test
vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: (_team: unknown, year: number) => ({
    yearKey: year,
    playersTotal: 0,
    deadMoneyTotal: 0,
    capHoldsTotal: 0,
    incompleteChargesTotal: 0,
    totalCapAllocations: 0,
    salaryCap: 141000000,
    luxuryTax: 170000000,
    firstApron: 178000000,
    secondApron: 188000000,
  }),
}));

vi.mock('@/features/architect/utils/seasonFormat', () => ({
  toEndYear: (seasonId: string) => parseInt(seasonId.split('-')[0]) + 1,
  getDraftYearForSeasonAdvance: (seasonId: string) =>
    parseInt(seasonId.split('-')[0]) + 1,
  getSeasonAdvanceDraftContext: (seasonId: string) => {
    const seasonStartYear = parseInt(seasonId.split('-')[0]);
    const nextUsedDraftYear = seasonStartYear + 1;
    return {
      authoritativeSeason: seasonId,
      nextUsedDraftYear,
      nextSeason: `${nextUsedDraftYear}-${String(nextUsedDraftYear + 1).slice(2)}`,
    };
  },
  toSeasonCode: (year: number) => `${year - 1}-${year.toString().slice(2)}`,
  toSeasonKey: (seasonId: string) => parseInt(seasonId.split('-')[0]) + 1,
}));

// Mock other dependencies to isolate SeasonManager
vi.mock('@/features/architect/utils/salaryEngine', () => ({
  getMinimumSalaryScale: () => [1000000],
}));

vi.mock('@/features/architect/utils/tpeLifecycle', () => ({
  processTradeExceptions: () => ({
    activeTPEs: [],
    expiredTPEs: [],
    hasChanges: false,
  }),
  getTpeExpiryISO: () => '2026-07-01T00:00:00.000Z',
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: <T,>(team: T) => team,
  getTeamTpeList: () => [],
  assertPersistableOrThrow: () => {},
  PERSISTENCE_CONTRACTS: { TEAM: { topLevel: [], deepRules: null } },
}));

vi.mock('@/features/architect/utils/persistenceContracts/enforcement', () => ({
  sanitizeTransientFieldsForPersistence: <T,>(team: T) => team,
}));

vi.mock('@/features/architect/utils/exceptions', () => ({
  resetTeamNonTpeExceptionsForNewSeason: () => ({ exceptions: {}, hasChanges: false }),
}));

vi.mock('@/features/architect/utils/capHoldTransitionHelpers', () => ({
  computeExpectedCapHoldAmount: () => 1000000,
  deriveFreeAgencyYearFromOptionSeason: () => 2026,
  getRightsTypeFromPlayer: () => 'Bird',
}));

vi.mock('@/features/architect/utils/exceptionHistory/historyHelpers', () => ({
  appendExceptionHistory: () => {},
  createTpeExpiryHistoryEntry: () => {},
}));

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: (params: { teamCapSheet: unknown }) => ({
    success: true,
    nextTeamCapSheet: params.teamCapSheet,
    appliedChangesSummary: {},
  }),
}));

vi.mock('@/features/architect/utils/entitlements/seasonManagerProjection', () => ({
  projectEntitlementsToSeasonManagerView: () => [],
  logDerivedPicksCreation: () => {},
}));

vi.mock('@/features/architect/utils/entitlements/pickRulesResolver', () => ({
  resolvePickRulesByIds: () => [],
  pickRulesMapToObject: () => ({}),
}));

// Mock post-state cap validator so empty test teams don't block DARE execution
vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  validatePostStateCapLegality: () => ({ valid: true, violations: [], warnings: [] }),
  POST_STATE_CAP_VALIDATOR_VERSION: 1,
}));

// =============================================================================
// TESTS
// =============================================================================

describe('Phase B: DARE World Persistence Integration', () => {
  const WORLD_ID = 'world-integration-test';
  const FROM_SEASON = '2025-26';
  const TO_SEASON = '2026-27';

  function createMockResolutionReceipt(totalResolutions = 0): MockResolutionReceipt {
    return {
      draftYear: 2026,
      resolvedAt: '2026-02-04T00:00:00.000Z',
      totalResolutions,
      byOutcome: {
        conveyed: 0,
        rolled: 0,
        converted: 0,
        swap_resolved: 0,
        expired: 0,
        unchanged: 0,
      },
      entries: [],
      warnings: [],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Default World Metadata
    mocks.mockGetWorldMetadata.mockResolvedValue({
      id: WORLD_ID,
      currentSeason: FROM_SEASON,
    });

    // Default: No positions map (unless specified)
    mocks.mockGetDraftPositionsMap.mockResolvedValue({});

    // Default League: 2 Teams
    mocks.mockGetLeague.mockResolvedValue([
      createMockLeagueTeam('MIN'),
      createMockLeagueTeam('DET'),
    ]);

    // Default DARE Result: Success, no-op
    mocks.mockResolveAllDraftAssets.mockResolvedValue({
      success: true,
      entitlementDocWrites: [],
      teamEntitlementIdUpdates: [],
      resolutionReceipt: createMockResolutionReceipt(),
    });

    // Default Entitlement Resolver
    mocks.mockResolveEntitlementsForTeam.mockResolvedValue([]);
  });

  describe('Task 2: DARE Persistence on Season Advance', () => {
    it('should persist DARE resolutions to Firestore when positions are present', async () => {
      // 1. Setup World State
      mocks.mockGetDraftPositionsMap.mockResolvedValue({ MIN: 1, DET: 2 });
      mocks.mockGetLeague.mockResolvedValue([
        createMockLeagueTeam('MIN', ['e1']),
        createMockLeagueTeam('DET'),
      ]);

      // 2. Setup DARE Output (Simulate a resolution)
      // e1 (MIN) rolls to e2
      const mockDAREOutput = {
        success: true,
        entitlementDocWrites: [
          {
            action: 'upsert',
            entitlementId: 'e2',
            document: { id: 'e2', holderTeam: 'MIN', kind: 'pick_ownership' },
            reason: 'Rolled',
          },
          {
            action: 'upsert',
            entitlementId: 'e1',
            document: { id: 'e1', resolved: true },
            reason: 'Resolved',
          },
        ],
        teamEntitlementIdUpdates: [
          {
            teamCode: 'MIN',
            entitlementIds: ['e2'],
            addedIds: ['e2'],
            removedIds: ['e1'],
          },
        ],
        resolutionReceipt: createMockResolutionReceipt(1),
      };

      mocks.mockResolveAllDraftAssets.mockResolvedValue(mockDAREOutput);

      // 3. Execute Season Advance
      const result = await advanceSeasonInWorld(WORLD_ID);

      // 4. Assertions
      expect(result).toEqual(expect.objectContaining({ success: true }));

      // Verify DARE was called
      expect(mocks.mockResolveAllDraftAssets).toHaveBeenCalled();

      // Verify Persistence (batch.set calls)
      // Should write new entitlement e2
      expect(mocks.mockBatchSet).toHaveBeenCalledWith(
        expect.stringContaining(`e2`),
        expect.objectContaining({ id: 'e2', holderTeam: 'MIN' }),
        expect.anything()
      );

      // Should update old entitlement e1
      expect(mocks.mockBatchSet).toHaveBeenCalledWith(
        expect.stringContaining(`e1`),
        expect.objectContaining({ resolved: true }),
        expect.anything()
      );

      // Should update Team MIN inventory
      expect(mocks.mockBatchSet).toHaveBeenCalledWith(
        expect.stringContaining(`teams/MIN`),
        expect.objectContaining({ entitlementIds: ['e2'] }),
        expect.anything()
      );
    });

    it('should NOT persist DARE results if resolution fails', async () => {
      mocks.mockGetDraftPositionsMap.mockResolvedValue({ MIN: 1 });
      mocks.mockResolveAllDraftAssets.mockResolvedValue({
        success: false,
        error: 'Simulated DARE failure',
      });

      const result = await advanceSeasonInWorld(WORLD_ID);

      expect(result.success).toBe(true); // Season advance proceeds
      expect(result.summary?.dareError).toBe('Simulated DARE failure');

      // Verify NO entitlement writes
      const entitlementWrites = mocks.mockBatchSet.mock.calls.filter((args) =>
        String(args[0]).includes('architect_entitlements')
      );
      expect(entitlementWrites.length).toBe(0);
    });

    it('fails season advance loudly when gated DARE persistence is blocked', async () => {
      mocks.mockGetDraftPositionsMap.mockResolvedValue({ MIN: 1 });
      mocks.mockGetLeague.mockResolvedValue([
        createMockLeagueTeam('MIN'),
        createMockLeagueTeam('DET'),
      ]);
      mocks.mockResolveEntitlementsForTeam.mockResolvedValue([]);

      // Added entitlement ID has no corresponding upsert doc -> gated mutator must fail closed.
      mocks.mockResolveAllDraftAssets.mockResolvedValue({
        success: true,
        entitlementDocWrites: [],
        teamEntitlementIdUpdates: [
          {
            teamCode: 'MIN',
            entitlementIds: ['ent-missing-doc'],
            addedIds: ['ent-missing-doc'],
            removedIds: [],
          },
        ],
        resolutionReceipt: createMockResolutionReceipt(1),
      });

      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/DARE gated persistence blocked season advance/i);
    });

    it('fails season advance loudly when resolver surfaces entitlement invariant violation', async () => {
      mocks.mockGetDraftPositionsMap.mockResolvedValue({ MIN: 1 });
      mocks.mockGetLeague.mockResolvedValue([
        createMockLeagueTeam('MIN'),
        createMockLeagueTeam('DET'),
      ]);
      mocks.mockResolveAllDraftAssets.mockResolvedValue({
        success: true,
        entitlementDocWrites: [],
        teamEntitlementIdUpdates: [],
        resolutionReceipt: createMockResolutionReceipt(),
      });
      mocks.mockResolveEntitlementsForTeam.mockRejectedValue({
        code: 'ENTITLEMENT_INVARIANT_VIOLATION',
        message: 'ENTITLEMENT_INVARIANT_VIOLATION (DUPLICATE_IDENTITY_KEY)',
      });

      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/DARE gated persistence blocked season advance/i);
    });
  });

  describe('Task 3: Trade -> Season Advance Continuity', () => {
    it('should resolve entitlement for NEW holder (Team B) after trade', async () => {
      // 1. Simulate "Post-Trade" State
      // Entitlement 'e_traded' is now in DET's inventory (was MIN)
      const postTradeLeague = [
        createMockLeagueTeam('MIN'),
        createMockLeagueTeam('DET', ['e_traded']),
      ];
      mocks.mockGetLeague.mockResolvedValue(postTradeLeague);
      mocks.mockGetDraftPositionsMap.mockResolvedValue({ MIN: 1, DET: 2 });

      // 2. Setup DARE Response expectations
      // We don't implement full DARE logic here, but we verify DARE receives correct input
      mocks.mockResolveAllDraftAssets.mockImplementation(
        async (_db: unknown, input: MockDareInput) => {
          // ASSERTION INSIDE MOCK: Verify input teams structure
          const detTeam = findMockTeamByCode(input.teams, 'DET');
          if (detTeam?.entitlementIds.includes('e_traded')) {
            return {
              success: true,
              entitlementDocWrites: [], // Result does not matter for this test
              teamEntitlementIdUpdates: [],
              resolutionReceipt: createMockResolutionReceipt(),
            };
          }
          return { success: false, error: 'DARE Input Mismatch' };
        }
      );

      // 3. Execute Season Advance
      await advanceSeasonInWorld(WORLD_ID);

      // 4. Verify DARE was called with correct holder
      const dareCallArgs = mocks.mockResolveAllDraftAssets.mock.calls[0];
      if (!dareCallArgs) {
        throw new Error('DARE not called');
      }
      const dareInput = dareCallArgs[1] as MockDareInput | undefined;

      const detInput = findMockTeamByCode(dareInput?.teams, 'DET');
      expect(detInput).toBeDefined();
      expect(detInput?.entitlementIds).toContain('e_traded');

      const minInput = findMockTeamByCode(dareInput?.teams, 'MIN');
      expect(minInput?.entitlementIds).not.toContain('e_traded');
    });
  });
});
