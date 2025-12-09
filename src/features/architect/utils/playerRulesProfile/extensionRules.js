/**
 * Extension Eligibility Rules
 *
 * Determines when a player is eligible for a contract extension
 * and what terms are available.
 *
 * Key Rules (from CBA_Article_7_RuleCards.md, Rule Cards 16-17):
 *
 * Veteran Extensions:
 * - 3-4 year contracts: extendable after 2 years
 * - 5-6 year contracts: extendable after 3 years
 * - Not extendable if shortened via ETO
 * - First-year extended salary capped at 140% of prior salary or avg player salary
 * - Designated Vet Extensions allowed up to max salary
 *
 * Rookie Scale Extensions:
 * - Eligible after 3rd season (in 4th year)
 * - Window: After Moratorium until before regular season of 4th year
 * - First-year salary capped at Rookie Scale max
 *
 * @file src/features/architect/utils/playerRulesProfile/extensionRules.js
 */

import { getYearsOfService } from './minimumSalaryRules.js';
import { checkSupermaxEligibility } from './maxSalaryRules.js';

/**
 * Extension type constants
 */
export const EXTENSION_TYPES = {
  ROOKIE: 'Rookie Scale Extension',
  VETERAN: 'Veteran Extension',
  DESIGNATED_VETERAN: 'Designated Veteran Extension',
  TRADE_RESTRICTED: 'Trade-Restricted Extension',
  INELIGIBLE: 'Not Eligible',
};

/**
 * Raise percentages by extension type
 */
const RAISE_PERCENTAGES = {
  standard: 0.08, // 8% for Bird rights
  nonBird: 0.05,  // 5% for non-Bird
  trade: 0.05,    // 5% for trade extensions
};

/**
 * Estimated average player salary (update annually with cap projections)
 * This is used as a floor for extension calculations
 * Reference: CBA_Article_7_RuleCards.md, Rule Card 16
 */
const ESTIMATED_AVERAGE_SALARY = 11_100_000;

/**
 * Compute extension eligibility for a player
 *
 * @param {Object} player - Player data object
 * @param {Object} leagueContext - League context
 * @param {string} leagueContext.currentSeason - Current season code
 * @param {number} leagueContext.currentYear - Current season end year
 * @param {Date} [leagueContext.simulationDate] - Simulated date for evaluation
 * @returns {Object} Extension eligibility information
 */
