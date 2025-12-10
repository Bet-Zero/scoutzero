/**
 * Compute Player Rules Profile
 *
 * Central entry point for computing all player-specific CBA rules.
 * This function aggregates results from all rule modules into a single
 * comprehensive PlayerRulesProfile object.
 *
 * Usage:
 * ```javascript
 * import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile';
 *
 * const profile = computePlayerRulesProfile(player, teamContext, leagueContext);
 * console.log(profile.extensionEligibility.isEligible);
 * console.log(profile.birdRights.type);
 * console.log(profile.minimumSalary);
 * ```
 *
 * @file src/features/architect/utils/playerRulesProfile/computeProfile.js
 */

import { computeExtensionEligibility, computeExtensionTerms } from '@/features/architect/utils/playerRulesProfile/extensionRules.js';
import { computeBirdRights } from '@/features/architect/utils/playerRulesProfile/birdRightsRules.js';
import { computeMinimumSalary, getYearsOfService } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules.js';
import { computeRFAStatus } from '@/features/architect/utils/playerRulesProfile/rfaRules.js';
import { computeMaxSalary } from '@/features/architect/utils/playerRulesProfile/maxSalaryRules.js';
import { parseSeasonEndYear } from '@/features/architect/utils/seasonUtils.js';
import { DEFAULT_AVERAGE_SALARY } from '@/features/architect/utils/cbaConstants.js';

/**
 * Default cap settings (2024-25 values)
 * These serve as fallbacks when cap settings are not provided
 */
const DEFAULT_CAP_SETTINGS = {
  salaryCap: 140_588_000,
  firstApron: 178_132_000,
  secondApron: 188_938_000,
  taxLine: 170_818_000,
  averageSalary: DEFAULT_AVERAGE_SALARY,
};

/**
 * Compute comprehensive player rules profile
 *
 * This is the main entry point for the player rules determination layer.
 * It computes all relevant CBA rules for a player and returns a structured
 * profile object.
 *
 * The function is pure and deterministic - given the same inputs,
 * it will always return the same output.
 *
 * @param {Object} player - Player data object
 * @param {string} player.playerId - Player identifier
 * @param {string} [player.displayName] - Player display name
 * @param {Object} [player.bio] - Player bio information
 * @param {Object} [player.contract] - Player contract data
 *
 * @param {Object} [teamContext] - Team context (optional)
 * @param {string} [teamContext.teamCode] - Team code
 * @param {number} [teamContext.teamSalary] - Current team salary
 * @param {boolean} [teamContext.isOverCap] - Whether team is over cap
 * @param {string} [teamContext.apronStatus] - Team's apron status
 *
 * @param {Object} [leagueContext] - League context
 * @param {string} [leagueContext.currentSeason] - Current season code (e.g., "2024-25")
 * @param {number} [leagueContext.currentYear] - Current season end year (e.g., 2025)
 * @param {Date} [leagueContext.simulationDate] - Simulated date for rules evaluation
 * @param {string} [leagueContext.leaguePhase] - Current league phase
 * @param {Object} [leagueContext.capSettings] - Cap settings
 *
 * @returns {Object} PlayerRulesProfile - Comprehensive rules profile
 */
