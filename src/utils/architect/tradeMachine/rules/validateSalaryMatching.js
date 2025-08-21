/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 */

import {
  getApronStatus,
  formatCurrency,
} from '@/utils/architect/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';

/**
 * Validates if a trade satisfies salary matching rules
 * @param {Object} team - The team context for validation
 * @param {Object} context - Additional context with salary and cap data
 * @returns {Object} Validation result with passed/violations
 */
export function validateSalaryMatching(team, context = {}) {
  // Handle null/undefined team input or empty objects first
  if (!team || typeof team !== 'object' || Object.keys(team).length === 0) {
    return {
      passed: false,
      violations: ['Invalid team data provided for salary matching validation'],
    };
  }

  // Check cache first
  const yearKey = context.yearKey || team.context?.yearKey || 2025;

  // Extract salary data from both context and team object (team object takes precedence for tests)
  const salaryOut = team.salaryOut ?? context.salaryOut ?? 0;
  const salaryIn = team.salaryIn ?? context.salaryIn ?? 0;
  const totalSalary =
    team.teamTotalSalary ?? context.totalSalary ?? team.team?.totalSalary ?? 0;

  // Use provided context or extract from team with safe navigation
  const teamName = team.teamName || team.team?.name || 'Unknown Team';

  // Extract cap settings from team context or provided context
  const teamCapSettings = team.context?.capSettings || {};
  const contextCapSettings = context.capSettings || {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  const {
    salaryCap = 141000000,
    firstApron = 178132000,
    apron = 178132000, // alias for firstApron
    secondApron = 188931000,
  } = capSettings;

  // Use firstApron if apron is not set
  const actualFirstApron = firstApron || apron;

  const violations = [];

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
      difference: salaryIn - salaryOut,
      message: 'Trade exception covers incoming salary',
      usingTPE: true,
    };

    return result;
  }

  // Under-cap teams can absorb salary up to the cap
  if (totalSalary < salaryCap) {
    const remainingSpace = salaryCap - totalSalary;
    const netAddition = salaryIn - salaryOut;
    if (netAddition > remainingSpace) {
      violations.push(
        `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  }
  // Teams above second apron: strict 100% matching (cannot take back more than sent out)
  else if (totalSalary >= secondApron) {
    if (salaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(salaryIn - salaryOut)}. ` +
          `Second apron teams cannot receive more salary than sent out.`
      );
    }
  }
  // Teams above first apron: 100% matching (cannot take back more than sent out)
  else if (totalSalary >= actualFirstApron) {
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
    let allowableIncoming = 0;

    if (salaryOut <= 6_500_000) {
      allowableIncoming = salaryOut * 2 + 250_000;
    } else if (salaryOut <= 19_600_000) {
      allowableIncoming = salaryOut + 5_000_000;
    } else {
      allowableIncoming = salaryOut * 1.25;
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
    difference: salaryIn - salaryOut,
    message: violations.length ? violations[0] : 'Salary matching validated',
    warningsOnly: shouldWarnOnly('salaryMatching') && violations.length > 0,
  };

  // Cache the result

  return result;
}
