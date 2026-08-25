import { describe, expect, it } from 'vitest';
import { capProjections } from '@/features/architect/utils/capProjections';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type { CapHold } from '@/features/architect/utils/capHolds';
import type {
  TradeExceptionPlayer,
  TradeTeamResult,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const CURRENT_YEAR = 2026;
const SEASON = `${CURRENT_YEAR - 1}-${String(CURRENT_YEAR).slice(-2)}`;

function makeContractSalary(salary: number) {
  return [{ season: SEASON, salary, capHit: salary, guaranteed: true }];
}

type PlayerFixtureExtra = Record<string, unknown> & {
  contract?: Record<string, unknown>;
};

type SignAndTradeRuleEnvelope = TradeTeamResult['rules'][string] & {
  hardCapped?: boolean;
};

function makeTeam(
  teamCode: string,
  totalSalary = 120_000_000,
  capHolds: CapHold[] = []
) {
  return {
    id: teamCode,
    teamCode,
    teamName: teamCode,
    totalSalary,
    teamTotalSalary: totalSalary,
    capHolds,
    players: [],
    picks: [],
  };
}

function makePlayer(
  playerId: string,
  salary: number,
  extra: PlayerFixtureExtra = {}
): TradeExceptionPlayer {
  return {
    id: playerId,
    player_id: playerId,
    name: playerId,
    contract: {
      salariesByYear: makeContractSalary(salary),
    },
    ...extra,
  };
}

function makeCapHold(playerId: string): CapHold {
  return {
    playerId,
    playerName: playerId,
    season: SEASON,
    active: true,
    isSigned: false,
    amount: 0,
    type: 'bird',
  };
}

function makeSignAndTradeContract(firstYearSalary: number) {
  return {
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
        season: `${CURRENT_YEAR}-${String(CURRENT_YEAR + 1).slice(-2)}`,
        salary: Math.round(firstYearSalary * 1.05),
        capHit: Math.round(firstYearSalary * 1.05),
        guaranteed: true,
      },
      {
        season: `${CURRENT_YEAR + 1}-${String(CURRENT_YEAR + 2).slice(-2)}`,
        salary: Math.round(firstYearSalary * 1.1),
        capHit: Math.round(firstYearSalary * 1.1),
        guaranteed: true,
      },
    ],
  };
}

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

function expectCanonicalSignAndTradeIssues(issues: ValidationIssue[]) {
  expect(issues.length).toBeGreaterThan(0);
  issues.forEach((issue) => {
    expect(issue).toMatchObject({
      message: expect.any(String),
      severity: 'error',
      rule: 'signAndTrade',
      code: expect.stringMatching(/^SIGN_AND_TRADE__/),
    });
  });
}

