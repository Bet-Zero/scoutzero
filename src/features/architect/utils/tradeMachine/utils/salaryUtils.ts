/**
 * FILE: salaryUtils.ts
 * PURPOSE: Deprecated compatibility wrapper - use canonical modules directly
 * OWNERSHIP: Trade Machine Team
 *
 * @deprecated This module is deprecated. Import from canonical modules instead:
 * - computeMatchingValues → import from './matchingValues.js'
 * - getCapHitForSeason → import from './seasonUtils.js'
 * - getSalaryMatchingResult → import from './salaryMatchingRules.js'
 *
 * This file exists for backwards compatibility only. New code should import
 * from the canonical sources listed above.
 *
 * @see matchingValues.ts - BYC, poison pill, trade kicker calculations
 * @see seasonUtils.js - Cap hit lookups by season
 * @see salaryMatchingRules.ts - Salary matching thresholds and rules
 */
import { computeMatchingValues as computeMatchingValuesCanonical } from './matchingValues.js';
import { getCapHitForSeason as getCapHitForSeasonUtil } from './seasonUtils.js';
import { getSalaryMatchingResult } from './salaryMatchingRules.js';
import type {
  TradeExceptionPlayer,
  TradeTeam,
  TradeValidatorCapSettings,
} from '../constants/types';

type SalaryUtilsPlayer = TradeExceptionPlayer & {
  matchOutgoing?: number | string | null;
};

type SalaryUtilsCapSettings = TradeValidatorCapSettings & {
  cap?: number | string | null;
};

type SalaryUtilsTeamData = NonNullable<TradeTeam['team']> & {
  isOverCap?: boolean | null;
  totalSalary?: number | string | null;
};

type SalaryUtilsContext = NonNullable<TradeTeam['context']> & {
  capSettings?: SalaryUtilsCapSettings | null;
};

type SalaryUtilsTeam = TradeTeam & {
  sends?: SalaryUtilsPlayer[] | null;
  team?: SalaryUtilsTeamData | null;
  context?: SalaryUtilsContext | null;
  teamTotalSalary?: number | string | null;
};

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/**
 * Delegates to the canonical matching value implementation in matchingValues.js.
 * This is the SINGLE SOURCE OF TRUTH for BYC, poison pill, and trade kicker calculations.
 * All modules should ultimately use this canonical implementation.
 */
export function computeMatchingValues(
  params: Parameters<typeof computeMatchingValuesCanonical>[0]
): ReturnType<typeof computeMatchingValuesCanonical> {
  return computeMatchingValuesCanonical(params);
}

/**
 * Get cap hit for a player for a specific season
 * Uses capHit field when available, falls back to salary
 */
export function getCapHitForSeason(
  player: TradeExceptionPlayer | null | undefined,
  seasonOrYear: string | number
): number {
  return getCapHitForSeasonUtil(player, seasonOrYear);
}

/**
 * Calculates the maximum incoming salary a team can receive in a trade.
 * Uses the unified salary matching rules from salaryMatchingRules.js as single source of truth.
 */
export function getIncomingCeilingForTeam(team: SalaryUtilsTeam | null | undefined): number {
  if (!team || !team.sends) return 0;

  const outgoingTotal = team.sends.reduce(
    (sum, player) => sum + toFiniteNumber(player?.matchOutgoing),
    0
  );

  // Teams below cap can take back any amount
  if (!team.team?.isOverCap) {
    return Number.MAX_SAFE_INTEGER;
  }

  const capSettings = team.context?.capSettings || {};
  const teamTotalSalary = toFiniteNumber(
    team.teamTotalSalary || team.team?.totalSalary || 0
  );

  const matchingResult = getSalaryMatchingResult({
    teamTotalSalary,
    outgoingSalary: outgoingTotal,
    capSettings: {
      salaryCap: capSettings.salaryCap || capSettings.cap || 0,
      firstApron: capSettings.firstApron || 0,
      secondApron: capSettings.secondApron || 0,
    },
  });

  return matchingResult.allowableIncoming;
}
