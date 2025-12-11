/**
 * Minimum Salary Rules
 *
 * Determines minimum contract amounts based on years of service.
 * Based on CBA Exhibit C - Minimum Annual Salary Scale.
 *
 * Reference: CBA_Exhibit_B_RuleCards.md, Rule Card 2
 *
 * @file src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js
 */

/**
 * Minimum salary scale by years of service for 2024-25 season
 * These values are based on the CBA and should be updated annually
 *
 * Reference: Article II, Sec. 6 - Minimum Player Salary Rule
 */
export const MINIMUM_SALARY_SCALE = {
  '2024-25': {
    0: 1_119_563, // Rookie minimum
    1: 1_820_000,
    2: 2_092_400,
    3: 2_390_000,
    4: 2_600_000,
    5: 2_800_000,
    6: 3_000_000,
    7: 3_200_000,
    8: 3_400_000,
    9: 3_600_000,
    10: 3_800_000, // 10+ years same as 10
  },
  '2025-26': {
    // Projected values with ~4% increase
    0: 1_164_345,
    1: 1_892_800,
    2: 2_176_096,
    3: 2_485_600,
    4: 2_704_000,
    5: 2_912_000,
    6: 3_120_000,
    7: 3_328_000,
    8: 3_536_000,
    9: 3_744_000,
    10: 3_952_000,
  },
};

/**
 * Get the minimum salary scale for a given season
 *
 * @param {string} season - Season code (e.g., "2024-25")
 * @returns {Object} Scale mapping years of service to minimum salary
 */
export function getMinimumSalaryScale(season) {
  // Normalize season to season code format
  const seasonCode = normalizeSeasonCode(season);

  // Return scale for the season, or fall back to most recent
  if (MINIMUM_SALARY_SCALE[seasonCode]) {
    return MINIMUM_SALARY_SCALE[seasonCode];
  }

  // Fall back to the latest available scale
  const seasons = Object.keys(MINIMUM_SALARY_SCALE).sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10) || 0;
    const yearB = parseInt(b.split('-')[0], 10) || 0;
    return yearA - yearB;
  });
  const latestSeason = seasons[seasons.length - 1];
  return MINIMUM_SALARY_SCALE[latestSeason];
}

/**
 * Compute minimum salary for a player based on years of service
 *
 * Per CBA Article II, Sec. 6:
 * - Every player must receive at least the Minimum Annual Salary
 * - Scale amounts tied to Years of Service
 * - 10+ years of service uses final row
 *
 * @param {Object} player - Player data object
 * @param {Object} player.bio - Player bio information
 * @param {number} [player.bio.experience] - Years of NBA experience
 * @param {number} [player.bio.yearsExperience] - Alternative field for experience
 * @param {Object} leagueContext - League context
 * @param {string} leagueContext.currentSeason - Current season code
 * @returns {Object} Minimum salary information
 */
export function computeMinimumSalary(player, leagueContext) {
  // Detect if we're being called with a RuleContext
  if (player && player.timing && player.cap && player.player) {
    return computeMinimumSalaryFromRuleContext(player);
  }

  const yearsOfService = getYearsOfService(player);
  
  // Require season from context - no hard-coded fallback
  const season = leagueContext?.currentSeason;
  if (!season) {
    return {
      minimumSalary: 0,
      yearsOfService,
      season: null,
      reason: 'Cannot determine minimum salary: currentSeason not provided in leagueContext',
    };
  }
  
  const scale = getMinimumSalaryScale(season);

  // Cap years of service at 10 (10+ uses same minimum)
  const cappedYears = Math.min(yearsOfService, 10);
  const minimumSalary = scale[cappedYears] || scale[0];

  return {
    minimumSalary,
    yearsOfService,
    season,
    reason:
      yearsOfService === 0
        ? 'Rookie minimum salary'
        : yearsOfService >= 10
          ? 'Veteran minimum (10+ years)'
          : `Veteran minimum (${yearsOfService} years of service)`,
  };
}

