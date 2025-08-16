/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 */

import {
  getApronStatus,
  formatCurrency,
} from '@/utils/architect/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';
import { getAllowableIncomingMargin } from './salaryMargin.js';
import { validationCache } from './validationCache.js';
import debug from '../debug.js';

/**
 * Validates if a trade satisfies salary matching rules
 * @param {Object} team - The team context for validation
 * @returns {Object} Validation result with passed/violations
 */
export function validateSalaryMatching(team) {
  if (!team || !team.context) {
    return {
      passed: false,
      violations: ['Invalid team data'],
      message: 'Invalid team data',
      details: 'Team object missing required properties',
    };
  }

  // Use provided yearKey or fall back to a default to avoid blocking tests
  const yearKey = team.context.yearKey || 'default';

  // Check cache first
  const cached = validationCache.getCachedSalaryMatch(team, yearKey);
  if (cached) {
    return cached;
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

  const violations = [];
  const details = {};

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
  }

  // Under-cap teams can absorb salary up to the cap
  if (teamTotalSalary < salaryCap) {
    const remainingSpace = salaryCap - teamTotalSalary;
    const netAddition = salaryIn - salaryOut;
    if (netAddition > remainingSpace) {
      violations.push(
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
  // Over-cap teams below first apron: use standard tiered matching rules
  else {
    const margin = getAllowableIncomingMargin(team);
    const allowableIncoming = salaryOut + margin;

    // Check if team exceeds the allowed incoming salary
    if (salaryIn > allowableIncoming) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(
          salaryIn - allowableIncoming
        )}`
      );
      details.marginViolation = {
        allowed: allowableIncoming,
        actual: salaryIn,
        margin,
        difference: salaryIn - allowableIncoming,
      };
    }
  }

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'Salary matching validated',
    details: Object.keys(details).length ? details : undefined,
    warningsOnly: shouldWarnOnly('salaryMatching') && violations.length > 0,
  };

  // Cache the result
  validationCache.cacheSalaryMatch(team, yearKey, result);

  return result;
}
