/**
 * FILE: src/features/architect/utils/capLegality/postStateCapValidator.ts
 * PURPOSE: Shared post-state cap validator contract for authoritative world mutations.
 * OWNERSHIP: Feature: architect/core
 */

import {
  validateContractRows,
  validateDeadCap,
  validateExceptions,
} from '@/features/architect/utils/capLegalityValidation';
import { isCapHoldAmountValid } from '@/features/architect/utils/capHoldTransitionHelpers';

export const POST_STATE_CAP_VALIDATOR_VERSION = '1.0.0';

type AnyRecord = Record<string, unknown>;

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

  const totalCapAllocations = toFiniteNumber(totals.totalCapAllocations);
  if (totalCapAllocations !== null) {
    return totalCapAllocations;
  }

  return toFiniteNumber(totals.currentCapHit);
}

function resolveHardCapCeiling({
  teamCode,
  team,
  totals,
  rulesContext,
}: {
  teamCode: string;
  team: AnyRecord;
  totals: AnyRecord;
  rulesContext: AnyRecord;
}): { isHardCapped: boolean; level: string | null; ceiling: number | null } {
  const hardCapByTeam = asRecord(rulesContext.hardCapByTeam) || {};
  const explicit = asRecord(hardCapByTeam[teamCode]);
  const explicitCeiling = toFiniteNumber(explicit?.ceiling);
  if (explicitCeiling !== null) {
    return {
      isHardCapped: explicit?.isHardCapped !== false,
      level:
        typeof explicit?.hardCapLevel === 'string'
          ? explicit.hardCapLevel
          : null,
      ceiling: explicitCeiling,
    };
  }

  const totalsObj = asRecord(team.totals) || {};
  const hardCapLevelRaw =
    (typeof team.hardCapLevel === 'string' && team.hardCapLevel) ||
    (typeof totalsObj.hardCapLevel === 'string' && totalsObj.hardCapLevel) ||
    (typeof totals.hardCapLevel === 'string' &&
      (totals.hardCapLevel as string));
  const hardCapLevel =
    hardCapLevelRaw === 'secondApron' ? 'secondApron' : 'firstApron';

  const hardCapTriggered = String(team.hardCapTriggered || '').toLowerCase();
  const hardCappedRaw =
    team.hardCapped ??
    totalsObj.isHardCapped ??
    totals.isHardCapped ??
    team.hardCapTriggered ??
    null;

  const isHardCapped =
    hardCappedRaw === true ||
    hardCappedRaw === 1 ||
    hardCappedRaw === 2 ||
    String(hardCappedRaw).toLowerCase() === 'firstapron' ||
    String(hardCappedRaw).toLowerCase() === 'secondapron' ||
    hardCapTriggered === 'firstapron' ||
    hardCapTriggered === 'secondapron';

  if (!isHardCapped) {
    return { isHardCapped: false, level: null, ceiling: null };
  }

  const capSettings = asRecord(rulesContext.capSettings) || {};
  const firstApron =
    toFiniteNumber(capSettings.firstApron) ?? toFiniteNumber(totals.firstApron);
  const secondApron =
    toFiniteNumber(capSettings.secondApron) ??
    toFiniteNumber(totals.secondApron);

  const inferredSecondApron =
    hardCapLevelRaw === 'secondApron' ||
    hardCappedRaw === 2 ||
    hardCapTriggered === 'secondapron';

  if (inferredSecondApron && secondApron !== null) {
    return { isHardCapped: true, level: 'secondApron', ceiling: secondApron };
  }

  return {
    isHardCapped: true,
    level: 'firstApron',
    ceiling: firstApron,
  };
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
    const hardCapStatus = resolveHardCapCeiling({
      teamCode,
      team,
      totals: afterTotals,
      rulesContext,
    });

    if (
      hardCapStatus.isHardCapped &&
      hardCapStatus.ceiling !== null &&
      teamSalary !== null &&
      teamSalary > hardCapStatus.ceiling
    ) {
      violations.push({
        code: 'HARD_CAP_EXCEEDED',
        teamCode,
        path: `afterTotalsByTeam.${teamCode}.totalCapAllocations`,
        message: `Team ${teamCode} exceeds ${hardCapStatus.level || 'hard cap'} ceiling.`,
        expected: hardCapStatus.ceiling,
        actual: teamSalary,
      });
    }

    if (
      minimumTeamSalary !== null &&
      teamSalary !== null &&
      teamSalary < minimumTeamSalary
    ) {
      warnings.push({
        code: 'SALARY_FLOOR_NOT_MET',
        teamCode,
        path: `afterTotalsByTeam.${teamCode}.totalCapAllocations`,
        message: `Team ${teamCode} is below minimum team salary floor.`,
        expected: minimumTeamSalary,
        actual: teamSalary,
      });
    }

    // --- v1.0.0 rules below ---

    // PSV_CAP_004: Luxury tax threshold warning
    const luxuryTax = toFiniteNumber(afterTotals.luxuryTax);
    if (luxuryTax !== null && teamSalary !== null && teamSalary > luxuryTax) {
      warnings.push({
        code: 'LUXURY_TAX_EXCEEDED',
        teamCode,
        path: `afterTotalsByTeam.${teamCode}.totalCapAllocations`,
        message: `Team ${teamCode} exceeds luxury tax threshold.`,
        expected: luxuryTax,
        actual: teamSalary,
      });
    }

    // PSV_ROSTER_001 / PSV_ROSTER_003: Roster limits
    const players = Array.isArray(team.players)
      ? (team.players as AnyRecord[])
      : [];
    let standardCount = 0;
    let twoWayCount = 0;
    for (const p of players) {
      const contract = asRecord(p.contract);
      const contractType = String(contract?.contractType || '').toLowerCase();
      if (contractType === 'two-way') {
        twoWayCount++;
      } else {
        standardCount++;
      }
    }

    if (standardCount > 15) {
      violations.push({
        code: 'ROSTER_MAX_EXCEEDED',
        teamCode,
        path: `teams.${teamCode}.players`,
        message: `Team ${teamCode} has ${standardCount} standard contracts (max 15).`,
        expected: 15,
        actual: standardCount,
      });
    }

    if (twoWayCount > 3) {
      violations.push({
        code: 'TWO_WAY_LIMIT_EXCEEDED',
        teamCode,
        path: `teams.${teamCode}.players`,
        message: `Team ${teamCode} has ${twoWayCount} two-way contracts (max 3).`,
        expected: 3,
        actual: twoWayCount,
      });
    }

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

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
