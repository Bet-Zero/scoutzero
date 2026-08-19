import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';

const yearKey = 2025;
const season = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

type ComputeMatchingValuesParams = Parameters<typeof computeMatchingValues>[0];
type MatchingPlayer = NonNullable<
  NonNullable<NonNullable<ComputeMatchingValuesParams['teams']>[number]['sends']>[number]
>;
type ExtensionYear = NonNullable<MatchingPlayer['extensionYears']>[number];

type PoisonPillPlayerInput = {
  currentSalary: number;
  extensionYears?: ExtensionYear[];
  isBYC?: boolean;
  previousSalary?: number;
  newSalary?: number;
};

const makePlayer = ({
  currentSalary,
  extensionYears = [],
  isBYC = false,
  previousSalary,
  newSalary,
}: PoisonPillPlayerInput): MatchingPlayer => ({
  name: 'PP Player',
  salary: currentSalary,
  isPoisonPill: true,
  currentSalary,
  extensionYears,
  isBYC,
  previousSalary,
  newSalary,
  contract: {
    salariesByYear: [
      { season, salary: newSalary ?? extensionYears[0]?.salary ?? currentSalary },
    ],
  },
});

describe('Poison Pill matching values', () => {
  it('uses average of current plus extension for incoming', () => {
    const player = makePlayer({
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(4_000_000);
    expect(player.matchIncoming).toBe(8_500_000);
  });

  it('defaults to current salary when no extension years', () => {
    const player = makePlayer({ currentSalary: 4_000_000 });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(4_000_000);
    expect(player.matchIncoming).toBe(4_000_000);
  });

  it('uses the governed future Contract when legacy extension years are absent', () => {
    const player = makePlayer({ currentSalary: 4_000_000 });
    player.futureContract = {
      isExtension: true,
      salariesByYear: [
        { season: '2025-26', salary: 10_000_000 },
        { season: '2026-27', salary: 10_000_000 },
        { season: '2027-28', salary: 10_000_000 },
      ],
    };

    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });

    expect(player.matchOutgoing).toBe(4_000_000);
    expect(player.matchIncoming).toBe(8_500_000);
  });

  it('coexists with BYC for outgoing', () => {
    const player = makePlayer({
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
      isBYC: true,
      previousSalary: 4_000_000,
      newSalary: 10_000_000,
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(5_000_000); // BYC max(prior, 50% new)
    expect(player.matchIncoming).toBe(8_500_000);
  });
});
