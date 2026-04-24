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

describe('Trade kicker with zero guaranteed money', () => {
  it('should not add trade kicker when remainingGuaranteedOnCurrentContract is 0', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 0, // Explicitly zero - no guarantees
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
    });

    // With 0 guaranteed money, no kicker should be added
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(10_000_000); // Should NOT include kicker
  });

  it('should add trade kicker when remainingGuaranteedOnCurrentContract is undefined', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      // remainingGuaranteedOnCurrentContract not set - should fall back to currentSalary
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
    });

    // With undefined guaranteed money, should fall back to using currentSalary
    // and calculate full kicker (15% of 10M = 1.5M)
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(11_500_000); // Should include full kicker
  });

  it('should add trade kicker when remainingGuaranteedOnCurrentContract has value', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 20_000_000, // Has guarantees
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
    });

    // With guaranteed money > salary, full kicker should apply
    // Kicker: 15% of 20M = 3M, capped by maxKicker (Infinity by default)
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(13_000_000); // Should include kicker based on guaranteed amount
  });

  it('should respect trade kicker maximum even with high guarantees', () => {
    const player = makePlayer({
      salary: 10_000_000,
      tradeKickerPct: 0.15,
      remainingGuaranteedOnCurrentContract: 50_000_000,
      tradeKicker: {
        percentage: 0.15,
        maximum: 2_000_000, // Cap at 2M
      },
    });
    computeMatchingValues({
      teams: [{ sends: [player] }],
      yearKey,
    });

    // Raw kicker would be 15% of 50M = 7.5M, but capped at 2M max
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(12_000_000); // 10M + 2M (capped)
  });
});
