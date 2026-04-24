import { describe, expect, it, vi } from 'vitest';
import {
  enforceSecondApronHandcuffs,
  validateSecondApron,
  validateSecondApronRules,
} from '@/features/architect/utils/tradeMachine/rules/basicRules';
import { SECOND_APRON_CASH_BLOCKED } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';

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
          cashSent: 1,
        },
        { capSettings }
      )
    ).toEqual({
      passed: false,
      violations: [SECOND_APRON_CASH_BLOCKED],
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
        cashSent: 1,
      },
      { capSettings },
      { reject }
    );

    expect(violations).toEqual([SECOND_APRON_CASH_BLOCKED]);
    expect(reject.mock.calls).toEqual([[SECOND_APRON_CASH_BLOCKED]]);
  });
});
