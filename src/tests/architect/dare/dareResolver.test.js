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

describe('DARE Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations - matching actual function names
    resolveSwapForEntitlement.mockReturnValue({
      entitlementId: 'test-ent',
      outcome: 'resolved',
      winner: 'BOS',
      position: 10,
      year: 2026,
      originalOwner: 'BOS',
      reason: 'Swap resolved',
      resolvedAt: new Date().toISOString(),
      method: 'lottery',
    });
    resolveConveyanceForEntitlement.mockReturnValue({
      entitlementId: 'test-ent',
      outcome: 'conveyed',
      year: 2026,
      position: 15,
      originalOwner: 'LAL',
      reason: 'Pick conveyed',
      resolvedAt: new Date().toISOString(),
      method: 'lottery',
    });
    buildEntitlementWritesFromResolution.mockReturnValue([]);
    buildTeamUpdatesFromResolutions.mockReturnValue([]);
    buildResolutionReceipt.mockReturnValue({
      draftYear: 2026,
      resolvedAt: new Date().toISOString(),
      entries: [],
      warnings: [],
    });
    resolutionToReceiptEntry.mockReturnValue({});
    buildProtectionLadder.mockReturnValue(null);
    resolveEntitlementsForTeamWithDb.mockResolvedValue([]);
    resolvePickRulesByIdsWithDb.mockResolvedValue(new Map());
    pickRulesMapToObject.mockReturnValue({});
  });

  // ============================================================================
  // validateDAREInput Tests (exported public API)
  // ============================================================================
  describe('validateDAREInput', () => {
    it('should return issues for missing worldId', () => {
      const issues = validateDAREInput({
        draftYear: 2026,
        positionsMap: { BOS: 5 },
        teams: [{ teamCode: 'BOS', entitlementIds: [] }],
      });
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
      expect(resolveConveyanceForEntitlement).toHaveBeenCalled();
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
      expect(resolveSwapForEntitlement).toHaveBeenCalled();
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
      expect(resolveConveyanceForEntitlement).toHaveBeenCalled();
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
      expect(resolveConveyanceForEntitlement).not.toHaveBeenCalled();
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

      expect(resolveConveyanceForEntitlement).not.toHaveBeenCalled();
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
      buildTeamUpdatesFromResolutions.mockReturnValue([
        { teamCode: 'BOS', addIds: ['new-ent'], removeIds: ['old-ent'] },
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
      expect(buildTeamUpdatesFromResolutions).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resolveTeamDraftAssets Tests (exported public API)
  // ============================================================================
  describe('resolveTeamDraftAssets', () => {
    it('should resolve draft assets for a single team', async () => {
      resolveEntitlementsForTeamWithDb.mockResolvedValue([
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
      expect(resolveEntitlementsForTeamWithDb).toHaveBeenCalledWith(
        null,
        'world-1',
        'BOS'
      );
    });
  });
});
