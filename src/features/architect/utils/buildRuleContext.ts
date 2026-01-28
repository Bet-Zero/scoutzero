/**
 * FILE: src/features/architect/utils/buildRuleContext.ts
 * PURPOSE: RuleContext builder for player move evaluation.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 */

import type { SeasonId } from './seasonHelpers';
import type {
  RuleContext,
  TimingContext,
  ArchitectPlayerContext,
  TeamContext,
  OperationContext,
  CapContext,
  LeaguePhase,
  BirdType,
  ApronLevel,
  OperationType,
  ExceptionType,
  // RuleContextErrorCode,
} from '../types/ruleContext';
import { RuleContextValidationError } from '../types/ruleContext';
import {
  isValidSeasonId,
  parseSeasonId,
  prevSeason,
  getCurrentSeasonId,
  makeSeasonIdFromEndYear,
  normalizeToSeasonId,
} from './seasonHelpers';
import {
  getCapForSeason,
  getSupportedSeasonRange,
  hasCapDataForSeason,
} from './capHelpers';
import { getTeamApronStatus } from '@/features/architect/utils/capUtils';

// Re-export RuleContextValidationError for backward compatibility
export { RuleContextValidationError } from '../types/ruleContext';

/**
 * Input for building a RuleContext for a player move
 */
export interface BuildRuleContextInput {
  /** Player data object */
  player: {
    playerId?: string;
    player_id?: string;
    id?: string;
    displayName?: string;
    name?: string;
    bio?: {
      displayName?: string;
      experience?: number;
      yearsExperience?: number;
      draftYear?: number;
      draftRound?: number;
      draftPick?: number;
    };
    contract?: {
      salariesByYear?: Array<{
        season: string;
        salary?: number;
        capHit?: number;
        guaranteed?: boolean;
      }>;
      endSeason?: string;
      startSeason?: string;
      isRookieScale?: boolean;
      contractType?: string;
      birdRights?: {
        status?: string;
        yearsWithTeam?: number;
      };
    };
    yearsOfService?: number;
    experience?: number;
    teamId?: string;
    teamCode?: string;
  };

  /** Team plan state */
  teamState?: {
    teamId?: string;
    teamCode?: string;
    players?: Array<{
      playerId?: string;
      contract?: {
        salariesByYear?: Array<{
          season: string;
          salary?: number;
          capHit?: number;
        }>;
      };
    }>;
    totals?: {
      totalSalary?: number;
      capHits?: Record<string, number>;
    };
    hardCapStatus?: {
      isHardCapped: boolean;
      trigger: 'SIGN_AND_TRADE' | 'MLE' | 'BAE' | null;
      ceiling: number;
    };
    exceptions?: {
      fullMLE?: { available: boolean; remaining: number };
      taxpayerMLE?: { available: boolean; remaining: number };
      roomMLE?: { available: boolean; remaining: number };
      bae?: { available: boolean; remaining: number };
      tradeExceptions?: Array<{
        id: string;
        amount: number;
        expiresSeasonId?: string;
      }>;
    };
  };

  /** Operation type */
  operationType: OperationType;

  /** Override the operation season (defaults to current or next season based on operation type) */
  operationSeasonId?: SeasonId | string;

  /** Simulation date for timing calculations */
  simulationDate?: Date;

  /** Proposed contract details */
  proposedContract?: {
    years: number;
    startingSeasonId?: SeasonId | string;
    firstYearSalary: number;
    raisePercentage?: number;
    includesPlayerOption?: boolean;
    includesTeamOption?: boolean;
  };

  /** Exception being used */
  exceptionUsed?: ExceptionType;

  /** Is this a sign-and-trade? */
  isSignAndTrade?: boolean;

  /** Is this an extend-and-trade? */
  isExtendAndTrade?: boolean;
}

/**
 * Determine the league phase based on date
 *
 * NBA Calendar:
 * - July 1-6: Moratorium (no signings allowed)
 * - July 7 - Oct ~15: Offseason (free agency period)
 * - Oct ~15-22: Preseason (training camp)
 * - Oct ~22 - April 30: Regular season
 * - May - June: Playoffs
 */
