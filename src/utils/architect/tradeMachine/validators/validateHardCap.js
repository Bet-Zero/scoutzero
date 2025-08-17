import { wouldExceedHardCap } from '@/utils/architect/hardCapUtils.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validationCache.js'; // Use the correct cache
import debug from '../debug.js';

/**
 * Validates hard cap restrictions
 */
export function validateHardCap(team, context = {}) {
  const violations = [];

  // Extract data from team object (tests pass data directly on team)
  const teamTotalSalary = team.team?.totalSalary || 0;
  const projectedSalary =
    team.projectedSalary ?? context.projectedSalary ?? teamTotalSalary;

  // Extract cap settings from team or context
  const teamCapSettings = team.capSettings || {};
  const contextCapSettings = context.capSettings || {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  const {
    firstApron = 178132000,
    apron = 178132000,
    secondApron = 188931000,
  } = capSettings;

  // Use firstApron if available, otherwise fall back to apron
  const actualFirstApron = firstApron || apron;

  // Check cache first
  const cached = validationCache.getCachedHardCapStatus(team, projectedSalary);
  if (cached) {
    return cached;
  }

  // Check if team is explicitly marked as hard capped at first apron
  const isHardCappedFirstApron = team.hardCapped === true;

  // Check if team has second apron hard cap triggered
  const isHardCappedSecondApron = team.team?.hardCapTriggered === 'SecondApron';

  // Check if team is above second apron threshold (automatic hard cap)
  const isAboveSecondApron = teamTotalSalary >= secondApron;

  if (debug.enabled) {
    debug.log(`🎯 Hard Cap Check`, {
      teamName: team.teamName,
      teamTotalSalary: formatCurrency(teamTotalSalary),
      projectedSalary: formatCurrency(projectedSalary),
      firstApron: formatCurrency(actualFirstApron),
      secondApron: formatCurrency(secondApron),
      isHardCappedFirstApron,
      isHardCappedSecondApron,
      isAboveSecondApron,
    });
  }

  // Teams with second apron hard cap triggered cannot exceed second apron
  if (isHardCappedSecondApron && projectedSalary > secondApron) {
    violations.push(
      `2nd Apron hard cap violation: Trade would exceed second apron hard-cap by ${formatCurrency(projectedSalary - secondApron)}`
    );
  }

  // Teams above second apron are automatically hard-capped and cannot exceed current salary
  if (isAboveSecondApron && projectedSalary > teamTotalSalary) {
    violations.push(`Second apron team cannot receive more salary than sent`);
  }

  // Teams explicitly hard-capped at first apron cannot exceed first apron
  if (isHardCappedFirstApron && projectedSalary > actualFirstApron) {
    violations.push(
      `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
    );
  }

  // Determine hard cap type
  let hardCapType = null;
  if (isHardCappedSecondApron || isAboveSecondApron) {
    hardCapType = 'SecondApron';
  } else if (isHardCappedFirstApron) {
    hardCapType = 'FirstApron';
  }

  const result = {
    passed: violations.length === 0,
    violations,
    hardCapType,
    projectedSalary,
  };

  // Cache the result
  validationCache.cacheHardCapStatus(team, projectedSalary, result);

  return result;
}
