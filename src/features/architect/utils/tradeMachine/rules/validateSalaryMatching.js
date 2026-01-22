/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 *
 * NOTE: This validator delegates to the unified salary matching rules module
 * (salaryMatchingRules.js) for all allowable incoming calculations to ensure
 * consistency between validation and UI display.
 *
 * Phase 4: Cap settings must be explicitly provided - no silent defaults
 */

import { formatCurrency } from '@/features/architect/utils/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus.js';
import { SECOND_APRON_SALARY_MISMATCH } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';

// Validator version for trade receipt tracking - bumped for TPE fix
export const SALARY_MATCHING_VERSION = '2.4.0'; // Fix: TPE per-player matching instead of pool

/**
 * Validates if a trade satisfies salary matching rules
 * @param {Object} team - The team context for validation
 * @param {Object} context - Additional context with salary and cap data
 * @returns {Object} Validation result with:
 *   - passed {boolean} - Whether validation passed
 *   - violations {string[]} - List of violation messages
 *   - salaryIn {number} - Incoming salary amount
 *   - salaryOut {number} - Outgoing salary amount
 *   - allowableIncoming {number} - Maximum allowable incoming salary
 *   - difference {number} - Difference between incoming and outgoing
 *   - message {string} - Summary message
 *   - details {Object} - Structured debugging info for trade receipt:
 *     - ruleApplied {string} - Rule code (UNDER_CAP, FIRST_APRON, SECOND_APRON, OVER_CAP_TIER_1/2/3, etc.)
 *     - formulaUsed {string} - Human-readable formula showing calculation
 *     - capSettings {Object} - Cap thresholds used {salaryCap, firstApron, secondApron}
 *     - capSettingsSource {string} - Source of cap settings
 *     - totalSalary {number} - Team's pre-trade total salary
 *     - totalSalarySource {string} - Source field for totalSalary
 *     - margin {number} - Difference between allowable and actual incoming
 */
