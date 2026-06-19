/**
 * FILE: src/features/architect/utils/capLegalityValidation/actionValidators.ts
 * PURPOSE: validateWaive, validateOptionDecision, validateRenounceRights — extracted from capLegalityValidation.ts (Wave 4 Step 2e).
 * OWNERSHIP: Feature: architect/core
 */
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  calculateTeamCapHit,
  getPlayerId,
  getPlayerName,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import {
  getCapHoldForPlayer,
  didCreateCapHold,
  shouldExpectCapHoldOnDecline,
  computeExpectedCapHoldAmount,
  validateDeclineFreeAgency,
  isCapHoldAmountValid,
  getRightsTypeFromPlayer,
  deriveFreeAgencyYearFromOptionSeason,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import type {
  CapLegalityViolation,
  MutationSalaryRow,
  MutationContract,
  MutationPlayer,
  MutationTeam,
  MutationRosterEntry,
  MutationCapHold,
  KnownCapHold,
  MutationValidationResult,
  ValidateWaiveParams,
  ValidateOptionDecisionParams,
  ValidateRenounceRightsParams,
} from './schema';

// ==============================================================================
// LOCAL UTILITY COPIES
// Also present in capLegalityValidation.ts (orchestrator). Duplicated here to
// keep this submodule self-contained with no imports from siblings or orchestrator.
// ==============================================================================

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};
const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};
const asRecordLike = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  value: unknown
): T | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return null;
};
const normalizeBirdRights = (
  value: unknown
): {
  status?: string | null;
  renounced?: boolean | null;
} | null =>
  asRecordLike<{
    status?: string | null;
    renounced?: boolean | null;
  }>(value);

const getNormalizedContractType = (
  contract: MutationContract | null | undefined
): string =>
  typeof contract?.contractType === 'string'
    ? contract.contractType.toLowerCase()
    : '';

const calculateOptionDecisionBaselineCapHit = (
  players: MutationPlayer[] | null | undefined,
  playerId: string | null,
  year: number
): number =>
  calculateTeamCapHit(
    (players || []) as Parameters<typeof calculateTeamCapHit>[0],
    year,
    {
      getContractYearSlice: (capPlayer, capYear) => {
        const mutationPlayer = capPlayer as MutationPlayer;
        const yearEntry =
          mutationPlayer.contract?.salariesByYear?.find(
            (row) => toEndYear(row.season) === capYear
          ) || null;

        if (!yearEntry) return null;

        const isPendingTargetOption =
          getPlayerId(
            mutationPlayer as Parameters<typeof getPlayerId>[0]
          ) === playerId &&
          Boolean(yearEntry.option) &&
          yearEntry.optionUsed !== true;

        if (isPendingTargetOption) {
          return { capHit: 0, salary: 0 };
        }

        return {
          capHit: toFiniteNumber(yearEntry.capHit ?? yearEntry.salary, 0),
          salary: toFiniteNumber(yearEntry.salary ?? yearEntry.capHit, 0),
        };
      },
    }
  );
export function evaluateDataConfidence(
  rules: CapRulesProfile,
  operationName = 'Operation'
): {
  blocked: boolean;
  violation: CapLegalityViolation | null;
  warning: CapLegalityViolation | null;
} {
  if (!rules._meta) return { blocked: false, violation: null, warning: null };

  const summary = rules._meta.sourcesSummary;

  // If data is real or reported, we are good
  if (summary === 'real' || summary === 'reported') {
    return { blocked: false, violation: null, warning: null };
  }

  // If unknown, that's always bad (should have been caught by facade, but safe to check)
  if (summary === 'unknown') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Critical cap data is unknown/missing.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // If projected, check mode
  // Default to WARN if simple projected data
  let mode = 'WARN';
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  } else if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  }

  if (mode === 'STRICT') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Cap rules are PROJECTED (Strict Mode). Cannot validate legality against projected data.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // WARN mode (default)
  return {
    blocked: false,
    violation: null,
    warning: {
      rule: 'unverified_cap_inputs',
      message: `${operationName} using PROJECTED cap data. Validation reliability is lower.`,
      severity: 'warning',
    },
  };
}
function countStandardRoster(players: MutationPlayer[] | null | undefined) {
  if (!players || !Array.isArray(players)) return 0;

  return players.filter((p) => {
    const contractType = getNormalizedContractType(p.contract);
    return contractType !== 'two-way';
  }).length;
}

