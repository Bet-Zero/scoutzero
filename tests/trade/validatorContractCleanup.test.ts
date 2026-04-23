import { describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { validatePostTradeSnapshotForContext } from '@/features/architect/utils/tradeContext/tradeContext';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
  TradeExceptionRecord,
  TradeFaExceptionBucket,
  TradeValidationResult,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type { ArchitectTradePayloadTeam } from '@/features/architect/utils/mutationPipeline';
import type {
  PostTradeSnapshot,
  ValidationTeam,
} from '@/features/architect/utils/tradeContext/types';

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';

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
  };
type TestTradeSlot = Omit<TradeSlot, 'team'> & {
  teamCode?: string | null;
  team: TestTradeTeamData;
  sends?: TestTradePlayer[];
  entitlementsOut?: unknown[];
  validationEntitlements?: unknown[];
};
type TestTradeTeamData = Omit<
  TradeTeamData,
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'draftPicks'
  | 'tradeExceptions'
  | 'faExceptionBuckets'
  | 'entitlementIds'
  | 'totals'
> & {
  players: TestTradePlayer[];
  roster: string[];
  capHolds: NonNullable<TradeTeamData['capHolds']>;
  draftPicks: unknown[];
  tradeExceptions: TradeExceptionRecord[];
  faExceptionBuckets: TradeFaExceptionBucket[];
  entitlementIds: string[];
  totals: {
    totalSalary: number;
    capHit: number;
  };
};
type MakePlayerExtra = Partial<TestTradePlayer> & {
  contractType?: string | null;
  contract?: TestContract;
};
type CanonicalIssueExpectation = {
  rule?: string;
  severity?: ValidationIssue['severity'];
};
type CanonicalValidatedTradeContext = ReturnType<
  typeof validatePostTradeSnapshotForContext
> &
  Pick<TradeValidationResult, 'summaryByTeamIndex' | 'capSettings'> & {
    _rawValidation: TradeValidationResult;
  };

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getTeamResult(
  result: TradeValidationResult,
  teamId: string,
  message: string
) {
  return requireValue(
    result.teamResults.find((team) => team.teamId === teamId),
    message
  );
}

function getTradeReceipt(
  result: TradeValidationResult,
  message: string
) {
  return requireValue(result.tradeReceipt, message);
}

function asValidateTradeTeams(teams: TestTradeSlot[]) {
  return teams as NonNullable<Parameters<typeof validateTrade>[0]['teams']>;
}

function toValidationTeam(team: TestTradeSlot): ValidationTeam {
  return {
    team: requireValue(team.team, 'Expected validation team data') as ValidationTeam['team'],
    teamCode: team.teamCode ?? null,
    sends: (team.sends ?? []) as ValidationTeam['sends'],
    receives: [],
    picksOut: team.picksOut ?? [],
    picksIn: [],
    cashSent: Number(team.cashSent ?? 0),
    cashReceived: Number(team.cashReceived ?? 0),
    entitlementsOut: team.entitlementsOut ?? [],
    validationEntitlements: team.validationEntitlements ?? [],
  } as ValidationTeam;
}

function toPayloadTeam(team: ValidationTeam): ArchitectTradePayloadTeam {
  return {
    teamCode: team.teamCode,
    sends: team.sends as ArchitectTradePayloadTeam['sends'],
    receives: team.receives as ArchitectTradePayloadTeam['receives'],
    picksOut: team.picksOut,
    cashSent: team.cashSent,
    cashReceived: team.cashReceived,
  };
}

const expectCanonicalIssue = (
  issue: ValidationIssue,
  { rule, severity }: CanonicalIssueExpectation = {}
) => {
  expect(issue).toMatchObject({
    message: expect.any(String),
    severity: severity || expect.any(String),
    rule: rule || expect.any(String),
    code: expect.any(String),
  });
};

