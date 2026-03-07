/**
 * useTradeMachineSnapshot.js
 *
 * Thin accessor layer over validator result for UI consumption.
 * Part of Phase 1: Legality Correctness (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.0)
 *
 * RULES (Non-Negotiable):
 * 1. Read validator contract fields directly — receipt is debug/inspection only
 * 2. Do NOT expose ambiguous flags (isFirstApron/isSecondApron) — defer to Phase 2/3
 * 3. Prefer explicit validator rule evaluations over derived status flags
 * 4. If fields are missing, return 0/empty defaults — do NOT compute locally
 *
 * SALARY MATCHING VALUES:
 * For official salary matching values (OUT/IN/LIMIT/PASSED/RULE/FORMULA/SKIP),
 * this module delegates to getOfficialSalaryMatchingSnapshot which is the
 * SINGLE SOURCE OF TRUTH per MASTER_TRADE_MACHINE_ALIGNMENT.md Invariant 1.
 */

import { getOfficialSalaryMatchingSnapshot } from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';

/**
 * Get a team-specific snapshot from the validator result.
 *
 * @param {string} teamId - The team ID to look up
 * @param {Object} result - The validator result object from validateTrade()
 * @returns {Object|null} Team snapshot with legality-affecting values, or null if not available
 */
export function getTeamSnapshot(teamId, result) {
  if (!result || !teamId) return null;

  // Find team in teamResults by teamId or teamCode
  const teamResult = result.teamResults?.find(
    (t) => t.teamId === teamId || t.teamCode === teamId
  );

  if (!teamResult) return null;

  // NOTE: Do NOT use result.tradeReceipt for official values — receipt is debug only
  // All values come from teamResult (validator output)

  // Get official salary matching values from canonical selector
  // This is the SINGLE SOURCE OF TRUTH for salary matching concepts
  const officialSnapshot = getOfficialSalaryMatchingSnapshot(teamResult);

  return {
    // Identity
    teamId: teamResult.teamId,
    teamName: teamResult.teamName,

    // Pre-trade team salary (from validator — see Definition Gate for what this includes)
    preTradeTeamSalary: teamResult.totalSalary ?? 0,

    // Outgoing — from teamResults only, no receipt fallback
    // totals.outgoingBase is base salary, salaryOut is matching-adjusted
    outgoingBaseSalary:
      teamResult.calculations?.salaryOut ?? teamResult.salaryOut ?? 0,
    // CANONICAL: Use official selector for matching salary
    outgoingMatchingSalary: officialSnapshot.salaryOut ?? 0,

    // Incoming — from teamResults only, no receipt fallback
    // totals.incomingBase is base salary, salaryIn is matching-adjusted
    incomingBaseSalary:
      teamResult.calculations?.salaryIn ?? teamResult.salaryIn ?? 0,
    // CANONICAL: Use official selector for matching salary
    incomingMatchingSalary: officialSnapshot.salaryIn ?? 0,

    // Salary matching evaluation (explicit rule results)
    // These are the "golden numbers" that affect trade legality
    // CANONICAL: All salary matching values from official selector
    allowableIncoming: officialSnapshot.allowableIncoming, // null means "not applicable"
    effectiveAllowableIncoming: officialSnapshot.effectiveAllowableIncoming,
    hardCapIncomingCeiling: officialSnapshot.hardCapIncomingCeiling,
    // Canonical UI display value: hard-cap-aware when effective ceiling exists
    displayAllowableIncoming: officialSnapshot.displayAllowableIncoming,
    hardCapType: officialSnapshot.hardCapType,
    hardCapLimiterLabel: officialSnapshot.hardCapLimiterLabel,
    isHardCapped: officialSnapshot.isHardCapped,

    // Explicit applicability tracking (Phase: Allowable Incoming N/A Consistency)
    salaryMatchingApplicable:
      teamResult.rules?.salaryMatching?.applicable ?? true,
    salaryMatchingSkipReason: officialSnapshot.skipReason,

    // CANONICAL: Rule and formula from official selector
    salaryMatchingRule: officialSnapshot.ruleApplied ?? 'unknown',
    salaryMatchingFormula: officialSnapshot.formulaUsed ?? '',
    margin:
      teamResult.rules?.salaryMatching?.margin ??
      teamResult.calculations?.salaryMatching?.margin ??
      null, // DO NOT default to 0 — null means "not applicable"
    // CANONICAL: Passed status from official selector
    salaryMatchingPassed: officialSnapshot.passed ?? false,

    // Post-trade projections (see Definition Gate for what this includes)
    projectedSalary: teamResult.projectedSalary ?? 0,

    // Hard cap rule (explicit validator fact — safe to expose)
    hardCapTriggered:
      teamResult.rules?.hardCap?.triggered ?? teamResult.hardCapped ?? false,

    // Violations (from existing validator output)
    violations: teamResult.violations ?? [],

    // Legality for this team
    legal: teamResult.legal ?? false,

    // Cap room (computed by validator)
    capRoom: teamResult.capRoom ?? 0,

    // NOTE: isOverCap, isFirstApron, isSecondApron are DEFERRED to Phase 2/3
    // These flags have unclear semantics; prefer explicit rule checks instead
  };
}

/**
 * Get a snapshot by team index instead of teamId.
 * Useful when you know the position but not the ID.
 *
 * @param {number} teamIndex - The index in the teamResults array
 * @param {Object} result - The validator result object from validateTrade()
 * @returns {Object|null} Team snapshot with legality-affecting values, or null if not available
 */
export function getTeamSnapshotByIndex(teamIndex, result) {
  if (!result || teamIndex == null || teamIndex < 0) return null;

  const teamResult = result.teamResults?.[teamIndex];
  if (!teamResult) return null;

  // Delegate to the main function after getting teamId
  return getTeamSnapshot(teamResult.teamId, result);
}

/**
 * Global trade snapshot accessor for trade-wide values.
 *
 * @param {Object} result - The validator result object from validateTrade()
 * @returns {Object|null} Trade snapshot with global values, or null if not available
 */
export function getTradeSnapshot(result) {
  if (!result) return null;

 return {
    // Overall trade legality
    isLegal: result.legal ?? false,
    primaryViolation: result.reason ?? null,

    // Year/season context
    yearKey: result.yearKey ?? null,
    seasonKey: result.seasonKey ?? null,

    // Cap settings (global metadata — not a per-team legality value)
    capSettings: result.capSettings ?? null,

    // All violations from canonical validator result
    allViolations:
      result.violations ??
      result.teamResults?.flatMap((tr) => tr.violations ?? []) ??
      [],

    // Performance metadata
    validationTime: result.performance?.validationTime ?? 0,
  };
}
