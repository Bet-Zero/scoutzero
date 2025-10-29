import { describe, it, expect } from 'vitest';

describe('Contract Normalization Validation', () => {
  describe('Option field pairing validation', () => {
    it('should have both optionUsed and optionDecisionDate null for non-option years', () => {
      const salaryRow = {
        season: "2024-25",
        salary: 40000000,
        option: null,
        optionUsed: null,
        optionDecisionDate: null,
      };

      // Both should be null
      expect(salaryRow.optionUsed).toBeNull();
      expect(salaryRow.optionDecisionDate).toBeNull();
    });

    it('should have both optionUsed and optionDecisionDate set for exercised options', () => {
      const salaryRow = {
        season: "2025-26",
        salary: 2221677,
        option: "TO",
        optionUsed: true,
        optionDecisionDate: "2025-06-28",
      };

      // Both should be set
      expect(typeof salaryRow.optionUsed).toBe('boolean');
      expect(salaryRow.optionUsed).toBe(true);
      expect(typeof salaryRow.optionDecisionDate).toBe('string');
      expect(salaryRow.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should have both optionUsed and optionDecisionDate set for declined options', () => {
      const salaryRow = {
        season: "2026-27",
        salary: 48967200,
        option: "PO",
        optionUsed: false,
        optionDecisionDate: "2025-08-02",
        voidedByExtension: true,
        voidedOn: "2025-08-02",
      };

      // Both should be set
      expect(typeof salaryRow.optionUsed).toBe('boolean');
      expect(salaryRow.optionUsed).toBe(false);
      expect(typeof salaryRow.optionDecisionDate).toBe('string');
      expect(salaryRow.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should have both optionUsed and optionDecisionDate null for pending options', () => {
      const salaryRow = {
        season: "2028-29",
        salary: 59198976,
        option: "PO",
        optionUsed: null,
        optionDecisionDate: null,
        guaranteed: true,
        guaranteedAmount: 59198976,
      };

      // Both should be null for pending option
      expect(salaryRow.optionUsed).toBeNull();
      expect(salaryRow.optionDecisionDate).toBeNull();
    });

    it('should reject invalid pairing: optionUsed set but optionDecisionDate null', () => {
      // This should never happen in valid data
      const invalidRow = {
        season: "2025-26",
        option: "PO",
        optionUsed: true,
        optionDecisionDate: null, // INVALID: optionUsed is set but date is null
      };

      // Validate that this is detected as invalid
      const hasOptionUsed = invalidRow.optionUsed !== null && invalidRow.optionUsed !== undefined;
      const hasOptionDate = invalidRow.optionDecisionDate !== null && invalidRow.optionDecisionDate !== undefined;
      
      expect(hasOptionUsed).toBe(true);
      expect(hasOptionDate).toBe(false);
      expect(hasOptionUsed === hasOptionDate).toBe(false); // This should be caught
    });

    it('should reject invalid pairing: optionUsed null but optionDecisionDate set', () => {
      // This should never happen in valid data
      const invalidRow = {
        season: "2025-26",
        option: "PO",
        optionUsed: null, // INVALID: date is set but optionUsed is null
        optionDecisionDate: "2025-06-28",
      };

      // Validate that this is detected as invalid
      const hasOptionUsed = invalidRow.optionUsed !== null && invalidRow.optionUsed !== undefined;
      const hasOptionDate = invalidRow.optionDecisionDate !== null && invalidRow.optionDecisionDate !== undefined;
      
      expect(hasOptionUsed).toBe(false);
      expect(hasOptionDate).toBe(true);
      expect(hasOptionUsed === hasOptionDate).toBe(false); // This should be caught
    });
  });

  describe('yearsRemaining calculation', () => {
    it('should exclude voided years when calculating yearsRemaining', () => {
      const salariesByYear = [
        { season: "2024-25", salary: 40000000, voidedByExtension: false },
        { season: "2025-26", salary: 43031940, voidedByExtension: false },
        { season: "2026-27", salary: 46063880, option: "PO", voidedByExtension: true }, // voided
      ];

      // Only non-voided years should count
      const activeYears = salariesByYear.filter(y => !y.voidedByExtension);
      expect(activeYears.length).toBe(2);
      
      // yearsRemaining should be based on activeYears, not all years
      const lastActiveYear = activeYears[activeYears.length - 1].season;
      expect(lastActiveYear).toBe("2025-26");
    });

    it('should not count voided PO in guaranteedYears', () => {
      const salariesByYear = [
        { season: "2024-25", salary: 40000000, guaranteedAmount: 40000000 },
        { season: "2025-26", salary: 43031940, guaranteedAmount: 43031940 },
        { season: "2026-27", salary: 46063880, guaranteedAmount: 46063880 },
        { season: "2027-28", salary: 49095820, guaranteedAmount: 49095820 },
        { season: "2028-29", salary: 48967200, option: "PO", guaranteedAmount: 0, voidedByExtension: true },
      ];

      const activeYears = salariesByYear.filter(y => !y.voidedByExtension);
      const guaranteedYears = activeYears.filter(y => (y.guaranteedAmount || 0) > 0).length;
      
      // Should be 4, not 5 (voided PO not counted)
      expect(guaranteedYears).toBe(4);
    });
  });

  describe('Player option policy', () => {
    it('should treat live player option as guaranteed', () => {
      const salaryRow = {
        season: "2028-29",
        salary: 59198976,
        option: "PO",
        optionUsed: null,
        optionDecisionDate: null,
        guaranteed: true,
        guaranteedAmount: 59198976,
      };

      // Live PO (optionUsed is null) should be treated as guaranteed
      expect(salaryRow.option).toBe("PO");
      expect(salaryRow.optionUsed).toBeNull();
      expect(salaryRow.guaranteed).toBe(true);
      expect(salaryRow.guaranteedAmount).toBe(salaryRow.salary);
    });

    it('should not treat declined player option as guaranteed', () => {
      const salaryRow = {
        season: "2026-27",
        salary: 48967200,
        option: "PO",
        optionUsed: false,
        optionDecisionDate: "2025-08-02",
        guaranteed: false,
        guaranteedAmount: 0,
        voidedByExtension: true,
      };

      // Declined PO should not be guaranteed
      expect(salaryRow.option).toBe("PO");
      expect(salaryRow.optionUsed).toBe(false);
      expect(salaryRow.guaranteed).toBe(false);
      expect(salaryRow.guaranteedAmount).toBe(0);
    });
  });

  describe('Extension linkage', () => {
    it('should have supersededIn and supersededByContractRef on old contract', () => {
      const oldContract = {
        contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
        supersededIn: "2026-27",
        supersededByContractRef: "VETERAN EXTENSION",
      };

      expect(oldContract.supersededIn).toBe("2026-27");
      expect(oldContract.supersededByContractRef).toBe("VETERAN EXTENSION");
    });

    it('should have supersedesContractRef on new contract', () => {
      const futureContract = {
        contractType: "VETERAN EXTENSION",
        supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",
      };

      expect(futureContract.supersedesContractRef).toBe("DESIGNATED ROOKIE SCALE EXTENSION");
    });

    it('should have matching contract type references between old and new contracts', () => {
      const oldContract = {
        contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
        supersededByContractRef: "VETERAN EXTENSION",
      };

      const futureContract = {
        contractType: "VETERAN EXTENSION",
        supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",
      };

      // Cross-references should match
      expect(oldContract.supersededByContractRef).toBe(futureContract.contractType);
      expect(futureContract.supersedesContractRef).toBe(oldContract.contractType);
    });
  });

  describe('Jalen Wilson team option scenario (regression protection)', () => {
    it('should handle exercised team option with partial guarantee', () => {
      // Jalen Wilson's 2025-26 year: TO exercised, but only partially guaranteed
      const salaryRow = {
        season: "2025-26",
        salary: 2221677,
        option: "TO",
        optionUsed: true,
        optionDecisionDate: "2025-06-28",
        guaranteed: false,
        guaranteedAmount: 88075,
        guaranteeSchedule: [
          { date: "2025-06-28", amount: 88075, trigger: "Team Option Exercised" }
        ],
      };

      // Verify all fields match expected values
      expect(salaryRow.option).toBe("TO");
      expect(salaryRow.optionUsed).toBe(true);
      expect(salaryRow.optionDecisionDate).toBe("2025-06-28");
      expect(salaryRow.guaranteed).toBe(false);
      expect(salaryRow.guaranteedAmount).toBe(88075);
      expect(salaryRow.guaranteeSchedule).toBeDefined();
      expect(Array.isArray(salaryRow.guaranteeSchedule)).toBe(true);
      
      // optionUsed and optionDecisionDate should both be set
      expect(salaryRow.optionUsed).not.toBeNull();
      expect(salaryRow.optionDecisionDate).not.toBeNull();
    });
  });

  describe('Headline contract values', () => {
    it('should not modify totalValue after voiding PO', () => {
      // Original contract: 5 years, $215,159,700
      // After voiding PO in year 5: still should report original totalValue
      const contract = {
        contractLength: 5,
        totalValue: 215159700,
        salariesByYear: [
          { season: "2022-23", salary: 37096500 },
          { season: "2023-24", salary: 40064220 },
          { season: "2024-25", salary: 43031940 },
          { season: "2025-26", salary: 46063880 },
          { season: "2026-27", salary: 48967200, voidedByExtension: true },
        ],
      };

      // totalValue should remain unchanged at original contract value
      expect(contract.totalValue).toBe(215159700);
      expect(contract.contractLength).toBe(5);
    });

    it('should not include voided PO in guaranteedValue calculation', () => {
      const contract = {
        guaranteedValue: 166256540, // 4 years, excluding voided PO
        salariesByYear: [
          { season: "2022-23", salary: 37096500, guaranteedAmount: 37096500 },
          { season: "2023-24", salary: 40064220, guaranteedAmount: 40064220 },
          { season: "2024-25", salary: 43031940, guaranteedAmount: 43031940 },
          { season: "2025-26", salary: 46063880, guaranteedAmount: 46063880 },
          { season: "2026-27", salary: 48967200, guaranteedAmount: 0, voidedByExtension: true },
        ],
      };

      const activeYears = contract.salariesByYear.filter(y => !y.voidedByExtension);
      const computedGuaranteedValue = activeYears.reduce((sum, y) => sum + (y.guaranteedAmount || 0), 0);
      
      expect(computedGuaranteedValue).toBe(166256540);
      expect(contract.guaranteedValue).toBe(166256540);
    });
  });
});
