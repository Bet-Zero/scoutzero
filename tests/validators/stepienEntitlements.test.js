/**
 * FILE: stepienEntitlements.test.js
 * PURPOSE: Tests for entitlement-aware Stepien validation (Phase 12.1)
 * OWNERSHIP: Trade Machine / Stepien Validation
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.1 - Stepien Entitlements Migration
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.1)
 *   - src/features/architect/utils/tradeMachine/rules/validateStepien.js
 *   - src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js
 */
import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';
import {
  buildStepienOutgoingPicksFromEntitlements,
  isPooledEntitlement,
  isStepienRelevantKind,
} from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js';

describe('stepienEntitlementUtils', () => {
  describe('isPooledEntitlement', () => {
    it('returns true for pooled entitlements', () => {
      expect(isPooledEntitlement({ underlyingStatus: 'pooled' })).toBe(true);
    });

    it('returns false for clean entitlements', () => {
      expect(isPooledEntitlement({ underlyingStatus: 'clean' })).toBe(false);
    });

    it('returns false for encumbered entitlements', () => {
      expect(isPooledEntitlement({ underlyingStatus: 'encumbered' })).toBe(
        false
      );
    });

    it('returns false when underlyingStatus is undefined', () => {
      expect(isPooledEntitlement({})).toBe(false);
    });
  });

  describe('isStepienRelevantKind', () => {
    it('returns true for pick_ownership', () => {
      expect(isStepienRelevantKind('pick_ownership')).toBe(true);
    });

    it('returns true for swap_right', () => {
      expect(isStepienRelevantKind('swap_right')).toBe(true);
    });

    it('returns true for conveyance_right', () => {
      expect(isStepienRelevantKind('conveyance_right')).toBe(true);
    });

    it('returns false for other kinds', () => {
      expect(isStepienRelevantKind('other')).toBe(false);
      expect(isStepienRelevantKind('')).toBe(false);
      expect(isStepienRelevantKind(undefined)).toBe(false);
    });
  });

  describe('buildStepienOutgoingPicksFromEntitlements', () => {
    it('returns empty array for empty input', () => {
      expect(buildStepienOutgoingPicksFromEntitlements([])).toEqual([]);
      expect(buildStepienOutgoingPicksFromEntitlements(null)).toEqual([]);
      expect(buildStepienOutgoingPicksFromEntitlements(undefined)).toEqual([]);
    });

    it('converts round-1 pick_ownership to pick-like object', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'pick_ownership',
          round: 1,
          seasonYear: 2027,
          underlyingStatus: 'clean',
        },
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        year: 2027,
        round: 1,
        isSwap: false,
        _source: 'entitlement',
        _entitlementKind: 'pick_ownership',
      });
    });

    it('converts swap_right to isSwap=true pick-like object', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'swap_right',
          round: 1,
          seasonYear: 2028,
          underlyingStatus: 'clean',
        },
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        year: 2028,
        round: 1,
        isSwap: true,
        swapType: 'best_of',
        _source: 'entitlement',
        _entitlementKind: 'swap_right',
      });
    });

    it('converts conveyance_right to pick-like object (reserves year)', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'conveyance_right',
          round: 1,
          seasonYear: 2029,
          underlyingStatus: 'encumbered',
        },
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        year: 2029,
        round: 1,
        isSwap: false,
        _source: 'entitlement',
        _entitlementKind: 'conveyance_right',
      });
    });

    it('filters out pooled entitlements', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'pick_ownership',
          round: 1,
          seasonYear: 2027,
          underlyingStatus: 'pooled',
        },
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(0);
    });

    it('filters out round 2 entitlements', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'pick_ownership',
          round: 2,
          seasonYear: 2027,
          underlyingStatus: 'clean',
        },
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(0);
    });

    it('handles multiple entitlements correctly', () => {
      const entitlements = [
        {
          id: 'e1',
          kind: 'pick_ownership',
          round: 1,
          seasonYear: 2027,
          underlyingStatus: 'clean',
        },
        {
          id: 'e2',
          kind: 'swap_right',
          round: 1,
          seasonYear: 2028,
          underlyingStatus: 'encumbered',
        },
        {
          id: 'e3',
          kind: 'pick_ownership',
          round: 1,
          seasonYear: 2029,
          underlyingStatus: 'pooled',
        }, // Should be filtered
        {
          id: 'e4',
          kind: 'conveyance_right',
          round: 2,
          seasonYear: 2030,
          underlyingStatus: 'clean',
        }, // Should be filtered (round 2)
      ];
      const result = buildStepienOutgoingPicksFromEntitlements(entitlements);
      expect(result).toHaveLength(2);
      expect(result[0]._entitlementId).toBe('e1');
      expect(result[1]._entitlementId).toBe('e2');
    });
  });
});

