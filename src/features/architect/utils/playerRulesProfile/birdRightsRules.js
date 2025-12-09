/**
 * Bird Rights Rules
 *
 * Determines Bird rights classification and signing capabilities.
 *
 * Bird Rights Categories:
 * - Full Bird: 3+ consecutive years with same team (can re-sign to max, up to 5 years, 8% raises)
 * - Early Bird: 2 consecutive years with same team (up to 175% of prior salary or 105% of avg salary, 4 years)
 * - Non-Bird: 1 year with team (up to 120% of prior salary or minimum, 4 years)
 * - None: No Bird rights (must sign with cap space or exception)
 *
 * Reference:
 * - CBA_Article_7_RuleCards.md, Rule Card 11 (Cap Holds)
 * - CBA_Article_11_RuleCards.md (Free Agency)
 *
 * @file src/features/architect/utils/playerRulesProfile/birdRightsRules.js
 */

/**
 * Bird rights type constants
 */
export const BIRD_RIGHTS_TYPES = {
  FULL: 'Full Bird',
  EARLY: 'Early Bird',
  NON_BIRD: 'Non-Bird',
  NONE: 'None',
};

/**
 * Bird rights configuration
 */
const BIRD_RIGHTS_CONFIG = {
  [BIRD_RIGHTS_TYPES.FULL]: {
    minYearsWithTeam: 3,
    maxContractYears: 5,
    raisePercentage: 0.08,
    canSignOverCap: true,
    maxSalaryBasis: 'max', // Can sign to max salary
  },
  [BIRD_RIGHTS_TYPES.EARLY]: {
    minYearsWithTeam: 2,
    maxContractYears: 4,
    raisePercentage: 0.08,
    canSignOverCap: true,
    maxSalaryBasis: 'earlyBird', // 175% of prior salary or 105% of avg salary
    capHoldMultiplier: 1.3,
  },
  [BIRD_RIGHTS_TYPES.NON_BIRD]: {
    minYearsWithTeam: 1,
    maxContractYears: 4,
    raisePercentage: 0.05,
    canSignOverCap: true,
    maxSalaryBasis: 'nonBird', // 120% of prior salary or minimum
    capHoldMultiplier: 1.2,
  },
  [BIRD_RIGHTS_TYPES.NONE]: {
    minYearsWithTeam: 0,
    maxContractYears: 4,
    raisePercentage: 0.05,
    canSignOverCap: false,
    maxSalaryBasis: 'capSpace', // Must have cap space
  },
};

/**
 * Compute Bird rights classification and signing abilities
 *
 * @param {Object} player - Player data object
 * @param {Object} [player.contract] - Player contract data
 * @param {Object} [player.contract.birdRights] - Existing Bird rights data
 * @param {Object} leagueContext - League context
 * @param {Object} leagueContext.capSettings - Cap settings
 * @param {number} leagueContext.currentYear - Current season end year
 * @returns {Object} Bird rights information
 */
export function computeBirdRights(player, leagueContext) {
  const { capSettings = {} } = leagueContext || {};
  const salaryCap = capSettings.salaryCap || 140_588_000;
  const averageSalary = capSettings.averageSalary || 11_100_000;

  // Try to get Bird rights from existing contract data
  const existingBirdRights = extractExistingBirdRights(player);

  if (existingBirdRights) {
    return buildBirdRightsInfo(
      existingBirdRights.type,
      existingBirdRights.yearsWithTeam,
      player,
      salaryCap,
      averageSalary
    );
  }

  // Compute Bird rights based on tenure
  const yearsWithTeam = computeYearsWithTeam(player);
  const birdRightsType = determineBirdRightsType(yearsWithTeam);

  return buildBirdRightsInfo(birdRightsType, yearsWithTeam, player, salaryCap, averageSalary);
}

/**
 * Extract existing Bird rights data from player contract
 *
 * @param {Object} player - Player data object
 * @returns {Object|null} Existing Bird rights data or null
 */
