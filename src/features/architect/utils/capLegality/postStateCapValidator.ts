/**
 * FILE: src/features/architect/utils/capLegality/postStateCapValidator.ts
 * PURPOSE: Shared post-state cap validator contract for authoritative world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * OWNERSHIP CONTRACT:
 * - This file is intentionally shared across mutation families.
 * - Prominent live callers include tradeExecutionAuthority.ts Stage 5,
 *   mutationPipeline.ts non-trade apply, seasonManager.ts, and
 *   useArchitectActions.ts cap-audit event generation.
 * - This file owns post-state team legality rules and post-state input sanity
 *   for the before/after team snapshots and totals it receives.
 * - It must run after compute has produced authoritative final artifacts and
 *   before persistence or batch commit.
 * - Earlier validators feed this layer, but they are not substitutes for
 *   final-state artifact validation.
 * - Trade is a prominent caller, not the owner of this layer.
 * - This file does NOT own trade-term validation, authority sequencing,
 *   live world-state invariants, or persistence.
 * - This file must not absorb sequencing or persistence concerns.
 */

import {
  validateContractRows,
  validateDeadCap,
  validateExceptions,
} from '@/features/architect/utils/capLegalityValidation';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { isCapHoldAmountValid } from '@/features/architect/utils/capHoldTransitionHelpers';
import { evaluateRosterCountsAgainstLimits } from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import { validationFlags } from '@/config/validationFlags';
import { parseTradeHardCapLedger } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';

export const POST_STATE_CAP_VALIDATOR_VERSION = '1.0.0';

type AnyRecord = Record<string, unknown>;
type FinalStateHardCapRecheckStatus = {
  isHardCapped: boolean;
  level: string | null;
  ceiling: number | null;
  invalidLedger?: boolean;
};

export type PostStateCapValidationIssue = {
  code: string;
  teamCode: string;
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
};

export type PostStateCapValidationResult = {
  valid: boolean;
  violations: PostStateCapValidationIssue[];
  warnings: PostStateCapValidationIssue[];
};

export type PostStateCapValidationInput = {
  operationId: string;
  mutationType: string;
  worldId: string;
  year?: number;
  toYear?: number;
  beforeTeamsByCode?: Record<string, AnyRecord>;
  afterTeamsByCode?: Record<string, AnyRecord>;
  beforeTotalsByTeam?: Record<string, AnyRecord>;
  afterTotalsByTeam?: Record<string, AnyRecord>;
  rulesContext?: AnyRecord;
};

const REQUIRED_TOTAL_NUMERIC_FIELDS = Object.freeze([
  'playersTotal',
  'deadMoneyTotal',
  'capHoldsTotal',
  'incompleteChargesTotal',
  'totalCapAllocations',
  'salaryCap',
  'luxuryTax',
  'firstApron',
  'secondApron',
]);

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): AnyRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as AnyRecord;
  }
  return null;
}

function getTeamSalaryFromTotals(totals: AnyRecord): number | null {
  const directTeamSalary = toFiniteNumber(totals.teamSalary);
  if (directTeamSalary !== null) {
    return directTeamSalary;
  }
  const salaryBooks = asRecord(totals.salaryBooks);
  const ledgers = asRecord(salaryBooks?.ledgers);
  const ledger = asRecord(ledgers?.teamSalary);
  return ledger?.status === 'complete' ? toFiniteNumber(ledger.total) : null;
}

function getApronTeamSalaryFromTotals(totals: AnyRecord): number | null {
  const direct = toFiniteNumber(totals.apronTeamSalary);
  if (direct !== null) return direct;
  const salaryBooks = asRecord(totals.salaryBooks);
  const ledgers = asRecord(salaryBooks?.ledgers);
  const ledger = asRecord(ledgers?.apronTeamSalary);
  return ledger?.status === 'complete' ? toFiniteNumber(ledger.total) : null;
}

function getTaxSalaryFromTotals(totals: AnyRecord): number | null {
  const direct = toFiniteNumber(totals.taxSalary);
  if (direct !== null) return direct;
  const salaryBooks = asRecord(totals.salaryBooks);
  const ledgers = asRecord(salaryBooks?.ledgers);
  const ledger = asRecord(ledgers?.taxSalary);
  return ledger?.status === 'complete' ? toFiniteNumber(ledger.total) : null;
}

