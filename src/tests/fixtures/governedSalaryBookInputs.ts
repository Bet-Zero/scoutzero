import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';

type UnknownRecord = Record<string, unknown>;

const GOVERNED_REGULAR_SEASON_CLOSINGS: Readonly<
  Partial<Record<number, string>>
> = {
  2026: '2026-04-12',
  2027: '2027-04-11',
};

interface GovernedSalaryBookFixtureOptions {
  salaryCapYear: number;
  asOfDate: string;
  teamSalary: number;
  apronTeamSalary?: number;
  taxSalary?: number;
}

function line(
  ledger: 'team-salary' | 'apron-team-salary' | 'tax-salary',
  leafId: string,
  amount: number,
  effectiveFrom: string
) {
  return {
    id: `fixture:${ledger}:${leafId}`,
    ledger,
    label: leafId,
    amount,
    effectiveFrom,
    canonLeafIds: [leafId],
    source: {
      authority: 'external-determination' as const,
      reference: `test-fixture:${leafId}`,
    },
  };
}

/**
 * Gives a test team explicit, discriminating governed inputs without reviving
 * any generic-total fallback in production code.
 */
export function withGovernedSalaryBooks<T extends UnknownRecord>(
  team: T,
  options: GovernedSalaryBookFixtureOptions
): T & { salaryBookInputs: TeamSalaryBookInputs } {
  const legacyComponents = computeTeamCapTotals(team, options.salaryCapYear, {
    asOfDate: options.asOfDate,
  });
  const componentTotal =
    legacyComponents.playersTotal +
    legacyComponents.deadMoneyTotal +
    legacyComponents.capHoldsTotal +
    (legacyComponents.outstandingOfferSheetTotal ?? 0);
  const incompleteRosterCharge = options.teamSalary - componentTotal;
  if (incompleteRosterCharge < 0) {
    throw new Error(
      `Fixture Team Salary ${options.teamSalary} is below derived components ${componentTotal}.`
    );
  }

  const apronTeamSalary = options.apronTeamSalary ?? options.teamSalary;
  const apronDelta = apronTeamSalary - options.teamSalary;
  const positiveApronDelta = Math.max(0, apronDelta);
  const negativeApronDelta = Math.min(0, apronDelta);
  const taxSalary = options.taxSalary ?? options.teamSalary;
  const teamCode = String(team.teamCode ?? team.abbreviation ?? 'UNK');
  const sourceSalaryCapYear = options.salaryCapYear - 1;
  const sourceSeasonKey = `${sourceSalaryCapYear - 1}-${String(
    sourceSalaryCapYear % 100
  ).padStart(2, '0')}`;
  const regularSeasonClosing =
    GOVERNED_REGULAR_SEASON_CLOSINGS[sourceSalaryCapYear];

  return {
    ...team,
    salaryBookInputs: {
      version: 1,
      salaryCapYear: options.salaryCapYear,
      ...(regularSeasonClosing
        ? {
            seasonCloseApronMeasurement: {
              version: 1 as const,
              seasonKey: sourceSeasonKey,
              salaryCapYear: sourceSalaryCapYear,
              teamCode,
              measuredAt: `${regularSeasonClosing}T19:00:00-04:00`,
              regularSeasonClosing,
              apronTeamSalary,
              source: {
                measurementRecordId: `fixture-apron-close:${sourceSeasonKey}:${teamCode}`,
                measurementRecordVersion: 1,
                authority: 'external-determination' as const,
                identity: `authenticated-test-fixture:${teamCode}:${sourceSeasonKey}`,
                sourceField:
                  'apronTeamSalaryAtStartOfLastRegularSeasonGame' as const,
                sourceArtifactSha256:
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                retainedArtifactPath: `test-fixtures/season-close/${sourceSeasonKey}/${teamCode}.json`,
                retrievedAt: `${regularSeasonClosing}T23:00:00Z`,
                authenticatedAt: `${regularSeasonClosing}T23:05:00Z`,
                verifierIdentity: 'test-fixture:governed-salary-books',
                recordStatus: 'current' as const,
                canonLeafIds: ['CBA2-L08.1'] as const,
              },
            },
          }
        : {}),
      incompleteRosterCharge: line(
        'team-salary',
        'CBA2-A01.1',
        incompleteRosterCharge,
        options.asOfDate
      ),
      apronAdjustments: {
        status: 'ready',
        lineItems: [
          line(
            'apron-team-salary',
            'CBA2-C07.2',
            positiveApronDelta,
            options.asOfDate
          ),
          line('apron-team-salary', 'CBA2-C07.3', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.4', 0, options.asOfDate),
          line(
            'apron-team-salary',
            'CBA2-C07.5',
            negativeApronDelta,
            options.asOfDate
          ),
          line('apron-team-salary', 'CBA2-C07.6', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.7', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.8', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.9', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.10', 0, options.asOfDate),
          line('apron-team-salary', 'CBA2-C07.11', 0, options.asOfDate),
        ],
      },
      taxSalary: {
        status: 'ready',
        lineItems: [
          line('tax-salary', 'CBA2-C08.1', taxSalary, options.asOfDate),
          line('tax-salary', 'CBA2-C08.2', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.3', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.4', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.5', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.6', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.7', 0, options.asOfDate),
          line('tax-salary', 'CBA2-C08.8', 0, options.asOfDate),
        ],
      },
    },
  };
}

export function withDerivedGovernedSalaryBooks<T extends UnknownRecord>(
  team: T,
  options: Pick<
    GovernedSalaryBookFixtureOptions,
    'salaryCapYear' | 'asOfDate'
  > & {
    apronDelta?: number;
    taxDelta?: number;
  }
) {
  const components = computeTeamCapTotals(team, options.salaryCapYear, {
    asOfDate: options.asOfDate,
  });
  const teamSalary =
    components.playersTotal +
    components.deadMoneyTotal +
    components.capHoldsTotal +
    (components.outstandingOfferSheetTotal ?? 0);
  return withGovernedSalaryBooks(team, {
    salaryCapYear: options.salaryCapYear,
    asOfDate: options.asOfDate,
    teamSalary,
    apronTeamSalary: teamSalary + (options.apronDelta ?? 0),
    taxSalary: teamSalary + (options.taxDelta ?? 0),
  });
}
