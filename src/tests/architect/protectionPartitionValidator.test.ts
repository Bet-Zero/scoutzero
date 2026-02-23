/**
 * FILE: src/tests/architect/protectionPartitionValidator.test.ts
 * PURPOSE: Tests for TM-EXCL-E5 — Structured Protections + Partition Validation.
 *
 * Coverage:
 *  - expandProtectionCoverage: coverage set generation from structuredCondition
 *  - checkProtectionPartitionPair: pairwise partition check
 *  - validateProtectionPartition: full entitlement set validation
 *  - Integration with exclusivity validator (Rule #5: OVERLAP_PROTECTION_RANGE)
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.10
 */

import { describe, it, expect } from 'vitest';
import {
  expandProtectionCoverage,
  checkProtectionPartitionPair,
  validateProtectionPartition,
  getPartitionOverlapDetail,
} from '@/features/architect/utils/entitlements/protectionPartitionValidator';
import { validateEntitlementExclusivity } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Shorthand factory for a pick_ownership entitlement with a protection ladder. */
function makePickOwnership(
  id: string,
  underlyingPickId: string,
  ladder?: Array<{
    year: number;
    condition?: string;
    structuredCondition?: { positionStart: number; positionEnd: number };
  }>
) {
  return {
    id,
    kind: 'pick_ownership' as const,
    underlyingPickId,
    protectionLadder: ladder,
  };
}

// =============================================================================
// expandProtectionCoverage
// =============================================================================

describe('expandProtectionCoverage', () => {
  it('returns null for empty ladder', () => {
    expect(expandProtectionCoverage(2026, [])).toBeNull();
    expect(expandProtectionCoverage(2026, null)).toBeNull();
    expect(expandProtectionCoverage(2026, undefined)).toBeNull();
  });

  it('returns null when year not found in ladder', () => {
    const ladder = [
      {
        year: 2027,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ];
    expect(expandProtectionCoverage(2026, ladder)).toBeNull();
  });

  it('returns null when structuredCondition is missing', () => {
    const ladder = [{ year: 2026, condition: 'Top 10' }];
    expect(expandProtectionCoverage(2026, ladder)).toBeNull();
  });

  it('expands "Top 10" correctly (positions 1–10 protected)', () => {
    const ladder = [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ];
    const result = expandProtectionCoverage(2026, ladder);
    expect(result).not.toBeNull();
    expect(result!.protectedPositions.size).toBe(10);
    expect(result!.unprotectedPositions.size).toBe(20);
    for (let i = 1; i <= 10; i++) {
      expect(result!.protectedPositions.has(i)).toBe(true);
    }
    for (let i = 11; i <= 30; i++) {
      expect(result!.unprotectedPositions.has(i)).toBe(true);
    }
  });

  it('expands "11-30" correctly (positions 11–30 protected)', () => {
    const ladder = [
      {
        year: 2026,
        condition: '11-30',
        structuredCondition: { positionStart: 11, positionEnd: 30 },
      },
    ];
    const result = expandProtectionCoverage(2026, ladder);
    expect(result).not.toBeNull();
    expect(result!.protectedPositions.size).toBe(20);
    expect(result!.unprotectedPositions.size).toBe(10);
    for (let i = 1; i <= 10; i++) {
      expect(result!.unprotectedPositions.has(i)).toBe(true);
    }
    for (let i = 11; i <= 30; i++) {
      expect(result!.protectedPositions.has(i)).toBe(true);
    }
  });

  it('expands "Lottery" correctly (positions 1–14)', () => {
    const ladder = [
      {
        year: 2026,
        condition: 'Lottery',
        structuredCondition: { positionStart: 1, positionEnd: 14 },
      },
    ];
    const result = expandProtectionCoverage(2026, ladder);
    expect(result).not.toBeNull();
    expect(result!.protectedPositions.size).toBe(14);
    expect(result!.unprotectedPositions.size).toBe(16);
  });

  it('respects custom maxPosition', () => {
    const ladder = [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ];
    const result = expandProtectionCoverage(2026, ladder, 20);
    expect(result).not.toBeNull();
    expect(result!.protectedPositions.size).toBe(10);
    expect(result!.unprotectedPositions.size).toBe(10);
  });
});

// =============================================================================
// checkProtectionPartitionPair
// =============================================================================

describe('checkProtectionPartitionPair', () => {
  it('returns UNAVAILABLE when both lack ladders', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st');
    const b = makePickOwnership('b', 'LAL_2026_1st');
    expect(checkProtectionPartitionPair(a, b)).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE when one lacks a ladder', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st');
    expect(checkProtectionPartitionPair(a, b)).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE when ladders have no structuredConditions', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      { year: 2026, condition: 'Top 10' },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      { year: 2026, condition: '11-30' },
    ]);
    expect(checkProtectionPartitionPair(a, b)).toBe('UNAVAILABLE');
  });

  it('returns VALID_PARTITION for Top 10 + 11–30 (disjoint)', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: '11-30',
        structuredCondition: { positionStart: 11, positionEnd: 30 },
      },
    ]);
    expect(checkProtectionPartitionPair(a, b)).toBe('VALID_PARTITION');
  });

  it('returns OVERLAP for Top 10 + 8–30 (overlapping)', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: '8-30',
        structuredCondition: { positionStart: 8, positionEnd: 30 },
      },
    ]);
    expect(checkProtectionPartitionPair(a, b)).toBe('OVERLAP');
  });

  it('returns VALID_PARTITION for Lottery + 15–30 (disjoint)', () => {
    const a = makePickOwnership('a', 'BOS_2027_1st', [
      {
        year: 2027,
        condition: 'Lottery',
        structuredCondition: { positionStart: 1, positionEnd: 14 },
      },
    ]);
    const b = makePickOwnership('b', 'BOS_2027_1st', [
      {
        year: 2027,
        condition: '15-30',
        structuredCondition: { positionStart: 15, positionEnd: 30 },
      },
    ]);
    expect(checkProtectionPartitionPair(a, b)).toBe('VALID_PARTITION');
  });

  it('returns VALID_PARTITION for different years (no shared years)', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2027,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    expect(checkProtectionPartitionPair(a, b)).toBe('VALID_PARTITION');
  });

  it('correctly detects overlap in one year within multi-year ladders', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
      {
        year: 2027,
        condition: 'Top 5',
        structuredCondition: { positionStart: 1, positionEnd: 5 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: '11-30',
        structuredCondition: { positionStart: 11, positionEnd: 30 },
      },
      {
        year: 2027,
        condition: '3-30',
        structuredCondition: { positionStart: 3, positionEnd: 30 },
      },
    ]);
    // 2026 is disjoint, but 2027 overlaps at positions 3–5
    expect(checkProtectionPartitionPair(a, b)).toBe('OVERLAP');
  });
});

