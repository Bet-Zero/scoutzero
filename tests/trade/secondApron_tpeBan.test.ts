import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions';
import capProjections from '@/features/architect/utils/capProjections';
import type {
  NormalizedPlayer,
  TradeExceptionRecord,
  TradeTeam,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const currentYear = 2025;
const tradeDate = '2025-07-10T00:00:00.000Z';

type ValidateTradeParams = Parameters<typeof validateTrade>[0];
type TradeSlot = NonNullable<NonNullable<ValidateTradeParams['teams']>[number]>;
type TradeTeamData = NonNullable<TradeSlot['team']>;
type TradePlayer = NonNullable<NonNullable<TradeSlot['sends']>[number]> &
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
    contract: {
      salariesByYear: Array<{
        season: string;
        salary: number;
      }>;
    };
  };
type HeldTpe = TradeExceptionRecord & {
  id: string;
  amount: number;
  totalAmount: number;
  remaining: number;
  remainingAmount: number;
  expiresOn: string;
  expirationDate: string;
  createdSeason: number;
};
type TestTradeTeamData = TradeTeamData & {
  players: TradePlayer[];
  picks: unknown[];
  draftPicks: unknown[];
  exceptions: { tpe: HeldTpe[] };
};

const seasonForYear = (year: number) => `${year - 1}-${String(year).slice(-2)}`;

const makePlayer = (
  name: string,
  salary: number,
  extra: Partial<TradePlayer> = {},
  year = currentYear
): TradePlayer => ({
  id: name,
  player_id: name,
  name,
  salary,
  currentSalary: salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: {
    salariesByYear: [{ season: seasonForYear(year), salary }],
  },
  ...extra,
});

const makeTeam = (
  name: string,
  totalSalary: number,
  rosterSize = 14,
  year = currentYear
): TestTradeTeamData => ({
  id: name,
  teamId: name,
  teamCode: name,
  teamName: name,
  nickname: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000, {}, year)
  ),
  picks: [],
  draftPicks: [],
  exceptions: { tpe: [] },
});

const makeHeldTpe = (
  id: string,
  amount: number,
  createdSeason: number
): HeldTpe => ({
  id,
  amount,
  totalAmount: amount,
  remaining: amount,
  remainingAmount: amount,
  expiresOn: '2026-07-02T00:00:00.000Z',
  expirationDate: '2026-07-02T00:00:00.000Z',
  createdSeason,
});

const issueTexts = (issues: ValidationIssue[] | undefined = []) =>
  issues.map((issue) => getValidationIssueText(issue));

function runTrade(
  tpe: HeldTpe,
  teamSalary: number,
  otherTeamSalary = 100_000_000
) {
  const teamA = makeTeam('A', teamSalary);
  const teamB = makeTeam('B', otherTeamSalary);
  const incoming = makePlayer('Bstar', 5_000_000, {
    absorptionMode: 'TPE',
    tpeId: tpe.id,
    fromTeamId: 'B',
  });

  teamA.exceptions = { tpe: [tpe] };
  teamB.players.push(incoming);

  return validateTrade({
    teams: [
      { team: teamA, sends: [], picksOut: [] },
      { team: teamB, sends: [incoming], picksOut: [] },
    ],
    capProjections,
    currentYear,
    tradeCtx: { tradeDate },
  });
}

describe('second apron prior-year TPE usage', () => {
  it('rejects prior-year team-held TPEs for second-apron teams in the live path', () => {
    const res = runTrade(
      makeHeldTpe('old-tpe', 5_000_000, currentYear - 1),
      220_000_000
    );

    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Second apron: prior-year TPEs cannot be used.'
    );
  });

  it('does not block current-year team-held TPEs for second-apron teams', () => {
    const res = runTrade(
      makeHeldTpe('current-tpe', 5_000_000, currentYear),
      220_000_000
    );

    const tpeResult = res.teamResults[0].rules?.tradeExceptions;
    expect(tpeResult?.passed).toBe(true);
    expect(issueTexts(tpeResult?.violations)).toEqual([]);
  });

  it('allows prior-year team-held TPEs for teams below the apron', () => {
    const res = runTrade(
      makeHeldTpe('below-apron-tpe', 5_000_000, currentYear - 1),
      100_000_000
    );

    expect(res.teamResults[0].legal).toBe(true);
  });

  it('yields the same prior-year second-apron rule outcome for live-path and compatibility-input TPE usage', () => {
    const livePathTpe = makeHeldTpe('equivalent-tpe', 5_000_000, currentYear - 1);
    const compatibilityTpe = makeHeldTpe(
      'equivalent-tpe',
      5_000_000,
      currentYear - 1
    );
    const ruleContext: TradeTeam = {
      teamTotalSalary: 220_000_000,
      context: {
        tradeDate,
        yearKey: currentYear,
        capSettings: { secondApron: 190_000_000, salaryCap: 141_000_000 },
      },
      outgoingPlayers: [],
      sends: [],
      salaryOut: 0,
      salaryIn: 0,
    };

    const livePathResult = validateTradeExceptions({
      ...ruleContext,
      team: { exceptions: { tpe: [livePathTpe] } },
      incomingPlayers: [
        {
          name: 'Bstar',
          salary: 5_000_000,
          absorptionMode: 'TPE',
          tpeId: livePathTpe.id,
        },
      ],
      appliedTPEs: [],
      tradeExceptions: [],
    });

    const compatibilityInputResult = validateTradeExceptions({
      ...ruleContext,
      team: { exceptions: { tpe: [compatibilityTpe] } },
      incomingPlayers: [],
      appliedTPEs: [compatibilityTpe],
      tradeExceptions: [],
    });

    expect(issueTexts(livePathResult.violations)).toEqual(
      issueTexts(compatibilityInputResult.violations)
    );
    expect(issueTexts(livePathResult.violations)).toContain(
      'Second apron: prior-year TPEs cannot be used.'
    );
  });
});
