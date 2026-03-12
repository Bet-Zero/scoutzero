/**
 * getOfficialSalaryMatchingSnapshot.ts
 *
 * CANONICAL SELECTOR for official salary matching values from validator output.
 * This is the SINGLE SOURCE OF TRUTH for all UI surfaces displaying salary matching data.
 *
 * PURPOSE: Per MASTER_TRADE_MACHINE_ALIGNMENT.md (Invariant 1), if the same concept
 * is displayed in multiple UI locations, it MUST use the SAME SOURCE/PIPELINE once
 * validation exists. This selector is that single source.
 *
 * RULES:
 * 1. This is the ONLY place allowed to know the raw validator field paths
 * 2. All UI surfaces MUST use this selector for official values after validation
 * 3. If teamResult is null/undefined: hasValidator=false, all fields null
 * 4. If a field is missing in teamResult: keep null (do NOT infer/compute)
 * 5. Numbers stay raw (no formatting) - formatting happens at UI layer
 *
 * CANONICAL FIELD MAPPING (from MASTER_TRADE_MACHINE_ALIGNMENT.md):
 * - OUT: teamResult.salaryOut
 * - IN: teamResult.salaryIn
 * - LIMIT: teamResult.rules.salaryMatching.allowableIncoming
 * - PASSED: teamResult.rules.salaryMatching.passed
 * - RULE: teamResult.rules.salaryMatching.details.ruleApplied
 * - FORMULA: teamResult.rules.salaryMatching.details.formulaUsed
 * - SKIP: teamResult.rules.salaryMatching.skipReason
 *
 * TM_FIX_A2_E1: Additional fields for hard-cap ceiling:
 * - HARD_CAP_CEILING: teamResult.rules.salaryMatching.hardCapIncomingCeiling
 * - EFFECTIVE_ALLOWABLE: teamResult.rules.salaryMatching.effectiveAllowableIncoming
 * - HARD_CAP_DETAILS: teamResult.rules.salaryMatching.details.hardCapCeiling
 *
 * @see docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md
 */

type NumericLike = number | null | undefined;
type BooleanLike = boolean | null | undefined;
type StringLike = string | null | undefined;

interface HardCapStatusLike {
  isHardCapped?: boolean | null;
  hardCapType?: string | null;
  [key: string]: unknown;
}

interface HardCapCeilingDetailsLike {
  apron?: NumericLike;
  apronLabel?: StringLike;
  limiter?: unknown;
  [key: string]: unknown;
}

interface SalaryMatchingDetailsLike {
  ruleApplied?: StringLike;
  formulaUsed?: StringLike;
  hardCapCeiling?: HardCapCeilingDetailsLike | null;
  hardCapStatus?: HardCapStatusLike | null;
  [key: string]: unknown;
}

interface SalaryMatchingRuleLike {
  allowableIncoming?: NumericLike;
  passed?: BooleanLike;
  skipReason?: StringLike;
  hardCapIncomingCeiling?: NumericLike;
  effectiveAllowableIncoming?: NumericLike;
  details?: SalaryMatchingDetailsLike | null;
  [key: string]: unknown;
}

interface TeamRulesLike {
  salaryMatching?: SalaryMatchingRuleLike | null;
  [key: string]: unknown;
}

interface TeamResultLike {
  teamId?: string;
  teamCode?: string;
  salaryIn?: NumericLike;
  salaryOut?: NumericLike;
  rules?: TeamRulesLike | null;
  [key: string]: unknown;
}

interface ValidationResultLike {
  teamResults?: Array<TeamResultLike | null | undefined> | null;
  [key: string]: unknown;
}

interface OfficialSalaryMatchingSnapshot {
  hasValidator: boolean;
  allowableIncoming: number | null;
  salaryIn: number | null;
  salaryOut: number | null;
  passed: boolean | null;
  ruleApplied: string | null;
  formulaUsed: string | null;
  skipReason: string | null;
  hardCapIncomingCeiling: number | null;
  effectiveAllowableIncoming: number | null;
  displayAllowableIncoming: number | null;
  hardCapCeilingDetails: HardCapCeilingDetailsLike | null;
  hardCapType: string | null;
  hardCapLimiterLabel: string | null;
  isHardCapped: boolean;
}