// =============================================================================
// getPartitionOverlapDetail
// =============================================================================

describe('getPartitionOverlapDetail', () => {
  it('returns null when no overlap', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: '11-30',
        structuredCondition: { positionStart: 11, positionEnd: 30 },
      },
    ]);
    expect(getPartitionOverlapDetail(a, b)).toBeNull();
  });

  it('returns overlap detail for Top 10 + 8–30', () => {
    const a = makePickOwnership('a', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: 'Top 10',
        structuredCondition: { positionStart: 1, positionEnd: 10 },
      },
    ]);
    const b = makePickOwnership('b', 'LAL_2026_1st', [
      {
        year: 2026,
        condition: '8-30',
        structuredCondition: { positionStart: 8, positionEnd: 30 },
      },
    ]);
    const detail = getPartitionOverlapDetail(a, b);
    expect(detail).not.toBeNull();
    expect(detail!.year).toBe(2026);
    expect(detail!.overlappingPositions).toEqual([8, 9, 10]);
    expect(detail!.rangeA).toEqual({ positionStart: 1, positionEnd: 10 });
    expect(detail!.rangeB).toEqual({ positionStart: 8, positionEnd: 30 });
  });
});

// =============================================================================
// validateProtectionPartition (standalone)
// =============================================================================

describe('validateProtectionPartition', () => {
  it('returns NOT_APPLICABLE when no partitioned picks', () => {
    const ents = [
      makePickOwnership('a', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: 'Top 10',
          structuredCondition: { positionStart: 1, positionEnd: 10 },
        },
      ]),
      makePickOwnership('b', 'BOS_2026_1st', [
        {
          year: 2026,
          condition: 'Top 5',
          structuredCondition: { positionStart: 1, positionEnd: 5 },
        },
      ]),
    ];
    const result = validateProtectionPartition(ents);
    expect(result.status).toBe('NOT_APPLICABLE');
  });

  it('returns VALID for disjoint partition (Top 10 + 11–30)', () => {
    const ents = [
      makePickOwnership('a', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: 'Top 10',
          structuredCondition: { positionStart: 1, positionEnd: 10 },
        },
      ]),
      makePickOwnership('b', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: '11-30',
          structuredCondition: { positionStart: 11, positionEnd: 30 },
        },
      ]),
    ];
    const result = validateProtectionPartition(ents);
    expect(result.status).toBe('VALID');
  });

  it('returns INVALID for overlapping partition (Top 10 + 8–30)', () => {
    const ents = [
      makePickOwnership('a', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: 'Top 10',
          structuredCondition: { positionStart: 1, positionEnd: 10 },
        },
      ]),
      makePickOwnership('b', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: '8-30',
          structuredCondition: { positionStart: 8, positionEnd: 30 },
        },
      ]),
    ];
    const result = validateProtectionPartition(ents);
    expect(result.status).toBe('INVALID');
    if (result.status === 'INVALID') {
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('OVERLAP_PROTECTION_RANGE');
      expect(result.violations[0].underlyingPickId).toBe('LAL_2026_1st');
      expect(result.violations[0].details.overlappingPositions).toEqual([
        8, 9, 10,
      ]);
    }
  });

  it('returns VALIDATION_UNAVAILABLE when structuredCondition missing (fail-closed)', () => {
    const ents = [
      makePickOwnership('a', 'LAL_2026_1st', [
        { year: 2026, condition: 'Top 10' }, // no structuredCondition
      ]),
      makePickOwnership('b', 'LAL_2026_1st', [
        {
          year: 2026,
          condition: '11-30',
          structuredCondition: { positionStart: 11, positionEnd: 30 },
        },
      ]),
    ];
    const result = validateProtectionPartition(ents);
    expect(result.status).toBe('VALIDATION_UNAVAILABLE');
  });

  it('ignores non-pick_ownership entitlements', () => {
    const ents = [
      { id: 'a', kind: 'swap_right', underlyingPickId: 'LAL_2026_1st' },
      { id: 'b', kind: 'swap_right', underlyingPickId: 'LAL_2026_1st' },
    ];
    const result = validateProtectionPartition(ents);
    expect(result.status).toBe('NOT_APPLICABLE');
  });
});

