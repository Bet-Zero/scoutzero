import { describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { validatePostTradeSnapshotForContext } from '@/features/architect/utils/tradeContext/tradeContext.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';

const expectCanonicalIssue = (issue, { rule, severity } = {}) => {
  expect(issue).toMatchObject({
    message: expect.any(String),
    severity: severity || expect.any(String),
    rule: rule || expect.any(String),
    code: expect.any(String),
  });
};

const makePlayer = (id, salary, extra = {}) => ({
  id,
  player_id: id,
  name: extra.name || id,
  teamCode: extra.teamCode || null,
  contract: {
    contractType: extra.contractType,
    salariesByYear: [
      {
        season: SEASON,
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
  },
  ...extra,
});

const makeRoster = (teamCode, count, salary = 1_000_000) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_player_${index}`, salary, { teamCode })
  );

const makeTeam = (teamCode, players, extra = {}) => {
  const totalSalary = extra.totalSalary ?? players.length * 1_000_000;

  return {
    id: teamCode,
    teamCode,
    teamId: teamCode,
    teamName: `Team ${teamCode}`,
    nickname: `Team ${teamCode}`,
    players,
    roster: players.map((player) => player.player_id || player.id),
    capHolds: extra.capHolds || [],
    draftPicks: [],
    tradeExceptions: extra.tradeExceptions || [],
    faExceptionBuckets: extra.faExceptionBuckets || [],
    entitlementIds: extra.entitlementIds || [],
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
    ],
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

  const validationTeams = [
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

  return {
    teams: validationTeams,
    snapshot: {
      teamUpdates: [
        { teamCode: 'BOS', team: teamA },
        { teamCode: 'LAL', team: teamB },
        { teamCode: 'NYK', team: teamC },
      ],
      validationTeams,
      payloadTeams: validationTeams,
      _isPostTradeSnapshot: true,
    },
  };
}

describe('validateTrade contract cleanup', () => {
  it('returns canonical rule envelopes for every authoritative team rule', () => {
    const { teams } = buildSimpleTrade();

    const result = validateTrade({
      teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });

    const celticsResult = result.teamResults.find((team) => team.teamId === 'BOS');
    expect(celticsResult).toBeDefined();

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
      teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-07-10' },
    });

    expect(result.legal).toBe(true);
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

    expect(result.tradeReceipt).toMatchObject({
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
    expect(result.tradeReceipt.teams[0].violations).toEqual(
      result.teamResults[0].violations
    );
    expect(result.tradeReceipt.teams[0].warnings).toEqual(
      result.teamResults[0].warnings
    );
    expect(result.tradeReceipt.teams[1].violations).toEqual(
      result.teamResults[1].violations
    );
    expect(result.tradeReceipt.teams[1].warnings).toEqual(
      result.teamResults[1].warnings
    );
  });

  it('uses one canonical top-level shape for fail-fast routing errors and preserves warnings', () => {
    const { teams } = buildRoutingFailureTrade();

    const result = validateTrade({
      teams,
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
    });

    expect(validatedContext._isValidatedTradeContext).toBe(true);
    expect(validatedContext.legal).toBe(false);
    expect(validatedContext.violations).toEqual(
      validatedContext._rawValidation.violations
    );
    expect(validatedContext.warnings).toEqual(
      validatedContext._rawValidation.warnings
    );
    validatedContext.violations.forEach((issue) =>
      expectCanonicalIssue(issue, { severity: 'error' })
    );
    expect(validatedContext.summaryByTeamIndex).toEqual(
      validatedContext._rawValidation.summaryByTeamIndex
    );
    expect(validatedContext.capSettings).toEqual(
      validatedContext._rawValidation.capSettings
    );
  });
});
