/**
 * FILE: src/features/architect/utils/playerRulesProfile/birdRightsRules.ts
 * PURPOSE: Bird rights classification and signing capability rules for Architect.
 * OWNERSHIP: Feature: architect/player-rules
 *
 * HISTORY:
 *  - 2026-01-18: Added canonical cap hold multiplier wiring (plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a)
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

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
 * @file src/features/architect/utils/playerRulesProfile/birdRightsRules.ts
 */

import { formatSalary } from '@/shared/utils/formatting/basicFormatting';
import { DEFAULT_AVERAGE_SALARY } from '../cbaConstants';
import { CAP_HOLD_MULTIPLIERS } from '../capHolds';

type BirdRightsType = string;

type BirdRightsLike = {
  status?: string | null;
  type?: string | null;
  yearsWithTeam?: number | null;
  yearsOfService?: number | null;
};

type PlayerContractSalaryLike = {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
};

type BirdRightsPlayerLike = {
  contract?: {
    birdRights?: BirdRightsLike | string | null;
    startSeason?: string | null;
    salariesByYear?: PlayerContractSalaryLike[] | null;
  } | null;
};

type BirdRightsLeagueContextLike = {
  capSettings?: {
    salaryCap?: number | null;
    averageSalary?: number | null;
  } | null;
  currentYear?: number | null;
};

type BirdRightsRuleContextLike = {
  timing?: {
    referenceSeasonId?: string | null;
  } | null;
  player?: {
    birdTypeAtOperation?: string | null;
    priorSeasonSalary?: number | null;
  } | null;
  cap?: {
    salaryCap?: number | null;
    averagePlayerSalary?: number | null;
  } | null;
};

type BirdRightsConfig = {
  minYearsWithTeam: number;
  maxContractYears: number;
  raisePercentage: number;
  canSignOverCap: boolean;
  maxSalaryBasis: string;
  capHoldMultiplier?: number;
};

type BirdRightsSigningAbilities = {
  canSignOverCap: boolean;
  maxYears: number;
  raisePercentage: number;
  maxFirstYearSalary: number | null;
  canSignToMax: boolean;
  method: string;
};

