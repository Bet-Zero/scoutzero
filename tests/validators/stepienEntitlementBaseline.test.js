/**
 * FILE: stepienEntitlementBaseline.test.js
 * PURPOSE: Tests for entitlement-based Stepien baseline (Phase 12.2)
 * OWNERSHIP: Trade Machine / Stepien Validation
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.2 - Stepien Entitlement Baseline Migration
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.2)
 *   - src/features/architect/utils/tradeMachine/rules/validateStepien.js
 *   - src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils
 */
import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';
import { buildStepienBaselinePicksFromEntitlements } from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils';

/**
 * Test helper: Creates a team object for Stepien validation
 */
const makeTeam = (params) => ({
  teamId: 'TEST',
  teamCode: 'TEST',
  team: { picks: [] },
  context: { yearKey: 2025 },
  outgoingPicks: [],
  picksOut: [],
  draftPicksObligations: [],
  entitlementsOut: [],
  validationEntitlements: [],
  ...params,
});

/**
 * Test helper: Creates a mock entitlement
 */
const makeEntitlement = (params) => ({
  id: `ent-${params.seasonYear || 2026}-${params.kind || 'pick_ownership'}`,
  kind: 'pick_ownership',
  round: 1,
  seasonYear: 2026,
  underlyingStatus: 'clean',
  ...params,
});

