/**
 * FILE: src/tests/architect/computeEntitlementClaims.test.ts
 * PURPOSE: Tests for the pure claims model — computeEntitlementClaims().
 *          Validates claim fingerprints are deterministic, stable, and readable.
 * OWNERSHIP: Test suite (TM-EXCL-E4: Claims Model + Explainability)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E4 execution.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEntitlementClaims,
  computeEntitlementClaimsBatch,
  explainConflict,
  CONFLICT_TYPE_LABELS,
  type EntitlementClaim,
} from '@/features/architect/utils/entitlements/computeEntitlementClaims';
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

function makeConveyance(
  id: string,
  poolUnderlyingPickIds: string[],
  receivesComparator: string,
  receivesRank: number[]
): EntitlementDocLike {
  return {
    id,
    kind: 'conveyance_right',
    poolUnderlyingPickIds,
    receivesComparator,
    receivesRank,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// pick_ownership claims
// ═══════════════════════════════════════════════════════════════════════════════

describe('pick_ownership claims', () => {
  it('produces OWNERSHIP_UNDERLIER claim with correct key', () => {
    const result = computeEntitlementClaims(
      makePickOwnership('ent-1', 'LAL_2026_1st')
    );

    expect(result.entitlementId).toBe('ent-1');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].type).toBe('OWNERSHIP_UNDERLIER');
    expect(result.claims[0].key).toBe('own:LAL_2026_1st');
  });

  it('includes human-readable explanation in meta', () => {
    const result = computeEntitlementClaims(
      makePickOwnership('ent-1', 'LAL_2026_1st')
    );

    expect(result.claims[0].meta.explanation).toContain('Owns');
    expect(result.claims[0].meta.explanation).toContain('LAL 2026 1st');
    expect(result.claims[0].meta.kind).toBe('pick_ownership');
    expect(result.claims[0].meta.underlyingPickId).toBe('LAL_2026_1st');
  });

  it('is deterministic — same input always produces same output', () => {
    const doc = makePickOwnership('ent-1', 'LAL_2026_1st');
    const result1 = computeEntitlementClaims(doc);
    const result2 = computeEntitlementClaims(doc);

    expect(result1.claims).toEqual(result2.claims);
  });

  it('returns no claims if underlyingPickId is missing', () => {
    const result = computeEntitlementClaims({
      id: 'ent-1',
      kind: 'pick_ownership',
    });
    expect(result.claims).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// swap_right claims
// ═══════════════════════════════════════════════════════════════════════════════

describe('swap_right claims', () => {
  it('produces SWAP_CONTROLLER claim with correct key', () => {
    const result = computeEntitlementClaims(
      makeSwapRight('ent-2', 'BOS_2027_1st')
    );

    expect(result.entitlementId).toBe('ent-2');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].type).toBe('SWAP_CONTROLLER');
    expect(result.claims[0].key).toBe('swap:BOS_2027_1st');
  });

  it('includes human-readable explanation', () => {
    const result = computeEntitlementClaims(
      makeSwapRight('ent-2', 'BOS_2027_1st')
    );

    expect(result.claims[0].meta.explanation).toContain('swap decision');
    expect(result.claims[0].meta.explanation).toContain('BOS 2027 1st');
    expect(result.claims[0].meta.kind).toBe('swap_right');
  });

  it('returns no claims if swapControllerPickId is missing', () => {
    const result = computeEntitlementClaims({
      id: 'ent-2',
      kind: 'swap_right',
    });
    expect(result.claims).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// conveyance_right claims
// ═══════════════════════════════════════════════════════════════════════════════

describe('conveyance_right claims', () => {
  it('produces both EXACT and OVERLAP claims', () => {
    const result = computeEntitlementClaims(
      makeConveyance(
        'ent-3',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      )
    );

    expect(result.claims).toHaveLength(2);

    const types = result.claims.map((c) => c.type);
    expect(types).toContain('CONVEYANCE_POOL_RANK_EXACT');
    expect(types).toContain('CONVEYANCE_POOL_RANK_OVERLAP');
  });

  it('EXACT claim key includes sorted pool, comparator, and ranks', () => {
    const result = computeEntitlementClaims(
      makeConveyance(
        'ent-3',
        ['BOS_2026_1st', 'LAL_2026_1st'],
        'more_favorable',
        [2, 1]
      )
    );

    const exact = result.claims.find(
      (c) => c.type === 'CONVEYANCE_POOL_RANK_EXACT'
    )!;
    // Pool should be sorted: BOS|LAL, ranks sorted: 1,2
    expect(exact.key).toBe('conv:BOS_2026_1st|LAL_2026_1st:more_favorable:1,2');
  });

  it('includes human-readable explanation in meta', () => {
    const result = computeEntitlementClaims(
      makeConveyance(
        'ent-3',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      )
    );

    const exact = result.claims.find(
      (c) => c.type === 'CONVEYANCE_POOL_RANK_EXACT'
    )!;
    expect(exact.meta.explanation).toContain('most favorable');
    expect(exact.meta.explanation).toContain('rank #1');
    expect(exact.meta.kind).toBe('conveyance_right');
    expect(exact.meta.poolPickIds).toEqual(['BOS_2026_1st', 'LAL_2026_1st']);
    expect(exact.meta.comparator).toBe('more_favorable');
    expect(exact.meta.ranks).toEqual([1]);
  });

  it('is deterministic regardless of input order', () => {
    const doc1 = makeConveyance(
      'ent-3',
      ['BOS_2026_1st', 'LAL_2026_1st'],
      'more_favorable',
      [2, 1]
    );
    const doc2 = makeConveyance(
      'ent-3',
      ['LAL_2026_1st', 'BOS_2026_1st'],
      'more_favorable',
      [1, 2]
    );

    const result1 = computeEntitlementClaims(doc1);
    const result2 = computeEntitlementClaims(doc2);

    expect(result1.claims.map((c) => c.key)).toEqual(
      result2.claims.map((c) => c.key)
    );
  });

  it('returns no claims if pool or comparator is missing', () => {
    const noPool = computeEntitlementClaims({
      id: 'ent-3',
      kind: 'conveyance_right',
      receivesComparator: 'more_favorable',
      receivesRank: [1],
    });
    expect(noPool.claims).toHaveLength(0);

    const noComparator = computeEntitlementClaims({
      id: 'ent-3',
      kind: 'conveyance_right',
      poolUnderlyingPickIds: ['LAL_2026_1st', 'BOS_2026_1st'],
      receivesRank: [1],
    });
    expect(noComparator.claims).toHaveLength(0);
  });

  it('handles string ranks via normalization', () => {
    const result = computeEntitlementClaims({
      id: 'ent-3',
      kind: 'conveyance_right',
      poolUnderlyingPickIds: ['A', 'B'],
      receivesComparator: 'more_favorable',
      receivesRank: ['1', '2'] as unknown as number[],
    });

    const exact = result.claims.find(
      (c) => c.type === 'CONVEYANCE_POOL_RANK_EXACT'
    )!;
    expect(exact.meta.ranks).toEqual([1, 2]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('returns (no id) for doc without id', () => {
    const result = computeEntitlementClaims({
      kind: 'pick_ownership',
      underlyingPickId: 'LAL_2026_1st',
    });
    expect(result.entitlementId).toBe('(no id)');
    expect(result.claims).toHaveLength(1);
  });

  it('returns no claims for unknown kind', () => {
    const result = computeEntitlementClaims({
      id: 'ent-x',
      kind: 'unknown_kind',
    });
    expect(result.claims).toHaveLength(0);
  });

  it('returns no claims for empty doc', () => {
    const result = computeEntitlementClaims({});
    expect(result.entitlementId).toBe('(no id)');
    expect(result.claims).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Batch helper
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeEntitlementClaimsBatch', () => {
  it('processes array of entitlements', () => {
    const docs = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makeSwapRight('ent-2', 'BOS_2027_1st'),
      makeConveyance(
        'ent-3',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
    ];

    const results = computeEntitlementClaimsBatch(docs);
    expect(results).toHaveLength(3);
    expect(results[0].entitlementId).toBe('ent-1');
    expect(results[1].entitlementId).toBe('ent-2');
    expect(results[2].entitlementId).toBe('ent-3');
  });

  it('handles empty array', () => {
    const results = computeEntitlementClaimsBatch([]);
    expect(results).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Conflict explainer
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainConflict', () => {
  it('provides readable explanation for matching claim keys', () => {
    const claimsA: EntitlementClaim[] = [
      {
        type: 'OWNERSHIP_UNDERLIER',
        key: 'own:LAL_2026_1st',
        meta: {
          explanation: 'Owns the LAL 2026 1st pick',
          kind: 'pick_ownership',
          underlyingPickId: 'LAL_2026_1st',
        },
      },
    ];
    const claimsB: EntitlementClaim[] = [
      {
        type: 'OWNERSHIP_UNDERLIER',
        key: 'own:LAL_2026_1st',
        meta: {
          explanation: 'Owns the LAL 2026 1st pick',
          kind: 'pick_ownership',
          underlyingPickId: 'LAL_2026_1st',
        },
      },
    ];

    const result = explainConflict(
      'DUP_PICK_OWNERSHIP_UNDERLIER',
      claimsA,
      claimsB
    );

    expect(result).toContain('Duplicate pick ownership');
    expect(result).toContain('Owns the LAL 2026 1st pick');
  });

  it('falls back to label when no matching keys', () => {
    const result = explainConflict('DUP_SWAP_CONTROLLER', [], []);
    expect(result).toBe('Duplicate swap controller');
  });

  it('falls back gracefully for unknown violation types', () => {
    const result = explainConflict('UNKNOWN_TYPE', [], []);
    expect(result).toBe('Entitlement conflict');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT_TYPE_LABELS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CONFLICT_TYPE_LABELS', () => {
  it('has labels for all 4 violation types', () => {
    expect(CONFLICT_TYPE_LABELS.DUP_PICK_OWNERSHIP_UNDERLIER).toBeDefined();
    expect(CONFLICT_TYPE_LABELS.DUP_SWAP_CONTROLLER).toBeDefined();
    expect(CONFLICT_TYPE_LABELS.DUP_CONVEYANCE_POOL_RANK).toBeDefined();
    expect(CONFLICT_TYPE_LABELS.OVERLAP_CONVEYANCE_POOL_RANK).toBeDefined();
  });

  it('labels are user-readable strings', () => {
    Object.values(CONFLICT_TYPE_LABELS).forEach((label) => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(5);
    });
  });
});
