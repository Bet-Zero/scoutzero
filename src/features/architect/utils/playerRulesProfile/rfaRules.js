/**
 * Restricted Free Agency Rules
 *
 * Determines RFA status and qualifying offer amounts.
 *
 * Key Rules (from CBA_Article_11_RuleCards.md):
 *
 * Qualifying Offer Requirements (Rule Card 2):
 * - 1 year, 100% protected for skill/injury
 * - Rookie Scale FAs: QO = 4th-year salary + % increase
 * - Two-Way FAs: QO varies by eligibility
 * - Other RFAs: QO = 135% (or 125% if pre-2023 contract) of prior salary
 *
 * Timing (Rule Cards 5-6):
 * - QO may be issued until June 29
 * - Player has until October 1 to accept QO
 * - Team may withdraw by July 13 without consent
 *
 * @file src/features/architect/utils/playerRulesProfile/rfaRules.js
 */

import { getYearsOfService, getMinimumSalaryScale } from './minimumSalaryRules.js';
import { parseSeasonEndYear } from '../seasonUtils.js';

/**
 * RFA status constants
 */
export const RFA_STATUS = {
  RFA: 'Restricted Free Agent',
  UFA: 'Unrestricted Free Agent',
  UNDER_CONTRACT: 'Under Contract',
  UNKNOWN: 'Unknown',
};

/**
 * Qualifying offer percentage by contract type
 */
const QO_PERCENTAGES = {
  rookieScale: 1.0, // QO equals 4th year salary + applicable increase
  veteran2023Plus: 1.35, // 135% for contracts signed 2023+
  veteranPre2023: 1.25, // 125% for pre-2023 contracts
  twoWay: 1.25, // 125% for two-way conversions
};

/**
 * Rookie scale QO percentage increases by draft position
 * Higher draft picks get larger percentage increases on their QO
 */
