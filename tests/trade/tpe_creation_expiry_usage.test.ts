import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
  TradeExceptionRecord,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const DEFAULT_CURRENT_YEAR = 2025;
const DEFAULT_TRADE_DATE = '2025-07-01T00:00:00.000Z';

type ValidateTradeParams = Parameters<typeof validateTrade>[0];
type TradeSlot = NonNullable<NonNullable<ValidateTradeParams['teams']>[number]>;
type TradeTeamData = NonNullable<TradeSlot['team']>;
type SalaryRow = {
  season: string;
  salary: number;
};
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
    contract: {
      salariesByYear: SalaryRow[];
    };
  };
type TestTradeTeamData = TradeTeamData & {
  players: TestTradePlayer[];
  roster: string[];
};

const seasonForYear = (year: number) => `${year - 1}-${String(year).slice(-2)}`;

const requireValue = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const makePlayer = (
  name: string,
  salary: number,
  extra: Partial<TestTradePlayer> = {},
  year = DEFAULT_CURRENT_YEAR
): TestTradePlayer => ({
  id: name,
  player_id: name,
  name,
  salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: { salariesByYear: [{ season: seasonForYear(year), salary }] },
  ...extra,
});

const makeTeam = (
  name: string,
  totalSalary: number,
  rosterSize = 14,
  year = DEFAULT_CURRENT_YEAR
): TestTradeTeamData => ({
  id: name,
  teamId: name,
  teamCode: name,
  teamName: name,
  nickname: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  draftPicks: [],
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000, {}, year)
  ),
  roster: Array.from({ length: rosterSize }, (_, i) => `${name}${i}`),
  picks: [],
});

const makeHeldTpe = (
  id: string,
  amount: number,
  expiresOn: string,
  createdSeason: number
): TradeExceptionRecord => ({
  id,
  amount,
  totalAmount: amount,
  remaining: amount,
  remainingAmount: amount,
  expiresOn,
  expirationDate: expiresOn,
  createdSeason,
});

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

const makeValidateTradeParams = (
  teamA: TestTradeTeamData,
  teamB: TestTradeTeamData,
  outgoing: TestTradePlayer[],
  incoming: TestTradePlayer[],
  currentYear: number,
  tradeDate: string
): ValidateTradeParams => ({
  teams: [
    { team: teamA, sends: outgoing, picksOut: [] },
    { team: teamB, sends: incoming, picksOut: [] },
  ] as ValidateTradeParams['teams'],
  capProjections,
  currentYear,
  tradeCtx: { tradeDate },
});

describe('TPE creation and usage', () => {
  it('creates a TPE when sending out more salary than received', () => {
    const currentYear = DEFAULT_CURRENT_YEAR;
    const tradeDate = DEFAULT_TRADE_DATE;
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const outgoing = {
      ...makePlayer('Out', 18_000_000, { toTeamId: 'B' }, currentYear),
    };
    const incoming = {
      ...makePlayer('In', 10_000_000, { fromTeamId: 'B' }, currentYear),
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const res = validateTrade(
      makeValidateTradeParams(teamA, teamB, [outgoing], [incoming], currentYear, tradeDate)
    );

    const tpe = requireValue(res.teamResults[0].createdTPE, 'createdTPE');
    expect(tpe.amount).toBe(8_000_000);
    const expiry = new Date(requireValue(tpe.expiresOn, 'createdTPE.expiresOn'));
    const expected = new Date(tradeDate);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(expiry.getUTCFullYear()).toBe(expected.getUTCFullYear());
  });

  it('allows a historical team-held TPE when canonical tradeDate is before expiry', () => {
    const currentYear = 2025;
    const tradeDate = '2025-07-15T00:00:00.000Z';
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'historic-tpe',
      5_000_000,
      '2025-08-01T00:00:00.000Z',
      2025
    );
    teamA.exceptions = { tpe: [tpe] };

    const incoming = {
      ...makePlayer(
        'In',
        4_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'historic-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
    };
    teamB.players.push(incoming);

    const res = validateTrade(
      makeValidateTradeParams(teamA, teamB, [], [incoming], currentYear, tradeDate)
    );

    expect(res.teamResults[0].legal).toBe(true);
    expect(res.teamResults[0].rules.tradeExceptions.passed).toBe(true);
    expect(issueTexts(res.teamResults[0].rules.tradeExceptions.violations)).toEqual(
      []
    );
  });

  it('rejects an expired tpeId using the canonical future tradeDate', () => {
    const currentYear = 2026;
    const tradeDate = '2026-06-15T00:00:00.000Z';
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'future-expired-tpe',
      5_000_000,
      '2026-05-15T00:00:00.000Z',
      2026
    );
    teamA.exceptions = { tpe: [tpe] };

    const incoming = {
      ...makePlayer(
        'In',
        4_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'future-expired-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
    };
    teamB.players.push(incoming);

    const res = validateTrade(
      makeValidateTradeParams(teamA, teamB, [], [incoming], currentYear, tradeDate)
    );

    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Trade exception future-expired-tpe is expired'
    );
  });

  it('rejects combining a live-path team-held TPE with outgoing salary', () => {
    const currentYear = DEFAULT_CURRENT_YEAR;
    const tradeDate = DEFAULT_TRADE_DATE;
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'live-tpe',
      5_000_000,
      '2026-07-01T00:00:00.000Z',
      2025
    );
    teamA.exceptions = { tpe: [tpe] };
    const outgoing = {
      ...makePlayer('Out', 5_000_000, { toTeamId: 'B' }, currentYear),
    };
    const incoming = {
      ...makePlayer(
        'In',
        5_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'live-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const res = validateTrade(
      makeValidateTradeParams(teamA, teamB, [outgoing], [incoming], currentYear, tradeDate)
    );

    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Cannot aggregate trade exception with outgoing salary'
    );
  });
});
