/**
 * FILE: batchB_cbaRules.test.js
 * PURPOSE: Tests for CBA Rules Completeness (Batch B gaps)
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2026-02-15: Created for Batch B — CBA Rules Completeness
 * LINKS: validateEligibility.js, computeTeamCapTotals.ts, rosterValidation.js
 *
 * Coverage:
 * - GAP-MISS-003: Incomplete roster charges verification
 * - GAP-MISS-005: Two-way contract trade blocking
 */
import { describe, it, expect } from 'vitest';
import { validateEligibility } from '@/features/architect/utils/tradeMachine/rules/validateEligibility';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  TradeExceptionPlayer,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

type BatchBPlayer = TradeExceptionPlayer & {
  contractType?: string;
  contract: {
    salariesByYear: Array<{
      season: string;
      salary: number;
      capHit?: number;
    }>;
    isTwoWay?: boolean;
  };
};

// Helper to create a player with contract
const makePlayer = (
  name: string,
  salary: number,
  extras: Partial<BatchBPlayer> = {}
): BatchBPlayer => ({
  name,
  contract: { salariesByYear: [{ season, salary, capHit: salary }] },
  ...extras,
});

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

function requireIncompleteRosterCharge(
  totals: ReturnType<typeof computeTeamCapTotals>
) {
  expect(totals._meta.incompleteRosterCharge).not.toBeNull();
  const charge = totals._meta.incompleteRosterCharge;
  if (!charge) {
    throw new Error('Expected incomplete roster charge metadata');
  }
  return charge;
}

describe('GAP-MISS-003: Incomplete Roster Charges (VERIFIED ALREADY IMPLEMENTED)', () => {
  describe('computeTeamCapTotals includes empty slot charges', () => {
    it('charges minimum salary for each missing roster slot when < 14 players', () => {
      // Create team with only 10 players (missing 4 slots from 14-player minimum)
      const players = Array.from({ length: 10 }, (_, i) =>
        makePlayer(`Player${i}`, 2_000_000)
      );

      const teamCapSheet = {
        players,
        capHolds: [],
      };

      const totals = computeTeamCapTotals(teamCapSheet, currentYear);

      // Should have incomplete charges
      expect(totals.incompleteChargesTotal).toBeGreaterThan(0);

      // Should charge for 4 missing slots (14 - 10)
      // Charge per slot is rookieMin (around $1.1M)
      expect(requireIncompleteRosterCharge(totals).missingSlots).toBe(4);
    });

    it('no charges when roster has 14+ players', () => {
      const players = Array.from({ length: 14 }, (_, i) =>
        makePlayer(`Player${i}`, 2_000_000)
      );

      const teamCapSheet = {
        players,
        capHolds: [],
      };

      const totals = computeTeamCapTotals(teamCapSheet, currentYear);

      // Should have zero incomplete charges
      expect(totals.incompleteChargesTotal).toBe(0);
    });

    it('no charges when roster has 15 players', () => {
      const players = Array.from({ length: 15 }, (_, i) =>
        makePlayer(`Player${i}`, 2_000_000)
      );

      const teamCapSheet = {
        players,
        capHolds: [],
      };

      const totals = computeTeamCapTotals(teamCapSheet, currentYear);

      expect(totals.incompleteChargesTotal).toBe(0);
    });

    it('incomplete charges included in total cap allocations', () => {
      const players = Array.from({ length: 12 }, (_, i) =>
        makePlayer(`Player${i}`, 2_000_000)
      );

      const teamCapSheet = {
        players,
        capHolds: [],
      };

      const totals = computeTeamCapTotals(teamCapSheet, currentYear);

      // Total should include incomplete charges
      const expectedPlayersTotal = 12 * 2_000_000;
      const totalWithoutCharges = expectedPlayersTotal;

      expect(totals.totalCapAllocations).toBeGreaterThan(totalWithoutCharges);
      expect(totals.totalCapAllocations).toBe(
        totals.playersTotal +
          totals.deadMoneyTotal +
          totals.capHoldsTotal +
          totals.incompleteChargesTotal
      );
    });
  });
});

