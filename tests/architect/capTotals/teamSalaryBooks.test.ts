import { describe, expect, it } from 'vitest';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import { normalizeCurrentStateTeamTotals } from '@/features/architect/utils/mutationPipeline.read.normalizeData.capData';
import {
  SalaryBooksSnapshotZ,
  type TeamSalaryBookInputs,
} from '@/schemas/salaryBooks';

const SEASON = '2026-27';
const YEAR = 2027;
const WORLD_DATE = '2027-04-11T12:00:00Z';

function players(count = 14) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: SEASON,
          salary: 1_000_000,
          capHit: 1_000_000,
          incentives: { likely: 0, unlikely: 0 },
        },
      ],
    },
  }));
}

function line(
  ledger: 'apron-team-salary' | 'tax-salary',
  leafId: string,
  amount: number,
  effectiveFrom = '2026-10-20T00:00:00Z'
) {
  return {
    id: `${ledger}:${leafId}`,
    ledger,
    label: leafId,
    amount,
    effectiveFrom,
    canonLeafIds: [leafId],
    source: {
      authority: 'external-determination' as const,
      reference: `fixture:${leafId}`,
    },
  };
}

function governedInputs(): TeamSalaryBookInputs {
  return {
    version: 1,
    salaryCapYear: YEAR,
    apronAdjustments: {
      status: 'ready',
      lineItems: [
        line('apron-team-salary', 'CBA2-C07.2', 1_000_000),
        line('apron-team-salary', 'CBA2-C07.3', 200_000),
        line('apron-team-salary', 'CBA2-C07.4', 300_000),
        line('apron-team-salary', 'CBA2-C07.5', -400_000),
        line('apron-team-salary', 'CBA2-C07.6', 500_000),
        line('apron-team-salary', 'CBA2-C07.7', -600_000),
        line('apron-team-salary', 'CBA2-C07.8', 700_000),
        line('apron-team-salary', 'CBA2-C07.9', -800_000),
        line('apron-team-salary', 'CBA2-C07.10', 900_000),
        line('apron-team-salary', 'CBA2-C07.11', 0),
      ],
    },
    taxSalary: {
      status: 'ready',
      lineItems: [
        line('tax-salary', 'CBA2-C08.1', 20_000_000, '2027-04-11T00:00:00Z'),
        line('tax-salary', 'CBA2-C08.2', 100_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.3', -200_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.4', 300_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.5', -100_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.6', 50_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.7', 400_000, '2027-04-11T01:00:00Z'),
        line('tax-salary', 'CBA2-C08.8', -250_000, '2027-04-11T01:00:00Z'),
      ],
    },
  };
}

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: 'MIA',
    teamCode: 'MIA',
    players: players(),
    capHolds: [],
    deadCap: [],
    offerSheets: [],
    salaryBookInputs: governedInputs(),
    ...overrides,
  };
}