/**
 * Final-state hard-cap re-check adapter.
 * Earlier stage-specific validators may already have projected hard-cap
 * legality. For trade-time projections, that owner is
 * hardCapValidation.ts against projected totals. This helper exists because
 * the shared later post-state layer reads authoritative
 * afterTeamsByCode/afterTotalsByTeam shapes, then delegates shared ceiling
 * fallback policy to hardCapStatus.ts:resolveHardCapCeiling().
 */
function getFinalStateHardCapRecheckStatus({
  teamCode,
  team,
  totals,
  rulesContext,
  expectedYear,
}: {
  teamCode: string;
  team: AnyRecord;
  totals: AnyRecord;
  rulesContext: AnyRecord;
  expectedYear: number | null;
}): FinalStateHardCapRecheckStatus {
  const parsedLedger = parseTradeHardCapLedger(team.hardCapLedger);
  if (!parsedLedger.valid) {
    return {
      isHardCapped: true,
      level: null,
      ceiling: null,
      invalidLedger: true,
    };
  }
  const capSettings = asRecord(rulesContext.capSettings) || {};
  const firstApron =
    toFiniteNumber(capSettings.firstApron) ?? toFiniteNumber(totals.firstApron);
  const secondApron =
    toFiniteNumber(capSettings.secondApron) ??
    toFiniteNumber(totals.secondApron);
  const teamTotals = asRecord(team.totals) || {};
  const sharedStatus = getHardCapStatus(
    {
      ...team,
      totals: { ...teamTotals, ...totals },
    },
    {
      capSettings: {
        firstApron: firstApron ?? undefined,
        secondApron: secondApron ?? undefined,
      },
      salaryCapYear: expectedYear,
    }
  );

  const hardCapByTeam = asRecord(rulesContext.hardCapByTeam) || {};
  const explicit = asRecord(hardCapByTeam[teamCode]);
  const explicitCeiling = toFiniteNumber(explicit?.ceiling);
  const explicitStatus: FinalStateHardCapRecheckStatus | null =
    explicitCeiling !== null && explicit?.isHardCapped !== false
      ? {
          isHardCapped: explicit?.isHardCapped !== false,
          level:
            typeof explicit?.hardCapLevel === 'string'
              ? explicit.hardCapLevel
              : null,
          ceiling: explicitCeiling,
        }
      : null;
  const sharedRecheck: FinalStateHardCapRecheckStatus | null =
    sharedStatus.isHardCapped
      ? {
          isHardCapped: true,
          level:
            sharedStatus.hardCapCeilingType === 'FIRST_APRON'
              ? 'firstApron'
              : sharedStatus.hardCapCeilingType === 'SECOND_APRON'
                ? 'secondApron'
                : null,
          ceiling: sharedStatus.hardCapCeiling,
        }
      : null;
  const active = [sharedRecheck, explicitStatus].filter(
    (candidate): candidate is FinalStateHardCapRecheckStatus =>
      candidate !== null
  );
  if (active.length === 0) {
    return { isHardCapped: false, level: null, ceiling: null };
  }
  return [...active].sort(
    (left, right) =>
      (left.ceiling ?? Number.POSITIVE_INFINITY) -
      (right.ceiling ?? Number.POSITIVE_INFINITY)
  )[0];
}

/**
 * Later-layer hard-cap re-verification against authoritative final totals.
 * Earlier projected legality remains owned by hardCapValidation.ts; this helper only compares the
 * final derived hard-cap status against the final post-mutation salary artifact.
 */