export function computeExtensionEligibility(player, leagueContext) {
  const currentYear = leagueContext?.currentYear || new Date().getFullYear();
  const simulationDate = leagueContext?.simulationDate || new Date();
  const contract = player?.contract;

  // Check for basic blocking conditions
  const blockers = [];

  // Must have a contract
  if (!contract) {
    return {
      isEligible: false,
      reason: 'No active contract',
      blockers: ['No contract data available'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  // Two-way contracts not eligible
  if (contract.contractType === 'TwoWay' || contract.contractType === 'Two-Way') {
    return {
      isEligible: false,
      reason: 'Two-way contracts cannot be extended',
      blockers: ['Two-way contract'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  // Check if used Early Termination Option (ETO blocks extensions)
  if (player.usedETO) {
    return {
      isEligible: false,
      reason: 'Cannot extend contract after using Early Termination Option',
      blockers: ['Used Early Termination Option'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  // Check timing from last renegotiation (must wait 3 years after >10% increase)
  if (player.lastRenegotiatedDate) {
    const renegotiatedDate = new Date(player.lastRenegotiatedDate);
    const monthsSinceRenegotiation = getMonthsBetween(renegotiatedDate, simulationDate);
    if (monthsSinceRenegotiation < 36) {
      const monthsRemaining = 36 - monthsSinceRenegotiation;
      blockers.push(`Must wait ${Math.ceil(monthsRemaining)} more months after renegotiation`);
    }
  }

  // Check timing from recent trade (6-month restriction)
  if (player.lastTradedDate) {
    const tradedDate = new Date(player.lastTradedDate);
    const monthsSinceTrade = getMonthsBetween(tradedDate, simulationDate);
    if (monthsSinceTrade < 6) {
      const monthsRemaining = 6 - monthsSinceTrade;
      blockers.push(`Cannot extend within ${Math.ceil(monthsRemaining)} months of being traded`);
    }
  }

  // Determine extension type and specific eligibility
  if (contract.isRookieScale || contract.contractType === 'Rookie Scale') {
    return computeRookieExtensionEligibility(player, contract, currentYear, blockers);
  }

  return computeVeteranExtensionEligibility(player, contract, currentYear, simulationDate, blockers);
}

/**
 * Compute rookie scale extension eligibility
 *
 * Rookie Scale Extension Rules:
 * - Eligible to extend in 4th year window
 * - Window opens after Moratorium (July)
 * - Window closes before regular season start (~Oct 15)
 *
 * @param {Object} player - Player data
 * @param {Object} contract - Contract data
 * @param {number} currentYear - Current season end year
 * @param {string[]} blockers - Existing blockers
 * @returns {Object} Extension eligibility
 */
function computeRookieExtensionEligibility(player, contract, currentYear, blockers) {
  const draftYear = player.bio?.draftYear || player.draftYear;

  if (!draftYear) {
    return {
      isEligible: false,
      reason: 'Cannot determine draft year for rookie extension timing',
      blockers: [...blockers, 'Missing draft year'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  const draftYearNum = parseInt(draftYear, 10);
  const extensionYear = draftYearNum + 4; // Extension window in 4th season (e.g., drafted 2021, extension window 2024-25 season)

  // Check if in extension window
  if (currentYear < extensionYear) {
    const yearsUntilEligible = extensionYear - currentYear;
    return {
      isEligible: false,
      reason: `Rookie extensions available starting ${extensionYear - 1}-${String(extensionYear).slice(-2)} season (${yearsUntilEligible} year${yearsUntilEligible > 1 ? 's' : ''} away)`,
      blockers: [...blockers, `Not yet in extension window`],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
      eligibleDate: new Date(extensionYear - 1, 6, 1), // July 1 of extension year
    };
  }

  if (currentYear > extensionYear) {
    return {
      isEligible: false,
      reason: 'Rookie extension window has passed',
      blockers: [...blockers, 'Extension window closed'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  // In the extension window
  if (blockers.length > 0) {
    return {
      isEligible: false,
      reason: `Blocked: ${blockers.join('; ')}`,
      blockers,
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  return {
    isEligible: true,
    reason: 'Eligible for rookie scale extension',
    blockers: [],
    extensionType: EXTENSION_TYPES.ROOKIE,
  };
}

/**
 * Compute veteran extension eligibility
 *
 * Veteran Extension Rules:
 * - 3-4 year contracts: extendable after 2 years elapsed
 * - 5-6 year contracts: extendable after 3 years elapsed
 * - Must not have used ETO
 *
 * @param {Object} player - Player data
 * @param {Object} contract - Contract data
 * @param {number} currentYear - Current season end year
 * @param {Date} simulationDate - Current date for evaluation
 * @param {string[]} blockers - Existing blockers
 * @returns {Object} Extension eligibility
 */
function computeVeteranExtensionEligibility(player, contract, currentYear, simulationDate, blockers) {
  const originalLength = contract.originalLength || contract.contractLength || 0;
  const yearsElapsed = computeYearsElapsed(contract, currentYear);

  // Determine required years before extension
  let requiredYears;
  if (originalLength <= 2) {
    return {
      isEligible: false,
      reason: 'Contract must be 3+ years to be eligible for extension',
      blockers: [...blockers, `Contract length (${originalLength} years) too short`],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  } else if (originalLength <= 4) {
    requiredYears = 2;
  } else {
    requiredYears = 3;
  }

  // Check if enough time has elapsed
  if (yearsElapsed < requiredYears) {
    const yearsRemaining = requiredYears - yearsElapsed;
    const eligibleDate = computeExtensionEligibleDate(contract, requiredYears);
    return {
      isEligible: false,
      reason: `Must wait ${yearsRemaining} more year${yearsRemaining > 1 ? 's' : ''} - ${originalLength}-year contract requires ${requiredYears} years before extension`,
      blockers: [...blockers, `Only ${yearsElapsed} of ${requiredYears} required years elapsed`],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
      eligibleDate,
    };
  }

  // Check for other blockers
  if (blockers.length > 0) {
    return {
      isEligible: false,
      reason: `Blocked: ${blockers.join('; ')}`,
      blockers,
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  // Check if this is a trade-restricted extension
  if (player.lastTradedDate) {
    const tradedDate = new Date(player.lastTradedDate);
    const yearsSinceTrade = getMonthsBetween(tradedDate, simulationDate) / 12;
    if (yearsSinceTrade < 1) {
      return {
        isEligible: true,
        reason: 'Eligible for trade-restricted extension (reduced terms)',
        blockers: [],
        extensionType: EXTENSION_TYPES.TRADE_RESTRICTED,
      };
    }
  }

  // Check for Designated Veteran eligibility
  const supermaxCheck = checkSupermaxEligibility(player, { currentYear });
  if (supermaxCheck.isEligible && !supermaxCheck.isRookieExtensionBoost) {
    return {
      isEligible: true,
      reason: 'Eligible for Designated Veteran Extension (supermax)',
      blockers: [],
      extensionType: EXTENSION_TYPES.DESIGNATED_VETERAN,
    };
  }

  return {
    isEligible: true,
    reason: 'Eligible for veteran extension',
    blockers: [],
    extensionType: EXTENSION_TYPES.VETERAN,
  };
}

/**
 * Compute extension terms based on eligibility
 *
 * @param {Object} player - Player data object
 * @param {Object} leagueContext - League context
 * @param {Object} [eligibility] - Pre-computed eligibility (optional)
 * @returns {Object|null} Extension terms or null if not eligible
 */
export function computeExtensionTerms(player, leagueContext, eligibility = null) {
  const extEligibility = eligibility || computeExtensionEligibility(player, leagueContext);

  if (!extEligibility.isEligible) {
    return null;
  }

  const { capSettings = {} } = leagueContext || {};
  const salaryCap = capSettings.salaryCap || 140_588_000;
  const contract = player?.contract;

  switch (extEligibility.extensionType) {
    case EXTENSION_TYPES.ROOKIE:
      return computeRookieExtensionTerms(player, salaryCap, leagueContext);

    case EXTENSION_TYPES.DESIGNATED_VETERAN:
      return computeDesignatedVeteranTerms(player, salaryCap);

    case EXTENSION_TYPES.TRADE_RESTRICTED:
      return computeTradeRestrictedTerms(player, contract);

    case EXTENSION_TYPES.VETERAN:
    default:
      return computeVeteranExtensionTerms(player, contract, salaryCap);
  }
}

/**
 * Compute rookie extension terms
 *
 * @param {Object} player - Player data
 * @param {number} salaryCap - Salary cap
 * @param {Object} leagueContext - League context
 * @returns {Object} Extension terms
 */
function computeRookieExtensionTerms(player, salaryCap, leagueContext) {
  // Check for Higher Max criteria
  const supermaxCheck = checkSupermaxEligibility(player, leagueContext);
  let maxPercent = 0.25; // Base rookie max
  let notes = 'Standard rookie extension max';

  if (supermaxCheck.isEligible) {
    // Higher Max for All-NBA/MVP/DPOY
    maxPercent = 0.30;
    notes = 'Higher Max - All-NBA/MVP/DPOY selection';
  }

  const maxFirstYearSalary = Math.round(salaryCap * maxPercent);

  return {
    maxYears: 5, // Rookie extensions can be up to 5 years
    maxFirstYearSalary,
    minFirstYearSalary: Math.round(salaryCap * 0.25 * 0.8), // 80% of 25% max
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.ROOKIE,
    basedOn: `${Math.round(maxPercent * 100)}% of cap`,
    notes,
  };
}

/**
 * Compute Designated Veteran (supermax) extension terms
 *
 * @param {Object} player - Player data
 * @param {number} salaryCap - Salary cap
 * @returns {Object} Extension terms
 */
function computeDesignatedVeteranTerms(player, salaryCap) {
  const maxFirstYearSalary = Math.round(salaryCap * 0.35);

  return {
    maxYears: 5, // Designated Vet extensions are 5 years (total contract becomes 6)
    maxFirstYearSalary,
    minFirstYearSalary: null, // No minimum for designated vet
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.DESIGNATED_VETERAN,
    basedOn: '35% of cap (Designated Veteran)',
    notes: 'Meets All-NBA/MVP/DPOY criteria with 7+ years of service',
  };
}

/**
 * Compute trade-restricted extension terms
 *
 * Players traded within past year have reduced extension terms
 *
 * @param {Object} player - Player data
 * @param {Object} contract - Contract data
 * @returns {Object} Extension terms
 */
function computeTradeRestrictedTerms(player, contract) {
  const currentSalary = getCurrentSalary(contract);
  const maxFirstYearSalary = Math.round(currentSalary * 1.05); // 105% of current

  return {
    maxYears: 2,
    maxFirstYearSalary,
    minFirstYearSalary: currentSalary,
    raisePercentage: RAISE_PERCENTAGES.trade,
    extensionType: EXTENSION_TYPES.TRADE_RESTRICTED,
    basedOn: '105% of current salary',
    notes: 'Restricted due to recent trade - limited to 2 years at 105% raise',
  };
}

/**
 * Compute standard veteran extension terms
 *
 * @param {Object} player - Player data
 * @param {Object} contract - Contract data
 * @param {number} salaryCap - Salary cap
 * @returns {Object} Extension terms
 */
function computeVeteranExtensionTerms(player, contract, salaryCap) {
  const currentSalary = getCurrentSalary(contract);
  const averageSalary = ESTIMATED_AVERAGE_SALARY;

  // Max first year: 140% of current salary OR 140% of average salary, whichever is greater
  const maxFirstYearSalary = Math.round(
    Math.max(currentSalary * 1.40, averageSalary * 1.40)
  );

  // Also cap at max salary based on years of service
  const yearsOfService = getYearsOfService(player);
  let maxPercent = 0.25;
  if (yearsOfService >= 10) maxPercent = 0.35;
  else if (yearsOfService >= 7) maxPercent = 0.30;

  const maxSalary = Math.round(salaryCap * maxPercent);
  const effectiveMax = Math.min(maxFirstYearSalary, maxSalary);

  return {
    maxYears: 4,
    maxFirstYearSalary: effectiveMax,
    minFirstYearSalary: currentSalary,
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.VETERAN,
    basedOn: '140% of salary or average salary (capped at max for years of service)',
    notes: '',
  };
}

/**
 * Get current salary from contract
 *
 * @param {Object} contract - Contract data
 * @returns {number} Current salary
 */
function getCurrentSalary(contract) {
  if (!contract?.salariesByYear?.length) return 0;

  const currentYear = new Date().getFullYear();
  const currentSeason = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

  // Find current season salary
  const currentEntry = contract.salariesByYear.find(
    (entry) => entry.season === currentSeason
  );

  if (currentEntry) {
    return currentEntry.salary || currentEntry.capHit || 0;
  }

  // Fall back to first available salary
  return contract.salariesByYear[0]?.salary || contract.salariesByYear[0]?.capHit || 0;
}

/**
 * Compute years elapsed on contract
 *
 * @param {Object} contract - Contract data
 * @param {number} currentYear - Current season end year
 * @returns {number} Years elapsed
 */
function computeYearsElapsed(contract, currentYear) {
  if (!contract) return 0;

  // Try to calculate from start season
  if (contract.startSeason) {
    const startYear = parseSeasonEndYear(contract.startSeason);
    if (startYear) {
      return currentYear - startYear;
    }
  }

  // Try to calculate from signing date
  if (contract.signingDate) {
    const signedYear = new Date(contract.signingDate).getFullYear();
    // Contracts signed before July are for the current season
    const signedMonth = new Date(contract.signingDate).getMonth();
    const effectiveStartYear = signedMonth >= 6 ? signedYear + 1 : signedYear;
    return currentYear - effectiveStartYear;
  }

  // Use contract length and years remaining
  if (contract.contractLength && contract.yearsRemaining) {
    return contract.contractLength - contract.yearsRemaining;
  }

  return 0;
}

/**
 * Parse season code to end year
 *
 * @param {string} season - Season code (e.g., "2024-25")
 * @returns {number|null} End year
 */
function parseSeasonEndYear(season) {
  if (!season) return null;

  if (/^\d{4}-\d{2}$/.test(season)) {
    const tail = parseInt(season.split('-')[1], 10);
    return 2000 + tail;
  }

  const year = parseInt(season, 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Compute the date when extension becomes eligible
 *
 * @param {Object} contract - Contract data
 * @param {number} requiredYears - Years required before extension
 * @returns {Date|null} Eligible date
 */
function computeExtensionEligibleDate(contract, requiredYears) {
  if (!contract?.signingDate) return null;

  const signedDate = new Date(contract.signingDate);
  const eligibleDate = new Date(signedDate);
  eligibleDate.setFullYear(eligibleDate.getFullYear() + requiredYears);

  return eligibleDate;
}

/**
 * Get months between two dates
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Months between dates
 */
function getMonthsBetween(startDate, endDate) {
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(0, months);
}
