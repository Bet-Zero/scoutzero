import { describe, it, expect } from 'vitest';
import { enforceSecondApronHandcuffs } from '@/features/architect/utils/tradeMachine/rules/basicRules';
import { validateAggregation } from '@/features/architect/utils/tradeMachine/rules/validateAggregation';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions';
import {
  SECOND_APRON_AGGREGATION_UP_BLOCKED,
  SECOND_APRON_CASH_BLOCKED,
  SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const capSettings = {
  salaryCap: 140000000,
  firstApron: 178000000,
  secondApron: 190000000,
};

const baseTeam = {
  context: { yearKey: 2025, capSettings },
  postTradeStatus: { isAtOrAboveSecondApron: true },
  tradeExceptions: [],
  cashSent: 0,
  cashReceived: 0,
};

const makePlayer = (salary = 0, extra = {}) => ({ salary, ...extra });
const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

describe('second apron handcuffs', () => {
  it('routes aggregation blocking through validateAggregation', () => {
    const team = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000), makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(20_000_001, { fromTeamId: 'BOS' })],
      teamTotalSalary: 200_000_000,
      salaryOut: 20_000_000,
      salaryIn: 20_000_001,
    };

    const result = validateAggregation(team, baseTeam.context);

    expect(result.passed).toBe(false);
    expect(result.violations).toContain(SECOND_APRON_AGGREGATION_UP_BLOCKED);
  });

  it('rejects cash inclusion', () => {
    const team = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_000)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
      cashSent: 1,
    };
    const v = enforceSecondApronHandcuffs(team, {});
    expect(v).toEqual([SECOND_APRON_CASH_BLOCKED]);
  });

  it('routes prior-year TPE usage through validateTradeExceptions', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 220_000_000,
      team: {
        exceptions: {
          tpe: [
            {
              id: 'old',
              amount: 5_000_000,
              totalAmount: 5_000_000,
              remaining: 5_000_000,
              remainingAmount: 5_000_000,
              createdSeason: 2024,
              expiresOn: '2026-09-01T00:00:00.000Z',
            },
          ],
        },
      },
      outgoingPlayers: [],
      sends: [],
      incomingPlayers: [
        makePlayer(5_000_000, {
          absorptionMode: 'TPE',
          tpeId: 'old',
          fromTeamId: 'BOS',
        }),
      ],
      salaryOut: 0,
      salaryIn: 5_000_000,
      context: {
        ...baseTeam.context,
        tradeDate: '2025-07-10T00:00:00.000Z',
        capSettings: {
          salaryCap: 140_000_000,
          secondApron: 190_000_000,
        },
      },
    };

    const result = validateTradeExceptions(team);

    expect(result.passed).toBe(false);
    expect(issueTexts(result.violations)).toContain(
      SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED
    );
  });

  it('enforces 100% salary matching', () => {
    const failTeam = {
      ...baseTeam,
      teamTotalSalary: 200000000, // Above second apron
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_001)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_001,
      context: { ...baseTeam.context, capSettings },
    };
    const okTeam = {
      ...baseTeam,
      teamTotalSalary: 200000000, // Above second apron
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_000)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
      context: { ...baseTeam.context, capSettings },
    };

    // Test via validateSalaryMatching which is the SSOT for salary matching rules
    const failResult = validateSalaryMatching(failTeam, { capSettings });
    const okResult = validateSalaryMatching(okTeam, { capSettings });

    expect(failResult.violations.length).toBeGreaterThan(0);
    expect(failResult.violations[0]).toMatch(/second apron/i);
    expect(okResult.violations).toEqual([]);
  });
});