describe('buildStepienBaselinePicksFromEntitlements', () => {
  it('returns empty array for empty input', () => {
    expect(buildStepienBaselinePicksFromEntitlements([])).toEqual([]);
    expect(buildStepienBaselinePicksFromEntitlements(null)).toEqual([]);
    expect(buildStepienBaselinePicksFromEntitlements(undefined)).toEqual([]);
  });

  it('converts pick_ownership to baseline pick', () => {
    const entitlements = [
      makeEntitlement({ kind: 'pick_ownership', seasonYear: 2027 }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      year: 2027,
      round: 1,
      isSwap: false,
      _source: 'entitlement_baseline',
      _kind: 'pick_ownership',
    });
  });

  it('converts swap_right to baseline pick with isSwap=true', () => {
    const entitlements = [
      makeEntitlement({ kind: 'swap_right', seasonYear: 2028 }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      year: 2028,
      round: 1,
      isSwap: true,
      swapType: 'best_of',
      _source: 'entitlement_baseline',
    });
  });

  it('converts conveyance_right to baseline pick', () => {
    const entitlements = [
      makeEntitlement({ kind: 'conveyance_right', seasonYear: 2029 }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      year: 2029,
      round: 1,
      isSwap: false,
      _source: 'entitlement_baseline',
    });
  });

  it('filters out pooled entitlements', () => {
    const entitlements = [
      makeEntitlement({
        kind: 'pick_ownership',
        seasonYear: 2027,
        underlyingStatus: 'pooled',
      }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(0);
  });

  it('filters out round 2 entitlements', () => {
    const entitlements = [
      makeEntitlement({ kind: 'pick_ownership', seasonYear: 2027, round: 2 }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(0);
  });

  it('includes encumbered entitlements (non-pooled)', () => {
    const entitlements = [
      makeEntitlement({
        kind: 'pick_ownership',
        seasonYear: 2027,
        underlyingStatus: 'encumbered',
      }),
    ];
    const result = buildStepienBaselinePicksFromEntitlements(entitlements);
    expect(result).toHaveLength(1);
  });
});

describe('validateStepien with entitlement baseline', () => {
  describe('baseline from validationEntitlements', () => {
    it('uses entitlement baseline when validationEntitlements is non-empty', () => {
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2027 }),
        ],
        entitlementsOut: [],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(true);
      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      expect(result._debug.baselineYearsCount).toBe(2);
    });

    it('fails when baseline reserves year N and trade adds outgoing N+1 (regression)', () => {
      const team = makeTeam({
        validationEntitlements: [makeEntitlement({ seasonYear: 2027 })],
        entitlementsOut: [makeEntitlement({ seasonYear: 2028 })],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Violates Stepien Rule (consecutive future 1sts).'
      );
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
    });

    it('outgoing entitlement causes consecutive violation when combined with another', () => {
      // Team holds 2026, 2027, 2028 entitlements
      // Trading away 2026 and 2027 creates consecutive outgoing years
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2027 }),
          makeEntitlement({ seasonYear: 2028 }),
        ],
        entitlementsOut: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2027 }),
        ],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Violates Stepien Rule (consecutive future 1sts).'
      );
      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
    });

    it('non-consecutive outgoing can still fail when baseline creates adjacent reservation', () => {
      // Team holds 2026, 2027, 2028 entitlements
      // Trading away 2026 and 2028 (non-consecutive) is OK
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2027 }),
          makeEntitlement({ seasonYear: 2028 }),
        ],
        entitlementsOut: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2028 }),
        ],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Violates Stepien Rule (consecutive future 1sts).'
      );
      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
    });

    it('pooled entitlements in validationEntitlements do NOT reserve year', () => {
      // Team "holds" 2026 (pooled) and 2027 (clean)
      // Pooled should not count toward baseline
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026, underlyingStatus: 'pooled' }),
          makeEntitlement({ seasonYear: 2027, underlyingStatus: 'clean' }),
        ],
        entitlementsOut: [],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(true);
      // Only 1 baseline year (pooled filtered out)
      expect(result._debug.baselineYearsCount).toBe(1);
    });

    it('swap_right in validationEntitlements reserves year', () => {
      // Team holds swap right for 2027
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ kind: 'swap_right', seasonYear: 2027 }),
        ],
        entitlementsOut: [],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(true);
      expect(result._debug.baselineYearsCount).toBe(1);
    });
  });

  /**
   * Phase 13: Legacy fallback has been REMOVED.
   *
   * Previously: When validationEntitlements was empty, code would fall back to
   * draftPicksObligations for baseline.
   *
   * Now: draftPicksObligations is IGNORED. If validationEntitlements is empty,
   * baseline is empty (team has full pick inventory). Only outgoing picks/entitlements
   * are considered for Stepien validation.
   *
   * These tests are updated to reflect the new SSOT behavior.
   */
  describe('Phase 13 SSOT: no legacy fallback', () => {
    it('does NOT read draftPicksObligations when validationEntitlements is empty', () => {
      const team = makeTeam({
        validationEntitlements: [], // Empty - Phase 13: baseline is empty, not legacy
        draftPicksObligations: [
          { year: 2026, round: 1, status: 'outgoing' },
          { year: 2027, round: 1, status: 'outgoing' },
        ],
        outgoingPicks: [{ year: 2028, round: '1st' }],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      // Phase 13: With only 1 outgoing year (2028 legacy pick), no consecutive violation
      // draftPicksObligations is IGNORED
      expect(result._debug.baselineYearsCount).toBe(0);
      expect(result.passed).toBe(true); // Only 2028 outgoing, no consecutive
    });

    it('consecutive outgoingPicks still cause violation (no baseline needed)', () => {
      const team = makeTeam({
        validationEntitlements: [],
        draftPicksObligations: [],
        outgoingPicks: [
          { year: 2026, round: '1st' },
          { year: 2027, round: '1st' },
        ],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      expect(result.passed).toBe(false); // 2026, 2027 consecutive outgoing
    });

    it('non-consecutive outgoingPicks pass (no baseline needed)', () => {
      const team = makeTeam({
        validationEntitlements: [],
        draftPicksObligations: [],
        outgoingPicks: [
          { year: 2026, round: '1st' },
          { year: 2028, round: '1st' },
        ],
      });

      const result = validateStepien(team, { yearKey: 2025 });

      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      expect(result.passed).toBe(true); // Non-consecutive OK
    });
  });

  describe('mixed sources (entitlements + legacy picks)', () => {
    it('combines entitlementsOut with legacy picksOut for outgoing', () => {
      // Team uses entitlement baseline but also has legacy picks in trade
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2027 }),
          makeEntitlement({ seasonYear: 2028 }),
        ],
        entitlementsOut: [makeEntitlement({ seasonYear: 2026 })],
        outgoingPicks: [{ year: 2027, round: '1st' }], // Legacy pick also being traded
      });

      const result = validateStepien(team, { yearKey: 2025 });

      // Phase 13: baselineSource is always 'entitlements_ssot'
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      // 2026 (entitlement) + 2027 (legacy pick) = consecutive violation
      expect(result.passed).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty team gracefully', () => {
      const team = makeTeam({});
      const result = validateStepien(team, { yearKey: 2025 });
      expect(result.passed).toBe(true);
    });

    it('single entitlement being traded passes', () => {
      const team = makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2026 }),
          makeEntitlement({ seasonYear: 2028 }),
        ],
        entitlementsOut: [makeEntitlement({ seasonYear: 2026 })],
      });

      const result = validateStepien(team, { yearKey: 2025 });
      expect(result.passed).toBe(true);
    });

    it('7-year limit check still works with entitlement baseline', () => {
      const team = makeTeam({
        validationEntitlements: [makeEntitlement({ seasonYear: 2035 })],
        outgoingPicks: [{ year: 2035, round: '1st' }], // 10 years out
      });

      const result = validateStepien(team, { yearKey: 2025 });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('7 years out'))).toBe(
        true
      );
    });
  });
});