const makePlayer = (
  id: string,
  salary: number,
  extra: MakePlayerExtra = {}
): TestTradePlayer => {
  const {
    name = id,
    teamCode = null,
    contractType,
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
    contract:
      contract ?? {
        contractType,
        salariesByYear: [
          {
            season: SEASON,
            salary,
            capHit: salary,
            guaranteed: true,
          },
        ],
      },
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
  const totalSalary = extra.totalSalary ?? players.length * 1_000_000;

  return {
    id: teamCode,
    teamCode,
    teamId: teamCode,
    teamName: `Team ${teamCode}`,
    nickname: `Team ${teamCode}`,
    players,
    roster: players.map((player) => player.player_id || player.id),
    capHolds: extra.capHolds ?? [],
    draftPicks: [],
    tradeExceptions: extra.tradeExceptions ?? [],
    faExceptionBuckets: extra.faExceptionBuckets ?? [],
    entitlementIds: extra.entitlementIds ?? [],
    totals: { totalSalary, capHit: totalSalary },
    teamTotalSalary: totalSalary,
    totalSalary,
    ...extra,
  };
};

function buildSimpleTrade() {
  const teamAPlayer = makePlayer('bos_out', 10_000_000, { teamCode: 'BOS' });
  const teamBPlayer = makePlayer('lal_out', 10_000_000, { teamCode: 'LAL' });
  const celtics = makeTeam('BOS', [teamAPlayer, ...makeRoster('BOS', 13)], {
    totalSalary: 170_000_000,
  });
  const lakers = makeTeam('LAL', [teamBPlayer, ...makeRoster('LAL', 13)], {
    totalSalary: 160_000_000,
  });

  return {
    teams: [
      { team: celtics, sends: [teamAPlayer], entitlementsOut: [] },
      { team: lakers, sends: [teamBPlayer], entitlementsOut: [] },
    ] as TestTradeSlot[],
    celtics,
    lakers,
  };
}

function buildRoutingFailureTrade() {
  const teamA = makeTeam('BOS', makeRoster('BOS', 14), {
    totalSalary: 170_000_000,
  });
  const teamB = makeTeam('LAL', makeRoster('LAL', 14), {
    totalSalary: 160_000_000,
  });
  const teamC = makeTeam('NYK', makeRoster('NYK', 14), {
    totalSalary: 150_000_000,
  });

  const teams: TestTradeSlot[] = [
    {
      team: teamA,
      teamCode: 'BOS',
      sends: [],
      entitlementsOut: [
        { description: 'missing id warning' },
        { entitlementId: 'bos_pick_1', round: 1, seasonYear: 2027 },
      ],
    },
    {
      team: teamB,
      teamCode: 'LAL',
      sends: [],
      entitlementsOut: [],
    },
    {
      team: teamC,
      teamCode: 'NYK',
      sends: [],
      entitlementsOut: [],
    },
  ];
  const validationTeams = teams.map((team) => toValidationTeam(team));

  return {
    teams,
    snapshot: {
      teamUpdates: [
        { teamCode: 'BOS', team: teamA },
        { teamCode: 'LAL', team: teamB },
        { teamCode: 'NYK', team: teamC },
      ],
      validationTeams,
      payloadTeams: validationTeams.map((team) => toPayloadTeam(team)),
      _isPostTradeSnapshot: true,
    } as PostTradeSnapshot,
  };
}

function buildLinkageFailureTrade() {
  const teamA = makeTeam('BOS', makeRoster('BOS', 14), {
    totalSalary: 170_000_000,
    entitlementIds: ['bos_pick_1', 'bos_pick_2'],
  });
  const teamB = makeTeam('LAL', makeRoster('LAL', 14), {
    totalSalary: 160_000_000,
  });

  return {
    teams: [
      {
        team: teamA,
        teamCode: 'BOS',
        sends: [],
        entitlementsOut: [
          {
            entitlementId: 'bos_pick_1',
            linkedEntitlementIds: ['bos_pick_2'],
          },
        ],
        validationEntitlements: [
          {
            entitlementId: 'bos_pick_1',
            linkedEntitlementIds: ['bos_pick_2'],
          },
          {
            entitlementId: 'bos_pick_2',
          },
        ],
      },
      {
        team: teamB,
        teamCode: 'LAL',
        sends: [],
        entitlementsOut: [],
      },
    ] as TestTradeSlot[],
  };
}

describe('validateTrade contract cleanup', () => {
  it('returns canonical rule envelopes for every authoritative team rule', () => {
    const { teams } = buildSimpleTrade();

    const result = validateTrade({
      teams: asValidateTradeTeams(teams),
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });

    const celticsResult = getTeamResult(
      result,
      'BOS',
      'Expected BOS team result from validateTrade'
    );

    Object.entries(celticsResult.rules).forEach(([ruleName, rule]) => {
      expect(ruleName).toBeTruthy();
      expect(rule).toBeTruthy();
      expect(Array.isArray(rule)).toBe(false);
      expect(rule).toHaveProperty('passed');
      expect(Array.isArray(rule.violations)).toBe(true);
      expect(Array.isArray(rule.warnings)).toBe(true);
      expect(typeof rule.message).toBe('string');
      rule.violations.forEach((issue) =>
        expectCanonicalIssue(issue, { rule: ruleName, severity: 'error' })
      );
      rule.warnings.forEach((issue) =>
        expectCanonicalIssue(issue, { rule: ruleName, severity: 'warning' })
      );
    });

    expect(Array.isArray(celticsResult.incomingPlayers)).toBe(true);
    expect(Array.isArray(celticsResult.outgoingPlayers)).toBe(true);
  });

  it('preserves summaryByTeamIndex and tradeReceipt authoritative output semantics', () => {
    const { teams } = buildSimpleTrade();

    const result = validateTrade({
      teams: asValidateTradeTeams(teams),
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });
    const tradeReceipt = getTradeReceipt(
      result,
      'Expected tradeReceipt for successful canonical validateTrade output'
    );

    expect(result.legal).toBe(true);
    expect(result.capSettings).toMatchObject({
      salaryCap: 154_647_000,
      firstApron: 195_945_000,
      secondApron: 207_824_000,
      luxuryTax: 187_895_000,
    });
    expect(result.capSettingsSource).toBe('capProjections[2025-26]');
    expect(result.capSettingsWarnings).toEqual([
      'Cap values for 2025-26 are projected (Future Year)',
    ]);
    expect(result.summaryByTeamIndex).toEqual([
      {
        playersOut: 'bos_out',
        playersIn: ['lal_out'],
        capDelta: 0,
        teamId: 'BOS',
        teamCode: 'BOS',
        legal: true,
        violations: [],
        warnings: [],
        teamName: 'Team BOS',
      },
      {
        playersOut: 'lal_out',
        playersIn: ['bos_out'],
        capDelta: 0,
        teamId: 'LAL',
        teamCode: 'LAL',
        legal: true,
        violations: [],
        warnings: [],
        teamName: 'Team LAL',
      },
    ]);

    expect(tradeReceipt).toMatchObject({
      isLegal: true,
      primaryViolation: null,
      yearKey: CURRENT_YEAR,
      seasonKey: SEASON,
      teams: [
        {
          teamCode: 'BOS',
          teamName: 'Team BOS',
          preTradeTeamSalary: 170_000_000,
          preTradeTeamSalarySource: 'team.teamTotalSalary',
          totals: {
            outgoingBaseTotal: 10_000_000,
            outgoingMatchingTotal: 10_000_000,
            incomingBaseTotal: 10_000_000,
            incomingMatchingTotal: 10_000_000,
          },
          salaryMatchingEvaluation: {
            actualIncoming: 10_000_000,
            skipReason: null,
            passed: true,
          },
        },
        {
          teamCode: 'LAL',
          teamName: 'Team LAL',
          preTradeTeamSalary: 160_000_000,
          preTradeTeamSalarySource: 'team.teamTotalSalary',
          totals: {
            outgoingBaseTotal: 10_000_000,
            outgoingMatchingTotal: 10_000_000,
            incomingBaseTotal: 10_000_000,
            incomingMatchingTotal: 10_000_000,
          },
          salaryMatchingEvaluation: {
            actualIncoming: 10_000_000,
            skipReason: null,
            passed: true,
          },
        },
      ],
    });
    expect(tradeReceipt.teams[0].violations).toEqual(
      result.teamResults[0].violations
    );
    expect(tradeReceipt.teams[0].warnings).toEqual(
      result.teamResults[0].warnings
    );
    expect(tradeReceipt.teams[1].violations).toEqual(
      result.teamResults[1].violations
    );
    expect(tradeReceipt.teams[1].warnings).toEqual(
      result.teamResults[1].warnings
    );
  });

  it('uses one canonical top-level shape for fail-fast routing errors and preserves warnings', () => {
    const { teams } = buildRoutingFailureTrade();

    const result = validateTrade({
      teams: asValidateTradeTeams(teams),
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });

    expect(result.legal).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ENTITLEMENT_ROUTING_ERROR');
    expect(result.teamResults).toEqual([]);
    expect(result.summaryByTeamIndex).toEqual([]);
    result.violations.forEach((issue) =>
      expectCanonicalIssue(issue, {
        rule: 'entitlementRouting',
        severity: 'error',
      })
    );
    result.warnings.forEach((issue) =>
      expectCanonicalIssue(issue, {
        rule: 'entitlementRouting',
        severity: 'warning',
      })
    );
    expect(result.violations.map((issue) => getValidationIssueText(issue))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has no destination'),
      ])
    );
    expect(result.reason).toBe(getValidationIssueText(result.violations[0]));
    expect(result.warnings.map((issue) => getValidationIssueText(issue))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has no id/entitlementId field'),
      ])
    );
    expect(result.capSettings).toBeDefined();
    expect(result.yearKey).toBe(CURRENT_YEAR);
    expect(result.seasonKey).toBe(SEASON);
    expect(result.asOfDate).toBe('2025-07-10');
  });

  it('uses one canonical top-level shape for fail-fast linkage errors before team-rule evaluation', () => {
    const { teams } = buildLinkageFailureTrade();

    const result = validateTrade({
      teams: asValidateTradeTeams(teams),
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });

    expect(result.legal).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ENTITLEMENT_LINKAGE_ERROR');
    expect(result.teamResults).toEqual([]);
    expect(result.summaryByTeamIndex).toEqual([]);
    result.violations.forEach((issue) =>
      expectCanonicalIssue(issue, {
        rule: 'entitlementLinkage',
        severity: 'error',
      })
    );
    result.warnings.forEach((issue) =>
      expectCanonicalIssue(issue, {
        rule: 'entitlementLinkage',
        severity: 'warning',
      })
    );
    expect(result.violations.map((issue) => getValidationIssueText(issue))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('complete linked package'),
      ])
    );
    expect(result.reason).toBe(getValidationIssueText(result.violations[0]));
    expect(result.warnings).toEqual([]);
    expect(result.capSettings).toBeDefined();
    expect(result.yearKey).toBe(CURRENT_YEAR);
    expect(result.seasonKey).toBe(SEASON);
    expect(result.asOfDate).toBe('2025-07-10');
  });

  it('preserves canonical validator output in validatePostTradeSnapshotForContext', () => {
    const { snapshot } = buildRoutingFailureTrade();

    const validatedContext = validatePostTradeSnapshotForContext({
      snapshot,
      payload: {
        teams: snapshot.validationTeams,
        capProjections,
        asOfDate: '2025-07-10',
        tradeCtx: {},
      },
      seasonId: SEASON,
    }) as CanonicalValidatedTradeContext;

    expect(validatedContext._isValidatedTradeContext).toBe(true);
    expect(validatedContext.legal).toBe(false);
    expect(validatedContext.violations).toEqual(validatedContext._rawValidation.violations);
    expect(validatedContext.warnings).toEqual(validatedContext._rawValidation.warnings);
    validatedContext.violations.forEach((issue) =>
      expectCanonicalIssue(issue, { severity: 'error' })
    );
    expect(validatedContext.summaryByTeamIndex).toEqual(validatedContext._rawValidation.summaryByTeamIndex);
    expect(validatedContext.capSettings).toEqual(validatedContext._rawValidation.capSettings);
  });
});