export function computePlayerRulesProfile(player, teamContext = {}, leagueContext = {}) {
  // Validate input
  if (!player) {
    return createEmptyProfile('Unknown', 'No player data provided', leagueContext.simulationDate);
  }

  // Normalize league context with defaults
  const normalizedLeagueContext = normalizeLeagueContext(leagueContext);

  // Extract player identity
  const playerId = player.playerId || player.player_id || player.id || 'unknown';
  const playerName = player.displayName || player.name || playerId;

  // Compute all rule components
  const extensionEligibility = computeExtensionEligibility(player, normalizedLeagueContext);
  const extensionTerms = extensionEligibility.isEligible
    ? computeExtensionTerms(player, normalizedLeagueContext, extensionEligibility)
    : null;

  const birdRights = computeBirdRights(player, normalizedLeagueContext);
  const minimumSalaryInfo = computeMinimumSalary(player, normalizedLeagueContext);
  const maxSalaryInfo = computeMaxSalary(player, normalizedLeagueContext);
  const rfaStatus = computeRFAStatus(player, normalizedLeagueContext);

  // Build contract summary
  const contractSummary = buildContractSummary(player, normalizedLeagueContext.currentYear);

  // Assemble the complete profile
  return {
    // Identity
    playerId,
    playerName,
    evaluatedAt: (normalizedLeagueContext.simulationDate || new Date()).toISOString(),
    evaluatedForSeason: normalizedLeagueContext.currentSeason,

    // Extension eligibility and terms
    extensionEligibility: {
      isEligible: extensionEligibility.isEligible,
      reason: extensionEligibility.reason,
      blockers: extensionEligibility.blockers || [],
      extensionType: extensionEligibility.extensionType,
      eligibleDate: extensionEligibility.eligibleDate || null,
    },
    extensionTerms: extensionTerms ? {
      maxYears: extensionTerms.maxYears,
      maxFirstYearSalary: extensionTerms.maxFirstYearSalary,
      minFirstYearSalary: extensionTerms.minFirstYearSalary,
      raisePercentage: extensionTerms.raisePercentage,
      extensionType: extensionTerms.extensionType,
      basedOn: extensionTerms.basedOn,
      notes: extensionTerms.notes,
    } : null,

    // Bird rights
    birdRights: {
      type: birdRights.type,
      yearsWithTeam: birdRights.yearsWithTeam,
      summary: birdRights.summary,
      signingAbilities: birdRights.signingAbilities,
    },

    // Salary constraints
    minimumSalary: minimumSalaryInfo.minimumSalary,
    minimumSalaryReason: minimumSalaryInfo.reason,

    maxSalary: {
      maxSalary: maxSalaryInfo.maxSalary,
      tier: maxSalaryInfo.tier,
      supermaxEligible: maxSalaryInfo.supermaxEligible,
      reason: maxSalaryInfo.reason,
    },

    // Restricted free agency
    restrictedFreeAgency: {
      isRFA: rfaStatus.isRFA,
      qualifyingOfferEligible: rfaStatus.qualifyingOfferEligible,
      qualifyingOfferAmount: rfaStatus.qualifyingOfferAmount || null,
      canAcceptQO: rfaStatus.canAcceptQO || false,
      qoDeadline: rfaStatus.qoDeadline || null,
      teamHasMatchingRights: rfaStatus.teamHasMatchingRights || false,
      reason: rfaStatus.reason,
    },

    // Contract summary
    contractSummary,

    // Team context if provided
    teamContext: teamContext.teamCode ? {
      teamCode: teamContext.teamCode,
      isOverCap: teamContext.isOverCap || false,
      apronStatus: teamContext.apronStatus || null,
    } : null,
  };
}

/**
 * Normalize league context with defaults
 *
 * When simulationDate is provided, derive currentYear/currentSeason from it
 * to ensure all rules are evaluated for the correct league year.
 *
 * @param {Object} leagueContext - Raw league context
 * @returns {Object} Normalized league context
 */
function normalizeLeagueContext(leagueContext) {
  // Use simulationDate if provided, otherwise fall back to real-world time
  const effectiveDate = leagueContext.simulationDate || new Date();
  const defaultYear = getCurrentSeasonYear(effectiveDate);
  const defaultSeason = toSeasonCode(defaultYear);

  return {
    currentYear: leagueContext.currentYear || defaultYear,
    currentSeason: leagueContext.currentSeason || defaultSeason,
    simulationDate: effectiveDate,
    leaguePhase: leagueContext.leaguePhase || 'regular',
    capSettings: {
      ...DEFAULT_CAP_SETTINGS,
      ...leagueContext.capSettings,
    },
  };
}

/**
 * Build contract summary from player data
 *
 * @param {Object} player - Player data
 * @param {number} currentYear - Current season end year
 * @returns {Object} Contract summary
 */