function runFinalStateHardCapRecheck({
  teamCode,
  team,
  apronTeamSalary,
  afterTotals,
  rulesContext,
  violations,
  expectedYear,
}: {
  teamCode: string;
  team: AnyRecord;
  apronTeamSalary: number | null;
  afterTotals: AnyRecord;
  rulesContext: AnyRecord;
  violations: PostStateCapValidationIssue[];
  expectedYear: number | null;
}) {
  const hardCapStatus = getFinalStateHardCapRecheckStatus({
    teamCode,
    team,
    totals: afterTotals,
    rulesContext,
    expectedYear,
  });

  if (hardCapStatus.invalidLedger) {
    violations.push({
      code: 'HARD_CAP_LEDGER_INVALID',
      teamCode,
      path: `teams.${teamCode}.hardCapLedger`,
      message: `Team ${teamCode} has malformed or version-incompatible hard-cap history.`,
      actual: team.hardCapLedger,
    });
    return;
  }

  if (hardCapStatus.isHardCapped && apronTeamSalary === null) {
    violations.push({
      code: 'SALARY_BOOK_NEEDS_INPUT',
      teamCode,
      path: `afterTotalsByTeam.${teamCode}.apronTeamSalary`,
      message: `Team ${teamCode} cannot be certified against its hard cap because Apron Team Salary is not complete.`,
      actual: afterTotals.apronTeamSalary,
    });
    return;
  }

  if (
    hardCapStatus.isHardCapped &&
    hardCapStatus.ceiling !== null &&
    apronTeamSalary !== null &&
    apronTeamSalary > hardCapStatus.ceiling
  ) {
    violations.push({
      code: 'HARD_CAP_EXCEEDED',
      teamCode,
      path: `afterTotalsByTeam.${teamCode}.apronTeamSalary`,
      message: `Team ${teamCode} exceeds ${hardCapStatus.level || 'hard cap'} ceiling.`,
      expected: hardCapStatus.ceiling,
      actual: apronTeamSalary,
    });
  }
}

/**
 * Final-state roster counter.
 * Reads only the authoritative after-mutation team.players array. It does not
 * project roster changes or inspect pre-trade trade inputs.
 */
function countFinalStateRosterFromPlayers(players: AnyRecord[]) {
  let standardCount = 0;
  let twoWayCount = 0;

  for (const player of players) {
    const contract = asRecord(player.contract);
    const contractType = String(contract?.contractType || '').toLowerCase();
    if (contractType === 'two-way') {
      twoWayCount++;
    } else {
      standardCount++;
    }
  }

  return {
    standardCount,
    twoWayCount,
  };
}

/**
 * Later-layer roster re-verification against authoritative final player
 * snapshots.
 *
 * Earlier stage-specific projection owners remain separate. For trade flows,
 * that owner is tradeValidator.ts:computeProjectedRosterLegality(). This
 * helper only re-checks the final team.players artifact and maps shared
 * threshold breaches into post-state issue codes for whatever mutation family
 * produced the authoritative final roster snapshot.
 */
function runFinalStateRosterRecheck({
  teamCode,
  players,
  violations,
  warnings,
}: {
  teamCode: string;
  players: AnyRecord[];
  violations: PostStateCapValidationIssue[];
  warnings: PostStateCapValidationIssue[];
}) {
  const { standardCount, twoWayCount } =
    countFinalStateRosterFromPlayers(players);
  const evaluation = evaluateRosterCountsAgainstLimits(
    standardCount,
    twoWayCount
  );

  // Route by enforcement level so the post-state gate matches the Trade
  // Machine: 'error' blocks (violations), 'warn' is advisory (warnings), 'off'
  // is skipped. Standard roster size (14–15) is currently advisory; two-way
  // limit stays blocking. Keeps both gates consistent — a warned trade that
  // passes projection also persists instead of failing at commit.
  const targetFor = (
    level: (typeof validationFlags)['rosterEnforcement']
  ): PostStateCapValidationIssue[] | null =>
    level === 'error' ? violations : level === 'warn' ? warnings : null;

  const standardTarget = targetFor(validationFlags.rosterEnforcement);
  const twoWayTarget = targetFor(validationFlags.twoWayRoster);

  if (standardTarget && evaluation.isAboveMaximumStandard) {
    standardTarget.push({
      code: 'ROSTER_MAX_EXCEEDED',
      teamCode,
      path: `teams.${teamCode}.players`,
      message: `Team ${teamCode} has ${standardCount} standard contracts (max ${evaluation.maximumStandard}).`,
      expected: evaluation.maximumStandard,
      actual: standardCount,
    });
  }

  if (standardTarget && evaluation.isBelowMinimumStandard) {
    standardTarget.push({
      code: 'ROSTER_MIN_VIOLATED',
      teamCode,
      path: `teams.${teamCode}.players`,
      message: `Team ${teamCode} has ${standardCount} standard contracts (min ${evaluation.minimumStandard}).`,
      expected: evaluation.minimumStandard,
      actual: standardCount,
    });
  }

  if (twoWayTarget && evaluation.exceedsTwoWayLimit) {
    twoWayTarget.push({
      code: 'TWO_WAY_LIMIT_EXCEEDED',
      teamCode,
      path: `teams.${teamCode}.players`,
      message: `Team ${teamCode} has ${twoWayCount} two-way contracts (max ${evaluation.maximumTwoWay}).`,
      expected: evaluation.maximumTwoWay,
      actual: twoWayCount,
    });
  }
}

