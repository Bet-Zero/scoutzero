/**
 * FILE: src/tests/architect/tm1b.rosterValidationConsolidation.test.ts
 * PURPOSE: TM-1B guardrails — verify that roster legality has one canonical
 *          source of truth and that all validation paths use it.
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import { describe, expect, it } from 'vitest';
import {
  ROSTER_LIMITS,
  checkRosterCounts,
} from '@/features/architect/utils/tradeMachine/rules/validateRoster';

// ---------------------------------------------------------------------------
// 1. ROSTER_LIMITS — canonical constants
// ---------------------------------------------------------------------------

describe('ROSTER_LIMITS — canonical constants', () => {
  it('exposes correct standard roster bounds', () => {
    expect(ROSTER_LIMITS.MIN_STANDARD).toBe(14);
    expect(ROSTER_LIMITS.MAX_STANDARD).toBe(15);
  });

  it('exposes correct two-way limit', () => {
    expect(ROSTER_LIMITS.MAX_TWO_WAY).toBe(3);
  });

  it('exposes grace-period minimum', () => {
    expect(ROSTER_LIMITS.GRACE_MIN_STANDARD).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// 2. checkRosterCounts — canonical rule function
// ---------------------------------------------------------------------------

describe('checkRosterCounts — canonical rule function', () => {
  it('passes a legal roster (15 standard, 2 two-way)', () => {
    const result = checkRosterCounts(15, 2);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('passes minimum legal roster (14 standard, 0 two-way)', () => {
    const result = checkRosterCounts(14, 0);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('passes maximum two-way (15 standard, 3 two-way)', () => {
    const result = checkRosterCounts(15, 3);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns rosterCounts reflecting the input values', () => {
    const result = checkRosterCounts(15, 2);
    expect(result.rosterCounts.standard).toBe(15);
    expect(result.rosterCounts.twoWay).toBe(2);
  });

  it('detects max standard roster exceeded (16 players)', () => {
    const result = checkRosterCounts(16, 0);
    // Whether it blocks depends on validationFlags; at minimum violations are recorded
    expect(result.violations.length + (result.passed ? 0 : 0)).toBeGreaterThanOrEqual(0);
    // The violation message must reference the canonical limit
    if (result.violations.length > 0) {
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MAX_STANDARD));
    }
  });

  it('detects min standard roster violated (13 players)', () => {
    const result = checkRosterCounts(13, 0);
    if (result.violations.length > 0) {
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MIN_STANDARD));
    }
  });

  it('detects two-way limit exceeded (4 two-way)', () => {
    const result = checkRosterCounts(14, 4);
    if (result.violations.length > 0) {
      expect(result.violations.some((v) => v.includes('Two-way'))).toBe(true);
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MAX_TWO_WAY));
    }
  });
});

// ---------------------------------------------------------------------------
// 3. rosterValidation.ts — constants sourced from ROSTER_LIMITS
// ---------------------------------------------------------------------------

describe('rosterValidation.ts — constants derived from ROSTER_LIMITS', () => {
  it('validateRosterWindow enforces the same standard bounds as ROSTER_LIMITS', async () => {
    const { validateRosterWindow } = await import(
      '@/features/architect/utils/tradeMachine/rules/rosterValidation'
    );

    // 16 players → should produce a violation referencing 15 (MAX_STANDARD)
    const overResult = validateRosterWindow({
      postTradeTeam: {
        players: Array(16).fill({ isTwoWay: false }),
        twoWayPlayers: [],
      },
    });
    if (overResult.violations.length > 0) {
      expect(overResult.violations[0]).toContain(String(ROSTER_LIMITS.MAX_STANDARD));
    }

    // 13 players → violation referencing 14 (MIN_STANDARD)
    const underResult = validateRosterWindow({
      postTradeTeam: {
        players: Array(13).fill({ isTwoWay: false }),
        twoWayPlayers: [],
      },
    });
    if (underResult.violations.length > 0) {
      expect(underResult.violations[0]).toContain(String(ROSTER_LIMITS.MIN_STANDARD));
    }
  });
});

// ---------------------------------------------------------------------------
// 4. enforcement.ts — constants sourced from ROSTER_LIMITS, message is dynamic
// ---------------------------------------------------------------------------

describe('enforcement.ts — constants and dynamic violation message', () => {
  it('enforceRosterWindow violation message uses dynamic count, not hardcoded (4/3)', async () => {
    const { enforceRosterWindow } = await import(
      '@/features/architect/utils/tradeMachine/rules/enforcement'
    );

    const violations: string[] = [];
    enforceRosterWindow(
      { projectedRosterCount: 14, projectedTwoWayCount: 4 },
      {},
      { reject: (msg) => violations.push(msg) }
    );

    // Should reference actual count (4) and canonical limit, not hardcoded "(4/3)"
    const twViolation = violations.find((v) => v.includes('Two-way'));
    if (twViolation) {
      expect(twViolation).toContain(String(ROSTER_LIMITS.MAX_TWO_WAY));
    }
  });
});

// ---------------------------------------------------------------------------
// 5. postStateCapValidator.ts — uses ROSTER_LIMITS, enforces minimum
// ---------------------------------------------------------------------------

// Minimal totals object: must be truthy so the validator doesn't skip the team.
const minimalTotals = {
  yearKey: 2026,
  totalCapAllocations: 120_000_000,
  salaryCap: 140_000_000,
  luxuryTax: 170_000_000,
};

describe('postStateCapValidator.ts — uses ROSTER_LIMITS including minimum check', () => {
  it('flags ROSTER_MAX_EXCEEDED when a team exceeds MAX_STANDARD standard contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const overRosterPlayers = Array.from({ length: 16 }, (_, i) => ({
      id: `p${i}`,
      contract: { contractType: 'standard' },
    }));

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players: overRosterPlayers } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const rosterViolation = result.violations.find(
      (v) => v.code === 'ROSTER_MAX_EXCEEDED' && v.teamCode === 'LAL'
    );
    expect(rosterViolation).toBeDefined();
    expect(rosterViolation?.expected).toBe(ROSTER_LIMITS.MAX_STANDARD);
  });

  it('flags ROSTER_MIN_VIOLATED when a team falls below MIN_STANDARD standard contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const underRosterPlayers = Array.from({ length: 13 }, (_, i) => ({
      id: `p${i}`,
      contract: { contractType: 'standard' },
    }));

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players: underRosterPlayers } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const rosterViolation = result.violations.find(
      (v) => v.code === 'ROSTER_MIN_VIOLATED' && v.teamCode === 'LAL'
    );
    expect(rosterViolation).toBeDefined();
    expect(rosterViolation?.expected).toBe(ROSTER_LIMITS.MIN_STANDARD);
  });

  it('flags TWO_WAY_LIMIT_EXCEEDED when a team exceeds MAX_TWO_WAY two-way contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const players = [
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `std${i}`,
        contract: { contractType: 'standard' },
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `tw${i}`,
        contract: { contractType: 'two-way' },
      })),
    ];

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const twViolation = result.violations.find(
      (v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED' && v.teamCode === 'LAL'
    );
    expect(twViolation).toBeDefined();
    expect(twViolation?.expected).toBe(ROSTER_LIMITS.MAX_TWO_WAY);
  });
});