describe('validateStepien - Entitlements Integration', () => {
  const makeTeam = (params) => ({
    teamId: 'TEST',
    teamCode: 'TEST',
    team: {
      picks: [],
    },
    context: {
      yearKey: 2025,
    },
    outgoingPicks: [],
    draftPicksObligations: [],
    entitlementsOut: [],
    ...params,
  });

  describe('pick_ownership entitlements', () => {
    it('round-1 pick_ownership entitlement reserves year', () => {
      // Single entitlement doesn't cause violation
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
      expect(result._debug.entitlementsConsidered).toBe(1);
    });

    it('consecutive pick_ownership entitlements cause Stepien violation', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'clean',
            },
            {
              id: 'e2',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });
  });

  describe('swap_right entitlements', () => {
    it('round-1 swap_right entitlement reserves year', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'swap_right',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
      expect(result._debug.entitlementsConsidered).toBe(1);
    });

    it('swap_right + adjacent pick_ownership causes Stepien violation', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'swap_right',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'clean',
            },
            {
              id: 'e2',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });
  });

  describe('conveyance_right entitlements', () => {
    it('round-1 conveyance_right entitlement reserves year', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'conveyance_right',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'encumbered',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
      expect(result._debug.entitlementsConsidered).toBe(1);
    });

    it('conveyance_right + adjacent entitlement causes Stepien violation', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'conveyance_right',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'encumbered',
            },
            {
              id: 'e2',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });
  });

  describe('pooled entitlements do NOT reserve year', () => {
    it('pooled pick_ownership does not cause consecutive violation', () => {
      // 2027 is pooled (doesn't reserve), 2028 is clean (reserves)
      // Only 2028 is Stepien-relevant → single pick → passes
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'pooled',
            },
            {
              id: 'e2',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
      expect(result._debug.entitlementsConsidered).toBe(1); // Only 2028 counted
    });

    it('all pooled entitlements result in empty Stepien consideration', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2027,
              underlyingStatus: 'pooled',
            },
            {
              id: 'e2',
              kind: 'swap_right',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'pooled',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
      // When all entitlements are pooled, they get filtered out
      // Phase 12.2: No early return, returns "Stepien Rule compliant" instead
      expect(result.message).toBe('Stepien Rule compliant');
    });
  });

  describe('entitlements + legacy picks interop', () => {
    it('entitlement + legacy outgoingPick on consecutive years causes violation', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2027, round: '1st' }],
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
      expect(result._debug.tradePicksConsidered).toBe(1);
      expect(result._debug.entitlementsConsidered).toBe(1);
    });

    it('entitlement + obligation on consecutive years causes violation', () => {
      const result = validateStepien(
        makeTeam({
          draftPicksObligations: [{ year: 2027, round: 1, status: 'outgoing' }],
          entitlementsOut: [
            {
              id: 'e1',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2028,
              underlyingStatus: 'clean',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
      // Phase 12.2: baselineYearsCount includes obligations in legacy mode
      expect(result._debug.baselineYearsCount).toBe(1);
      expect(result._debug.entitlementsConsidered).toBe(1);
    });
  });

  describe('backward compatibility - legacy picksOut still works', () => {
    it('legacy consecutive picks still cause violation', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2027, round: '1st' },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('legacy non-consecutive picks pass', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2028, round: '1st' },
          ],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('legacy protected consecutive picks pass', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2027, round: '1st', protection: 'Top 5' },
          ],
        })
      );
      expect(result.passed).toBe(true);
    });
  });
});
