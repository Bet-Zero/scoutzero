import { describe, expect, it, vi } from 'vitest';
import {
  enforceSecondApronHandcuffs,
  validateSecondApron,
  validateSecondApronRules,
} from '@/features/architect/utils/tradeMachine/rules/basicRules';

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

  it('leaves governed Row I enforcement to the apron evaluator', () => {
    expect(
      validateSecondApronRules(
        {
          teamTotalSalary: 210_000_000,
          cashSent: 1,
        },
        { capSettings }
      )
    ).toEqual({
      passed: true,
      violations: [],
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

  it('does not emit a duplicate reject callback for governed restrictions', () => {
    const reject = vi.fn();

    const violations = enforceSecondApronHandcuffs(
      {
        teamTotalSalary: 210_000_000,
        cashSent: 1,
      },
      { capSettings },
      { reject }
    );

    expect(violations).toEqual([]);
    expect(reject).not.toHaveBeenCalled();
  });
});
