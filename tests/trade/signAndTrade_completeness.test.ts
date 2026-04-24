import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
} from '@/features/architect/utils/tradeMachine/constants/types';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

type ValidateTradeParams = Parameters<typeof validateTrade>[0];
type TradeSlot = NonNullable<NonNullable<ValidateTradeParams['teams']>[number]>;
type TradeTeamData = NonNullable<TradeSlot['team']>;
type TestTradePlayer = TradeExceptionPlayer &
  Pick<
    NormalizedPlayer,
    | 'name'
    | 'salary'
    | 'matchIncoming'
    | 'matchOutgoing'
    | 'isTwoWay'
    | 'absorptionMode'
    | 'signAndTrade'
    | 'contractYears'
    | 'firstYearGuaranteed'
  > & {
    id: string;
    player_id: string;
    originTeamId: string;
    contract: {
      salariesByYear: Array<{
        season: string;
        salary: number;
      }>;
    };
  };
type TestTradeTeamData = TradeTeamData & {
  players: TestTradePlayer[];
  picks: unknown[];
};

const makePlayer = (
  name: string,
  salary: number,
  {
    signAndTrade = false,
    contractYears = 4,
    firstYearGuaranteed = true,
    originTeamId = 'A',
  }: Partial<TestTradePlayer> = {}
): TestTradePlayer => ({
  id: name,
  player_id: name,
  name,
  salary,
  currentSalary: salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade,
  contractYears,
  firstYearGuaranteed,
  originTeamId,
  contract: { salariesByYear: [{ season, salary }] },
});

const makeTeam = (
  id: string,
  totalSalary: number,
  extra: Partial<TestTradeTeamData> = {}
): TestTradeTeamData => ({
  id,
  teamId: id,
  teamCode: id,
  teamName: id,
  nickname: id,
  totalSalary,
  teamTotalSalary: totalSalary,
  picks: [],
  draftPicks: [],
  players: Array.from({ length: 14 }, (_, i) =>
    makePlayer(`${id}${i}`, 1_000_000, { originTeamId: id })
  ),
  ...extra,
});

const makeValidateTradeParams = (
  teamA: TestTradeTeamData,
  teamB: TestTradeTeamData,
  sat: TestTradePlayer,
  other: TestTradePlayer,
  offseason: boolean
): ValidateTradeParams => ({
  teams: [
    { team: teamA, sends: [sat], picksOut: [] },
    { team: teamB, sends: [other], picksOut: [] },
  ] as ValidateTradeParams['teams'],
  capProjections,
  currentYear,
  tradeCtx: { offseason },
});

describe('sign-and-trade completeness', () => {
  it('rejects invalid contract years', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, {
      signAndTrade: true,
      contractYears: 2,
      originTeamId: 'A',
    });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, true)
    );

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects non-guaranteed first year', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, {
      signAndTrade: true,
      firstYearGuaranteed: false,
      originTeamId: 'A',
    });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, true)
    );

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects sign-and-trade from non-origin team', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, {
      signAndTrade: true,
      originTeamId: 'C',
    });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, true)
    );

    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects sign-and-trade outside offseason', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, {
      signAndTrade: true,
      originTeamId: 'A',
    });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, false)
    );

    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects teams using taxpayer MLE from receiving S&T players', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000, {
      usedTaxpayerMLEThisSeason: true,
    });
    const sat = makePlayer('SAT', 10_000_000, {
      signAndTrade: true,
      originTeamId: 'A',
    });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, true)
    );

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('enforces hard cap after sign-and-trade', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 171_000_000);
    const sat = makePlayer('SAT', 20_000_000, {
      signAndTrade: true,
      originTeamId: 'A',
    });
    const b = makePlayer('B1', 1_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade(
      makeValidateTradeParams(teamA, teamB, sat, b, true)
    );

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    expect(result.teamResults[1].hardCapped).toBe(true);
  });
});
