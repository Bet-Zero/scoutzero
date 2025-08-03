/****************  SCSP™ BLOCK: tradeSalaryMatching.test.js  ****************
 * Validates 2025 tier math + 110 % apron limiter + margin return value
 * ----------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import {
  calculateAllowableIncoming,
  getIncomingCeiling,
} from '@/utils/architect/tradeHelpers';

const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

describe('CBA salary-matching tiers (2025)', () => {
  it('Tier 1 – ≤ $7.5 M uses 200 %', () => {
    expect(getIncomingCeiling(150_000_000, 7_000_000, [], capSettings)).toBe(
      14_000_000
    ); // 7 M × 2.0
  });

  it('Tier 2 – 175 % + $100 k for $8-14.6 M', () => {
    expect(getIncomingCeiling(150_000_000, 10_000_000, [], capSettings)).toBe(
      17_600_000
    ); // 10 M × 1.75 + 0.1 M
  });

  it('Tier 3 – ≥ $14.62 M adds flat $5 M', () => {
    expect(getIncomingCeiling(150_000_000, 20_000_000, [], capSettings)).toBe(
      25_000_000
    ); // 20 M + 5 M
  });

  it('Second-apron teams capped at 110 %', () => {
    expect(getIncomingCeiling(183_000_000, 25_000_000, [], capSettings)).toBe(
      27_500_000
    ); // 25 M × 1.10
  });
});

describe('calculateAllowableIncoming returns *margin*', () => {
  it('Cap-space team: cap minus payroll', () => {
    const margin = calculateAllowableIncoming(
      140_000_000,
      10_000_000,
      [],
      [],
      capSettings
    );
    expect(margin).toBe(1_000_000); // 141 M – 140 M
  });

  it('Over-cap team: ceiling minus outgoing', () => {
    const margin = calculateAllowableIncoming(
      160_000_000,
      7_000_000,
      [],
      [],
      capSettings
    );
    expect(margin).toBe(7_000_000); // 14 M ceiling – 7 M outgoing
  });
});
/**************** END SCSP™ BLOCK: tradeSalaryMatching.test.js  *************/
