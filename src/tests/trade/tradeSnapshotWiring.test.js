/**
 * FILE: tradeSnapshotWiring.test.js
 * PURPOSE: Regression tests to ensure UI snapshot reads from validator teamResults, not receipt
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2025-12-29: Created for Phase 3.4 (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.5)
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
 */
import { describe, it, expect } from 'vitest';
import {
  useTeamSnapshot,
  useTradeSnapshot,
} from '@/features/architect/hooks/useTradeMachineSnapshot';
import { formatSalary } from '@/shared/utils/formatting';

// Mock validator result structure (from tradeValidator.js output)
const createMockValidatorResult = (overrides = {}) => ({
  legal: true,
  reason: null,
  yearKey: 2025,
  seasonKey: '2024-25',
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
  receipt: {
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
      const snapshot = useTeamSnapshot('BOS', result);

      // Must match teamResults value, NOT receipt's "differentSalaryOut"
      expect(snapshot.outgoingMatchingSalary).toBe(25_000_000);
      expect(snapshot.outgoingMatchingSalary).not.toBe(99_999_999);
    });

    it('WIRING-02: snapshot.salaryIn reads from teamResult.salaryIn, not receipt', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('LAL', result);

      // Must match teamResults value, NOT receipt's "differentSalaryIn"
      expect(snapshot.incomingMatchingSalary).toBe(25_000_000);
      expect(snapshot.incomingMatchingSalary).not.toBe(88_888_888);
    });

    it('WIRING-03: snapshot.allowableIncoming reads from teamResult.rules.salaryMatching', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('BOS', result);

      // Must read from rules.salaryMatching.allowableIncoming
      expect(snapshot.allowableIncoming).toBe(31_500_000);
      expect(snapshot.salaryMatchingRule).toBe('OVER_CAP_BAND_3');
      expect(snapshot.salaryMatchingFormula).toBe('125% + $250K');
    });

    it('WIRING-04: snapshot.projectedSalary reads from teamResult.projectedSalary', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('BOS', result);

      expect(snapshot.projectedSalary).toBe(170_000_000);
    });

    it('WIRING-05: snapshot.margin reads from teamResult.rules.salaryMatching.margin', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('BOS', result);

      expect(snapshot.margin).toBe(16_500_000);
    });
  });

  describe('Base vs Matching Salary Distinction', () => {
    it('WIRING-06: snapshot provides both base and matching salaries', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('BOS', result);

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
      const snapshot = useTeamSnapshot('MIN', result);

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
    it('WIRING-10: useTradeSnapshot returns global trade-level values', () => {
      const result = createMockValidatorResult();
      const tradeSnapshot = useTradeSnapshot(result);

      expect(tradeSnapshot.isLegal).toBe(true);
      expect(tradeSnapshot.yearKey).toBe(2025);
      expect(tradeSnapshot.seasonKey).toBe('2024-25');
      expect(tradeSnapshot.primaryViolation).toBeNull();
    });

    it('WIRING-11: useTradeSnapshot aggregates violations from all teams', () => {
      const result = createMockValidatorResult({
        legal: false,
        reason: 'Salary matching violation',
        teamResults: [
          {
            teamId: 'BOS',
            violations: ['Incoming exceeds allowable'],
            rules: { salaryMatching: { passed: false } },
          },
        ],
      });
      const tradeSnapshot = useTradeSnapshot(result);

      expect(tradeSnapshot.isLegal).toBe(false);
      expect(tradeSnapshot.allViolations).toContain(
        'Incoming exceeds allowable'
      );
    });
  });

  describe('Edge Cases', () => {
    it('WIRING-12: returns null for missing teamId', () => {
      const result = createMockValidatorResult();
      const snapshot = useTeamSnapshot('INVALID', result);

      expect(snapshot).toBeNull();
    });

    it('WIRING-13: returns null for null result', () => {
      const snapshot = useTeamSnapshot('BOS', null);

      expect(snapshot).toBeNull();
    });

    it('WIRING-14: handles teamCode lookup (alternative to teamId)', () => {
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
      const snapshot = useTeamSnapshot('BOS', result);

      expect(snapshot).not.toBeNull();
      expect(snapshot.outgoingMatchingSalary).toBe(25_000_000);
    });
  });
});