/**
 * Compute minimum salary from RuleContext
 * 
 * @param {Object} ctx - RuleContext object
 * @returns {Object} Minimum salary information
 */
export function computeMinimumSalaryFromRuleContext(ctx) {
  const { timing, player: playerCtx } = ctx;
  const yearsOfService = playerCtx.yearsOfServiceAtOperation;
  const season = timing.capSeasonId;
  
  const scale = getMinimumSalaryScale(season);
  const cappedYears = Math.min(yearsOfService, 10);
  const minimumSalary = scale[cappedYears] || scale[0];

  return {
    minimumSalary,
    yearsOfService,
    season,
    reason:
      yearsOfService === 0
        ? 'Rookie minimum salary'
        : yearsOfService >= 10
          ? 'Veteran minimum (10+ years)'
          : `Veteran minimum (${yearsOfService} years of service)`,
  };
}

/**
 * Extract years of service from player data
 *
 * @param {Object} player - Player data object
 * @returns {number} Years of service (defaults to 0)
 */
export function getYearsOfService(player) {
  if (!player) return 0;

  // Check multiple possible locations for experience data
  const experience =
    player.bio?.experience ??
    player.bio?.yearsExperience ??
    player.yearsOfService ??
    player.years_of_service ??
    player.experience ??
    player['Years Pro'] ??
    player.bio?.['Years Pro'] ??
    player.yearsPro ??
    0;

  // Ensure non-negative integer
  const years = parseInt(experience, 10);
  return Number.isFinite(years) && years >= 0 ? years : 0;
}

/**
 * Get minimum cap hit for salary matching purposes
 *
 * For trade matching purposes, there's a special rule where
 * players with 3+ years of service have a minimum cap hit
 * that may differ from actual salary.
 *
 * Reference: Trade rules for minimum salary players
 *
 * @param {number} yearsOfService - Years of NBA service
 * @param {string} [season='2024-25'] - Season code
 * @returns {number} Minimum cap hit for trade matching
 */
export function getMinimumCapHit(yearsOfService, season = '2024-25') {
  const scale = getMinimumSalaryScale(season);

  // Per trade rules, minimum cap hit for matching purposes
  // is based on a 2-year veteran minimum for players with 3+ years
  if (yearsOfService >= 3) {
    // Use scale[2] from the requested season; getMinimumSalaryScale always returns
    // a complete scale (falling back to most recent if season is undefined), so
    // scale[2] should always exist. The || scale[0] guard is defensive.
    return scale[2] || scale[0];
  }

  const cappedYears = Math.min(yearsOfService, 10);
  return scale[cappedYears] || scale[0];
}

/**
 * Normalize season input to season code format.
 *
 * Note: This is a utility function used for parsing season parameters.
 * It uses the latest defined scale season as fallback when the season 
 * parameter is invalid/empty. Callers should provide explicit season
 * codes via leagueContext for simulation-aware behavior.
 *
 * @param {string|number} season - Season code or year
 * @returns {string} Season code in "YYYY-YY" format
 */
function normalizeSeasonCode(season) {
  if (typeof season === 'string' && /^\d{4}-\d{2}$/.test(season)) {
    return season;
  }

  // Convert numeric year to season code
  const year =
    typeof season === 'number' ? season : parseInt(String(season), 10);
  if (Number.isFinite(year) && year >= 1900) {
    return `${year - 1}-${String(year).slice(-2)}`;
  }

  // Fallback for invalid/empty season: use latest defined scale season
  // This avoids hardcoding a season that will become stale
  const definedSeasons = Object.keys(MINIMUM_SALARY_SCALE).sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10) || 0;
    const yearB = parseInt(b.split('-')[0], 10) || 0;
    return yearA - yearB;
  });
  
  // Return the latest defined season (or throw if none defined)
  const latestSeason = definedSeasons[definedSeasons.length - 1];
  if (!latestSeason) {
    throw new Error('No minimum salary scales defined in MINIMUM_SALARY_SCALE');
  }
  return latestSeason;
}