export function validateSalaryMatching(team, context = {}) {
  // Handle null/undefined team input or empty objects first
  if (!team || typeof team !== 'object' || Object.keys(team).length === 0) {
    return {
      passed: false,
      applicable: false,
      skipReason: 'INVALID_INPUT',
      allowableIncoming: null,
      violations: ['Invalid team data provided for salary matching validation'],
      details: {
        ruleApplied: 'INVALID_INPUT',
        formulaUsed: 'N/A',
        capSettingsSource: 'N/A',
      },
    };
  }

  // Check hard cap status but DO NOT skip salary matching
  // Hard cap ceiling is enforced by validateHardCap separately
  // Salary matching rules are determined by team's SALARY POSITION, not hard cap status
  const isWorldless = !context.worldId;
  const hardCapStatus = getHardCapStatus(team, { isWorldless });
  // Store for informational purposes - passed through in result

  // Check cache first

  // Extract salary data from both context and team object (team object takes precedence for tests)
  const salaryOut = team.salaryOut ?? context.salaryOut ?? 0;
  const salaryIn = team.salaryIn ?? context.salaryIn ?? 0;
  const totalSalary =
    team.teamTotalSalary ?? context.totalSalary ?? team.team?.totalSalary ?? 0;

  // Projected salary for apron-crossing detection (set by tradeValidator.js)
  const projectedSalary =
    team.projectedSalary ?? totalSalary - salaryOut + salaryIn;

  // Track the source of totalSalary for debugging
  const totalSalarySource =
    team.teamTotalSalary !== undefined
      ? 'team.teamTotalSalary'
      : context.totalSalary !== undefined
        ? 'context.totalSalary'
        : 'team.team.totalSalary';

  // Extract cap settings from team context or provided context
  const teamCapSettings = team.context?.capSettings || {};
  const contextCapSettings = context.capSettings || {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  // Track the source of cap settings for debugging
  let capSettingsSource = 'context.capSettings';
  if (Object.keys(teamCapSettings).length > 0) {
    capSettingsSource = 'team.context.capSettings';
  } else if (context.capSettingsSource) {
    capSettingsSource = context.capSettingsSource;
  }

  // Phase 4: Validate cap settings are present - emit warning if using fallback
  const capSettingsWarnings = [];
  const {
    salaryCap = 0,
    firstApron = 0,
    apron = 0, // alias for firstApron
    secondApron = 0,
  } = capSettings;

  // Check if cap settings are missing or invalid
  const hasSalaryCap = salaryCap > 0;
  const hasFirstApron = firstApron > 0 || apron > 0;
  const hasSecondApron = secondApron > 0;

  if (!hasSalaryCap || !hasFirstApron || !hasSecondApron) {
    // Log warning in development mode
    if (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV) {
      console.warn(
        '[validateSalaryMatching] Missing cap settings:',
        { salaryCap, firstApron, apron, secondApron },
        'source:',
        capSettingsSource
      );
    }
    capSettingsWarnings.push(
      `Cap settings incomplete (salaryCap: ${hasSalaryCap}, firstApron: ${hasFirstApron}, secondApron: ${hasSecondApron}). ` +
        `Validation may be inaccurate.`
    );
  }

  // Use firstApron if apron is not set
  const actualFirstApron = firstApron || apron;

  const violations = [];
  let allowableIncoming = 0; // Initialize allowable incoming calculation
  let ruleApplied = '';
  let formulaUsed = '';

  // Check FA exception bucket limits first
  if (team.absorptionMode === 'FA_EXCEPTION' && team.bucketType) {
    const buckets = team.team?.faExceptionBuckets || [];
    const bucket = buckets.find((b) => b.type === team.bucketType);
    if (!bucket || salaryIn > (bucket.remaining || 0)) {
      const bucketSize = bucket ? formatCurrency(bucket.remaining || 0) : '$0';
      violations.push(
        `FA Exception bucket insufficient (${bucketSize} remaining)`
      );
    }
    // FA exception bypasses regular salary matching - return early with explicit non-applicable state
    return {
      passed: violations.length === 0,
      applicable: false,
      skipReason: 'FA_EXCEPTION',
      allowableIncoming: null,
      salaryIn,
      salaryOut,
      difference: salaryIn - salaryOut,
      message: violations.length
        ? violations[0]
        : 'FA exception absorption validated',
      violations,
      details: {
        ruleApplied: 'FA_EXCEPTION',
        formulaUsed: `bucket.remaining (${team.bucketType})`,
        bucketRemaining: bucket ? bucket.remaining || 0 : 0,
        capSettingsSource: 'N/A (FA exception bypass)',
      },
    };
  }

  // ============================================================================
  // TPE PER-PLAYER MATCHING (CBA FIX)
  // Each TPE must cover 100% of its assigned player(s). Leftover TPE capacity
  // does NOT contribute to matching other players.
  // TPE-absorbed salary is EXCLUDED from salary matching (effectiveSalaryIn).
  // ============================================================================
  const incomingPlayers = team.incomingPlayers || team.receives || [];

  // Check if any incoming player has absorptionMode='TPE' - if so, need TPE processing
  const hasTPEPlayers = incomingPlayers.some(
    (p) => p.absorptionMode === 'TPE' || p.tpeId
  );

  // Get available TPEs from appliedTPEs or team's tradeExceptions
  const appliedTPEs = team.appliedTPEs || [];
  const availableTPEs =
    appliedTPEs.length > 0
      ? appliedTPEs
      : (team.team?.tradeExceptions || []).filter((tpe) => !tpe.isUsed);

  // Track TPE-absorbed salary at outer scope for use in matching
  let tpeAbsorbedSalary = 0;

  if (hasTPEPlayers && availableTPEs.length > 0) {
    // Build TPE usage map: tpeId -> { tpe, assignedPlayers, totalAssigned }
    const tpeUsageMap = new Map();
    availableTPEs.forEach((tpe) => {
      tpeUsageMap.set(tpe.id, {
        tpe,
        amount: tpe.amount || 0,
        assignedPlayers: [],
        totalAssigned: 0,
      });
    });

    // Match incoming players to their assigned TPEs
    // Also handle absorptionMode='TPE' when tpeId is not explicitly set
    const tpeViolations = [];

    incomingPlayers.forEach((player) => {
      const playerSalary = player.salary || player.matchIncoming || 0;
      const isTPEAbsorbed = player.absorptionMode === 'TPE' || player.tpeId;

      if (!isTPEAbsorbed) return; // Skip players not using TPE

      // If player has explicit tpeId, use that
      if (player.tpeId && tpeUsageMap.has(player.tpeId)) {
        const usage = tpeUsageMap.get(player.tpeId);
        usage.assignedPlayers.push(player);
        usage.totalAssigned += playerSalary;
        tpeAbsorbedSalary += playerSalary;
        return;
      }

      // If player has absorptionMode='TPE' but no tpeId, auto-match to best available TPE
      if (player.absorptionMode === 'TPE') {
        // Find first TPE with enough remaining capacity
        let matched = false;
        for (const [tpeId, usage] of tpeUsageMap) {
          const remaining = usage.amount - usage.totalAssigned;
          if (remaining >= playerSalary) {
            usage.assignedPlayers.push(player);
            usage.totalAssigned += playerSalary;
            tpeAbsorbedSalary += playerSalary;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // No TPE large enough - still count as TPE absorbed but will flag violation
          tpeAbsorbedSalary += playerSalary;
          tpeViolations.push(
            `No TPE has sufficient capacity for ${player.name || 'player'} (${formatCurrency(playerSalary)})`
          );
        }
      }
    });

    // Validate each TPE covers 100% of its assigned players
    tpeUsageMap.forEach((usage, tpeId) => {
      if (usage.totalAssigned > usage.amount) {
        tpeViolations.push(
          `TPE ${tpeId} (${formatCurrency(usage.amount)}) insufficient for assigned players (${formatCurrency(usage.totalAssigned)})`
        );
      }
    });

    // If TPE violations exist, fail immediately
    if (tpeViolations.length > 0) {
      return {
        passed: false,
        applicable: true,
        violations: tpeViolations,
        salaryIn,
        salaryOut,
        allowableIncoming: null,
        message: tpeViolations[0],
        details: {
          ruleApplied: 'TPE_VALIDATION_FAILED',
          formulaUsed: 'Per-player TPE matching',
          tpeAbsorbedSalary,
          salaryNeedingMatch: salaryIn - tpeAbsorbedSalary,
          capSettingsSource,
        },
      };
    }

    // If all incoming salary is absorbed by TPEs, skip matching
    if (salaryIn - tpeAbsorbedSalary <= 0) {
      return {
        passed: true,
        applicable: false,
        skipReason: 'TPE_ABSORPTION',
        allowableIncoming: null,
        violations: [],
        salaryIn,
        salaryOut,
        tpeAbsorbedSalary,
        difference: salaryIn - salaryOut,
        message: 'Trade exceptions cover incoming salary',
        usingTPE: true,
        details: {
          ruleApplied: 'TPE_ABSORPTION',
          formulaUsed: 'Per-player TPE matching: all incoming covered',
          tpeCount: appliedTPEs.length,
          tpeAbsorbedSalary,
          capSettingsSource: 'N/A (TPE bypass)',
          capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
          totalSalary,
          totalSalarySource,
        },
      };
    }

    // Partial TPE coverage: continue to matching with reduced salaryIn
  }

  // Calculate effective salary for matching (excludes TPE-absorbed players)
  const effectiveSalaryIn = salaryIn - tpeAbsorbedSalary;

  // Under-cap teams can absorb salary up to the cap
  if (totalSalary < salaryCap) {
    // Use unified salary matching rules for calculation
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    const netAddition = effectiveSalaryIn - salaryOut;
    const remainingSpace = salaryCap - totalSalary;
    if (netAddition > remainingSpace) {
      violations.push(
        `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  }
  // Teams above second apron: strict 100% matching (cannot take back more than sent out)
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  // Also check apron-CROSSING trades: if projected salary > secondApron, restrictions apply
  else if (
    secondApron > 0 &&
    (totalSalary > secondApron || projectedSalary > secondApron)
  ) {
    // Use unified salary matching rules for calculation
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      apronStatus: 'SECOND_APRON',
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    if (effectiveSalaryIn > salaryOut) {
      violations.push(SECOND_APRON_SALARY_MISMATCH);
    }
  }
  // Teams above first apron: 100% matching (cannot take back more than sent out)
  else if (totalSalary >= actualFirstApron) {
    // Use unified salary matching rules for calculation
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      apronStatus: 'FIRST_APRON',
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    if (effectiveSalaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(effectiveSalaryIn - salaryOut)}. ` +
          `First apron teams cannot receive more salary than sent out.`
      );
    }
  }
  // Over-cap teams below first apron: use standard tiered matching rules
  else if (totalSalary > salaryCap) {
    // Use unified salary matching rules for calculation
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    // Check if team exceeds the allowed incoming salary
    if (effectiveSalaryIn > allowableIncoming) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(effectiveSalaryIn - allowableIncoming)}`
      );
    }
  }
  // Under-cap teams already handled above

  const result = {
    passed: violations.length === 0,
    applicable: true,
    skipReason: null,
    violations,
    salaryIn,
    salaryOut,
    allowableIncoming,
    difference: salaryIn - salaryOut,
    message: violations.length ? violations[0] : 'Salary matching validated',
    warningsOnly: shouldWarnOnly('salaryMatching') && violations.length > 0,
    // Phase 4: Include cap settings warnings in result
    warnings: capSettingsWarnings,
    // Structured details for trade receipt
    details: {
      ruleApplied: ruleApplied || 'UNKNOWN',
      formulaUsed: formulaUsed || 'Unknown formula',
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      capSettingsSource,
      capSettingsWarnings,
      totalSalary,
      totalSalarySource,
      // TPE info: tpeAbsorbedSalary excluded from effectiveSalaryIn
      tpeAbsorbedSalary: tpeAbsorbedSalary > 0 ? tpeAbsorbedSalary : null,
      effectiveSalaryIn: tpeAbsorbedSalary > 0 ? effectiveSalaryIn : null,
      margin: allowableIncoming - effectiveSalaryIn,
      // Include hard cap status for informational purposes (ceiling enforced by validateHardCap)
      hardCapStatus: hardCapStatus.isHardCapped ? hardCapStatus : null,
    },
  };

  // Cache the result

  return result;
}
