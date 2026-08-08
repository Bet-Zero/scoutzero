/**
 * FILE: src/features/architect/utils/capTotals/governedDatedSalaryLedgers.ts
 * PURPOSE: Governed entry point for the BZE-268 dated salary-ledger path.
 * OWNERSHIP: Feature: architect/cap totals
 *
 * BZE-270. BZE-268 evaluates Team, Apron, and Tax Salary for a date and Salary
 * Cap Year the caller asserts. This module puts the governed envelope in front
 * of that path: the date, Salary Cap Year, calendar, team context, and the five
 * core annual system levels must all resolve from one versioned, fail-closed
 * registry before any ledger is evaluated.
 *
 * If the envelope is unavailable, no ledger math runs and every ledger is
 * reported `needs-input` with the envelope's reasons attached. There is no
 * degraded mode: a caller cannot get a total out of this function without a
 * complete governed envelope.
 *
 * A complete result retains `governedInputs` — the exact calendar and system
 * level record IDs and versions the evaluation consumed — so a later source
 * revision creates a new record and a new result rather than changing this one.
 */

import {
  resolveGovernedSeasonEnvelope,
  type GovernedAuthority,
  type GovernedInputManifest,
  type GovernedSeasonEnvelope,
  type GovernedSeasonRegistry,
  type GovernedTeamContext,
} from '../governedSeason';
import {
  evaluateDatedSalaryLedgers,
  type DatedSalaryLedgerEvaluation,
  type DatedSalaryLedgerRequest,
  type SalaryLedgerKind,
  type SalaryLedgerResult,
  type SalaryLedgerStatus,
} from './datedSalaryLedgers';

export interface GovernedDatedSalaryLedgerContext {
  /** ISO-8601 instant with an explicit `Z` or UTC offset. */
  asOfDate?: string | null;
  /** End year of the Salary Cap Year, e.g. 2027 for 2026-27. */
  salaryCapYear?: number | null;
  /** Required; official and projected never substitute for each other. */
  requiredAuthority?: GovernedAuthority | null;
  team?: Partial<GovernedTeamContext> | null;
}

export interface GovernedDatedSalaryLedgerRequest {
  context?: GovernedDatedSalaryLedgerContext | null;
  ledgers?: DatedSalaryLedgerRequest['ledgers'];
  /** Defaults to the Canon-seeded registry. */
  registry?: GovernedSeasonRegistry;
}

export interface GovernedDatedSalaryLedgerEvaluation {
  status: SalaryLedgerStatus;
  envelope: GovernedSeasonEnvelope;
  ledgers: DatedSalaryLedgerEvaluation['ledgers'];
  /** Present only on a complete result. */
  governedInputs: GovernedInputManifest | null;
}

function blockedLedger<K extends SalaryLedgerKind>(
  kind: K,
  missingInputs: readonly string[],
  reason: string
): SalaryLedgerResult<K> {
  return {
    kind,
    status: 'needs-input',
    total: null,
    lineItems: [],
    missingInputs: [...missingInputs],
    reason,
  };
}

/**
 * Governed context paths a caller can navigate on the request object, so an
 * unavailable envelope points at the input that has to change.
 */
function envelopeMissingInputPaths(envelope: GovernedSeasonEnvelope): string[] {
  if (envelope.missingInputs.length > 0) {
    return envelope.missingInputs.map((input) => `context.${input}`);
  }

  const paths: string[] = [];
  if (envelope.reconciliation.state === 'unreconciled') {
    paths.push('context.asOfDate', 'context.salaryCapYear');
  }
  if (envelope.calendar.state !== 'available') {
    paths.push('registry.calendars');
  }
  Object.values(envelope.systemLevels).forEach((level) => {
    if (level.state !== 'available') {
      paths.push(`registry.systemLevels.${level.levelId}`);
    }
  });

  return [...new Set(paths)];
}

/**
 * Evaluate the three dated salary ledgers only after the governed season
 * envelope resolves. Every ledger stays unavailable when it does not.
 */
export function evaluateGovernedDatedSalaryLedgers(
  request: GovernedDatedSalaryLedgerRequest = {}
): GovernedDatedSalaryLedgerEvaluation {
  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: request.context?.asOfDate,
    salaryCapYear: request.context?.salaryCapYear,
    requiredAuthority: request.context?.requiredAuthority,
    team: request.context?.team,
    ...(request.registry ? { registry: request.registry } : {}),
  });

  if (envelope.status !== 'complete' || !envelope.inputManifest) {
    const missingInputs = envelopeMissingInputPaths(envelope);
    const reason = [
      'The governed season envelope did not resolve, so no salary ledger was evaluated.',
      ...envelope.unavailableReasons,
    ].join(' ');

    return {
      status: 'needs-input',
      envelope,
      ledgers: {
        teamSalary: blockedLedger('team-salary', missingInputs, reason),
        apronTeamSalary: blockedLedger(
          'apron-team-salary',
          missingInputs,
          reason
        ),
        taxSalary: blockedLedger('tax-salary', missingInputs, reason),
      },
      governedInputs: null,
    };
  }

  const manifest = envelope.inputManifest;

  // The ledger context comes from the resolved envelope, never from the raw
  // request, so a ledger can only ever be dated by a governed input.
  const evaluation = evaluateDatedSalaryLedgers({
    context: {
      asOfDate: manifest.asOfDate,
      salaryCapYear: manifest.salaryCapYear,
      team: {
        teamId: manifest.team.teamId,
        ...(manifest.team.teamCode ? { teamCode: manifest.team.teamCode } : {}),
      },
    },
    ledgers: request.ledgers,
  });

  // BZE-268 missing-input paths are already rooted at `ledgers.*`, which stays
  // navigable on the governed request, so they are passed through unchanged.
  return {
    status: evaluation.status,
    envelope,
    ledgers: evaluation.ledgers,
    governedInputs: manifest,
  };
}
