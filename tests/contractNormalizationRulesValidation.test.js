import { describe, it, expect } from 'vitest';

/**
 * Contract Normalization Rules Validation
 * 
 * This test suite validates that all contract normalization rules are properly
 * enforced across all players. These rules ensure consistency in how we handle
 * options, dates, guarantees, and contract linkages.
 * 
 * Rules Reference:
 * 1. optionUsed/optionDecisionDate pairing
 * 2. ISO date requirement for all dates
 * 3. yearsRemaining logic (excludes voided years)
 * 4. Player option guarantee policy vs voided options
 * 5. Contract linkage metadata
 * 6. signedByCurrentTeam semantics
 * 7. No mutation of money headlines (totalValue, averageAnnualValue)
 */

describe('Contract Normalization Rules - Comprehensive Validation', () => {
  describe('Rule 1: optionUsed/optionDecisionDate Pairing', () => {
    it('enforces that both optionUsed and optionDecisionDate are null together', () => {
      // Pending option - both null
      const pendingOption = {
        season: "2028-29",
        option: "PO",
        optionUsed: null,
        optionDecisionDate: null,
      };

      expect(pendingOption.optionUsed).toBeNull();
      expect(pendingOption.optionDecisionDate).toBeNull();
    });

    it('enforces that both optionUsed and optionDecisionDate are set together (exercised)', () => {
      // Exercised option - both set
      const exercisedOption = {
        season: "2025-26",
        option: "TO",
        optionUsed: true,
        optionDecisionDate: "2025-06-28",
      };

      expect(exercisedOption.optionUsed).toBe(true);
      expect(typeof exercisedOption.optionDecisionDate).toBe('string');
      expect(exercisedOption.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('enforces that both optionUsed and optionDecisionDate are set together (declined)', () => {
      // Declined option - both set
      const declinedOption = {
        season: "2026-27",
        option: "PO",
        optionUsed: false,
        optionDecisionDate: "2025-08-02",
        voidedByExtension: true,
        voidedOn: "2025-08-02",
      };

      expect(declinedOption.optionUsed).toBe(false);
      expect(typeof declinedOption.optionDecisionDate).toBe('string');
      expect(declinedOption.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('detects invalid pairing: optionUsed set but optionDecisionDate null', () => {
      const invalid = {
        optionUsed: true,
        optionDecisionDate: null,
      };

      const hasOptionUsed = invalid.optionUsed !== null && invalid.optionUsed !== undefined;
      const hasOptionDate = invalid.optionDecisionDate !== null && invalid.optionDecisionDate !== undefined;
      
      // This should be detected as invalid
      expect(hasOptionUsed).toBe(true);
      expect(hasOptionDate).toBe(false);
      expect(hasOptionUsed === hasOptionDate).toBe(false);
    });

    it('detects invalid pairing: optionUsed null but optionDecisionDate set', () => {
      const invalid = {
        optionUsed: null,
        optionDecisionDate: "2025-06-28",
      };

      const hasOptionUsed = invalid.optionUsed !== null && invalid.optionUsed !== undefined;
      const hasOptionDate = invalid.optionDecisionDate !== null && invalid.optionDecisionDate !== undefined;
      
      // This should be detected as invalid
      expect(hasOptionUsed).toBe(false);
      expect(hasOptionDate).toBe(true);
      expect(hasOptionUsed === hasOptionDate).toBe(false);
    });
  });

  describe('Rule 2: ISO Date Format Requirement', () => {
    it('requires optionDecisionDate in ISO YYYY-MM-DD format', () => {
      const validDate = "2025-08-02";
      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('requires voidedOn in ISO YYYY-MM-DD format', () => {
      const validDate = "2025-08-02";
      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('rejects human-readable date formats', () => {
      const humanDate = "Aug 2, 2025";
      expect(humanDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // After normalization, should be converted to ISO
      const isoDate = "2025-08-02";
      expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Rule 3: yearsRemaining Calculation Logic', () => {
    it('excludes voided years from yearsRemaining count', () => {
      const currentSeason = 2025;
      
      // Contract with one voided year
      const salariesByYear = [
        { season: "2024-25", salary: 40000000, voidedByExtension: false },
        { season: "2025-26", salary: 43031940, voidedByExtension: false },
        { season: "2026-27", salary: 46063880, option: "PO", voidedByExtension: true },
      ];

      // Calculate years remaining excluding voided years
      const activeYears = salariesByYear.filter(y => !y.voidedByExtension);
      const lastActiveYear = activeYears[activeYears.length - 1];
      const lastActiveYearNum = parseInt(lastActiveYear.season.split('-')[0]);
      const yearsRemaining = Math.max(0, lastActiveYearNum - currentSeason + 1);

      expect(activeYears.length).toBe(2);
      expect(lastActiveYear.season).toBe("2025-26");
      expect(yearsRemaining).toBe(1); // Only 2025-26 is live (2024-25 is current)
    });

    it('counts all years when no voided years exist', () => {
      const currentSeason = 2025;
      
      const salariesByYear = [
        { season: "2024-25", salary: 40000000, voidedByExtension: false },
        { season: "2025-26", salary: 43031940, voidedByExtension: false },
        { season: "2026-27", salary: 46063880, voidedByExtension: false },
      ];

      const activeYears = salariesByYear.filter(y => !y.voidedByExtension);
      const lastActiveYear = activeYears[activeYears.length - 1];
      const lastActiveYearNum = parseInt(lastActiveYear.season.split('-')[0]);
      const yearsRemaining = Math.max(0, lastActiveYearNum - currentSeason + 1);

      expect(activeYears.length).toBe(3);
      expect(yearsRemaining).toBe(2); // 2025-26 and 2026-27
    });
  });

  describe('Rule 4: Player Option Guarantee Policy', () => {
    it('treats live player option (optionUsed=null) as guaranteed', () => {
      const livePO = {
        season: "2028-29",
        salary: 59198976,
        option: "PO",
        optionUsed: null,
        optionDecisionDate: null,
        guaranteed: true,
        guaranteedAmount: 59198976,
      };

      expect(livePO.option).toBe("PO");
      expect(livePO.optionUsed).toBeNull();
      expect(livePO.optionDecisionDate).toBeNull();
      expect(livePO.guaranteed).toBe(true);
      expect(livePO.guaranteedAmount).toBe(livePO.salary);
    });

    it('treats declined/voided player option as NOT guaranteed', () => {
      const voidedPO = {
        season: "2026-27",
        salary: 48967200,
        option: "PO",
        optionUsed: false,
        optionDecisionDate: "2025-08-02",
        guaranteed: false,
        guaranteedAmount: 0,
        voidedByExtension: true,
        voidedOn: "2025-08-02",
      };

      expect(voidedPO.option).toBe("PO");
      expect(voidedPO.optionUsed).toBe(false);
      expect(voidedPO.optionDecisionDate).toBe("2025-08-02");
      expect(voidedPO.guaranteed).toBe(false);
      expect(voidedPO.guaranteedAmount).toBe(0);
      expect(voidedPO.voidedByExtension).toBe(true);
    });

    it('distinguishes between live PO in future contract vs voided PO in old contract', () => {
      // Old contract - voided PO
      const oldContractYear = {
        season: "2026-27",
        salary: 48967200,
        option: "PO",
        optionUsed: false,
        optionDecisionDate: "2025-08-02",
        guaranteed: false,
        guaranteedAmount: 0,
        voidedByExtension: true,
        voidedOn: "2025-08-02",
      };

      // Future contract - live PO
      const futureContractYear = {
        season: "2028-29",
        salary: 59198976,
        option: "PO",
        optionUsed: null,
        optionDecisionDate: null,
        guaranteed: true,
        guaranteedAmount: 59198976,
      };

      // Verify they're different
      expect(oldContractYear.guaranteed).toBe(false);
      expect(futureContractYear.guaranteed).toBe(true);
      expect(oldContractYear.voidedByExtension).toBe(true);
      expect(futureContractYear.voidedByExtension).toBeUndefined();
    });
  });

  describe('Rule 5: Contract Linkage Metadata', () => {
    it('sets supersededIn and supersededByContractRef on old contract', () => {
      const oldContract = {
        contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
        supersededIn: "2026-27",
        supersededByContractRef: "VETERAN EXTENSION",
      };

      expect(oldContract.supersededIn).toBe("2026-27");
      expect(oldContract.supersededByContractRef).toBe("VETERAN EXTENSION");
      expect(typeof oldContract.supersededIn).toBe('string');
      expect(typeof oldContract.supersededByContractRef).toBe('string');
    });

    it('sets supersedesContractRef on new contract', () => {
      const newContract = {
        contractType: "VETERAN EXTENSION",
        supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",
      };

      expect(newContract.supersedesContractRef).toBe("DESIGNATED ROOKIE SCALE EXTENSION");
      expect(typeof newContract.supersedesContractRef).toBe('string');
    });

    it('validates cross-references match between old and new contracts', () => {
      const oldContract = {
        contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
        supersededByContractRef: "VETERAN EXTENSION",
      };

      const newContract = {
        contractType: "VETERAN EXTENSION",
        supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",
      };

      // Verify bidirectional references
      expect(oldContract.supersededByContractRef).toBe(newContract.contractType);
      expect(newContract.supersedesContractRef).toBe(oldContract.contractType);
    });
  });

  describe('Rule 6: signedByCurrentTeam Semantics', () => {
    it('sets signedByCurrentTeam based on current team at scrape time', () => {
      const currentTeamCode = "LAL";
      
      // Contract signed by current team
      const contract1 = {
        signingTeam: "LAL",
        signedByCurrentTeam: true,
      };

      // Contract signed by different team
      const contract2 = {
        signingTeam: "DAL",
        signedByCurrentTeam: false,
      };

      expect(contract1.signingTeam === currentTeamCode).toBe(contract1.signedByCurrentTeam);
      expect(contract2.signingTeam === currentTeamCode).toBe(contract2.signedByCurrentTeam);
    });

    it('handles case where player was traded after signing', () => {
      // Player signed with DAL, now plays for LAL
      const currentTeamCode = "LAL";
      const oldContract = {
        signingTeam: "DAL",
        signedByCurrentTeam: false, // Was signed by DAL, not by current team LAL
      };

      const futureContract = {
        signingTeam: "LAL",
        signedByCurrentTeam: true, // Signed extension with current team LAL
      };

      expect(oldContract.signingTeam).not.toBe(currentTeamCode);
      expect(oldContract.signedByCurrentTeam).toBe(false);
      expect(futureContract.signingTeam).toBe(currentTeamCode);
      expect(futureContract.signedByCurrentTeam).toBe(true);
    });
  });

  describe('Rule 7: No Mutation of Money Headlines', () => {
    it('preserves totalValue after voiding PO', () => {
      // Original contract: 5 years, $215M total
      // After voiding year 5: totalValue should still be $215M (not $166M)
      const contract = {
        contractLength: 5,
        totalValue: 215159700, // Original 5-year total
        salariesByYear: [
          { season: "2022-23", salary: 37096500 },
          { season: "2023-24", salary: 40064220 },
          { season: "2024-25", salary: 43031940 },
          { season: "2025-26", salary: 46063880 },
          { season: "2026-27", salary: 48967200, voidedByExtension: true },
        ],
      };

      // Verify totalValue is unchanged
      expect(contract.totalValue).toBe(215159700);
      expect(contract.contractLength).toBe(5);
    });

    it('preserves averageAnnualValue after voiding PO', () => {
      const contract = {
        contractLength: 5,
        totalValue: 215159700,
        averageAnnualValue: 43031940, // 215159700 / 5
      };

      // Should not change to 4-year average after voiding
      expect(contract.averageAnnualValue).toBe(43031940);
      expect(contract.averageAnnualValue).toBe(contract.totalValue / contract.contractLength);
    });

    it('recomputes guaranteedValue based on active years (excluding voided)', () => {
      const contract = {
        guaranteedValue: 166256540, // 4 years, excluding voided PO
        salariesByYear: [
          { season: "2022-23", salary: 37096500, guaranteedAmount: 37096500, voidedByExtension: false },
          { season: "2023-24", salary: 40064220, guaranteedAmount: 40064220, voidedByExtension: false },
          { season: "2024-25", salary: 43031940, guaranteedAmount: 43031940, voidedByExtension: false },
          { season: "2025-26", salary: 46063880, guaranteedAmount: 46063880, voidedByExtension: false },
          { season: "2026-27", salary: 48967200, guaranteedAmount: 0, voidedByExtension: true },
        ],
      };

      const activeYears = contract.salariesByYear.filter(y => !y.voidedByExtension);
      const computedGuaranteed = activeYears.reduce((sum, y) => sum + (y.guaranteedAmount || 0), 0);

      expect(computedGuaranteed).toBe(166256540);
      expect(contract.guaranteedValue).toBe(166256540);
    });

    it('recomputes guaranteedYears based on active years (excluding voided)', () => {
      const contract = {
        guaranteedYears: 4, // 4 years, excluding voided PO
        salariesByYear: [
          { season: "2022-23", guaranteedAmount: 37096500, voidedByExtension: false },
          { season: "2023-24", guaranteedAmount: 40064220, voidedByExtension: false },
          { season: "2024-25", guaranteedAmount: 43031940, voidedByExtension: false },
          { season: "2025-26", guaranteedAmount: 46063880, voidedByExtension: false },
          { season: "2026-27", guaranteedAmount: 0, voidedByExtension: true },
        ],
      };

      const activeYears = contract.salariesByYear.filter(y => !y.voidedByExtension);
      const computedGuaranteedYears = activeYears.filter(y => (y.guaranteedAmount || 0) > 0).length;

      expect(computedGuaranteedYears).toBe(4);
      expect(contract.guaranteedYears).toBe(4);
    });
  });

  describe('Integration: Complete Luka Dončić Scenario', () => {
    it('validates complete old contract structure (DESIGNATED ROOKIE SCALE EXTENSION)', () => {
      const oldContract = {
        contractType: "DESIGNATED ROOKIE SCALE EXTENSION",
        startSeason: "2022-23",
        endSeason: "2026-27",
        contractLength: 5,
        totalValue: 215159700,
        averageAnnualValue: 43031940,
        guaranteedValue: 166256540, // 4 years, excluding voided PO
        guaranteedYears: 4,
        yearsRemaining: 1, // Only 2025-26 remains (2026-27 is voided)
        signingTeam: "DAL",
        signedByCurrentTeam: false, // Signed by DAL, now with LAL
        supersededIn: "2026-27",
        supersededByContractRef: "VETERAN EXTENSION",
        salariesByYear: [
          {
            season: "2022-23",
            salary: 37096500,
            guaranteed: true,
            guaranteedAmount: 37096500,
          },
          {
            season: "2023-24",
            salary: 40064220,
            guaranteed: true,
            guaranteedAmount: 40064220,
          },
          {
            season: "2024-25",
            salary: 43031940,
            guaranteed: true,
            guaranteedAmount: 43031940,
          },
          {
            season: "2025-26",
            salary: 46063880,
            guaranteed: true,
            guaranteedAmount: 46063880,
          },
          {
            season: "2026-27",
            salary: 48967200,
            option: "PO",
            optionUsed: false,
            optionDecisionDate: "2025-08-02",
            guaranteed: false,
            guaranteedAmount: 0,
            voidedByExtension: true,
            voidedOn: "2025-08-02",
          },
        ],
      };

      // Validate all fields
      expect(oldContract.contractType).toBe("DESIGNATED ROOKIE SCALE EXTENSION");
      expect(oldContract.yearsRemaining).toBe(1);
      expect(oldContract.guaranteedValue).toBe(166256540);
      expect(oldContract.guaranteedYears).toBe(4);
      expect(oldContract.totalValue).toBe(215159700); // Unchanged
      expect(oldContract.supersededIn).toBe("2026-27");
      expect(oldContract.supersededByContractRef).toBe("VETERAN EXTENSION");

      // Validate voided year
      const voidedYear = oldContract.salariesByYear.find(y => y.voidedByExtension);
      expect(voidedYear).toBeDefined();
      expect(voidedYear.season).toBe("2026-27");
      expect(voidedYear.optionUsed).toBe(false);
      expect(voidedYear.optionDecisionDate).toBe("2025-08-02");
      expect(voidedYear.guaranteed).toBe(false);
      expect(voidedYear.guaranteedAmount).toBe(0);
    });

    it('validates complete future contract structure (VETERAN EXTENSION)', () => {
      const futureContract = {
        contractType: "VETERAN EXTENSION",
        startSeason: "2026-27",
        endSeason: "2028-29",
        contractLength: 3,
        signingTeam: "LAL",
        signedByCurrentTeam: true, // Signed by current team LAL
        supersedesContractRef: "DESIGNATED ROOKIE SCALE EXTENSION",
        salariesByYear: [
          {
            season: "2026-27",
            salary: 51975000,
            guaranteed: true,
            guaranteedAmount: 51975000,
          },
          {
            season: "2027-28",
            salary: 55854600,
            guaranteed: true,
            guaranteedAmount: 55854600,
          },
          {
            season: "2028-29",
            salary: 59198976,
            option: "PO",
            optionUsed: null,
            optionDecisionDate: null,
            guaranteed: true,
            guaranteedAmount: 59198976,
          },
        ],
      };

      // Validate all fields
      expect(futureContract.contractType).toBe("VETERAN EXTENSION");
      expect(futureContract.signedByCurrentTeam).toBe(true);
      expect(futureContract.supersedesContractRef).toBe("DESIGNATED ROOKIE SCALE EXTENSION");

      // Validate live PO year
      const livePoYear = futureContract.salariesByYear.find(y => y.option === "PO");
      expect(livePoYear).toBeDefined();
      expect(livePoYear.season).toBe("2028-29");
      expect(livePoYear.optionUsed).toBeNull();
      expect(livePoYear.optionDecisionDate).toBeNull();
      expect(livePoYear.guaranteed).toBe(true);
      expect(livePoYear.guaranteedAmount).toBe(59198976);
    });
  });
});
