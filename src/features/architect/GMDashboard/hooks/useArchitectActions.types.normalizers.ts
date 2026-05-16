/**
 * Wave 16 Step 1: Data-normalizer/transformer functions extracted from
 * useArchitectActions.types.ts. All functions are pure transformations
 * with no side effects.
 */

import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type { ManualExceptionsSavePayload } from '@/features/architect/capSheet/CapSheet/CapSheet';
import type {
  SignAndTradeContractLike,
  SignAndTradeSalaryRow,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  ArchitectDashboardPlayer,
  UseArchitectStateReturn,
} from './useArchitectState';
// type-only back-reference — erased at runtime, no circular dep
import type {
  LocalContractLegacySalaryInput,
  SalaryByYear,
  LocalBio,
  LocalContract,
  ArchitectPlayer,
  ArchitectActionTeamCapSheet,
  CapSheet,
  SigningValidationTeam,
  SigningValidationPlayer,
  SigningValidationCapHold,
  FreeAgentComputeState,
} from './useArchitectActions.types';

export const normalizeOptionalMutationString = (
  value: string | null | undefined
): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeOptionalMutationNumber = (
  value: number | null | undefined
): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

export const normalizeManualExceptionsForMutation = (
  exceptions: ManualExceptionsSavePayload
): NonNullable<CapSheet['exceptions']> => {
  const { tpe, ...rest } = exceptions;
  const normalized: Record<string, unknown> = { ...rest };

  if (Array.isArray(tpe)) {
    normalized.tpe = tpe.map((exception) => ({
      id: exception.id,
      totalAmount: normalizeOptionalMutationNumber(exception.totalAmount),
      usedAmount: normalizeOptionalMutationNumber(exception.usedAmount),
      remainingAmount: normalizeOptionalMutationNumber(
        exception.remainingAmount
      ),
      createdFrom: normalizeOptionalMutationString(exception.createdFrom),
      createdOn: normalizeOptionalMutationString(exception.createdOn),
      expiresOn: exception.expiresOn ?? null,
      notes: normalizeOptionalMutationString(exception.notes),
    }));
  }

  return normalized as NonNullable<CapSheet['exceptions']>;
};

export const toNormalizedSalaryRow = (
  row: LocalContractLegacySalaryInput | SalaryByYear | null | undefined
): SalaryByYear | null => {
  if (row == null || typeof row === 'number' || typeof row === 'string') {
    return null;
  }

  const salaryRow = row as Partial<SalaryByYear> & {
    season?: string | number | null;
    year?: number | string | null;
    salary?: number | string | null;
  };

  const normalizedSeason =
    normalizeOptionalMutationString(
      typeof salaryRow.season === 'string' ? salaryRow.season : undefined
    ) ??
    (typeof salaryRow.season === 'number' && Number.isFinite(salaryRow.season)
      ? toSeasonCode(salaryRow.season)
      : undefined) ??
    (typeof salaryRow.year === 'number' && Number.isFinite(salaryRow.year)
      ? toSeasonCode(salaryRow.year)
      : undefined) ??
    (typeof salaryRow.year === 'string' &&
    Number.isFinite(Number(salaryRow.year))
      ? toSeasonCode(Number(salaryRow.year))
      : undefined);

  if (!normalizedSeason) {
    return null;
  }

  return {
    ...salaryRow,
    season: normalizedSeason,
    year:
      typeof salaryRow.year === 'number'
        ? salaryRow.year
        : typeof salaryRow.year === 'string' &&
            Number.isFinite(Number(salaryRow.year))
          ? Number(salaryRow.year)
          : null,
    salary:
      typeof salaryRow.salary === 'number'
        ? salaryRow.salary
        : typeof salaryRow.salary === 'string' &&
            Number.isFinite(Number(salaryRow.salary))
          ? Number(salaryRow.salary)
          : null,
    capHit:
      typeof salaryRow.capHit === 'number'
        ? salaryRow.capHit
        : typeof salaryRow.capHit === 'string' &&
            Number.isFinite(Number(salaryRow.capHit))
          ? Number(salaryRow.capHit)
          : null,
    guaranteed:
      typeof salaryRow.guaranteed === 'boolean'
        ? salaryRow.guaranteed
        : null,
    guaranteedAmount:
      typeof salaryRow.guaranteedAmount === 'number'
        ? salaryRow.guaranteedAmount
        : typeof salaryRow.guaranteedAmount === 'string' &&
            Number.isFinite(Number(salaryRow.guaranteedAmount))
          ? Number(salaryRow.guaranteedAmount)
          : null,
    option: normalizeOptionalMutationString(salaryRow.option) ?? null,
    optionType: normalizeOptionalMutationString(salaryRow.optionType) ?? null,
    optionUsed:
      typeof salaryRow.optionUsed === 'boolean'
        ? salaryRow.optionUsed
        : null,
    tradeBonus:
      typeof salaryRow.tradeBonus === 'number'
        ? salaryRow.tradeBonus
        : typeof salaryRow.tradeBonus === 'string' &&
            Number.isFinite(Number(salaryRow.tradeBonus))
          ? Number(salaryRow.tradeBonus)
          : null,
  };
};