function deriveLeaguePhase(date: Date): LeaguePhase {
  const month = date.getMonth(); // 0 = Jan, 6 = Jul
  const day = date.getDate();

  // July 1-6: Moratorium
  if (month === 6 && day >= 1 && day <= 6) {
    return 'moratorium';
  }

  // July 7 - October ~15: Offseason (free agency)
  if (month === 6 && day >= 7) return 'offseason';
  if (month === 7 || month === 8) return 'offseason'; // Aug, Sep
  if (month === 9 && day <= 15) return 'offseason'; // Early Oct

  // October ~15 - October ~22: Preseason
  if (month === 9 && day > 15 && day <= 22) return 'preseason';

  // October ~22 - April 30: Regular season
  if (month === 9 && day > 22) return 'regular';
  if (month >= 10 || month <= 3) return 'regular'; // Nov-Mar
  if (month === 4 && day <= 30) return 'regular'; // April (month index 4 is May, so this is actually month 3)

  // May - June: Playoffs (months 4-5)
  if (month >= 4 && month <= 5) return 'playoffs';

  return 'regular'; // Default fallback
}

/**
 * Determine the operation season based on operation type and date
 */
function deriveOperationSeasonId(
  operationType: OperationType,
  operationDate: Date,
  player: BuildRuleContextInput['player'],
  proposedContract?: BuildRuleContextInput['proposedContract']
): SeasonId {
  const currentSeason = getCurrentSeasonId(operationDate);

  // If proposed contract has a starting season, use that
  if (proposedContract?.startingSeasonId) {
    const normalized = normalizeToSeasonId(proposedContract.startingSeasonId);
    if (normalized) return normalized;
  }

  // For most FA signings, the contract starts next season if we're in offseason
  // For trades, it's the current season
  switch (operationType) {
    case 'TRADE':
      return currentSeason;

    case 'UFA_SIGNING':
    case 'RFA_SIGNING':
    case 'SIGN_AND_TRADE':
    case 'MINIMUM_SIGNING':
    case 'EXCEPTION_SIGNING':
    case 'QUALIFYING_OFFER':
    case 'TWO_WAY_SIGNING':
      // Free agency signings typically apply to the upcoming season
      return currentSeason;

    case 'VETERAN_EXTENSION':
    case 'DESIGNATED_VETERAN_EXTENSION':
    case 'ROOKIE_EXTENSION': {
      // Extension starts after current contract ends
      const endSeason = player.contract?.endSeason;
      if (endSeason) {
        const normalized = normalizeToSeasonId(endSeason);
        if (normalized && isValidSeasonId(normalized)) {
          const parsed = parseSeasonId(normalized);
          if (parsed) {
            return makeSeasonIdFromEndYear(parsed.endYear + 1);
          }
        }
      }
      // Fallback: assume extension starts next season
      const parsed = parseSeasonId(currentSeason);
      return parsed
        ? makeSeasonIdFromEndYear(parsed.endYear + 1)
        : currentSeason;
    }

    default:
      return currentSeason;
  }
}

/**
 * Determine the reference season for prior salary calculations
 */
function deriveReferenceSeasonId(
  operationType: OperationType,
  operationSeasonId: SeasonId,
  player: BuildRuleContextInput['player']
): SeasonId {
  switch (operationType) {
    case 'UFA_SIGNING':
    case 'RFA_SIGNING':
    case 'SIGN_AND_TRADE':
    case 'MINIMUM_SIGNING':
    case 'EXCEPTION_SIGNING':
      // For FA signings, reference the season before the new contract starts
      return prevSeason(operationSeasonId);

    case 'VETERAN_EXTENSION':
    case 'DESIGNATED_VETERAN_EXTENSION':
    case 'ROOKIE_EXTENSION': {
      // For extensions, reference the final year of the current contract
      const endSeason = player.contract?.endSeason;
      if (endSeason) {
        const normalized = normalizeToSeasonId(endSeason);
        if (normalized) return normalized;
      }
      // Fallback: use season before operation
      return prevSeason(operationSeasonId);
    }

    case 'TRADE':
      // For trades, use current season
      return operationSeasonId;

    case 'QUALIFYING_OFFER':
      // QO is based on final year of expiring contract
      return prevSeason(operationSeasonId);

    case 'TWO_WAY_SIGNING':
      // Two-way doesn't use prior salary
      return operationSeasonId;

    default:
      return prevSeason(operationSeasonId);
  }
}

