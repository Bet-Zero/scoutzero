import { describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
  TradeExceptionRecord,
  TradeFaExceptionBucket,
  TradeRuleEnvelope,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.UTC(2025, 6, 10, 12, 0, 0);

type TradeSlot = NonNullable<
  NonNullable<Parameters<typeof validateTrade>[0]['teams']>[number]
>;
type TradeTeamData = NonNullable<TradeSlot['team']>;
type SalaryRow = {
  season: string;
  salary: number;
  capHit: number;
  guaranteed: boolean;
};
type TestContract = {
  contractType?: string | null;
  isTwoWay?: boolean;
  contractYears?: number;
  firstYearGuaranteed?: boolean;
  salariesByYear: SalaryRow[];
  [key: string]: unknown;
};
type TestTradePlayer = Omit<TradeExceptionPlayer, 'teamCode'> &
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
    teamCode: string | null;
    contract: TestContract;
    [key: string]: unknown;
  };
type TestTradeTeamData = Omit<
  TradeTeamData,
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'draftPicks'
  | 'tradeExceptions'
  | 'faExceptionBuckets'
  | 'totals'
> & {
  players: TestTradePlayer[];
  roster: string[];
  capHolds: NonNullable<TradeTeamData['capHolds']>;
  draftPicks: unknown[];
  tradeExceptions: TradeExceptionRecord[];
  faExceptionBuckets: TradeFaExceptionBucket[];
  totals: {
    totalSalary: number;
    capHit: number;
  };
};
type TestTradeSlot = Omit<TradeSlot, 'team' | 'sends' | 'entitlementsOut'> & {
  team: TestTradeTeamData;
  sends?: TestTradePlayer[];
  entitlementsOut?: unknown[];
};
type MakePlayerExtra = Partial<TestTradePlayer> & {
  contractType?: string | null;
  contract?: TestContract;
  guaranteed?: boolean;
};
type ComputeMutationArgs = Parameters<typeof computeWorldMutation>[0];
type ExecuteTradeArgs = Extract<
  ComputeMutationArgs,
  { mutationType: 'executeTrade' }
>;
type ExecuteTradePayload = ExecuteTradeArgs['payload'];
type ExecuteTradeCurrentState = ExecuteTradeArgs['currentState'];

function asValidateTradeTeams(teams: TestTradeSlot[]) {
  return teams as NonNullable<Parameters<typeof validateTrade>[0]['teams']>;
}

function issueTexts(issues: ValidationIssue[] | undefined = []) {
  return issues.map((issue) => getValidationIssueText(issue));
}

function getRuleSkipReason(rule: TradeRuleEnvelope | undefined) {
  const ruleWithSkipReason = rule as TradeRuleEnvelope & {
    skipReason?: string | null;
    details?: { skipReason?: string | null } | null;
  };

  return ruleWithSkipReason.skipReason ?? ruleWithSkipReason.details?.skipReason;
}

function computeTradeMutation(
  payload: ExecuteTradePayload,
  currentState: ExecuteTradeCurrentState,
  asOfDate: string
) {
  return computeWorldMutation({
    mutationType: 'executeTrade',
    payload,
    currentState,
    seasonId: SEASON_ID,
    timestamp: FIXED_TIMESTAMP,
    worldId: 'world_test',
    asOfDate,
  } as ExecuteTradeArgs);
}

const makeContract = (
  salary: number,
  extra: MakePlayerExtra = {}
): TestContract => ({
  contractType: extra.contractType,
  isTwoWay: extra.isTwoWay,
  salariesByYear: [
    {
      season: SEASON,
      salary,
      capHit: salary,
      guaranteed: extra.guaranteed ?? true,
    },
  ],
});

const makePlayer = (
  id: string,
  salary: number,
  extra: MakePlayerExtra = {}
): TestTradePlayer => {
  const {
    name = id,
    teamCode = null,
    contract,
    ...rest
  } = extra;

  return {
    id,
    player_id: id,
    name,
    salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    isTwoWay: false,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    teamCode,
    contract: contract ?? makeContract(salary, extra),
    ...rest,
  };
};