function extractExistingBirdRights(player) {
  const birdRights = player?.contract?.birdRights;

  if (!birdRights) return null;

  // Handle structured Bird rights object
  if (typeof birdRights === 'object') {
    const status = birdRights.status || birdRights.type;
    const normalizedType = normalizeBirdRightsType(status);

    return {
      type: normalizedType,
      yearsWithTeam: birdRights.yearsWithTeam || 0,
      yearsOfService: birdRights.yearsOfService || 0,
    };
  }

  // Handle string Bird rights
  if (typeof birdRights === 'string') {
    return {
      type: normalizeBirdRightsType(birdRights),
      yearsWithTeam: 0,
    };
  }

  return null;
}

/**
 * Normalize Bird rights type string to standard format
 *
 * @param {string} type - Bird rights type string
 * @returns {string} Normalized type
 */
function normalizeBirdRightsType(type) {
  if (!type) return BIRD_RIGHTS_TYPES.NONE;

  const normalized = String(type).toLowerCase();

  if (/full/i.test(normalized)) return BIRD_RIGHTS_TYPES.FULL;
  if (/early/i.test(normalized)) return BIRD_RIGHTS_TYPES.EARLY;
  if (/non[- ]?bird/i.test(normalized)) return BIRD_RIGHTS_TYPES.NON_BIRD;
  if (normalized === 'none' || normalized === 'null') return BIRD_RIGHTS_TYPES.NONE;

  // Default mapping for short forms
  if (normalized === 'bird') return BIRD_RIGHTS_TYPES.FULL;

  return BIRD_RIGHTS_TYPES.NONE;
}

/**
 * Compute years with current team from player data
 *
 * @param {Object} player - Player data object
 * @returns {number} Years with team
 */
function computeYearsWithTeam(player) {
  // Check multiple possible sources
  if (player?.contract?.birdRights?.yearsWithTeam) {
    return player.contract.birdRights.yearsWithTeam;
  }

  // Calculate from contract start if available
  if (player?.contract?.startSeason) {
    const startYear = parseSeasonYear(player.contract.startSeason);
    const currentYear = new Date().getFullYear();
    if (startYear) {
      return Math.max(0, currentYear - startYear);
    }
  }

  // Default to 0 if no data available
  return 0;
}

/**
 * Parse season code to extract year
 *
 * @param {string} season - Season code (e.g., "2024-25")
 * @returns {number|null} Start year or null
 */