/**
 * Count two-way contracts
 * @param {Array} players - Team players array
 * @returns {number} Two-way contract count
 */
function getValidationHardCapLevel(
  hardCapType: ReturnType<typeof getSharedHardCapStatus>['hardCapType']
): 'firstApron' | 'secondApron' | null {
  if (hardCapType === HARD_CAP_TYPES.SECOND_APRON) {
    return 'secondApron';
  }
  if (
    hardCapType === HARD_CAP_TYPES.FIRST_APRON ||
    hardCapType === HARD_CAP_TYPES.UNKNOWN
  ) {
    return 'firstApron';
  }
  return null;
}

function getValidationHardCapStatus(
  team: MutationTeam,
  capRules: CapRulesProfile
) {
  const sharedStatus = getSharedHardCapStatus(team, {
    capSettings: capRules.cap,
  });

  return {
    isHardCapped: sharedStatus.isHardCapped,
    hardCapLevel: getValidationHardCapLevel(sharedStatus.hardCapType),
    ceiling: sharedStatus.hardCapCeiling,
  };
}

// ==============================================================================
// PRIVATE UTILITIES (moved from orchestrator — only used in this submodule)
// ==============================================================================

function getSeasonStartDate(seasonCode: string): string | null {
  // MVP Hardcoded boundaries
  // 2024-25: Oct 22, 2024
  if (seasonCode === '2024-25') return '2024-10-22';
  // 2025-26: Oct 21, 2025 (Estimated)
  if (seasonCode === '2025-26') return '2025-10-21';
  // 2026-27: Oct 20, 2026 (Estimated)
  if (seasonCode === '2026-27') return '2026-10-20';
  return null;
}

/**
 * Get override policy for a validation result.
 *
 * @param {Array} violations - Array of violation objects
 * @param {Array} warnings - Array of warning objects
 * @returns {{canOverride: boolean, hasHardBlock: boolean, hardBlockReasons: string[], softWarningReasons: string[]}}
 */