/**
 * Get salary for a specific season from player contract
 */
function getSalaryForSeason(
  player: BuildRuleContextInput['player'],
  seasonId: SeasonId
): number | null {
  const salaries = player.contract?.salariesByYear;
  if (!salaries || !Array.isArray(salaries)) return null;

  const entry = salaries.find((s) => {
    const normalized = normalizeToSeasonId(s.season);
    return normalized === seasonId;
  });

  if (!entry) return null;
  return entry.salary ?? entry.capHit ?? null;
}

// Import getYearsOfService from minimumSalaryRules for consistent YOS calculation
import { getYearsOfService as getYearsOfServiceFromPlayer } from '@/features/architect/utils/salaryEngine';
/**
 * Compute years of service at operation time
 *
 * Uses the shared getYearsOfService helper first for consistency,
 * then falls back to draft-year calculation if needed.
 */
function computeYearsOfService(
  player: BuildRuleContextInput['player'],
  operationSeasonId: SeasonId
): number {
  // First, try using the shared getYearsOfService helper for consistency
  // This checks multiple field paths (bio.experience, yearsOfService, etc.)
  const fromHelper = getYearsOfServiceFromPlayer(player);
  if (fromHelper > 0) {
    return fromHelper;
  }

  // Fallback: Calculate from draft year if direct experience not available
  // This handles cases where only draft info is present
  const draftYear = player.bio?.draftYear;
  if (draftYear) {
    const parsed = parseSeasonId(operationSeasonId);
    if (parsed) {
      // Years of service = seasons completed since draft
      // A player drafted in 2020 has 0 years in 2020-21, 1 year in 2021-22, etc.
      return Math.max(0, parsed.startYear - draftYear);
    }
  }

  return 0;
}

/**
 * Compute max salary percentage bucket based on years of service
 */
function computeMaxPercentBucket(yearsOfService: number): 0.25 | 0.3 | 0.35 {
  if (yearsOfService >= 10) return 0.35;
  if (yearsOfService >= 7) return 0.3;
  return 0.25;
}

/**
 * Determine Bird rights type
 */
function deriveBirdType(player: BuildRuleContextInput['player']): BirdType {
  const status = player.contract?.birdRights?.status;
  if (!status) return 'None';

  const normalizedStatus = String(status).toLowerCase().trim();
  if (normalizedStatus.includes('full') || normalizedStatus === 'bird')
    return 'Full Bird';
  if (normalizedStatus.includes('early')) return 'Early Bird';
  if (normalizedStatus.includes('non')) return 'Non-Bird';
  if (normalizedStatus === 'none') return 'None';

  // Log warning for unrecognized bird rights status to help debug data issues
  const playerId =
    player.playerId ?? player.player_id ?? player.id ?? 'unknown';
  console.warn(
    `Unrecognized Bird rights status "${status}" (normalized: "${normalizedStatus}") ` +
      `for player ${playerId}. Defaulting to 'None'.`
  );
  return 'None';
}

/**
 * Compute team salary for a season
 */
function computeTeamSalary(
  teamState: BuildRuleContextInput['teamState'],
  seasonId: SeasonId
): number {
  // Try pre-computed totals first
  if (teamState?.totals?.capHits) {
    const hit = teamState.totals.capHits[seasonId];
    if (typeof hit === 'number') return hit;
  }

  if (teamState?.totals?.totalSalary) {
    return teamState.totals.totalSalary;
  }

  // Sum up player salaries
  const players = teamState?.players ?? [];
  return players.reduce((sum, p) => {
    const salary = getSalaryForSeason(p, seasonId);
    return sum + (salary ?? 0);
  }, 0);
}

/**
 * Derive apron level from team salary and cap thresholds.
 * Delegates to SSOT for correct boundary semantics:
 * - Second apron: strictly > secondApron
 * - First apron: >= firstApron
 */
function deriveApronLevel(teamSalary: number, cap: CapContext): ApronLevel {
  // Delegate to SSOT for consistent boundary semantics
  return getTeamApronStatus(
    { totalSalary: teamSalary },
    {
      salaryCap: cap.salaryCap,
      firstApron: cap.firstApron,
      secondApron: cap.secondApron,
    }
  ) as ApronLevel;
}

/**
 * Build the timing context
 */
