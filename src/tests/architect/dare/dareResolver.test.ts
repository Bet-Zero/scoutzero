/**
 * @file dareResolver.test.js
 * @description Tests for Draft Asset Resolution Engine core orchestrator
 *
 * HISTORY:
 *  - 2026-02-04: Phase A - Fixed imports to match actual API exports
 *                Removed classifyEntitlements/buildDAREInput tests (not exported)
 *                Tests now use: resolveAllDraftAssets, resolveTeamDraftAssets, validateDAREInput
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DAREInput } from '@/features/architect/utils/entitlements/dare/types';

// Mock all adapter modules with correct function names
vi.mock(
  '@/features/architect/utils/entitlements/dare/swapResolutionAdapter',
  () => ({
    resolveSwapForEntitlement: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter',
  () => ({
    resolveConveyanceForEntitlement: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/entitlementMutator',
  () => ({
    buildEntitlementWritesFromResolution: vi.fn(),
    buildTeamUpdatesFromResolutions: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/resolutionReceipt',
  () => ({
    buildResolutionReceipt: vi.fn(),
    resolutionToReceiptEntry: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/protectionLadderFactory',
  () => ({
    buildProtectionLadder: vi.fn(),
  })
);

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeamWithDb: vi.fn(),
}));

vi.mock('@/features/architect/utils/entitlements/pickRulesResolver', () => ({
  resolvePickRulesByIdsWithDb: vi.fn(),
  pickRulesMapToObject: vi.fn(),
}));

import {
  resolveAllDraftAssets,
  resolveTeamDraftAssets,
  validateDAREInput,
} from '@/features/architect/utils/entitlements/dare/dareResolver';
import { resolveSwapForEntitlement } from '@/features/architect/utils/entitlements/dare/swapResolutionAdapter';
import { resolveConveyanceForEntitlement } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';
import {
  buildEntitlementWritesFromResolution,
  buildTeamUpdatesFromResolutions,
} from '@/features/architect/utils/entitlements/dare/entitlementMutator';
import {
  buildResolutionReceipt,
  resolutionToReceiptEntry,
} from '@/features/architect/utils/entitlements/dare/resolutionReceipt';
import { buildProtectionLadder } from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';
import { resolveEntitlementsForTeamWithDb } from '@/features/architect/utils/entitlements/entitlementResolver';
import {
  resolvePickRulesByIdsWithDb,
  pickRulesMapToObject,
} from '@/features/architect/utils/entitlements/pickRulesResolver';

const mockedResolveSwapForEntitlement = vi.mocked(resolveSwapForEntitlement);
const mockedResolveConveyanceForEntitlement = vi.mocked(
  resolveConveyanceForEntitlement
);
const mockedBuildEntitlementWritesFromResolution = vi.mocked(
  buildEntitlementWritesFromResolution
);
const mockedBuildTeamUpdatesFromResolutions = vi.mocked(
  buildTeamUpdatesFromResolutions
);
const mockedBuildResolutionReceipt = vi.mocked(buildResolutionReceipt);
const mockedResolutionToReceiptEntry = vi.mocked(resolutionToReceiptEntry);
const mockedBuildProtectionLadder = vi.mocked(buildProtectionLadder);
const mockedResolveEntitlementsForTeamWithDb = vi.mocked(
  resolveEntitlementsForTeamWithDb
);
const mockedResolvePickRulesByIdsWithDb = vi.mocked(
  resolvePickRulesByIdsWithDb
);
const mockedPickRulesMapToObject = vi.mocked(pickRulesMapToObject);

describe('DARE Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations - matching actual function names
    mockedResolveSwapForEntitlement.mockReturnValue({
      entitlementId: 'test-ent',
      outcome: 'swap_resolved',
      swapWinner: 'BOS',
      swapPosition: 10,
      swapLoser: 'LAL',
      position: 10,
      year: 2026,
      originalOwner: 'BOS',
      reason: 'Swap resolved',
      resolvedAt: new Date().toISOString(),
      method: 'lottery',
    });
    mockedResolveConveyanceForEntitlement.mockReturnValue({
      entitlementId: 'test-ent',
      outcome: 'conveyed',
      year: 2026,
      position: 15,
      originalOwner: 'LAL',
      reason: 'Pick conveyed',
      resolvedAt: new Date().toISOString(),
      method: 'lottery',
    });
    mockedBuildEntitlementWritesFromResolution.mockReturnValue([]);
    mockedBuildTeamUpdatesFromResolutions.mockReturnValue([]);
    mockedBuildResolutionReceipt.mockReturnValue({
      draftYear: 2026,
      resolvedAt: new Date().toISOString(),
      totalResolutions: 0,
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
    });
    mockedResolutionToReceiptEntry.mockReturnValue({
      entitlementId: 'test-ent',
      teamCode: 'BOS',
      description: 'Test receipt entry',
      outcome: 'conveyed',
      details: 'Pick conveyed',
    });
    mockedBuildProtectionLadder.mockReturnValue(null);
    mockedResolveEntitlementsForTeamWithDb.mockResolvedValue([]);
    mockedResolvePickRulesByIdsWithDb.mockResolvedValue(new Map());
    mockedPickRulesMapToObject.mockReturnValue({});
  });

  // ============================================================================
  // validateDAREInput Tests (exported public API)
  // ============================================================================
  describe('validateDAREInput', () => {
    it('should return issues for missing worldId', () => {
      const issues = validateDAREInput(
        {
          draftYear: 2026,
          positionsMap: { BOS: 5 },
          teams: [{ teamCode: 'BOS', entitlementIds: [] }],
        } as unknown as DAREInput
      );
      expect(issues).toContain('worldId is required');
    });

    it('should return issues for invalid draftYear', () => {
      const issues = validateDAREInput({
        worldId: 'world-1',
        draftYear: 1999,
        positionsMap: { BOS: 5 },
        teams: [{ teamCode: 'BOS', entitlementIds: [] }],
      });
      expect(issues.some((i) => i.includes('draftYear'))).toBe(true);
    });

    it('should return issues for empty positionsMap', () => {
      const issues = validateDAREInput({
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: {},
        teams: [{ teamCode: 'BOS', entitlementIds: [] }],
      });
      expect(issues.some((i) => i.includes('positionsMap'))).toBe(true);
    });

    it('should return issues for empty teams array', () => {
      const issues = validateDAREInput({
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5 },
        teams: [],
      });
      expect(issues.some((i) => i.includes('teams'))).toBe(true);
    });

    it('should return issues for invalid positions (outside 1-60)', () => {
      const issues = validateDAREInput({
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 0, LAL: 65 },
        teams: [{ teamCode: 'BOS', entitlementIds: [] }],
      });
      expect(issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for valid input', () => {
      const issues = validateDAREInput({
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5, LAL: 10 },
        teams: [
          { teamCode: 'BOS', entitlementIds: ['ent-1'] },
          { teamCode: 'LAL', entitlementIds: ['ent-2'] },
        ],
      });
      expect(issues).toEqual([]);
    });
  });

  // ============================================================================
  // resolveAllDraftAssets Tests (exported public API)
  // ============================================================================
  describe('resolveAllDraftAssets', () => {
    it('should return no-op result when positionsMap is empty', async () => {
      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: {},
        teams: [{ teamCode: 'BOS', entitlementIds: ['ent-1'] }],
      });

      expect(result.success).toBe(true);
      expect(result.meta.entitlementsProcessed).toBe(0);
    });

    it('should return no-op result when teams array is empty', async () => {
      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5 },
        teams: [],
      });

      expect(result.success).toBe(true);
      expect(result.meta.teamsProcessed).toBe(0);
    });

    it('should resolve entitlements using pre-resolved entitlements array', async () => {
      const preResolvedEntitlements = [
        {
          id: 'ent-1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          holderTeam: 'LAL',
          underlyingPickId: 'BOS_2026_1st',
        },
      ];

      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 10 },
        teams: [
          {
            teamCode: 'LAL',
            entitlementIds: ['ent-1'],
            entitlements: preResolvedEntitlements,
          },
        ],
      });

      expect(result.success).toBe(true);
      // Should have processed via resolveConveyanceForEntitlement
      expect(mockedResolveConveyanceForEntitlement).toHaveBeenCalled();
    });

    it('should call resolveSwapForEntitlement for swap_right entitlements', async () => {
      const swapEntitlement = {
        id: 'swap-1',
        kind: 'swap_right',
        seasonYear: 2026,
        holderTeam: 'BOS',
        underlyingPickId: 'BOS_2026_1st',
      };

      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5, LAL: 10 },
        teams: [
          {
            teamCode: 'BOS',
            entitlementIds: ['swap-1'],
            entitlements: [swapEntitlement],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockedResolveSwapForEntitlement).toHaveBeenCalled();
    });

    it('should call resolveConveyanceForEntitlement for pick_ownership entitlements', async () => {
      const pickOwnershipEntitlement = {
        id: 'own-1',
        kind: 'pick_ownership',
        seasonYear: 2026,
        holderTeam: 'LAL',
        underlyingPickId: 'BOS_2026_1st',
      };

      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 15 },
        teams: [
          {
            teamCode: 'LAL',
            entitlementIds: ['own-1'],
            entitlements: [pickOwnershipEntitlement],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockedResolveConveyanceForEntitlement).toHaveBeenCalled();
    });

    it('should skip entitlements for different draft year', async () => {
      const futureEntitlement = {
        id: 'ent-2027',
        kind: 'pick_ownership',
        seasonYear: 2027, // Different year
        holderTeam: 'BOS',
        underlyingPickId: 'BOS_2027_1st',
      };

      await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026, // Resolving 2026
        positionsMap: { BOS: 5 },
        teams: [
          {
            teamCode: 'BOS',
            entitlementIds: ['ent-2027'],
            entitlements: [futureEntitlement],
          },
        ],
      });

      // Should NOT have called resolution for 2027 entitlement
      expect(mockedResolveConveyanceForEntitlement).not.toHaveBeenCalled();
    });

    it('should skip already resolved entitlements', async () => {
      const resolvedEntitlement = {
        id: 'ent-resolved',
        kind: 'pick_ownership',
        seasonYear: 2026,
        holderTeam: 'BOS',
        underlyingPickId: 'BOS_2026_1st',
        resolved: true, // Already resolved
      };

      await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5 },
        teams: [
          {
            teamCode: 'BOS',
            entitlementIds: ['ent-resolved'],
            entitlements: [resolvedEntitlement],
          },
        ],
      });

      expect(mockedResolveConveyanceForEntitlement).not.toHaveBeenCalled();
    });

    it('should return success with meta containing processing counts', async () => {
      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5 },
        teams: [{ teamCode: 'BOS', entitlementIds: [], entitlements: [] }],
      });

      expect(result.success).toBe(true);
      expect(result.meta).toBeDefined();
      expect(result.meta.draftYear).toBe(2026);
      expect(typeof result.meta.teamsProcessed).toBe('number');
    });

    it('should build team updates from resolutions', async () => {
      mockedBuildTeamUpdatesFromResolutions.mockReturnValue([
        {
          teamCode: 'BOS',
          entitlementIds: ['new-ent'],
          addedIds: ['new-ent'],
          removedIds: ['old-ent'],
        },
      ]);

      const entitlement = {
        id: 'ent-1',
        kind: 'pick_ownership',
        seasonYear: 2026,
        holderTeam: 'BOS',
        underlyingPickId: 'LAL_2026_1st',
      };

      const result = await resolveAllDraftAssets(null, {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { LAL: 20 },
        teams: [
          {
            teamCode: 'BOS',
            entitlementIds: ['ent-1'],
            entitlements: [entitlement],
          },
        ],
      });

      expect(result.teamEntitlementIdUpdates).toBeDefined();
      expect(mockedBuildTeamUpdatesFromResolutions).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resolveTeamDraftAssets Tests (exported public API)
  // ============================================================================
  describe('resolveTeamDraftAssets', () => {
    it('should resolve draft assets for a single team', async () => {
      mockedResolveEntitlementsForTeamWithDb.mockResolvedValue([
        {
          id: 'ent-1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          holderTeam: 'BOS',
          underlyingPickId: 'BOS_2026_1st',
        },
      ]);

      const result = await resolveTeamDraftAssets(
        null, // db
        'world-1',
        'BOS',
        2026,
        { BOS: 5 }
      );

      expect(result.success).toBe(true);
      expect(mockedResolveEntitlementsForTeamWithDb).toHaveBeenCalledWith(
        null,
        'world-1',
        'BOS'
      );
    });
  });
});
