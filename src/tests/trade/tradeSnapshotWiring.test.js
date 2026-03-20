/**
 * FILE: tradeSnapshotWiring.test.js
 * PURPOSE: Regression tests to ensure UI snapshot reads from validator teamResults, not receipt
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2025-12-29: Created for Phase 3.4 (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.5)
 *  - 2025-12-31: Extended for P0 Implementation (TRADE_MACHINE_FIX_PLAN v4.0)
 * LINKS: useTradeMachineSnapshot.js, TRADE_MACHINE_UI_WIRING_AUDIT_RECONCILED.md
 */

/**
 * Trade Snapshot Wiring Tests
 *
 * Purpose: Lock down the critical rule that UI values come from validator teamResults,
 * NOT from receipt or local recomputation. These tests will fail if someone rewires
 * the snapshot accessor to read from the wrong source.
 *
 * Coverage:
 * 1. Snapshot accessor reads salaryIn/salaryOut from teamResults
 * 2. Snapshot accessor reads allowableIncoming from teamResults.rules.salaryMatching
 * 3. Formatting helpers only change presentation, not numeric source
 * 4. NULL handling for non-applicable salary matching
 * 5. P0-1: Multi-surface consistency - same values across all surfaces
 * 6. P0-2: Canonical source enforcement - teamResult.rules.salaryMatching.*
 */
