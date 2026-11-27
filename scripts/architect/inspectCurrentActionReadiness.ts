/** Local read-only inspection of one verified financial release. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCanonicalTeamTotalsSnapshot } from '../../src/features/architect/utils/capTotals/computeTeamCapTotals';
import { governingCalendarDate } from '../../src/features/architect/utils/governedSeason';
import { simulationTradeDeadline } from '../../src/features/architect/utils/governedSeason/simulationTradeDeadline';
import { toEndYear } from '../../src/features/architect/utils/seasonFormat';
import { ordinarySigningProrationUnavailable } from '../../src/features/architect/utils/signings/governedSigningAuthority';
import { evaluateRosterCountsAgainstLimits } from '../../src/features/architect/utils/tradeMachine/rules/validateRoster';
import { isTwoWayTradePlayer } from '../../src/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';

const {
  parseSimulationFinancialBaseline,
}: typeof import('../../functions/src/architect/simulationFinancialBaseline') =
  createRequire(import.meta.url)(
    '../../functions/src/architect/simulationFinancialBaseline.ts'
  );
const [, , filename, digest] = process.argv;
if (!filename || !/^[a-f0-9]{64}$/.test(digest ?? '')) {
  throw new Error(
    'Supply a local financial package path and its expected SHA-256.'
  );
}
const bytes = await readFile(filename);
if (createHash('sha256').update(bytes).digest('hex') !== digest) {
  throw new Error('Financial package digest does not match.');
}
const baseline = parseSimulationFinancialBaseline(bytes);
const day = governingCalendarDate(baseline.asOf);
const year = toEndYear(baseline.seasonId);
if (!day || year !== 2027) {
  throw new Error('Expected a dated 2026–27 financial release.');
}

const deadline = simulationTradeDeadline(year);
const tradeWindow = !deadline
  ? {
      status: 'assumption-required',
      reason: 'A dated trade deadline is needed.',
    }
  : day > deadline.date
    ? {
        status: 'closed-window',
        reason: 'The release date is after its in-season trade deadline.',
      }
    : {
        status: 'ready-to-evaluate',
        deadline: deadline.date,
        assumption: deadline.assumptionId,
      };
const minimumUnavailable = ordinarySigningProrationUnavailable(
  day,
  year,
  'MINIMUM'
);

const teams = Object.entries(baseline.teams)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([teamCode, team]) => {
    const players = Array.isArray(team.players) ? team.players : null;
    if (!players) {
      return {
        teamCode,
        roster: { status: 'needs-input', reason: 'Roster is absent.' },
      };
    }
    const twoWay = players.filter(isTwoWayTradePlayer).length;
    const standard = players.length - twoWay;
    const roster = evaluateRosterCountsAgainstLimits(standard, twoWay);
    const books = createCanonicalTeamTotalsSnapshot(
      { ...team, players },
      year,
      { asOfDate: day }
    );
    return {
      teamCode,
      standard,
      twoWay,
      roster:
        roster.isAboveMaximumStandard || roster.exceedsTwoWayLimit
          ? {
              status: 'rule-prohibition',
              reason: 'The ordinary current-season roster limit is exceeded.',
            }
          : roster.isBelowMinimumStandard
            ? {
                status: 'needs-input',
                reason: 'Confirm the dated roster shortage allowance.',
              }
            : { status: 'ready-to-evaluate' },
      tradeSalaryBooks:
        books.apronTeamSalary === null
          ? {
              status: 'needs-input',
              reason:
                'The Apron Team Salary needed for trade evaluation is incomplete.',
            }
          : { status: 'ready-to-evaluate' },
      minimumSigning:
        standard >= roster.maximumStandard
          ? {
              status: 'rule-prohibition',
              reason: 'An ordinary standard roster slot is unavailable.',
            }
          : minimumUnavailable
            ? {
                status: 'unimplemented',
                reason: 'Ordinary Minimum signing proration is unavailable.',
              }
            : { status: 'ready-to-evaluate' },
      ordinarySigningBooks:
        books.teamSalary === null || books.apronTeamSalary === null
          ? {
              status: 'needs-input',
              reason:
                'Team or Apron Team Salary needed for signing is incomplete.',
            }
          : { status: 'ready-to-evaluate' },
    };
  });

console.log(
  JSON.stringify(
    {
      asOf: baseline.asOf,
      season: baseline.seasonId,
      scope:
        'Baseline roster, calendar and book checks. Each proposal still needs its player, terms and applicable rule checks.',
      tradeWindow,
      teams,
    },
    null,
    2
  )
);
