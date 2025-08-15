import { wouldExceedHardCap } from '@/utils/architect/hardCapUtils.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validationCache.js';
import debug from '../debug.js';

/**
 * Validates hard cap restrictions
 */
export function validateHardCap(team) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    salaryIn = 0,
    salaryOut = 0,
    projectedSalary,
  } = team;

  // Handle various context and cap settings structures
  const capSettings = team.capSettings || team.context?.capSettings || {};
  const { firstApron = 172000000, secondApron = 190000000 } = capSettings;

  // Check cache first - use projected salary as part of key since it affects the result
  const cacheKey = `${team.teamId}-${projectedSalary || 0}-${team.hardCapped || false}`;
  const cached = validationCache.getCachedHardCapStatus(cacheKey);
  if (cached) {
    return cached;
  }

  const finalProjectedSalary =
    projectedSalary || teamTotalSalary - salaryOut + salaryIn;

  // Check explicit hard cap flags from different test patterns
  const hasFirstApronHardCap =
    team.hardCapped === true || team.hardCapFirstApron?.active;
  const hasSecondApronHardCap =
    team.team?.hardCapTriggered === 'SecondApron' ||
    team.hardCapSecondApron?.active;

  if (debug.enabled) {
    debug.log(`🎯 Hard Cap Check`, {
      teamName: team.teamName,
      projectedSalary: formatCurrency(finalProjectedSalary),
      firstApron: formatCurrency(firstApron),
      secondApron: formatCurrency(secondApron),
      hasFirstApronHardCap,
      hasSecondApronHardCap,
    });
  }

  // Check if team is currently above second apron and would exceed salary out
  const isAboveSecondApron = teamTotalSalary >= secondApron;
  if (isAboveSecondApron && salaryIn > salaryOut) {
    violations.push(
      `Trade would exceed 2nd Apron hard cap by ${formatCurrency(salaryIn - salaryOut)}`
    );
  }

  // Check first apron hard cap violations
  if (hasFirstApronHardCap && finalProjectedSalary > firstApron) {
    violations.push(
      `Trade would exceed 1st Apron hard cap by ${formatCurrency(finalProjectedSalary - firstApron)}`
    );
  }

  // Check second apron hard cap violations
  if (hasSecondApronHardCap && finalProjectedSalary > secondApron) {
    violations.push(
      `Trade would exceed 2nd Apron hard cap by ${formatCurrency(finalProjectedSalary - secondApron)}`
    );
  }

  const result = {
    passed: violations.length === 0,
    violations,
    hardCapType: hasSecondApronHardCap
      ? 'SecondApron'
      : hasFirstApronHardCap
        ? 'FirstApron'
        : null,
    trigger: team.hardCapTrigger || null,
    projectedSalary: finalProjectedSalary,
  };

  // Cache the result
  validationCache.cacheHardCapStatus(cacheKey, result);

  return result;
}
