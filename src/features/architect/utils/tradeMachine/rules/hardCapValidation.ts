/**
 * TM-1C CANONICAL: Trade-time hard cap validator.
 * All trade validation layers must call validateHardCap() (or getHardCapStatus()) for hard cap
 * ceiling checks. Do not add parallel hard cap ceiling logic elsewhere in the trade pipeline.
 * Ceiling detection is delegated to hardCapStatus.ts (getHardCapStatus).
 */
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import {
  getHardCapStatus,
  HARD_CAP_TYPES,
  resolveSalaryCapYear,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import type { AuthoritativeHardCapResult, TeamContext } from '../constants/types';

type PlayerLike = {
  newSalary?: number | string | null;
  salary?: number | string | null;
  signAndTrade?: boolean;
};

type CapSettingsLike = {
  firstApron?: number | string | null;
  apron?: number | string | null;
  secondApron?: number | string | null;
};

type HardCapValidationTeamData = {
  teamTotalSalary?: number | string | null;
  apronTeamSalary?: number | string | null;
  totalSalary?: number | string | null;
} | null;

type HardCapValidationTeam = {
  team?: HardCapValidationTeamData;
  teamTotalSalary?: number | string | null;
  apronTeamSalary?: number | string | null;
  totalSalary?: number | string | null;
  receives?: PlayerLike[] | null;
  incomingPlayers?: PlayerLike[] | null;
  sends?: PlayerLike[] | null;
  outgoingPlayers?: PlayerLike[] | null;
  projectedSalary?: number | string | null;
  salaryIn?: number | string | null;
  salaryOut?: number | string | null;
  capSettings?: CapSettingsLike | null;
};

type HardCapValidationContext = TeamContext & {
  projectedSalary?: number | string | null;
  worldId?: string | null;
  capSettings?: CapSettingsLike | null;
  capSettingsSource?: string | null;
};

type HardCapLegacyType = NonNullable<AuthoritativeHardCapResult['hardCapType']>;
type ProjectedHardCapEnforcementContext = {
  hardCapTypeCanonical: ReturnType<typeof getHardCapStatus>['hardCapType'];
  hardCapTypeForCeiling: ReturnType<typeof getHardCapStatus>['hardCapType'];
  hardCapType: HardCapLegacyType | null;
  hardCapLimit: number | null;
  hardCapLabel: string | null;
  isUnknownFailClosed: boolean;
};

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePlayers(players: PlayerLike[] | null | undefined): PlayerLike[] {
  return Array.isArray(players) ? players : [];
}

function getPlayerSalaryValue(player: PlayerLike): number {
  return toFiniteNumber(player.newSalary || player.salary || 0);
}

function isDevEnvironment(): boolean {
  const globalProcess = globalThis as typeof globalThis & {
    process?: {
      env?: {
        NODE_ENV?: string;
      };
    };
  };

  return (
    globalProcess.process?.env?.NODE_ENV === 'development' || import.meta?.env?.DEV
  );
}

function getProjectedHardCapEnforcementContext({
  hardCapStatus,
  firstApron,
  secondApron,
}: {
  hardCapStatus: ReturnType<typeof getHardCapStatus>;
  firstApron: number;
  secondApron: number;
}): ProjectedHardCapEnforcementContext {
  const hardCapTypeCanonical = hardCapStatus.isHardCapped
    ? hardCapStatus.hardCapType
    : null;
  const isUnknownFailClosed = hardCapTypeCanonical === HARD_CAP_TYPES.UNKNOWN;
  const hardCapTypeForCeiling = isUnknownFailClosed
    ? HARD_CAP_TYPES.FIRST_APRON
    : hardCapTypeCanonical;

  let hardCapType: HardCapLegacyType | null = null;
  let hardCapLabel: string | null = null;

  if (hardCapTypeForCeiling === HARD_CAP_TYPES.SECOND_APRON) {
    hardCapType = 'SecondApron';
    hardCapLabel = secondApron > 0 ? '2nd Apron' : '1st Apron (fallback)';
  } else if (hardCapTypeForCeiling === HARD_CAP_TYPES.FIRST_APRON) {
    hardCapType = 'FirstApron';
    hardCapLabel = firstApron > 0 ? '1st Apron' : '2nd Apron (fallback)';
  }

  return {
    hardCapTypeCanonical,
    hardCapTypeForCeiling,
    hardCapType,
    hardCapLimit: hardCapStatus.hardCapCeiling,
    hardCapLabel: hardCapStatus.hardCapCeiling !== null ? hardCapLabel : null,
    isUnknownFailClosed,
  };
}

/**
 * Canonical projected hard-cap legality owner.
 * This function decides whether the proposed transaction is legal against projected salary totals.
 * Final-state hard-cap re-verification against authoritative post-mutation artifacts remains in
 * postStateCapValidator.ts and must stay separate.
 */
export function validateHardCap(
  team: HardCapValidationTeam | null | undefined,
  context: HardCapValidationContext = {}
): AuthoritativeHardCapResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (!team) {
    return {
      passed: false,
      violations: ['Missing team data'],
      warnings: [],
      hardCapType: null,
    };
  }

  const teamData = team.team || team;
  const rawApronTeamSalary =
    team.teamTotalSalary ??
    teamData?.apronTeamSalary ??
    teamData?.teamTotalSalary;
  if (
    typeof rawApronTeamSalary !== 'number' ||
    !Number.isFinite(rawApronTeamSalary)
  ) {
    return {
      passed: false,
      violations: ['Apron Team Salary needs governed input'],
      warnings,
      hardCapType: null,
    };
  }
  const teamTotalSalary = rawApronTeamSalary;

  const incomingPlayers = normalizePlayers(team.receives || team.incomingPlayers);
  const outgoingPlayers = normalizePlayers(team.sends || team.outgoingPlayers);

  const incomingSalary = incomingPlayers.reduce(
    (sum, player) => sum + getPlayerSalaryValue(player),
    0
  );
  const outgoingSalary = outgoingPlayers.reduce(
    (sum, player) => sum + getPlayerSalaryValue(player),
    0
  );

  const salaryIn = toFiniteNumber(team.salaryIn || incomingSalary);
  const salaryOut = toFiniteNumber(team.salaryOut || outgoingSalary);
  const projectedSalary =
    team.projectedSalary ?? context.projectedSalary ?? teamTotalSalary + salaryIn - salaryOut;

  const teamCapSettings =
    team.capSettings && typeof team.capSettings === 'object' ? team.capSettings : {};
  const contextCapSettings =
    context.capSettings && typeof context.capSettings === 'object'
      ? context.capSettings
      : {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  const firstApron = toFiniteNumber(capSettings.firstApron);
  const apron = toFiniteNumber(capSettings.apron);
  const secondApron = toFiniteNumber(capSettings.secondApron);

  const hasFirstApron = firstApron > 0 || apron > 0;
  const hasSecondApron = secondApron > 0;

  if (!hasFirstApron || !hasSecondApron) {
    if (isDevEnvironment()) {
      console.warn(
        '[validateHardCap] Missing cap settings:',
        { firstApron, apron, secondApron },
        'source:',
        context.capSettingsSource || 'unknown'
      );
    }

    warnings.push(
      `Hard cap validation may be inaccurate - cap settings incomplete (firstApron: ${hasFirstApron}, secondApron: ${hasSecondApron})`
    );
  }

  const actualFirstApron = firstApron || apron;
  const hardCapStatus = getHardCapStatus(team, {
    isWorldless: !context.worldId,
    capSettings: {
      firstApron: actualFirstApron,
      secondApron,
    },
    salaryCapYear: resolveSalaryCapYear(context),
    containingTeamCode: context.containingTeamCode ?? null,
    worldLineage: context.worldLineage ?? null,
  });

  if (!hardCapStatus.isHardCapped) {
    return {
      passed: true,
      violations,
      warnings,
      hardCapType: null,
      hardCapTypeCanonical: null,
      hardCapStatus,
      projectedSalary: toFiniteNumber(projectedSalary),
      capLimits: {
        firstApron: actualFirstApron,
        secondApron,
      },
      activeHardCapLedgerEntry:
        hardCapStatus.activeHardCapLedgerEntry ?? null,
    };
  }

  const {
    hardCapTypeCanonical,
    hardCapTypeForCeiling,
    hardCapType,
    hardCapLimit,
    hardCapLabel,
    isUnknownFailClosed,
  } = getProjectedHardCapEnforcementContext({
    hardCapStatus,
    firstApron: actualFirstApron,
    secondApron,
  });

  const normalizedProjectedSalary = toFiniteNumber(projectedSalary);

  if (hardCapLimit !== null && hardCapLabel !== null) {
    if (normalizedProjectedSalary > hardCapLimit) {
      const hardCapRoom = Math.max(0, hardCapLimit - teamTotalSalary);
      const hardCapIncomingCeiling = salaryOut + hardCapRoom;
      const incomingOverage = Math.max(0, salaryIn - hardCapIncomingCeiling);

      const baseMessage =
        incomingOverage > 0
          ? `${hardCapLabel} hard cap violation: Incoming salary exceeds hard-cap incoming ceiling by ${formatCurrency(incomingOverage)} (incoming ${formatCurrency(salaryIn)} vs ceiling ${formatCurrency(hardCapIncomingCeiling)}).`
          : `${hardCapLabel} hard cap violation: Trade would exceed hard-cap by ${formatCurrency(normalizedProjectedSalary - hardCapLimit)}`;

      violations.push(
        isUnknownFailClosed
          ? `${baseMessage} [fail-closed UNKNOWN hard cap type]`
          : baseMessage
      );
    }
  }

  if (hardCapTypeForCeiling === HARD_CAP_TYPES.SECOND_APRON) {
    const hasIncomingSignAndTrade = normalizePlayers(
      team.incomingPlayers || team.receives
    ).some((player) => player.signAndTrade === true);

    if (hasIncomingSignAndTrade) {
      violations.push(
        'Team would exceed hard-cap after receiving sign-and-trade player'
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    hardCapType,
    hardCapTypeCanonical: hardCapTypeCanonical || null,
    hardCapStatus,
    projectedSalary: normalizedProjectedSalary,
    capLimits: {
      firstApron: actualFirstApron,
      secondApron,
    },
    activeHardCapLedgerEntry:
      hardCapStatus.activeHardCapLedgerEntry ?? null,
  };
}

export function validateHardCapLegacy(
  team: HardCapValidationTeam | null | undefined,
  capSettings: CapSettingsLike | null | undefined
): AuthoritativeHardCapResult {
  if (!team?.team || !capSettings) {
    return {
      passed: false,
      violations: ['Missing team or cap settings data'],
      hardCapType: null,
    };
  }

  const violations: string[] = [];
  let hardCapType: HardCapLegacyType | null = null;

  const incomingSalary = normalizePlayers(team.receives).reduce(
    (sum, player) => sum + toFiniteNumber(player.newSalary),
    0
  );
  const outgoingSalary = normalizePlayers(team.sends).reduce(
    (sum, player) => sum + toFiniteNumber(player.newSalary),
    0
  );
  const teamTotalSalary = toFiniteNumber(
    team.team?.apronTeamSalary ?? team.team?.teamTotalSalary
  );
  const projectedSalary = teamTotalSalary - outgoingSalary + incomingSalary;
  const legacyFirstApron = toFiniteNumber(capSettings.firstApron);
  const legacySecondApron = toFiniteNumber(capSettings.secondApron);

  if ((team.team as { hardCapFirstApron?: { active?: boolean } }).hardCapFirstApron?.active) {
    hardCapType = 'FirstApron';
    if (projectedSalary > legacyFirstApron) {
      violations.push(
        `Trade would exceed 1st Apron hard cap by ${(projectedSalary - legacyFirstApron).toLocaleString()}`
      );
    }
  }

  if ((team.team as { hardCapSecondApron?: { active?: boolean } }).hardCapSecondApron?.active) {
    hardCapType = 'SecondApron';
    if (projectedSalary > legacySecondApron) {
      violations.push(
        `Trade would exceed 2nd Apron hard cap by ${(projectedSalary - legacySecondApron).toLocaleString()}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    hardCapType,
  };
}

export function wouldExceedHardCapAfterTrade(
  team: HardCapValidationTeam,
  incomingSalary: number,
  outgoingSalary: number,
  capSettings: CapSettingsLike | null | undefined
): boolean {
  const result = validateHardCap({
    ...team,
    salaryIn: incomingSalary,
    salaryOut: outgoingSalary,
    capSettings,
  });

  return !result.passed;
}

export function getActiveHardCapLimit(
  team: HardCapValidationTeam,
  capSettings: CapSettingsLike = {}
): number | null {
  const result = validateHardCap(team, {
    capSettings: {
      firstApron: toFiniteNumber(capSettings.firstApron),
      apron: toFiniteNumber(capSettings.apron),
      secondApron: toFiniteNumber(capSettings.secondApron),
    },
  });

  if (result.hardCapType === 'SecondApron') {
    return toFiniteNumber(capSettings.secondApron) || null;
  }

  if (result.hardCapType === 'FirstApron') {
    return toFiniteNumber(capSettings.firstApron || capSettings.apron) || null;
  }

  return null;
}

export { validateHardCap as hardCapValidation };
export { validateHardCapLegacy as hardCapValidationLegacy };