function buildTimingContext(
  input: BuildRuleContextInput,
  operationSeasonId: SeasonId,
  referenceSeasonId: SeasonId
): TimingContext {
  const operationDate = input.simulationDate ?? new Date();
  const phase = deriveLeaguePhase(operationDate);

  return {
    operationSeasonId,
    referenceSeasonId,
    capSeasonId: operationSeasonId, // Usually same as operation season
    phase,
    operationDate,
  };
}

/**
 * Build the player context
 */
function buildPlayerContext(
  input: BuildRuleContextInput,
  operationSeasonId: SeasonId,
  referenceSeasonId: SeasonId
): ArchitectPlayerContext {
  const { player } = input;

  const playerId =
    player.playerId ?? player.player_id ?? player.id ?? 'unknown';
  const displayName =
    player.displayName ?? player.name ?? player.bio?.displayName ?? playerId;

  const yearsOfService = computeYearsOfService(player, operationSeasonId);
  const maxPercentBucket = computeMaxPercentBucket(yearsOfService);
  const birdType = deriveBirdType(player);

  const priorSeasonSalary = getSalaryForSeason(player, referenceSeasonId);
  const currentSeasonSalary = getSalaryForSeason(player, operationSeasonId);

  // Contract end season
  let contractEndSeasonId: SeasonId | null = null;
  if (player.contract?.endSeason) {
    const normalized = normalizeToSeasonId(player.contract.endSeason);
    if (normalized) contractEndSeasonId = normalized;
  }

  // Draft info
  let draftInfo: ArchitectPlayerContext['draftInfo'] = null;
  if (player.bio?.draftYear) {
    draftInfo = {
      year: player.bio.draftYear,
      round: player.bio.draftRound ?? 0,
      pick: player.bio.draftPick ?? 0,
    };
  }

  const isRookieScale =
    player.contract?.isRookieScale === true ||
    player.contract?.contractType === 'Rookie Scale';

  return {
    playerId,
    displayName,
    currentTeamId: player.teamId ?? player.teamCode ?? null,
    yearsOfServiceAtOperation: yearsOfService,
    birdTypeAtOperation: birdType,
    priorSeasonSalary,
    currentSeasonSalary,
    maxPercentBucket,
    contractEndSeasonId,
    isRookieScale,
    draftInfo,
  };
}

/**
 * Build the team context
 */
function buildTeamContext(
  input: BuildRuleContextInput,
  operationSeasonId: SeasonId,
  cap: CapContext
): TeamContext {
  const { teamState } = input;

  const teamId = teamState?.teamId ?? teamState?.teamCode ?? 'unknown';
  const teamCode = teamState?.teamCode ?? teamState?.teamId ?? 'UNK';

  const teamSalary = computeTeamSalary(teamState, operationSeasonId);
  const apronLevel = deriveApronLevel(teamSalary, cap);
  const capSpace = Math.max(0, cap.salaryCap - teamSalary);

  const hardCapStatus = teamState?.hardCapStatus ?? {
    isHardCapped: false,
    trigger: null,
    ceiling: cap.firstApron,
  };

  const defaultExceptions = {
    fullMLE: { available: true, remaining: cap.fullMLE },
    taxpayerMLE: { available: true, remaining: cap.taxpayerMLE },
    roomMLE: { available: true, remaining: cap.roomMLE },
    bae: { available: true, remaining: cap.bae },
    tradeExceptions: [] as Array<{
      id: string;
      amount: number;
      expiresSeasonId?: string;
    }>,
  };

  const exceptionsAvailable = {
    ...defaultExceptions,
    ...(teamState?.exceptions ?? {}),
  };

  // Normalize trade exceptions
  const tradeExceptions = (exceptionsAvailable.tradeExceptions ?? []).map(
    (tpe) => {
      const normalized = tpe.expiresSeasonId
        ? normalizeToSeasonId(tpe.expiresSeasonId)
        : null;
      return {
        id: tpe.id,
        amount: tpe.amount,
        expiresSeasonId: normalized ?? operationSeasonId,
      };
    }
  );

  return {
    teamId,
    teamCode,
    teamSalaryAtOperation: teamSalary,
    apronLevelAtOperation: apronLevel,
    capSpaceAtOperation: capSpace,
    hardCapStatus,
    exceptionsAvailable: {
      fullMLE: exceptionsAvailable.fullMLE ?? defaultExceptions.fullMLE,
      taxpayerMLE:
        exceptionsAvailable.taxpayerMLE ?? defaultExceptions.taxpayerMLE,
      roomMLE: exceptionsAvailable.roomMLE ?? defaultExceptions.roomMLE,
      bae: exceptionsAvailable.bae ?? defaultExceptions.bae,
      tradeExceptions,
    },
  };
}