function validateTotalsSanity({
  teamCode,
  bucketLabel,
  totals,
  expectedYear,
  violations,
}: {
  teamCode: string;
  bucketLabel: 'before' | 'after';
  totals: AnyRecord | null;
  expectedYear: number | null;
  violations: PostStateCapValidationIssue[];
}) {
  const prefix = `${bucketLabel}TotalsByTeam.${teamCode}`;

  if (!totals) {
    violations.push({
      code: 'TOTALS_MISSING',
      teamCode,
      path: prefix,
      message: `Missing ${bucketLabel} totals for team ${teamCode}.`,
    });
    return;
  }

  const yearKey = toFiniteNumber(totals.yearKey);
  if (yearKey === null) {
    violations.push({
      code: 'TOTALS_YEAR_KEY_MISSING',
      teamCode,
      path: `${prefix}.yearKey`,
      message: `${bucketLabel} totals must include a finite yearKey.`,
      actual: totals.yearKey,
    });
  } else if (expectedYear !== null && yearKey !== expectedYear) {
    violations.push({
      code: 'TOTALS_YEAR_KEY_MISMATCH',
      teamCode,
      path: `${prefix}.yearKey`,
      message: `${bucketLabel} totals yearKey must match validation year.`,
      expected: expectedYear,
      actual: yearKey,
    });
  }

  for (const field of REQUIRED_TOTAL_NUMERIC_FIELDS) {
    const value = toFiniteNumber(totals[field]);
    if (value === null) {
      violations.push({
        code: 'TOTALS_NON_FINITE',
        teamCode,
        path: `${prefix}.${field}`,
        message: `${bucketLabel} totals field ${field} must be a finite number.`,
        actual: totals[field],
      });
    }
  }
}

function collectIncompleteSalaryBooks({
  teamCode,
  totals,
  warnings,
}: {
  teamCode: string;
  totals: AnyRecord;
  warnings: PostStateCapValidationIssue[];
}) {
  const books = [
    ['teamSalary', getTeamSalaryFromTotals(totals)],
    ['apronTeamSalary', getApronTeamSalaryFromTotals(totals)],
    ['taxSalary', getTaxSalaryFromTotals(totals)],
  ] as const;
  for (const [book, value] of books) {
    if (value === null) {
      warnings.push({
        code: 'SALARY_BOOK_NEEDS_INPUT',
        teamCode,
        path: `afterTotalsByTeam.${teamCode}.${book}`,
        message: `Team ${teamCode} has a partial post-state receipt because ${book} is not complete.`,
        actual: totals[book],
      });
    }
  }
}

/**
 * Category 2: Mirrored final-state legality re-checks.
 *
 * These checks re-verify rule families that may ALSO be enforced earlier in a
 * projection-time or mutation-stage validator. Those earlier layers remain
 * the first legality owners for their own inputs; this later shared layer
 * keeps a separate final-state safety net against authoritative
 * post-mutation snapshots and totals.
 *
 * Shared hard-cap ceiling fallback policy remains owned by hardCapStatus.ts,
 * and shared roster threshold interpretation remains owned by
 * validateRoster.ts:evaluateRosterCountsAgainstLimits().
 *
 * Codes: HARD_CAP_EXCEEDED, ROSTER_MAX_EXCEEDED, ROSTER_MIN_VIOLATED, TWO_WAY_LIMIT_EXCEEDED
 */
