import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/utils/architect/tradeMachine/utils/matchingValues.js';

const yearKey = 2025;

const makePlayer = (overrides = {}) => ({
  name: 'Player',
  contract_clean: {
    salaries_by_year: {
      [yearKey]: { salary: overrides.salary ?? 0 },
    },
  },
  ...overrides,
});

describe('Trade kicker proration', () => {
  it('adds prorated kicker to incoming only', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 20_000_000,
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
      daysRemainingInSeason: 41,
      daysInSeason: 82,
    });
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(11_500_000);
  });

  it('handles partial waivers', () => {
    const player = makePlayer({
      salary: 5_000_000,
      tradeKickerPct: 0.1,
      tradeKickerWaivedPct: 0.5,
      remainingGuaranteedOnCurrentContract: 10_000_000,
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
      daysRemainingInSeason: 82,
      daysInSeason: 82,
    });
    expect(player.matchOutgoing).toBe(5_000_000);
    expect(player.matchIncoming).toBe(5_500_000);
  });

  it('coexists with BYC', () => {
    const player = makePlayer({
      salary: 10_000_000,
      isBYC: true,
      previousSalary: 4_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 20_000_000,
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
      daysRemainingInSeason: 82,
      daysInSeason: 82,
    });
    expect(player.matchOutgoing).toBe(5_000_000);
    expect(player.matchIncoming).toBe(13_000_000);
  });

  it('defaults to full proration when timing missing', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 20_000_000,
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(13_000_000);
  });
});
