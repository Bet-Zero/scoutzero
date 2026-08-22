import { describe, expect, it } from 'vitest';
import {
  validatePostStateCapLegality,
  POST_STATE_CAP_VALIDATOR_VERSION,
} from '@/features/architect/utils/capLegality/postStateCapValidator';

function makeTotals(overrides: Record<string, unknown> = {}) {
  const bookTotal = Object.prototype.hasOwnProperty.call(
    overrides,
    'totalCapAllocations'
  )
    ? overrides.totalCapAllocations
    : 128_000_000;
  return {
    yearKey: 2026,
    playersTotal: 120_000_000,
    deadMoneyTotal: 5_000_000,
    capHoldsTotal: 2_000_000,
    incompleteChargesTotal: 1_000_000,
    totalCapAllocations: bookTotal,
    teamSalary: bookTotal,
    apronTeamSalary: bookTotal,
    taxSalary: bookTotal,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 180_000_000,
    secondApron: 190_000_000,
    ...overrides,
  };
}

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
  return {
    playerId: id,
    contract: {
      contractType: 'standard',
      salariesByYear: [
        { season: '2025-26', salary: 10_000_000, capHit: 10_000_000 },
      ],
      ...((overrides.contract as Record<string, unknown>) || {}),
    },
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
  // --- v0.1.0 existing tests ---

  it('exports version 1.0.0', () => {
    expect(POST_STATE_CAP_VALIDATOR_VERSION).toBe('1.0.0');
  });

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

  it('re-verifies hard cap from rulesContext.hardCapByTeam against final totals', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
          },
        },
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 181_000_000,
          }),
        },
        rulesContext: {
          capSettings: {
            firstApron: 180_000_000,
            secondApron: 190_000_000,
          },
          minimumTeamSalary: 120_000_000,
          hardCapByTeam: {
            BOS: {
              isHardCapped: true,
              hardCapLevel: 'firstApron',
              ceiling: 180_000_000,
            },
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    const violation = result.violations.find((v) => v.code === 'HARD_CAP_EXCEEDED');
    expect(violation).toMatchObject({
      teamCode: 'BOS',
      expected: 180_000_000,
      actual: 181_000_000,
    });
  });

  // --- v1.0.0 new rule tests ---

  it('PSV_ROSTER_001: warns (advisory, non-blocking) when standard roster exceeds 15', () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`p${i}`)
    );
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players },
        },
      })
    );

    // Roster size is advisory (validationFlags.rosterEnforcement === 'warn'):
    // the over-15 breach is a warning and does NOT fail validation.
    expect(result.valid).toBe(true);
    expect(
      result.violations.some((v) => v.code === 'ROSTER_MAX_EXCEEDED')
    ).toBe(false);
    const warning = result.warnings.find(
      (v) => v.code === 'ROSTER_MAX_EXCEEDED'
    );
    expect(warning?.actual).toBe(16);
    expect(warning?.expected).toBe(15);
  });

  it('PSV_ROSTER_001: passes with exactly 15 standard players', () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makePlayer(`p${i}`)
    );
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'ROSTER_MAX_EXCEEDED')
    ).toBe(false);
  });

  it('PSV_ROSTER_003: returns violation when two-way contracts exceed 3', () => {
    const twoWayPlayers = Array.from({ length: 4 }, (_, i) =>
      makePlayer(`tw${i}`, {
        contract: { contractType: 'two-way', salariesByYear: [{ season: '2025-26', salary: 500_000, capHit: 500_000 }] },
      })
    );
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players: twoWayPlayers },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED')
    ).toBe(true);
    const violation = result.violations.find(
      (v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED'
    );
    expect(violation?.actual).toBe(4);
    expect(violation?.expected).toBe(3);
  });

  it('PSV_ROSTER_003: passes with exactly 3 two-way contracts', () => {
    const twoWayPlayers = Array.from({ length: 3 }, (_, i) =>
      makePlayer(`tw${i}`, {
        contract: { contractType: 'two-way', salariesByYear: [{ season: '2025-26', salary: 500_000, capHit: 500_000 }] },
      })
    );
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players: twoWayPlayers },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED')
    ).toBe(false);
  });

  it('PSV_CONTRACT_004: returns violation when contract rows have negative salary', () => {
    const players = [
      makePlayer('p1', {
        contract: {
          contractType: 'standard',
          salariesByYear: [
            { season: '2025-26', salary: -1, capHit: 10_000_000 },
          ],
        },
      }),
    ];
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'CONTRACT_ROWS_INVALID')
    ).toBe(true);
  });

  it('PSV_CONTRACT_004: passes with valid contract rows', () => {
    const players = [makePlayer('p1')];
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', players },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'CONTRACT_ROWS_INVALID')
    ).toBe(false);
  });

  it('PSV_DEAD_001: returns violation when deadCap is not an array', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', deadCap: 'not-an-array' },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'DEAD_CAP_INVALID')
    ).toBe(true);
  });

  it('applies the same post-state artifact validation to non-trade mutation types', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        mutationType: 'waivePlayer',
        afterTeamsByCode: {
          BOS: { teamCode: 'BOS', deadCap: 'not-an-array' },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        (v) => v.code === 'DEAD_CAP_INVALID' && v.teamCode === 'BOS'
      )
    ).toBe(true);
  });

  it('PSV_DEAD_001: passes when deadCap is a valid array', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            deadCap: [
              { playerId: 'p1', amountByYear: [{ season: '2025-26', amount: 5_000_000 }] },
            ],
          },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'DEAD_CAP_INVALID')
    ).toBe(false);
  });

  it('PSV_EXC_001: returns violation when exception has non-boolean enabled', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            exceptions: {
              mle: { enabled: 'yes', totalAmount: 12_000_000, usedAmount: 0, seasonKey: '2025-26' },
            },
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'EXCEPTIONS_INVALID')
    ).toBe(true);
  });

  it('PSV_EXC_002: returns violation when exception usedAmount > totalAmount', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            exceptions: {
              mle: { enabled: true, totalAmount: 10_000_000, usedAmount: 15_000_000, seasonKey: '2025-26' },
            },
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'EXCEPTIONS_INVALID')
    ).toBe(true);
  });

  it('PSV_EXC_001-002: passes with valid exceptions', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            exceptions: {
              mle: { enabled: true, totalAmount: 12_000_000, usedAmount: 3_000_000, seasonKey: '2025-26' },
            },
          },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'EXCEPTIONS_INVALID')
    ).toBe(false);
  });

  it('PSV_HOLD_001: returns violation when cap hold has NaN amount', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            capHolds: [
              { playerId: 'p1', amount: NaN, type: 'Full Bird', active: true },
            ],
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'CAP_HOLD_INVALID')
    ).toBe(true);
  });

  it('PSV_HOLD_001: returns violation when cap hold has negative amount', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            capHolds: [
              { playerId: 'p1', amount: -100, type: 'Full Bird', active: true },
            ],
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'CAP_HOLD_INVALID')
    ).toBe(true);
  });

  it('PSV_HOLD_001: returns violation when cap hold is missing playerId', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            capHolds: [
              { amount: 5_000_000, type: 'Full Bird', active: true },
            ],
          },
        },
      })
    );

    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.code === 'CAP_HOLD_INVALID')
    ).toBe(true);
  });

  it('PSV_HOLD_001: passes with valid cap holds', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            capHolds: [
              { playerId: 'p1', amount: 5_000_000, type: 'Full Bird', active: true },
            ],
          },
        },
      })
    );

    expect(
      result.violations.some((v) => v.code === 'CAP_HOLD_INVALID')
    ).toBe(false);
  });

  it('PSV_CAP_004: emits luxury tax warning but keeps valid:true', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 175_000_000,
            luxuryTax: 170_000_000,
          }),
        },
      })
    );

    expect(result.valid).toBe(true);
    expect(
      result.warnings.some((w) => w.code === 'LUXURY_TAX_EXCEEDED')
    ).toBe(true);
    const warning = result.warnings.find(
      (w) => w.code === 'LUXURY_TAX_EXCEEDED'
    );
    expect(warning?.expected).toBe(170_000_000);
    expect(warning?.actual).toBe(175_000_000);
  });

  it('PSV_CAP_004: does not emit luxury tax warning when below threshold', () => {
    const result = validatePostStateCapLegality(
      makeInput({
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 128_000_000,
            luxuryTax: 170_000_000,
          }),
        },
      })
    );

    expect(
      result.warnings.some((w) => w.code === 'LUXURY_TAX_EXCEEDED')
    ).toBe(false);
  });

  it('valid:true when all v1.0.0 checks pass on a clean team', () => {
    // 14 players = legal minimum standard roster; satisfies PSV_ROSTER_001/002.
    const players = Array.from({ length: 14 }, (_, i) =>
      makePlayer(`p${i}`)
    );
    const result = validatePostStateCapLegality(
      makeInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            players,
            deadCap: [
              { playerId: 'waived1', amountByYear: [{ season: '2025-26', amount: 2_000_000 }] },
            ],
            exceptions: {
              mle: { enabled: true, totalAmount: 12_000_000, usedAmount: 0, seasonKey: '2025-26' },
            },
            capHolds: [
              { playerId: 'fa1', amount: 3_000_000, type: 'Full Bird', active: true },
            ],
          },
        },
      })
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
