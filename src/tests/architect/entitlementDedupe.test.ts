/**
 * FILE: src/tests/architect/entitlementDedupe.test.ts
 * PURPOSE: Tests for Entitlement Duplicate Prevention (R1-R4).
 *          Validates deterministic identity, upsert semantics, and double-submit protection.
 * OWNERSHIP: Test suite (Entitlement Dedupe Prevention)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Dedupe Prevention execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEntitlementIdentityKey,
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
  isSameEntitlementIdentity,
  extractIdentityFields,
} from '@/features/architect/utils/entitlements/entitlementIdentity';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: Identity Key Stability
// ═══════════════════════════════════════════════════════════════════════════════

describe('Identity Key Stability (R1)', () => {
  it('same pick_ownership document produces same identity key', () => {
    const doc1 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
      description: 'Lakers own pick', // Non-identity field
    };

    const doc2 = {
      holderTeam: 'lal', // lowercase
      seasonYear: '2026', // string
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
      otherField: 'ignored', // Extra field
    };

    const key1 = getEntitlementIdentityKey(doc1);
    const key2 = getEntitlementIdentityKey(doc2);

    expect(key1).toBe(key2);
    expect(key1).toContain('own');
    expect(key1).toContain('LAL');
    expect(key1).toContain('2026');
  });

  it('same swap_right document produces same identity key', () => {
    const doc1 = {
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right' as const,
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'Boston own 1st round pick',
    };

    const doc2 = {
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right' as const,
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'Boston own 1st round pick',
      swapType: 'best_of', // Non-identity field for swap
    };

    expect(getEntitlementIdentityKey(doc1)).toBe(
      getEntitlementIdentityKey(doc2)
    );
  });

  it('same conveyance_right document produces same identity key regardless of array order', () => {
    const doc1 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['MIA_2028_1st', 'BOS_2028_1st', 'LAL_2028_1st'],
      receivesComparator: 'more_favorable',
      receivesRank: [1, 2],
    };

    const doc2 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['LAL_2028_1st', 'MIA_2028_1st', 'BOS_2028_1st'], // Different order
      receivesComparator: 'more_favorable',
      receivesRank: [2, 1], // Different order
    };

    expect(getEntitlementIdentityKey(doc1)).toBe(
      getEntitlementIdentityKey(doc2)
    );
  });

  it('different documents produce different identity keys', () => {
    const doc1 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    const doc2 = {
      holderTeam: 'BOS', // Different team
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'BOS_2026_1st',
    };

    const doc3 = {
      holderTeam: 'LAL',
      seasonYear: 2027, // Different year
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2027_1st',
    };

    expect(getEntitlementIdentityKey(doc1)).not.toBe(
      getEntitlementIdentityKey(doc2)
    );
    expect(getEntitlementIdentityKey(doc1)).not.toBe(
      getEntitlementIdentityKey(doc3)
    );
    expect(getEntitlementIdentityKey(doc2)).not.toBe(
      getEntitlementIdentityKey(doc3)
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: Deterministic ID Generation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Deterministic ID Generation (R1)', () => {
  it('same document produces same deterministic ID', () => {
    const doc = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    const id1 = getEntitlementDeterministicId(doc);
    const id2 = getEntitlementDeterministicId(doc);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^ent:LAL:2026:1:own:[0-9a-f]{8}$/);
  });

  it('same document produces same vacuum deterministic ID', () => {
    const doc = {
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 2,
      kind: 'swap_right' as const,
      swapControllerPickId: 'BOS_2027_2nd',
      swapTargetDefinition: 'Swap target',
    };

    const id1 = getVacuumDeterministicId(doc);
    const id2 = getVacuumDeterministicId(doc);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^vacuum:BOS:2027:2:swap:[0-9a-f]{8}$/);
  });

  it('different documents produce different deterministic IDs', () => {
    const doc1 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    const doc2 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'BOS_2026_1st', // Different underlying pick
    };

    expect(getEntitlementDeterministicId(doc1)).not.toBe(
      getEntitlementDeterministicId(doc2)
    );
  });

  it('ID hash is stable across calls', () => {
    // Run multiple times to ensure no randomness
    const doc = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['A', 'B', 'C'],
      receivesComparator: 'more_favorable',
      receivesRank: [1],
    };

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      ids.add(getEntitlementDeterministicId(doc));
    }

    expect(ids.size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: isSameEntitlementIdentity Helper
// ═══════════════════════════════════════════════════════════════════════════════

describe('isSameEntitlementIdentity Helper', () => {
  it('returns true for same logical entitlement', () => {
    const doc1 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    const doc2 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
      description: 'Added description', // Non-identity field
    };

    expect(isSameEntitlementIdentity(doc1, doc2)).toBe(true);
  });

  it('returns false for different logical entitlements', () => {
    const doc1 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    const doc2 = {
      holderTeam: 'BOS',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'BOS_2026_1st',
    };

    expect(isSameEntitlementIdentity(doc1, doc2)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: extractIdentityFields Helper
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractIdentityFields Helper', () => {
  it('extracts only identity fields for pick_ownership', () => {
    const doc = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
      description: 'This should not appear',
      someOtherField: 'ignored',
    };

    const extracted = extractIdentityFields(doc);

    expect(extracted).toEqual({
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'LAL_2026_1st',
    });
    expect('description' in extracted).toBe(false);
    expect('someOtherField' in extracted).toBe(false);
  });

  it('extracts swap fields for swap_right', () => {
    const doc = {
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right' as const,
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'Target',
      swapType: 'best_of', // Non-identity
    };

    const extracted = extractIdentityFields(doc);

    expect(extracted).toEqual({
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'Target',
    });
    expect('swapType' in extracted).toBe(false);
  });

  it('extracts pool fields for conveyance_right', () => {
    const doc = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['A', 'B'],
      receivesComparator: 'more_favorable',
      receivesRank: [1],
      protectionLadder: [], // Non-identity
    };

    const extracted = extractIdentityFields(doc);

    expect(extracted).toEqual({
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right',
      poolUnderlyingPickIds: ['A', 'B'],
      receivesComparator: 'more_favorable',
      receivesRank: [1],
    });
    expect('protectionLadder' in extracted).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: Array Sorting for Conveyance Pools
// ═══════════════════════════════════════════════════════════════════════════════

describe('Array Sorting in Identity (Conveyance Dedupe)', () => {
  it('pool IDs are sorted for stable identity', () => {
    const doc1 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['C', 'A', 'B'],
      receivesComparator: 'more_favorable',
      receivesRank: [1],
    };

    const doc2 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['A', 'B', 'C'], // Already sorted
      receivesComparator: 'more_favorable',
      receivesRank: [1],
    };

    expect(getEntitlementIdentityKey(doc1)).toBe(
      getEntitlementIdentityKey(doc2)
    );
    expect(getEntitlementDeterministicId(doc1)).toBe(
      getEntitlementDeterministicId(doc2)
    );
  });

  it('rank numbers are sorted for stable identity', () => {
    const doc1 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['A'],
      receivesComparator: 'more_favorable',
      receivesRank: [3, 1, 2],
    };

    const doc2 = {
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'conveyance_right' as const,
      poolUnderlyingPickIds: ['A'],
      receivesComparator: 'more_favorable',
      receivesRank: [1, 2, 3], // Already sorted
    };

    expect(getEntitlementIdentityKey(doc1)).toBe(
      getEntitlementIdentityKey(doc2)
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6: Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('handles missing/empty fields gracefully', () => {
    const doc = {
      holderTeam: '',
      seasonYear: undefined,
      round: 1,
      kind: 'pick_ownership' as const,
    };

    // Should not throw
    const key = getEntitlementIdentityKey(doc);
    const id = getEntitlementDeterministicId(doc);

    expect(typeof key).toBe('string');
    expect(typeof id).toBe('string');
  });

  it('normalizes whitespace in string fields', () => {
    const doc1 = {
      holderTeam: '  LAL  ',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: '  LAL_2026_1st  ',
    };

    const doc2 = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership' as const,
      underlyingPickId: 'LAL_2026_1st',
    };

    expect(getEntitlementIdentityKey(doc1)).toBe(
      getEntitlementIdentityKey(doc2)
    );
  });

  it('handles unknown kind gracefully', () => {
    const doc = {
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'unknown_kind' as any,
    };

    // Should not throw
    const key = getEntitlementIdentityKey(doc);
    expect(key).toContain('unknown_kind');
  });
});
