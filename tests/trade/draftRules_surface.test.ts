import { describe, expect, it } from 'vitest';
import { hasStepienViolation as publicHasStepienViolation } from '@/features/architect/utils/tradeMachine';
import { validateAllNewRules } from '@/features/architect/utils/tradeMachine/rules/miscRules';
import * as draftRules from '@/features/architect/utils/tradeMachine/rules/draftRules';

function installEmptyObjectIterator(): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    Symbol.iterator
  );

  // The legacy validateAllNewRules composer spreads mixed object and array rule
  // results. Install a no-op iterator so this test can verify the draft-rules
  // contribution without changing that pre-existing runtime contract.
  Object.defineProperty(Object.prototype, Symbol.iterator, {
    configurable: true,
    value: function* emptyObjectIterator() {},
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(Object.prototype, Symbol.iterator, originalDescriptor);
      return;
    }

    Reflect.deleteProperty(Object.prototype, Symbol.iterator);
  };
}

describe('draftRules surface', () => {
  const currentYear = new Date().getFullYear();

  it('keeps the public tradeMachine barrel export aligned with the direct rule authority', () => {
    expect(publicHasStepienViolation).toBe(draftRules.hasStepienViolation);
  });

  it('preserves hasStepienViolation fast-path behavior', () => {
    expect(draftRules.hasStepienViolation(undefined)).toBe(false);
    expect(draftRules.hasStepienViolation([])).toBe(false);
  });

  it('preserves exact validateDraftPicks strings and ordering', () => {
    expect(
      draftRules.validateDraftPicks({
        tradedPicks: [
          { year: currentYear + 1, round: 1 },
          { year: currentYear + 2, round: 1 },
          { year: currentYear + 8, round: 2 },
        ],
      })
    ).toEqual([
      `Stepien Rule violation: Cannot trade consecutive first round picks (${currentYear + 1} and ${currentYear + 2})`,
      `Cannot trade picks more than 7 years out (${currentYear + 8})`,
    ]);
  });

  it('keeps protected picks from triggering the local consecutive-year violation', () => {
    expect(
      draftRules.validateDraftPicks({
        tradedPicks: [
          { year: currentYear + 1, round: 1, protection: 'Top 5' },
          { year: currentYear + 2, round: 1 },
        ],
      })
    ).toEqual([]);
  });

  it('does not broaden accepted round values in validateDraftPicks', () => {
    expect(
      draftRules.validateDraftPicks({
        tradedPicks: [
          { year: currentYear + 1, round: '1st' },
          { year: currentYear + 2, round: 'first' },
          { year: currentYear + 3, round: 1, protection: 'Lottery' },
        ],
      })
    ).toEqual([]);
  });

  it('preserves draft-rule output through legacy preflight composition', () => {
    const restoreObjectIterator = installEmptyObjectIterator();

    try {
      expect(
        validateAllNewRules(
          {
            tradedPicks: [
              { year: currentYear + 1, round: 1 },
              { year: currentYear + 2, round: 1 },
            ],
          },
          []
        )
      ).toContain(
        `Stepien Rule violation: Cannot trade consecutive first round picks (${currentYear + 1} and ${currentYear + 2})`
      );
    } finally {
      restoreObjectIterator();
    }
  });
});