function buildContractSummary(player, currentYear) {
  const contract = player?.contract;
  const yearsOfService = getYearsOfService(player);

  if (!contract) {
    return {
      yearsOfService,
      yearsRemaining: 0,
      freeAgencyYear: null,
      freeAgencyType: 'Unknown',
      currentSalary: null,
      hasContract: false,
    };
  }

  // Get years remaining
  let yearsRemaining = contract.yearsRemaining;
  if (yearsRemaining === undefined && contract.endSeason) {
    const endYear = parseSeasonEndYear(contract.endSeason);
    yearsRemaining = endYear ? Math.max(0, endYear - currentYear + 1) : 0;
  }

  // Get free agency info
  let freeAgencyYear = contract.freeAgency?.year;
  if (!freeAgencyYear && contract.endSeason) {
    freeAgencyYear = parseSeasonEndYear(contract.endSeason);
  }

  const freeAgencyType = contract.freeAgency?.type || 
    (yearsOfService < 4 ? 'Restricted' : 'Unrestricted');

  // Get current salary
  const currentSeason = toSeasonCode(currentYear);
  const currentSalaryEntry = contract.salariesByYear?.find(
    (entry) => entry.season === currentSeason
  );
  const currentSalary = currentSalaryEntry?.salary || currentSalaryEntry?.capHit || null;

  return {
    yearsOfService,
    yearsRemaining: yearsRemaining || 0,
    freeAgencyYear,
    freeAgencyType,
    currentSalary,
    hasContract: true,
    contractType: contract.contractType || 'Standard',
    isRookieScale: contract.isRookieScale || contract.contractType === 'Rookie Scale',
  };
}

/**
 * Create an empty profile for error cases
 *
 * @param {string} playerId - Player identifier
 * @param {string} reason - Reason for empty profile
 * @returns {Object} Empty profile
 */
function createEmptyProfile(playerId, reason, simulationDate = null) {
  const evalDate = simulationDate || new Date();
  return {
    playerId,
    playerName: playerId,
    evaluatedAt: evalDate.toISOString(),
    evaluatedForSeason: toSeasonCode(getCurrentSeasonYear(evalDate)),
    error: reason,

    extensionEligibility: {
      isEligible: false,
      reason,
      blockers: [reason],
      extensionType: 'Not Eligible',
      eligibleDate: null,
    },
    extensionTerms: null,

    birdRights: {
      type: 'None',
      yearsWithTeam: 0,
      summary: 'Unable to determine - ' + reason,
      signingAbilities: {
        canSignOverCap: false,
        maxYears: 4,
        raisePercentage: 0.05,
      },
    },

    minimumSalary: 0,
    minimumSalaryReason: reason,

    maxSalary: {
      maxSalary: 0,
      tier: 'Unknown',
      supermaxEligible: false,
      reason,
    },

    restrictedFreeAgency: {
      isRFA: false,
      qualifyingOfferEligible: false,
      qualifyingOfferAmount: null,
      canAcceptQO: false,
      qoDeadline: null,
      teamHasMatchingRights: false,
      reason,
    },

    contractSummary: {
      yearsOfService: 0,
      yearsRemaining: 0,
      freeAgencyYear: null,
      freeAgencyType: 'Unknown',
      currentSalary: null,
      hasContract: false,
    },

    teamContext: null,
  };
}

/**
 * Get current NBA season year
 *
 * NBA free agency and league year starts July 1:
 * - Before July 1: current season (e.g., May 2024 = 2023-24 = year 2024)
 * - July 1 or later: next season (e.g., July 2024 = 2024-25 = year 2025)
 *
 * Note: Regular season starts in October, but for CBA purposes,
 * the league year (free agency, extensions, etc.) begins July 1.
 *
 * @param {Date} date - Date to evaluate
 * @returns {number} Season end year
 */
function getCurrentSeasonYear(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 6 = Jul

  // July 1 is the start of the new league year
  return month >= 6 ? year + 1 : year;
}

/**
 * Convert end year to season code
 *
 * @param {number} endYear - End year (e.g., 2025)
 * @returns {string} Season code (e.g., "2024-25")
 */
function toSeasonCode(endYear) {
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}
