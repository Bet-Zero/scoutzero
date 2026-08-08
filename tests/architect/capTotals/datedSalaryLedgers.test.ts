import { describe, expect, it } from 'vitest';
import {
  evaluateDatedSalaryLedgers,
  type DatedSalaryLedgerRequest,
  type SalaryLedgerLineItem,
} from '@/features/architect/utils/capTotals';

const CONTEXT = {
  asOfDate: '2026-04-13T12:00:00-04:00',
  salaryCapYear: 2026,
  team: { teamId: 'TEAM-R7-001', teamCode: 'R7A' },
} as const;

const teamSalaryBase: SalaryLedgerLineItem<'team-salary'> = {
  id: 'team-salary-base',
  ledger: 'team-salary',
  label: 'Team Salary at the evaluation instant',
  amount: 150_000_000,
  effectiveFrom: '2025-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C01.1'],
  source: { authority: 'team-state', reference: 'TEAM-R7-001@v1' },
};

const apronSalaryBase: SalaryLedgerLineItem<'apron-team-salary'> = {
  id: 'apron-team-salary-base',
  ledger: 'apron-team-salary',
  label: 'Apron Team Salary baseline',
  amount: 150_000_000,
  effectiveFrom: '2025-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C07.1'],
  source: { authority: 'canon', reference: 'EV2-0186' },
};

const excludedPerformanceBonus: SalaryLedgerLineItem<'apron-team-salary'> = {
  id: 'apron-excluded-performance-bonus',
  ledger: 'apron-team-salary',
  label: 'Performance bonus excluded from Salary',
  amount: 1_000_000,
  effectiveFrom: '2025-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-C07.2'],
  source: {
    authority: 'canon',
    reference: 'EV2-0187 / CBA2-SC-026(a)',
  },
};

const taxSalaryBaseline: SalaryLedgerLineItem<'tax-salary'> = {
  id: 'tax-last-game-baseline',
  ledger: 'tax-salary',
  label: 'Team Salary at start of last Regular Season game',
  amount: 200_000_000,
  effectiveFrom: '2026-04-12T19:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C08.1'],
  source: {
    authority: 'canon',
    reference: 'EV2-0197 / CBA2-SC-027(a)',
  },
};

const postBaselineContractEvent: SalaryLedgerLineItem<'tax-salary'> = {
  id: 'tax-post-baseline-contract-event',
  ledger: 'tax-salary',
  label: 'Post-baseline contract Tax Salary effect',
  amount: 2_000_000,
  effectiveFrom: '2026-04-13T12:00:00-04:00',
  canonLeafIds: ['CBA2-C08.2'],
  source: {
    authority: 'canon',
    reference: 'EV2-0198 / CBA2-SC-027(b)',
  },
};

function buildCanonFixture(
  asOfDate = CONTEXT.asOfDate
): DatedSalaryLedgerRequest {
  return {
    context: { ...CONTEXT, asOfDate },
    ledgers: {
      teamSalary: { status: 'ready', lineItems: [teamSalaryBase] },
      apronTeamSalary: {
        status: 'ready',
        lineItems: [apronSalaryBase, excludedPerformanceBonus],
      },
      taxSalary: {
        status: 'ready',
        lineItems: [taxSalaryBaseline, postBaselineContractEvent],
      },
    },
  };
}

