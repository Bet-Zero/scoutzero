/**
 * FILE: src/tests/architect/vacuumTransferExclusivityGate.test.ts
 * PURPOSE: Tests for TM-EXCL-E3 vacuum transfer exclusivity gating.
 *          Verifies that applyGatedVacuumTransfer blocks conflicting transfers,
 *          fails safely when post-set cannot be computed, and allows clean transfers.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E3
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyGatedVacuumTransfer } from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';
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

describe('Vacuum Transfer Exclusivity Gate (TM-EXCL-E3)', () => {
  // ── Blocking tests ──

  it('blocks a transfer that would create duplicate pick_ownership on receiver', () => {
    // BOS already owns LAL_2027_1st. Transferring another LAL_2027_1st to BOS = conflict.
    const postTransferSets: Record<string, EntitlementDocLike[]> = {
      BOS: [
        makePickOwnership('ent-existing', 'LAL_2027_1st'),
        makePickOwnership('ent-incoming', 'LAL_2027_1st'), // duplicate!
      ],
      LAL: [
        makePickOwnership('ent-other', 'LAL_2028_1st'), // LAL keeps other picks
      ],
    };

    const result = applyGatedVacuumTransfer(
      'ent-incoming',
      'LAL',
      'BOS',
      postTransferSets
    );

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorType).toBe('EXCLUSIVITY_VIOLATION');
      expect(result.message).toContain('BOS');
      expect(result.message).toContain('DUP_PICK_OWNERSHIP_UNDERLIER');
    }
  });

  it('blocks a transfer that would create duplicate swap_right on receiver', () => {
    const postTransferSets: Record<string, EntitlementDocLike[]> = {
      CHI: [
        makeSwapRight('swap-existing', 'LAL_2027_1st'),
        makeSwapRight('swap-incoming', 'LAL_2027_1st'), // duplicate controller!
      ],
      LAL: [],
    };

    const result = applyGatedVacuumTransfer(
      'swap-incoming',
      'LAL',
      'CHI',
      postTransferSets
    );

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorType).toBe('EXCLUSIVITY_VIOLATION');
      expect(result.message).toContain('CHI');
      expect(result.message).toContain('DUP_SWAP_CONTROLLER');
    }
  });

  // ── Fail-safe tests ──

  it('fails when post-transfer set is not provided for the receiver', () => {
    // Missing postTransferSets for receiver team
    const result = applyGatedVacuumTransfer(
      'ent-1',
      'LAL',
      'BOS',
      { LAL: [] } // BOS (the receiver) is missing!
    );

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorType).toBe('VALIDATION_UNAVAILABLE');
      expect(result.message).toContain('BOS');
      expect(result.message).toContain('not provided');
    }
  });

  it('fails safely when entitlement set is malformed (not an array)', () => {
    const result = applyGatedVacuumTransfer('ent-1', 'LAL', 'BOS', {
      BOS: 'not-an-array' as unknown as EntitlementDocLike[],
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorType).toBe('VALIDATION_UNAVAILABLE');
      expect(result.message).toContain('BOS');
    }
  });

  // ── Allow tests ──

  it('allows a clean transfer with no conflicts', () => {
    const postTransferSets: Record<string, EntitlementDocLike[]> = {
      BOS: [
        makePickOwnership('ent-existing', 'BOS_2027_1st'),
        makePickOwnership('ent-incoming', 'LAL_2027_1st'), // different pick
      ],
      LAL: [makePickOwnership('ent-other', 'LAL_2028_1st')],
    };

    const result = applyGatedVacuumTransfer(
      'ent-incoming',
      'LAL',
      'BOS',
      postTransferSets
    );

    expect(result.ok).toBe(true);
  });

  it('allows a transfer when receiver has no existing entitlements', () => {
    const postTransferSets: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-incoming', 'LAL_2027_1st')],
      LAL: [],
    };

    const result = applyGatedVacuumTransfer(
      'ent-incoming',
      'LAL',
      'BOS',
      postTransferSets
    );

    expect(result.ok).toBe(true);
  });

  it('validates both sender and receiver when both are provided', () => {
    // Sender has a conflict
    const postTransferSets: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-incoming', 'LAL_2027_1st')],
      LAL: [
        makePickOwnership('ent-a', 'GSW_2027_1st'),
        makePickOwnership('ent-b', 'GSW_2027_1st'), // duplicate on sender!
      ],
    };

    const result = applyGatedVacuumTransfer(
      'ent-incoming',
      'LAL',
      'BOS',
      postTransferSets
    );

    // Should fail because LAL's post-set has a violation
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errorType).toBe('EXCLUSIVITY_VIOLATION');
    }
  });
});
