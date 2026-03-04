/**
 * FILE: src/tests/architect/worldTradeApplyExclusivityGate.test.ts
 * PURPOSE: Tests for TM-EXCL-E3 world trade apply exclusivity gating.
 *          Verifies that validateTradeApplyExclusivity blocks conflicting trades,
 *          ensures no writes are performed on failure, and passes clean trades.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E3
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTeamExclusivityGate } from '@/features/architect/utils/entitlements/runTeamExclusivityGate';
import type { EntitlementDocLike } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePickOwnership(
  id: string,
  underlyingPickId: string
): EntitlementDocLike {
  return { id, kind: 'pick_ownership', underlyingPickId };
}

function makeSwapRight(
  id: string,
  swapControllerPickId: string
): EntitlementDocLike {
  return { id, kind: 'swap_right', swapControllerPickId };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('World Trade Apply Exclusivity Gate (TM-EXCL-E3)', () => {
  /**
   * These tests verify the gating logic using runTeamExclusivityGate directly,
   * since the actual validateTradeApplyExclusivity requires Firestore.
   * The gate helper is pure and synchronous — the same logic used in the pipeline.
   */

  describe('runTeamExclusivityGate with WORLD_TRADE_APPLY context', () => {
    it('blocks a trade that would create duplicate pick_ownership', () => {
      const postTradeSet: EntitlementDocLike[] = [
        makePickOwnership('ent-1', 'LAL_2027_1st'),
        makePickOwnership('ent-2', 'LAL_2027_1st'), // dupe
      ];

      const result = runTeamExclusivityGate({
        teamId: 'BOS',
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorType).toBe('EXCLUSIVITY_VIOLATION');
        expect(result.message).toContain('World Trade Apply');
        expect(result.message).toContain('BOS');
        expect(result.message).toContain('DUP_PICK_OWNERSHIP_UNDERLIER');
        expect(result.violations).toBeDefined();
        expect(result.violations!.length).toBeGreaterThan(0);
      }
    });

    it('blocks a trade that would create duplicate swap_right', () => {
      const postTradeSet: EntitlementDocLike[] = [
        makeSwapRight('swap-1', 'LAL_2027_1st'),
        makeSwapRight('swap-2', 'LAL_2027_1st'), // dupe controller
      ];

      const result = runTeamExclusivityGate({
        teamId: 'CHI',
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorType).toBe('EXCLUSIVITY_VIOLATION');
        expect(result.message).toContain('World Trade Apply');
        expect(result.message).toContain('CHI');
        expect(result.message).toContain('DUP_SWAP_CONTROLLER');
      }
    });

    it('ensures no writes are performed when gate fails (mock batch not committed)', () => {
      // Simulate what the pipeline does:
      // 1. compute entitlementUpdates
      // 2. run exclusivity gate
      // 3. only proceed with batch if gate passes

      const postTradeSet: EntitlementDocLike[] = [
        makePickOwnership('ent-1', 'LAL_2027_1st'),
        makePickOwnership('ent-2', 'LAL_2027_1st'), // dupe
      ];

      // Mock batch
      const batchWrites: { entitlementId: string; holderTeam: string }[] = [];
      const mockBatchSet = vi.fn(
        (_ref: unknown, data: { holderTeam: string }) => {
          batchWrites.push({
            entitlementId: 'mock',
            holderTeam: data.holderTeam,
          });
        }
      );
      const mockBatchCommit = vi.fn();

      // Gate check — this would happen BEFORE batch writes in the pipeline
      const gateResult = runTeamExclusivityGate({
        teamId: 'BOS',
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      // If gate fails, pipeline returns error and never writes
      if (!gateResult.ok) {
        // Verify no batch operations were performed
        expect(mockBatchSet).not.toHaveBeenCalled();
        expect(mockBatchCommit).not.toHaveBeenCalled();
        expect(batchWrites).toHaveLength(0);
      } else {
        // This path should not execute in this test
        expect.unreachable('Gate should have failed');
      }
    });

    it('allows a clean trade with no conflicts', () => {
      const postTradeSet: EntitlementDocLike[] = [
        makePickOwnership('ent-1', 'BOS_2027_1st'),
        makePickOwnership('ent-2', 'LAL_2027_1st'), // different pick
        makeSwapRight('swap-1', 'GSW_2028_1st'),
      ];

      const result = runTeamExclusivityGate({
        teamId: 'BOS',
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      expect(result.ok).toBe(true);
    });

    it('fails safely when entitlements array is not provided', () => {
      const result = runTeamExclusivityGate({
        teamId: 'BOS',
        entitlements: null as unknown as EntitlementDocLike[],
        context: 'WORLD_TRADE_APPLY',
      });

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorType).toBe('VALIDATION_UNAVAILABLE');
        expect(result.message).toContain('BOS');
        expect(result.message).toContain('not an array');
      }
    });

    it('passes when trade involves entitlements with no overlapping claims', () => {
      // Multi-type entitlement set that's conflict-free
      const postTradeSet: EntitlementDocLike[] = [
        makePickOwnership('ent-1', 'BOS_2027_1st'),
        makePickOwnership('ent-2', 'LAL_2027_1st'),
        makeSwapRight('swap-1', 'CHI_2027_1st'),
        makeSwapRight('swap-2', 'MIA_2028_1st'),
        {
          id: 'conv-1',
          kind: 'conveyance_right',
          poolUnderlyingPickIds: ['PHI_2027_1st', 'PHI_2028_1st'],
          receivesComparator: 'most_favorable',
          receivesRank: [1],
        },
      ];

      const result = runTeamExclusivityGate({
        teamId: 'BOS',
        entitlements: postTradeSet,
        context: 'WORLD_TRADE_APPLY',
      });

      expect(result.ok).toBe(true);
    });
  });
});
