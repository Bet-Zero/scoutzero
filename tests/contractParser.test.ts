import { describe, it, expect } from 'vitest';
import { parseContractSituation } from '@/shared/utils/contracts/contractParser';

describe('Contract Parser', () => {
  describe('parseContractSituation', () => {
    it('parses active standard contract with source cap %', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2023-24',
          endSeason: '2027-28',
          contractLength: 5,
          totalValue: 50000000,
          averageAnnualValue: 10000000,
          guaranteedValue: 50000000,
          guaranteedYears: 5,
          signedUsing: 'Bird Exception',
          signingDate: '2023-07-01',
          noTradeClause: false,
          tradeKicker: null,
          capPercentage: 25.1,
          salariesByYear: [
            { season: '2023-24', salary: 35000000, guaranteed: true, option: null },
            { season: '2024-25', salary: 37800000, guaranteed: true, option: null },
            { season: '2025-26', salary: 40600000, guaranteed: true, option: null },
            { season: '2026-27', salary: 43400000, guaranteed: true, option: null },
            { season: '2027-28', salary: 46200000, guaranteed: true, option: 'PO' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
            birdRights: 'Full Bird',
            capHold: 60000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');

      expect(result.playerId).toBe('test_player');
      expect(result.currentSeason).toBe('2025-26');
      expect(result.contracts).toHaveLength(1);

      const contract = result.contracts[0];
      expect(contract.docId).toBe('std_2023-24');
      expect(contract.kind).toBe('std');
      expect(contract.isExtension).toBe(false);
      expect(contract.startSeason).toBe('2023-24');
      expect(contract.endSeason).toBe('2027-28');
      expect(contract.status.isActive).toBe(true);
      expect(contract.status.isFuture).toBe(false);
      expect(contract.status.isExpired).toBe(false);

      // Check max contract detection with source cap %
      expect(contract.max.basis).toBe('source_estimate');
      expect(contract.max.firstYearCapPct).toBe(25.1);
      expect(contract.max.isMax).toBe(true);
      expect(contract.max.tierPercent).toBe(25);
      expect(contract.max.notes).toBe('Snapped within ±0.75%');
    });

    it('parses active + future extension with linking', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2023-24',
          endSeason: '2026-27',
          contractLength: 4,
          totalValue: 40000000,
          averageAnnualValue: 10000000,
          guaranteedValue: 40000000,
          guaranteedYears: 4,
          signedUsing: 'Bird Exception',
          signingDate: '2023-07-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2023-24', salary: 9000000, guaranteed: true, option: null },
            { season: '2024-25', salary: 9500000, guaranteed: true, option: null },
            { season: '2025-26', salary: 10000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 10500000, guaranteed: true, option: null },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2027,
            birdRights: 'Full Bird',
            capHold: 15000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
        futureContract: {
          contractType: 'EXTENSION',
          isExtension: true,
          startSeason: '2027-28',
          endSeason: '2030-31',
          contractLength: 4,
          totalValue: 60000000,
          averageAnnualValue: 15000000,
          guaranteedValue: 60000000,
          guaranteedYears: 4,
          signedUsing: 'Bird Exception',
          signingDate: '2024-12-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2027-28', salary: 13000000, guaranteed: true, option: null },
            { season: '2028-29', salary: 14000000, guaranteed: true, option: null },
            { season: '2029-30', salary: 15000000, guaranteed: true, option: null },
            { season: '2030-31', salary: 18000000, guaranteed: true, option: 'PO' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2031,
            birdRights: 'Full Bird',
            capHold: 20000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');

      expect(result.contracts).toHaveLength(2);

      const standard = result.contracts[0];
      const extension = result.contracts[1];

      expect(standard.docId).toBe('std_2023-24');
      expect(standard.kind).toBe('std');
      expect(standard.isExtension).toBe(false);
      expect(standard.extendedBy).toBe('ext_2027-28');
      expect(standard.contractGroupId).toBe('std_2023-24');

      expect(extension.docId).toBe('ext_2027-28');
      expect(extension.kind).toBe('ext');
      expect(extension.isExtension).toBe(true);
      expect(extension.extensionOf).toBe('std_2023-24');
      expect(extension.contractGroupId).toBe('std_2023-24');
      expect(extension.status.isActive).toBe(false);
      expect(extension.status.isFuture).toBe(true);
    });

    it('computes cap % when leagueCaps provided', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 40000000,
          averageAnnualValue: 13333333,
          guaranteedValue: 40000000,
          guaranteedYears: 3,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 44000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 46000000, guaranteed: true, option: 'PO' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
            birdRights: 'Full Bird',
            capHold: 55000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const leagueCaps = {
        '2025-26': 140000000,
      };

      const result = parseContractSituation(canonical, '2025-26', { leagueCaps });

      const contract = result.contracts[0];
      expect(contract.max.basis).toBe('computed');
      expect(contract.max.firstYearCapPct).toBeCloseTo(30.0, 1);
      expect(contract.max.isMax).toBe(true);
      expect(contract.max.tierPercent).toBe(30);
    });

    it('handles no cap info (neither source % nor cap table)', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 15000000,
          averageAnnualValue: 5000000,
          guaranteedValue: 15000000,
          guaranteedYears: 3,
          signedUsing: 'MLE',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2025-26', salary: 5000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 5000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 5000000, guaranteed: true, option: null },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
            birdRights: 'Early Bird',
            capHold: 7500000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');

      const contract = result.contracts[0];
      expect(contract.max.basis).toBe('unknown');
      expect(contract.max.firstYearCapPct).toBe(null);
      expect(contract.max.isMax).toBe(false);
      expect(contract.max.tierPercent).toBe(null);
    });

    it('validates type correctness of all fields', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 30000000,
          averageAnnualValue: 10000000,
          guaranteedValue: 30000000,
          guaranteedYears: 3,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: true,
          tradeKicker: 15,
          salariesByYear: [
            { season: '2025-26', salary: 10000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 10000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 10000000, guaranteed: false, option: 'TO' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
            birdRights: 'Full Bird',
            capHold: 15000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');
      const contract = result.contracts[0];

      // Verify types
      expect(typeof contract.docId).toBe('string');
      expect(typeof contract.kind).toBe('string');
      expect(typeof contract.isExtension).toBe('boolean');
      expect(typeof contract.contractType).toBe('string');
      expect(typeof contract.contractLength).toBe('number');
      expect(typeof contract.startSeason).toBe('string');
      expect(typeof contract.endSeason).toBe('string');
      expect(typeof contract.totalValue).toBe('number');
      expect(typeof contract.averageAnnualValue).toBe('number');
      expect(typeof contract.guaranteedValue).toBe('number');
      expect(typeof contract.guaranteedYears).toBe('number');
      expect(typeof contract.noTradeClause).toBe('boolean');
      expect(typeof contract.tradeKicker).toBe('number');

      // Verify status flags
      expect(typeof contract.status.isActive).toBe('boolean');
      expect(typeof contract.status.isFuture).toBe('boolean');
      expect(typeof contract.status.isExpired).toBe('boolean');

      // Verify salary rows have correct structure
      contract.salariesByYear.forEach((row) => {
        expect(row).toHaveProperty('season');
        expect(row).toHaveProperty('salary');
        expect(row).toHaveProperty('guaranteed');
        expect(row).toHaveProperty('option');
        expect(typeof row.season).toBe('string');
        expect(typeof row.salary).toBe('number');
        expect(typeof row.guaranteed).toBe('boolean');
        expect(['PO', 'TO', null].includes(row.option)).toBe(true);
      });
    });

    it('normalizes option values correctly', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 30000000,
          averageAnnualValue: 10000000,
          guaranteedValue: 20000000,
          guaranteedYears: 2,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2025-26', salary: 10000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 10000000, guaranteed: true, option: 'Player Option' },
            { season: '2027-28', salary: 10000000, guaranteed: false, option: 'Team Option' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
            birdRights: 'Full Bird',
            capHold: 15000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');
      const contract = result.contracts[0];

      expect(contract.salariesByYear[0].option).toBe(null);
      expect(contract.salariesByYear[1].option).toBe('PO');
      expect(contract.salariesByYear[2].option).toBe('TO');
    });

    it('handles contracts array format', () => {
      const canonical = {
        playerId: 'test_player',
        contracts: [
          {
            contractType: 'VETERAN CONTRACT',
            isExtension: false,
            startSeason: '2023-24',
            endSeason: '2026-27',
            contractLength: 4,
            totalValue: 40000000,
            averageAnnualValue: 10000000,
            guaranteedValue: 40000000,
            guaranteedYears: 4,
            signedUsing: 'Bird Exception',
            signingDate: '2023-07-01',
            noTradeClause: false,
            tradeKicker: null,
            salariesByYear: [
              { season: '2023-24', salary: 10000000, guaranteed: true, option: null },
              { season: '2024-25', salary: 10000000, guaranteed: true, option: null },
              { season: '2025-26', salary: 10000000, guaranteed: true, option: null },
              { season: '2026-27', salary: 10000000, guaranteed: true, option: null },
            ],
            freeAgency: {
              type: 'UFA',
              year: 2027,
            },
            source: {
              provider: 'SalarySwish',
              scrapedAt: '2025-01-01T00:00:00Z',
            },
          },
        ],
      };

      const result = parseContractSituation(canonical, '2025-26');
      expect(result.contracts).toHaveLength(1);
      expect(result.contracts[0].docId).toBe('std_2023-24');
    });

    it('correctly identifies 35% max contract tier', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2029-30',
          contractLength: 5,
          totalValue: 250000000,
          averageAnnualValue: 50000000,
          guaranteedValue: 250000000,
          guaranteedYears: 5,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          capPercentage: 35.2,
          salariesByYear: [
            { season: '2025-26', salary: 48000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 50000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 52000000, guaranteed: true, option: null },
            { season: '2028-29', salary: 54000000, guaranteed: true, option: null },
            { season: '2029-30', salary: 56000000, guaranteed: true, option: 'PO' },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2030,
            birdRights: 'Full Bird',
            capHold: 70000000,
            qualifyingOffer: null,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');
      const contract = result.contracts[0];

      expect(contract.max.isMax).toBe(true);
      expect(contract.max.tierPercent).toBe(35);
      expect(contract.max.firstYearCapPct).toBe(35.2);
      expect(contract.max.basis).toBe('source_estimate');
    });

    it('handles edge case where cap % is just outside tolerance', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 45000000,
          averageAnnualValue: 15000000,
          guaranteedValue: 45000000,
          guaranteedYears: 3,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          capPercentage: 24.0, // Outside ±0.75% of 25%
          salariesByYear: [
            { season: '2025-26', salary: 15000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 15000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 15000000, guaranteed: true, option: null },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');
      const contract = result.contracts[0];

      expect(contract.max.isMax).toBe(false);
      expect(contract.max.tierPercent).toBe(null);
      expect(contract.max.firstYearCapPct).toBe(24.0);
    });

    it('handles different season formats in input', () => {
      const canonical = {
        playerId: 'test_player',
        contract: {
          contractType: 'VETERAN CONTRACT',
          isExtension: false,
          startSeason: '2025', // Just year format
          endSeason: '2027-2028', // Full year format
          contractLength: 3,
          totalValue: 30000000,
          averageAnnualValue: 10000000,
          guaranteedValue: 30000000,
          guaranteedYears: 3,
          signedUsing: 'Bird Exception',
          signingDate: '2025-07-01',
          noTradeClause: false,
          tradeKicker: null,
          salariesByYear: [
            { season: '2025', salary: 10000000, guaranteed: true, option: null },
            { season: '2026-2027', salary: 10000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 10000000, guaranteed: true, option: null },
          ],
          freeAgency: {
            type: 'UFA',
            year: 2028,
          },
          source: {
            provider: 'SalarySwish',
            scrapedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      const result = parseContractSituation(canonical, '2025-26');
      const contract = result.contracts[0];

      // All seasons should be normalized to YYYY-YY format
      expect(contract.startSeason).toBe('2025-26');
      expect(contract.endSeason).toBe('2027-28');
      expect(contract.salariesByYear[0].season).toBe('2025-26');
      expect(contract.salariesByYear[1].season).toBe('2026-27');
      expect(contract.salariesByYear[2].season).toBe('2027-28');
    });
  });
});