function createEmptyOfficialSalaryMatchingSnapshot(): OfficialSalaryMatchingSnapshot {
  return {
    hasValidator: false,
    allowableIncoming: null,
    salaryIn: null,
    salaryOut: null,
    passed: null,
    ruleApplied: null,
    formulaUsed: null,
    skipReason: null,
    hardCapIncomingCeiling: null,
    effectiveAllowableIncoming: null,
    displayAllowableIncoming: null,
    hardCapCeilingDetails: null,
    hardCapType: null,
    hardCapLimiterLabel: null,
    isHardCapped: false,
  };
}

/**
 * Get official salary matching snapshot from a validator team result.
 *
 * @param {Object|null} teamResult - The per-team validator result object
 *   from validateTrade().teamResults[i]
 * @returns {Object} Official salary matching snapshot with the following shape:
 *   {
 *     hasValidator: boolean,       // true if teamResult exists and has data
 *     allowableIncoming: number | null,  // LIMIT - max incoming allowed (salary matching rule)
 *     salaryIn: number | null,           // IN - incoming matching total
 *     salaryOut: number | null,          // OUT - outgoing matching total
 *     passed: boolean | null,            // salary matching pass/fail
 *     ruleApplied: string | null,        // rule label (e.g., "OVER_CAP_BAND_2")
 *     formulaUsed: string | null,        // formula text (e.g., "125% + $250K")
 *     skipReason: string | null,         // skip reason if N/A (e.g., "HARD_CAP_SKIP")
 *     // TM_FIX_A2_E1: Hard cap ceiling fields
 *     hardCapIncomingCeiling: number | null,     // ceiling based on hard cap room
 *     effectiveAllowableIncoming: number | null, // min(allowable, hardCapCeiling)
 *     displayAllowableIncoming: number | null,   // value UI should display (effective first)
 *     hardCapCeilingDetails: Object | null,      // {apron, apronLabel, limiter}
 *     hardCapType: string | null,                // FIRST_APRON | SECOND_APRON | UNKNOWN
 *     hardCapLimiterLabel: string | null,        // human-readable apron label
 *     isHardCapped: boolean                      // whether team is hard-capped
 *   }
 */
export function getOfficialSalaryMatchingSnapshot(
  teamResult: TeamResultLike | null | undefined
): OfficialSalaryMatchingSnapshot {
  // Rule 3: If no teamResult, return hasValidator=false with all nulls
  if (!teamResult) {
    return createEmptyOfficialSalaryMatchingSnapshot();
  }

  // Extract salary matching rule evaluation from canonical path
  const salaryMatching = teamResult.rules?.salaryMatching;

  const snapshot: OfficialSalaryMatchingSnapshot = {
    hasValidator: true,

    // LIMIT: teamResult.rules.salaryMatching.allowableIncoming
    // Rule 4: Keep null if not present (indicates N/A, not 0)
    allowableIncoming: salaryMatching?.allowableIncoming ?? null,

    // IN: teamResult.salaryIn (validator-computed matching value)
    salaryIn: teamResult.salaryIn ?? null,

    // OUT: teamResult.salaryOut (validator-computed matching value)
    salaryOut: teamResult.salaryOut ?? null,

    // PASSED: teamResult.rules.salaryMatching.passed
    passed: salaryMatching?.passed ?? null,

    // RULE: teamResult.rules.salaryMatching.details.ruleApplied
    ruleApplied: salaryMatching?.details?.ruleApplied ?? null,

    // FORMULA: teamResult.rules.salaryMatching.details.formulaUsed
    formulaUsed: salaryMatching?.details?.formulaUsed ?? null,

    // SKIP: teamResult.rules.salaryMatching.skipReason
    skipReason: salaryMatching?.skipReason ?? null,

    // TM_FIX_A2_E1: Hard cap ceiling fields
    // Hard cap incoming ceiling: outgoing + max(0, apron - teamTotalSalary)
    hardCapIncomingCeiling: salaryMatching?.hardCapIncomingCeiling ?? null,

    // Effective allowable incoming: min(allowableIncoming, hardCapIncomingCeiling)
    effectiveAllowableIncoming:
      salaryMatching?.effectiveAllowableIncoming ?? null,

    // Display value for all UI surfaces:
    // Use effectiveAllowableIncoming when available (hard-cap-aware), otherwise allowableIncoming.
    displayAllowableIncoming: null,

    // Hard cap ceiling details: {apron, apronLabel, limiter}
    hardCapCeilingDetails: salaryMatching?.details?.hardCapCeiling ?? null,

    // Canonical hard-cap typing from getHardCapStatus
    hardCapType: salaryMatching?.details?.hardCapStatus?.hardCapType ?? null,

    // Active limiter label for UI
    hardCapLimiterLabel:
      salaryMatching?.details?.hardCapCeiling?.apronLabel ?? null,

    // Whether team is hard-capped (for UI display logic)
    isHardCapped: !!salaryMatching?.details?.hardCapStatus?.isHardCapped,
  };

  snapshot.displayAllowableIncoming = getDisplayAllowableIncoming(snapshot);

  return snapshot;
}

