import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

type TradeTestPlayer = {
  name: string;
  salary: number;
  matchIncoming: number;
  matchOutgoing: number;
  isTwoWay: boolean;
  absorptionMode: 'MATCH';
  signAndTrade: boolean;
  contractYears: number;
  firstYearGuaranteed: boolean;
  isBYC?: boolean;
  previousSalary?: number;
  isPoisonPill?: boolean;
  currentSalary?: number;
  extensionYears?: Array<{ salary: number }>;
  contract: { salariesByYear: Array<{ season: string; salary: number }> };
};

type TradeTestTeam = {
  teamName: string;
  totalSalary: number;
  players: TradeTestPlayer[];
  picks: never[];
};

const makePlayer = (name: string, salary: number): TradeTestPlayer => ({
  name,
  salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: { salariesByYear: [{ season, salary }] },
});

const makeTeam = (
  name: string,
  totalSalary = 100_000_000,
  rosterSize = 14
): TradeTestTeam => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

describe('order of operations: conversions before matching', () => {
  it('BYC conversion runs before matching', () => {
    const bycPlayer = {
      name: 'BYC Guy',
      salary: 10_000_000,
      isBYC: true,
      previousSalary: 9_000_000,
      matchIncoming: 10_000_000,
      matchOutgoing: 5_000_000,
      isTwoWay: false,
      absorptionMode: 'MATCH' as const,
      signAndTrade: false,
      contractYears: 1,
      firstYearGuaranteed: true,
      contract: { salariesByYear: [{ season, salary: 10_000_000 }] },
    };

    const teamA = makeTeam('A');
    const teamB = makeTeam('B');
    teamA.players.push(bycPlayer);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [bycPlayer], picksOut: [] },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Test expects BYC conversion to set outgoing matching to previousSalary (9M)
    // The computation should happen before salary matching validation
    expect(res.teamResults[0].salaryOut).toBe(9_000_000);
  });

  it('poison pill average runs before matching', () => {
    const ppPlayer = {
      name: 'PP Player',
      salary: 10_000_000,
      isPoisonPill: true,
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
      matchIncoming: 4_000_000,
      matchOutgoing: 10_000_000,
      isTwoWay: false,
      absorptionMode: 'MATCH' as const,
      signAndTrade: false,
      contractYears: 1,
      firstYearGuaranteed: true,
      contract: { salariesByYear: [{ season, salary: 10_000_000 }] },
    };

    const teamA = makeTeam('A');
    const teamB = makeTeam('B');
    teamB.players.push(ppPlayer);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [ppPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Test expects poison pill average (4M + 30M) / 4 = 8.5M for incoming matching
    // The computation should happen before salary matching validation
    expect(res.teamResults[0].salaryIn).toBe(8_500_000);
  });
});