function parseSeasonYear(season) {
  if (!season) return null;

  if (/^\d{4}-\d{2}$/.test(season)) {
    return parseInt(season.split('-')[0], 10);
  }

  const year = parseInt(season, 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Determine Bird rights type based on years with team
 *
 * @param {number} yearsWithTeam - Years of continuous service with team
 * @returns {string} Bird rights type
 */
function determineBirdRightsType(yearsWithTeam) {
  if (yearsWithTeam >= 3) return BIRD_RIGHTS_TYPES.FULL;
  if (yearsWithTeam >= 2) return BIRD_RIGHTS_TYPES.EARLY;
  if (yearsWithTeam >= 1) return BIRD_RIGHTS_TYPES.NON_BIRD;
  return BIRD_RIGHTS_TYPES.NONE;
}

/**
 * Build complete Bird rights information object
 *
 * @param {string} type - Bird rights type
 * @param {number} yearsWithTeam - Years with team
 * @param {Object} player - Player data
 * @param {number} salaryCap - Salary cap amount
 * @param {number} averageSalary - Average player salary
 * @returns {Object} Bird rights info
 */
function buildBirdRightsInfo(type, yearsWithTeam, player, salaryCap, averageSalary) {
  const config = BIRD_RIGHTS_CONFIG[type] || BIRD_RIGHTS_CONFIG[BIRD_RIGHTS_TYPES.NONE];
  const priorSalary = getLastSalary(player);

  const signingAbilities = computeSigningAbilities(type, config, priorSalary, salaryCap, averageSalary);

  return {
    type,
    yearsWithTeam,
    summary: buildBirdRightsSummary(type, signingAbilities),
    signingAbilities,
    config: {
      maxContractYears: config.maxContractYears,
      raisePercentage: config.raisePercentage,
      canSignOverCap: config.canSignOverCap,
    },
  };
}

/**
 * Compute signing abilities based on Bird rights type
 *
 * @param {string} type - Bird rights type
 * @param {Object} config - Bird rights configuration
 * @param {number} priorSalary - Player's prior salary
 * @param {number} salaryCap - Salary cap amount
 * @param {number} averageSalary - Average player salary
 * @returns {Object} Signing abilities
 */
function computeSigningAbilities(type, config, priorSalary, salaryCap, averageSalary) {
  const base = {
    canSignOverCap: config.canSignOverCap,
    maxYears: config.maxContractYears,
    raisePercentage: config.raisePercentage,
  };

  switch (type) {
    case BIRD_RIGHTS_TYPES.FULL:
      // Full Bird can sign to max salary
      return {
        ...base,
        maxFirstYearSalary: null, // Determined by max salary rules
        canSignToMax: true,
        method: 'Full Bird rights - can sign to max salary',
      };

    case BIRD_RIGHTS_TYPES.EARLY:
      // Early Bird: greater of 175% of prior salary or 105% of average salary
      const earlyBirdMax = Math.max(
        priorSalary * 1.75,
        averageSalary * 1.05
      );
      return {
        ...base,
        maxFirstYearSalary: Math.round(earlyBirdMax),
        canSignToMax: false,
        method: 'Early Bird rights - max of 175% prior salary or 105% average salary',
      };

    case BIRD_RIGHTS_TYPES.NON_BIRD:
      // Non-Bird: 120% of prior salary or minimum
      const nonBirdMax = priorSalary > 0 ? priorSalary * 1.20 : averageSalary * 0.5;
      return {
        ...base,
        maxFirstYearSalary: Math.round(nonBirdMax),
        canSignToMax: false,
        method: 'Non-Bird rights - up to 120% of prior salary',
      };

    default:
      // No Bird rights - needs cap space or exception
      return {
        ...base,
        maxFirstYearSalary: null,
        canSignToMax: false,
        method: 'No Bird rights - must use cap space or exception',
      };
  }
}

/**
 * Get player's last salary from contract data
 *
 * @param {Object} player - Player data
 * @returns {number} Last salary or 0
 */
function getLastSalary(player) {
  const salaries = player?.contract?.salariesByYear;

  if (!salaries?.length) return 0;

  // Sort by season and get most recent
  const sorted = [...salaries].sort((a, b) => {
    const yearA = parseSeasonYear(a.season) || 0;
    const yearB = parseSeasonYear(b.season) || 0;
    return yearB - yearA;
  });

  return sorted[0]?.salary || sorted[0]?.capHit || 0;
}

/**
 * Build human-readable Bird rights summary
 *
 * @param {string} type - Bird rights type
 * @param {Object} abilities - Signing abilities
 * @returns {string} Summary text
 */
function buildBirdRightsSummary(type, abilities) {
  switch (type) {
    case BIRD_RIGHTS_TYPES.FULL:
      return 'Full Bird rights holder - team can re-sign player to max salary exceeding cap for up to 5 years with 8% annual raises';

    case BIRD_RIGHTS_TYPES.EARLY:
      return `Early Bird rights holder - team can re-sign exceeding cap for up to 4 years at max ${formatCurrency(abilities.maxFirstYearSalary)} first year (175% of prior or 105% average)`;

    case BIRD_RIGHTS_TYPES.NON_BIRD:
      return `Non-Bird rights holder - team can re-sign exceeding cap for up to 4 years at max ${formatCurrency(abilities.maxFirstYearSalary)} first year (120% of prior)`;

    default:
      return 'No Bird rights - player must be signed using cap space or an exception';
  }
}

/**
 * Format currency for display
 *
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted string
 */
function formatCurrency(amount) {
  if (!amount) return '$0';
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
}
