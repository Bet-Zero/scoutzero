/********************  SCSP™ BLOCK: tradeHelpers.test.js  ********************
 * ------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import {
  getSalaryForYear,
  areSamePick,
  calculateAllowableIncoming,
} from '@/utils/architect/tradeHelpers';

// 🔧  simple mock cap settings for 2025 season
const settings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

/* --------------------------------------------------------------------------
   getSalaryForYear
--------------------------------------------------------------------------- */
describe('getSalaryForYear', () => {
  const year = 2025;

  it('extracts capHit from contract.salariesByYear', () => {
    const p = {
      contract: {
        salariesByYear: [
          { season: '2024-25', capHit: 12_000_000, salary: 10_000_000 },
        ],
      },
    };
    expect(getSalaryForYear(p, year)).toBe(12_000_000);
  });

  it('adds likely incentives to base salary when no capHit is present', () => {
    const p = {
      contract: {
        salariesByYear: [
          {
            season: '2024-25',
            salary: 5_000_000,
            incentives: { likely: 500_000 },
          },
        ],
      },
    };
    expect(getSalaryForYear(p, year)).toBe(5_500_000);
  });

  it('falls back to salary property when contract data missing', () => {
    const p = { salary: 8_500_000 };
    expect(getSalaryForYear(p, year)).toBe(8_500_000);
  });
});

/* --------------------------------------------------------------------------
   areSamePick
--------------------------------------------------------------------------- */
describe('areSamePick', () => {
  it('matches picks with numeric and string values', () => {
    const pickA = { year: 2029, round: 1, pick: 3 };
    const pickB = { year: '2029', round: '1', pick: '3' };
    expect(areSamePick(pickA, pickB)).toBe(true);
  });
});

/* --------------------------------------------------------------------------
   calculateAllowableIncoming
--------------------------------------------------------------------------- */
describe('calculateAllowableIncoming', () => {
  it('includes TPE amounts', () => {
    // mock TPE uses .remaining like live data
    const tpe = { remaining: 5_000_000, expired: false };
    const allowable = calculateAllowableIncoming(
      160_000_000, // teamTotalSalary (already over cap)
      0, // salaryOut
      [], // incomingPlayers
      [tpe], // tradeExceptions
      settings
    );
    expect(allowable).toBe(5_000_000); // margin now equals TPE value
  });
});

/******************  END SCSP™ BLOCK: tradeHelpers.test.js  ******************/