describe('GAP-MISS-005: Two-Way Contract Trade Block', () => {
  describe('validateEligibility blocks two-way player trades', () => {
    it('blocks trade when player has isTwoWay=true', () => {
      const twoWayPlayer = makePlayer('Two-Way Guy', 500_000, {
        isTwoWay: true,
      });

      const team = {
        teamId: 'BOS',
        sends: [twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toMatchObject({
        rule: 'eligibility',
        code: 'ELIGIBILITY__TWO_WAY_PLAYER_BLOCKED',
      });
      expect(
        texts.some(
          (v) => v.includes('Two-way') && v.includes('cannot be traded')
        )
      ).toBe(true);
    });

    it('blocks trade when player has contractType="two-way"', () => {
      const twoWayPlayer = makePlayer('Two-Way Guy', 500_000, {
        contractType: 'two-way',
      });

      const team = {
        teamId: 'BOS',
        sends: [twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      expect(result.passed).toBe(false);
      expect(
        texts.some(
          (v) => v.includes('Two-way') && v.includes('cannot be traded')
        )
      ).toBe(true);
    });

    it('blocks trade when contract.isTwoWay=true', () => {
      const twoWayPlayer = {
        name: 'Two-Way Guy',
        contract: {
          salariesByYear: [{ season, salary: 500_000 }],
          isTwoWay: true,
        },
      };

      const team = {
        teamId: 'BOS',
        sends: [twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      expect(result.passed).toBe(false);
      expect(texts.some((v) => v.includes('Two-way'))).toBe(true);
    });

    it('allows trade of standard contract player', () => {
      const standardPlayer = makePlayer('Standard Guy', 10_000_000, {
        isTwoWay: false,
      });

      const team = {
        teamId: 'BOS',
        sends: [standardPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      // Should pass (no two-way violation)
      expect(texts.filter((v) => v.includes('Two-way')).length).toBe(0);
    });

    it('allows trade when player has no two-way indicators', () => {
      const regularPlayer = makePlayer('Regular Player', 5_000_000);

      const team = {
        teamId: 'BOS',
        sends: [regularPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      // Should pass (no two-way violation)
      expect(texts.filter((v) => v.includes('Two-way')).length).toBe(0);
    });

    it('violation message mentions waiving as alternative', () => {
      const twoWayPlayer = makePlayer('Two-Way Guy', 500_000, {
        isTwoWay: true,
      });

      const team = {
        teamId: 'BOS',
        sends: [twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      expect(texts.some((v) => v.includes('waived'))).toBe(true);
    });

    it('handles outgoingPlayers field name (alternative to sends)', () => {
      const twoWayPlayer = makePlayer('Two-Way Guy', 500_000, {
        isTwoWay: true,
      });

      const team = {
        teamId: 'BOS',
        outgoingPlayers: [twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      expect(result.passed).toBe(false);
      expect(texts.some((v) => v.includes('Two-way'))).toBe(true);
    });

    it('blocks multiple two-way players in same trade', () => {
      const twoWay1 = makePlayer('Two-Way 1', 500_000, { isTwoWay: true });
      const twoWay2 = makePlayer('Two-Way 2', 500_000, { isTwoWay: true });

      const team = {
        teamId: 'BOS',
        sends: [twoWay1, twoWay2],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      // Should have violations for both
      const twoWayViolations = texts.filter((v) => v.includes('Two-way'));
      expect(twoWayViolations.length).toBe(2);
    });

    it('handles mixed standard and two-way players', () => {
      const standardPlayer = makePlayer('Standard', 10_000_000);
      const twoWayPlayer = makePlayer('Two-Way', 500_000, { isTwoWay: true });

      const team = {
        teamId: 'BOS',
        sends: [standardPlayer, twoWayPlayer],
      };

      const result = validateEligibility(team, {});
      const texts = issueTexts(result.violations);

      // Should fail due to two-way player
      expect(result.passed).toBe(false);

      // Should have exactly one two-way violation
      const twoWayViolations = texts.filter((v) => v.includes('Two-way'));
      expect(twoWayViolations.length).toBe(1);
    });
  });
});

describe('NOT IN SCOPE Items Documented', () => {
  it('GAP-MISS-001: Recently signed FA restriction - NOT IN SCOPE (requires signedDate data)', () => {
    // This test documents that GAP-MISS-001 is NOT IN SCOPE for v1
    // Implementation would require:
    // 1. signedDate field on player data model
    // 2. validateRecentlySigned() function
    // 3. Check if signedDate within 3 months
    expect(true).toBe(true); // Placeholder - feature not implemented
  });

  it('GAP-MISS-002: Options/non-guaranteed salary - NOT IN SCOPE (requires schema extension)', () => {
    // This test documents that GAP-MISS-002 is NOT IN SCOPE for v1
    // Implementation would require:
    // 1. hasTeamOption, hasPlayerOption fields
    // 2. guaranteedAmount field
    // 3. Complex salary calculation changes
    expect(true).toBe(true); // Placeholder - feature not implemented
  });

  it('GAP-MISS-004: Cash in trades - NOT IN SCOPE (requires UI)', () => {
    // This test documents that GAP-MISS-004 is NOT IN SCOPE for v1
    // The validator exists (validateCash in eligibilityRules.js)
    // But there's no UI control to add cash to trades
    // Implementation would require:
    // 1. Cash input field in TradeEditor.jsx
    // 2. cashAmount in trade state
    expect(true).toBe(true); // Placeholder - feature not implemented
  });
});
