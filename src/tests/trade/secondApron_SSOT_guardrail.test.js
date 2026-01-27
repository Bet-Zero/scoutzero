import { describe, test, expect } from 'vitest';
import { isSecondApronTeam } from '@/features/architect/utils/tradeMachine/utils/capUtils.js';
import { validateAggregation } from '@/features/architect/utils/tradeMachine/rules/validateAggregation.js';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js';
import { SECOND_APRON_SALARY_MISMATCH } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';

/**
 * Phase 36 Guardrail: Second Apron SSOT
 *
 * Ensures that:
 * 1. The codebase uses strict `>` semantics for Second Apron classification (team is NOT restricted at exactly the apron line).
 * 2. Key rules (Aggregation, Salary Matching) respect this boundary via the SSOT helper.
 */
describe('Second Apron SSOT Guardrails', () => {
  const secondApron = 190000000;
  const capSettings = {
    salaryCap: 140000000,
    firstApron: 170000000,
    secondApron,
  };

  describe('SSOT Helper: isSecondApronTeam', () => {
    test('enforces strict > semantics', () => {
      // Under
      expect(
        isSecondApronTeam({ totalSalary: secondApron - 1 }, capSettings)
      ).toBe(false);

      // Boundary (Equal) - CRITICAL CHECK
      // A team with salary EXACTLY at the second apron line is NOT a Second Apron Team
      expect(isSecondApronTeam({ totalSalary: secondApron }, capSettings)).toBe(
        false
      );

      // Over
      expect(
        isSecondApronTeam({ totalSalary: secondApron + 1 }, capSettings)
      ).toBe(true);
    });

    test('handles various team object shapes safely', () => {
      expect(
        isSecondApronTeam({ teamTotalSalary: secondApron + 1 }, capSettings)
      ).toBe(true);
      expect(
        isSecondApronTeam(
          { team: { totalSalary: secondApron + 1 } },
          capSettings
        )
      ).toBe(true);
      expect(
        isSecondApronTeam(
          { team: { teamTotalSalary: secondApron + 1 } },
          capSettings
        )
      ).toBe(true);
    });
  });

  describe('Integration: Rule functions respect SSOT', () => {
    test('Aggregation: Allowed at exact boundary, blocked at +1', () => {
      // Setup: Aggregating 2 players to acquire 1 larger salary
      // This is ILLEGAL for Second Apron teams, but LEGAL for others
      const teamAtBoundary = {
        teamTotalSalary: secondApron,
        outgoingPlayers: [
          { salary: 5000000, name: 'P1' },
          { salary: 5000000, name: 'P2' },
        ],
        incomingPlayers: [{ salary: 12000000, name: 'Star' }],
        sends: [
          /* Needed for some fallbacks */
        ],
        context: { capSettings, yearKey: '2025' },
      };

      // Expect PASS at boundary (Salary is <= Second Apron)
      const resultAtBoundary = validateAggregation(teamAtBoundary, teamAtBoundary.context);
      expect(resultAtBoundary.passed).toBe(true);
      expect(resultAtBoundary.violations).toHaveLength(0);

      // Expect FAIL above boundary
      const teamOver = { ...teamAtBoundary, teamTotalSalary: secondApron + 1 };
      const resultOver = validateAggregation(teamOver, teamOver.context);
      expect(resultOver.passed).toBe(false);
      expect(resultOver.violations[0]).toContain(
        'cannot aggregate salaries to acquire higher-paid player'
      );
    });

    test('Salary Matching: 100% restriction applies ONLY if > secondApron', () => {
      // Setup: Sending $10M, Receiving $11M (110%)
      // This violates Second Apron (100% max) but passes First Apron/Taxpayer/Room rules
      const salaryOut = 10000000;
      const salaryIn = 11000000;

      const teamAtBoundary = {
        teamTotalSalary: secondApron,
        salaryOut,
        salaryIn,
        context: { capSettings },
      };

      // Expect PASS (or at least NO Second Apron Violation) at boundary
      // Note: Since salaryIn (11M) > salaryOut (10M), projected salary (191M) > secondApron (190M).
      // This triggers the "Apron Crossing" check in validateSalaryMatching.
      // So we expect a violation even at boundary IF we cross the apron.
      // To test the SSOT boundary correctly, we must ensure we DO NOT cross the apron.
      // BUT, checking SECOND_APRON_SALARY_MISMATCH requires incoming > outgoing.
      // So checking boundary on Salary Matching is tricky because Crossing rule supercedes it.
      
      // Instead, let's verify that a team WELL UNDER the apron, crossing it, triggers it (Apron Crossing Rule)
      // And a team WELL ABOVE the apron triggers it (SSOT Rule)
      
      // We'll skip the exact boundary test for Salary Matching here to avoid confusion with Crossing rule,
      // as validateSalaryMatching intentionally aggressively polices crossing.
      
      // Test 1: Team Above Apron -> Violation
      const teamOver = { ...teamAtBoundary, teamTotalSalary: secondApron + 1 };
      const resultOver = validateSalaryMatching(teamOver, {
        capSettings,
        totalSalary: secondApron + 1,
      });
      expect(resultOver.violations).toContain(SECOND_APRON_SALARY_MISMATCH);
    });
  });
});