describe('BZE-285 independent salary books', () => {
  it('computes three discriminating books without substituting one total', () => {
    const totals = createCanonicalTeamTotalsSnapshot(team(), YEAR, {
      asOfDate: WORLD_DATE,
    });

    expect(totals.salaryBooks.status).toBe('complete');
    expect(totals.teamSalary).toBe(14_000_000);
    expect(totals.apronTeamSalary).toBe(15_800_000);
    expect(totals.taxSalary).toBe(20_300_000);
    expect(totals.taxablePayroll).toBe(totals.taxSalary);
    expect(
      new Set([totals.teamSalary, totals.apronTeamSalary, totals.taxSalary])
        .size
    ).toBe(3);
  });

  it.each([
    [
      'apron adjustment',
      (inputs: TeamSalaryBookInputs) => {
        if (inputs.apronAdjustments.status === 'ready') {
          inputs.apronAdjustments.lineItems =
            inputs.apronAdjustments.lineItems.filter(
              (item) => !item.canonLeafIds.includes('CBA2-C07.7')
            );
        }
      },
      'apronTeamSalary',
    ],
    [
      'tax book',
      (inputs: TeamSalaryBookInputs) => {
        if (inputs.taxSalary.status === 'ready') {
          inputs.taxSalary.lineItems = inputs.taxSalary.lineItems.filter(
            (item) => !item.canonLeafIds.includes('CBA2-C08.4')
          );
        }
      },
      'taxSalary',
    ],
  ] as const)('fails closed when the %s is removed', (_label, mutate, book) => {
    const inputs = governedInputs();
    mutate(inputs);
    const totals = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: WORLD_DATE }
    );

    expect(totals.salaryBooks.ledgers[book].status).toBe('needs-input');
    expect(totals[book]).toBeNull();
  });

  it('recomputes dated Apron adjustments and does not publish Tax Salary before its baseline', () => {
    const inputs = governedInputs();
    if (inputs.apronAdjustments.status === 'ready') {
      inputs.apronAdjustments.lineItems[0].effectiveFrom =
        '2027-01-01T00:00:00Z';
    }

    const before = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: '2026-12-31T12:00:00Z' }
    );
    const after = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: '2027-01-02T12:00:00Z' }
    );

    expect(before.apronTeamSalary).toBe(14_800_000);
    expect(after.apronTeamSalary).toBe(15_800_000);
    expect(before.salaryBooks.ledgers.taxSalary.status).toBe('not-evaluated');
    expect(before.taxSalary).toBeNull();
  });

  it('rejects swapped ledger identities and applies each legality threshold to its own book', () => {
    const totals = createCanonicalTeamTotalsSnapshot(team(), YEAR, {
      asOfDate: WORLD_DATE,
    });
    const swapped = structuredClone(totals.salaryBooks);
    [swapped.ledgers.apronTeamSalary, swapped.ledgers.taxSalary] = [
      swapped.ledgers.taxSalary,
      swapped.ledgers.apronTeamSalary,
    ];
    expect(SalaryBooksSnapshotZ.safeParse(swapped).success).toBe(false);

    const discriminatingTotals = {
      ...totals,
      teamSalary: 100_000_000,
      apronTeamSalary: 181_000_000,
      taxSalary: 175_000_000,
      luxuryTax: 170_000_000,
      firstApron: 180_000_000,
      secondApron: 190_000_000,
    };
    const result = validatePostStateCapLegality({
      operationId: 'bze-285-threshold-books',
      mutationType: 'executeTrade',
      worldId: 'world-bze-285',
      year: YEAR,
      beforeTeamsByCode: { MIA: team() },
      afterTeamsByCode: {
        MIA: { ...team(), hardCapped: true, hardCapLevel: 'firstApron' },
      },
      beforeTotalsByTeam: { MIA: discriminatingTotals },
      afterTotalsByTeam: { MIA: discriminatingTotals },
      rulesContext: {
        capSettings: { firstApron: 180_000_000, secondApron: 190_000_000 },
        minimumTeamSalary: 110_000_000,
      },
    });

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'HARD_CAP_EXCEEDED',
        actual: 181_000_000,
      })
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'SALARY_FLOOR_NOT_MET',
        actual: 100_000_000,
      })
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'LUXURY_TAX_EXCEEDED',
        actual: 175_000_000,
      })
    );
  });

  it('does not borrow legacy allocations when named salary books are absent', () => {
    const legacyOnly = {
      yearKey: YEAR,
      playersTotal: 14_000_000,
      deadMoneyTotal: 0,
      capHoldsTotal: 0,
      incompleteChargesTotal: 0,
      totalCapAllocations: 14_000_000,
      salaryCap: 164_961_000,
      luxuryTax: 200_428_000,
      firstApron: 209_015_000,
      secondApron: 221_686_000,
    };
    const result = validatePostStateCapLegality({
      operationId: 'bze-285-no-generic-fallback',
      mutationType: 'executeTrade',
      worldId: 'world-bze-285',
      year: YEAR,
      afterTeamsByCode: { MIA: team() },
      afterTotalsByTeam: { MIA: legacyOnly },
      rulesContext: {
        capSettings: { firstApron: 209_015_000, secondApron: 221_686_000 },
      },
    });

    expect(
      result.warnings.filter(
        (issue) => issue.code === 'SALARY_BOOK_NEEDS_INPUT'
      )
    ).toHaveLength(3);
  });

  it('round-trips three distinct book identities through saved-world normalization', () => {
    const totals = createCanonicalTeamTotalsSnapshot(team(), YEAR, {
      asOfDate: WORLD_DATE,
    });
    const reloaded = normalizeCurrentStateTeamTotals(
      JSON.parse(JSON.stringify(totals))
    );

    expect(reloaded).toMatchObject({
      teamSalary: 14_000_000,
      apronTeamSalary: 15_800_000,
      taxSalary: 20_300_000,
      salaryBooks: {
        ledgers: {
          teamSalary: { kind: 'team-salary', total: 14_000_000 },
          apronTeamSalary: {
            kind: 'apron-team-salary',
            total: 15_800_000,
          },
          taxSalary: { kind: 'tax-salary', total: 20_300_000 },
        },
      },
    });

    const malformed = JSON.parse(JSON.stringify(totals));
    malformed.salaryBooks.ledgers.taxSalary.kind = 'apron-team-salary';
    expect(() => normalizeCurrentStateTeamTotals(malformed)).toThrow(
      'Persisted salary-book snapshot is malformed or has lost ledger identity.'
    );
  });

  it('fails closed for wrong-signed, malformed, unsupported, and incomplete-roster inputs', () => {
    const wrongSign = governedInputs();
    if (wrongSign.apronAdjustments.status === 'ready') {
      wrongSign.apronAdjustments.lineItems[3].amount = 400_000;
    }
    const signed = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: wrongSign }),
      YEAR,
      { asOfDate: WORLD_DATE }
    );
    expect(signed.apronTeamSalary).toBeNull();
    expect(signed.salaryBooks.ledgers.apronTeamSalary.status).toBe(
      'needs-input'
    );

    const unsupported = createCanonicalTeamTotalsSnapshot(team(), 2026, {
      asOfDate: '2026-04-01T12:00:00Z',
    });
    expect(unsupported.salaryBooks.status).toBe('needs-input');
    expect(unsupported.teamSalary).toBe(0);
    expect(unsupported.apronTeamSalary).toBeNull();
    expect(unsupported.taxSalary).toBeNull();

    const shortRoster = createCanonicalTeamTotalsSnapshot(
      team({ players: players(13) }),
      YEAR,
      { asOfDate: WORLD_DATE }
    );
    expect(shortRoster.salaryBooks.ledgers.teamSalary.status).toBe(
      'needs-input'
    );
    expect(shortRoster.teamSalary).toBeNull();
    expect(shortRoster.apronTeamSalary).toBeNull();
  });
});
