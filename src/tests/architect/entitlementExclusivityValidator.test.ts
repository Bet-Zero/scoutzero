/**
 * FILE: src/tests/architect/entitlementExclusivityValidator.test.ts
 * PURPOSE: Tests for the pure entitlement exclusivity validator.
 *          Validates all 4 violation types + self-edit exception + normalization.
 * OWNERSHIP: Test suite (TM-EXCL-E1: Entitlement Exclusivity Foundation)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E1 execution.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEntitlementExclusivity,
  type EntitlementDocLike,
} from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

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
// Rule 1: DUP_PICK_OWNERSHIP_UNDERLIER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rule 1: DUP_PICK_OWNERSHIP_UNDERLIER', () => {
  it('detects two pick_ownership with same underlyingPickId', () => {
    const entitlements = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makePickOwnership('ent-2', 'LAL_2026_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_PICK_OWNERSHIP_UNDERLIER');
    expect(result.violations[0].underlyingPickIds).toContain('LAL_2026_1st');
    expect(result.violations[0].entitlementIds).toEqual(['ent-1', 'ent-2']);
  });

  it('allows different underlyingPickIds', () => {
    const entitlements = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makePickOwnership('ent-2', 'BOS_2026_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects candidate that conflicts with existing pick_ownership', () => {
    const entitlements = [makePickOwnership('ent-1', 'LAL_2026_1st')];
    const candidate = {
      id: 'ent-new',
      doc: makePickOwnership('ent-new', 'LAL_2026_1st'),
    };

    const result = validateEntitlementExclusivity({ entitlements, candidate });
    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_PICK_OWNERSHIP_UNDERLIER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rule 2: DUP_SWAP_CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rule 2: DUP_SWAP_CONTROLLER', () => {
  it('detects two swap_right with same swapControllerPickId', () => {
    const entitlements = [
      makeSwapRight('ent-1', 'BOS_2027_1st'),
      makeSwapRight('ent-2', 'BOS_2027_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_SWAP_CONTROLLER');
    expect(result.violations[0].underlyingPickIds).toContain('BOS_2027_1st');
  });

  it('allows different swapControllerPickIds', () => {
    const entitlements = [
      makeSwapRight('ent-1', 'BOS_2027_1st'),
      makeSwapRight('ent-2', 'MIA_2027_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });

  it('detects candidate swap conflict', () => {
    const entitlements = [makeSwapRight('ent-1', 'BOS_2027_1st')];
    const candidate = {
      id: 'ent-new',
      doc: makeSwapRight('ent-new', 'BOS_2027_1st'),
    };

    const result = validateEntitlementExclusivity({ entitlements, candidate });
    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_SWAP_CONTROLLER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rule 3: DUP_CONVEYANCE_POOL_RANK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rule 3: DUP_CONVEYANCE_POOL_RANK', () => {
  it('detects exact duplicate conveyance (same pool + comparator + ranks)', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_CONVEYANCE_POOL_RANK');
  });

  it('detects duplicate conveyance with different order of pool IDs', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['BOS_2026_1st', 'LAL_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_CONVEYANCE_POOL_RANK');
  });

  it('detects duplicate conveyance with different order of ranks', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'less_favorable',
        [2, 1]
      ),
      makeConveyance(
        'ent-2',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'less_favorable',
        [1, 2]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_CONVEYANCE_POOL_RANK');
  });

  it('allows conveyance with different comparator', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'less_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });

  it('allows conveyance with different ranks', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [2]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    // No exact dup (different ranks), but overlap check may fire since pools are same
    // and ranks don't overlap. They share pools but not ranks, so no violations.
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rule 4: OVERLAP_CONVEYANCE_POOL_RANK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rule 4: OVERLAP_CONVEYANCE_POOL_RANK', () => {
  it('detects overlapping conveyance (shared pool + shared rank + same comparator)', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st', 'MIA_2026_1st'],
        'more_favorable',
        [1, 2]
      ),
      makeConveyance(
        'ent-2',
        ['BOS_2026_1st', 'GSW_2026_1st'],
        'more_favorable',
        [2, 3]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('OVERLAP_CONVEYANCE_POOL_RANK');
    expect(result.violations[0].details?.sharedPools).toContain('BOS_2026_1st');
    expect(result.violations[0].details?.sharedRanks).toContain(2);
  });

  it('allows non-overlapping pools even with same comparator and ranks', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['MIA_2026_1st', 'GSW_2026_1st'],
        'more_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });

  it('allows overlapping pools with different comparator', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['BOS_2026_1st', 'GSW_2026_1st'],
        'less_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });

  it('allows overlapping pools + same comparator but no rank overlap', () => {
    const entitlements = [
      makeConveyance(
        'ent-1',
        ['LAL_2026_1st', 'BOS_2026_1st'],
        'more_favorable',
        [1]
      ),
      makeConveyance(
        'ent-2',
        ['BOS_2026_1st', 'GSW_2026_1st'],
        'more_favorable',
        [2]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Self-edit exception
// ═══════════════════════════════════════════════════════════════════════════════

describe('Self-edit exception', () => {
  it('allows candidate editing same entitlement (same id) - pick_ownership', () => {
    const entitlements = [makePickOwnership('ent-1', 'LAL_2026_1st')];
    const candidate = {
      id: 'ent-1',
      doc: makePickOwnership('ent-1', 'LAL_2026_1st'),
    };

    const result = validateEntitlementExclusivity({ entitlements, candidate });
    expect(result.valid).toBe(true);
  });

  it('allows candidate editing same entitlement (same id) - swap_right', () => {
    const entitlements = [makeSwapRight('ent-1', 'BOS_2027_1st')];
    const candidate = {
      id: 'ent-1',
      doc: makeSwapRight('ent-1', 'BOS_2027_1st'),
    };

    const result = validateEntitlementExclusivity({ entitlements, candidate });
    expect(result.valid).toBe(true);
  });

  it('allows candidate editing same entitlement (same id) - conveyance_right', () => {
    const pool = ['LAL_2026_1st', 'BOS_2026_1st'];
    const entitlements = [makeConveyance('ent-1', pool, 'more_favorable', [1])];
    const candidate = {
      id: 'ent-1',
      doc: makeConveyance('ent-1', pool, 'more_favorable', [1]),
    };

    const result = validateEntitlementExclusivity({ entitlements, candidate });
    expect(result.valid).toBe(true);
  });

  it('same id skips collision even for whole-set validation', () => {
    // Two entries in the set with the same ID should not flag
    const ent = makePickOwnership('ent-1', 'LAL_2026_1st');
    const result = validateEntitlementExclusivity({
      entitlements: [ent, { ...ent }],
    });
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════════════════

describe('Normalization', () => {
  it('ranks as strings are parsed and still collide', () => {
    const entitlements = [
      makeConveyance('ent-1', ['A', 'B'], 'more_favorable', [1, 2]),
      {
        id: 'ent-2',
        kind: 'conveyance_right',
        poolUnderlyingPickIds: ['A', 'B'],
        receivesComparator: 'more_favorable',
        receivesRank: ['1', '2'], // strings
      } as EntitlementDocLike,
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_CONVEYANCE_POOL_RANK');
  });

  it('comparator is case-insensitive', () => {
    const entitlements = [
      makeConveyance('ent-1', ['A', 'B'], 'More_Favorable', [1]),
      makeConveyance('ent-2', ['A', 'B'], 'more_favorable', [1]),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_CONVEYANCE_POOL_RANK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-kind safety
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-kind safety', () => {
  it('pick_ownership and swap_right with same ID string do not false-positive', () => {
    const entitlements = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makeSwapRight('ent-2', 'LAL_2026_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
  });

  it('clean mixed set produces no violations', () => {
    const entitlements = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makeSwapRight('ent-2', 'BOS_2027_1st'),
      makeConveyance(
        'ent-3',
        ['MIA_2026_1st', 'GSW_2026_1st'],
        'more_favorable',
        [1]
      ),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('empty set is valid', () => {
    const result = validateEntitlementExclusivity({ entitlements: [] });
    expect(result.valid).toBe(true);
  });

  it('single entitlement is always valid', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [makePickOwnership('ent-1', 'LAL_2026_1st')],
    });
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Multiple violations in one set
// ═══════════════════════════════════════════════════════════════════════════════

describe('Multiple violations', () => {
  it('reports all violations found in a single set', () => {
    const entitlements = [
      makePickOwnership('ent-1', 'LAL_2026_1st'),
      makePickOwnership('ent-2', 'LAL_2026_1st'),
      makeSwapRight('ent-3', 'BOS_2027_1st'),
      makeSwapRight('ent-4', 'BOS_2027_1st'),
    ];

    const result = validateEntitlementExclusivity({ entitlements });
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(2);

    const types = result.violations.map((v) => v.type);
    expect(types).toContain('DUP_PICK_OWNERSHIP_UNDERLIER');
    expect(types).toContain('DUP_SWAP_CONTROLLER');
  });
});
