/****************  SCSP™ BLOCK: tradeSalaryMatching.test.js  ****************
 * FULL REWRITE – drop this file into src/tests/tradeSalaryMatching.test.js
 * Purpose: unit-test the new salary-matching math (tiers + margin logic)
 * ----------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import {
  calculateAllowableIncoming,
  getIncomingCeiling,
} from '@/utils/architect/tradeHelpers';

// 🔧 simple mock cap figures for the 2025 season
const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

/* --------------------------------------------------------------------------
   Salary-matching tiers
--------------------------------------------------------------------------- */
describe('CBA salary-matching tiers', () => {
  it('Tier 1 – ≤ $7.5 M uses 200 %', () => {
    const ceiling = getIncomingCeiling(150_000_000, 7_000_000, [], capSettings);
    expect(ceiling).toBe(14_000_000); // 7 M × 2.0
  });

  it('Tier 2 – 175 % + $100 k for $8-29 M', () => {
    const ceiling = getIncomingCeiling(
      150_000_000,
      20_000_000,
      [],
      capSettings
    );
    expect(ceiling).toBe(35_100_000); // 20 M × 1.75 + 0.1 M
  });

  it('Tier 3 – ≥ $29 M adds flat $5 M', () => {
    const ceiling = getIncomingCeiling(
      150_000_000,
      30_000_000,
      [],
      capSettings
    );
    expect(ceiling).toBe(35_000_000); // 30 M + 5 M
  });

  it('Second-apron teams capped at 110 %', () => {
    const ceiling = getIncomingCeiling(
      183_000_000,
      25_000_000,
      [],
      capSettings
    );
    expect(ceiling).toBeCloseTo(27_500_000); // 25 M × 1.10
  });
});

/* --------------------------------------------------------------------------
   calculateAllowableIncoming returns *margin* (ceiling − payroll)
--------------------------------------------------------------------------- */
describe('calculateAllowableIncoming returns MARGIN', () => {
  it('returns a positive value when payroll < ceiling', () => {
    const teamPay = 140_000_000; // below salary cap
    const salaryOut = 10_000_000; // Tier 2 math irrelevant (cap-space team)
    const margin = calculateAllowableIncoming(
      teamPay,
      salaryOut,
      [],
      [],
      capSettings
    );
    expect(margin).toBe(1_000_000); // 141 M cap − 140 M payroll
  });

  it('returns 0 when payroll already ≥ ceiling', () => {
    const teamPay = 160_000_000; // over cap and over Tier-1 ceiling
    const salaryOut = 7_000_000;
    const margin = calculateAllowableIncoming(
      teamPay,
      salaryOut,
      [],
      [],
      capSettings
    );
    expect(margin).toBe(0);
  });
});

/**************** END SCSP™ BLOCK: tradeSalaryMatching.test.js  *************/
