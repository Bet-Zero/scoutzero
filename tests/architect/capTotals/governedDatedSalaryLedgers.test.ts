import { describe, expect, it } from 'vitest';
import {
  evaluateGovernedDatedSalaryLedgers,
  type SalaryLedgerKind,
  type SalaryLedgerLineItem,
  type SalaryLedgerResult,
} from '@/features/architect/utils/capTotals';
import { GOVERNED_SYSTEM_LEVEL_IDS } from '@/features/architect/utils/governedSeason';
import {
  completeFixtureRegistry,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SALARY_CAP_YEAR,
  FIXTURE_TEAM,
  revisedFixtureRegistry,
} from '../governedSeason/governedSeasonFixtures';

/**
 * Assert a ledger is blocked and narrow it, so the `needs-input`-only fields
 * are reachable without widening the result union.
 */
function expectNeedsInput<K extends SalaryLedgerKind>(
  ledger: SalaryLedgerResult<K>
): Extract<SalaryLedgerResult<K>, { status: 'needs-input' }> {
  expect(ledger.status).toBe('needs-input');
  if (ledger.status !== 'needs-input') {
    throw new Error(`expected ${ledger.kind} to need input`);
  }
  return ledger;
}

/** Walk a returned missing-input path against the request it describes. */
function resolvePath(root: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node == null ? undefined : (node as Record<string, unknown>)[segment],
      root
    );
}

const GOVERNED_CONTEXT = {
  asOfDate: FIXTURE_AS_OF_DATE,
  salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
  requiredAuthority: 'official' as const,
  team: FIXTURE_TEAM,
};

const teamSalaryLine: SalaryLedgerLineItem<'team-salary'> = {
  id: 'team-salary-base',
  ledger: 'team-salary',
  label: 'Team Salary at the evaluation instant',
  amount: 150_000_000,
  effectiveFrom: '2030-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C01.1'],
  source: { authority: 'team-state', reference: 'TEST-TEAM-001@v1' },
};

const apronSalaryLine: SalaryLedgerLineItem<'apron-team-salary'> = {
  id: 'apron-team-salary-base',
  ledger: 'apron-team-salary',
  label: 'Apron Team Salary baseline',
  amount: 152_000_000,
  effectiveFrom: '2030-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C07.1'],
  source: { authority: 'canon', reference: 'EV2-0186' },
};

const taxSalaryLine: SalaryLedgerLineItem<'tax-salary'> = {
  id: 'tax-last-game-baseline',
  ledger: 'tax-salary',
  label: 'Team Salary at start of last Regular Season game',
  amount: 148_000_000,
  effectiveFrom: '2030-07-01T00:00:00-04:00',
  canonLeafIds: ['CBA2-A01.1', 'CBA2-C08.1'],
  source: { authority: 'canon', reference: 'EV2-0197' },
};

const READY_LEDGERS = {
  teamSalary: { status: 'ready' as const, lineItems: [teamSalaryLine] },
  apronTeamSalary: { status: 'ready' as const, lineItems: [apronSalaryLine] },
  taxSalary: { status: 'ready' as const, lineItems: [taxSalaryLine] },
};

