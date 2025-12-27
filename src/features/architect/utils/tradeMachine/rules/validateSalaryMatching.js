/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 */

import {
  formatCurrency,
} from '@/features/architect/utils/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';

// Validator version for trade receipt tracking
export const SALARY_MATCHING_VERSION = '1.0.0';

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
        capStatusSource: 'N/A',
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
        capStatusSource: 'team.hardCapped || team.team.hardCapTriggered',
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
  const capSettingsSource = Object.keys(teamCapSettings).length > 0 
    ? 'team.context.capSettings'
    : 'context.capSettings';

  const {
    salaryCap = 141000000,
    firstApron = 178132000,
    apron = 178132000, // alias for firstApron
    secondApron = 188931000,
  } = capSettings;

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
        capStatusSource: 'N/A (TPE bypass)',
        capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
        capSettingsSource,
        totalSalary,
        totalSalarySource,
      },
    };

    return result;
  }

  // Under-cap teams can absorb salary up to the cap
  if (totalSalary < salaryCap) {
    const remainingSpace = salaryCap - totalSalary;
    const netAddition = salaryIn - salaryOut;
    allowableIncoming = salaryOut + remainingSpace; // Can absorb outgoing + remaining cap space
    ruleApplied = 'UNDER_CAP';
    formulaUsed = `salaryOut + remainingSpace = ${formatCurrency(salaryOut)} + ${formatCurrency(remainingSpace)} = ${formatCurrency(allowableIncoming)}`;
    
    if (netAddition > remainingSpace) {
      violations.push(
        `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  }
  // Teams above second apron: strict 100% matching (cannot take back more than sent out)
  else if (totalSalary >= secondApron) {
    allowableIncoming = salaryOut; // 100% matching for second apron teams
    ruleApplied = 'SECOND_APRON';
    formulaUsed = `100% matching: allowableIncoming = salaryOut = ${formatCurrency(salaryOut)}`;
    
    if (salaryIn > salaryOut) {
      violations.push(
        `Second apron team cannot receive more salary than sent`
      );
    }
  }
  // Teams above first apron: 100% matching (cannot take back more than sent out)
  else if (totalSalary >= actualFirstApron) {
    allowableIncoming = salaryOut; // 100% matching for first apron teams
    ruleApplied = 'FIRST_APRON';
    formulaUsed = `100% matching: allowableIncoming = salaryOut = ${formatCurrency(salaryOut)}`;
    
    if (salaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - salaryOut)}. ` +
          `First apron teams cannot receive more salary than sent out.`
      );
    }
  }
  // Over-cap teams below first apron: use standard tiered matching rules
  else if (totalSalary > salaryCap) {
    // Calculate allowable incoming based on outgoing salary tiers
    if (salaryOut <= 6_500_000) {
      allowableIncoming = salaryOut * 2 + 250_000;
      ruleApplied = 'OVER_CAP_TIER_1';
      formulaUsed = `200% + $250k: (${formatCurrency(salaryOut)} × 2) + $250,000 = ${formatCurrency(allowableIncoming)}`;
    } else if (salaryOut <= 19_600_000) {
      allowableIncoming = salaryOut + 5_000_000;
      ruleApplied = 'OVER_CAP_TIER_2';
      formulaUsed = `100% + $5M: ${formatCurrency(salaryOut)} + $5,000,000 = ${formatCurrency(allowableIncoming)}`;
    } else {
      allowableIncoming = salaryOut * 1.25;
      ruleApplied = 'OVER_CAP_TIER_3';
      formulaUsed = `125%: ${formatCurrency(salaryOut)} × 1.25 = ${formatCurrency(allowableIncoming)}`;
    }

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
    // Structured details for trade receipt
    details: {
      ruleApplied: ruleApplied || 'UNKNOWN',
      formulaUsed: formulaUsed || 'Unknown formula',
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      capSettingsSource,
      totalSalary,
      totalSalarySource,
      margin: allowableIncoming - salaryIn,
    },
  };

  // Cache the result

  return result;
}
