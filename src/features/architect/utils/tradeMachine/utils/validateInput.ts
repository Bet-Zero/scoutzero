/**
 * Validates trade input data structure and required fields
 * Ensures data meets minimum requirements before normalization
 */

import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';

interface ValidateInputContractLike {
  salariesByYear?: unknown[] | null;
  [key: string]: unknown;
}

interface ValidateInputPlayer {
  contract?: ValidateInputContractLike | null;
  primaryContract?: ValidateInputContractLike | null;
  [key: string]: unknown;
}

interface ValidateInputPick {
  year?: number | string | null;
  round?: number | string | null;
  [key: string]: unknown;
}

interface ValidateInputTeamMeta {
  teamName?: string | null;
  id?: string | number | null;
  [key: string]: unknown;
}

interface ValidateInputTeam {
  team?: ValidateInputTeamMeta | null;
  sends?: unknown;
  picksOut?: unknown;
  [key: string]: unknown;
}

interface CapProjectionEntry {
  salaryCap?: number | string | null;
  cap?: number | string | null;
  [key: string]: unknown;
}

type CapProjectionMap = Record<string | number, CapProjectionEntry | undefined>;

interface ValidateTradeInputParams {
  teams?: unknown;
  capProjections?: CapProjectionMap | null;
  currentYear?: number;
}

/**
 * Validates a single team's input data
 */
function validateTeamInput(
  team: ValidateInputTeam | null | undefined,
  index: number,
  { currentYear }: { currentYear?: number }
): string[] {
  const errors: string[] = [];

  if (!team) {
    errors.push(`Team at index ${index} is undefined`);
    return errors;
  }

  if (!team.team) {
    errors.push(`Team at index ${index} is missing required 'team' object`);
    return errors;
  }

  // Validate required team properties
  if (!team.team.teamName && !team.team.id) {
    errors.push('must have either');
  }

  // Validate player arrays
  const sends = (team.sends || []) as Array<ValidateInputPlayer | null>;
  if (!Array.isArray(sends)) {
    errors.push(
      `Team ${team.team.teamName || index}: 'sends' must be an array`
    );
  }

  const picksOut = (team.picksOut || []) as Array<ValidateInputPick | null>;
  if (!Array.isArray(picksOut)) {
    errors.push(
      `Team ${team.team.teamName || index}: 'picksOut' must be an array`
    );
  }

  // Validate players have minimum required data
  sends.forEach((player, playerIndex) => {
    if (!player) {
      errors.push(
        `Team ${team.team?.teamName || index}: Player at index ${playerIndex} in 'sends' is undefined`
      );
      return;
    }

    const salaryForYear = getSalaryForYear(player, currentYear as number);
    const hasContract =
      player.contract?.salariesByYear?.length ||
      player.primaryContract?.salariesByYear?.length;

    if (!hasContract || salaryForYear === 0) {
      errors.push('missing required salary data');
    }
  });

  // Validate pick data
  picksOut.forEach((pick, pickIndex) => {
    if (!pick) {
      errors.push(
        `Team ${team.team?.teamName || index}: Pick at index ${pickIndex} is undefined`
      );
      return;
    }

    if (!pick.year || !pick.round) {
      errors.push('Pick missing required year/round');
    }
  });

  return errors;
}

/**
 * Validates required cap/projection data
 */
function validateCapProjections(
  capProjections: CapProjectionMap | null | undefined,
  currentYear: number | undefined
): string[] {
  const errors: string[] = [];

  if (!capProjections) {
    errors.push('Cap projections are required');
    return errors;
  }

  const resolvedCurrentYear = currentYear as number;
  const seasonKey = `${resolvedCurrentYear - 1}-${String(
    resolvedCurrentYear
  ).slice(-2)}`;
  const yearCaps =
    capProjections[seasonKey] || capProjections[resolvedCurrentYear as number];

  if (!yearCaps) {
    errors.push(
      `Cap projections missing for season ${seasonKey} or year ${resolvedCurrentYear}`
    );
  }

  // Check for minimum required thresholds
  if (yearCaps) {
    if (!yearCaps.salaryCap && !yearCaps.cap) {
      errors.push('Cap projections missing required salary cap value');
    }
  }

  return errors;
}

/**
 * Main entry point for validating trade input
 */
export function validateTradeInput({
  teams,
  capProjections,
  currentYear,
}: ValidateTradeInputParams): string[] {
  const errors: string[] = [];

  // Validate teams array
  if (!Array.isArray(teams)) {
    errors.push('Teams must be provided as an array');
    return errors;
  }

  if (teams.length < 2) {
    errors.push('Trade must include at least 2 teams');
    return errors;
  }

  if (teams.length > 5) {
    errors.push('Trade cannot include more than 5 teams');
    return errors;
  }

  // Validate each team's data
  (teams as Array<ValidateInputTeam | null>).forEach((team, index) => {
    const teamErrors = validateTeamInput(team, index, { currentYear });
    errors.push(...teamErrors);
  });

  // Validate cap projections
  const capErrors = validateCapProjections(capProjections, currentYear);
  errors.push(...capErrors);

  // Validate current year
  if (!currentYear || typeof currentYear !== 'number') {
    errors.push('Current year must be provided as a number');
  }

  return errors;
}