/**
 * Build the operation context
 */
function buildOperationContext(
  input: BuildRuleContextInput,
  operationSeasonId: SeasonId
): OperationContext {
  const {
    operationType,
    proposedContract,
    exceptionUsed,
    isSignAndTrade,
    isExtendAndTrade,
  } = input;

  let formattedContract: OperationContext['proposedContract'];
  if (proposedContract) {
    const startingSeasonId = proposedContract.startingSeasonId
      ? (normalizeToSeasonId(proposedContract.startingSeasonId) ??
        operationSeasonId)
      : operationSeasonId;

    formattedContract = {
      years: proposedContract.years,
      startingSeasonId,
      firstYearSalary: proposedContract.firstYearSalary,
      raisePercentage: proposedContract.raisePercentage ?? 0.08,
      includesPlayerOption: proposedContract.includesPlayerOption,
      includesTeamOption: proposedContract.includesTeamOption,
    };
  }

  return {
    operationType,
    proposedContract: formattedContract,
    exceptionUsed: exceptionUsed ?? null,
    isSignAndTrade: isSignAndTrade ?? false,
    isExtendAndTrade: isExtendAndTrade ?? false,
  };
}

/**
 * Validate that a RuleContext is complete before use
 * @throws RuleContextValidationError if context is incomplete
 */
export function validateRuleContext(ctx: RuleContext): void {
  // Timing validation
  if (
    !ctx.timing.operationSeasonId ||
    !isValidSeasonId(ctx.timing.operationSeasonId)
  ) {
    throw new RuleContextValidationError(
      'INVALID_SEASON_ID',
      'operationSeasonId is required and must be valid',
      'Cannot evaluate move: operation season not specified.'
    );
  }

  // Cap validation
  if (!ctx.cap.salaryCap || ctx.cap.salaryCap <= 0) {
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `Invalid salary cap: ${ctx.cap.salaryCap}`,
      'Cannot evaluate move: cap data is missing or invalid.'
    );
  }

  // Player validation (when player context is required for non-trade operations)
  if (ctx.operation.operationType !== 'TRADE' && !ctx.player.playerId) {
    throw new RuleContextValidationError(
      'MISSING_PLAYER_DATA',
      'playerId is required for non-trade operations',
      'Cannot evaluate move: player not specified.'
    );
  }
}

/**
 * Build a complete RuleContext for evaluating a player move
 *
 * @param input - Input data for building the context
 * @returns Complete RuleContext for rule evaluation
 * @throws RuleContextValidationError if required data is missing
 */
export function buildRuleContextForPlayerMove(
  input: BuildRuleContextInput
): RuleContext {
  const operationDate = input.simulationDate ?? new Date();

  // Determine operation season
  let operationSeasonId: SeasonId;
  if (input.operationSeasonId) {
    const normalized = normalizeToSeasonId(input.operationSeasonId);
    if (!normalized) {
      throw new RuleContextValidationError(
        'INVALID_SEASON_ID',
        `Invalid operationSeasonId: ${input.operationSeasonId}`,
        'Cannot evaluate move: invalid season format.'
      );
    }
    operationSeasonId = normalized;
  } else {
    operationSeasonId = deriveOperationSeasonId(
      input.operationType,
      operationDate,
      input.player,
      input.proposedContract
    );
  }

  // Check if cap data is available
  if (!hasCapDataForSeason(operationSeasonId)) {
    const { earliest, latest } = getSupportedSeasonRange();
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `No cap projections available for season ${operationSeasonId}`,
      `Cannot evaluate move: cap data for ${operationSeasonId} is not available. Supported seasons: ${earliest} through ${latest}.`
    );
  }

  // Get cap context
  const cap = getCapForSeason(operationSeasonId);
  if (!cap) {
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `Failed to load cap data for ${operationSeasonId}`,
      'Cannot evaluate move: cap data could not be loaded.'
    );
  }

  // Derive reference season
  const referenceSeasonId = deriveReferenceSeasonId(
    input.operationType,
    operationSeasonId,
    input.player
  );

  // Build all context pieces
  const timing = buildTimingContext(
    input,
    operationSeasonId,
    referenceSeasonId
  );
  const player = buildPlayerContext(
    input,
    operationSeasonId,
    referenceSeasonId
  );
  const team = buildTeamContext(input, operationSeasonId, cap);
  const operation = buildOperationContext(input, operationSeasonId);

  const ctx: RuleContext = {
    timing,
    player,
    team,
    operation,
    cap,
  };

  // Validate the built context
  validateRuleContext(ctx);

  return ctx;
}