describe('BZE-268 dated independent salary-ledger spine', () => {
  it('keeps Team, Apron, and Tax Salary independent for one team and date', () => {
    const result = evaluateDatedSalaryLedgers(buildCanonFixture());

    expect(result.status).toBe('complete');
    expect(result.context).toEqual(CONTEXT);
    expect(result.ledgers.teamSalary).toMatchObject({
      kind: 'team-salary',
      status: 'complete',
      total: 150_000_000,
    });
    expect(result.ledgers.apronTeamSalary).toMatchObject({
      kind: 'apron-team-salary',
      status: 'complete',
      total: 151_000_000,
    });
    expect(result.ledgers.taxSalary).toMatchObject({
      kind: 'tax-salary',
      status: 'complete',
      total: 202_000_000,
    });
    expect(
      new Set([
        result.ledgers.teamSalary.total,
        result.ledgers.apronTeamSalary.total,
        result.ledgers.taxSalary.total,
      ]).size
    ).toBe(3);
    expect(result.ledgers.teamSalary.lineItems).not.toBe(
      result.ledgers.apronTeamSalary.lineItems
    );
    expect(result.ledgers.apronTeamSalary.lineItems).not.toBe(
      result.ledgers.taxSalary.lineItems
    );
  });

  it('evaluates line-item effectiveness at the caller-supplied instant', () => {
    const beforeEvent = evaluateDatedSalaryLedgers(
      buildCanonFixture('2026-04-13T11:59:59-04:00')
    );
    const atEvent = evaluateDatedSalaryLedgers(buildCanonFixture());

    expect(beforeEvent.ledgers.taxSalary).toMatchObject({
      status: 'complete',
      total: 200_000_000,
      lineItems: [
        { id: 'tax-last-game-baseline', included: true },
        {
          id: 'tax-post-baseline-contract-event',
          included: false,
          exclusionReason: 'not-yet-effective',
        },
      ],
    });
    expect(atEvent.ledgers.taxSalary).toMatchObject({
      status: 'complete',
      total: 202_000_000,
      lineItems: [
        { id: 'tax-last-game-baseline', included: true },
        {
          id: 'tax-post-baseline-contract-event',
          included: true,
          exclusionReason: null,
        },
      ],
    });
  });

  it('returns needs-input instead of substituting runtime date, season, or team', () => {
    const result = evaluateDatedSalaryLedgers({
      context: {
        asOfDate: '2026-04-13T12:00:00',
        team: { teamId: '' },
      },
      ledgers: buildCanonFixture().ledgers,
    });

    expect(result.status).toBe('needs-input');
    expect(result.context).toBeNull();
    expect(result.ledgers.teamSalary).toMatchObject({
      status: 'needs-input',
      total: null,
      lineItems: [],
      missingInputs: [
        'context.asOfDate',
        'context.salaryCapYear',
        'context.team.teamId',
      ],
    });
    expect(result.ledgers.apronTeamSalary.total).toBeNull();
    expect(result.ledgers.taxSalary.total).toBeNull();
  });

  it.each([
    '2026-02-30T12:00:00Z',
    '2026-04-31T12:00:00-04:00',
    '2025-02-29T12:00:00Z',
  ])('rejects an impossible governed context date: %s', (asOfDate) => {
    const result = evaluateDatedSalaryLedgers(buildCanonFixture(asOfDate));

    expect(result).toMatchObject({
      status: 'needs-input',
      context: null,
      ledgers: {
        teamSalary: {
          status: 'needs-input',
          total: null,
          missingInputs: ['context.asOfDate'],
        },
      },
    });
  });

  it('accepts a valid leap-day governed context date', () => {
    const result = evaluateDatedSalaryLedgers(
      buildCanonFixture('2024-02-29T12:00:00Z')
    );

    expect(result.status).toBe('complete');
    expect(result.context?.asOfDate).toBe('2024-02-29T12:00:00Z');
  });

  it.each([
    ['effectiveFrom', '2026-02-30T12:00:00Z'],
    ['effectiveUntil', '2025-02-29T12:00:00Z'],
  ] as const)(
    'rejects an impossible line-item %s date with its exact input path',
    (field, value) => {
      const invalidLineItem = {
        ...teamSalaryBase,
        [field]: value,
      } as SalaryLedgerLineItem<'team-salary'>;
      const request = buildCanonFixture();
      request.ledgers!.teamSalary = {
        status: 'ready',
        lineItems: [invalidLineItem],
      };

      const result = evaluateDatedSalaryLedgers(request);

      expect(result.ledgers.teamSalary).toMatchObject({
        status: 'needs-input',
        total: null,
        lineItems: [],
        missingInputs: [`ledgers.team-salary.lineItems[0].${field}`],
      });
    }
  );

  it('preserves per-ledger needs-input and not-evaluated states', () => {
    const result = evaluateDatedSalaryLedgers({
      context: CONTEXT,
      ledgers: {
        teamSalary: { status: 'ready', lineItems: [teamSalaryBase] },
        apronTeamSalary: {
          status: 'needs-input',
          missingInputs: ['excludedPerformanceBonuses'],
          reason: 'Apron adjustments have not been supplied.',
        },
        taxSalary: {
          status: 'not-evaluated',
          reason: 'Last Regular Season game baseline is not registered.',
        },
      },
    });

    expect(result.status).toBe('needs-input');
    expect(result.ledgers.teamSalary.total).toBe(150_000_000);
    expect(result.ledgers.apronTeamSalary).toMatchObject({
      status: 'needs-input',
      total: null,
      missingInputs: ['excludedPerformanceBonuses'],
    });
    expect(result.ledgers.taxSalary).toMatchObject({
      status: 'not-evaluated',
      total: null,
    });
  });

  it('rejects a line item assigned to the wrong ledger kind', () => {
    const result = evaluateDatedSalaryLedgers({
      context: CONTEXT,
      ledgers: {
        teamSalary: { status: 'ready', lineItems: [teamSalaryBase] },
        apronTeamSalary: {
          status: 'ready',
          lineItems: [
            teamSalaryBase as unknown as SalaryLedgerLineItem<'apron-team-salary'>,
          ],
        },
        taxSalary: { status: 'ready', lineItems: [taxSalaryBaseline] },
      },
    });

    expect(result.ledgers.teamSalary.total).toBe(150_000_000);
    expect(result.ledgers.apronTeamSalary).toMatchObject({
      status: 'needs-input',
      total: null,
      missingInputs: ['ledgers.apron-team-salary.lineItems[0].ledger'],
    });
  });

  it.each([undefined, 'spreadsheet-export'])(
    'rejects a runtime-decoded source authority of %s with its exact input path',
    (authority) => {
      const invalidLineItem = {
        ...teamSalaryBase,
        source: {
          ...(authority === undefined ? {} : { authority }),
          reference: 'TEAM-R7-001@decoded',
        },
      } as unknown as SalaryLedgerLineItem<'team-salary'>;
      const request = buildCanonFixture();
      request.ledgers!.teamSalary = {
        status: 'ready',
        lineItems: [invalidLineItem],
      };

      const result = evaluateDatedSalaryLedgers(request);

      expect(result.status).toBe('needs-input');
      expect(result.ledgers.teamSalary).toMatchObject({
        status: 'needs-input',
        total: null,
        lineItems: [],
        missingInputs: [
          'ledgers.team-salary.lineItems[0].source.authority',
        ],
      });
    }
  );

  it.each(['canon', 'team-state', 'external-determination'] as const)(
    'accepts the governed source authority: %s',
    (authority) => {
      const request = buildCanonFixture();
      request.ledgers!.teamSalary = {
        status: 'ready',
        lineItems: [
          {
            ...teamSalaryBase,
            source: { authority, reference: 'TEAM-R7-001@validated' },
          },
        ],
      };

      const result = evaluateDatedSalaryLedgers(request);

      expect(result.ledgers.teamSalary.status).toBe('complete');
    }
  );
});
