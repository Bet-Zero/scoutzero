import { describe, expect, it } from 'vitest';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { normalizeSalaryBookAsOfDate } from '@/features/architect/utils/capTotals/teamSalaryBooks';
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
  it('derives one governed C03 charge, reverses it once for C07.11, and preserves Tax Salary', () => {
    const inputs = governedInputs();
    inputs.unsignedFirstRoundPickState = {
      version: 1,
      status: 'ready',
      teamCode: 'MIA',
      salaryCapYear: YEAR,
      entries: [],
      source: {
        evidenceId: 'bze-293:MIA:2027:none',
        evidenceVersion: 1,
        authority: 'external-determination',
        reference: 'authenticated-test-team-state:none',
        authenticatedAt: '2026-07-01T00:00:00-04:00',
        recordStatus: 'current',
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    };
    if (inputs.apronAdjustments.status === 'ready') {
      inputs.apronAdjustments.lineItems.forEach((item) => {
        item.effectiveFrom = '2026-07-01T00:00:00-04:00';
      });
    }
    if (inputs.taxSalary.status === 'ready') {
      inputs.taxSalary.lineItems.forEach((item, index) => {
        item.effectiveFrom = `2026-07-01T0${index}:00:00-04:00`;
      });
    }

    const totals = createCanonicalTeamTotalsSnapshot(
      team({ players: players(11), salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: '2026-07-02T12:00:00-04:00' }
    );

    expect(totals.incompleteRosterResolution).toMatchObject({
      mode: 'governed',
      status: 'complete',
      activeWindow: true,
      counts: { underContract: 11, total: 11 },
      threshold: 12,
      missingSlots: 1,
      amount: 1_357_763,
    });
    expect(totals.teamSalary).toBe(12_357_763);
    expect(totals.apronTeamSalary).toBe(12_800_000);
    expect(totals.taxSalary).toBe(20_300_000);
    const apronCharges =
      totals.salaryBooks.ledgers.apronTeamSalary.status === 'complete'
        ? totals.salaryBooks.ledgers.apronTeamSalary.lineItems.filter((item) =>
            item.canonLeafIds.includes('CBA2-C07.11')
          )
        : [];
    expect(apronCharges).toHaveLength(1);
    expect(apronCharges[0]?.amount).toBe(-1_357_763);

    const reloaded = normalizeCurrentStateTeamTotals(
      JSON.parse(JSON.stringify(totals))
    );
    expect(reloaded?.incompleteRosterResolution).toEqual(
      totals.incompleteRosterResolution
    );
    expect(reloaded?.salaryBooks).toEqual(totals.salaryBooks);
  });

  it('publishes Needs input instead of borrowing a number for unresolved governed pick state', () => {
    const inputs = governedInputs();
    inputs.unsignedFirstRoundPickState = {
      version: 1,
      status: 'needs-input',
      teamCode: 'MIA',
      salaryCapYear: YEAR,
      missingInputs: ['draftState.unsignedFirstRoundPicks'],
      reason: 'Unsigned first-round pick state is unresolved.',
    };
    const totals = createCanonicalTeamTotalsSnapshot(
      team({ players: players(11), salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: '2026-07-02T12:00:00-04:00' }
    );
    expect(totals.incompleteChargesTotal).toBeNull();
    expect(totals.totalCapAllocations).toBeNull();
    expect(totals.deltas).toEqual({
      vsCap: null,
      vsLuxuryTax: null,
      vsFirstApron: null,
      vsSecondApron: null,
    });
    expect(totals.teamSalary).toBeNull();
    expect(totals.incompleteRosterResolution).toMatchObject({
      mode: 'governed',
      status: 'needs-input',
      amount: null,
    });
  });

  it('rejects the legacy editable charge field when governed evidence is present', () => {
    const inputs = governedInputs();
    inputs.unsignedFirstRoundPickState = {
      version: 1,
      status: 'ready',
      teamCode: 'MIA',
      salaryCapYear: YEAR,
      entries: [],
      source: {
        evidenceId: 'bze-293:MIA:2027:none',
        evidenceVersion: 1,
        authority: 'external-determination',
        reference: 'authenticated-test-team-state:none',
        authenticatedAt: '2026-07-01T00:00:00-04:00',
        recordStatus: 'current',
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    };
    inputs.incompleteRosterCharge = {
      id: 'legacy:incomplete-roster',
      ledger: 'team-salary',
      label: 'Legacy editable charge',
      amount: 1_357_763,
      effectiveFrom: '2026-07-01T00:00:00-04:00',
      canonLeafIds: ['CBA2-A01.1'],
      source: { authority: 'team-state', reference: 'legacy-fixture' },
    };

    const totals = createCanonicalTeamTotalsSnapshot(
      team({ players: players(11), salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: '2026-07-02T12:00:00-04:00' }
    );

    expect(totals.incompleteRosterResolution?.status).toBe('complete');
    expect(totals.teamSalary).toBeNull();
    expect(totals.salaryBooks.ledgers.teamSalary).toMatchObject({
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.incompleteRosterCharge'],
    });
  });

  it('rejects duplicate governed C07.11 adjustment lines', () => {
    const inputs = governedInputs();
    if (inputs.apronAdjustments.status === 'ready') {
      inputs.apronAdjustments.lineItems.push(
        line('apron-team-salary', 'CBA2-C07.11', 0)
      );
    }

    const totals = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: WORLD_DATE }
    );

    expect(totals.salaryBooks.ledgers.apronTeamSalary).toMatchObject({
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.apronAdjustments.CBA2-C07.11'],
    });
    expect(totals.apronTeamSalary).toBeNull();
  });

  it('rejects a C07.11 adjustment line shared with another Canon leaf', () => {
    const inputs = governedInputs();
    if (inputs.apronAdjustments.status === 'ready') {
      const governedLine = inputs.apronAdjustments.lineItems.find((item) =>
        item.canonLeafIds.includes('CBA2-C07.11')
      );
      expect(governedLine).toBeDefined();
      if (!governedLine) throw new Error('Missing governed C07.11 fixture.');
      governedLine.canonLeafIds = ['CBA2-C07.11', 'CBA2-C07.10'];
    }

    const totals = createCanonicalTeamTotalsSnapshot(
      team({ salaryBookInputs: inputs }),
      YEAR,
      { asOfDate: WORLD_DATE }
    );

    expect(totals.salaryBooks.ledgers.apronTeamSalary).toMatchObject({
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.apronAdjustments.CBA2-C07.11'],
    });
    expect(totals.apronTeamSalary).toBeNull();
  });

  it('rejects a persisted governed result that no longer reconciles', () => {
    expect(() =>
      normalizeCurrentStateTeamTotals({
        incompleteRosterResolution: {
          mode: 'governed',
          status: 'complete',
          activeWindow: true,
          window: { opens: '2026-07-01', closes: '2026-10-20' },
          counts: {
            underContract: 11,
            veteranFreeAgentAmounts: 0,
            offerSheets: 0,
            unsignedFirstRoundPicks: 0,
            total: 11,
          },
          threshold: 12,
          missingSlots: 1,
          chargePerSlot: 1_357_763,
          amount: 0,
          canonLeafIds: ['CBA2-C03.1', 'CBA2-C03.2', 'CBA2-C07.11'],
          missingInputs: [],
          reason: 'Tampered persisted result.',
        },
      })
    ).toThrow('Persisted governed incomplete-roster result is malformed.');
  });

  it('accepts real saved-world dates and rejects impossible calendar dates', () => {
    expect(normalizeSalaryBookAsOfDate('2027-02-10')).toBe(
      '2027-02-10T00:00:00-05:00'
    );
    expect(normalizeSalaryBookAsOfDate('2027-07-01')).toBe(
      '2027-07-01T00:00:00-04:00'
    );
    expect(normalizeSalaryBookAsOfDate('2027-02-30')).toBeNull();
    expect(
      normalizeSalaryBookAsOfDate('2027-02-30T12:00:00-05:00')
    ).toBeNull();
    expect(normalizeSalaryBookAsOfDate(null)).toBeNull();
  });

  it('keeps future pre-window books numeric without borrowing a missing calendar', () => {
    const futureYear = 2028;
    const inputs = structuredClone(governedInputs());
    inputs.salaryCapYear = futureYear;
    inputs.unsignedFirstRoundPickState = {
      version: 1,
      status: 'needs-input',
      teamCode: 'MIA',
      salaryCapYear: futureYear,
      missingInputs: ['draftState.unsignedFirstRoundPicks'],
      reason:
        'Future unsigned first-round pick state is unavailable and must not be consulted before July 1.',
    };
    if (inputs.apronAdjustments.status === 'ready') {
      inputs.apronAdjustments.lineItems.forEach((item) => {
        item.effectiveFrom = '2027-06-29T00:00:00-04:00';
      });
    }
    if (inputs.taxSalary.status === 'ready') {
      inputs.taxSalary.lineItems.forEach((item) => {
        item.effectiveFrom = '2027-06-29T00:00:00-04:00';
      });
    }
    const futurePlayers = players().map((player) => ({
      ...player,
      contract: {
        ...player.contract,
        salariesByYear: player.contract.salariesByYear.map((salary) => ({
          ...salary,
          season: '2027-28',
        })),
      },
    }));
    const futureTeam = team({
      players: futurePlayers,
      salaryBookInputs: inputs,
    });

    const beforeWindow = createCanonicalTeamTotalsSnapshot(
      futureTeam,
      futureYear,
      { asOfDate: '2027-06-30' }
    );
    expect(beforeWindow.incompleteRosterResolution).toMatchObject({
      status: 'complete',
      activeWindow: false,
      window: { opens: '2027-07-01', closes: null },
      amount: 0,
    });
    expect(beforeWindow).toMatchObject({
      incompleteChargesTotal: 0,
      totalCapAllocations: 14_000_000,
      teamSalary: 14_000_000,
      apronTeamSalary: 15_800_000,
      taxSalary: 20_300_000,
      taxablePayroll: 20_300_000,
      salaryBooks: { status: 'complete' },
    });
    expect(
      new Set([
        beforeWindow.teamSalary,
        beforeWindow.apronTeamSalary,
        beforeWindow.taxSalary,
      ]).size
    ).toBe(3);
    expect(
      normalizeCurrentStateTeamTotals(JSON.parse(JSON.stringify(beforeWindow)))
    ).toMatchObject({
      incompleteChargesTotal: 0,
      totalCapAllocations: 14_000_000,
      teamSalary: 14_000_000,
      apronTeamSalary: 15_800_000,
      taxSalary: 20_300_000,
      incompleteRosterResolution: {
        status: 'complete',
        activeWindow: false,
        window: { opens: '2027-07-01', closes: null },
      },
    });

    const atWindowWithoutOpening = createCanonicalTeamTotalsSnapshot(
      futureTeam,
      futureYear,
      { asOfDate: '2027-07-01' }
    );
    expect(atWindowWithoutOpening.incompleteRosterResolution).toMatchObject({
      status: 'needs-input',
      activeWindow: null,
      window: { opens: '2027-07-01', closes: null },
      amount: null,
    });
    expect(atWindowWithoutOpening.totalCapAllocations).toBeNull();
    expect(atWindowWithoutOpening.teamSalary).toBeNull();
  });

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
      { asOfDate: '2026-07-02T12:00:00-04:00' }
    );
    expect(shortRoster.salaryBooks.ledgers.teamSalary.status).toBe(
      'needs-input'
    );
    expect(shortRoster.teamSalary).toBeNull();
    expect(shortRoster.apronTeamSalary).toBeNull();
  });
});