const ROOKIE_QO_INCREASES = {
  // Lottery picks (1-14)
  lottery: { percent: 0.30, positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  // Mid-first round (15-20)
  midFirst: { percent: 0.27, positions: [15, 16, 17, 18, 19, 20] },
  // Late first round (21-30)
  lateFirst: { percent: 0.25, positions: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  // Second round and undrafted
  other: { percent: 0.25 },
};

/**
 * Compute RFA status for a player
 *
 * RFA Requirements:
 * - Team must tender qualifying offer
 * - Typically applies to:
 *   - First-round picks completing rookie scale contracts
 *   - Players with ≤4 years of service on expiring contracts
 *
 * @param {Object} player - Player data object
 * @param {Object} leagueContext - League context
 * @param {number} leagueContext.currentYear - Current season end year
 * @param {Date} [leagueContext.simulationDate] - Simulated date
 * @param {string} [leagueContext.leaguePhase] - Current league phase
 * @returns {Object} RFA status information
 */
export function computeRFAStatus(player, leagueContext) {
  const currentYear = leagueContext?.currentYear;
  if (!currentYear) {
    return {
      isRFA: false,
      qualifyingOfferEligible: false,
      reason: 'Missing currentYear in leagueContext',
      status: RFA_STATUS.UNKNOWN,
    };
  }
  const contract = player?.contract;

  // Check if player is under contract
  if (!contract || !isContractExpiring(contract, currentYear)) {
    return {
      isRFA: false,
      qualifyingOfferEligible: false,
      reason: contract ? 'Contract not expiring this season' : 'No contract data',
      status: RFA_STATUS.UNDER_CONTRACT,
    };
  }

  // Check for existing free agency type from contract data
  const existingFAType = contract.freeAgency?.type;
  if (existingFAType) {
    if (/unrestricted|ufa/i.test(existingFAType)) {
      return {
        isRFA: false,
        qualifyingOfferEligible: false,
        reason: 'Player is an unrestricted free agent',
        status: RFA_STATUS.UFA,
      };
    }
    if (/restricted|rfa/i.test(existingFAType)) {
      // Compute QO details for known RFA
      const qoInfo = computeQualifyingOffer(player, leagueContext);
      return {
        isRFA: true,
        qualifyingOfferEligible: true,
        ...qoInfo,
        status: RFA_STATUS.RFA,
      };
    }
  }

  // Determine RFA eligibility based on years of service and contract type
  const yearsOfService = getYearsOfService(player);
  const isRookieScale = contract.isRookieScale || contract.contractType === 'Rookie Scale';

  // Players with 4+ years of service are UFAs
  if (yearsOfService >= 4 && !isRookieScale) {
    return {
      isRFA: false,
      qualifyingOfferEligible: false,
      reason: `${yearsOfService} years of service - unrestricted free agent`,
      status: RFA_STATUS.UFA,
    };
  }

  // Rookie scale players completing 4th year are RFA-eligible
  if (isRookieScale) {
    const draftYear = getDraftYear(player);
    const yearsOnRookieContract = draftYear ? currentYear - draftYear : yearsOfService;

    if (yearsOnRookieContract >= 4) {
      const qoInfo = computeQualifyingOffer(player, leagueContext);
      return {
        isRFA: true,
        qualifyingOfferEligible: true,
        ...qoInfo,
        reason: 'Completing rookie scale contract - eligible for qualifying offer',
        status: RFA_STATUS.RFA,
      };
    }
  }

  // Players with ≤3 years of service on non-rookie contracts
  if (yearsOfService <= 3) {
    const qoInfo = computeQualifyingOffer(player, leagueContext);
    return {
      isRFA: true,
      qualifyingOfferEligible: true,
      ...qoInfo,
      reason: `${yearsOfService} years of service - restricted free agent eligible`,
      status: RFA_STATUS.RFA,
    };
  }

  // Default to UFA
  return {
    isRFA: false,
    qualifyingOfferEligible: false,
    reason: 'Does not meet RFA criteria',
    status: RFA_STATUS.UFA,
  };
}

/**
 * Compute qualifying offer details
 *
 * @param {Object} player - Player data object
 * @param {Object} leagueContext - League context
 * @returns {Object} Qualifying offer information
 */
export function computeQualifyingOffer(player, leagueContext) {
  const currentYear = leagueContext?.currentYear || new Date().getFullYear();
  const simulationDate = leagueContext?.simulationDate || new Date();
  const contract = player?.contract;

  // Get prior salary for QO calculation
  const priorSalary = getPriorSalary(contract, currentYear);
  const isRookieScale = contract?.isRookieScale || contract?.contractType === 'Rookie Scale';

  let qualifyingOfferAmount;
  let qoMethod;

  if (isRookieScale) {
    // Rookie scale QO calculation
    const draftPick = getDraftPosition(player);
    const qoIncrease = getRookieQOIncrease(draftPick);
    qualifyingOfferAmount = Math.round(priorSalary * (1 + qoIncrease));
    qoMethod = `Rookie scale QO: ${(qoIncrease * 100).toFixed(0)}% increase on 4th year salary`;
  } else {
    // Veteran QO calculation
    const signingYear = getContractSigningYear(contract);
    const qoPercent = signingYear >= 2023 ? QO_PERCENTAGES.veteran2023Plus : QO_PERCENTAGES.veteranPre2023;
    qualifyingOfferAmount = Math.round(priorSalary * qoPercent);
    qoMethod = `Veteran QO: ${(qoPercent * 100).toFixed(0)}% of prior salary`;
  }

  // Ensure QO meets minimum salary
  const yearsOfService = getYearsOfService(player);
  const minSalaryScale = getMinimumSalaryScale(leagueContext?.currentSeason);
  const minimumSalary = minSalaryScale[Math.min(yearsOfService, 10)] || minSalaryScale[0];
  qualifyingOfferAmount = Math.max(qualifyingOfferAmount, minimumSalary);

  // Calculate timing
  const qoDeadline = computeQOAcceptanceDeadline(currentYear);
  const canAcceptQO = simulationDate < qoDeadline;

  return {
    qualifyingOfferAmount,
    qoMethod,
    priorSalary,
    canAcceptQO,
    qoDeadline,
    teamHasMatchingRights: true,
  };
}

/**
 * Check if contract is expiring in the current season
 *
 * @param {Object} contract - Contract data
 * @param {number} currentYear - Current season end year
 * @returns {boolean} True if expiring
 */
function isContractExpiring(contract, currentYear) {
  if (!contract) return false;

  // Check yearsRemaining
  if (contract.yearsRemaining !== undefined) {
    return contract.yearsRemaining <= 1;
  }

  // Check endSeason
  if (contract.endSeason) {
    const endYear = parseSeasonEndYear(contract.endSeason);
    return endYear === currentYear;
  }

  // Check free agency year
  if (contract.freeAgency?.year) {
    return contract.freeAgency.year === currentYear;
  }

  return false;
}

/**
 * Get player's draft year
 *
 * @param {Object} player - Player data
 * @returns {number|null} Draft year
 */
function getDraftYear(player) {
  const draftYear = player.bio?.draftYear || player.draftYear;
  if (!draftYear) return null;

  const year = parseInt(draftYear, 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Get player's draft position
 *
 * @param {Object} player - Player data
 * @returns {number|null} Draft position (1-60)
 */
function getDraftPosition(player) {
  const pick = player.bio?.draftPick || player.draftPick;
  if (pick) {
    const pickNum = parseInt(pick, 10);
    if (Number.isFinite(pickNum)) return pickNum;
  }
  return null;
}

/**
 * Get rookie QO percentage increase based on draft position
 *
 * @param {number|null} draftPosition - Draft position
 * @returns {number} Percentage increase (0.25-0.30)
 */
function getRookieQOIncrease(draftPosition) {
  if (!draftPosition) return ROOKIE_QO_INCREASES.other.percent;

  if (ROOKIE_QO_INCREASES.lottery.positions.includes(draftPosition)) {
    return ROOKIE_QO_INCREASES.lottery.percent;
  }
  if (ROOKIE_QO_INCREASES.midFirst.positions.includes(draftPosition)) {
    return ROOKIE_QO_INCREASES.midFirst.percent;
  }
  if (ROOKIE_QO_INCREASES.lateFirst.positions.includes(draftPosition)) {
    return ROOKIE_QO_INCREASES.lateFirst.percent;
  }

  return ROOKIE_QO_INCREASES.other.percent;
}

/**
 * Get prior season salary from contract
 *
 * @param {Object} contract - Contract data
 * @param {number} currentYear - Current season end year
 * @returns {number} Prior salary
 */
function getPriorSalary(contract, currentYear) {
  if (!contract?.salariesByYear?.length) return 0;

  const priorSeason = `${currentYear - 2}-${String(currentYear - 1).slice(-2)}`;
  const currentSeason = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

  // Try current season first (for QO based on final year salary)
  let salaryEntry = contract.salariesByYear.find((entry) => entry.season === currentSeason);

  if (!salaryEntry) {
    // Try prior season
    salaryEntry = contract.salariesByYear.find((entry) => entry.season === priorSeason);
  }

  if (!salaryEntry && contract.salariesByYear.length > 0) {
    // Use the last available salary
    const sorted = [...contract.salariesByYear].sort((a, b) => {
      const yearA = parseSeasonEndYear(a.season) || 0;
      const yearB = parseSeasonEndYear(b.season) || 0;
      return yearB - yearA;
    });
    salaryEntry = sorted[0];
  }

  return salaryEntry?.salary || salaryEntry?.capHit || 0;
}

/**
 * Get year contract was signed
 *
 * @param {Object} contract - Contract data
 * @returns {number|null} Signing year
 */
function getContractSigningYear(contract) {
  if (!contract) return null;

  if (contract.signingDate) {
    return new Date(contract.signingDate).getFullYear();
  }

  if (contract.startSeason) {
    const startYear = parseSeasonEndYear(contract.startSeason);
    return startYear ? startYear - 1 : null;
  }

  return null;
}

/**
 * Compute QO acceptance deadline
 *
 * Per CBA Article XI, Sec. 4(c): Player has until October 1 to accept QO
 * Note: Deadline is in Eastern Time per CBA, but we use midnight UTC
 * for simplicity in simulation context
 *
 * @param {number} currentYear - Current season end year
 * @returns {Date} QO acceptance deadline
 */
function computeQOAcceptanceDeadline(currentYear) {
  // October 1 of the offseason before the new season (UTC midnight)
  // For 2024-25 season (currentYear = 2025), deadline is Oct 1, 2024
  return new Date(Date.UTC(currentYear - 1, 9, 1, 23, 59, 59)); // Oct 1, 11:59:59 PM UTC
}
