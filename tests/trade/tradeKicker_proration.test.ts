import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';

const yearKey = 2025;
const season = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

type ComputeMatchingValuesParams = Parameters<typeof computeMatchingValues>[0];
type MatchingPlayer = NonNullable<
  NonNullable<NonNullable<ComputeMatchingValuesParams['teams']>[number]['sends']>[number]
>;

type TradeKickerPlayerOverrides = Partial<MatchingPlayer> & {
  salary?: number;
};

const makePlayer = (
  overrides: TradeKickerPlayerOverrides = {}
): MatchingPlayer => ({
  name: 'Player',
  salary: overrides.salary ?? 0,
  currentSalary: overrides.salary ?? 0,
  contract: {
    salariesByYear: [{ season, salary: overrides.salary ?? 0 }],
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