/**
 * Validate a waive action
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being waived
 * @param {boolean} params.stretch - Whether to stretch the waive
 * @param {number} params.year - Season end year
 * @param {boolean} params.isGracePeriod - Whether in roster grace period
 * @param {string} [params.asOfDate] - Phase 21: World time for stretch validation
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateWaive({
  team,
  player,
  stretch,
  year,
  isGracePeriod = false,
  asOfDate,
}: ValidateWaiveParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const players = team.players || [];

  // 1. Roster minimum check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(player.contract) === 'two-way';

  const rules = getCapRulesForYear(year);

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster - 1;
    const minRoster = isGracePeriod
      ? rules.roster.graceMin
      : rules.roster.minStandard;

    // 00. CHECK DATA CONFIDENCE
    const confidenceCheck = evaluateDataConfidence(rules, 'Waive');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }

    if (projectedRoster < minRoster) {
      // Warning, not error - teams can be temporarily below minimum
      warnings.push({
        rule: 'roster_minimum',
        message: `Waiving would drop roster to ${projectedRoster} players (minimum: ${minRoster})`,
        severity: 'warning',
      });
    }
  }

  // 2. Dead cap warning
  const contract = player.contract;
  if (contract?.salariesByYear) {
    const remainingGuaranteed = contract.salariesByYear
      .filter((row: MutationSalaryRow) => {
        const yearNum = toEndYear(row.season) ?? year;
        // Only count explicitly guaranteed years (not undefined/null)
        // NBA contracts default to guaranteed for first years, but we require
        // explicit flag for accurate dead cap calculation
        return yearNum >= year && row.guaranteed === true;
      })
      .reduce((sum, row) => sum + (Number(row.salary) || 0), 0);

    if (remainingGuaranteed > 0) {
      const stretchInfo = stretch ? ` (stretched over multiple years)` : '';
      warnings.push({
        rule: 'dead_cap',
        message: `Waiving will create $${(remainingGuaranteed / 1_000_000).toFixed(1)}M in dead cap${stretchInfo}`,
        severity: 'info',
      });
    }
  }

  // 3. Phase 21: Stretch Provision Timing Check
  if (stretch && asOfDate) {
    const seasonCode = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
    const seasonStart = getSeasonStartDate(seasonCode);

    if (seasonStart) {
      if (asOfDate > seasonStart) {
        warnings.push({
          rule: 'stretch_timing_suspicious',
          message: `Stretch provision used after season start (${seasonStart}). Base salary may need to be paid in full for current season.`,
          severity: 'warning',
        });
      }
    } else {
      warnings.push({
        rule: 'stretch_timing_not_enforced_missing_season_boundary',
        message: `Cannot verify stretch timing: season start date unknown for ${seasonCode}.`,
        severity: 'warning',
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

function getRosterEntryId(entry: MutationRosterEntry | null | undefined) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'number') return String(entry);
  return entry.player_id || entry.playerId || entry.id || null;
}

function isPlayerOnRoster(
  team: MutationTeam | null | undefined,
  playerId: string | null
) {
  if (!Array.isArray(team?.roster)) {
    return null;
  }

  return team.roster.some(
    (entry: MutationRosterEntry) => getRosterEntryId(entry) === playerId
  );
}

function findPlayerById(
  players: MutationPlayer[] | null | undefined,
  playerId: string | null
) {
  if (!Array.isArray(players)) return null;
  return (
    players.find(
      (p) => getPlayerId(p as Parameters<typeof getPlayerId>[0]) === playerId
    ) || null
  );
}

function getContractRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) => toEndYear(row?.season) === targetYear
    ) || null
  );
}

function getOptionRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) =>
        toEndYear(row?.season) === targetYear && row?.option
    ) || null
  );
}

/**
 * Validate an option decision
 *
 * @param {Object} params
 * @param {Object} params.originalTeam - Team state before mutation
 * @param {Object} params.updatedTeam - Team state after mutation (if available)
 * @param {Object} params.originalPlayer - Player whose option is being decided (pre-mutation)
 * @param {Object} params.updatedPlayer - Updated player record (if available)
 * @param {boolean} params.accepted - Whether option is accepted
 * @param {number} params.targetYear - The year of the option
 * @param {number} params.currentYear - Current season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
/**
 * Validate an option decision
 *
 * @param {Object} params
 * @param {Object} params.originalTeam - Team state before mutation
 * @param {Object} params.updatedTeam - Team state after mutation (if available)
 * @param {Object} params.originalPlayer - Player whose option is being decided (pre-mutation)
 * @param {Object} params.updatedPlayer - Updated player record (if available)
 * @param {boolean} params.accepted - Whether option is accepted
 * @param {number} params.targetYear - The year of the option
 * @param {number} params.currentYear - Current season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateOptionDecision({
  originalTeam,
  updatedTeam,
  originalPlayer,
  updatedPlayer,
  team,
  player,
  accepted,
  targetYear,
  currentYear,
}: ValidateOptionDecisionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const baselineTeam = originalTeam || team;
  const baselinePlayer = originalPlayer || player;
  const playerId = getPlayerId(
    baselinePlayer as Parameters<typeof getPlayerId>[0]
  );
  const resolvedUpdatedPlayer =
    updatedPlayer || findPlayerById(updatedTeam?.players, playerId);
  const resolvedTargetYear =
    typeof targetYear === 'number' ? targetYear : Number(targetYear);
  const resolvedCurrentYear =
    typeof currentYear === 'number' ? currentYear : Number(currentYear);

  // 1. Timing validation - can only decide options for upcoming season
  const hasValidTimingInput =
    Number.isFinite(resolvedTargetYear) && Number.isFinite(resolvedCurrentYear);
  const isActionableOption =
    hasValidTimingInput && resolvedTargetYear === resolvedCurrentYear + 1;

  if (!isActionableOption) {
    if (hasValidTimingInput && resolvedTargetYear < resolvedCurrentYear + 1) {
      violations.push({
        rule: 'option_timing',
        message: 'This option has already been decided (past season)',
        severity: 'error',
      });
    } else {
      violations.push({
        rule: 'option_timing',
        message: hasValidTimingInput
          ? `Cannot act on this option yet. It can be decided during the ${resolvedTargetYear - 2}-${String((resolvedTargetYear - 1) % 100).padStart(2, '0')} offseason.`
          : 'Cannot act on this option because target year or current year is invalid.',
        severity: 'error',
      });
    }
  }

  // 2. If accepting, check hard cap impact
  if (accepted && isActionableOption && baselineTeam && baselinePlayer) {
    const rules = getCapRulesForYear(resolvedTargetYear);

    if (rules) {
      const hardCapStatus = getValidationHardCapStatus(baselineTeam, rules);

      if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
        // 00. CHECK DATA CONFIDENCE for target year
        const confidenceCheck = evaluateDataConfidence(
          rules,
          'Option Decision'
        );
        if (confidenceCheck.blocked && confidenceCheck.violation) {
          violations.push(confidenceCheck.violation);
        }
        if (confidenceCheck.warning) {
          warnings.push(confidenceCheck.warning);
        }

        // Calculate projected cap hit including the option salary
        const optionSalary =
          baselinePlayer.contract?.salariesByYear?.find(
            (y: MutationSalaryRow) =>
              toEndYear(y.season) === resolvedTargetYear && y.option
          )?.salary || 0;

        const players = baselineTeam.players || [];
        const currentCapHit = calculateOptionDecisionBaselineCapHit(
          players,
          playerId,
          resolvedTargetYear
        );
        const projectedCapHit = currentCapHit + toFiniteNumber(optionSalary, 0);

        if (projectedCapHit > hardCapStatus.ceiling) {
          const ceilingLabel =
            hardCapStatus.hardCapLevel === 'secondApron'
              ? 'second apron'
              : 'first apron';
          violations.push({
            rule: 'option_hard_cap',
            message: `Accepting option would exceed the ${ceilingLabel} hard cap ceiling in ${resolvedTargetYear - 1}-${String(resolvedTargetYear % 100).padStart(2, '0')}`,
            severity: 'error',
          });
        }
      }
    }

    // Phase 7.1: Check for contradictory cap hold creation on accept
    // If we accepted, we shouldn't have created a cap hold
    if (updatedTeam) {
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );
      if (capHoldCreated) {
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message:
            'Accepted option but a cap hold was created. Player should remain under contract.',
          severity: 'error',
        });
      }

      // Phase 7.3: Option accept invariants
      // - No cap hold created
      // - optionUsed === true on option year row
      // - Player remains on roster (no removal)
      // - Contract salariesByYear is coherent (row present for option year)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === false) {
        violations.push({
          rule: 'option_accept_player_not_rostered',
          message: 'Accepted option but player is no longer on roster.',
          severity: 'error',
        });
      }

      if (!resolvedUpdatedPlayer) {
        violations.push({
          rule: 'option_accept_option_row_invalid',
          message: 'Accepted option but updated player record is missing.',
          severity: 'error',
        });
      } else {
        const salaries = resolvedUpdatedPlayer.contract?.salariesByYear;
        if (!Array.isArray(salaries) || salaries.length === 0) {
          violations.push({
            rule: 'option_accept_option_row_invalid',
            message:
              'Accepted option but contract salariesByYear is missing or empty.',
            severity: 'error',
          });
        } else {
          const optionRow = getOptionRowForYear(
            resolvedUpdatedPlayer.contract,
            resolvedTargetYear
          );
          if (!optionRow) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but option year row is missing from contract.',
              severity: 'error',
            });
          } else if (optionRow.optionUsed !== true) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but optionUsed is not true on the option year row.',
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 3. If declining, validate cap hold transition and free agency state
  if (!accepted && isActionableOption && baselineTeam && baselinePlayer) {
    // Check if cap hold should be expected
    const expectation = shouldExpectCapHoldOnDecline(
      baselinePlayer as Parameters<typeof shouldExpectCapHoldOnDecline>[0],
      resolvedTargetYear
    );
    const rightsType = getRightsTypeFromPlayer(
      baselinePlayer as Parameters<typeof getRightsTypeFromPlayer>[0]
    );
    const capHoldExpectation = expectation.shouldCreate
      ? computeExpectedCapHoldAmount({
          player: baselinePlayer as Parameters<
            typeof computeExpectedCapHoldAmount
          >[0]['player'],
          lastSalary: expectation.priorSalary,
          rules: null,
          rightsType,
        })
      : null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      expectation.optionSeason,
      resolvedTargetYear
    );
    const faYearSourceLabel =
      faYearInfo.source === 'option_season' ? 'option season' : 'fallback year';
    const CAP_HOLD_AMOUNT_TOLERANCE = 1;

    if (updatedTeam) {
      // 3.1 Validate cap hold creation
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );

      if (expectation.shouldCreate && !capHoldCreated) {
        // If we expected a cap hold but didn't get one
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message: `Declined option should create a cap hold (based on prior salary $${(expectation.priorSalary / 1_000_000).toFixed(1)}M) but none was created.`,
          severity: 'error',
        });
      }

      // 3.2 If cap hold created, validate its amount
      if (capHoldCreated) {
        const newHold = getCapHoldForPlayer(
          updatedTeam as Parameters<typeof getCapHoldForPlayer>[0],
          playerId
        );
        const amountCheck = isCapHoldAmountValid(newHold);
        const newHoldAmount = Number(
          (newHold as KnownCapHold | null | undefined)?.amount || 0
        );

        if (!amountCheck.valid) {
          violations.push({
            rule: 'cap_hold_transition_invalid',
            message: `Created cap hold is invalid: ${amountCheck.reason}`,
            severity: 'error',
          });
        } else if (expectation.shouldCreate && capHoldExpectation) {
          const expectedAmount = capHoldExpectation.amount;
          const amountDelta = Math.abs(newHoldAmount - expectedAmount);
          if (newHoldAmount <= 0) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: 'Created cap hold has zero or negative amount',
              severity: 'error',
            });
          } else if (amountDelta > CAP_HOLD_AMOUNT_TOLERANCE) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: `Created cap hold amount ${newHoldAmount} does not match expected ${expectedAmount} (Δ ${amountDelta})`,
              severity: 'error',
            });
          }
        }

        // Info warning for UI
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates $${(
            newHoldAmount / 1_000_000
          ).toFixed(1)}M cap hold`,
          severity: 'info',
        });
      } else {
        // No cap hold created (and maybe none expected)
        if (!expectation.shouldCreate) {
          warnings.push({
            rule: 'cap_hold_creation',
            message: `Declining option creates NO cap hold (${expectation.reason || 'reason unknown'})`,
            severity: 'info',
          });
        }
      }

      if (capHoldExpectation?.usedFallback) {
        const rightsLabel =
          capHoldExpectation.rightsType || 'missing rightsType';
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message: `Cap hold amount used fallback multiplier due to ${rightsLabel}. Verify Bird rights availability.`,
          severity: 'warning',
        });
      }

      if (faYearInfo.source !== 'option_season') {
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message:
            'freeAgency.year derived from fallback end year because option season was missing or invalid.',
          severity: 'warning',
        });
      }

      // 3.3 Validate freeAgency state of updated player
      // We need to find the player in the updated team to check freeAgency
      const updatedDeclinedPlayer =
        resolvedUpdatedPlayer || findPlayerById(updatedTeam.players, playerId);
      if (updatedDeclinedPlayer && updatedDeclinedPlayer.contract) {
        const faValidation = validateDeclineFreeAgency(
          updatedDeclinedPlayer.contract.freeAgency,
          faYearInfo.year,
          { source: faYearSourceLabel }
        );
        if (!faValidation.valid) {
          violations.push(...faValidation.violations);
        }
        warnings.push(...faValidation.warnings);
      }

      // Phase 7.3: Option decline invariants
      // - Cap hold created when expected (handled above)
      // - Player not rostered for declined option year
      // - freeAgency is canonical and matches derived year
      // - Option year row removed (no contradictory contract season)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === true) {
        violations.push({
          rule: 'option_decline_player_still_rostered',
          message: 'Declined option but player remains on roster.',
          severity: 'error',
        });
      }

      if (updatedDeclinedPlayer?.contract) {
        const declinedRow = getContractRowForYear(
          updatedDeclinedPlayer.contract,
          resolvedTargetYear
        );
        if (declinedRow) {
          violations.push({
            rule: 'option_decline_contract_row_still_present_for_declined_season',
            message:
              'Declined option but contract still includes the declined season.',
            severity: 'error',
          });
        }
      }
    } else {
      // Fallback if updatedTeam not provided (e.g. UI pre-validation before compute)
      // Just emit the informational warning we had before
      if (expectation.shouldCreate && capHoldExpectation) {
        const capHoldAmount = capHoldExpectation.amount;
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates ~$${(capHoldAmount / 1_000_000).toFixed(1)}M cap hold (expected)`,
          severity: 'info',
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

/**
 * Validate renouncing rights
 *
 * Renouncing is always structurally valid if the player has rights with the team.
 * This is a permissive action that clears cap holds.
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player whose rights are being renounced
 * @param {number} [params.year] - Season end year (optional, for consistency with other validators)
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateRenounceRights({
  team,
  player,
  year = null,
}: ValidateRenounceRightsParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];
  void year;

  // Use helper functions for consistent player data extraction
  const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
  const playerName = getPlayerName(
    player as Parameters<typeof getPlayerName>[0]
  );

  // Check if player has a cap hold to renounce
  const capHolds: KnownCapHold[] = Array.isArray(team.capHolds)
    ? (team.capHolds as KnownCapHold[])
    : [];

  const hasCapHold = capHolds.some(
    (capHold) =>
      capHold.playerId === playerId || capHold.playerName === playerName
  );

  // Check if player has Bird rights to renounce
  const contractBirdRights = normalizeBirdRights(player.contract?.birdRights);
  const hasBirdRights =
    !!contractBirdRights?.status && contractBirdRights.status !== 'None';

  if (!hasCapHold && !hasBirdRights) {
    warnings.push({
      rule: 'no_rights',
      message: 'Player has no cap hold or Bird rights to renounce',
      severity: 'info',
    });
  }

  // Info about cap space gained
  if (hasCapHold) {
    const capHold = capHolds.find(
      (candidate) =>
        candidate.playerId === playerId || candidate.playerName === playerName
    );
    if (capHold?.amount) {
      warnings.push({
        rule: 'cap_space_gain',
        message: `Renouncing will free $${(capHold.amount / 1_000_000).toFixed(1)}M in cap holds`,
        severity: 'info',
      });
    }
  }

  // Renouncing is always valid structurally
  return {
    valid: true,
    violations,
    warnings,
  };
}
