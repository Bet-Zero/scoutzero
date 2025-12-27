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

import {
  formatCurrency,
} from '@/features/architect/utils/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js';

// Validator version for trade receipt tracking - bumped for Phase 4
export const SALARY_MATCHING_VERSION = '2.1.0'; // Phase 4: Explicit cap settings, no silent defaults

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
      violations: ['Invalid team data provided for salary matching validation'],
      details: {
        ruleApplied: 'INVALID_INPUT',
        formulaUsed: 'N/A',
        capSettingsSource: 'N/A',
      },
    };
  }

  // Skip salary matching validation for hard-capped teams - let hard cap validation handle it
  if (team.hardCapped === true || team.team?.hardCapTriggered) {
    return {
      passed: true,
      violations: [],
      message: 'Skipped for hard-capped team',
      skipped: true,
      details: {
        ruleApplied: 'HARD_CAP_SKIP',
        formulaUsed: 'Hard cap validation handles this team',
        capSettingsSource: 'team.hardCapped || team.team.hardCapTriggered',
      },
    };
  }

  // Check cache first

  // Extract salary data from both context and team object (team object takes precedence for tests)
  const salaryOut = team.salaryOut ?? context.salaryOut ?? 0;
  const salaryIn = team.salaryIn ?? context.salaryIn ?? 0;
  const totalSalary =
    team.teamTotalSalary ?? context.totalSalary ?? team.team?.totalSalary ?? 0;

  // Track the source of totalSalary for debugging
  const totalSalarySource = team.teamTotalSalary !== undefined 
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
  const hasFirstApron = (firstApron > 0 || apron > 0);
  const hasSecondApron = secondApron > 0;

  if (!hasSalaryCap || !hasFirstApron || !hasSecondApron) {
    // Log warning in development mode
    if (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV) {
      console.warn(
        '[validateSalaryMatching] Missing cap settings:',
        { salaryCap, firstApron, apron, secondApron },
        'source:', capSettingsSource
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
    // FA exception case
    allowableIncoming = bucket ? bucket.remaining || 0 : 0;
    ruleApplied = 'FA_EXCEPTION';
    formulaUsed = `bucket.remaining (${team.bucketType})`;
  }

  // Check if team is using TPEs to cover incoming salary
  const appliedTPEs = team.appliedTPEs || [];
  const totalTPEAmount = appliedTPEs.reduce(
    (sum, tpe) => sum + (tpe.amount || 0),
    0
  );

  // If using TPEs, skip salary matching validation since TPEs cover the incoming salary
  if (appliedTPEs.length > 0 && totalTPEAmount >= salaryIn) {
    const result = {
      passed: true,
      violations: [],
      salaryIn,
      salaryOut,
      allowableIncoming: totalTPEAmount,
      difference: salaryIn - salaryOut,
      message: 'Trade exception covers incoming salary',
      usingTPE: true,
      details: {
        ruleApplied: 'TPE_ABSORPTION',
        formulaUsed: `totalTPEAmount = sum(appliedTPEs.amount) = ${formatCurrency(totalTPEAmount)}`,
        tpeCount: appliedTPEs.length,
        capSettingsSource: 'N/A (TPE bypass)',
        capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
        totalSalary,
        totalSalarySource,
      },
    };

    return result;
  }

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
    
    const netAddition = salaryIn - salaryOut;
    const remainingSpace = salaryCap - totalSalary;
    if (netAddition > remainingSpace) {
      violations.push(
        `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  }
  // Teams above second apron: strict 100% matching (cannot take back more than sent out)
  else if (totalSalary >= secondApron) {
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
    
    if (salaryIn > salaryOut) {
      violations.push(
        `Second apron team cannot receive more salary than sent`
      );
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
    
    if (salaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - salaryOut)}. ` +
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
    if (salaryIn > allowableIncoming) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - allowableIncoming)}`
      );
    }
  }
  // Under-cap teams already handled above

  const result = {
    passed: violations.length === 0,
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
      margin: allowableIncoming - salaryIn,
    },
  };

  // Cache the result

  return result;
}