const makeRoster = (teamCode: string, count: number, salary = 1_000_000) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_player_${index}`, salary, { teamCode })
  );

const makeTeam = (
  teamCode: string,
  players: TestTradePlayer[],
  extra: Partial<TestTradeTeamData> = {}
): TestTradeTeamData => {
  const computedTotalSalary = players.reduce((sum, player) => {
    const row = player.contract.salariesByYear[0];
    return sum + Number(row?.capHit ?? row?.salary ?? 0);
  }, 0);

  const totalSalary = extra.totalSalary ?? computedTotalSalary;

  return {
    id: teamCode,
    teamCode,
    teamId: teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    capHolds: extra.capHolds ?? [],
    draftPicks: [],
    tradeExceptions: extra.tradeExceptions ?? [],
    faExceptionBuckets: extra.faExceptionBuckets ?? [],
    totals: { totalSalary, capHit: totalSalary },
    teamTotalSalary: totalSalary,
    totalSalary,
    ...extra,
  };
};

const makeSatContract = (firstYearSalary: number): TestContract => ({
  contractType: 'Sign & Trade',
  contractYears: 3,
  firstYearGuaranteed: true,
  salariesByYear: [
    {
      season: SEASON,
      salary: firstYearSalary,
      capHit: firstYearSalary,
      guaranteed: true,
    },
    {
      season: '2026-27',
      salary: Math.round(firstYearSalary * 1.05),
      capHit: Math.round(firstYearSalary * 1.05),
      guaranteed: true,
    },
    {
      season: '2027-28',
      salary: Math.round(firstYearSalary * 1.1),
      capHit: Math.round(firstYearSalary * 1.1),
      guaranteed: true,
    },
  ],
});

describe('validator trust fixes', () => {
  it('CBA2-SC-002(b): excludes a Two-Way contract from matching and TPE state while the Standard counterfactual remains ordinary', () => {
    const heldTpe = {
      id: 'bos_tpe',
      amount: 3_000_000,
      totalAmount: 3_000_000,
      remaining: 3_000_000,
      remainingAmount: 3_000_000,
      createdSeason: 2025,
      expiresOn: '2026-10-01T00:00:00.000Z',
    };
    const twoWayPlayer = makePlayer('lal_two_way', 636_435, {
      teamCode: 'LAL',
      isTwoWay: false,
      contract: makeContract(636_435, {
        contractType: 'TwoWay',
        isTwoWay: false,
      }),
      absorptionMode: 'TPE',
      tpeId: heldTpe.id,
    });
    const lakers = makeTeam('LAL', [twoWayPlayer, ...makeRoster('LAL', 14)], {
      totalSalary: 170_000_000,
    });
    const celtics = makeTeam('BOS', makeRoster('BOS', 14), {
      totalSalary: 160_000_000,
      tradeExceptions: [heldTpe],
    });

    const twoWayResult = validateTrade({
      teams: asValidateTradeTeams([
        { team: lakers, sends: [twoWayPlayer], entitlementsOut: [] },
        { team: celtics, sends: [], entitlementsOut: [] },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const lakersTwoWayResult = twoWayResult.teamResults.find(
      (team) => team.teamId === 'LAL'
    );
    const celticsTwoWayResult = twoWayResult.teamResults.find(
      (team) => team.teamId === 'BOS'
    );
    const lakersReceipt = twoWayResult.tradeReceipt?.teams.find(
      (team) => team.teamCode === 'LAL'
    );
    const celticsReceipt = twoWayResult.tradeReceipt?.teams.find(
      (team) => team.teamCode === 'BOS'
    );

    expect(twoWayResult.legal).toBe(true);
    expect(lakersTwoWayResult?.salaryOut).toBe(0);
    expect(celticsTwoWayResult?.salaryIn).toBe(0);
    expect(lakersTwoWayResult?.createdTPE).toBeNull();
    expect(celticsTwoWayResult?.createdTPE).toBeNull();
    expect(lakersTwoWayResult?.rules?.eligibilityEnforcement?.passed).toBe(true);
    expect(heldTpe.remainingAmount).toBe(3_000_000);
    expect(lakersReceipt?.outgoingPlayers[0]).toMatchObject({
      baseSalary: 636_435,
      matchingValue: 0,
      flags: { isTwoWay: true },
    });
    expect(celticsReceipt?.incomingPlayers[0]).toMatchObject({
      baseSalary: 636_435,
      matchingValue: 0,
      flags: { isTwoWay: true },
    });

    const standardPlayer = makePlayer('lal_standard', 2_000_000, {
      teamCode: 'LAL',
      contractType: 'STANDARD',
      isTwoWay: false,
    });
    const standardResult = validateTrade({
      teams: asValidateTradeTeams([
        {
          team: makeTeam(
            'LAL',
            [standardPlayer, ...makeRoster('LAL', 14)],
            { totalSalary: 170_000_000 }
          ),
          sends: [standardPlayer],
          entitlementsOut: [],
        },
        {
          team: makeTeam('BOS', makeRoster('BOS', 14), {
            totalSalary: 100_000_000,
          }),
          sends: [],
          entitlementsOut: [],
        },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });
    const lakersStandardResult = standardResult.teamResults.find(
      (team) => team.teamId === 'LAL'
    );
    const standardReceipt = standardResult.tradeReceipt?.teams.find(
      (team) => team.teamCode === 'LAL'
    );

    expect(standardResult.legal).toBe(true);
    expect(lakersStandardResult?.salaryOut).toBe(2_000_000);
    expect(lakersStandardResult?.createdTPE?.amount).toBe(2_000_000);
    expect(standardReceipt?.outgoingPlayers[0]).toMatchObject({
      baseSalary: 2_000_000,
      matchingValue: 2_000_000,
      flags: { isTwoWay: false },
    });
  });

  it('CBA2-A02.14: decomposes a mixed package so only Standard salary can create a TPE', () => {
    const standardPlayer = makePlayer('lal_standard', 2_000_000, {
      teamCode: 'LAL',
      contractType: 'STANDARD',
    });
    const twoWayPlayer = makePlayer('lal_two_way', 636_435, {
      teamCode: 'LAL',
      contractType: 'two-way',
    });

    const result = validateTrade({
      teams: asValidateTradeTeams([
        {
          team: makeTeam(
            'LAL',
            [standardPlayer, twoWayPlayer, ...makeRoster('LAL', 13)],
            { totalSalary: 170_000_000 }
          ),
          sends: [standardPlayer, twoWayPlayer],
          entitlementsOut: [],
        },
        {
          team: makeTeam('BOS', makeRoster('BOS', 13), {
            totalSalary: 100_000_000,
          }),
          sends: [],
          entitlementsOut: [],
        },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });
    const lakersResult = result.teamResults.find(
      (team) => team.teamId === 'LAL'
    );
    const lakersReceipt = result.tradeReceipt?.teams.find(
      (team) => team.teamCode === 'LAL'
    );

    expect(result.legal).toBe(true);
    expect(lakersResult?.salaryOut).toBe(2_000_000);
    expect(lakersResult?.createdTPE?.amount).toBe(2_000_000);
    expect(lakersReceipt?.totals).toMatchObject({
      outgoingBaseTotal: 2_636_435,
      outgoingMatchingTotal: 2_000_000,
    });
  });

  it('CBA2-A02.14: ignores stale FA-exception assignment for a Two-Way contract', () => {
    const faExceptionBucket = {
      type: 'NTMLE',
      remaining: 10_000_000,
    };
    const twoWayPlayer = makePlayer('lal_two_way_fa_exception', 636_435, {
      teamCode: 'LAL',
      contract: makeContract(636_435, { contractType: 'TwoWay' }),
      absorptionMode: 'FA_EXCEPTION',
      bucketType: faExceptionBucket.type,
    });

    const result = validateTrade({
      teams: asValidateTradeTeams([
        {
          team: makeTeam(
            'LAL',
            [twoWayPlayer, ...makeRoster('LAL', 14)],
            { totalSalary: 170_000_000 }
          ),
          sends: [twoWayPlayer],
          entitlementsOut: [],
        },
        {
          team: makeTeam('BOS', makeRoster('BOS', 14), {
            totalSalary: 100_000_000,
            faExceptionBuckets: [faExceptionBucket],
          }),
          sends: [],
          entitlementsOut: [],
        },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });
    const celticsResult = result.teamResults.find(
      (team) => team.teamId === 'BOS'
    );

    expect(result.legal).toBe(true);
    expect(celticsResult?.salaryIn).toBe(0);
    expect(celticsResult?.hardCapped).toBe(false);
    expect(celticsResult?.faExceptionBuckets).toEqual([
      expect.objectContaining({
        type: faExceptionBucket.type,
        remaining: 10_000_000,
      }),
    ]);
    expect(celticsResult?.notes).not.toContain(
      'Team hard-capped at first apron due to FA exception usage'
    );
    expect(
      getRuleSkipReason(celticsResult?.rules?.salaryMatching)
    ).not.toBe('FA_EXCEPTION');
  });

  it('routes legal FA-exception absorption through validateTrade', () => {
    const faExceptionIncoming = makePlayer('fa_exception_sender', 8_000_000, {
      teamCode: 'LAL',
      absorptionMode: 'FA_EXCEPTION',
      bucketType: 'NTMLE',
    });
    const lakers = makeTeam(
      'LAL',
      [faExceptionIncoming, ...makeRoster('LAL', 14)],
      { totalSalary: 165_000_000 }
    );
    const celtics = makeTeam('BOS', makeRoster('BOS', 14), {
      totalSalary: 160_000_000,
      faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }],
    });

    const result = validateTrade({
      teams: asValidateTradeTeams([
        { team: lakers, sends: [faExceptionIncoming], entitlementsOut: [] },
        { team: celtics, sends: [], entitlementsOut: [] },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const celticsResult = result.teamResults.find(
      (team) => team.teamId === 'BOS'
    );

    expect(result.legal).toBe(true);
    expect(celticsResult?.rules?.faExceptionUsage?.passed).toBe(true);
    expect(getRuleSkipReason(celticsResult?.rules?.salaryMatching)).toBe(
      'FA_EXCEPTION'
    );
    expect(celticsResult?.hardCapped).toBe(true);
  });

  it('blocks FA-exception aggregation through validateTrade using the live payload shape', () => {
    const faExceptionIncoming = makePlayer('fa_exception_sender', 8_000_000, {
      teamCode: 'LAL',
      absorptionMode: 'FA_EXCEPTION',
      bucketType: 'NTMLE',
    });
    const counterPlayer = makePlayer('bos_counter', 2_000_000, {
      teamCode: 'BOS',
    });
    const lakers = makeTeam(
      'LAL',
      [faExceptionIncoming, ...makeRoster('LAL', 13)],
      { totalSalary: 165_000_000 }
    );
    const celtics = makeTeam(
      'BOS',
      [counterPlayer, ...makeRoster('BOS', 14)],
      {
        totalSalary: 160_000_000,
        faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }],
      }
    );

    const result = validateTrade({
      teams: asValidateTradeTeams([
        { team: lakers, sends: [faExceptionIncoming], entitlementsOut: [] },
        { team: celtics, sends: [counterPlayer], entitlementsOut: [] },
      ]),
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const celticsResult = result.teamResults.find(
      (team) => team.teamId === 'BOS'
    );

    expect(result.legal).toBe(false);
    expect(celticsResult?.rules?.faExceptionUsage?.passed).toBe(false);
    expect(issueTexts(celticsResult?.rules?.faExceptionUsage?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Cannot combine FA Exception with outgoing salary/i),
      ])
    );
  });

  it('threads asOfDate through executeTrade validation so S&T timing ownership changes by date', () => {
    const satPlayer = makePlayer('sat_player', 0, {
      teamCode: 'LAL',
      freeAgentYear: CURRENT_YEAR,
      signAndTrade: true,
      signAndTradeContract: makeSatContract(15_000_000),
      tradeTo: 'BOS',
      contract: {
        salariesByYear: [
          { season: SEASON, salary: 0, capHit: 0, guaranteed: false },
        ],
      },
    });
    const counterPlayer = makePlayer('bos_counter', 12_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTeam('LAL', [satPlayer, ...makeRoster('LAL', 13)], {
      capHolds: [
        {
          playerId: 'sat_player',
          playerName: 'sat_player',
          amount: 0,
          season: SEASON,
          type: 'FA_CAP_HOLD',
          active: true,
          isSigned: false,
        },
      ],
    });
    const destinationTeam = makeTeam(
      'BOS',
      [counterPlayer, ...makeRoster('BOS', 13)],
      {
        totalSalary: 140_000_000,
      }
    );

    const payload = {
      teams: [
        { teamCode: 'LAL', sends: [satPlayer], entitlementsOut: [] },
        { teamCode: 'BOS', sends: [counterPlayer], entitlementsOut: [] },
      ],
      tradeCtx: { source: 'tradeMachine' },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const offseasonResult = computeTradeMutation(
      payload as ExecuteTradePayload,
      currentState as ExecuteTradeCurrentState,
      '2025-07-10'
    );

    const inSeasonResult = computeTradeMutation(
      payload as ExecuteTradePayload,
      currentState as ExecuteTradeCurrentState,
      '2026-02-01'
    );

    const offseasonSignAndTradeRule =
      offseasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.signAndTrade;
    const offseasonTimingRule =
      offseasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.timingEnforcement;
    const inSeasonSignAndTradeRule =
      inSeasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.signAndTrade;

    expect(offseasonResult._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(offseasonSignAndTradeRule?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
    expect(issueTexts(offseasonTimingRule?.violations)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
    expect(inSeasonResult._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(inSeasonSignAndTradeRule?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/only be traded during the offseason/i),
      ])
    );
  });

  it('blocks prior-year team-held TPE usage through authoritative apply validation', () => {
    const heldTpe = {
      id: 'prior_year_tpe',
      amount: 6_000_000,
      totalAmount: 6_000_000,
      remaining: 6_000_000,
      remainingAmount: 6_000_000,
      expiresOn: '2026-09-01T00:00:00.000Z',
      expirationDate: '2026-09-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    const tpeAbsorbedPlayer = makePlayer('bos_tpe_target', 5_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
      absorptionMode: 'TPE',
      tpeId: heldTpe.id,
    });

    const sourceTeam = makeTeam('LAL', makeRoster('LAL', 14), {
      totalSalary: 220_000_000,
      exceptions: { tpe: [heldTpe] },
    });
    const destinationTeam = makeTeam(
      'BOS',
      [tpeAbsorbedPlayer, ...makeRoster('BOS', 14)],
      {
        totalSalary: 130_000_000,
      }
    );

    const payload = {
      teams: [
        { teamCode: 'LAL', sends: [], entitlementsOut: [] },
        { teamCode: 'BOS', sends: [tpeAbsorbedPlayer], entitlementsOut: [] },
      ],
      tradeCtx: {
        source: 'tradeMachine',
        tradeDate: '2026-02-01T00:00:00.000Z',
      },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const result = computeTradeMutation(
      payload as ExecuteTradePayload,
      currentState as ExecuteTradeCurrentState,
      '2026-02-01'
    );

    const lakersResult = result._validatedTradeContext?._rawValidation?.teamResults?.find(
      (entry) => entry.teamId === 'LAL'
    );

    expect(result._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(lakersResult?.rules?.tradeExceptions?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/prior-year TPEs cannot be used/i),
      ])
    );
  });

  it('blocks seasonal cash-limit overflow through authoritative apply validation', () => {
    const outgoingLakers = makePlayer('lal_cash_out', 5_000_000, {
      teamCode: 'LAL',
      tradeTo: 'BOS',
    });
    const outgoingCeltics = makePlayer('bos_cash_out', 5_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTeam(
      'LAL',
      [outgoingLakers, ...makeRoster('LAL', 13)],
      {
        totalSalary: 160_000_000,
        cashLedger: { totalOut: 5_600_000 },
      }
    );
    const destinationTeam = makeTeam(
      'BOS',
      [outgoingCeltics, ...makeRoster('BOS', 13)],
      {
        totalSalary: 150_000_000,
      }
    );

    const payload = {
      teams: [
        {
          teamCode: 'LAL',
          sends: [outgoingLakers],
          entitlementsOut: [],
          cashSent: 500_000,
        },
        {
          teamCode: 'BOS',
          sends: [outgoingCeltics],
          entitlementsOut: [],
        },
      ],
      tradeCtx: {
        source: 'tradeMachine',
        tradeDate: '2025-07-10T00:00:00.000Z',
      },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const result = computeTradeMutation(
      payload as ExecuteTradePayload,
      currentState as ExecuteTradeCurrentState,
      '2025-07-10'
    );

    const lakersResult = result._validatedTradeContext?._rawValidation?.teamResults?.find(
      (entry) => entry.teamId === 'LAL'
    );

    expect(result._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(lakersResult?.rules?.cash?.violations)).toEqual(
      expect.arrayContaining([expect.stringMatching(/seasonal limit/i)])
    );
  });
});