type BirdRightsInfo = {
  type: BirdRightsType;
  yearsWithTeam: number;
  summary: string;
  signingAbilities: BirdRightsSigningAbilities;
  config: {
    maxContractYears: number;
    raisePercentage: number;
    canSignOverCap: boolean;
  };
  notes?: string;
};

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
const BIRD_RIGHTS_CONFIG: Record<string, BirdRightsConfig> = {
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
    capHoldMultiplier: CAP_HOLD_MULTIPLIERS.EARLY_BIRD,
  },
  [BIRD_RIGHTS_TYPES.NON_BIRD]: {
    minYearsWithTeam: 1,
    maxContractYears: 4,
    raisePercentage: 0.05,
    canSignOverCap: true,
    maxSalaryBasis: 'nonBird', // 120% of prior salary or minimum
    capHoldMultiplier: CAP_HOLD_MULTIPLIERS.NON_BIRD,
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
export function computeBirdRights(
  player: BirdRightsPlayerLike | null | undefined,
  leagueContext?: BirdRightsLeagueContextLike | null
): BirdRightsInfo {
  const capSettings = leagueContext?.capSettings ?? {};
  // Require salaryCap from context - warn but continue with placeholder for backward compatibility
  // TODO: In future version, require salaryCap and return error result if missing
  const salaryCap = capSettings.salaryCap;
  const isValidCap =
    typeof salaryCap === 'number' &&
    Number.isFinite(salaryCap) &&
    salaryCap > 0;
  if (!isValidCap) {
    console.warn(
      '[birdRightsRules] Missing or invalid capSettings.salaryCap in leagueContext. Bird rights signing abilities may be inaccurate.'
    );
  }
  const effectiveCap = isValidCap ? salaryCap : 0; // Use 0 to make signing abilities clearly invalid
  const averageSalary = capSettings.averageSalary || DEFAULT_AVERAGE_SALARY;

  // Require currentYear from leagueContext for deterministic behavior
  const currentYear = leagueContext?.currentYear;
  if (!currentYear) {
    console.warn(
      '[birdRightsRules] Missing leagueContext.currentYear. Bird rights determination may be inaccurate.'
    );
    // Return a safe default without attempting date-based computation
    const result = buildBirdRightsInfo(
      BIRD_RIGHTS_TYPES.NONE,
      0,
      player,
      effectiveCap,
      averageSalary
    );
    result.notes = 'Missing currentYear in leagueContext - determinism lost';
    return result;
  }

  // Try to get Bird rights from existing contract data
  const existingBirdRights = extractExistingBirdRights(player);

  if (existingBirdRights) {
    return buildBirdRightsInfo(
      existingBirdRights.type,
      existingBirdRights.yearsWithTeam,
      player,
      effectiveCap,
      averageSalary
    );
  }

  // Compute Bird rights based on tenure
  const yearsWithTeam = computeYearsWithTeam(player, currentYear);
  const birdRightsType = determineBirdRightsType(yearsWithTeam);

  return buildBirdRightsInfo(
    birdRightsType,
    yearsWithTeam,
    player,
    effectiveCap,
    averageSalary
  );
}

/**
 * Extract existing Bird rights data from player contract
 *
 * @param {Object} player - Player data object
 * @returns {Object|null} Existing Bird rights data or null
 */
function extractExistingBirdRights(
  player: BirdRightsPlayerLike | null | undefined
): {
  type: BirdRightsType;
  yearsWithTeam: number;
  yearsOfService?: number;
} | null {
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
function normalizeBirdRightsType(type: string | null | undefined): BirdRightsType {
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
 * @param {number} currentYear - Current season end year (passed from leagueContext)
 * @returns {number} Years with team
 */
function computeYearsWithTeam(
  player: BirdRightsPlayerLike | null | undefined,
  currentYear: number
): number {
  // Check multiple possible sources
  if (player?.contract?.birdRights && typeof player.contract.birdRights === 'object') {
    if (player.contract.birdRights.yearsWithTeam) {
      return player.contract.birdRights.yearsWithTeam;
    }
  }

  // Calculate from contract start if available
  if (player?.contract?.startSeason && currentYear) {
    const startYear = parseSeasonYear(player.contract.startSeason);
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
function parseSeasonYear(season: string | null | undefined): number | null {
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
function determineBirdRightsType(yearsWithTeam: number): BirdRightsType {
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
function buildBirdRightsInfo(
  type: BirdRightsType,
  yearsWithTeam: number,
  player: BirdRightsPlayerLike | null | undefined,
  salaryCap: number,
  averageSalary: number
): BirdRightsInfo {
  const config = BIRD_RIGHTS_CONFIG[type] || BIRD_RIGHTS_CONFIG[BIRD_RIGHTS_TYPES.NONE];
  const priorSalary = getLastSalary(player);

  const signingAbilities = computeSigningAbilities(
    type,
    config,
    priorSalary,
    salaryCap,
    averageSalary
  );

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
function computeSigningAbilities(
  type: BirdRightsType,
  config: BirdRightsConfig,
  priorSalary: number,
  salaryCap: number,
  averageSalary: number
): BirdRightsSigningAbilities {
  const base = {
    canSignOverCap: config.canSignOverCap,
    maxYears: config.maxContractYears,
    raisePercentage: config.raisePercentage,
  };

  switch (type) {
    case BIRD_RIGHTS_TYPES.FULL: {
      // Full Bird can sign to max salary
      return {
        ...base,
        maxFirstYearSalary: null, // Determined by max salary rules
        canSignToMax: true,
        method: 'Full Bird rights - can sign to max salary',
      };
    }

    case BIRD_RIGHTS_TYPES.EARLY: {
      // Early Bird: greater of 175% of prior salary or 105% of average salary
      const earlyBirdMax = Math.max(
        priorSalary * 1.75,
        averageSalary * 1.05
      );
      return {
        ...base,
        maxFirstYearSalary: Math.round(earlyBirdMax),
        canSignToMax: false,
        method:
          'Early Bird rights - max of 175% prior salary or 105% average salary',
      };
    }

    case BIRD_RIGHTS_TYPES.NON_BIRD: {
      // Non-Bird: 120% of prior salary or minimum
      // If no prior salary, default to 50% of average salary as reasonable estimate
      // for a player who might be on a minimum contract
      const NON_BIRD_DEFAULT_SALARY_FACTOR = 0.5;
      const nonBirdMax =
        priorSalary > 0
          ? priorSalary * 1.2
          : averageSalary * NON_BIRD_DEFAULT_SALARY_FACTOR;
      return {
        ...base,
        maxFirstYearSalary: Math.round(nonBirdMax),
        canSignToMax: false,
        method: 'Non-Bird rights - up to 120% of prior salary',
      };
    }

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
function getLastSalary(player: BirdRightsPlayerLike | null | undefined): number {
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
function buildBirdRightsSummary(
  type: BirdRightsType,
  abilities: BirdRightsSigningAbilities
): string {
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
 * Format currency for display using the shared formatSalary utility.
 * Returns '$0' for falsy values instead of '-' (shared utility behavior)
 * because in Bird rights context, showing $0 is more meaningful than a dash.
 *
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted string
 */
function formatCurrency(amount: number | null): string {
  if (!amount) return '$0';
  return formatSalary(amount);
}

/**
 * Compute Bird rights classification using RuleContext
 *
 * This variant extracts all necessary fields from RuleContext for
 * consistent timing and cap data across the application.
 *
 * @param {Object} ctx - RuleContext object
 * @param {Object} ctx.timing - Timing context
 * @param {Object} ctx.player - Player context with birdTypeAtOperation, priorSeasonSalary
 * @param {Object} ctx.cap - Cap context with salaryCap, averagePlayerSalary
 * @returns {Object} Bird rights information
 */
export function computeBirdRightsFromRuleContext(
  ctx: BirdRightsRuleContextLike | null | undefined
): BirdRightsInfo {
  // Validate required context
  if (!ctx || !ctx.timing || !ctx.player || !ctx.cap) {
    return buildBirdRightsInfo(
      BIRD_RIGHTS_TYPES.NONE,
      0,
      {},
      0,
      DEFAULT_AVERAGE_SALARY
    );
  }

  const { player: playerCtx, cap } = ctx;

  // Extract values from RuleContext with proper validation (consistent with computeBirdRights)
  const salaryCap =
    typeof cap.salaryCap === 'number' &&
    Number.isFinite(cap.salaryCap) &&
    cap.salaryCap > 0
      ? cap.salaryCap
      : 0;
  const averageSalary =
    typeof cap.averagePlayerSalary === 'number' &&
    Number.isFinite(cap.averagePlayerSalary) &&
    cap.averagePlayerSalary > 0
      ? cap.averagePlayerSalary
      : DEFAULT_AVERAGE_SALARY;

  // Map birdTypeAtOperation to our constants
  const birdTypeMap: Record<string, BirdRightsType> = {
    'Full Bird': BIRD_RIGHTS_TYPES.FULL,
    'Early Bird': BIRD_RIGHTS_TYPES.EARLY,
    'Non-Bird': BIRD_RIGHTS_TYPES.NON_BIRD,
    None: BIRD_RIGHTS_TYPES.NONE,
  };

  const birdRightsType =
    birdTypeMap[playerCtx.birdTypeAtOperation || ''] || BIRD_RIGHTS_TYPES.NONE;

  // Create a synthetic player object for buildBirdRightsInfo
  // We need the prior salary for signing ability calculations
  const syntheticPlayer = {
    contract: {
      salariesByYear:
        playerCtx.priorSeasonSalary != null
          ? [
              {
                season: ctx.timing.referenceSeasonId,
                salary: playerCtx.priorSeasonSalary,
              },
            ]
          : [],
    },
  };

  // Use years from context (contract tenure is encoded in birdType derivation)
  // Full Bird = 3+, Early Bird = 2, Non-Bird = 1, None = 0
  const yearsWithTeam =
    birdRightsType === BIRD_RIGHTS_TYPES.FULL
      ? 3
      : birdRightsType === BIRD_RIGHTS_TYPES.EARLY
        ? 2
        : birdRightsType === BIRD_RIGHTS_TYPES.NON_BIRD
          ? 1
          : 0;

  return buildBirdRightsInfo(
    birdRightsType,
    yearsWithTeam,
    syntheticPlayer,
    salaryCap,
    averageSalary
  );
}
