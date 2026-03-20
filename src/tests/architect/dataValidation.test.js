/**
 * FILE: dataValidation.test.js
 * PURPOSE: Tests for trade-related data validation utilities
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2026-02-15: Created for Batch C — Data Model Hardening (GAP-DATA-001, GAP-DATA-002)
 * LINKS: dataValidation.ts
 *
 * Coverage:
 * - GAP-DATA-001: BYC player previousSalary validation
 * - GAP-DATA-002: Salary field fallback tracking
 */
import { describe, it, expect } from 'vitest';
import {
  validateBYCPlayerData,
  validateSalaryFieldData,
  validateTradeData,
  formatDataWarning,
  DATA_WARNING_CODES,
  DATA_WARNING_SEVERITY,
} from '@/features/architect/utils/tradeMachine/utils/dataValidation';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

describe('GAP-DATA-001: BYC Player Data Validation', () => {
  describe('validateBYCPlayerData', () => {
    it('returns no warnings for non-BYC players', () => {
      const player = {
        name: 'Regular Player',
        isBYC: false,
        salary: 10_000_000,
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(0);
    });

    it('returns no warnings for BYC player with previousSalary', () => {
      const player = {
        name: 'BYC Player With Data',
        isBYC: true,
        previousSalary: 8_000_000,
        salary: 15_000_000,
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(0);
    });

    it('returns warning for BYC player missing previousSalary', () => {
      const player = {
        name: 'BYC Player Missing Data',
        isBYC: true,
        salary: 15_000_000,
        // No previousSalary field
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe(
        DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
      );
      expect(warnings[0].severity).toBe(DATA_WARNING_SEVERITY.WARNING);
      expect(warnings[0].message).toContain('BYC Player Missing Data');
      expect(warnings[0].message).toContain('previousSalary');
    });

    it('returns warning for BYC player with null previousSalary', () => {
      const player = {
        name: 'BYC Player Null Data',
        isBYC: true,
        previousSalary: null,
        salary: 15_000_000,
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe(
        DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
      );
    });

    it('returns warning for BYC player with zero previousSalary', () => {
      const player = {
        name: 'BYC Player Zero Data',
        isBYC: true,
        previousSalary: 0,
        salary: 15_000_000,
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe(
        DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
      );
    });

    it('handles baseYearCompensation flag (alternate field name)', () => {
      const player = {
        name: 'BYC Player Alt Flag',
        baseYearCompensation: true, // Alternate flag name
        salary: 15_000_000,
        // No previousSalary
      };

      const warnings = validateBYCPlayerData(player);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe(
        DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
      );
    });

    it('handles null/undefined player input', () => {
      expect(validateBYCPlayerData(null)).toHaveLength(0);
      expect(validateBYCPlayerData(undefined)).toHaveLength(0);
    });
  });

  describe('computeMatchingValues with BYC warnings', () => {
    it('collects BYC warnings when computing matching values', () => {
      const teams = [
        {
          sends: [
            {
              name: 'BYC Player Missing Prev',
              isBYC: true,
              contract: { salariesByYear: [{ season, capHit: 20_000_000 }] },
              // No previousSalary - should generate warning
            },
          ],
        },
      ];

      const result = computeMatchingValues({ teams, yearKey: currentYear });

      expect(result.dataWarnings).toBeDefined();
      expect(result.hasBYCDataIssues).toBe(true);
      expect(
        result.dataWarnings.some(
          (w) => w.code === DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
        )
      ).toBe(true);
    });

    it('attaches warnings to team object', () => {
      const teams = [
        {
          sends: [
            {
              name: 'BYC Player',
              isBYC: true,
              contract: { salariesByYear: [{ season, capHit: 20_000_000 }] },
            },
          ],
        },
      ];

      computeMatchingValues({ teams, yearKey: currentYear });

      expect(teams[0].dataWarnings).toBeDefined();
      expect(Array.isArray(teams[0].dataWarnings)).toBe(true);
    });

    it('BYC calculation still works (uses 50% fallback)', () => {
      const teams = [
        {
          sends: [
            {
              name: 'BYC Player',
              isBYC: true,
              contract: { salariesByYear: [{ season, capHit: 20_000_000 }] },
              // No previousSalary - should fall back to 50% rule
            },
          ],
        },
      ];

      computeMatchingValues({ teams, yearKey: currentYear });

      // 50% of 20M = 10M (fallback when no previousSalary)
      expect(teams[0].sends[0].matchOutgoing).toBe(10_000_000);
    });
  });
});

describe('GAP-DATA-002: Salary Field Normalization', () => {
  describe('validateSalaryFieldData', () => {
    it('returns no warnings for canonical salary source', () => {
      const player = {
        name: 'Canonical Salary Player',
        contract: {
          salariesByYear: [{ season, capHit: 10_000_000 }],
        },
      };

      const warnings = validateSalaryFieldData(player, currentYear, {
        salarySource: 'contract.salariesByYear.capHit',
        salaryValue: 10_000_000,
      });

      // No warnings for canonical source usage
      expect(
        warnings.every(
          (w) => w.code !== DATA_WARNING_CODES.SALARY_FIELD_FALLBACK
        )
      ).toBe(true);
    });

    it('returns info warning when using fallback salary field', () => {
      const player = {
        name: 'Fallback Salary Player',
        salary: 10_000_000, // Direct salary (not in contract structure)
        // No contract.salariesByYear
      };

      const warnings = validateSalaryFieldData(player, currentYear, {
        salarySource: 'player.salary',
        salaryValue: 10_000_000,
      });

      const fallbackWarning = warnings.find(
        (w) => w.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK
      );
      expect(fallbackWarning).toBeDefined();
      expect(fallbackWarning.severity).toBe(DATA_WARNING_SEVERITY.INFO);
    });

    it('returns warning when no salary data found', () => {
      const player = {
        name: 'No Salary Player',
        // No salary data at all
      };

      const warnings = validateSalaryFieldData(player, currentYear, {
        salarySource: undefined,
        salaryValue: 0,
      });

      const missingWarning = warnings.find(
        (w) => w.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING
      );
      expect(missingWarning).toBeDefined();
      expect(missingWarning.severity).toBe(DATA_WARNING_SEVERITY.WARNING);
    });
  });

  describe('computeMatchingValues with salary field tracking', () => {
    it('tracks when fallback salary source is used', () => {
      const teams = [
        {
          sends: [
            {
              name: 'Fallback Player',
              salary: 15_000_000, // Direct salary (no contract structure)
              // No contract.salariesByYear
            },
          ],
        },
      ];

      const result = computeMatchingValues({ teams, yearKey: currentYear });

      expect(result.hasSalaryFieldIssues).toBe(true);
      expect(
        result.dataWarnings.some(
          (w) =>
            w.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK ||
            w.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING
        )
      ).toBe(true);
    });
  });
});

describe('validateTradeData (combined validation)', () => {
  it('validates multiple players and aggregates warnings', () => {
    const players = [
      { name: 'Normal Player', salary: 5_000_000 },
      { name: 'BYC Player', isBYC: true, salary: 20_000_000 }, // Missing previousSalary
    ];

    const result = validateTradeData(players, currentYear);

    expect(result.hasIssues).toBe(true);
    expect(result.summary.bycPlayers).toBe(1);
    expect(result.summary.bycMissingPrevSalary).toBe(1);
  });

  it('reports summary statistics correctly', () => {
    const players = [
      {
        name: 'P1',
        contract: { salariesByYear: [{ season, capHit: 5_000_000 }] },
      },
      { name: 'P2', salary: 8_000_000 }, // Fallback
      { name: 'P3', isBYC: true, salary: 15_000_000 }, // BYC missing prevSalary + fallback
    ];

    const result = validateTradeData(players, currentYear);

    expect(result.summary.totalPlayers).toBe(3);
    expect(result.summary.bycPlayers).toBe(1);
  });
});

describe('formatDataWarning', () => {
  it('formats error warnings with ❌ prefix', () => {
    const warning = {
      code: 'TEST',
      message: 'Test error message',
      severity: DATA_WARNING_SEVERITY.ERROR,
    };

    const formatted = formatDataWarning(warning);
    expect(formatted).toContain('❌');
    expect(formatted).toContain('Test error message');
  });

  it('formats warnings with ⚠️ prefix', () => {
    const warning = {
      code: 'TEST',
      message: 'Test warning message',
      severity: DATA_WARNING_SEVERITY.WARNING,
    };

    const formatted = formatDataWarning(warning);
    expect(formatted).toContain('⚠️');
  });

  it('formats info with ℹ️ prefix', () => {
    const warning = {
      code: 'TEST',
      message: 'Test info message',
      severity: DATA_WARNING_SEVERITY.INFO,
    };

    const formatted = formatDataWarning(warning);
    expect(formatted).toContain('ℹ️');
  });

  it('handles null/undefined input', () => {
    expect(formatDataWarning(null)).toBe('');
    expect(formatDataWarning(undefined)).toBe('');
  });
});
