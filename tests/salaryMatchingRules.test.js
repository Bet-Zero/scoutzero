/**
 * Tests for unified salary matching rules
 * This ensures the single source of truth works correctly
 */
import { describe, it, expect } from 'vitest';
import {
  getSalaryMatchingResult,
  getSalaryMatchingMargin,
  getSalaryMatchingCeiling,
  validateIncomingSalary,
  SALARY_MATCHING_TIERS,
  SALARY_MATCHING_RULE_KEYS,
  SALARY_MATCHING_RULE_LABELS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js';

const defaultCapSettings = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

describe('Unified Salary Matching Rules', () => {
  describe('getSalaryMatchingResult', () => {
    describe('under-cap teams', () => {
      it('returns cap space as allowable margin', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 130_000_000,
          outgoingSalary: 5_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.UNDER_CAP);
        expect(result.ruleLabel).toBe(SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.UNDER_CAP]);
        // outgoing + cap space = 5M + (141M - 130M) = 5M + 11M = 16M
        expect(result.allowableIncoming).toBe(16_000_000);
      });
    });

    describe('over-cap teams below first apron', () => {
      it('Band 1: applies 200% + $250k for outgoing ≤ $6.5M', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 5_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1);
        // 5M * 2.0 + 250k = 10.25M
        expect(result.allowableIncoming).toBe(10_250_000);
      });

      it('Band 1: at threshold boundary $6.5M', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 6_500_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1);
        // 6.5M * 2.0 + 250k = 13.25M
        expect(result.allowableIncoming).toBe(13_250_000);
      });

      it('Band 2: applies 100% + $7.5M for $6.5M < outgoing ≤ $19.6M', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 10_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2);
        // 10M + 7.5M = 17.5M
        expect(result.allowableIncoming).toBe(17_500_000);
      });

      it('Band 2: at threshold boundary $19.6M', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 19_600_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2);
        // 19.6M + 7.5M = 27.1M
        expect(result.allowableIncoming).toBe(27_100_000);
      });

      it('Band 3: applies 125% + $250k for outgoing > $19.6M', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 25_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3);
        // 25M * 1.25 + 250k = 31.5M
        expect(result.allowableIncoming).toBe(31_500_000);
      });
    });

    describe('apron teams', () => {
      it('first apron: 100% matching only', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 180_000_000, // above first apron
          outgoingSalary: 15_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.FIRST_APRON);
        expect(result.allowableIncoming).toBe(15_000_000);
      });

      it('second apron: 100% matching only', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 190_000_000, // above second apron
          outgoingSalary: 20_000_000,
          capSettings: defaultCapSettings,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.SECOND_APRON);
        expect(result.allowableIncoming).toBe(20_000_000);
      });
    });

    describe('error handling', () => {
      it('returns error for missing cap settings', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 10_000_000,
          capSettings: null,
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS);
        expect(result.error).toBeTruthy();
      });

      it('returns error for all-zero cap settings', () => {
        const result = getSalaryMatchingResult({
          teamTotalSalary: 150_000_000,
          outgoingSalary: 10_000_000,
          capSettings: { salaryCap: 0, firstApron: 0, secondApron: 0 },
        });

        expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('getSalaryMatchingMargin', () => {
    it('returns margin (allowable - outgoing) for over-cap teams', () => {
      const margin = getSalaryMatchingMargin({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 10_000_000,
        capSettings: defaultCapSettings,
      });

      // Band 2: 17.5M - 10M = 7.5M margin
      expect(margin).toBe(7_500_000);
    });
  });

  describe('getSalaryMatchingCeiling', () => {
    it('returns full allowable incoming amount', () => {
      const ceiling = getSalaryMatchingCeiling({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 10_000_000,
        capSettings: defaultCapSettings,
      });

      // Band 2: 10M + 7.5M = 17.5M
      expect(ceiling).toBe(17_500_000);
    });
  });

  describe('validateIncomingSalary', () => {
    it('passes when incoming is below allowable', () => {
      const result = validateIncomingSalary({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 10_000_000,
        incomingSalary: 15_000_000, // below 17.5M allowable
        capSettings: defaultCapSettings,
      });

      expect(result.passed).toBe(true);
      expect(result.violation).toBeNull();
    });

    it('fails when incoming exceeds allowable', () => {
      const result = validateIncomingSalary({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 10_000_000,
        incomingSalary: 20_000_000, // above 17.5M allowable
        capSettings: defaultCapSettings,
      });

      expect(result.passed).toBe(false);
      expect(result.violation).toContain('exceeds');
    });
  });

  describe('tier constants', () => {
    it('exports correct tier thresholds', () => {
      expect(SALARY_MATCHING_TIERS.TIER_1_THRESHOLD).toBe(6_500_000);
      expect(SALARY_MATCHING_TIERS.TIER_2_THRESHOLD).toBe(19_600_000);
    });

    it('exports correct band parameters', () => {
      expect(SALARY_MATCHING_TIERS.BAND_1_MULTIPLIER).toBe(2.0);
      expect(SALARY_MATCHING_TIERS.BAND_1_BONUS).toBe(250_000);
      expect(SALARY_MATCHING_TIERS.BAND_2_MULTIPLIER).toBe(1.0);
      expect(SALARY_MATCHING_TIERS.BAND_2_BONUS).toBe(7_500_000);
      expect(SALARY_MATCHING_TIERS.BAND_3_MULTIPLIER).toBe(1.25);
      expect(SALARY_MATCHING_TIERS.BAND_3_BONUS).toBe(250_000);
    });
  });
});
