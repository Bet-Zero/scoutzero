/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 */

import {
  getApronStatus,
  formatCurrency,
} from '@/utils/architect/tradeHelpers.js';
import {
  getValidationFlag,
  shouldBlockTrade,
  shouldWarnOnly,
} from '@/config/validationFlags.js';
import { getAllowableIncomingMargin } from './salaryMargin.js';
import debug from '../debug.js';

/**
 * Validates if a trade satisfies salary matching rules
 * @param {Object} team - The team context for validation
 * @returns {Object} Validation result with passed/violations
 */
export function validateSalaryMatching(team) {
  // Get the enforcement level for salary matching
  const enforcementLevel = getValidationFlag('salaryMatching', 'error');

  // Skip validation if turned off
  if (enforcementLevel === 'off') {
    return {
      passed: true,
      violations: [],
      message: 'Salary matching validation skipped',
    };
  }

  const violations = [];
  const details = {};

  // Basic validation
  if (!team) {
    return {
      passed: false,
      violations: ['Invalid team data'],
      message: 'Invalid team data',
      details: 'Missing team object',
    };
  }

  // Check if team has required properties for meaningful validation
  if (
    !team.teamName &&
    !team.salaryIn &&
    !team.salaryOut &&
    !team.teamTotalSalary
  ) {
    return {
      passed: false,
      violations: ['Invalid team data'],
      message: 'Invalid team data',
      details: 'Team object missing required salary properties',
    };
  }

  const {
    salaryIn = 0,
    salaryOut = 0,
    teamTotalSalary = 0,
    context = {},
    teamName = 'Unknown Team',
  } = team;
  const { capSettings = {} } = context;
  const {
    salaryCap = 141000000,
    firstApron = 172346000,
    secondApron = 182794000,
  } = capSettings;

  // Log salary details for debugging
  if (debug.enabled) {
    debug.log(`💰 Salary Matching – ${teamName}`, {
      teamTotalSalary: formatCurrency(teamTotalSalary),
      salaryOut: formatCurrency(salaryOut),
      salaryIn: formatCurrency(salaryIn),
      salaryCap: formatCurrency(salaryCap),
      firstApron: formatCurrency(firstApron),
      secondApron: formatCurrency(secondApron),
      apronStatus: getApronStatus(teamTotalSalary, capSettings),
    });
  }

  // Check FA exception bucket limits first
  if (team.absorptionMode === 'FA_EXCEPTION' && team.bucketType) {
    const buckets = team.team?.faExceptionBuckets || [];
    const bucket = buckets.find((b) => b.type === team.bucketType);
    if (!bucket || salaryIn > (bucket.remaining || 0)) {
      const bucketSize = bucket ? formatCurrency(bucket.remaining || 0) : '$0';
      violations.push(
        `FA Exception bucket insufficient for incoming salary (${bucketSize} < ${formatCurrency(salaryIn)})`
      );
    }
  }

  // Simple case: taking back less salary is always allowed
  if (salaryIn <= salaryOut) {
    // No violations to add
  }
  // Under-cap teams can absorb any amount up to the cap
  else if (teamTotalSalary < salaryCap) {
    const remainingSpace = salaryCap - teamTotalSalary;
    const netAddition = salaryIn - salaryOut;

    if (netAddition > remainingSpace) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(netAddition - remainingSpace)}. ` +
          `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  }
  // Teams above second apron: strict 100% matching (cannot take back more than sent out)
  else if (teamTotalSalary >= secondApron) {
    if (salaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - salaryOut)}. ` +
          `Second apron teams cannot receive more salary than sent out.`
      );
    }
  }
  // Teams above first apron: 100% matching (cannot take back more than sent out)
  else if (teamTotalSalary >= firstApron) {
    if (salaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - salaryOut)}. ` +
          `First apron teams cannot receive more salary than sent out.`
      );
    }
  }
  // For over-cap teams below first apron: use standard tiered matching rules
  else {
    // First tier: 175% rule for salaries below $6.99M
    // Second tier: $11M + 50% rule for salaries above $6.99M
    // Simplified for this example as 120% matching
    const maxAllowableIncoming = salaryOut * 1.2; // 120% of outgoing salary

    if (salaryIn > maxAllowableIncoming) {
      const overBy = salaryIn - maxAllowableIncoming;
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(overBy)}. ` +
          `Over-cap team exceeds salary matching rules.`
      );
    }
  }

  // Special handling for teams at or above first apron
  if (team.postTradeStatus?.isAtOrAboveFirstApron) {
    if (team.salaryIn > team.salaryOut) {
      violations.push(
        `First apron team cannot take back more salary (incoming: ${formatCurrency(team.salaryIn)}, outgoing: ${formatCurrency(team.salaryOut)})`
      );
      details.firstApronViolation = {
        salaryIn: team.salaryIn,
        salaryOut: team.salaryOut,
        difference: team.salaryIn - team.salaryOut,
      };
    }
  }

  // Over-cap teams must satisfy salary matching rules
  if (team.teamTotalSalary > (team.context?.capSettings?.salaryCap || 0)) {
    // This only applies to teams not at first/second apron, which have stricter rules
    if (!team.postTradeStatus?.isAtOrAboveFirstApron) {
      // Calculate allowed incoming salary
      const margin = getAllowableIncomingMargin(team);
      const allowableIncoming = team.salaryOut + margin;

      // Check if team exceeds the allowed incoming salary
      if (team.salaryIn > allowableIncoming) {
        violations.push(
          `Team exceeds allowable incoming salary by ${formatCurrency(team.salaryIn - allowableIncoming)}`
        );
        details.marginViolation = {
          allowed: allowableIncoming,
          actual: team.salaryIn,
          margin,
          difference: team.salaryIn - allowableIncoming,
        };
      }
    }
  }

  // Generate details message
  const detailsMessage =
    violations.length > 0
      ? violations.join('\n')
      : `Valid salary exchange: ${formatCurrency(salaryOut)} out, ${formatCurrency(salaryIn)} in`;

  // If in warn mode, don't fail the validation but keep the violations
  const passed =
    violations.length === 0 ||
    (shouldWarnOnly('salaryMatching') && violations.length > 0);
  const warningsOnly =
    shouldWarnOnly('salaryMatching') && violations.length > 0;

  return {
    passed,
    violations,
    message: passed
      ? 'Salary matching validated'
      : 'Salary matching rules violated',
    details: detailsMessage,
    warningsOnly,
  };
}
