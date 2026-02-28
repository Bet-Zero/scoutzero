import { describe, expect, it } from 'vitest';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';

function makeTotals(overrides: Record<string, unknown> = {}) {
  return {
    yearKey: 2026,
    playersTotal: 120_000_000,
    deadMoneyTotal: 5_000_000,
    capHoldsTotal: 2_000_000,
    incompleteChargesTotal: 1_000_000,
    totalCapAllocations: 128_000_000,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 180_000_000,
    secondApron: 190_000_000,
    ...overrides,
  };
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op_test_1',
    mutationType: 'executeTrade',
    worldId: 'world_test',
    year: 2026,
    beforeTeamsByCode: {
      BOS: { teamCode: 'BOS' },
    },
    afterTeamsByCode: {
      BOS: { teamCode: 'BOS' },
    },
    beforeTotalsByTeam: {
      BOS: makeTotals(),
    },
    afterTotalsByTeam: {
      BOS: makeTotals(),
    },
    rulesContext: {
      capSettings: {
        firstApron: 180_000_000,
        secondApron: 190_000_000,
      },
      minimumTeamSalary: 120_000_000,
    },
    ...overrides,
  };
}

describe('postStateCapValidator behavior', () => {
  it('returns violation when totals contain NaN', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: Number.NaN,
          }),
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'TOTALS_NON_FINITE')).toBe(
      true
    );
  });

  it('emits salary floor warning only (does not block)', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 100_000_000,
          }),
        },
        rulesContext: {
          capSettings: {
            firstApron: 180_000_000,
            secondApron: 190_000_000,
          },
          minimumTeamSalary: 110_000_000,
        },
      })
    );

    expect(result.valid).toBe(true);
    expect(
      result.warnings.some((warning) => warning.code === 'SALARY_FLOOR_NOT_MET')
    ).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns violation when hard cap ceiling is exceeded', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            hardCapLevel: 'firstApron',
            hardCapped: true,
          },
        },
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 181_000_000,
          }),
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.code === 'HARD_CAP_EXCEEDED')).toBe(
      true
    );
  });
});