describe('BZE-270 governed dated salary ledgers', () => {
  it('blocks every ledger when the governed envelope does not resolve', () => {
    const request = {
      context: GOVERNED_CONTEXT,
      ledgers: READY_LEDGERS,
    };
    // No registry override: the Canon-seeded registry has no 2030-31 records.
    const result = evaluateGovernedDatedSalaryLedgers(request);

    expect(result.status).toBe('needs-input');
    expect(result.governedInputs).toBeNull();
    expect(result.envelope.status).toBe('unavailable');

    (['teamSalary', 'apronTeamSalary', 'taxSalary'] as const).forEach((key) => {
      const ledger = result.ledgers[key];
      expect(ledger.status).toBe('needs-input');
      expect(ledger.total).toBeNull();
      expect(ledger.lineItems).toEqual([]);
    });
  });

  it('does not total a ledger just because its line items were valid', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: { ...GOVERNED_CONTEXT, salaryCapYear: 2099 },
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry(),
    });

    expect(result.status).toBe('needs-input');
    expect(result.ledgers.teamSalary.total).toBeNull();
    expect(expectNeedsInput(result.ledgers.teamSalary).reason).toContain(
      'The governed season envelope did not resolve'
    );
  });

  it('reports governed missing inputs on paths that resolve on the request', () => {
    const request = {
      context: {
        salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
        requiredAuthority: 'official' as const,
        team: FIXTURE_TEAM,
      },
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry(),
    };
    const result = evaluateGovernedDatedSalaryLedgers(request);

    const teamSalary = expectNeedsInput(result.ledgers.teamSalary);
    expect(teamSalary.missingInputs).toContain('context.asOfDate');
    teamSalary.missingInputs.forEach((path) => {
      if (path.startsWith('context.')) {
        expect(resolvePath(request, path)).toBeUndefined();
      }
    });
  });

  it('evaluates the ledgers once the governed envelope is complete', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry(),
    });

    expect(result.envelope.status).toBe('complete');
    expect(result.status).toBe('complete');
    expect(result.ledgers.teamSalary.total).toBe(150_000_000);
    expect(result.ledgers.apronTeamSalary.total).toBe(152_000_000);
    expect(result.ledgers.taxSalary.total).toBe(148_000_000);
  });

  it('retains the exact calendar and level record IDs and versions used', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry(),
    });
    const manifest = result.governedInputs;

    expect(manifest?.asOfDate).toBe(FIXTURE_AS_OF_DATE);
    expect(manifest?.salaryCapYear).toBe(FIXTURE_SALARY_CAP_YEAR);
    expect(manifest?.calendar).toMatchObject({
      recordId: 'TEST-CAL-0001',
      recordVersion: 1,
      seasonKey: '2030-31',
      sourceRecordId: 'SRC2-TEST-002',
      sourceRecordVersion: 1,
    });
    expect(manifest?.systemLevels.map((level) => level.levelId)).toEqual([
      ...GOVERNED_SYSTEM_LEVEL_IDS,
    ]);
    manifest?.systemLevels.forEach((level) => {
      expect(level.recordId).toMatch(/^TEST-LVL-/);
      expect(level.recordVersion).toBe(1);
      expect(level.sourceRecordId).toBe('SRC2-TEST-001');
    });
  });

  it('dates the ledger from the governed envelope, not the raw request', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: {
        ...READY_LEDGERS,
        teamSalary: {
          status: 'ready',
          lineItems: [
            teamSalaryLine,
            {
              ...teamSalaryLine,
              id: 'team-salary-not-yet-effective',
              amount: 9_000_000,
              effectiveFrom: '2031-06-01T00:00:00-04:00',
            },
          ],
        },
      },
      registry: completeFixtureRegistry(),
    });

    expect(result.ledgers.teamSalary.total).toBe(150_000_000);
    const excluded = result.ledgers.teamSalary.lineItems.find(
      (item) => item.id === 'team-salary-not-yet-effective'
    );
    expect(excluded?.included).toBe(false);
    expect(excluded?.exclusionReason).toBe('not-yet-effective');
  });

  it('keeps BZE-268 per-ledger states when the envelope is complete', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: {
        teamSalary: { status: 'ready', lineItems: [teamSalaryLine] },
        apronTeamSalary: {
          status: 'needs-input',
          missingInputs: ['ledgers.apronTeamSalary.lineItems'],
          reason: 'Apron adjustments are not derived yet.',
        },
        taxSalary: {
          status: 'not-evaluated',
          reason: 'Tax ledger inventory is out of scope.',
        },
      },
      registry: completeFixtureRegistry(),
    });

    expect(result.ledgers.teamSalary.status).toBe('complete');
    expect(result.ledgers.apronTeamSalary.status).toBe('needs-input');
    expect(result.ledgers.taxSalary.status).toBe('not-evaluated');
    expect(result.status).toBe('needs-input');
    // A complete envelope still records what it was resolved from.
    expect(result.governedInputs).not.toBeNull();
  });

  it('produces a new result after a source revision without changing the old one', () => {
    const before = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry(),
    });
    const after = evaluateGovernedDatedSalaryLedgers({
      context: GOVERNED_CONTEXT,
      ledgers: READY_LEDGERS,
      registry: revisedFixtureRegistry('salary-cap', 195_000_000),
    });

    const beforeCap = before.governedInputs?.systemLevels.find(
      (level) => level.levelId === 'salary-cap'
    );
    const afterCap = after.governedInputs?.systemLevels.find(
      (level) => level.levelId === 'salary-cap'
    );

    expect(beforeCap?.recordVersion).toBe(1);
    expect(afterCap?.recordVersion).toBe(2);
    expect(afterCap?.amount).toBe(195_000_000);
    expect(beforeCap?.amount).not.toBe(195_000_000);
  });

  it('refuses to resolve when official and projected are mixed up', () => {
    const result = evaluateGovernedDatedSalaryLedgers({
      context: { ...GOVERNED_CONTEXT, requiredAuthority: 'projected' },
      ledgers: READY_LEDGERS,
      registry: completeFixtureRegistry('official'),
    });

    expect(result.status).toBe('needs-input');
    expect(result.governedInputs).toBeNull();
    expect(expectNeedsInput(result.ledgers.taxSalary).missingInputs).toContain(
      'registry.systemLevels.tax-level'
    );
  });
});
