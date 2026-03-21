/**
 * FILE: src/tests/architect/sharedContractParser.behavior.test.ts
 * PURPOSE: Focused node-side behavior coverage for the migrated shared contract parser authority and shim.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added representative parser behavior and export-surface coverage for contractParser migration.
 */

import { describe, expect, it } from 'vitest';
import * as ContractParserModule from '@/shared/utils/contracts/contractParser';
import { parseContractSituation } from '@/shared/utils/contracts/contractParser';

const contractParserAuthoritySpecifier =
  '../../shared/utils/contracts/contractParser.ts';
const contractParserExplicitShimSpecifier =
  '../../shared/utils/contracts/contractParser.js';

describe('Architect shared contract parser behavior', () => {
  it('retains the named-only export surface across extensionless, authority, and explicit shim imports', async () => {
    const authorityModule = await import(contractParserAuthoritySpecifier);
    const explicitShimModule = await import(contractParserExplicitShimSpecifier);

    expect(Object.keys(ContractParserModule).sort()).toEqual([
      'parseContractSituation',
    ]);
    expect(Object.keys(authorityModule).sort()).toEqual([
      'parseContractSituation',
    ]);
    expect(Object.keys(explicitShimModule).sort()).toEqual([
      'parseContractSituation',
    ]);
    expect('default' in ContractParserModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
    expect('default' in explicitShimModule).toBe(false);
    expect(ContractParserModule.parseContractSituation).toBe(
      parseContractSituation
    );
    expect(authorityModule.parseContractSituation).toBe(parseContractSituation);
    expect(explicitShimModule.parseContractSituation).toBe(
      parseContractSituation
    );
  });

  it('normalizes representative contract fields and source-based max detection', () => {
    const canonical = {
      playerId: 'test_player',
      contract: {
        contractType: 'VETERAN CONTRACT',
        isExtension: false,
        startSeason: '2025',
        endSeason: '2027-2028',
        contractLength: '3',
        totalValue: '30000000',
        averageAnnualValue: '10000000',
        guaranteedValue: '20000000',
        guaranteedYears: '2',
        signedUsing: 'early bird rights',
        signingDate:
          'Tue Jul 01 2025 12:00:00 GMT+0000 (Coordinated Universal Time)',
        noTradeClause: 1,
        tradeKicker: '15',
        capPercentage: 35.2,
        salariesByYear: [
          {
            season: '2025',
            salary: '10000000',
            guaranteed: true,
            option: null,
          },
          {
            season: '2026-2027',
            salary: '10000000',
            guaranteed: true,
            option: 'Player Option',
          },
          {
            season: '2027-28',
            salary: '10000000',
            guaranteed: false,
            option: 'Team Option',
          },
        ],
        freeAgency: {
          freeAgentType: 'UFA',
          freeAgentYear: 2028,
          birdRights: { status: 'Full Bird' },
          capHold: '15000000',
          qualifyingOffer: '2500000',
        },
        source: {
          provider: 'SalarySwish',
          scrapedAt: '2025-01-01T00:00:00Z',
        },
      },
    };

    const result = parseContractSituation(canonical, '2025-26');
    const contract = result.contracts[0];

    expect(result.playerId).toBe('test_player');
    expect(result.currentSeason).toBe('2025-26');
    expect(contract.docId).toBe('std_2025-26');
    expect(contract.startSeason).toBe('2025-26');
    expect(contract.endSeason).toBe('2027-28');
    expect(contract.contractLength).toBe(3);
    expect(contract.totalValue).toBe(30000000);
    expect(contract.guaranteedYears).toBe(2);
    expect(contract.signedUsing).toBe('Early Bird Exception');
    expect(contract.signingDate).toBe('2025-07-01');
    expect(contract.noTradeClause).toBe(true);
    expect(contract.tradeKicker).toBe(15);
    expect(contract.salariesByYear[0].season).toBe('2025-26');
    expect(contract.salariesByYear[1].option).toBe('PO');
    expect(contract.salariesByYear[2].option).toBe('TO');
    expect(contract.freeAgency).toEqual({
      type: 'UFA',
      year: 2028,
      birdRights: 'Full Bird',
      capHold: 15000000,
      qualifyingOffer: 2500000,
    });
    expect(contract.max.isMax).toBe(true);
    expect(contract.max.tierPercent).toBe(35);
    expect(contract.max.firstYearCapPct).toBe(35.2);
    expect(contract.max.basis).toBe('source_estimate');
  });

  it('infers future extensions and links them to the prior standard contract', () => {
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
        },
        source: {
          provider: 'SalarySwish',
          scrapedAt: '2025-01-01T00:00:00Z',
        },
      },
      futureContract: {
        contractType: 'EXTENSION',
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
        },
        source: {
          provider: 'SalarySwish',
          scrapedAt: '2025-01-01T00:00:00Z',
        },
      },
    };

    const result = parseContractSituation(canonical, '2025-26');
    const standardContract = result.contracts[0];
    const extensionContract = result.contracts[1];

    expect(result.contracts).toHaveLength(2);
    expect(standardContract.docId).toBe('std_2023-24');
    expect(standardContract.extendedBy).toBe('ext_2027-28');
    expect(standardContract.contractGroupId).toBe('std_2023-24');
    expect(extensionContract.docId).toBe('ext_2027-28');
    expect(extensionContract.isExtension).toBe(true);
    expect(extensionContract.extensionOf).toBe('std_2023-24');
    expect(extensionContract.contractGroupId).toBe('std_2023-24');
    expect(extensionContract.status.isFuture).toBe(true);
  });

  it('preserves fallback and computed-max behavior when source fields are missing', () => {
    const canonical = {
      playerId: 'fallback_player',
      contracts: [
        {
          startSeason: '2025-26',
          endSeason: '2027-28',
          contractLength: 3,
          totalValue: 45000000,
          averageAnnualValue: 15000000,
          guaranteedValue: 45000000,
          guaranteedYears: 3,
          signedUsing: 'mle',
          signingDate: 'invalid date value',
          salariesByYear: [
            { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
            { season: '2026-27', salary: 44000000, guaranteed: true, option: null },
            { season: '2027-28', salary: 46000000, guaranteed: true, option: null },
          ],
          freeAgency: {},
        },
      ],
    };

    const result = parseContractSituation(canonical, '2025-26', {
      leagueCaps: {
        '2025-26': 140000000,
      },
    });
    const contract = result.contracts[0];

    expect(contract.contractType).toBe('VETERAN CONTRACT');
    expect(contract.signedUsing).toBe('Mid-Level Exception');
    expect(contract.signingDate).toBe(null);
    expect(contract.noTradeClause).toBe(false);
    expect(contract.tradeKicker).toBe(null);
    expect(contract.source).toEqual({
      provider: 'Unknown',
      scrapedAt: null,
    });
    expect(contract.freeAgency).toEqual({
      type: null,
      year: null,
      birdRights: null,
      capHold: null,
      qualifyingOffer: null,
    });
    expect(contract.max.basis).toBe('computed');
    expect(contract.max.isMax).toBe(true);
    expect(contract.max.tierPercent).toBe(30);
    expect(contract.max.firstYearCapPct).toBe(30);
  });
});
