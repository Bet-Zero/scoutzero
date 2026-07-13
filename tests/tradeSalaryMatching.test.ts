/****************  SCSP™ BLOCK: tradeSalaryMatching.test.js  ****************
 * Validates 2025 tier math + apron limiter + margin return value
 * ----------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import {
  calculateAllowableIncoming,
  getIncomingCeiling,
} from '@/features/architect/utils/tradeHelpers';

const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

describe('CBA salary-matching tiers (2026-27)', () => {
  it('Band 1 – ≤ BAND1 uses 200% + $250k', () => {
    expect(getIncomingCeiling(150_000_000, 6_000_000, [], capSettings)).toBe(
      12_250_000
    ); // 6 M × 2.0 + 0.25 M
  });

  it('Band 2 – between thresholds adds the expanded TPE', () => {
    expect(getIncomingCeiling(150_000_000, 10_000_000, [], capSettings)).toBe(
      19_096_000
    ); // 10 M + 9.096 M (2026-27 expanded TPE)
  });

  it('Band 3 – above upper threshold uses 125% + $250k', () => {
    expect(getIncomingCeiling(150_000_000, 40_000_000, [], capSettings)).toBe(
      50_250_000
    ); // 40 M × 1.25 + 0.25 M
  });

  it('Second-apron teams capped at 100 %', () => {
    expect(getIncomingCeiling(183_000_000, 25_000_000, [], capSettings)).toBe(
      25_000_000
    ); // 25 M × 1.00
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
    // $7M outgoing is in Band 1 (≤ $8.846M): 7M × 2 + 0.25M = 14.25M ceiling.
    expect(margin).toBe(7_250_000); // 14.25 M ceiling – 7 M outgoing
  });
});
/**************** END SCSP™ BLOCK: tradeSalaryMatching.test.js  *************/