/**
 * Returns the canonical "Allowable Incoming" value that UI should display.
 * For hard-capped teams, this is effectiveAllowableIncoming.
 * Otherwise it is allowableIncoming.
 *
 * @param {Object|null} snapshot - Result from getOfficialSalaryMatchingSnapshot()
 * @returns {number | null}
 */
export function getDisplayAllowableIncoming(
  snapshot: OfficialSalaryMatchingSnapshot | null | undefined
): number | null {
  if (!snapshot || !snapshot.hasValidator) {
    return null;
  }

  const effective = snapshot.effectiveAllowableIncoming;
  const allowable = snapshot.allowableIncoming;

  if (effective === null || effective === undefined) {
    return allowable ?? null;
  }

  return effective;
}

/**
 * Compute remaining room from official snapshot values.
 *
 * Per MASTER_TRADE_MACHINE_ALIGNMENT.md Section 2.4:
 * "Remaining Room MUST be computed from snapshot-derived values"
 *
 * Formula: Remaining Room = allowableIncoming - salaryIn
 *
 * @param {Object} snapshot - Result from getOfficialSalaryMatchingSnapshot()
 * @returns {number | null} Remaining room, or null if values unavailable
 */
export function computeRemainingRoom(
  snapshot: OfficialSalaryMatchingSnapshot | null | undefined
): number | null {
  if (!snapshot || !snapshot.hasValidator) {
    return null;
  }

  const { allowableIncoming, salaryIn } = snapshot;

  // If either value is null/undefined, remaining room cannot be computed
  if (
    allowableIncoming === null ||
    allowableIncoming === undefined ||
    salaryIn === null ||
    salaryIn === undefined
  ) {
    return null;
  }

  return allowableIncoming - salaryIn;
}

/**
 * Get official salary matching snapshot for a team by ID from a full validation result.
 *
 * Convenience wrapper that finds the team in teamResults and calls
 * getOfficialSalaryMatchingSnapshot.
 *
 * @param {string} teamId - The team ID to look up
 * @param {Object} validationResult - The full validator result with teamResults array
 * @returns {Object} Official salary matching snapshot
 */
export function getOfficialSnapshotByTeamId(
  teamId: string | null | undefined,
  validationResult: ValidationResultLike | null | undefined
): OfficialSalaryMatchingSnapshot {
  if (!validationResult || !teamId) {
    return getOfficialSalaryMatchingSnapshot(null);
  }

  const teamResult = validationResult.teamResults?.find(
    (t) => t?.teamId === teamId || t?.teamCode === teamId
  );

  return getOfficialSalaryMatchingSnapshot(teamResult);
}

/**
 * Get official salary matching snapshot for a team by index from a full validation result.
 *
 * @param {number} teamIndex - The index in the teamResults array
 * @param {Object} validationResult - The full validator result with teamResults array
 * @returns {Object} Official salary matching snapshot
 */
export function getOfficialSnapshotByIndex(
  teamIndex: number | null | undefined,
  validationResult: ValidationResultLike | null | undefined
): OfficialSalaryMatchingSnapshot {
  if (
    !validationResult ||
    teamIndex === null ||
    teamIndex === undefined ||
    teamIndex < 0
  ) {
    return getOfficialSalaryMatchingSnapshot(null);
  }

  const teamResult = validationResult.teamResults?.[teamIndex];

  return getOfficialSalaryMatchingSnapshot(teamResult);
}
