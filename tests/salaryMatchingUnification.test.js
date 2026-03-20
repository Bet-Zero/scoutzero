/**
 * Integration test to verify UI and validator produce identical results
 * This test ensures the Phase 2 unification goal is achieved
 */
import { describe, it, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';

const defaultCapSettings = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

describe('UI and Validator Consistency (Phase 2 Verification)', () => {
  // Test scenarios covering all salary matching cases
  const scenarios = [
    {
      name: 'Under-cap team with cap space',
      teamTotalSalary: 130_000_000,
      salaryOut: 5_000_000,
      salaryIn: 10_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.UNDER_CAP,
    },
    {
      name: 'Over-cap team Band 1 (≤$6.5M outgoing)',
      teamTotalSalary: 150_000_000,
      salaryOut: 5_000_000,
      salaryIn: 8_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1,
    },
    {
      name: 'Over-cap team Band 2 ($6.5M < outgoing ≤ $19.6M)',
      teamTotalSalary: 150_000_000,
      salaryOut: 10_000_000,
      salaryIn: 15_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2,
    },
    {
      name: 'Over-cap team Band 3 (outgoing > $19.6M)',
      teamTotalSalary: 150_000_000,
      salaryOut: 25_000_000,
      salaryIn: 30_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3,
    },
    {
      name: 'First apron team (100% matching)',
      teamTotalSalary: 180_000_000,
      salaryOut: 15_000_000,
      salaryIn: 14_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.FIRST_APRON,
    },
    {
      name: 'Second apron team (100% matching)',
      teamTotalSalary: 190_000_000,
      salaryOut: 20_000_000,
      salaryIn: 19_000_000,
      expectedRuleKey: SALARY_MATCHING_RULE_KEYS.SECOND_APRON,
    },
  ];

  scenarios.forEach(({ name, teamTotalSalary, salaryOut, salaryIn, expectedRuleKey }) => {
    it(`${name}: UI and validator produce same allowableIncoming`, () => {
      // Get result from unified rules (what UI would use)
      const uiResult = getSalaryMatchingResult({
        teamTotalSalary,
        outgoingSalary: salaryOut,
        capSettings: defaultCapSettings,
      });

      // Get result from validator
      const validatorResult = validateSalaryMatching(
        {
          teamTotalSalary,
          salaryOut,
          salaryIn,
          context: { capSettings: defaultCapSettings },
        },
        {}
      );

      // Verify both produce the same allowableIncoming
      expect(uiResult.allowableIncoming).toBe(validatorResult.allowableIncoming);

      // Verify the rule key matches expected
      expect(uiResult.ruleKey).toBe(expectedRuleKey);
      expect(validatorResult.details.ruleApplied).toBe(expectedRuleKey);
    });
  });

  describe('boundary conditions', () => {
    it('exact threshold at Band 1/2 boundary ($6.5M) uses Band 1', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 6_500_000,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1);
      // 6.5M * 2.0 + 250k = 13.25M
      expect(result.allowableIncoming).toBe(13_250_000);
    });

    it('just above Band 1/2 boundary ($6.5M + 1) uses Band 2', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 6_500_001,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2);
      // 6,500,001 + 7.5M = 14,000,001
      expect(result.allowableIncoming).toBe(14_000_001);
    });

    it('exact threshold at Band 2/3 boundary ($19.6M) uses Band 2', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 19_600_000,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2);
      // 19.6M + 7.5M = 27.1M
      expect(result.allowableIncoming).toBe(27_100_000);
    });

    it('just above Band 2/3 boundary ($19.6M + 1) uses Band 3', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 19_600_001,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3);
      // 19,600,001 * 1.25 + 250k = 24,750,001.25
      expect(result.allowableIncoming).toBeCloseTo(24_750_001.25, 0);
    });

    it('exact at first apron threshold uses FIRST_APRON', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 178_132_000, // exactly at first apron
        outgoingSalary: 10_000_000,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.FIRST_APRON);
      expect(result.allowableIncoming).toBe(10_000_000);
    });

    it('exact at second apron threshold uses FIRST_APRON', () => {
      // Per CBA Art VII Sec 2(f): "Second Apron Team" requires salary > secondApron (strict),
      // so exactly at the threshold is still a first apron team.
      const result = getSalaryMatchingResult({
        teamTotalSalary: 188_931_000, // exactly at second apron
        outgoingSalary: 10_000_000,
        capSettings: defaultCapSettings,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.FIRST_APRON);
      expect(result.allowableIncoming).toBe(10_000_000);
    });
  });
});