describe('Trade Machine S&T fail-closed guardrails', () => {
  it('rejects sign-and-trade when outgoing player is under contract', () => {
    const satPlayer = makePlayer('sat_under_contract', 11_000_000, {
      signAndTrade: true,
      tradeTo: 'BOS',
      signAndTradeContract: makeSignAndTradeContract(18_000_000),
      freeAgentYear: CURRENT_YEAR + 2,
    });
    const counterPlayer = makePlayer('counter', 18_000_000);

    const result = validateTrade({
      teams: [
        { team: makeTeam('LAL'), sends: [satPlayer], picksOut: [] },
        { team: makeTeam('BOS'), sends: [counterPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: {
        offseason: true,
        source: 'tradeMachine',
        asOfDate: '2026-01-20',
      },
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    expectCanonicalSignAndTradeIssues(
      result.teamResults[0].rules.signAndTrade.violations
    );
    expect(
      issueTexts(result.teamResults[0].rules.signAndTrade.violations).join(' ')
    ).toContain('ineligible');
  });

  it('rejects sign-and-trade when contract payload is missing', () => {
    const satPlayer = makePlayer('sat_missing_contract', 0, {
      signAndTrade: true,
      tradeTo: 'BOS',
      freeAgentYear: CURRENT_YEAR,
      contract: { salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }] },
    });
    const counterPlayer = makePlayer('counter', 9_000_000);

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('LAL', 120_000_000, [
            makeCapHold('sat_missing_contract'),
          ]),
          sends: [satPlayer],
          picksOut: [],
        },
        { team: makeTeam('BOS'), sends: [counterPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, source: 'tradeMachine' },
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    expectCanonicalSignAndTradeIssues(
      result.teamResults[0].rules.signAndTrade.violations
    );
    expect(
      issueTexts(result.teamResults[0].rules.signAndTrade.violations).join(' ')
    ).toContain('missing signAndTradeContract');
  });

  it('uses sign-and-trade contract first-year salary for matching values', () => {
    const satPlayer = makePlayer('sat_salary_parity', 0, {
      signAndTrade: true,
      tradeTo: 'BOS',
      freeAgentYear: CURRENT_YEAR,
      signAndTradeContract: makeSignAndTradeContract(18_000_000),
      contract: {
        salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
      },
    });
    const counterPlayer = makePlayer('counter', 18_000_000);

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('LAL', 120_000_000, [
            makeCapHold('sat_salary_parity'),
          ]),
          sends: [satPlayer],
          picksOut: [],
        },
        { team: makeTeam('BOS'), sends: [counterPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, source: 'tradeMachine' },
    });

    const teamA = result.teamResults.find(
      (entry: TradeTeamResult) => entry.teamId === 'LAL'
    );
    const teamB = result.teamResults.find(
      (entry: TradeTeamResult) => entry.teamId === 'BOS'
    );

    expect(teamA?.salaryOut).toBe(18_000_000);
    expect(teamB?.salaryIn).toBe(18_000_000);
  });

  it('rejects 3+ team sign-and-trade when destination route is missing', () => {
    const satPlayer = makePlayer('sat_missing_dest', 0, {
      signAndTrade: true,
      signAndTradeContract: makeSignAndTradeContract(16_000_000),
      freeAgentYear: CURRENT_YEAR,
      contract: {
        salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
      },
    });
    const teamBOutgoing = makePlayer('b_out', 16_000_000, { tradeTo: 'LAL' });
    const teamCOutgoing = makePlayer('c_out', 16_000_000, { tradeTo: 'BOS' });

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('LAL', 120_000_000, [makeCapHold('sat_missing_dest')]),
          sends: [satPlayer],
          picksOut: [],
        },
        { team: makeTeam('BOS'), sends: [teamBOutgoing], picksOut: [] },
        { team: makeTeam('NYK'), sends: [teamCOutgoing], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, source: 'tradeMachine' },
    });

    expect(result.legal).toBe(false);
    expect(result.error).toBe('PLAYER_ROUTING_ERROR');
  });

  it('marks the receiving team hard-capped through the authoritative S&T rule output', () => {
    const satPlayer = makePlayer('sat_hard_cap_lock', 0, {
      signAndTrade: true,
      tradeTo: 'BOS',
      freeAgentYear: CURRENT_YEAR,
      originTeamId: 'LAL',
      signAndTradeContract: makeSignAndTradeContract(15_000_000),
      contract: {
        salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
      },
    });
    const counterPlayer = makePlayer('counter', 15_000_000, { tradeTo: 'LAL' });

    const result = validateTrade({
      teams: [
        { team: makeTeam('LAL'), sends: [satPlayer], picksOut: [] },
        { team: makeTeam('BOS'), sends: [counterPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, source: 'tradeMachine' },
    });

    const receiver = result.teamResults.find(
      (entry: TradeTeamResult) => entry.teamId === 'BOS'
    );
    const signAndTradeRule = receiver?.rules.signAndTrade as
      | SignAndTradeRuleEnvelope
      | undefined;

    expect(signAndTradeRule?.passed).toBe(true);
    expect(signAndTradeRule?.hardCapped).toBe(true);
    expect(receiver?.hardCapped).toBe(true);
    expect(receiver?.rules.signAndTrade.violations).toEqual([]);
  });

  it('reconciles product slugs with canonical source-Team identity', () => {
    const satPlayer = makePlayer('sat_canonical_source', 0, {
      signAndTrade: true,
      tradeTo: 'celtics',
      freeAgentYear: CURRENT_YEAR,
      originTeamId: 'MIA',
      signAndTradeContract: makeSignAndTradeContract(15_000_000),
      contract: {
        salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
      },
    });
    const sourceTeam = {
      ...makeTeam('MIA', 120_000_000, [makeCapHold('sat_canonical_source')]),
      id: 'heat',
    };
    const destinationTeam = { ...makeTeam('BOS'), id: 'celtics' };

    const result = validateTrade({
      teams: [
        { team: sourceTeam, sends: [satPlayer], picksOut: [] },
        { team: destinationTeam, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: {
        offseason: true,
        source: 'tradeMachine',
        asOfDate: '2025-01-20',
      },
    });

    expect(result.teamResults[0].rules.signAndTrade).toMatchObject({
      passed: true,
      violations: [],
    });
  });
});