function runMirroredFinalStateLegalityRechecks({
  teamCode,
  team,
  apronTeamSalary,
  afterTotals,
  rulesContext,
  hasPlayersData,
  players,
  violations,
  warnings,
  expectedYear,
}: {
  teamCode: string;
  team: AnyRecord;
  apronTeamSalary: number | null;
  afterTotals: AnyRecord;
  rulesContext: AnyRecord;
  hasPlayersData: boolean;
  players: AnyRecord[];
  violations: PostStateCapValidationIssue[];
  warnings: PostStateCapValidationIssue[];
  expectedYear: number | null;
}) {
  // Later-layer hard-cap re-verification against final artifacts.
  // Earlier projected legality remains in tradeMachine/rules/hardCapValidation.ts.
  runFinalStateHardCapRecheck({
    teamCode,
    team,
    apronTeamSalary,
    afterTotals,
    rulesContext,
    violations,
    expectedYear,
  });

  // Roster limit re-checks mirror earlier projected roster validation.
  // For trade flows, that earlier projection owner is computeProjectedRosterLegality().
  // Only run when the players array was explicitly provided.
  if (!hasPlayersData) {
    return;
  }

  runFinalStateRosterRecheck({
    teamCode,
    players,
    violations,
    warnings,
  });
}

/**
 * Category 3: Warning-only observational checks.
 *
 * Non-blocking surfaces that report final-state cap observations without
 * failing validation. These only make sense against the authoritative
 * post-mutation snapshots/totals because earlier validators may not yet have
 * final salary artifacts to inspect.
 *
 * Codes: SALARY_FLOOR_NOT_MET, LUXURY_TAX_EXCEEDED
 */
function collectFinalStateWarnings({
  teamCode,
  teamSalary,
  taxSalary,
  afterTotals,
  minimumTeamSalary,
  warnings,
}: {
  teamCode: string;
  teamSalary: number | null;
  taxSalary: number | null;
  afterTotals: AnyRecord;
  minimumTeamSalary: number | null;
  warnings: PostStateCapValidationIssue[];
}) {
  if (
    minimumTeamSalary !== null &&
    teamSalary !== null &&
    teamSalary < minimumTeamSalary
  ) {
    warnings.push({
      code: 'SALARY_FLOOR_NOT_MET',
      teamCode,
      path: `afterTotalsByTeam.${teamCode}.teamSalary`,
      message: `Team ${teamCode} is below minimum team salary floor.`,
      expected: minimumTeamSalary,
      actual: teamSalary,
    });
  }

  const luxuryTax = toFiniteNumber(afterTotals.luxuryTax);
  if (luxuryTax !== null && taxSalary !== null && taxSalary > luxuryTax) {
    warnings.push({
      code: 'LUXURY_TAX_EXCEEDED',
      teamCode,
      path: `afterTotalsByTeam.${teamCode}.taxSalary`,
      message: `Team ${teamCode} exceeds luxury tax threshold.`,
      expected: luxuryTax,
      actual: taxSalary,
    });
  }
}

/**
 * Category 4: True post-state-only artifact validation.
 *
 * These checks validate final schema integrity and data correctness that can
 * ONLY be verified after the mutation has produced its output state. No earlier
 * pipeline stage performs these checks — they are unique to the post-state layer.
 *
 * Codes: CONTRACT_ROWS_INVALID, DEAD_CAP_INVALID, EXCEPTIONS_INVALID, CAP_HOLD_INVALID
 */