/**
 * Build a minimal "cap-only" RuleContext for simple season/cap lookups.
 *
 * This function creates a skeletal RuleContext with placeholder/synthetic values
 * for player and team fields. It is intended for:
 * - Quick cap threshold lookups
 * - Season/timing calculations
 * - Rules that only need cap data (salaryCap, apron thresholds, exceptions)
 *
 * **WARNING**: Do not use this context for player-specific calculations like
 * max salary, Bird rights, or QO amounts - those require full player data.
 * The player fields (yearsOfService, priorSeasonSalary, etc.) are all set to
 * safe defaults (0, null, 'None') and will produce incorrect results if used
 * for actual player rule evaluation.
 *
 * @param seasonId - The season to build context for (e.g., "2024-25" or 2025)
 * @param operationType - Operation type for context (defaults to 'UFA_SIGNING')
 * @returns A RuleContext with real cap data but placeholder player/team data
 * @throws RuleContextValidationError if seasonId is invalid or cap data unavailable
 *
 * @example
 * // Good: Use for cap lookups
 * const ctx = buildMinimalRuleContext('2025-26');
 * const cap = ctx.cap.salaryCap; // Real 2025-26 cap value
 *
 * // Bad: Don't use for player rules
 * const maxSalary = computeMaxSalary(ctx); // Wrong! Uses placeholder YOS = 0
 */
export function buildMinimalRuleContext(
  seasonId: SeasonId | string,
  operationType: OperationType = 'UFA_SIGNING'
): RuleContext {
  const normalized = normalizeToSeasonId(seasonId);
  if (!normalized) {
    throw new RuleContextValidationError(
      'INVALID_SEASON_ID',
      `Invalid seasonId: ${seasonId}`,
      'Cannot build context: invalid season format.'
    );
  }

  const cap = getCapForSeason(normalized);
  if (!cap) {
    const { earliest, latest } = getSupportedSeasonRange();
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `No cap data for ${normalized}`,
      `Supported seasons: ${earliest} through ${latest}.`
    );
  }

  // NOTE: Player and team fields are placeholders - do not use for player-specific rules
  return {
    timing: {
      operationSeasonId: normalized,
      referenceSeasonId: prevSeason(normalized),
      capSeasonId: normalized,
      phase: 'regular',
      operationDate: new Date(),
    },
    player: {
      playerId: 'unknown',
      displayName: 'Unknown',
      currentTeamId: null,
      yearsOfServiceAtOperation: 0,
      birdTypeAtOperation: 'None',
      priorSeasonSalary: null,
      currentSeasonSalary: null,
      maxPercentBucket: 0.25,
      contractEndSeasonId: null,
      isRookieScale: false,
      draftInfo: null,
    },
    team: {
      teamId: 'unknown',
      teamCode: 'UNK',
      teamSalaryAtOperation: 0,
      apronLevelAtOperation: 'UNDER_CAP',
      capSpaceAtOperation: cap.salaryCap,
      hardCapStatus: {
        isHardCapped: false,
        trigger: null,
        ceiling: cap.firstApron,
      },
      exceptionsAvailable: {
        fullMLE: { available: true, remaining: cap.fullMLE },
        taxpayerMLE: { available: true, remaining: cap.taxpayerMLE },
        roomMLE: { available: true, remaining: cap.roomMLE },
        bae: { available: true, remaining: cap.bae },
        tradeExceptions: [],
      },
    },
    operation: {
      operationType,
      isSignAndTrade: false,
      isExtendAndTrade: false,
    },
    cap,
  };
}