export const toLocalBio = (
  bio: ArchitectDashboardPlayer['bio'] | ArchitectPlayer['bio'] | null | undefined
): LocalBio | undefined => {
  if (!bio) {
    return undefined;
  }

  const bioRecord = bio as Record<string, unknown>;

  const yearsExperience =
    typeof bioRecord.yearsExperience === 'number'
      ? bioRecord.yearsExperience
      : typeof bioRecord.yearsExperience === 'string' &&
          Number.isFinite(Number(bioRecord.yearsExperience))
        ? Number(bioRecord.yearsExperience)
        : undefined;
  const experience =
    typeof bioRecord.experience === 'number' ||
    typeof bioRecord.experience === 'string'
      ? bioRecord.experience
      : null;
  const yearsPro =
    typeof bioRecord['Years Pro'] === 'number' ||
    typeof bioRecord['Years Pro'] === 'string'
      ? bioRecord['Years Pro']
      : null;

  return {
    playerId:
      typeof bioRecord.playerId === 'string'
        ? bioRecord.playerId
        : null,
    displayName:
      typeof bioRecord.displayName === 'string'
        ? bioRecord.displayName
        : null,
    position:
      typeof bioRecord.position === 'string'
        ? bioRecord.position
        : null,
    age: typeof bioRecord.age === 'number' ? bioRecord.age : undefined,
    height:
      typeof bioRecord.height === 'number' || typeof bioRecord.height === 'string'
        ? bioRecord.height
        : null,
    weight:
      typeof bioRecord.weight === 'number' || typeof bioRecord.weight === 'string'
        ? bioRecord.weight
        : null,
    draftRound:
      typeof bioRecord.draftRound === 'number' ? bioRecord.draftRound : null,
    draftPick:
      typeof bioRecord.draftPick === 'number' ||
      typeof bioRecord.draftPick === 'string'
        ? bioRecord.draftPick
        : null,
    yearsExperience,
    experience,
    'Years Pro': yearsPro,
    display:
      bioRecord.display &&
      typeof bioRecord.display === 'object' &&
      !Array.isArray(bioRecord.display)
        ? {
            freeAgentType:
              typeof (bioRecord.display as Record<string, unknown>)
                .freeAgentType === 'string'
                ? ((bioRecord.display as Record<string, unknown>)
                    .freeAgentType as string)
                : null,
            team:
              typeof (bioRecord.display as Record<string, unknown>).team ===
              'string'
                ? ((bioRecord.display as Record<string, unknown>).team as string)
                : null,
          }
        : null,
    team:
      typeof bioRecord.team === 'string' ? bioRecord.team : null,
  };
};

export const toLocalContract = (
  contract:
    | ArchitectDashboardPlayer['contract']
    | ArchitectPlayer['contract']
    | null
    | undefined
): LocalContract | undefined => {
  if (!contract) {
    return undefined;
  }

  return {
    ...contract,
    salariesByYear: Array.isArray(contract.salariesByYear)
      ? contract.salariesByYear
          .map((row) => toNormalizedSalaryRow(row))
          .filter((row): row is SalaryByYear => row !== null)
      : undefined,
    birdRights: contract.birdRights
      ? { ...contract.birdRights }
      : undefined,
    freeAgency: contract.freeAgency ?? undefined,
  };
};

export const toArchitectActionPlayer = (
  player: ArchitectDashboardPlayer | ArchitectPlayer | null | undefined
): ArchitectPlayer | null => {
  if (!player) {
    return null;
  }

  return {
    ...player,
    contract: toLocalContract(player.contract) ?? null,
    futureContract: toLocalContract(player.futureContract) ?? null,
    bio: toLocalBio(player.bio),
    experience:
      typeof player.experience === 'number' || typeof player.experience === 'string'
        ? player.experience
        : null,
    'Years Pro':
      typeof player['Years Pro'] === 'number' ||
      typeof player['Years Pro'] === 'string'
        ? player['Years Pro']
        : null,
  };
};

export const toSigningValidationTeam = (
  team: UseArchitectStateReturn['teamCapSheet'] | CapSheet | null | undefined
): SigningValidationTeam | null => {
  if (!team) {
    return null;
  }

  return {
    teamCode: normalizeOptionalMutationString(team.teamCode) ?? null,
    teamName: normalizeOptionalMutationString(team.teamName) ?? null,
    players: Array.isArray(team.players)
      ? team.players
          .map((player) => toArchitectActionPlayer(player))
          .filter((player): player is ArchitectPlayer => player !== null)
      : undefined,
    roster: Array.isArray(team.roster) ? team.roster : undefined,
    capHolds: toSigningValidationCapHolds(team.capHolds),
    deadCap: Array.isArray(team.deadCap) ? team.deadCap : undefined,
    exceptions: team.exceptions ?? undefined,
    totals: team.totals ?? undefined,
  };
};