function runPostStateArtifactValidation({
  teamCode,
  team,
  players,
  violations,
}: {
  teamCode: string;
  team: AnyRecord;
  players: AnyRecord[];
  violations: PostStateCapValidationIssue[];
}) {
  // PSV_CONTRACT_004: Contract rows validity
  for (const p of players) {
    const contract = asRecord(p.contract);
    if (
      contract &&
      Array.isArray(contract.salariesByYear) &&
      contract.salariesByYear.length > 0
    ) {
      const result = validateContractRows(contract);
      if (result?.violations?.length > 0) {
        const playerId = String(p.playerId || p.id || 'unknown');
        for (const v of result.violations) {
          violations.push({
            code: 'CONTRACT_ROWS_INVALID',
            teamCode,
            path: `teams.${teamCode}.players.${playerId}.contract`,
            message:
              v.message ||
              `Contract row validation failed for player ${playerId}.`,
          });
        }
      }
    }
  }

  // PSV_DEAD_001: Dead cap schema validity
  if (team.deadCap !== undefined) {
    const deadCapResult = validateDeadCap(team.deadCap);
    if (deadCapResult?.violations?.length > 0) {
      for (const v of deadCapResult.violations) {
        violations.push({
          code: 'DEAD_CAP_INVALID',
          teamCode,
          path: `teams.${teamCode}.deadCap`,
          message:
            v.message ||
            `Dead cap schema validation failed for team ${teamCode}.`,
        });
      }
    }
  }

  // PSV_EXC_001-002: Exception schema validity
  const exceptionsObj = asRecord(team.exceptions);
  if (exceptionsObj) {
    const EXCEPTION_KEYS = ['mle', 'tpmle', 'bae', 'room'];
    const exceptionSubset: Record<string, unknown> = {};
    for (const key of EXCEPTION_KEYS) {
      if (exceptionsObj[key]) {
        exceptionSubset[key] = exceptionsObj[key];
      }
    }
    if (Object.keys(exceptionSubset).length > 0) {
      const excResult = validateExceptions(exceptionSubset);
      if (excResult?.violations?.length > 0) {
        for (const v of excResult.violations) {
          violations.push({
            code: 'EXCEPTIONS_INVALID',
            teamCode,
            path: `teams.${teamCode}.exceptions`,
            message:
              v.message ||
              `Exception schema validation failed for team ${teamCode}.`,
          });
        }
      }
    }
  }

  // PSV_HOLD_001: Cap hold amounts validity
  const capHolds = Array.isArray(team.capHolds)
    ? (team.capHolds as AnyRecord[])
    : [];
  for (const hold of capHolds) {
    const holdValidation = isCapHoldAmountValid(hold);
    if (!holdValidation.valid) {
      violations.push({
        code: 'CAP_HOLD_INVALID',
        teamCode,
        path: `teams.${teamCode}.capHolds`,
        message:
          holdValidation.reason || `Invalid cap hold for team ${teamCode}.`,
      });
    }
  }
}

/**
 * Canonical shared post-state team legality validator.
 *
 * This file owns post-state team legality only. It is intentionally shared
 * across trade and non-trade mutation families and must remain a late-stage
 * validator after compute has produced authoritative final artifacts and
 * before persistence/commit.
 *
 * Earlier validators establish projected or mutation-input legality, but they
 * do not replace final-state artifact validation here.
 *
 * This file must not absorb authority sequencing, trade-term validation,
 * world-state invariants, or persistence concerns.
 *
 * Internal check categories (TM-6A):
 *
 *   Category 1 — Input-sanity preconditions (inline + validateTotalsSanity)
 *     OPERATION_ID_MISSING, TEAM_SCOPE_EMPTY,
 *     TOTALS_MISSING, TOTALS_YEAR_KEY_MISSING, TOTALS_YEAR_KEY_MISMATCH, TOTALS_NON_FINITE
 *
 *   Category 2 — Mirrored final-state legality re-checks (runMirroredFinalStateLegalityRechecks)
 *     HARD_CAP_EXCEEDED, ROSTER_MAX_EXCEEDED, ROSTER_MIN_VIOLATED, TWO_WAY_LIMIT_EXCEEDED
 *     Earlier layers own stage-specific projected legality (`validateHardCap()`
 *     and `computeProjectedRosterLegality()` for the trade-time projection
 *     path); this later layer re-verifies final-state legality against
 *     authoritative post-mutation artifacts.
 *     Shared hard-cap ceiling fallback stays in hardCapStatus.ts, and shared
 *     roster threshold interpretation stays in
 *     validateRoster.ts:evaluateRosterCountsAgainstLimits().
 *
 *   Category 3 — Warning-only observational checks (collectFinalStateWarnings)
 *     SALARY_FLOOR_NOT_MET, LUXURY_TAX_EXCEEDED
 *     Non-blocking surfaces reporting final-state cap observations.
 *
 *   Category 4 — True post-state-only artifact validation (runPostStateArtifactValidation)
 *     CONTRACT_ROWS_INVALID, DEAD_CAP_INVALID, EXCEPTIONS_INVALID, CAP_HOLD_INVALID
 *     Final schema/integrity checks unique to the post-state layer.
 */
