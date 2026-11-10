import { describe, expect, it } from 'vitest';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import { computeTeamSalaryBooks } from '@/features/architect/utils/capTotals/teamSalaryBooks';
import { resolveSimulationApronInputs } from '@/features/architect/utils/capTotals/simulationFinancialAssumptions';
import {
  TeamSalaryBookInputsZ,
  type TeamSalaryBookInputs,
} from '@/schemas/salaryBooks';
import { validateGovernedDraftBaseline } from '@/features/architect/utils/governedDraftWorld.baseline';
import fixture from '../../../functions/src/architect/fixtures/governedDraftWorld.json';

const date = '2026-06-05T12:19:56.526Z';
function inputs(): TeamSalaryBookInputs {
  return {
    version: 1,
    salaryCapYear: 2026,
    simulationAssumptions: {
      version: 1,
      classification: 'SIMULATION',
      policy: 'unidentified-rare-exposure-v1',
      teamCode: 'CHI',
      asOfDate: '2026-06-05',
      checkedAt: '2026-11-10T12:00:00Z',
      evidenceReferences: [
        'https://linear.app/bzero/issue/BZE-345#comment-976e2f3a-e770-4cdd-94c3-b6fcfc0903dd',
      ],
      reconciledInputSha256: 'a'.repeat(64),
      categories: ['CBA2-C07.4', 'CBA2-C07.8'],
      signals: [],
    },
    apronAdjustments: {
      status: 'ready',
      lineItems: [2, 3, 5, 6, 7, 9, 10, 11].map((n) => ({
        id: `adjustment-${n}`,
        ledger: 'apron-team-salary',
        label: `C07.${n}`,
        // Reconciled CHI amounts, BZE-345 November 10 finding linked above.
        amount:
          n === 2 ? 2_149_999 : n === 3 ? 5_696 : n === 5 ? -4_592_548 : 0,
        effectiveFrom: '2026-06-05T00:00:00Z',
        canonLeafIds: [`CBA2-C07.${n}`],
        source: {
          authority: 'team-state',
          reference: 'retained reconciliation; not historical certification',
        },
      })),
    },
    taxSalary: {
      status: 'needs-input',
      missingInputs: ['taxHistory'],
      reason: 'Not qualified.',
    },
  };
}
const resolve = (i = inputs(), day = date, team = 'CHI') =>
  resolveSimulationApronInputs(i, team, day);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('dated public-data SIMULATION assumptions', () => {
  it('adds only two labeled zeros without mutating evidence, and survives serialization', () => {
    const i = inputs();
    const original = clone(i);
    const result = resolve(i);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('not ready');
    expect(
      result.lineItems.slice(-2).map((l) => [l.amount, l.source.authority])
    ).toEqual([
      [0, 'simulation-assumption'],
      [0, 'simulation-assumption'],
    ]);
    expect(
      result.lineItems.slice(-2).every((l) => l.label.startsWith('SIMULATION'))
    ).toBe(true);
    expect(i).toEqual(original);
    expect(resolve(TeamSalaryBookInputsZ.parse(clone(i)))).toEqual(result);
  });
  it.each(['CBA2-C07.4', 'CBA2-C07.8'] as const)(
    'rejects a known %s liability rather than replacing it',
    (category) => {
      const i = inputs();
      if (i.apronAdjustments.status !== 'ready') throw new Error();
      i.apronAdjustments.lineItems.push({
        ...i.apronAdjustments.lineItems[0],
        id: 'known',
        amount: 5_000_000,
        canonLeafIds: [category],
      });
      expect(resolve(i).status).toBe('needs-input');
      i.simulationAssumptions!.categories =
        i.simulationAssumptions!.categories.filter((c) => c !== category);
      const resolved = resolve(i);
      expect(resolved.status).toBe('ready');
      if (resolved.status === 'ready')
        expect(resolved.lineItems.find((l) => l.id === 'known')!.amount).toBe(
          5_000_000
        );
    }
  );
  it.each(['documented-liability', 'credible-unresolved'] as const)(
    'blocks active %s and undated signals, without backdating later events',
    (status) => {
      const i = inputs();
      const signal = {
        id: 'signal',
        category: 'CBA2-C07.4' as const,
        status,
        effectiveFrom: '2026-06-05',
        effectiveUntil: null,
        evidenceReference: 'retained report',
      };
      i.simulationAssumptions!.signals = [signal];
      expect(resolve(i).status).toBe('needs-input');
      expect(
        resolve({
          ...i,
          simulationAssumptions: {
            ...i.simulationAssumptions!,
            signals: [{ ...signal, effectiveFrom: null }],
          },
        }).status
      ).toBe('needs-input');
      signal.effectiveFrom = '2026-11-10';
      expect(resolve(i).status).toBe('ready');
    }
  );
  it('does not reuse assumptions on a later date or another team', () => {
    expect(resolve(inputs(), '2026-06-06T00:00:00Z').status).toBe(
      'needs-input'
    );
    expect(resolve(inputs(), date, 'TOR').status).toBe('needs-input');
  });
  it('keeps other unresolved evidence and source/fixture separation', () => {
    const i = inputs();
    i.apronAdjustments = {
      status: 'needs-input',
      missingInputs: ['bonuses'],
      reason: 'Unknown bonus exposure.',
    };
    expect(resolve(i)).toEqual(i.apronAdjustments);
    const baseline = clone(fixture);
    baseline.classification = 'qualified-source';
    baseline.initialTeams.BOS.salaryBookInputs = inputs() as never;
    expect(() => validateGovernedDraftBaseline(baseline)).toThrow(
      'cannot certify'
    );
  });
  it('does not admit standalone generated zeros as factual input', () => {
    const i = inputs();
    const r = resolve(i);
    delete i.simulationAssumptions;
    i.apronAdjustments = r as TeamSalaryBookInputs['apronAdjustments'];
    expect(resolve(i).status).toBe('needs-input');
  });
  it('still rejects a standing hard-cap breach using actual simulation Apron Salary', () => {
    const team = {
      teamCode: 'CHI',
      hardCapped: true,
      hardCapLevel: 'firstApron',
      players: Array.from({ length: 14 }, (_, i) => ({
        id: `p${i}`,
        contract: {
          salariesByYear: [
            { season: '2025-26', salary: 15_000_000, capHit: 15_000_000 },
          ],
        },
      })),
      capHolds: [],
      deadCap: [],
      salaryBookInputs: inputs(),
    };
    const totals = createCanonicalTeamTotalsSnapshot(team, 2026, {
      asOfDate: date,
    });
    expect(totals.apronTeamSalary).toBeGreaterThan(totals.firstApron);
    const result = validatePostStateCapLegality({
      operationId: 'simulation',
      mutationType: 'executeTrade',
      worldId: 'simulation',
      year: 2026,
      beforeTeamsByCode: { CHI: team },
      afterTeamsByCode: { CHI: team },
      beforeTotalsByTeam: { CHI: totals },
      afterTotalsByTeam: { CHI: totals },
    });
    expect(result.violations.some((v) => v.code === 'HARD_CAP_EXCEEDED')).toBe(
      true
    );
  });
  it('retains exact reconciled Apron arithmetic and unresolved tax; missing essential adjustment blocks', () => {
    // CHI provisional components: BZE-345 November 10 owner-retained reconciliation.
    const i = inputs();
    const totals = {
      playersTotal: 165_964_036,
      deadMoneyTotal: 16_916_687,
      capHoldsTotal: 4_592_548,
      incompleteChargesTotal: 0,
    };
    const books = computeTeamSalaryBooks(
      { teamCode: 'CHI', salaryBookInputs: i },
      totals,
      2026,
      date
    );
    expect(books.ledgers.apronTeamSalary).toMatchObject({
      status: 'complete',
      total: 185_036_418,
    });
    expect(books.ledgers.taxSalary.status).toBe('needs-input');
    if (i.apronAdjustments.status === 'ready')
      i.apronAdjustments.lineItems.shift();
    expect(
      computeTeamSalaryBooks(
        { teamCode: 'CHI', salaryBookInputs: i },
        totals,
        2026,
        date
      ).ledgers.apronTeamSalary.status
    ).toBe('needs-input');
  });
});
