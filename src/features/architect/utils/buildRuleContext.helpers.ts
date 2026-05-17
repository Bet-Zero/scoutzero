/**
 * Wave 45 Step 1: BuildRuleContextInput type and all private helper functions
 * extracted from buildRuleContext.ts (lines 50–619).
 *
 * Exports BuildRuleContextInput and the six context builder functions
 * (deriveOperationSeasonId, deriveReferenceSeasonId, buildTimingContext,
 * buildPlayerContext, buildTeamContext, buildOperationContext) needed by
 * buildRuleContextForPlayerMove in the main file.
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
} from '../types/ruleContext';
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
import { getYearsOfService as getYearsOfServiceFromPlayer } from '@/features/architect/utils/salaryEngine';

export interface BuildRuleContextInput {
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

  operationType: OperationType;
  operationSeasonId?: SeasonId | string;
  simulationDate?: Date;
  proposedContract?: {
    years: number;
    startingSeasonId?: SeasonId | string;
    firstYearSalary: number;
    raisePercentage?: number;
    includesPlayerOption?: boolean;
    includesTeamOption?: boolean;
  };
  exceptionUsed?: ExceptionType;
  isSignAndTrade?: boolean;
  isExtendAndTrade?: boolean;
}

// ============================================================
// Private helpers
// ============================================================

function deriveLeaguePhase(date: Date): LeaguePhase {
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 6 && day >= 1 && day <= 6) {
    return 'moratorium';
  }

  if (month === 6 && day >= 7) return 'offseason';
  if (month === 7 || month === 8) return 'offseason';
  if (month === 9 && day <= 15) return 'offseason';

  if (month === 9 && day > 15 && day <= 22) return 'preseason';

  if (month === 9 && day > 22) return 'regular';
  if (month >= 10 || month <= 3) return 'regular';
  if (month === 4 && day <= 30) return 'regular';

  if (month >= 4 && month <= 5) return 'playoffs';

  return 'regular';
}

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

function computeYearsOfService(
  player: BuildRuleContextInput['player'],
  operationSeasonId: SeasonId
): number {
  const fromHelper = getYearsOfServiceFromPlayer(player);
  if (fromHelper > 0) {
    return fromHelper;
  }

  const draftYear = player.bio?.draftYear;
  if (draftYear) {
    const parsed = parseSeasonId(operationSeasonId);
    if (parsed) {
      return Math.max(0, parsed.startYear - draftYear);
    }
  }

  return 0;
}

function computeMaxPercentBucket(yearsOfService: number): 0.25 | 0.3 | 0.35 {
  if (yearsOfService >= 10) return 0.35;
  if (yearsOfService >= 7) return 0.3;
  return 0.25;
}

function deriveBirdType(player: BuildRuleContextInput['player']): BirdType {
  const status = player.contract?.birdRights?.status;
  if (!status) return 'None';

  const normalizedStatus = String(status).toLowerCase().trim();
  if (normalizedStatus.includes('full') || normalizedStatus === 'bird')
    return 'Full Bird';
  if (normalizedStatus.includes('early')) return 'Early Bird';
  if (normalizedStatus.includes('non')) return 'Non-Bird';
  if (normalizedStatus === 'none') return 'None';

  const playerId =
    player.playerId ?? player.player_id ?? player.id ?? 'unknown';
  console.warn(
    `Unrecognized Bird rights status "${status}" (normalized: "${normalizedStatus}") ` +
      `for player ${playerId}. Defaulting to 'None'.`
  );
  return 'None';
}

function computeTeamSalary(
  teamState: BuildRuleContextInput['teamState'],
  seasonId: SeasonId
): number {
  if (teamState?.totals?.capHits) {
    const hit = teamState.totals.capHits[seasonId];
    if (typeof hit === 'number') return hit;
  }

  if (teamState?.totals?.totalSalary) {
    return teamState.totals.totalSalary;
  }

  const players = teamState?.players ?? [];
  return players.reduce((sum, p) => {
    const salary = getSalaryForSeason(p, seasonId);
    return sum + (salary ?? 0);
  }, 0);
}

function deriveApronLevel(teamSalary: number, cap: CapContext): ApronLevel {
  return getTeamApronStatus(
    { totalSalary: teamSalary },
    {
      salaryCap: cap.salaryCap,
      firstApron: cap.firstApron,
      secondApron: cap.secondApron,
    }
  ) as ApronLevel;
}

// ============================================================
// Exported context builders
// ============================================================

export function deriveOperationSeasonId(
  operationType: OperationType,
  operationDate: Date,
  player: BuildRuleContextInput['player'],
  proposedContract?: BuildRuleContextInput['proposedContract']
): SeasonId {
  const currentSeason = getCurrentSeasonId(operationDate);

  if (proposedContract?.startingSeasonId) {
    const normalized = normalizeToSeasonId(proposedContract.startingSeasonId);
    if (normalized) return normalized;
  }

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
      return currentSeason;

    case 'VETERAN_EXTENSION':
    case 'DESIGNATED_VETERAN_EXTENSION':
    case 'ROOKIE_EXTENSION': {
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
      const parsed = parseSeasonId(currentSeason);
      return parsed
        ? makeSeasonIdFromEndYear(parsed.endYear + 1)
        : currentSeason;
    }

    default:
      return currentSeason;
  }
}

export function deriveReferenceSeasonId(
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
      return prevSeason(operationSeasonId);

    case 'VETERAN_EXTENSION':
    case 'DESIGNATED_VETERAN_EXTENSION':
    case 'ROOKIE_EXTENSION': {
      const endSeason = player.contract?.endSeason;
      if (endSeason) {
        const normalized = normalizeToSeasonId(endSeason);
        if (normalized) return normalized;
      }
      return prevSeason(operationSeasonId);
    }

    case 'TRADE':
      return operationSeasonId;

    case 'QUALIFYING_OFFER':
      return prevSeason(operationSeasonId);

    case 'TWO_WAY_SIGNING':
      return operationSeasonId;

    default:
      return prevSeason(operationSeasonId);
  }
}

export function buildTimingContext(
  input: BuildRuleContextInput,
  operationSeasonId: SeasonId,
  referenceSeasonId: SeasonId
): TimingContext {
  const operationDate = input.simulationDate ?? new Date();
  const phase = deriveLeaguePhase(operationDate);

  return {
    operationSeasonId,
    referenceSeasonId,
    capSeasonId: operationSeasonId,
    phase,
    operationDate,
  };
}

export function buildPlayerContext(
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

  let contractEndSeasonId: SeasonId | null = null;
  if (player.contract?.endSeason) {
    const normalized = normalizeToSeasonId(player.contract.endSeason);
    if (normalized) contractEndSeasonId = normalized;
  }

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

export function buildTeamContext(
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

export function buildOperationContext(
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
