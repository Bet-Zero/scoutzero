/**
 * Type definitions for Player Rules Profile
 *
 * These are JSDoc type definitions that serve as documentation
 * for the shapes of data used throughout the player rules system.
 *
 * @file src/features/architect/utils/playerRulesProfile/types.js
 */

/**
 * @typedef {Object} LeagueContext
 * @property {string} currentSeason - Current season code (e.g., "2024-25")
 * @property {number} currentYear - End year of current season (e.g., 2025)
 * @property {Date} [simulationDate] - Simulated date for rules evaluation
 * @property {string} [leaguePhase] - Current league phase ('offseason', 'regular', 'playoffs')
 * @property {Object} capSettings - Cap settings for the current season
 * @property {number} capSettings.salaryCap - Salary cap amount
 * @property {number} capSettings.firstApron - First apron threshold
 * @property {number} capSettings.secondApron - Second apron threshold
 * @property {number} capSettings.taxLine - Luxury tax line
 * @property {number} [capSettings.averageSalary] - Estimated average player salary
 */

/**
 * @typedef {Object} TeamContext
 * @property {string} teamCode - Team code (e.g., "LAL")
 * @property {number} [teamSalary] - Current team salary
 * @property {boolean} [isOverCap] - Whether team is over the salary cap
 * @property {boolean} [isOverTax] - Whether team is over the tax line
 * @property {boolean} [isHardCapped] - Whether team is hard capped
 * @property {string} [apronStatus] - Apron status ('UNDER_CAP', 'OVER_CAP', 'ABOVE_FIRST_APRON', 'ABOVE_SECOND_APRON')
 */

/**
 * @typedef {Object} ExtensionEligibility
 * @property {boolean} isEligible - Whether the player is extension-eligible
 * @property {string} reason - Human-readable explanation
 * @property {Date} [eligibleDate] - Date when player becomes eligible (if not currently eligible)
 * @property {string[]} [blockers] - List of conditions blocking eligibility
 */

/**
 * @typedef {Object} ExtensionTerms
 * @property {number} maxYears - Maximum extension length in years
 * @property {number} maxFirstYearSalary - Maximum salary in first year of extension
 * @property {number} [minFirstYearSalary] - Minimum salary in first year of extension
 * @property {number} raisePercentage - Annual raise percentage (e.g., 0.08 for 8%)
 * @property {string} extensionType - Type of extension ('Rookie', 'Veteran', 'Designated Veteran', 'Trade')
 * @property {string} basedOn - Explanation of how terms were calculated
 * @property {string} [notes] - Additional notes or conditions
 */

/**
 * @typedef {Object} BirdRightsInfo
 * @property {string} type - Bird rights type ('None', 'Non-Bird', 'Early Bird', 'Full Bird')
 * @property {number} yearsWithTeam - Years of continuous service with current team
 * @property {string} summary - Human-readable summary of Bird rights implications
 * @property {Object} signingAbilities - What signing mechanisms are available
 * @property {boolean} signingAbilities.canSignOverCap - Can team sign player while over cap
 * @property {number} [signingAbilities.maxFirstYearSalary] - Max first year salary using Bird rights
 * @property {number} [signingAbilities.maxYears] - Max contract length using Bird rights
 * @property {number} [signingAbilities.raisePercentage] - Max annual raise percentage
 */

/**
 * @typedef {Object} RFAInfo
 * @property {boolean} isRFA - Whether player is/will be a restricted free agent
 * @property {boolean} qualifyingOfferEligible - Whether team can extend a qualifying offer
 * @property {number} [qualifyingOfferAmount] - QO salary amount if applicable
 * @property {boolean} [canAcceptQO] - Whether player can still accept QO (timing-based)
 * @property {Date} [qoDeadline] - Deadline to accept QO
 * @property {string} reason - Explanation of RFA status
 * @property {boolean} [teamHasMatchingRights] - Whether team holds matching rights
 */

/**
 * @typedef {Object} MaxSalaryInfo
 * @property {number} maxSalary - Maximum first-year salary for a new contract
 * @property {string} tier - Max salary tier ('25%', '30%', '35%')
 * @property {boolean} supermaxEligible - Whether player qualifies for supermax
 * @property {string} reason - Explanation of max determination
 */

/**
 * @typedef {Object} PlayerRulesProfile
 * @property {string} playerId - Player identifier
 * @property {string} playerName - Player display name
 * @property {string} evaluatedAt - ISO timestamp of evaluation
 * @property {string} evaluatedForSeason - Season code this profile applies to
 *
 * @property {ExtensionEligibility} extensionEligibility - Extension eligibility info
 * @property {ExtensionTerms} [extensionTerms] - Extension terms (if eligible)
 *
 * @property {BirdRightsInfo} birdRights - Bird rights classification
 *
 * @property {number} minimumSalary - Minimum salary based on years of service
 * @property {MaxSalaryInfo} maxSalary - Maximum salary info for new contracts
 *
 * @property {RFAInfo} restrictedFreeAgency - RFA status and qualifying offer info
 *
 * @property {Object} contractSummary - Summary of current contract situation
 * @property {number} contractSummary.yearsOfService - Total years of NBA service
 * @property {number} contractSummary.yearsRemaining - Years remaining on current contract
 * @property {number|null} contractSummary.freeAgencyYear - Year player becomes a free agent
 * @property {string} contractSummary.freeAgencyType - Type of free agency ('UFA', 'RFA')
 * @property {number} [contractSummary.currentSalary] - Current season salary
 */

// Export empty object to make this a valid ES module
export default {};