export const toSigningValidationCapHolds = (
  capHolds: ArchitectActionTeamCapSheet['capHolds'] | CapSheet['capHolds']
): SigningValidationCapHold[] | undefined => {
  if (!Array.isArray(capHolds)) {
    return undefined;
  }

  return capHolds.map((hold): SigningValidationCapHold => {
    const holdRecord =
      hold && typeof hold === 'object'
        ? (hold as Record<string, unknown>)
        : {};

    return {
      playerId:
        typeof holdRecord.playerId === 'string' ||
        typeof holdRecord.playerId === 'number'
          ? holdRecord.playerId
          : null,
      playerName: normalizeOptionalMutationString(
        typeof holdRecord.playerName === 'string'
          ? holdRecord.playerName
          : undefined
      ),
      amount:
        typeof holdRecord.amount === 'number' ? holdRecord.amount : undefined,
      type: normalizeOptionalMutationString(
        typeof holdRecord.type === 'string' ? holdRecord.type : undefined
      ),
      season: normalizeOptionalMutationString(
        typeof holdRecord.season === 'string' ? holdRecord.season : undefined
      ),
      reason: normalizeOptionalMutationString(
        typeof holdRecord.reason === 'string' ? holdRecord.reason : undefined
      ),
      active:
        typeof holdRecord.active === 'boolean' ? holdRecord.active : undefined,
      isSigned:
        typeof holdRecord.isSigned === 'boolean'
          ? holdRecord.isSigned
          : undefined,
    };
  });
};

export const toSigningValidationPlayer = (
  player: ArchitectDashboardPlayer | ArchitectPlayer | null | undefined
): SigningValidationPlayer | null => {
  return toArchitectActionPlayer(player);
};

export const toFreeAgentComputeTeam = (
  team: UseArchitectStateReturn['teamCapSheet'] | CapSheet | null | undefined
): FreeAgentComputeState['team'] | null => {
  if (!team) {
    return null;
  }

  return {
    ...team,
    players: Array.isArray(team.players)
      ? team.players
          .map((player) => toArchitectActionPlayer(player))
          .filter((player): player is ArchitectPlayer => player !== null)
      : undefined,
    roster: Array.isArray(team.roster)
      ? team.roster.map((playerId) => String(playerId))
      : undefined,
    capHolds: Array.isArray(team.capHolds) ? team.capHolds : undefined,
    deadCap: Array.isArray(team.deadCap) ? team.deadCap : undefined,
    exceptions: team.exceptions ?? undefined,
    totals: team.totals ?? undefined,
    offerSheets: team.offerSheets ?? undefined,
    incomingOfferSheets: team.incomingOfferSheets ?? undefined,
  };
};

export const toFreeAgentComputeState = (
  team: UseArchitectStateReturn['teamCapSheet'] | CapSheet | null | undefined,
  player: ArchitectDashboardPlayer | ArchitectPlayer | null | undefined,
  teamCode: string
): FreeAgentComputeState | null => {
  const normalizedTeam = toFreeAgentComputeTeam(team);
  const normalizedPlayer = toSigningValidationPlayer(player);

  if (!normalizedTeam || !normalizedPlayer) {
    return null;
  }

  return {
    team: normalizedTeam,
    player: normalizedPlayer,
    teamCode,
  } as FreeAgentComputeState;
};

export const toSignAndTradeValidationContract = (
  contract: SignAndTradeContractLike | LocalContract | null | undefined
): SignAndTradeContractLike | null => {
  if (!contract) {
    return null;
  }

  return {
    ...contract,
    signAndTrade:
      contract.signAndTrade === null ? undefined : contract.signAndTrade,
    years:
      typeof contract.years === 'string'
        ? Number(contract.years) || null
        : contract.years ?? null,
    contractYears:
      typeof contract.contractYears === 'string'
        ? Number(contract.contractYears) || null
        : contract.contractYears ?? null,
    firstYearGuaranteed:
      typeof contract.firstYearGuaranteed === 'boolean'
        ? contract.firstYearGuaranteed
        : null,
    salariesByYear: Array.isArray(contract.salariesByYear)
      ? contract.salariesByYear.map(
          (row): SignAndTradeSalaryRow => ({
            ...row,
            guaranteed:
              typeof row.guaranteed === 'boolean'
                ? row.guaranteed
                : undefined,
          })
        )
      : null,
  };
};