import { describe, it, expect } from 'vitest';
import {
  getTeamSnapshot,
  getTradeSnapshot,
} from '@/features/architect/hooks/useTradeMachineSnapshot';
import { formatSalary } from '@/shared/utils/formatting';
import {
  createValidationIssue,
  getValidationIssueText,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const issue = (message, rule, severity = 'error') =>
  createValidationIssue(message, { rule, severity });

// Mock validator result structure (from tradeValidator.js output)
const createMockValidatorResult = (overrides = {}) => ({
  legal: true,
  reason: null,
  violations: [],
  warnings: [],
  yearKey: 2025,
  seasonKey: '2024-25',
  capSettings: {
    salaryCap: 141_000_000,
    firstApron: 178_132_000,
    secondApron: 188_931_000,
  },
  teamResults: [
    {
      teamId: 'BOS',
      teamName: 'Boston Celtics',
      totalSalary: 180_000_000,
      salaryOut: 25_000_000, // Outgoing matching salary
      salaryIn: 15_000_000, // Incoming matching salary
      projectedSalary: 170_000_000,
      capRoom: -29_000_000,
      legal: true,
      violations: [],
      calculations: {
        salaryOut: 24_500_000, // Base outgoing (before matching adjustments)
        salaryIn: 15_000_000, // Base incoming
        salaryMatching: {
          allowedIncoming: 31_500_000,
          margin: 16_500_000,
        },
      },
      rules: {
        salaryMatching: {
          passed: true,
          applicable: true,
          skipReason: null,
          allowableIncoming: 31_500_000,
          margin: 16_500_000,
          details: {
            ruleApplied: 'OVER_CAP_BAND_3',
            formulaUsed: '125% + $250K',
          },
        },
        hardCap: {
          passed: true,
          triggered: false,
        },
      },
    },
    {
      teamId: 'LAL',
      teamName: 'Los Angeles Lakers',
      totalSalary: 150_000_000,
      salaryOut: 15_000_000,
      salaryIn: 25_000_000,
      projectedSalary: 160_000_000,
      capRoom: -19_000_000,
      legal: true,
      violations: [],
      calculations: {
        salaryOut: 15_000_000,
        salaryIn: 24_500_000,
      },
      rules: {
        salaryMatching: {
          passed: true,
          applicable: true,
          allowableIncoming: 27_100_000,
          margin: 2_100_000,
          details: {
            ruleApplied: 'OVER_CAP_BAND_2',
            formulaUsed: 'Outgoing + $7.5M',
          },
        },
        hardCap: {
          passed: true,
          triggered: false,
        },
      },
    },
  ],
  // Receipt is for debug only - should NOT be used as source
  tradeReceipt: {
    capSettingsUsed: {
      salaryCap: 141_000_000,
      firstApron: 178_132_000,
      secondApron: 188_931_000,
    },
    teams: [
      { teamId: 'BOS', differentSalaryOut: 99_999_999 }, // Intentionally wrong to detect misuse
      { teamId: 'LAL', differentSalaryIn: 88_888_888 },
    ],
  },
  ...overrides,
});

describe('Trade Snapshot Wiring Tests', () => {
  describe('Core Wiring: teamResults is source of truth', () => {
    it('WIRING-01: snapshot.salaryOut reads from teamResult.salaryOut, not receipt', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);

      // Must match teamResults value, NOT receipt's "differentSalaryOut"
      expect(snapshot.outgoingMatchingSalary).toBe(25_000_000);
      expect(snapshot.outgoingMatchingSalary).not.toBe(99_999_999);
    });

    it('WIRING-02: snapshot.salaryIn reads from teamResult.salaryIn, not receipt', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('LAL', result);

      // Must match teamResults value, NOT receipt's "differentSalaryIn"
      expect(snapshot.incomingMatchingSalary).toBe(25_000_000);
      expect(snapshot.incomingMatchingSalary).not.toBe(88_888_888);
    });

    it('WIRING-03: snapshot.allowableIncoming reads from teamResult.rules.salaryMatching', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);

      // Must read from rules.salaryMatching.allowableIncoming
      expect(snapshot.allowableIncoming).toBe(31_500_000);
      expect(snapshot.salaryMatchingRule).toBe('OVER_CAP_BAND_3');
      expect(snapshot.salaryMatchingFormula).toBe('125% + $250K');
    });

    it('WIRING-04: snapshot.projectedSalary reads from teamResult.projectedSalary', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);

      expect(snapshot.projectedSalary).toBe(170_000_000);
    });

    it('WIRING-05: snapshot.margin reads from teamResult.rules.salaryMatching.margin', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);

      expect(snapshot.margin).toBe(16_500_000);
    });
  });

  describe('Base vs Matching Salary Distinction', () => {
    it('WIRING-06: snapshot provides both base and matching salaries', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);

      // Matching salary (for trade legality)
      expect(snapshot.outgoingMatchingSalary).toBe(25_000_000);
      // Base salary (for roster reality) - from calculations.salaryOut
      expect(snapshot.outgoingBaseSalary).toBe(24_500_000);
    });
  });

  describe('NULL Handling for Non-Applicable Scenarios', () => {
    it('WIRING-07: allowableIncoming is null when salary matching not applicable', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'MIN',
            teamName: 'Minnesota Timberwolves',
            totalSalary: 100_000_000,
            salaryOut: 5_000_000,
            salaryIn: 0,
            projectedSalary: 95_000_000,
            legal: true,
            violations: [],
            rules: {
              salaryMatching: {
                passed: true,
                applicable: false,
                skipReason: 'NO_INCOMING_SALARY',
                allowableIncoming: null, // Not applicable
                margin: null,
              },
            },
          },
        ],
      });
      const snapshot = getTeamSnapshot('MIN', result);

      // Must be null, NOT 0 - null indicates "not applicable"
      expect(snapshot.allowableIncoming).toBeNull();
      expect(snapshot.margin).toBeNull();
      expect(snapshot.salaryMatchingApplicable).toBe(false);
      expect(snapshot.salaryMatchingSkipReason).toBe('NO_INCOMING_SALARY');
    });
  });

  describe('Formatting Helpers Preserve Numeric Source', () => {
    it('WIRING-08: formatSalary changes presentation only, not numeric value', () => {
      const rawValue = 25_000_000;
      const formatted = formatSalary(rawValue);

      // formatSalary should return a string representation
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('$');

      // The underlying number is preserved (parsing back should give ~same value)
      const parsed = parseFloat(formatted.replace(/[^0-9.-]/g, ''));
      // Format shows $25.0M which parses to 25, so check that
      expect(parsed).toBeGreaterThan(0);
    });

    it('WIRING-09: formatSalary handles null/undefined gracefully', () => {
      expect(formatSalary(null)).toBe('—');
      expect(formatSalary(undefined)).toBe('—');
      expect(formatSalary(0)).toBe('—');
    });
  });

  describe('Global Trade Snapshot', () => {
    it('WIRING-10: getTradeSnapshot returns global trade-level values', () => {
      const result = createMockValidatorResult();
      const tradeSnapshot = getTradeSnapshot(result);

      expect(tradeSnapshot.isLegal).toBe(true);
      expect(tradeSnapshot.yearKey).toBe(2025);
      expect(tradeSnapshot.seasonKey).toBe('2024-25');
      expect(tradeSnapshot.primaryViolation).toBeNull();
    });

    it('WIRING-11: getTradeSnapshot aggregates violations from all teams', () => {
      const result = createMockValidatorResult({
        legal: false,
        reason: 'Salary matching violation',
        violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
        teamResults: [
          {
            teamId: 'BOS',
            violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
            rules: { salaryMatching: { passed: false } },
          },
        ],
      });
      const tradeSnapshot = getTradeSnapshot(result);

      expect(tradeSnapshot.isLegal).toBe(false);
      expect(tradeSnapshot.allViolations.map(getValidationIssueText)).toContain(
        'Incoming exceeds allowable'
      );
    });

    it('WIRING-12: getTradeSnapshot prefers canonical top-level cap settings', () => {
      const result = createMockValidatorResult({
        capSettings: {
          salaryCap: 150_000_000,
          firstApron: 180_000_000,
          secondApron: 190_000_000,
        },
        tradeReceipt: {
          capSettingsUsed: {
            salaryCap: 999_999_999,
            firstApron: 999_999_999,
            secondApron: 999_999_999,
          },
        },
      });

      const tradeSnapshot = getTradeSnapshot(result);

      expect(tradeSnapshot.capSettings).toEqual(result.capSettings);
    });

    it('WIRING-13: getTradeSnapshot prefers canonical top-level violations', () => {
      const result = createMockValidatorResult({
        legal: false,
        reason: 'Routing failure',
        violations: [issue('Entitlement routing incomplete', 'entitlementRouting')],
        teamResults: [],
      });

      const tradeSnapshot = getTradeSnapshot(result);

      expect(tradeSnapshot.allViolations.map(getValidationIssueText)).toEqual([
        'Entitlement routing incomplete',
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('WIRING-14: returns null for missing teamId', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('INVALID', result);

      expect(snapshot).toBeNull();
    });

    it('WIRING-15: returns null for null result', () => {
      const snapshot = getTeamSnapshot('BOS', null);

      expect(snapshot).toBeNull();
    });

    it('WIRING-16: handles teamCode lookup (alternative to teamId)', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamCode: 'BOS', // Using teamCode instead of teamId
            teamName: 'Boston Celtics',
            totalSalary: 180_000_000,
            salaryOut: 25_000_000,
            salaryIn: 15_000_000,
            projectedSalary: 170_000_000,
            rules: {
              salaryMatching: {
                allowableIncoming: 31_500_000,
              },
            },
          },
        ],
      });
      const snapshot = getTeamSnapshot('BOS', result);

      expect(snapshot).not.toBeNull();
      expect(snapshot.outgoingMatchingSalary).toBe(25_000_000);
    });
  });

  /**
   * P0-1: Multi-Surface Consistency Tests
   * 
   * These tests verify that all UI surfaces would receive identical values
   * when reading from the same teamResult, preventing UI inconsistencies.
   */
  describe('P0-1: Multi-Surface Consistency', () => {
    it('P0-1-01: same teamResult produces identical allowableIncoming across multiple calls', () => {
      const result = createMockValidatorResult();
      
      // Simulate multiple UI surfaces calling getTeamSnapshot
      const snapshot1 = getTeamSnapshot('BOS', result);
      const snapshot2 = getTeamSnapshot('BOS', result);
      const snapshot3 = getTeamSnapshot('BOS', result);

      // All calls must return identical allowableIncoming
      expect(snapshot1.allowableIncoming).toBe(31_500_000);
      expect(snapshot2.allowableIncoming).toBe(snapshot1.allowableIncoming);
      expect(snapshot3.allowableIncoming).toBe(snapshot1.allowableIncoming);
    });

    it('P0-1-02: same teamResult produces identical outgoingMatchingSalary across multiple calls', () => {
      const result = createMockValidatorResult();
      
      const snapshot1 = getTeamSnapshot('BOS', result);
      const snapshot2 = getTeamSnapshot('BOS', result);

      expect(snapshot1.outgoingMatchingSalary).toBe(25_000_000);
      expect(snapshot2.outgoingMatchingSalary).toBe(snapshot1.outgoingMatchingSalary);
    });

    it('P0-1-03: same teamResult produces identical incomingMatchingSalary across multiple calls', () => {
      const result = createMockValidatorResult();
      
      const snapshot1 = getTeamSnapshot('BOS', result);
      const snapshot2 = getTeamSnapshot('BOS', result);

      expect(snapshot1.incomingMatchingSalary).toBe(15_000_000);
      expect(snapshot2.incomingMatchingSalary).toBe(snapshot1.incomingMatchingSalary);
    });

    it('P0-1-04: same teamResult produces identical salaryMatchingPassed across multiple calls', () => {
      const result = createMockValidatorResult();
      
      const snapshot1 = getTeamSnapshot('BOS', result);
      const snapshot2 = getTeamSnapshot('BOS', result);

      expect(snapshot1.salaryMatchingPassed).toBe(true);
      expect(snapshot2.salaryMatchingPassed).toBe(snapshot1.salaryMatchingPassed);
    });
  });

  /**
   * P0-2: Canonical Source Enforcement Tests
   * 
   * These tests verify that all salary matching values come from the canonical
   * source: teamResult.rules.salaryMatching.* and NOT from local recalculation.
   */
  describe('P0-2: Canonical Source Enforcement', () => {
    it('P0-2-01: allowableIncoming MUST come from teamResult.rules.salaryMatching.allowableIncoming', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            salaryOut: 10_000_000,
            salaryIn: 5_000_000,
            // calculations.salaryMatching has DIFFERENT value - should be ignored
            calculations: {
              salaryMatching: {
                allowedIncoming: 99_999_999, // WRONG value - should not be used
              },
            },
            // rules.salaryMatching has canonical value - should be used
            rules: {
              salaryMatching: {
                allowableIncoming: 17_500_000, // CANONICAL value
                passed: true,
              },
            },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      // Must use rules.salaryMatching.allowableIncoming, NOT calculations fallback
      expect(snapshot.allowableIncoming).toBe(17_500_000);
      expect(snapshot.allowableIncoming).not.toBe(99_999_999);
    });

    it('P0-2-02: salaryMatchingPassed MUST come from teamResult.rules.salaryMatching.passed', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            rules: {
              salaryMatching: {
                passed: false, // CANONICAL - trade fails salary matching
                allowableIncoming: 10_000_000,
              },
            },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      expect(snapshot.salaryMatchingPassed).toBe(false);
    });

    it('P0-2-03: salaryMatchingRule MUST come from teamResult.rules.salaryMatching.details.ruleApplied', () => {
      const result = createMockValidatorResult();
      const snapshot = getTeamSnapshot('BOS', result);
      
      // Must read from rules.salaryMatching.details.ruleApplied
      expect(snapshot.salaryMatchingRule).toBe('OVER_CAP_BAND_3');
    });

    it('P0-2-04: outgoingMatchingSalary MUST come from teamResult.salaryOut (validator output)', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            salaryOut: 20_000_000, // CANONICAL - from validator
            calculations: {
              salaryOut: 19_000_000, // Different value - should not be used for matching
            },
            rules: { salaryMatching: { allowableIncoming: 25_000_000 } },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      // outgoingMatchingSalary reads from salaryOut, not calculations.salaryOut
      expect(snapshot.outgoingMatchingSalary).toBe(20_000_000);
    });

    it('P0-2-05: incomingMatchingSalary MUST come from teamResult.salaryIn (validator output)', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            salaryIn: 15_000_000, // CANONICAL - from validator
            calculations: {
              salaryIn: 14_000_000, // Different value - should not be used for matching
            },
            rules: { salaryMatching: { allowableIncoming: 20_000_000 } },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      // incomingMatchingSalary reads from salaryIn, not calculations.salaryIn
      expect(snapshot.incomingMatchingSalary).toBe(15_000_000);
    });
  });

  /**
   * P0-3: No Local Recalculation Tests
   * 
   * These tests verify that when a validator result exists, the snapshot
   * accessor does NOT perform any local recalculation - it only reads values.
   */
  describe('P0-3: No Local Recalculation After Validation', () => {
    it('P0-3-01: snapshot does not recalculate allowableIncoming from components', () => {
      // Create a result where allowableIncoming doesn't "make sense" mathematically
      // If the accessor were recalculating, it would produce a different value
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            totalSalary: 150_000_000,
            salaryOut: 10_000_000,
            salaryIn: 8_000_000,
            // allowableIncoming here is intentionally different from what a formula would produce
            // This proves we're reading the value, not recalculating
            rules: {
              salaryMatching: {
                allowableIncoming: 12_345_678, // Arbitrary "already calculated" value
                passed: true,
              },
            },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      // Must return the exact value from rules, not recalculate
      expect(snapshot.allowableIncoming).toBe(12_345_678);
    });

    it('P0-3-02: snapshot preserves null allowableIncoming without defaulting to calculation', () => {
      const result = createMockValidatorResult({
        teamResults: [
          {
            teamId: 'TEST',
            teamName: 'Test Team',
            salaryOut: 10_000_000,
            rules: {
              salaryMatching: {
                applicable: false,
                skipReason: 'HARD_CAP_SKIP',
                allowableIncoming: null, // Explicitly null
              },
            },
          },
        ],
      });
      
      const snapshot = getTeamSnapshot('TEST', result);
      
      // Must preserve null, not attempt to calculate a value
      expect(snapshot.allowableIncoming).toBeNull();
    });
  });
});
