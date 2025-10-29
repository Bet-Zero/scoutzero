// playerSchemaValidation.test.js
// Test to validate that the player schema accepts null for canBeTradedNow

import { describe, it, expect } from 'vitest';
import { basePlayerSchema } from '../player-scrape/shared/schema/player_scrape_schema.ts';

describe('Player Schema Validation - Trade Eligibility', () => {
  const basePlayerData = {
    playerId: 'test-player-123',
    displayName: 'Test Player',
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    bio: {
      position: 'PG',
      height: '6-3',
      weight: '195',
      age: 25,
      birthdate: '1999-01-01',
      experience: 3,
    },
    contract: {
      contractType: 'VETERAN CONTRACT',
      isExtension: false,
      isRookieScale: false,
      startSeason: '2024-25',
      endSeason: '2027-28',
      contractLength: 4,
      yearsRemaining: 3,
      totalValue: 40000000,
      averageAnnualValue: 10000000,
      guaranteedValue: 40000000,
      guaranteedYears: 4,
      salariesByYear: [
        {
          season: '2024-25',
          salary: 10000000,
          capHit: 10000000,
          guaranteed: true,
          guaranteedAmount: 10000000,
          option: null,
          optionUsed: null,
          optionDecisionDate: null,
          tradeBonus: null,
          incentives: { likely: 0, unlikely: 0 },
        },
      ],
      noTradeClause: false,
      tradeKicker: null,
      tradeRestrictions: [],
      birdRights: {
        status: 'Bird',
        yearsOfService: 3,
        yearsWithTeam: 3,
      },
      freeAgency: {
        type: 'UFA',
        year: 2028,
        capHold: 15000000,
        qualifyingOffer: null,
        earlyTerminationOption: null,
      },
      tradeEligibility: {
        canBeTradedNow: null, // This should now be valid
        restrictedUntil: null,
        reason: null,
        rules: {
          baseYearCompensation: false,
          poisonPill: false,
          aggregation: true,
        },
      },
    },
    source: {
      provider: 'SalarySwish',
      playerPageUrl: 'https://salaryswish.com/players/test-player',
      scrapedAt: '2025-10-29T00:00:00.000Z',
    },
    lastUpdated: '2025-10-29T00:00:00.000Z',
    version: '1.0',
  };

  it('should accept null for contract.tradeEligibility.canBeTradedNow', () => {
    const result = basePlayerSchema.safeParse(basePlayerData);
    
    if (!result.success) {
      console.error('Validation errors:', result.error.issues);
    }
    
    expect(result.success).toBe(true);
    expect(result.data?.contract.tradeEligibility.canBeTradedNow).toBeNull();
  });

  it('should REJECT true for contract.tradeEligibility.canBeTradedNow (must be null per spec)', () => {
    const dataWithTrue = {
      ...basePlayerData,
      contract: {
        ...basePlayerData.contract,
        tradeEligibility: {
          ...basePlayerData.contract.tradeEligibility,
          canBeTradedNow: true,
        },
      },
    };
    
    const result = basePlayerSchema.safeParse(dataWithTrue);
    // Per spec: canBeTradedNow MUST be null, not boolean
    expect(result.success).toBe(false);
  });

  it('should REJECT false for contract.tradeEligibility.canBeTradedNow (must be null per spec)', () => {
    const dataWithFalse = {
      ...basePlayerData,
      contract: {
        ...basePlayerData.contract,
        tradeEligibility: {
          ...basePlayerData.contract.tradeEligibility,
          canBeTradedNow: false,
        },
      },
    };
    
    const result = basePlayerSchema.safeParse(dataWithFalse);
    // Per spec: canBeTradedNow MUST be null, not boolean
    expect(result.success).toBe(false);
  });

  it('should accept null for futureContract.tradeEligibility.canBeTradedNow', () => {
    const dataWithFutureContract = {
      ...basePlayerData,
      futureContract: {
        ...basePlayerData.contract,
        contractType: 'EXTENSION',
        isExtension: true,
        startSeason: '2028-29',
        endSeason: '2032-33',
        contractLength: 5,
        yearsRemaining: 5,
        tradeEligibility: {
          canBeTradedNow: null, // This should also be valid
          restrictedUntil: null,
          reason: null,
          rules: {
            baseYearCompensation: false,
            poisonPill: false,
            aggregation: true,
          },
        },
      },
    };
    
    const result = basePlayerSchema.safeParse(dataWithFutureContract);
    
    if (!result.success) {
      console.error('Validation errors:', result.error.issues);
    }
    
    expect(result.success).toBe(true);
    expect(result.data?.futureContract?.tradeEligibility.canBeTradedNow).toBeNull();
  });

  it('should still enforce other required fields in tradeEligibility', () => {
    const dataWithMissingRules = {
      ...basePlayerData,
      contract: {
        ...basePlayerData.contract,
        tradeEligibility: {
          canBeTradedNow: null,
          restrictedUntil: null,
          reason: null,
          // Missing rules field - should fail
        },
      },
    };
    
    const result = basePlayerSchema.safeParse(dataWithMissingRules);
    expect(result.success).toBe(false);
  });

  it('should still enforce boolean type for rules fields', () => {
    const dataWithInvalidRules = {
      ...basePlayerData,
      contract: {
        ...basePlayerData.contract,
        tradeEligibility: {
          canBeTradedNow: null,
          restrictedUntil: null,
          reason: null,
          rules: {
            baseYearCompensation: 'invalid', // Should be boolean
            poisonPill: false,
            aggregation: true,
          },
        },
      },
    };
    
    const result = basePlayerSchema.safeParse(dataWithInvalidRules);
    expect(result.success).toBe(false);
  });
});
