/**
 * FILE: src/tests/trade/hardCap_salaryMatching.guardrail.test.js
 * PURPOSE: P0 regression tests ensuring hard-capped teams still follow salary matching rules
 * OWNERSHIP: Feature: architect (Trade Machine - CBA Validation)
 *
 * HISTORY:
 *  - 2026-01-03: Created as guardrail for hard cap salary matching fix
 *
 * KEY BEHAVIOR:
 * Hard cap status does NOT determine matching bands. Matching is based on salary position:
 *   - Under cap → Use cap space
 *   - Over cap (Bands 1/2/3) → Tiered formulas
 *   - At/above First apron → 100% matching
 *   - At/above Second apron → 100% matching
 *
 * Hard cap only adds a CEILING constraint (enforced by validateHardCap).
 */

import { describe, test, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js';

const defaultCapSettings = {
  salaryCap: 141_000_000,
  firstApron: 178_000_000,
  secondApron: 188_000_000,
};

describe('Hard-capped teams still follow salary matching', () => {
  // =========================================================================
  // CORE FIX: Hard-capped teams must NOT skip salary matching
  // =========================================================================

  describe('Hard cap does NOT skip salary matching', () => {
    test('hard-capped team gets APPLICABLE salary matching (not HARD_CAP_SKIP)', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 150_000_000, // Over cap, below first apron
        salaryIn: 15_000_000,
        salaryOut: 10_000_000, // Band 2: allows 17.5M
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Must NOT skip salary matching
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
      expect(result.passed).not.toBeNull();

      // Should use band matching based on salary position
      expect(result.allowableIncoming).toBeDefined();
      expect(result.allowableIncoming).toBeGreaterThan(0);
    });

    test('hard-capped team with valid matching still passes', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 150_000_000, // Over cap, Band 2 territory
        salaryIn: 16_000_000, // Under 17.5M allowable
        salaryOut: 10_000_000, // Band 2: 10M + 7.5M = 17.5M allowable
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('hard-capped team with invalid matching FAILS', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 150_000_000, // Over cap, Band 2 territory
        salaryIn: 20_000_000, // EXCEEDS 17.5M allowable
        salaryOut: 10_000_000, // Band 2: 10M + 7.5M = 17.5M allowable
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('exceeds');
    });
  });

  // =========================================================================
  // CRITICAL: Hard cap status doesn't determine matching band
  // =========================================================================

  describe('Matching band determined by salary position (not hard cap status)', () => {
    test('hard-capped team below first apron uses Band matching', () => {
      const team = {
        hardCapped: true, // Hard capped at first apron
        teamTotalSalary: 150_000_000, // BUT salary is below first apron
        salaryIn: 17_500_000, // Within Band 2 allowable
        salaryOut: 10_000_000, // Band 2: 10M + 7.5M = 17.5M allowable
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Should use Band 2 matching (not 100% matching)
      expect(result.details.ruleApplied).toContain('BAND');
      expect(result.allowableIncoming).toBe(17_500_000); // Band 2: 10M + 7.5M
      expect(result.passed).toBe(true);
    });

    test('hard-capped team above first apron uses 100% matching', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 180_000_000, // Above first apron
        salaryIn: 15_000_000,
        salaryOut: 15_000_000, // 100% matching: in = out
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Should be 100% matching based on salary position, not hard cap
      expect(result.details.ruleApplied).toBe('FIRST_APRON');
      expect(result.allowableIncoming).toBe(15_000_000); // salaryOut
      expect(result.passed).toBe(true);
    });

    test('non-hard-capped team above first apron still uses 100% matching', () => {
      const team = {
        hardCapped: false, // NOT hard capped
        teamTotalSalary: 180_000_000, // But above first apron
        salaryIn: 20_000_000, // Exceeds salaryOut
        salaryOut: 15_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // 100% matching still applies based on salary position
      expect(result.details.ruleApplied).toBe('FIRST_APRON');
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('cannot receive more');
    });
  });

  // =========================================================================
  // Result includes hard cap status for informational purposes
  // =========================================================================

  describe('Hard cap status passed through in result details', () => {
    test('hard-capped team includes hardCapStatus in details', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 150_000_000,
        salaryIn: 15_000_000,
        salaryOut: 10_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.details.hardCapStatus).toBeDefined();
      expect(result.details.hardCapStatus.isHardCapped).toBe(true);
    });

    test('non-hard-capped team has null hardCapStatus', () => {
      const team = {
        hardCapped: false,
        teamTotalSalary: 150_000_000,
        salaryIn: 15_000_000,
        salaryOut: 10_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.details.hardCapStatus).toBeNull();
    });
  });

  // =========================================================================
  // TM_FIX_A2_E1: Hard Cap Incoming Ceiling
  // When hard-capped, effective allowable = min(salaryMatchCeiling, hardCapCeiling)
  // =========================================================================

  describe('TM_FIX_A2_E1 - Hard Cap Incoming Ceiling', () => {
    test('hard-capped team gets hardCapIncomingCeiling computed', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 175_000_000, // 3M below first apron
        salaryIn: 15_000_000,
        salaryOut: 10_000_000, // Band 2: allows 17.5M
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Hard cap ceiling = outgoing + max(0, apron - totalSalary)
      // = 10M + max(0, 178M - 175M) = 10M + 3M = 13M
      expect(result.hardCapIncomingCeiling).toBe(13_000_000);
    });

    test('effectiveAllowableIncoming is min of salary match ceiling and hard cap ceiling', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 175_000_000, // 3M below first apron (hard cap at 178M)
        salaryIn: 12_000_000, // Under both ceilings
        salaryOut: 10_000_000, // Band 2: allows 17.5M
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Salary match ceiling = 17.5M (Band 2)
      expect(result.allowableIncoming).toBe(17_500_000);

      // Hard cap ceiling = 10M + 3M = 13M
      expect(result.hardCapIncomingCeiling).toBe(13_000_000);

      // Effective = min(17.5M, 13M) = 13M
      expect(result.effectiveAllowableIncoming).toBe(13_000_000);
    });

    test('when salary match ceiling is lower, it is the limiter', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 150_000_000, // 28M below first apron
        salaryIn: 5_000_000,
        salaryOut: 3_000_000, // Band 1: allows 6.25M
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Salary match ceiling = 3M * 200% + 250k = 6.25M
      expect(result.allowableIncoming).toBe(6_250_000);

      // Hard cap ceiling = 3M + 28M = 31M
      expect(result.hardCapIncomingCeiling).toBe(31_000_000);

      // Effective = min(6.25M, 31M) = 6.25M
      expect(result.effectiveAllowableIncoming).toBe(6_250_000);

      // Limiter should be salaryMatching
      expect(result.details.hardCapCeiling.limiter).toBe('salaryMatching');
    });

    test('when hard cap ceiling is lower, it is the limiter', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 177_000_000, // 1M below first apron
        salaryIn: 11_000_000,
        salaryOut: 10_000_000, // Band 2: allows 17.5M
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Salary match ceiling = 17.5M
      expect(result.allowableIncoming).toBe(17_500_000);

      // Hard cap ceiling = 10M + 1M = 11M
      expect(result.hardCapIncomingCeiling).toBe(11_000_000);

      // Effective = min(17.5M, 11M) = 11M
      expect(result.effectiveAllowableIncoming).toBe(11_000_000);

      // Limiter should be hardCap
      expect(result.details.hardCapCeiling.limiter).toBe('hardCap');
    });

    test('non-hard-capped team has null hardCapIncomingCeiling', () => {
      const team = {
        hardCapped: false,
        teamTotalSalary: 150_000_000,
        salaryIn: 15_000_000,
        salaryOut: 10_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.hardCapIncomingCeiling).toBeNull();
      expect(result.effectiveAllowableIncoming).toBe(result.allowableIncoming);
    });

    test('hardCapCeiling details include apron label', () => {
      const team = {
        hardCapped: true,
        teamTotalSalary: 175_000_000,
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.details.hardCapCeiling).toBeDefined();
      expect(result.details.hardCapCeiling.apronLabel).toContain('1st Apron');
      expect(result.details.hardCapCeiling.apron).toBe(178_000_000);
    });
  });
});