// =============================================================================
// Integration: exclusivity validator Rule #5
// =============================================================================

describe('Exclusivity Validator — Rule #5 (OVERLAP_PROTECTION_RANGE)', () => {
  it('passes for valid partition (Top 10 + 11–30 same underlier)', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('a', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: 'Top 10',
            structuredCondition: { positionStart: 1, positionEnd: 10 },
          },
        ]),
        makePickOwnership('b', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '11-30',
            structuredCondition: { positionStart: 11, positionEnd: 30 },
          },
        ]),
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('emits OVERLAP_PROTECTION_RANGE for Top 10 + 8–30 same underlier', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('a', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: 'Top 10',
            structuredCondition: { positionStart: 1, positionEnd: 10 },
          },
        ]),
        makePickOwnership('b', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '8-30',
            structuredCondition: { positionStart: 8, positionEnd: 30 },
          },
        ]),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('OVERLAP_PROTECTION_RANGE');
    expect(result.violations[0].underlyingPickIds).toEqual(['LAL_2026_1st']);
    expect(result.violations[0].details).toBeDefined();
  });

  it('falls back to DUP_PICK_OWNERSHIP_UNDERLIER when structuredCondition missing (fail-closed)', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('a', 'LAL_2026_1st'),
        makePickOwnership('b', 'LAL_2026_1st'),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_PICK_OWNERSHIP_UNDERLIER');
  });

  it('falls back to DUP when one entitlement has ladder but no structuredCondition', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('a', 'LAL_2026_1st', [
          { year: 2026, condition: 'Top 10' }, // no structuredCondition
        ]),
        makePickOwnership('b', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '11-30',
            structuredCondition: { positionStart: 11, positionEnd: 30 },
          },
        ]),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    // Fail-closed: without structuredCondition on both, falls back to DUP
    expect(result.violations[0].type).toBe('DUP_PICK_OWNERSHIP_UNDERLIER');
  });

  it('still detects other violation types alongside valid partitions', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        // Valid partition — no violation for this pair
        makePickOwnership('a', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: 'Top 10',
            structuredCondition: { positionStart: 1, positionEnd: 10 },
          },
        ]),
        makePickOwnership('b', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '11-30',
            structuredCondition: { positionStart: 11, positionEnd: 30 },
          },
        ]),
        // Duplicate swap — should still be caught
        {
          id: 'c',
          kind: 'swap_right',
          swapControllerPickId: 'BOS_2027_1st',
        },
        {
          id: 'd',
          kind: 'swap_right',
          swapControllerPickId: 'BOS_2027_1st',
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_SWAP_CONTROLLER');
  });

  it('handles self-edit exception with partition entitlements', () => {
    // Same id on both → self-edit, should pass
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('same-id', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: 'Top 10',
            structuredCondition: { positionStart: 1, positionEnd: 10 },
          },
        ]),
      ],
      candidate: {
        id: 'same-id',
        doc: makePickOwnership('same-id', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '8-30',
            structuredCondition: { positionStart: 8, positionEnd: 30 },
          },
        ]),
      },
    });
    expect(result.valid).toBe(true);
  });

  it('validates candidate against existing partition', () => {
    const result = validateEntitlementExclusivity({
      entitlements: [
        makePickOwnership('a', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: 'Top 10',
            structuredCondition: { positionStart: 1, positionEnd: 10 },
          },
        ]),
      ],
      candidate: {
        id: 'new',
        doc: makePickOwnership('new', 'LAL_2026_1st', [
          {
            year: 2026,
            condition: '5-30',
            structuredCondition: { positionStart: 5, positionEnd: 30 },
          },
        ]),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('OVERLAP_PROTECTION_RANGE');
  });
});
