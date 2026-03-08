import { describe, expect, it, vi } from 'vitest';
import {
  enforceSecondApronHandcuffs,
  validateSecondApron,
  validateSecondApronRules,
} from '@/features/architect/utils/tradeMachine/rules/basicRules.js';
import {
  SECOND_APRON_CASH_BLOCKED,
  SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED,
  SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';

const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 179_000_000,
  secondApron: 190_000_000,
};

describe('basicRules compatibility surface', () => {
  it('exports the canonical second-apron helpers through the .js shim path', () => {
    expect(typeof validateSecondApronRules).toBe('function');
    expect(typeof validateSecondApron).toBe('function');
    expect(typeof enforceSecondApronHandcuffs).toBe('function');
  });

  it('preserves the exact direct helper result shape and violation order', () => {
    expect(
      validateSecondApronRules(
        {
          teamTotalSalary: 210_000_000,
          tradeExceptions: [{ id: 'old', amount: 5_000_000, createdSeason: 2024 }],
          sends: [{ id: 'p1' }, { id: 'p2' }],
          cashSent: 1,
        },
        { capSettings, year: 2025 }
      )
    ).toEqual({
      passed: false,
      violations: [
        SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
        SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED,
        SECOND_APRON_CASH_BLOCKED,
      ],
      warningsOnly: false,
    });
  });

  it('preserves strict direct-helper pass semantics at the second-apron boundary and alias parity', () => {
    const team = {
      teamTotalSalary: 180_000_000,
      projectedSalary: 190_000_000,
      sends: [],
      cashSent: 0,
    };
    const context = { capSettings };

    expect(validateSecondApronRules(team, context)).toEqual({
      passed: true,
      violations: [],
      warningsOnly: false,
    });
    expect(validateSecondApron(team, context)).toEqual(
      validateSecondApronRules(team, context)
    );
  });

  it('preserves reject-callback behavior for second-apron enforcement', () => {
    const reject = vi.fn();

    const violations = enforceSecondApronHandcuffs(
      {
        teamTotalSalary: 210_000_000,
        tradeExceptions: [{ id: 'old', amount: 5_000_000, createdSeason: 2024 }],
        outgoingPlayers: [{ id: 'p1' }, { id: 'p2' }],
        cashSent: 1,
      },
      { capSettings, year: 2025 },
      { reject }
    );

    expect(violations).toEqual([
      SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
      SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED,
      SECOND_APRON_CASH_BLOCKED,
    ]);
    expect(reject.mock.calls).toEqual([
      [SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED],
      [SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED],
      [SECOND_APRON_CASH_BLOCKED],
    ]);
  });
});