export function validatePostStateCapLegality(
  input: PostStateCapValidationInput
): PostStateCapValidationResult {
  const violations: PostStateCapValidationIssue[] = [];
  const warnings: PostStateCapValidationIssue[] = [];

  const expectedYear = toFiniteNumber(input.year ?? input.toYear);
  const beforeTeamsByCode = input.beforeTeamsByCode || {};
  const afterTeamsByCode = input.afterTeamsByCode || {};
  const beforeTotalsByTeam = input.beforeTotalsByTeam || {};
  const afterTotalsByTeam = input.afterTotalsByTeam || {};
  const rulesContext = asRecord(input.rulesContext) || {};

  // Category 1: Input-sanity preconditions
  if (!input.operationId) {
    violations.push({
      code: 'OPERATION_ID_MISSING',
      teamCode: 'GLOBAL',
      path: 'operationId',
      message: 'operationId is required for post-state validation.',
      actual: input.operationId,
    });
  }

  const teamCodes = Array.from(
    new Set([
      ...Object.keys(afterTeamsByCode),
      ...Object.keys(afterTotalsByTeam),
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(beforeTotalsByTeam),
    ])
  );

  if (teamCodes.length === 0) {
    violations.push({
      code: 'TEAM_SCOPE_EMPTY',
      teamCode: 'GLOBAL',
      path: 'afterTeamsByCode',
      message: 'No teams were provided to post-state validator.',
    });
    return { valid: false, violations, warnings };
  }

  const minimumTeamSalary = toFiniteNumber(rulesContext.minimumTeamSalary);

  for (const teamCode of teamCodes) {
    const beforeTotals = asRecord(beforeTotalsByTeam[teamCode]);
    const afterTotals = asRecord(afterTotalsByTeam[teamCode]);
    validateTotalsSanity({
      teamCode,
      bucketLabel: 'before',
      totals: beforeTotals,
      expectedYear,
      violations,
    });
    validateTotalsSanity({
      teamCode,
      bucketLabel: 'after',
      totals: afterTotals,
      expectedYear,
      violations,
    });

    if (!afterTotals) {
      continue;
    }

    const team = asRecord(afterTeamsByCode[teamCode]) || {};
    const teamSalary = getTeamSalaryFromTotals(afterTotals);
    const apronTeamSalary = getApronTeamSalaryFromTotals(afterTotals);
    const taxSalary = getTaxSalaryFromTotals(afterTotals);
    collectIncompleteSalaryBooks({ teamCode, totals: afterTotals, warnings });
    const hasPlayersData = Array.isArray(team.players);
    const players = hasPlayersData ? (team.players as AnyRecord[]) : [];

    // Category 2: Mirrored final-state legality re-checks
    // (hard cap ceiling + roster limits — re-verify final artifacts when those
    // rule families also have earlier projected or mutation-stage owners)
    runMirroredFinalStateLegalityRechecks({
      teamCode,
      team,
      apronTeamSalary,
      afterTotals,
      rulesContext,
      hasPlayersData,
      players,
      violations,
      warnings,
      expectedYear,
    });

    // Category 3: Warning-only observational checks
    // (salary floor + luxury tax — non-blocking final-state observations)
    collectFinalStateWarnings({
      teamCode,
      teamSalary,
      taxSalary,
      afterTotals,
      minimumTeamSalary,
      warnings,
    });

    // Category 4: True post-state-only artifact validation
    // (contract rows, dead cap, exceptions, cap holds — unique to post-state layer)
    runPostStateArtifactValidation({
      teamCode,
      team,
      players,
      violations,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
