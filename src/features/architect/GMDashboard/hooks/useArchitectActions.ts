/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Dashboard action orchestration adapter.
 * - Owns only non-authoritative local-validated apply, optimistic local
 *   preview, and DEV synthetic fixture seams inside the dashboard.
 * - Routes committed mutation writes through mutationPipeline.ts.
 * - Decides changedTeams reuse vs committed-snapshot reload fallback after commit.
 * - Uses dashboard-facing reload adapters after commits so UI state stays aligned.
 * - Does not replace mutationPipeline.ts or seasonManager.ts as committed authorities.
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.tsx (Phase 3 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-14: Option B refactor - removed capSheetState dependency, all mutations now update teamCapSheet directly
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold multipliers
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-2/plan.md
 */
import { useCallback, useMemo } from 'react';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  applyWorldMutation,
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  findUpdatedTeamSnapshot,
  preflightSignAndTradeMutation,
  preflightOfferSheetMutation,
  type ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  type ArchitectGeneralMutationCommittedTeamUpdate,
  type ArchitectMutationContract,
  type ArchitectMutationDeadCapEntry,
  type ArchitectMutationExceptionEntry,
  type ArchitectMutationExceptions,
  type ArchitectMutationPayload,
  type ArchitectMutationResult,
  type SignAndTradePreflightResult,
  type OfferSheetPreflightResult,
  type NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';
import type { ManualExceptionsSavePayload } from '@/features/architect/capSheet/CapSheet/CapSheet';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  loadWorldTeamData,
  resolveTeamCode,
} from '@/features/architect/utils/worldTeamData';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  buildAuthoritativeLinkEstablishedAuditPatch,
  buildPersistFailedRolledBackAuditPatch,
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM,
  type LocalCapAuditLifecycleState,
  WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM,
  appendLocalCapAuditEvent,
  withLocalCapAuditLifecycleState,
  updateLocalCapAuditEvent,
  type CapAuditEventV1Like,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import {
  type SignAndTradeContractLike,
  type SignAndTradeSalaryRow,
  validateSignAndTradeContractPayload,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  BasePlayerContract,
  BasePlayerDoc,
  DeadCapItem,
  Exceptions,
  PlayerRulesProfileInput,
} from '@/features/architect/types';
import {
  acquireOptimisticLock,
  releaseOptimisticLock,
} from './optimisticMutationLock';
import {
  clearCapSheetFixtures,
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
  hasInjectedCapSheetFixtures as hasInjectedCapSheetFixturesInTeam,
  injectCapSheetFixtures,
} from '@/features/architect/capSheet/devCapSheetFixtures';
import {
  clearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures as hasInjectedTeamHistoryFixturesInTeam,
  injectTeamHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
import type { CapHold as SharedCapHold } from '@/features/architect/utils/capHolds';
import type { CapSheetModalActionType } from '@/features/architect/capSheet/CapSheetFull/CapSheetFull';
import toast from 'react-hot-toast';
import type {
  ArchitectDashboardCapSheet,
  ArchitectDashboardPlayer,
  ReloadActiveWorldMetadataPatch,
  UseArchitectStateReturn,
} from './useArchitectState';

// ==== Type Definitions ====

type StatePlayersMap = UseArchitectStateReturn['playersMap'];
type ArchitectActionTeamCapSheet = NonNullable<
  UseArchitectStateReturn['teamCapSheet']
>;
type ComputeWorldMutationArgs = Parameters<typeof computeWorldMutation>[0];
type SignFreeAgentComputeArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'signFreeAgent' }
>;
type ExecuteTradeComputeArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'executeTrade' }
>;
type FreeAgentComputeState = SignFreeAgentComputeArgs['currentState'];
type ExecuteTradeCurrentState = ExecuteTradeComputeArgs['currentState'];
type TradeMutationPayloadTeam = NonNullable<
  ArchitectMutationPayload['teams']
>[number];
type TradeMutationPayloadEntitlement = NonNullable<
  TradeMutationPayloadTeam['outgoingEntitlements']
>[number];
type SigningValidationTeam = Parameters<typeof validateSigning>[0]['team'];
type SigningValidationPlayer = Parameters<typeof validateSigning>[0]['player'];
type SigningValidationCapHold = NonNullable<
  SigningValidationTeam['capHolds']
>[number];

/** Salary entry by year in a contract — canonical (normalized) form. */
type SalaryByYear = NormalizedMutationSalaryRow;

type LocalContractLegacySalaryInput =
  | number
  | string
  | {
      salary?: number | string | null;
      season?: string | null;
    };

interface LocalBirdRights {
  status?: string | null;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
}

/** Local contract structure for architect actions (avoids schema naming pattern) */
type LocalContract = ArchitectMutationContract &
  Omit<
    Partial<BasePlayerContract>,
    | 'birdRights'
    | 'freeAgency'
    | 'salariesByYear'
    | keyof ArchitectMutationContract
  > & {
    salariesByYear?: SalaryByYear[];
    salaries?: LocalContractLegacySalaryInput[];
    guaranteed?: boolean | null;
    isMinimum?: boolean | null;
    signAndTrade?: boolean | null;
    yearsOfService?: number | string | null;
    averageAnnualValue?: number | null;
    base?: number | null;
    birdRights?: LocalBirdRights;
    freeAgency?:
      | { year?: number | string | null; type?: string | null }
      | string
      | null;
  };

/** Bio structure for player data (avoids schema naming pattern) */
interface LocalBio {
  playerId?: string | null;
  displayName?: string | null;
  position?: string | null;
  age?: number;
  height?: number | string | null;
  weight?: number | string | null;
  draftRound?: number | null;
  draftPick?: number | string | null;
  yearsExperience?: number;
  experience?: number | string | null;
  'Years Pro'?: number | string | null;
  display?: { freeAgentType?: string | null; team?: string | null } | null;
  team?: string | null;
}

/** Player data structure */
type ArchitectPlayer = Omit<
  ArchitectDashboardPlayer,
  'bio' | 'contract' | 'futureContract'
> & {
  formattedPosition?: string | null;
  contract?: LocalContract | null;
  futureContract?: LocalContract | null;
  bio?: LocalBio;
  representation?: BasePlayerDoc['representation'] | null;
  options?: Record<string, unknown>;
  isMinimum?: boolean;
  yearsOfService?: number | string | null;
  yearsPro?: number | string | null;
  experience?: number | string | null;
  ['Years Pro']?: number | string | null;
  guaranteed?: boolean;
  signAndTrade?: boolean;
  signAndTradeContract?: SignAndTradeContractLike | null;
  receivingTeamId?: string | null;
  tradeTo?: string | null;
  toTeamId?: string | null;
  destTeamId?: string | null;
  rightsRenounced?: boolean;
  contractYears?: number | string | null;
  firstYearGuaranteed?: boolean | null;
  contractType?: string | null;
  isExtension?: boolean | null;
  isRookieScale?: boolean | null;
  // Physical attributes (fallback from bio)
  height?: number | string | null;
  height_ft_in?: string | null;
  weight?: number | string | null;
  weight_lbs?: number | null;
  draftPick?: number | string | null;
  // Salary variants
  salary?: number | null;
  baseSalary?: number | null;
  newSalary?: number | null;
  currentSalary?: number | null;
  previousSalary?: number | null;
  matchIncoming?: number | null;
  matchingValue?: number | null;
  askingSalary?: number | null;
  // Consent/rights
  limitedNTCTeamIds?: (string | number)[] | null;
  ntcTeamList?: (string | number)[] | null;
  hasNoTradeClause?: boolean;
  hasProvidedConsent?: boolean;
  // Free agency
  freeAgentType?: string | null;
  fa_type?: string | null;
  // Experience variants
  years_of_service?: number | string | null;
};

/**
 * TradeMachine draft handoff for a single team.
 * This is a wrapper/editor staging shape only; the action layer must
 * normalize it into the authoritative executeTrade payload before any
 * committed world mutation or base-mode preview apply can run.
 */
interface TradeDataItem {
  teamId: string;
  incoming?: ArchitectPlayer[];
  outgoing?: ArchitectPlayer[];
  /** TM-PICKS-E1: Entitlements this team is trading away */
  outgoingEntitlements?: TradeMutationPayloadEntitlement[];
  /** TM-PICKS-E1: Entitlements this team is receiving */
  incomingEntitlements?: TradeMutationPayloadEntitlement[];
  /** Alias used by exportCurrentTrade */
  outgoingPlayers?: ArchitectPlayer[];
  incomingPlayers?: ArchitectPlayer[];
}

type TradeExecutionPayload = {
  teams: NonNullable<ArchitectMutationPayload['teams']>;
  asOfDate?: string;
  tradeCtx: {
    source: 'tradeMachine';
    worldId: string | null;
    yearKey: number;
    asOfDate?: string;
  };
};

type TradeExecutionHandoff = {
  resolvedTeamCodes: string[];
  payload: TradeExecutionPayload;
};

/** Contract details for signing/saving (avoids schema naming pattern) */
type SigningDetails = Omit<Partial<LocalContract>, 'birdRights'> & {
  salariesByYear?: SalaryByYear[];
  options?: Record<string, unknown>;
  guaranteed?: boolean;
  isMinimum?: boolean;
  yearsOfService?: number | null;
  rfaOfferSheet?: boolean;
  rfaOfferSheetOnly?: boolean;
  base?: number | null;
  birdRights?: LocalContract['birdRights'] | string | null;
  // Override metadata when action bypasses validation
  overrideUsed?: boolean;
  overrideReasons?: string[];
  overrideTimestamp?: string;
};

/** Waive options */
interface WaiveOptions {
  stretch?: boolean;
  buyout?: boolean;
  buyoutAmount?: number;
  // Override metadata when action bypasses validation
  overrideUsed?: boolean;
  overrideReasons?: string[];
  overrideTimestamp?: string;
}

/** Active contract entry in cap sheet */
interface ActiveContract {
  name?: string;
  player_id?: string;
  id?: string;
  years?: number;
  options?: Record<string, unknown>;
  type?: string;
  signAndTrade?: boolean;
  guaranteed?: boolean;
  isMinimum?: boolean;
  yearsOfService?: number;
  contract?: LocalContract;
}

/** Cap hold structure */
type CapHold = Omit<SharedCapHold, 'playerId' | 'active'> & {
  playerId?: SharedCapHold['playerId'] | number | null;
  active?: boolean | null;
  notes?: string | null;
};

type CapHoldActionItem = Partial<
  Omit<CapHold, 'amount' | 'playerId' | 'playerName'>
> & {
  amount?: unknown;
  playerId?: CapHold['playerId'];
  playerName?: string | null;
};

type DeadCapEntry = ArchitectMutationDeadCapEntry & {
  id?: string | null;
  playerId?: string | number | null;
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

type ArchitectExceptionsLike = Omit<
  Exceptions,
  'mle' | 'taxpayerMle' | 'room' | 'bae' | 'dpe' | 'tpe'
> &
  ArchitectMutationExceptions & {
    mle?: ArchitectMutationExceptionEntry | null;
    taxpayerMle?: ArchitectMutationExceptionEntry | null;
    room?: ArchitectMutationExceptionEntry | null;
    bae?: ArchitectMutationExceptionEntry | null;
    dpe?: ArchitectMutationExceptionEntry | null;
    roomMLE?: ArchitectMutationExceptionEntry | null;
  };
type ManualCapSheetLedgerMutationParams =
  | {
      type: 'deadCap';
      deadCap: DeadCapEntry[];
    }
  | {
      type: 'exceptions';
      exceptions: ManualExceptionsSavePayload;
    };

/** Override audit log entry */
interface OverrideAuditEntry {
  actionType: string;
  timestamp: string;
  reasons: string[];
  overrideUsed: true;
  playerId?: string;
  playerName?: string;
}

/** Cap sheet structure */
type CapSheet = Omit<
  ArchitectDashboardCapSheet,
  'players' | 'deadCap' | 'capHolds' | 'exceptions'
> & {
  players?: ArchitectPlayer[];
  activeContracts?: ActiveContract[];
  deadCap?: DeadCapEntry[] | null;
  capHolds?: CapHold[] | null;
  exceptions?: ArchitectExceptionsLike | null;
  overrideAuditLog?: OverrideAuditEntry[];
};

/** Override metadata passed from EditContractModal when bypassing validation */
interface OverrideMetadata {
  overrideUsed: boolean;
  overrideReasons: string[];
  overrideTimestamp: string;
}

interface MutationActionResult {
  success: boolean;
  message?: string;
}

const normalizeOptionalMutationString = (
  value: string | null | undefined
): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOptionalMutationNumber = (
  value: number | null | undefined
): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const normalizeManualExceptionsForMutation = (
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

const toNormalizedSalaryRow = (
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

const toLocalBio = (
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

const toLocalContract = (
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

const toArchitectActionPlayer = (
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

const toSigningValidationTeam = (
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

const toSigningValidationCapHolds = (
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

const toSigningValidationPlayer = (
  player: ArchitectDashboardPlayer | ArchitectPlayer | null | undefined
): SigningValidationPlayer | null => {
  return toArchitectActionPlayer(player);
};

const toFreeAgentComputeTeam = (
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

const toFreeAgentComputeState = (
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

const toSignAndTradeValidationContract = (
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

interface CapSheetDevTools {
  injectLocalFixtures: () => MutationActionResult;
  clearLocalFixtures: () => MutationActionResult;
  hasInjectedLocalFixtures: boolean;
  localStateOwner: typeof DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER;
  syntheticCoverageBoundary: typeof DEV_CAP_SHEET_FIXTURE_BOUNDARY;
  runtimeBoundary: typeof DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY;
  injectFixtures: () => MutationActionResult;
  clearFixtures: () => MutationActionResult;
  hasInjectedFixtures: boolean;
}

interface TeamHistoryDevTools {
  injectFixtures: () => MutationActionResult;
  clearFixtures: () => MutationActionResult;
  hasInjectedFixtures: boolean;
}

type PersistMutationResult = ArchitectMutationResult & {
  skipped?: boolean;
  changedTeams?: ArchitectGeneralMutationCommittedTeamUpdate[];
  event?:
    | CapAuditEventV1Like
    | { operationId?: string; type?: string; timestamp?: string };
};

type ComputeMutationResult = ArchitectMutationResult;

type MutationTruthResult = Pick<
  ArchitectMutationResult,
  | 'success'
  | 'error'
  | 'appliedToLocalState'
  | 'persistedToWorld'
  | 'writesSummary'
> & {
  skipped?: boolean;
};

interface OfferSheet {
  id?: string;
  status?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
}

type OfferSheetResolutionAction = 'match' | 'decline';
type OfferSheetResolutionMutationType = 'matchOfferSheet' | 'declineOfferSheet';
type OfferSheetLifecycleMutationType =
  | OfferSheetResolutionMutationType
  | 'finalizeMatchedOfferSheet'
  | 'finalizeDeclinedOfferSheet';
type OfferSheetLifecycleVisibleArrayKey = 'incomingOfferSheets' | 'offerSheets';
type OfferSheetLifecycleExpectationPresence = 'present' | 'absent';
type OfferSheetFinalizeMutationRoute =
  | {
      ok: true;
      mutationType: 'finalizeMatchedOfferSheet';
      payload: {
        teamCode: string;
        offeringTeamCode?: string;
        offerSheetId: string;
      };
    }
  | {
      ok: true;
      mutationType: 'finalizeDeclinedOfferSheet';
      payload: {
        teamCode: string;
        offeringTeamCode: string;
        homeTeamCode?: string;
        offerSheetId: string;
        dedupKey?: string;
        playerId?: string;
        seasonKey?: string;
      };
    }
  | {
      ok: false;
      message: string;
      logContext?: Record<string, unknown>;
    };

interface OfferSheetMutationMetadata {
  type?: string | null;
  teamCode?: string | null;
  playerId?: string | null;
  offerSheetId?: string | null;
  dedupKey?: string | null;
  seasonKey?: string | null;
  offeringTeam?: string | null;
  offeringTeamCode?: string | null;
  homeTeam?: string | null;
  homeTeamCode?: string | null;
  status?: string | null;
}

interface OfferSheetCommittedIdentity {
  dedupKey: string | null;
  offerSheetId: string | null;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
  status: 'PENDING_MATCH';
}

interface OfferSheetCommittedState {
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: 'changedTeams' | 'reload';
  committedOfferSheet: OfferSheet;
  committedOfferSheetIdentity: OfferSheetCommittedIdentity;
}

interface OfferSheetLifecycleCommittedIdentityInput {
  dedupKey?: string | null;
  offerSheetId?: string | null;
  playerId?: string | null;
  seasonKey?: string | null;
  offeringTeamCode?: string | null;
  homeTeamCode?: string | null;
  status?: string | null;
}

interface OfferSheetLifecycleCommittedIdentity {
  dedupKey: string | null;
  offerSheetId: string | null;
  playerId: string | null;
  seasonKey: string | null;
  offeringTeamCode: string | null;
  homeTeamCode: string | null;
  status: string | null;
}

interface OfferSheetLifecycleCommittedStateExpectation {
  activeTeamArrayKey: OfferSheetLifecycleVisibleArrayKey;
  presence: OfferSheetLifecycleExpectationPresence;
  identity: OfferSheetLifecycleCommittedIdentityInput;
}

interface OfferSheetLifecycleCommittedState {
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: 'changedTeams' | 'reload';
  committedOfferSheet: OfferSheet | null;
  committedOfferSheetIdentity: OfferSheetLifecycleCommittedIdentity;
  expectation: OfferSheetLifecycleCommittedStateExpectation;
}

type OfferSheetCommittedStateResolution =
  | {
      ok: true;
      value: OfferSheetCommittedState;
    }
  | {
      ok: false;
      message: string;
      logContext: Record<string, unknown>;
    };

type OfferSheetStoreExecutionResult =
  | ({
      success: true;
    } & OfferSheetCommittedState)
  | {
      success: false;
      message: string;
    };

type OfferSheetLifecycleCommittedStateResolution =
  | {
      ok: true;
      value: OfferSheetLifecycleCommittedState;
    }
  | {
      ok: false;
      message: string;
      logContext: Record<string, unknown>;
    };

type OfferSheetLifecycleExecutionResult =
  | ({
      success: true;
    } & OfferSheetLifecycleCommittedState)
  | {
      success: false;
      message: string;
    };

const OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE =
  'Offer sheet lifecycle action saved but the committed team snapshot could not be reloaded.';
const OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE =
  'Offer sheet lifecycle action saved but the committed lifecycle state could not be verified in the active team snapshot.';

const MANUAL_EXCEPTION_MUTATION_KEYS = [
  'mle',
  'tpmle',
  'taxpayerMle',
  'tpMle',
  'miniMle',
  'bae',
  'biAnnual',
  'room',
  'roomMLE',
  'roommle',
  'rmle',
] as const;

function mergeManualExceptionSnapshot(
  existingExceptions: Record<string, unknown> | null | undefined,
  editedExceptions: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const merged = {
    ...((existingExceptions &&
    typeof existingExceptions === 'object' &&
    !Array.isArray(existingExceptions)
      ? existingExceptions
      : {}) as Record<string, unknown>),
  };

  for (const key of MANUAL_EXCEPTION_MUTATION_KEYS) {
    delete merged[key];
  }

  if (
    editedExceptions &&
    typeof editedExceptions === 'object' &&
    !Array.isArray(editedExceptions)
  ) {
    Object.assign(merged, editedExceptions);
  }

  return merged;
}

import type {
  ActionContext,
  UseArchitectModalsReturn,
} from './useArchitectModals';

/** Modal helpers from useArchitectModals (subset needed by actions) */
type ArchitectModalsForActions = Pick<
  UseArchitectModalsReturn,
  'openContractModal' | 'closeContractModal'
>;

type ArchitectStateForActions = Omit<
  Pick<
    UseArchitectStateReturn,
    | 'teamCapSheet'
    | 'currentYear'
    | 'worldAsOfDate'
    | 'setTeamCapSheet'
    | 'setSelectedRulesYear'
    | 'setSelectedPlayer'
    | 'setFreeAgents'
    | 'startSave'
    | 'finishSave'
    | 'setOffseasonRun'
    | 'setOffseasonSummary'
    | 'refreshWorldRosterIndex'
  >,
  'worldAsOfDate'
> & {
  worldAsOfDate?: UseArchitectStateReturn['worldAsOfDate'];
  reloadActiveWorldTeamData?: UseArchitectStateReturn['reloadActiveWorldTeamData'];
};

/** Hook input parameters */
export interface UseArchitectActionsParams {
  teamId: string;
  userId: string | null;
  authLoading?: boolean;
  state: ArchitectStateForActions;
  playersMap: StatePlayersMap;
  modals: ArchitectModalsForActions;
  worldId: string | null;
  seasonId: string;
}

/**
 * Standard free-agency signing lane.
 * This is the base/vacuum-safe entrypoint that Free Agency surfaces may always
 * treat as available for ordinary sign/resign flows.
 */
export interface FreeAgencyDualPathSigningOwner {
  signFreeAgent: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
}

export type FreeAgentModalVisibleAction = 'signNew' | 'signAndTrade';

/**
 * World-only offer-sheet creation initiators exposed through the modal layer
 * when the action contract has an active world behind it.
 */
export interface FreeAgentOfferSheetInitiation {
  getOfferSheetPreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<OfferSheetPreflightResult>;
  storeOfferSheet: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
}

/**
 * FreeAgentPool visual-gating contract.
 * The pool should treat the visible actions, labels, and optional world-only
 * initiators here as upstream truth from the action layer rather than
 * reconstructing availability locally.
 */
export interface FreeAgentModalAvailability {
  visibleActions: FreeAgentModalVisibleAction[];
  actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
  showOfferSheetToggle: boolean;
  signAndTradeInitiation: FreeAgentSignAndTradeInitiation | null;
  offerSheetInitiation: FreeAgentOfferSheetInitiation | null;
}

/**
 * World-only Free Agency mutation lane.
 * This contract is published only when an active world exists; section/pool
 * surfaces must not assume these entrypoints exist in base/vacuum mode.
 */
export interface FreeAgencyWorldOnlyModalActionOwner {
  signAndTrade: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<MutationActionResult>;
  getSignAndTradePreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<SignAndTradePreflightResult>;
  getOfferSheetPreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<OfferSheetPreflightResult>;
  storeOfferSheet: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
}

/**
 * World-only offer-sheet lifecycle routing contract.
 * The action layer owns these routes; section surfaces only forward UI intent.
 */
export interface FreeAgencyOfferSheetLifecycleActionOwner {
  matchOfferSheet: (offeringTeamCode: string, offerSheetId: string) => void;
  declineOfferSheet: (offeringTeamCode: string, offerSheetId: string) => void;
  finalizeOfferSheet: (offerSheet: OfferSheet | null | undefined) => void;
}

export interface FreeAgencyWorldOnlyActionOwner
  extends FreeAgencyWorldOnlyModalActionOwner,
    FreeAgencyOfferSheetLifecycleActionOwner {}

/**
 * Narrow FreeAgentPool handoff contract.
 * The pool owns list rendering and modal launch wiring only; it does not own
 * offer-sheet lifecycle routing or world-only disabled messaging.
 */
export interface FreeAgentPoolActionOwner {
  dualPathSigning: FreeAgencyDualPathSigningOwner;
  freeAgentModalAvailability: FreeAgentModalAvailability;
}

export interface FreeAgentSignAndTradeInitiation {
  onSignAndTrade: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<MutationActionResult>;
  getSignAndTradePreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<SignAndTradePreflightResult>;
}

/**
 * Section-level offer-sheet lifecycle availability contract.
 * FreeAgencySection should render disabled messaging and lifecycle list wiring
 * from this published surface instead of inferring world gating on its own.
 */
export interface FreeAgencyOfferSheetSectionAvailability {
  lifecycleActionOwner: FreeAgencyOfferSheetLifecycleActionOwner | null;
  actionsDisabled: boolean;
  actionsDisabledReason: string | null;
}

/**
 * Published Free Agency cross-surface contract bundle.
 * Consumers should read this as a contract map, not a generic bag of actions:
 * - `dualPathSigning`: standard signing/resigning, available in base or world mode
 * - `worldOnly`: world-backed mutation/preflight routes only
 * - `freeAgentModalAvailability`: visual/modal gating truth for FreeAgentPool
 * - `offerSheetSectionAvailability`: list gating + lifecycle availability truth for FreeAgencySection
 */
export interface FreeAgencyActionOwner {
  dualPathSigning: FreeAgencyDualPathSigningOwner;
  worldOnly: FreeAgencyWorldOnlyActionOwner | null;
  freeAgentModalAvailability: FreeAgentModalAvailability;
  offerSheetSectionAvailability: FreeAgencyOfferSheetSectionAvailability;
}

/** Return type of the useArchitectActions hook */
export interface UseArchitectActionsReturn {
  freeAgencyActionOwner: FreeAgencyActionOwner;

  // Contract/Player actions
  handleSign: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
  handleSignAndTrade: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<MutationActionResult>;
  getSignAndTradePreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => Promise<SignAndTradePreflightResult>;
  getOfferSheetPreflight: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<OfferSheetPreflightResult>;
  handleEditContract: (
    player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer
  ) => void;
  handleCapTableModalAction: (
    player: PlayerRulesProfileInput,
    actionType: CapSheetModalActionType,
    year: number
  ) => void;
  handleCapHoldRenounce: (capHold: CapHoldActionItem) => void;
  handleExtendContract: (
    player: ArchitectPlayer,
    extensionContract: SigningDetails
  ) => Promise<MutationActionResult>;
  handleWaiveContract: (
    player: ArchitectPlayer,
    options: WaiveOptions
  ) => Promise<MutationActionResult>;
  handleOptionDecision: (
    player: ArchitectPlayer,
    accepted: boolean,
    overrideMetadata?: OverrideMetadata | null,
    targetYearOverride?: number | null
  ) => Promise<MutationActionResult>;
  handleRenounceRights: (
    player: ArchitectPlayer,
    overrideMetadata?: OverrideMetadata | null
  ) => Promise<MutationActionResult>;

  // RFA Offer Sheet Actions (Phase 16)
  handleStoreOfferSheet: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
  handleMatchOfferSheet: (
    offeringTeamCode: string,
    offerSheetId: string
  ) => void;
  handleDeclineOfferSheet: (
    offeringTeamCode: string,
    offerSheetId: string
  ) => void;
  handleFinalizeOfferSheet: (offerSheet: OfferSheet | null | undefined) => void;

  // Trade actions
  applyTradeToCapSheet: (tradeData: TradeDataItem[]) => Promise<void>;

  // Manual Dead Money (Phase 24)
  handleSetDeadCap: (deadCap: DeadCapEntry[]) => Promise<boolean>;

  // Manual Exception Management (Phase 27)
  handleSetExceptions: (
    exceptions: ManualExceptionsSavePayload
  ) => Promise<boolean>;

  // DEV-only tool surfaces
  capSheetDevTools: CapSheetDevTools;
  teamHistoryDevTools: TeamHistoryDevTools;
}

// Helper to ensure contract has proper structure
export const ensureContractStructure = (
  contract: LocalContract | null | undefined,
  overrides: Partial<LocalContract> = {}
): LocalContract | null => {
  if (!contract) return null;

  const mutableOverrides: Partial<LocalContract> = { ...overrides };
  const startYearOverride = Number(
    mutableOverrides.startYear ?? contract.startYear ?? contract.year
  );
  delete mutableOverrides.startYear;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...mutableOverrides,
    };
  }

  // Legacy UI payload fallback: convert salaries[] to canonical salariesByYear[]
  const legacySalaries = contract.salaries;
  if (Array.isArray(legacySalaries) && legacySalaries.length > 0) {
    const yearsRaw = Number(contract.years) || legacySalaries.length;
    const years = Math.max(1, Math.min(yearsRaw, legacySalaries.length));
    const startYear = Number.isFinite(startYearOverride)
      ? startYearOverride
      : new Date().getFullYear();

    const salariesByYear = legacySalaries.slice(0, years).map((row, idx) => {
      const salaryRaw =
        typeof row === 'number'
          ? row
          : typeof row === 'string'
            ? Number(row)
            : Number(row?.salary);
      const salary = Number.isFinite(salaryRaw) ? Math.round(salaryRaw) : 0;
      return {
        season: toSeasonCode(startYear + idx),
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
        option: null,
        optionType: null,
        optionUsed: null,
      };
    });

    return {
      ...contract,
      ...mutableOverrides,
      salariesByYear,
    };
  }

  // If no contract data, return null
  return null;
};

export const deriveSigningMechanism = (
  contract: SigningDetails | null | undefined
): string | null => {
  const signedUsingRaw = contract?.signedUsing ?? contract?.exceptionType;
  const normalized =
    typeof signedUsingRaw === 'string' ? signedUsingRaw.trim() : '';
  if (!normalized || normalized.toLowerCase() === 'none') {
    return null;
  }
  return normalized;
};

const MINIMUM_SIGNING_HEURISTIC = 2_200_000;

function hasStagedScalarSigningSalaries(
  contract: SigningDetails | LocalContract | null | undefined
): contract is SigningDetails & { salaries: LocalContractLegacySalaryInput[] } {
  return Array.isArray(contract?.salaries) && contract.salaries.length > 0;
}

function stripPrebuiltSigningRowsForAuthority(
  contract: SigningDetails | null | undefined
): LocalContract | null {
  if (!contract) {
    return null;
  }

  if (!hasStagedScalarSigningSalaries(contract)) {
    return contract as LocalContract;
  }

  const { salariesByYear: _ignoredPrebuiltRows, ...stagedContract } =
    contract as LocalContract;
  return stagedContract;
}

function normalizeFiniteNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function deriveSigningYearsOfService(
  playerObj: ArchitectPlayer,
  contract: SigningDetails | null | undefined
): number | null {
  const candidates = [
    contract?.yearsOfService,
    playerObj.yearsOfService,
    playerObj.yearsPro,
    playerObj.experience,
    playerObj.years_of_service,
    playerObj.bio?.experience,
    playerObj.bio?.yearsExperience,
    playerObj.bio?.['Years Pro'],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFiniteNumber(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

type AuthoritativeSigningPreparationOverrides = Partial<LocalContract> & {
  contractType: string;
};

type PreparedAuthoritativeSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  architectContract: LocalContract | null;
  signedUsing: string | null;
};

type StandardSigningMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

type PreparedStandardSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  standardSigningPayload: StandardSigningMutationPayload | null;
};

type SignAndTradeMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  destinationTeamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
  signAndTrade: true;
};

type SignAndTradeTransactionPreparationFailure = {
  ok: false;
  message: string;
  preflightResult: SignAndTradePreflightResult;
  logContext?: Record<string, unknown>;
};

type PreparedSignAndTradeTransactionDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      mutationPayload: SignAndTradeMutationPayload;
    }
  | SignAndTradeTransactionPreparationFailure;

type OfferSheetCreationDefinitionFailure = {
  ok: false;
  storeMessage: string;
  preflightResult: OfferSheetPreflightResult;
  logContext?: Record<string, unknown>;
};

type OfferSheetMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

type PreparedOfferSheetCreationDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      preflightPayload: {
        offeringTeamCode: string;
        playerId: string;
        contract: LocalContract;
      };
      mutationPayload: OfferSheetMutationPayload;
    }
  | OfferSheetCreationDefinitionFailure;

type DashboardMutationPropagationMode = 'world-committed' | 'local-validated';
type WorldCommittedTeamSource = 'changedTeams' | 'reload';
type DashboardCommittedTeamSnapshot = NonNullable<
  UseArchitectStateReturn['teamCapSheet']
>;
const toDashboardCommittedTeamSnapshot = (
  team: ArchitectGeneralMutationDashboardReloadTeamSnapshot
): DashboardCommittedTeamSnapshot =>
  ({
    ...team,
    hardCapped:
      typeof team.hardCapped === 'boolean' ? team.hardCapped : undefined,
  }) as DashboardCommittedTeamSnapshot;

/**
 * Dashboard post-mutation propagation lane.
 * - `world-committed`: authoritative world persistence already succeeded, so
 *   visible reapply must go back through the committed-world reload/state seam.
 * - `local-validated`: no authoritative world write exists, so the validated
 *   local snapshot can be applied directly by the action layer.
 */
type WorldCommittedTeamPropagation = {
  propagationMode: 'world-committed';
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: WorldCommittedTeamSource;
};
type CommittedWorldReloadSeed = Pick<
  WorldCommittedTeamPropagation,
  'committedTeam' | 'committedTeamSource'
>;
type LocalValidatedTeamPropagation = {
  propagationMode: 'local-validated';
  localValidatedTeam: CapSheet;
  localValidatedTeamSource: 'compute';
};
type ResolvedCommittedWorldTeam = WorldCommittedTeamPropagation;
type CommittedWorldReloadPlan = {
  committedWorldTeam: ResolvedCommittedWorldTeam;
  committedWorldMetadata: ReloadActiveWorldMetadataPatch | null;
  refreshRosterBundle: boolean;
};
type CommittedWorldReloadResult =
  | {
      status: 'applied';
      committedWorldTeam: ResolvedCommittedWorldTeam;
    }
  | {
      status: 'stale-drop';
    };

type WorldCommittedStandardSigningPropagation = {
  propagationMode: 'world-committed';
  reloadPlan: CommittedWorldReloadPlan;
};
type StandardSigningResolvedState =
  | WorldCommittedStandardSigningPropagation
  | LocalValidatedTeamPropagation;

type StandardSigningExecutionResult =
  | ({ success: true } & StandardSigningResolvedState)
  | {
      success: false;
      message: string;
    };

type SignAndTradeExecutionResult =
  | ({ success: true } & WorldCommittedTeamPropagation)
  | {
      success: false;
      message: string;
    };

type StandardSigningExecutionRoute = {
  mode: 'world' | 'vacuum';
  execute: (
    playerObj: ArchitectPlayer,
    actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
    standardSigningPayload: StandardSigningMutationPayload
  ) => Promise<StandardSigningExecutionResult>;
};

type FreeAgencyWorldOnlyActionKind =
  | 'signAndTrade'
  | 'offerSheetCreation'
  | 'offerSheetLifecycle';

type FreeAgencyWorldOnlyActionPhase = 'commit' | 'preview';

type FreeAgencyWorldOnlyRequirement = {
  message: string;
};

type FreeAgencyWorldOnlyRequirementTable = Record<
  FreeAgencyWorldOnlyActionKind,
  Partial<
    Record<FreeAgencyWorldOnlyActionPhase, FreeAgencyWorldOnlyRequirement>
  >
>;

const FREE_AGENCY_WORLD_ONLY_REQUIREMENTS: FreeAgencyWorldOnlyRequirementTable =
  {
    signAndTrade: {
      commit: {
        message: 'Sign-and-trade requires an active world to commit.',
      },
      preview: {
        message: 'Sign-and-trade requires an active world to preview.',
      },
    },
    offerSheetCreation: {
      commit: {
        message: 'Offer sheet actions require an active world to commit.',
      },
      preview: {
        message: 'Offer sheet actions require an active world to preview.',
      },
    },
    offerSheetLifecycle: {
      commit: {
        message:
          'Offer-sheet lifecycle actions require an active world to commit.',
      },
    },
  };

function isSignAndTradeTransactionPreparationFailure(
  value: PreparedSignAndTradeTransactionDefinition
): value is SignAndTradeTransactionPreparationFailure {
  return value.ok === false;
}

function isOfferSheetCreationDefinitionFailure(
  value: PreparedOfferSheetCreationDefinition
): value is OfferSheetCreationDefinitionFailure {
  return value.ok === false;
}

function resolveSeasonEndYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = toEndYear(value);
    return typeof parsed === 'number' && Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function deriveContractActionYear(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
): number {
  const salaryRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const firstSeasonValue = salaryRows.find(
    (row) => row?.season != null
  )?.season;
  const fromSeasonRow = resolveSeasonEndYear(firstSeasonValue);

  if (fromSeasonRow !== null) {
    return fromSeasonRow;
  }

  const fromStartYear = resolveSeasonEndYear(
    contract?.startYear ?? contract?.year
  );
  return fromStartYear ?? fallbackYear;
}

function buildActionSeasonContext(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
) {
  const actionYear = deriveContractActionYear(contract, fallbackYear);
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

function buildBlockedSignAndTradePreflightResult(
  message: string
): SignAndTradePreflightResult {
  return {
    status: 'blocked',
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

function buildOfferSheetPreflightResult(
  status: OfferSheetPreflightResult['status'],
  message: string
): OfferSheetPreflightResult {
  return {
    status,
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

function buildSignAndTradeTransactionPreparationFailure(
  message: string,
  logContext?: Record<string, unknown>
): SignAndTradeTransactionPreparationFailure {
  return {
    ok: false,
    message,
    preflightResult: buildBlockedSignAndTradePreflightResult(message),
    logContext,
  };
}

function buildOfferSheetCreationDefinitionFailure(
  preflightStatus: OfferSheetPreflightResult['status'],
  preflightMessage: string,
  storeMessage: string,
  logContext?: Record<string, unknown>
): OfferSheetCreationDefinitionFailure {
  return {
    ok: false,
    storeMessage,
    preflightResult: buildOfferSheetPreflightResult(
      preflightStatus,
      preflightMessage
    ),
    logContext,
  };
}

function buildYearSeasonContext(year: unknown, fallbackYear: number) {
  const actionYear = resolveSeasonEndYear(year) ?? fallbackYear;
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

function getFreeAgencyWorldOnlyRequirement(
  kind: FreeAgencyWorldOnlyActionKind,
  phase: FreeAgencyWorldOnlyActionPhase
): FreeAgencyWorldOnlyRequirement {
  const requirement = FREE_AGENCY_WORLD_ONLY_REQUIREMENTS[kind]?.[phase];
  if (!requirement) {
    throw new Error(
      `Missing Free Agency world-only requirement for ${kind}:${phase}`
    );
  }
  return requirement;
}

const OFFER_SHEET_WORLD_REQUIRED_MESSAGE = getFreeAgencyWorldOnlyRequirement(
  'offerSheetLifecycle',
  'commit'
).message;

type RenounceActionTarget =
  | PlayerRulesProfileInput
  | ArchitectPlayer
  | CapHoldActionItem;

function isCapHoldTarget(
  value: RenounceActionTarget
): value is CapHoldActionItem {
  return 'playerName' in value || 'amount' in value;
}

function getRenounceTargetDisplayName(target: RenounceActionTarget): string {
  if (isCapHoldTarget(target)) {
    return String(target.playerName || 'this player');
  }

  return String(
    ('displayName' in target ? target.displayName : undefined) ||
      ('name' in target ? target.name : undefined) ||
      'this player'
  );
}

function getRenounceTargetCandidateValues(
  target: RenounceActionTarget
): unknown[] {
  if (isCapHoldTarget(target)) {
    return [target.playerId, target.playerName];
  }

  return [
    'id' in target ? target.id : undefined,
    'player_id' in target ? target.player_id : undefined,
    'name' in target ? target.name : undefined,
    'displayName' in target ? target.displayName : undefined,
  ];
}

function getRenounceTargetPrimaryId(
  target: RenounceActionTarget
): string | null {
  const rawId = isCapHoldTarget(target)
    ? target.playerId
    : ('id' in target ? target.id : undefined) ||
      ('player_id' in target ? target.player_id : undefined) ||
      ('name' in target ? target.name : undefined);
  const normalized = String(rawId || '').trim();
  return normalized || null;
}

const normalizeEntityIdentity = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Helper to record override audit entry in cap sheet
 */
const recordOverrideAudit = (
  prev: CapSheet | null,
  actionType: string,
  reasons: string[],
  playerId?: string,
  playerName?: string
): OverrideAuditEntry[] => {
  const existingLog = prev?.overrideAuditLog || [];
  const newEntry: OverrideAuditEntry = {
    actionType,
    timestamp: new Date().toISOString(),
    reasons,
    overrideUsed: true,
    playerId,
    playerName,
  };
  return [...existingLog, newEntry];
};

const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
const BASE_MODE_VALIDATOR_WORLD_ID = 'base-mode';

type TeamsByCode = Record<string, CapSheet>;

function generateLocalOperationId(timestamp = Date.now()): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

function safeCloneForAudit<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function getTeamPlayerIds(team: CapSheet): Set<string> {
  const rosterIds = Array.isArray(team?.roster)
    ? team.roster
        .map((playerId) => String(playerId || ''))
        .filter((playerId) => playerId.length > 0)
    : [];

  if (rosterIds.length > 0) {
    return new Set(rosterIds);
  }

  const players = Array.isArray(team?.players) ? team.players : [];
  return new Set(
    players
      .map((player) =>
        String(player?.id || player?.player_id || player?.name || '')
      )
      .filter((playerId) => playerId.length > 0)
  );
}

function buildAuditDiffSummary(params: {
  beforeTeamsByCode: TeamsByCode;
  afterTeamsByCode: TeamsByCode;
}) {
  const { beforeTeamsByCode, afterTeamsByCode } = params;
  const teamCodes = Array.from(
    new Set([
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(afterTeamsByCode),
    ])
  );

  const changedPlayerIds = new Set<string>();
  let deadCapChanged = 0;
  let exceptionsChanged = 0;

  for (const code of teamCodes) {
    const beforeTeam = beforeTeamsByCode[code] || {};
    const afterTeam = afterTeamsByCode[code] || {};
    const beforePlayerIds = getTeamPlayerIds(beforeTeam);
    const afterPlayerIds = getTeamPlayerIds(afterTeam);

    for (const playerId of beforePlayerIds) {
      if (!afterPlayerIds.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    for (const playerId of afterPlayerIds) {
      if (!beforePlayerIds.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    if (
      JSON.stringify(beforeTeam.deadCap || []) !==
      JSON.stringify(afterTeam.deadCap || [])
    ) {
      deadCapChanged += 1;
    }

    if (
      JSON.stringify(beforeTeam.exceptions || {}) !==
      JSON.stringify(afterTeam.exceptions || {})
    ) {
      exceptionsChanged += 1;
    }
  }

  return {
    teamsTouched: teamCodes.length,
    playersMoved: changedPlayerIds.size,
    deadCapChanged,
    exceptionsChanged,
  };
}

function buildTotalsByTeam(
  teamsByCode: TeamsByCode,
  year: number
): CapAuditEventV1Like['beforeTotalsByTeam'] {
  const totalsByTeam: CapAuditEventV1Like['beforeTotalsByTeam'] = {};
  for (const [teamCode, team] of Object.entries(teamsByCode || {})) {
    const canonicalTeam = synchronizeTeamTotalsSnapshot(team, year);
    totalsByTeam[teamCode] =
      canonicalTeam?.totals || computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}

function buildCapAuditEvaluation(params: {
  operationId: string;
  occurredAt: string;
  mutationType: string;
  worldId: string | null;
  year: number;
  teamCodes: string[];
  playerIds: string[];
  beforeTeamsByCode: TeamsByCode;
  afterTeamsByCode: TeamsByCode;
  preview?: boolean;
  authoritativeEventLinked?: boolean;
  authoritativeOperationId?: string;
  persistFailed?: boolean;
}): {
  event: CapAuditEventV1Like;
  validation: ReturnType<typeof validatePostStateCapLegality>;
} {
  const {
    operationId,
    occurredAt,
    mutationType,
    worldId,
    year,
    teamCodes,
    playerIds,
    beforeTeamsByCode,
    afterTeamsByCode,
    preview,
    authoritativeEventLinked,
    authoritativeOperationId,
    persistFailed,
  } = params;

  const beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
  const afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);
  const validation = validatePostStateCapLegality({
    operationId,
    mutationType,
    worldId: worldId || BASE_MODE_VALIDATOR_WORLD_ID,
    year,
    beforeTeamsByCode: beforeTeamsByCode as Record<
      string,
      Record<string, unknown>
    >,
    afterTeamsByCode: afterTeamsByCode as Record<
      string,
      Record<string, unknown>
    >,
    beforeTotalsByTeam,
    afterTotalsByTeam,
  });

  const event: CapAuditEventV1Like = {
    schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
    validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
    operationId,
    mutationType,
    occurredAt,
    worldId,
    teamCodes,
    playerIds,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    valid: validation.valid,
    violations: validation.violations.map((issue) => ({ ...issue })),
    warnings: validation.warnings.map((issue) => ({ ...issue })),
    diffSummary: buildAuditDiffSummary({
      beforeTeamsByCode,
      afterTeamsByCode,
    }),
    ...(typeof preview === 'boolean' ? { preview } : {}),
    ...(typeof authoritativeEventLinked === 'boolean'
      ? { authoritativeEventLinked }
      : {}),
    ...(authoritativeOperationId ? { authoritativeOperationId } : {}),
    ...(typeof persistFailed === 'boolean' ? { persistFailed } : {}),
  };

  return {
    event,
    validation,
  };
}

function getFirstViolationMessage(
  validation: ReturnType<typeof validatePostStateCapLegality>,
  fallbackMessage: string
): string {
  const firstViolation = validation.violations?.[0];
  if (!firstViolation) {
    return fallbackMessage;
  }

  const typedMessage = String(firstViolation.message || '').trim();
  return typedMessage || fallbackMessage;
}

function getWorldOptimisticLockScopeKey(worldId: string): string {
  return `architect_world_cap_mutation_lock:${worldId}`;
}

function toTrimmedStringOrNull(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function extractCommittedWorldMetadataPatch(
  result: PersistMutationResult
): ReloadActiveWorldMetadataPatch | null {
  const patch = result.worldPatch || null;

  if (!patch || patch.asOfDate === undefined) {
    return null;
  }

  return {
    asOfDate: patch.asOfDate || null,
  };
}

function buildCommittedOfferSheetIdentity(params: {
  result: PersistMutationResult;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
}): OfferSheetCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(metadata?.dedupKey),
    offerSheetId: toTrimmedStringOrNull(metadata?.offerSheetId),
    playerId: params.playerId,
    seasonKey: params.seasonKey,
    offeringTeamCode: params.offeringTeamCode,
    status: 'PENDING_MATCH',
  };
}

function matchesCommittedOfferSheetIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  if (identity.dedupKey && entryDedupKey === identity.dedupKey) {
    return true;
  }

  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  if (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId) {
    return true;
  }

  return (
    toTrimmedStringOrNull(offerSheet.playerId) === identity.playerId &&
    toTrimmedStringOrNull(offerSheet.seasonKey) === identity.seasonKey &&
    toTrimmedStringOrNull(offerSheet.offeringTeamCode) ===
      identity.offeringTeamCode &&
    String(offerSheet.status || '').trim() === identity.status
  );
}

function buildCommittedOfferSheetLifecycleIdentity(params: {
  result: PersistMutationResult;
  fallbackIdentity: OfferSheetLifecycleCommittedIdentityInput;
}): OfferSheetLifecycleCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(
      metadata?.dedupKey ?? params.fallbackIdentity.dedupKey
    ),
    offerSheetId: toTrimmedStringOrNull(
      metadata?.offerSheetId ?? params.fallbackIdentity.offerSheetId
    ),
    playerId: toTrimmedStringOrNull(
      metadata?.playerId ?? params.fallbackIdentity.playerId
    ),
    seasonKey: toTrimmedStringOrNull(
      metadata?.seasonKey ?? params.fallbackIdentity.seasonKey
    ),
    offeringTeamCode: toTrimmedStringOrNull(
      metadata?.offeringTeamCode ??
        metadata?.offeringTeam ??
        params.fallbackIdentity.offeringTeamCode
    ),
    homeTeamCode: toTrimmedStringOrNull(
      metadata?.homeTeamCode ??
        metadata?.homeTeam ??
        params.fallbackIdentity.homeTeamCode
    ),
    status: toTrimmedStringOrNull(
      metadata?.status ?? params.fallbackIdentity.status
    ),
  };
}

function matchesCommittedOfferSheetLifecycleIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetLifecycleCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  const entryPlayerId = toTrimmedStringOrNull(offerSheet.playerId);
  const entrySeasonKey = toTrimmedStringOrNull(offerSheet.seasonKey);
  const entryOfferingTeamCode = toTrimmedStringOrNull(
    offerSheet.offeringTeamCode
  );
  const entryHomeTeamCode = toTrimmedStringOrNull(offerSheet.homeTeamCode);
  const entryStatus = toTrimmedStringOrNull(offerSheet.status);

  const identityByPrimaryKey =
    (identity.dedupKey && entryDedupKey === identity.dedupKey) ||
    (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId);
  const identityByFallbackTruth =
    Boolean(
      identity.playerId ||
        identity.seasonKey ||
        identity.offeringTeamCode ||
        identity.homeTeamCode
    ) &&
    (!identity.playerId || entryPlayerId === identity.playerId) &&
    (!identity.seasonKey || entrySeasonKey === identity.seasonKey) &&
    (!identity.offeringTeamCode ||
      entryOfferingTeamCode === identity.offeringTeamCode) &&
    (!identity.homeTeamCode || entryHomeTeamCode === identity.homeTeamCode);

  if (!identityByPrimaryKey && !identityByFallbackTruth) {
    return false;
  }

  if (identity.status && entryStatus !== identity.status) {
    return false;
  }

  return true;
}

function filterSignedPlayerFromFreeAgents<
  T extends {
    name?: unknown;
    id?: unknown;
    player_id?: unknown;
  },
>(freeAgents: T[], playerObj: ArchitectPlayer): T[] {
  return freeAgents.filter(
    (player) =>
      player.name !== playerObj.name &&
      player.id !== playerObj.id &&
      player.player_id !== playerObj.player_id
  );
}

/**
 * Centralized action handlers hook for GMDashboard
 *
 * @param params - Hook parameters
 * @returns All action handlers
 */
export function useArchitectActions({
  teamId,
  userId,
  // authLoading is available but not currently used by handlers
  state,
  playersMap,
  modals,
  worldId,
  seasonId,
}: UseArchitectActionsParams): UseArchitectActionsReturn {
  // Normalize teamId (route slug like "lakers") to canonical teamCode (like "LAL")
  // This ensures all mutation payloads use the same team code format as Firestore base teams
  const teamCode = useMemo(() => resolveTeamCode(teamId) || teamId, [teamId]);

  // Destructure state for easier access
  const {
    teamCapSheet,
    currentYear,
    worldAsOfDate,
    setTeamCapSheet,
    setSelectedRulesYear,
    setSelectedPlayer,
    setFreeAgents,
    startSave,
    finishSave,
    refreshWorldRosterIndex,
    reloadActiveWorldTeamData,
  } = state;

  // Destructure modals for easier access
  const { openContractModal } = modals;

  const setTeamCapSheetSafe = useCallback(
    (
      nextTeam:
        | CapSheet
        | UseArchitectStateReturn['teamCapSheet']
        | null
    ): void => {
      setTeamCapSheet(nextTeam as UseArchitectStateReturn['teamCapSheet']);
    },
    [setTeamCapSheet]
  );

  const setSelectedPlayerSafe = useCallback(
    (player: ArchitectPlayer | null): void => {
      setSelectedPlayer(player as UseArchitectStateReturn['selectedPlayer']);
    },
    [setSelectedPlayer]
  );

  const openPlayerContractModalRoute = useCallback(
    ({
      player,
      rulesYear,
      targetYear = null,
      actionContext = null,
      initialAction = null,
    }: {
      player: PlayerRulesProfileInput | ArchitectPlayer;
      rulesYear: number;
      targetYear?: number | null;
      actionContext?: ActionContext;
      initialAction?: string | null;
    }): void => {
      setSelectedPlayerSafe(player as ArchitectPlayer);
      setSelectedRulesYear(rulesYear);
      openContractModal({
        initialAction,
        targetYear,
        actionContext,
      });
    },
    [openContractModal, setSelectedPlayerSafe, setSelectedRulesYear]
  );

  type CapAuditedMutationLocalStateBoundary =
    | typeof BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM
    | typeof WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM;
  type CapAuditedMutationLocalStateKind =
    CapAuditedMutationLocalStateBoundary['stateKind'];
  type PreparedCapAuditedMutationBoundary = {
    operationId: string;
    storageKey: string;
    localStateKind: CapAuditedMutationLocalStateKind;
    auditLifecycleState: LocalCapAuditLifecycleState;
    beforeTeamSnapshot: CapSheet;
    afterTeamSnapshot: CapSheet;
    beforeTeamsByCode: TeamsByCode;
    afterTeamsByCode: TeamsByCode;
    auditEvent: CapAuditEventV1Like;
    auditEvaluation: ReturnType<typeof buildCapAuditEvaluation>;
    applyNonAuthoritativeState: () => void;
    linkCommittedPersistSuccess: (result: PersistMutationResult) => void;
    rollbackOptimisticLocalState: () => void;
  };

  /**
   * Dashboard non-authoritative mutation boundary.
   * - `local-validated-apply`: validated local state with no world write.
   * - `optimistic-local-preview`: temporary local state while world persistence
   *   is pending; rollback stays here until committed-world reload resumes.
   */
  const prepareCapAuditedMutationBoundary = useCallback(
    (params: {
      mutationType: string;
      playerIds?: string[];
      computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
      yearOverride?: number;
    }): PreparedCapAuditedMutationBoundary => {
      const {
        mutationType,
        playerIds = [],
        computeNextTeam,
        yearOverride = currentYear,
      } = params;
      const auditStreamBoundary: CapAuditedMutationLocalStateBoundary = worldId
        ? WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM
        : BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM;
      const beforeTeamSnapshot = safeCloneForAudit(teamCapSheet as CapSheet);
      const afterTeamSnapshot = safeCloneForAudit(
        computeNextTeam(safeCloneForAudit(beforeTeamSnapshot))
      );
      const operationId = generateLocalOperationId();
      const occurredAt = new Date().toISOString();
      const beforeTeamsByCode: TeamsByCode = {
        [teamCode]: beforeTeamSnapshot,
      };
      const afterTeamsByCode: TeamsByCode = {
        [teamCode]: afterTeamSnapshot,
      };
      const auditEvaluation = buildCapAuditEvaluation({
        operationId,
        occurredAt,
        mutationType,
        worldId,
        year: yearOverride,
        teamCodes: [teamCode],
        playerIds: playerIds.filter(Boolean).map(String),
        beforeTeamsByCode,
        afterTeamsByCode,
        preview: auditStreamBoundary.preview,
        authoritativeEventLinked:
          auditStreamBoundary.initialAuthoritativeEventLinked,
      });
      const auditLifecycleState: LocalCapAuditLifecycleState = !auditEvaluation
        .validation.valid
        ? 'evaluation-blocked'
        : auditStreamBoundary.stateKind === 'local-validated-apply'
          ? 'local-validated-applied'
          : 'optimistic-preview-pending';
      const auditEvent = withLocalCapAuditLifecycleState(
        auditEvaluation.event,
        auditLifecycleState
      );
      const storageKey = auditStreamBoundary.storageKey;

      return {
        operationId,
        storageKey,
        localStateKind: auditStreamBoundary.stateKind,
        auditLifecycleState,
        beforeTeamSnapshot,
        afterTeamSnapshot,
        beforeTeamsByCode,
        afterTeamsByCode,
        auditEvent,
        auditEvaluation,
        applyNonAuthoritativeState: () => {
          setTeamCapSheetSafe(afterTeamSnapshot);
        },
        linkCommittedPersistSuccess: (result) => {
          const authoritativeOperationId = String(
            result?.event?.operationId || operationId
          );
          updateLocalCapAuditEvent(
            operationId,
            buildAuthoritativeLinkEstablishedAuditPatch(
              authoritativeOperationId
            ),
            {
              storageKey,
            }
          );
        },
        rollbackOptimisticLocalState: () => {
          setTeamCapSheetSafe(beforeTeamSnapshot);
          const didUpdatePreview = updateLocalCapAuditEvent(
            operationId,
            buildPersistFailedRolledBackAuditPatch(),
            {
              storageKey,
            }
          );

          if (!didUpdatePreview) {
            appendLocalCapAuditEvent(
              {
                ...auditEvent,
                ...buildPersistFailedRolledBackAuditPatch(),
              },
              {
                storageKey,
              }
            );
          }
        },
      };
    },
    [currentYear, setTeamCapSheetSafe, teamCapSheet, teamCode, worldId]
  );

  // === Persistence Helper ===
  type PersistMutationOptions = {
    operationId?: string;
    seasonIdOverride?: string;
    onSuccess?: (result: PersistMutationResult) => void;
    onFailure?: (message: string, result?: PersistMutationResult) => void;
  };

  const evaluateMutationTruth = useCallback(
    (
      mutationType: string,
      result: MutationTruthResult,
      options: { requireWorldPersistence: boolean }
    ): {
      ok: boolean;
      message: string;
      appliedToLocalState: boolean;
      persistedToWorld: boolean;
    } => {
      const writesSummary = result?.writesSummary;
      const summaryBackedApplyCheck =
        Number(writesSummary?.teamsPatched || 0) > 0 ||
        Number(writesSummary?.playersPatched || 0) > 0 ||
        Number(writesSummary?.entitlementsPatched || 0) > 0;
      const hasApplySummary =
        writesSummary?.teamsPatched !== undefined ||
        writesSummary?.playersPatched !== undefined ||
        writesSummary?.entitlementsPatched !== undefined;
      const appliedToLocalState =
        result?.appliedToLocalState !== false &&
        (!hasApplySummary || summaryBackedApplyCheck);

      const hasPersistSummary =
        writesSummary?.eventsWritten !== undefined ||
        writesSummary?.worldMetadataPatched !== undefined ||
        writesSummary?.teamsPatched !== undefined;
      const summaryBackedPersistCheck =
        Number(writesSummary?.eventsWritten ?? 1) > 0 &&
        Number(writesSummary?.worldMetadataPatched ?? 1) > 0 &&
        Number(writesSummary?.teamsPatched ?? 1) > 0;
      const persistedToWorld = options.requireWorldPersistence
        ? result?.persistedToWorld !== false &&
          result?.skipped !== true &&
          (!hasPersistSummary || summaryBackedPersistCheck)
        : true;

      const ok =
        Boolean(result?.success) && appliedToLocalState && persistedToWorld;
      const fallbackError = `${mutationType} did not complete required world writes.`;
      const message = String(result?.error || fallbackError);

      return {
        ok,
        message,
        appliedToLocalState,
        persistedToWorld,
      };
    },
    []
  );

  /**
   * Persist mutation to Firestore if in world mode.
   * Skips persistence when worldId is null (base mode) or userId is missing.
   */
  const persistMutation = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: PersistMutationOptions = {}
    ): Promise<PersistMutationResult> => {
      // Base mode: no persistence
      if (!worldId) {
        return { success: true, skipped: true };
      }
      // Cannot persist without userId
      if (!userId) {
        const message = '[Architect] Cannot save: missing userId';
        console.warn(message);
        options.onFailure?.(message);
        return { success: false, error: message };
      }

      try {
        console.log(`💾 Saving ${mutationType}...`);
        const effectiveSeasonId = options.seasonIdOverride || seasonId;
        const result = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: effectiveSeasonId,
          mutationType,
          payload,
          operationId: options.operationId,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, result, {
          requireWorldPersistence: true,
        });
        const normalizedResult: PersistMutationResult = {
          ...result,
          success: truth.ok,
          error: truth.ok ? result?.error : truth.message,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (truth.ok) {
          console.log(`✅ Saved ${mutationType}!`, result);
          toast.success('Saved changes');
          options.onSuccess?.(normalizedResult);
        } else {
          console.error(`❌ Save failed:`, truth.message);
          // E2 fix: Skip toast when onFailure callback handles error reporting
          // This prevents duplicate toasts when caller uses reportMutationError
          if (!options.onFailure) {
            toast.error(`Save failed: ${truth.message}`);
          }
          options.onFailure?.(
            truth.message || `Save failed for ${mutationType}`,
            normalizedResult
          );
        }

        return normalizedResult;
      } catch (err: unknown) {
        console.error('[Architect][PersistMutation] failed', {
          mutationType,
          payload,
          err,
        });
        // E2 fix: Skip toast when onFailure callback handles error reporting
        if (!options.onFailure) {
          toast.error('Failed to save changes');
        }
        const message = 'Failed to save changes';
        options.onFailure?.(message);
        return { success: false, error: message };
      }
    },
    [evaluateMutationTruth, worldId, userId, seasonId]
  );

  const reportMutationError = useCallback(
    (message: string, details?: Record<string, unknown>): void => {
      console.error('[Architect][FreeAgency]', message, {
        teamCode,
        worldId,
        ...details,
      });
      toast.error(message);
    },
    [teamCode, worldId]
  );

  const getFreeAgencyWorldOnlyMessage = useCallback(
    (
      kind: FreeAgencyWorldOnlyActionKind,
      phase: FreeAgencyWorldOnlyActionPhase
    ): string => getFreeAgencyWorldOnlyRequirement(kind, phase).message,
    []
  );

  const requireActiveWorldForFreeAgencyWorldOnlyCommit = useCallback(
    (
      kind: FreeAgencyWorldOnlyActionKind,
      details?: Record<string, unknown>
    ): string | null => {
      if (worldId) {
        return null;
      }

      const message = getFreeAgencyWorldOnlyMessage(kind, 'commit');
      reportMutationError(message, details);
      return message;
    },
    [getFreeAgencyWorldOnlyMessage, reportMutationError, worldId]
  );

  const buildBlockedWorldOnlySignAndTradePreflightResult = useCallback(
    (): SignAndTradePreflightResult =>
      buildBlockedSignAndTradePreflightResult(
        getFreeAgencyWorldOnlyMessage('signAndTrade', 'preview')
      ),
    [getFreeAgencyWorldOnlyMessage]
  );

  const buildBlockedWorldOnlyOfferSheetPreflightResult = useCallback(
    (): OfferSheetPreflightResult =>
      buildOfferSheetPreflightResult(
        'blocked',
        getFreeAgencyWorldOnlyMessage('offerSheetCreation', 'preview')
      ),
    [getFreeAgencyWorldOnlyMessage]
  );

  const resolveCommittedWorldTeamSnapshot = useCallback(
    async (
      result: PersistMutationResult
    ): Promise<ResolvedCommittedWorldTeam | null> => {
      // Preferred committed-mutation order:
      // 1. Reuse the authoritative changedTeams snapshot when it already
      //    includes the active team.
      // 2. Otherwise reload through the read stack to recover a committed
      //    snapshot instead of reconstructing local fallback logic here.
      const changedTeam = findCommittedTeamSnapshot(
        result?.changedTeams,
        teamCode
      );
      const dashboardChangedTeam =
        buildGeneralMutationDashboardReloadTeamSnapshot(changedTeam);

      if (dashboardChangedTeam) {
        return {
          propagationMode: 'world-committed',
          committedTeam: toDashboardCommittedTeamSnapshot(dashboardChangedTeam),
          committedTeamSource: 'changedTeams',
        };
      }

      if (!worldId) {
        return null;
      }

      // Post-commit UI reloads intentionally re-enter through the dashboard
      // adapter instead of rebuilding world/base fallback logic locally.
      const reloadedTeam = await loadWorldTeamData(worldId, teamCode);
      if (!reloadedTeam) {
        return null;
      }

      return {
        propagationMode: 'world-committed',
        committedTeam: reloadedTeam as DashboardCommittedTeamSnapshot,
        committedTeamSource: 'reload',
      };
    },
    [teamCode, worldId]
  );

  const shouldRefreshWorldRosterAfterMutation = useCallback(
    (mutationType: string): boolean => {
      switch (mutationType) {
        case 'storeOfferSheet':
        case 'matchOfferSheet':
        case 'declineOfferSheet':
          return false;
        default:
          return true;
      }
    },
    []
  );

  const buildCommittedWorldReloadPlan = useCallback(
    async (
      mutationType: string,
      result: PersistMutationResult
    ): Promise<CommittedWorldReloadPlan | null> => {
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);

      if (!committedWorldTeam) {
        return null;
      }

      return {
        committedWorldTeam,
        committedWorldMetadata: extractCommittedWorldMetadataPatch(result),
        refreshRosterBundle:
          shouldRefreshWorldRosterAfterMutation(mutationType),
      };
    },
    [resolveCommittedWorldTeamSnapshot, shouldRefreshWorldRosterAfterMutation]
  );

  const applyCommittedWorldReloadPlan = useCallback(
    async (
      plan: CommittedWorldReloadPlan
    ): Promise<CommittedWorldReloadResult> => {
      // Committed-world ownership resumes here after successful persistence.
      if (reloadActiveWorldTeamData && worldId) {
        const reloadedWorldTeam = await reloadActiveWorldTeamData({
          committedTeamSnapshot: plan.committedWorldTeam.committedTeam,
          committedTeamSource: plan.committedWorldTeam.committedTeamSource,
          committedWorldMetadata: plan.committedWorldMetadata,
          refreshRosterBundle: plan.refreshRosterBundle,
        });

        if (!reloadedWorldTeam || reloadedWorldTeam.outcome === 'stale-drop') {
          return { status: 'stale-drop' };
        }

        return {
          status: 'applied',
          committedWorldTeam: {
            propagationMode: 'world-committed',
            committedTeam: reloadedWorldTeam.committedWorldTeam.committedTeam,
            committedTeamSource:
              reloadedWorldTeam.committedWorldTeam.committedTeamSource,
          },
        };
      }

      setTeamCapSheet(plan.committedWorldTeam.committedTeam);

      if (plan.refreshRosterBundle) {
        try {
          await refreshWorldRosterIndex();
        } catch (error) {
          console.warn(
            `[Architect][FreeAgency] Failed to refresh roster index after world reload plan:`,
            error
          );
        }
      }

      return {
        status: 'applied',
        committedWorldTeam: plan.committedWorldTeam,
      };
    },
    [
      refreshWorldRosterIndex,
      reloadActiveWorldTeamData,
      setTeamCapSheetSafe,
      worldId,
    ]
  );

  const applyCommittedWorldReload = useCallback(
    async (
      mutationType: string,
      committedWorldTeam: CommittedWorldReloadSeed
    ): Promise<CommittedWorldReloadResult> => {
      return applyCommittedWorldReloadPlan({
        committedWorldTeam: {
          propagationMode: 'world-committed',
          committedTeam: committedWorldTeam.committedTeam,
          committedTeamSource: committedWorldTeam.committedTeamSource,
        },
        committedWorldMetadata: null,
        refreshRosterBundle:
          shouldRefreshWorldRosterAfterMutation(mutationType),
      });
    },
    [applyCommittedWorldReloadPlan, shouldRefreshWorldRosterAfterMutation]
  );

  const syncTeamFromMutationResult = useCallback(
    async (
      mutationType: string,
      result: PersistMutationResult
    ): Promise<void> => {
      const committedWorldReloadPlan = await buildCommittedWorldReloadPlan(
        mutationType,
        result
      );

      if (!committedWorldReloadPlan) {
        return;
      }

      await applyCommittedWorldReloadPlan(committedWorldReloadPlan);
    },
    [applyCommittedWorldReloadPlan, buildCommittedWorldReloadPlan]
  );

  const runAuthoritativeFAMutation = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: {
        worldRequiredMessage?: string;
        seasonIdOverride?: string;
      } = {}
    ): Promise<PersistMutationResult> => {
      if (!worldId) {
        const message =
          options.worldRequiredMessage ||
          'This action requires an active world to commit.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: options.seasonIdOverride || seasonId,
          mutationType,
          payload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || `Failed to run ${mutationType} mutation.`,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = result.error as string;
          reportMutationError(message, {
            mutationType,
            payload,
            result: rawResult,
          });
          finishSave(message);
          return result;
        }

        await syncTeamFromMutationResult(mutationType, result);
        toast.success('Saved changes');
        finishSave();
        return result;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to run ${mutationType} mutation.`;
        reportMutationError(message, { mutationType, payload, error });
        finishSave(message);
        return { success: false, error: message };
      }
    },
    [
      finishSave,
      reportMutationError,
      startSave,
      syncTeamFromMutationResult,
      userId,
      worldId,
      evaluateMutationTruth,
      seasonId,
    ]
  );

  /**
   * Shared world-mutation sync lane for non-Free Agency surfaces.
   * Trade apply re-enters through this helper so the trade wrapper/action seam
   * does not read like it owns post-commit reload or dashboard state writes.
   */
  const runAuthoritativeWorldMutationWithDashboardSync = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: {
        worldRequiredMessage?: string;
        seasonIdOverride?: string;
      } = {}
    ): Promise<PersistMutationResult> =>
      runAuthoritativeFAMutation(mutationType, payload, options),
    [runAuthoritativeFAMutation]
  );

  const resolveCommittedOfferSheetState = useCallback(
    async (
      result: PersistMutationResult,
      params: {
        playerId: string;
        seasonKey: string;
        offeringTeamCode: string;
      }
    ): Promise<OfferSheetCommittedStateResolution> => {
      const committedOfferSheetIdentity = buildCommittedOfferSheetIdentity({
        result,
        playerId: params.playerId,
        seasonKey: params.seasonKey,
        offeringTeamCode: params.offeringTeamCode,
      });
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);
      const committedTeam = committedWorldTeam?.committedTeam || null;
      const committedTeamSource: OfferSheetCommittedState['committedTeamSource'] =
        committedWorldTeam?.committedTeamSource || 'reload';

      if (!committedTeam) {
        return {
          ok: false,
          message:
            'Offer sheet saved but the committed team snapshot could not be reloaded.',
          logContext: {
            result,
            committedOfferSheetIdentity,
          },
        };
      }

      const committedOfferSheet =
        (committedTeam.offerSheets || []).find((offerSheet) =>
          matchesCommittedOfferSheetIdentity(
            offerSheet as OfferSheet,
            committedOfferSheetIdentity
          )
        ) || null;

      if (!committedOfferSheet) {
        return {
          ok: false,
          message:
            'Offer sheet saved but the committed pending offer sheet could not be verified in the active team snapshot.',
          logContext: {
            result,
            committedOfferSheetIdentity,
            committedTeamSource,
            offerSheets: committedTeam.offerSheets || [],
          },
        };
      }

      return {
        ok: true,
        value: {
          committedTeam,
          committedTeamSource,
          committedOfferSheet: committedOfferSheet as OfferSheet,
          committedOfferSheetIdentity,
        },
      };
    },
    [resolveCommittedWorldTeamSnapshot]
  );

  const applyCommittedOfferSheetState = useCallback(
    async (
      committedTeam: DashboardCommittedTeamSnapshot,
      committedTeamSource: WorldCommittedTeamSource
    ): Promise<void> => {
      await applyCommittedWorldReload('storeOfferSheet', {
        committedTeam,
        committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeOfferSheetStore = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: OfferSheetMutationPayload
    ): Promise<OfferSheetStoreExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage(
          'offerSheetCreation',
          'commit'
        );
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: actionSeasonContext.seasonId,
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('storeOfferSheet', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to store offer sheet.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to store offer sheet.'
          );
          reportMutationError(message, {
            mutationType: 'storeOfferSheet',
            payload: mutationPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedState = await resolveCommittedOfferSheetState(result, {
          playerId: mutationPayload.playerId,
          seasonKey: actionSeasonContext.seasonId,
          offeringTeamCode: mutationPayload.teamCode,
        });

        if (committedState.ok !== true) {
          const failedCommittedState = committedState;

          reportMutationError(failedCommittedState.message, {
            mutationType: 'storeOfferSheet',
            payload: mutationPayload,
            ...failedCommittedState.logContext,
          });
          finishSave(failedCommittedState.message);
          return {
            success: false,
            message: failedCommittedState.message,
          };
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          ...committedState.value,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to store offer sheet.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyWorldMutation,
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedOfferSheetState,
      startSave,
      userId,
      worldId,
    ]
  );

  const resolveCommittedOfferSheetLifecycleState = useCallback(
    async (
      result: PersistMutationResult,
      expectation: OfferSheetLifecycleCommittedStateExpectation
    ): Promise<OfferSheetLifecycleCommittedStateResolution> => {
      const committedOfferSheetIdentity =
        buildCommittedOfferSheetLifecycleIdentity({
          result,
          fallbackIdentity: expectation.identity,
        });
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);
      const committedTeam = committedWorldTeam?.committedTeam || null;
      const committedTeamSource: OfferSheetLifecycleCommittedState['committedTeamSource'] =
        committedWorldTeam?.committedTeamSource || 'reload';

      if (!committedTeam) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
          },
        };
      }

      const committedOfferSheetEntries =
        expectation.activeTeamArrayKey === 'incomingOfferSheets'
          ? committedTeam.incomingOfferSheets || []
          : committedTeam.offerSheets || [];
      const committedOfferSheet =
        committedOfferSheetEntries.find((offerSheet) =>
          matchesCommittedOfferSheetLifecycleIdentity(
            offerSheet as OfferSheet,
            committedOfferSheetIdentity
          )
        ) || null;

      if (expectation.presence === 'present' && !committedOfferSheet) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
            committedTeamSource,
            [expectation.activeTeamArrayKey]: committedOfferSheetEntries,
          },
        };
      }

      if (expectation.presence === 'absent' && committedOfferSheet) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
            committedTeamSource,
            [expectation.activeTeamArrayKey]: committedOfferSheetEntries,
          },
        };
      }

      return {
        ok: true,
        value: {
          committedTeam,
          committedTeamSource,
          committedOfferSheet: committedOfferSheet as OfferSheet | null,
          committedOfferSheetIdentity,
          expectation,
        },
      };
    },
    [resolveCommittedWorldTeamSnapshot]
  );

  const applyCommittedOfferSheetLifecycleState = useCallback(
    async (
      mutationType: OfferSheetLifecycleMutationType,
      committedTeam: DashboardCommittedTeamSnapshot,
      committedTeamSource: WorldCommittedTeamSource
    ): Promise<void> => {
      await applyCommittedWorldReload(mutationType, {
        committedTeam,
        committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeOfferSheetLifecycleMutation = useCallback(
    async (
      mutationType: OfferSheetLifecycleMutationType,
      mutationPayload: ArchitectMutationPayload,
      expectation: OfferSheetLifecycleCommittedStateExpectation
    ): Promise<OfferSheetLifecycleExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage(
          'offerSheetLifecycle',
          'commit'
        );
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
        });
        return {
          success: false,
          message,
        };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId,
          mutationType,
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || `Failed to run ${mutationType}.`,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || `Failed to run ${mutationType}.`
          );
          reportMutationError(message, {
            mutationType,
            payload: mutationPayload,
            expectation,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedState = await resolveCommittedOfferSheetLifecycleState(
          result,
          expectation
        );

        if (committedState.ok !== true) {
          const failedCommittedState = committedState;

          reportMutationError(failedCommittedState.message, {
            mutationType,
            payload: mutationPayload,
            expectation,
            ...failedCommittedState.logContext,
          });
          finishSave(failedCommittedState.message);
          return {
            success: false,
            message: failedCommittedState.message,
          };
        }

        await applyCommittedOfferSheetLifecycleState(
          mutationType,
          committedState.value.committedTeam,
          committedState.value.committedTeamSource
        );
        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          ...committedState.value,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to run ${mutationType}.`;
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyCommittedOfferSheetLifecycleState,
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedOfferSheetLifecycleState,
      seasonId,
      startSave,
      userId,
      worldId,
    ]
  );

  const applyResolvedStandardSigningState = useCallback(
    async (
      playerObj: ArchitectPlayer,
      resolvedState: StandardSigningResolvedState
    ): Promise<void> => {
      let didApplyResolvedState = false;

      if (resolvedState.propagationMode === 'local-validated') {
        setTeamCapSheetSafe(resolvedState.localValidatedTeam);
        didApplyResolvedState = true;
      } else {
        const worldReloadResult = await applyCommittedWorldReloadPlan(
          resolvedState.reloadPlan
        );

        if (worldReloadResult.status !== 'applied') {
          return;
        }

        didApplyResolvedState = true;
      }

      if (!didApplyResolvedState) {
        return;
      }

      setFreeAgents((prev) =>
        filterSignedPlayerFromFreeAgents(prev, playerObj)
      );
    },
    [applyCommittedWorldReloadPlan, setFreeAgents, setTeamCapSheetSafe]
  );

  const executeWorldModeStandardSigning = useCallback(
    async (
      playerObj: ArchitectPlayer,
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      standardSigningPayload: StandardSigningMutationPayload
    ): Promise<StandardSigningExecutionResult> => {
      if (!worldId) {
        const message = 'Signing requires an active world to commit.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: actionSeasonContext.seasonId,
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('signFreeAgent', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to save signing. Please try again.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to save signing. Please try again.'
          );
          reportMutationError(message, {
            mutationType: 'signFreeAgent',
            payload: standardSigningPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedWorldReloadPlan = await buildCommittedWorldReloadPlan(
          'signFreeAgent',
          result
        );
        if (!committedWorldReloadPlan) {
          const message =
            'Signing saved but the committed team snapshot could not be reloaded.';
          reportMutationError(message, {
            mutationType: 'signFreeAgent',
            payload: standardSigningPayload,
            playerId:
              standardSigningPayload.playerId ||
              playerObj.id ||
              playerObj.player_id,
            result,
          });
          finishSave(message);
          return { success: false, message };
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          propagationMode: 'world-committed',
          reloadPlan: committedWorldReloadPlan,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to save signing. Please try again.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyWorldMutation,
      evaluateMutationTruth,
      finishSave,
      reportMutationError,
      buildCommittedWorldReloadPlan,
      startSave,
      userId,
      worldId,
    ]
  );

  const executeVacuumModeStandardSigning = useCallback(
    async (
      playerObj: ArchitectPlayer,
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      standardSigningPayload: StandardSigningMutationPayload
    ): Promise<StandardSigningExecutionResult> => {
      const idToSign = playerObj.id || playerObj.player_id;

      if (!teamCapSheet) {
        reportMutationError(
          'Cannot sign player in vacuum mode: team state is not loaded.',
          {
            playerId: idToSign,
          }
        );
        return {
          success: false,
          message: 'Cannot sign player: team state is not loaded.',
        };
      }

      const canonicalPlayer =
        playersMap[playerObj.name || ''] ||
        playersMap[playerObj.player_id || ''] ||
        playersMap[playerObj.id || ''] ||
        playerObj;
      const validationTeam = toSigningValidationTeam(teamCapSheet);
      const validationPlayer = toSigningValidationPlayer(canonicalPlayer);

      if (!validationTeam || !validationPlayer) {
        const message =
          'Cannot sign player: the local team or player snapshot is incomplete.';
        reportMutationError(message, {
          playerId: idToSign,
          teamLoaded: Boolean(teamCapSheet),
          playerLoaded: Boolean(canonicalPlayer),
        });
        return { success: false, message };
      }

      const validation = validateSigning({
        team: validationTeam,
        player: validationPlayer,
        contract: standardSigningPayload.contract,
        signedUsing: standardSigningPayload.signedUsing,
        year: actionSeasonContext.actionYear,
      });

      if (!validation.valid) {
        const firstViolation = validation.violations?.[0];
        const message =
          firstViolation?.message ||
          'Signing failed cap validation in vacuum mode.';
        reportMutationError(message, {
          playerId: idToSign,
          violations: validation.violations,
        });
        return { success: false, message };
      }

      const freeAgentComputeState = toFreeAgentComputeState(
        teamCapSheet,
        canonicalPlayer,
        teamCode
      );

      if (!freeAgentComputeState) {
        const message =
          'Cannot sign player: the canonical current state could not be normalized.';
        reportMutationError(message, {
          playerId: idToSign,
          teamCode,
        });
        return { success: false, message };
      }

      const computeResult = computeWorldMutation({
        mutationType: 'signFreeAgent',
        payload: standardSigningPayload,
        currentState: freeAgentComputeState,
        seasonId: actionSeasonContext.seasonId,
        timestamp: Date.now(),
      }) as ComputeMutationResult;

      if (!computeResult.success) {
        const message = String(
          computeResult.error ||
            'Unable to apply signing in vacuum mode with canonical compute.'
        );
        reportMutationError(message, {
          playerId: idToSign,
          computeResult,
        });
        return { success: false, message };
      }

      const updatedTeam = findUpdatedTeamSnapshot(
        computeResult.teamUpdates,
        teamCode
      );

      if (!updatedTeam) {
        const message =
          'Signing compute succeeded but no updated team snapshot was returned.';
        reportMutationError(message, {
          playerId: idToSign,
          computeResult,
        });
        return { success: false, message };
      }

      const operationId = generateLocalOperationId();
      const occurredAt = new Date().toISOString();
      const localValidatedAudit = buildCapAuditEvaluation({
        operationId,
        occurredAt,
        mutationType: 'signFreeAgent',
        worldId: null,
        year: actionSeasonContext.actionYear,
        teamCodes: [teamCode],
        playerIds: [String(idToSign)],
        beforeTeamsByCode: {
          [teamCode]: safeCloneForAudit(teamCapSheet as CapSheet),
        },
        afterTeamsByCode: {
          [teamCode]: safeCloneForAudit(updatedTeam as CapSheet),
        },
      });
      const localValidatedAuditEvent = withLocalCapAuditLifecycleState(
        localValidatedAudit.event,
        localValidatedAudit.validation.valid
          ? 'local-validated-applied'
          : 'evaluation-blocked'
      );
      appendLocalCapAuditEvent(localValidatedAuditEvent, {
        storageKey: BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM.storageKey,
      });

      if (!localValidatedAudit.validation.valid) {
        const message = getFirstViolationMessage(
          localValidatedAudit.validation,
          'Signing blocked by post-state cap validation in vacuum mode.'
        );
        reportMutationError(message, {
          playerId: idToSign,
          operationId,
          violations: localValidatedAudit.validation.violations,
        });
        return { success: false, message };
      }

      return {
        success: true,
        propagationMode: 'local-validated',
        localValidatedTeam: updatedTeam as CapSheet,
        localValidatedTeamSource: 'compute',
      };
    },
    [playersMap, reportMutationError, teamCapSheet, teamCode]
  );

  const resolveStandardSigningExecutionRoute = useCallback<
    () => StandardSigningExecutionRoute
  >(
    () =>
      worldId
        ? {
            mode: 'world',
            execute: executeWorldModeStandardSigning,
          }
        : {
            mode: 'vacuum',
            execute: executeVacuumModeStandardSigning,
          },
    [executeVacuumModeStandardSigning, executeWorldModeStandardSigning, worldId]
  );

  const applyCapAuditedTeamMutation = useCallback(
    (params: {
      mutationType: string;
      playerIds?: string[];
      computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
      persistPayload?: ArchitectMutationPayload;
      invalidMessage: string;
      seasonIdOverride?: string;
      yearOverride?: number;
    }): {
      applied: boolean;
      operationId: string | null;
      persistPromise: Promise<boolean> | null;
    } => {
      const {
        mutationType,
        playerIds = [],
        computeNextTeam,
        persistPayload = {},
        invalidMessage,
        seasonIdOverride,
        yearOverride = currentYear,
      } = params;

      const lockScopeKey = worldId
        ? getWorldOptimisticLockScopeKey(worldId)
        : null;
      let optimisticLockAcquired = false;
      let persistScheduled = false;

      try {
        if (lockScopeKey) {
          optimisticLockAcquired = acquireOptimisticLock(lockScopeKey);
          if (!optimisticLockAcquired) {
            const blockedMessage =
              'Another cap mutation is still saving. Please wait and try again.';
            reportMutationError(blockedMessage, {
              mutationType,
              worldId,
              lockScopeKey,
            });
            return { applied: false, operationId: null, persistPromise: null };
          }
        }

        if (!teamCapSheet) {
          reportMutationError(
            `Cannot apply ${mutationType}: team state is not loaded.`,
            {
              mutationType,
            }
          );
          return { applied: false, operationId: null, persistPromise: null };
        }

        const boundary = prepareCapAuditedMutationBoundary({
          mutationType,
          playerIds,
          computeNextTeam,
          yearOverride,
        });

        appendLocalCapAuditEvent(boundary.auditEvent, {
          storageKey: boundary.storageKey,
        });

        if (!boundary.auditEvaluation.validation.valid) {
          // The audit record has already been written with an explicit
          // `evaluation-blocked` lifecycle state, so callers can distinguish
          // blocked preview/audit records from pending optimistic preview.
          reportMutationError(
            getFirstViolationMessage(
              boundary.auditEvaluation.validation,
              invalidMessage
            ),
            {
              mutationType,
              operationId: boundary.operationId,
              violations: boundary.auditEvaluation.validation.violations,
            }
          );
          return {
            applied: false,
            operationId: boundary.operationId,
            persistPromise: null,
          };
        }

        boundary.applyNonAuthoritativeState();

        if (boundary.localStateKind === 'local-validated-apply') {
          return {
            applied: true,
            operationId: boundary.operationId,
            persistPromise: Promise.resolve(true),
          };
        }

        const persistPromise = persistMutation(mutationType, persistPayload, {
          operationId: boundary.operationId,
          seasonIdOverride,
          onSuccess: boundary.linkCommittedPersistSuccess,
          onFailure: (message) => {
            boundary.rollbackOptimisticLocalState();
            reportMutationError(
              message || `Failed to persist ${mutationType} mutation.`,
              {
                mutationType,
                operationId: boundary.operationId,
              }
            );
          },
        });
        const persistCompletionPromise = persistPromise
          .then(async (result) => {
            if (!result?.success) {
              return false;
            }
            await syncTeamFromMutationResult(mutationType, result);
            return true;
          })
          .catch(() => false);

        persistScheduled = true;
        void persistPromise.finally(() => {
          if (lockScopeKey) {
            releaseOptimisticLock(lockScopeKey);
          }
        });

        return {
          applied: true,
          operationId: boundary.operationId,
          persistPromise: persistCompletionPromise,
        };
      } finally {
        if (optimisticLockAcquired && lockScopeKey && !persistScheduled) {
          releaseOptimisticLock(lockScopeKey);
        }
      }
    },
    [
      currentYear,
      persistMutation,
      prepareCapAuditedMutationBoundary,
      reportMutationError,
      syncTeamFromMutationResult,
      teamCapSheet,
      worldId,
    ]
  );

  const finalizeCapMutationResult = useCallback(
    async (
      mutationResult: {
        applied: boolean;
        persistPromise: Promise<boolean> | null;
      },
      failureMessage: string
    ): Promise<MutationActionResult> => {
      if (!mutationResult.applied) {
        return { success: false, message: failureMessage };
      }
      const persisted = mutationResult.persistPromise
        ? await mutationResult.persistPromise
        : true;
      if (!persisted) {
        return { success: false, message: failureMessage };
      }
      return { success: true };
    },
    []
  );

  // === Trade Actions ===

  const prepareAuthoritativeSigningDetails = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      overrides: AuthoritativeSigningPreparationOverrides
    ): PreparedAuthoritativeSigningDetails => {
      const contractForAuthority =
        stripPrebuiltSigningRowsForAuthority(contract) ||
        (contract as LocalContract);
      const actionSeasonContext = buildActionSeasonContext(
        contractForAuthority,
        currentYear
      );
      const signedUsing = deriveSigningMechanism(contract);
      const signedUsingForContract = normalizeOptionalMutationString(signedUsing);
      const normalizedExceptionType =
        typeof contract.exceptionType === 'string'
          ? contract.exceptionType.trim()
          : '';
      const preparedContract = ensureContractStructure(contractForAuthority, {
        ...overrides,
        contractType: overrides.contractType,
        signingTeam: teamCode,
        startYear: actionSeasonContext.actionYear,
        signedUsing: signedUsingForContract,
        exceptionType:
          normalizedExceptionType || signedUsingForContract || undefined,
      });

      if (!preparedContract) {
        return {
          actionSeasonContext,
          architectContract: null,
          signedUsing,
        };
      }

      const salaryRows = Array.isArray(preparedContract.salariesByYear)
        ? preparedContract.salariesByYear
        : [];
      const baseSalary = Number(salaryRows[0]?.salary) || 0;
      const contractYears =
        salaryRows.length ||
        Math.max(
          1,
          Number(preparedContract.contractYears ?? preparedContract.years) || 1
        );
      const totalValue = salaryRows.reduce(
        (sum, row) => sum + (Number(row?.salary) || 0),
        0
      );
      const yearsOfService = deriveSigningYearsOfService(playerObj, contract);

      return {
        actionSeasonContext,
        signedUsing,
        architectContract: {
          ...preparedContract,
          years: contractYears,
          contractYears,
          totalValue,
          averageAnnualValue:
            contractYears > 0 ? Math.round(totalValue / contractYears) : 0,
          base: baseSalary,
          firstYearGuaranteed: salaryRows[0]?.guaranteed !== false,
          guaranteed:
            preparedContract.guaranteed ??
            salaryRows.every((row) => row?.guaranteed !== false),
          signedUsing: signedUsingForContract,
          exceptionType:
            normalizedExceptionType || signedUsingForContract || undefined,
          yearsOfService: yearsOfService ?? undefined,
          isMinimum:
            signedUsing?.toLowerCase() === 'minimum' ||
            preparedContract.isMinimum === true ||
            baseSalary <= MINIMUM_SIGNING_HEURISTIC,
        },
      };
    },
    [currentYear, teamCode]
  );

  const prepareStandardSigningMutationPayload = useCallback(
    (
      playerObj: ArchitectPlayer,
      playerId: string,
      contract: SigningDetails
    ): PreparedStandardSigningDetails => {
      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType:
            typeof contract.contractType === 'string'
              ? contract.contractType
              : 'Signed FA',
          isExtension: !!contract.isExtension,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: false,
        });

      if (!architectContract) {
        return {
          actionSeasonContext,
          standardSigningPayload: null,
        };
      }

      return {
        actionSeasonContext,
        standardSigningPayload: {
          teamCode,
          playerId,
          contract: architectContract,
          signedUsing,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );

  const prepareOfferSheetCreationDefinition = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): PreparedOfferSheetCreationDefinition => {
      const playerId = String(playerObj.id || playerObj.player_id || '').trim();
      if (!playerId) {
        return buildOfferSheetCreationDefinitionFailure(
          'incomplete',
          'Authoritative offer sheet preflight is missing player context.',
          'Cannot store offer sheet: missing player ID.',
          {
            playerObj,
          }
        );
      }

      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType: 'Offer Sheet',
          isExtension: false,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: false,
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          rfaOfferSheetStatus: 'PENDING_MATCH',
        });

      if (!architectContract) {
        return buildOfferSheetCreationDefinitionFailure(
          'blocked',
          'Cannot complete offer sheet: contract payload is invalid.',
          'Cannot store offer sheet: contract payload is invalid.',
          {
            playerId,
            contract,
          }
        );
      }

      return {
        ok: true,
        actionSeasonContext,
        preflightPayload: {
          offeringTeamCode: teamCode,
          playerId,
          contract: architectContract,
        },
        mutationPayload: {
          teamCode,
          playerId,
          contract: architectContract,
          signedUsing,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );

  const prepareSignAndTradeTransactionDefinition = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): PreparedSignAndTradeTransactionDefinition => {
      const canonicalDestinationTeamCode = destinationTeamCode
        ? resolveTeamCode(destinationTeamCode) || destinationTeamCode
        : '';
      if (!canonicalDestinationTeamCode) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Destination team is required for sign-and-trade.',
          {
            playerObj,
            destinationTeamCode,
          }
        );
      }

      if (canonicalDestinationTeamCode === teamCode) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Destination team must be different from the current team for sign-and-trade.',
          {
            playerObj,
            destinationTeamCode,
            canonicalDestinationTeamCode,
          }
        );
      }

      const playerId = String(playerObj.id || playerObj.player_id || '').trim();
      if (!playerId) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Cannot complete sign-and-trade: missing player ID.',
          {
            playerObj,
          }
        );
      }

      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType: 'Sign & Trade',
          isExtension: false,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: true,
        });

      if (!architectContract) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Cannot complete sign-and-trade: contract payload is invalid.',
          {
            playerId,
            contract,
          }
        );
      }

      return {
        ok: true,
        actionSeasonContext,
        mutationPayload: {
          teamCode,
          destinationTeamCode: canonicalDestinationTeamCode,
          playerId,
          contract: architectContract,
          signedUsing,
          signAndTrade: true,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );

  const buildTradeExecutionHandoff = useCallback(
    (tradeData: TradeDataItem[]): TradeExecutionHandoff => {
      const resolvedTeamCodes = tradeData.map(
        (t) => resolveTeamCode(t.teamId) || t.teamId
      );
      const teamIndexByCode = new Map<string, number>();
      resolvedTeamCodes.forEach((code, index) => {
        teamIndexByCode.set(code, index);
      });

      const teams: NonNullable<ArchitectMutationPayload['teams']> =
        tradeData.map(
          (t, teamIndex): TradeMutationPayloadTeam => ({
            teamCode: resolvedTeamCodes[teamIndex],
            sends: ((t.outgoing || t.outgoingPlayers || []) as ArchitectPlayer[]).map((p) => {
              const rawDestination =
                p.receivingTeamId || p.tradeTo || p.toTeamId || p.destTeamId;
              const destinationTeamCode = rawDestination
                ? resolveTeamCode(String(rawDestination)) ||
                  String(rawDestination)
                : undefined;
              const receivingTeamIndex =
                destinationTeamCode != null
                  ? teamIndexByCode.get(destinationTeamCode)
                  : undefined;

              const tradeContract =
                toSignAndTradeValidationContract(p.signAndTradeContract) ||
                (p.contract
                  ? toSignAndTradeValidationContract(p.contract)
                  : null);
              const signAndTradeValidation = p.signAndTrade
                ? validateSignAndTradeContractPayload(
                    tradeContract,
                    currentYear,
                    { requireActiveYearRow: true }
                  )
                : null;

              if (
                p.signAndTrade &&
                (!destinationTeamCode ||
                  destinationTeamCode ===
                    (resolveTeamCode(t.teamId) || t.teamId))
              ) {
                throw new Error(
                  `Sign-and-trade asset "${p.name || p.id || p.player_id}" must include a valid destination team`
                );
              }

              if (
                p.signAndTrade &&
                (!signAndTradeValidation?.valid ||
                  !signAndTradeValidation.contract)
              ) {
                throw new Error(
                  `Sign-and-trade asset "${p.name || p.id || p.player_id}" is missing valid contract details`
                );
              }

              return {
                ...p,
                // Explicitly map ID for pipeline consumption
                playerId: p.id || p.player_id,
                // Normalize routing fields so apply-time pipeline can consume either path.
                tradeTo: destinationTeamCode,
                receivingTeamId: destinationTeamCode,
                receivingTeamIndex,
                signAndTrade: !!p.signAndTrade,
                signAndTradeContract:
                  signAndTradeValidation?.contract ||
                  p.signAndTradeContract ||
                  undefined,
                contract:
                  // Cast: SignAndTradeNormalizedContract is validated (requireActiveYearRow: true)
                  // so seasons are always present — compatible with ArchitectMutationContract at runtime.
                  (signAndTradeValidation?.contract ||
                    p.contract ||
                    undefined) as ArchitectMutationContract | undefined,
                contractYears:
                  signAndTradeValidation?.contract?.contractYears ||
                  p.contractYears ||
                  undefined,
                firstYearGuaranteed:
                  signAndTradeValidation?.contract?.firstYearGuaranteed ??
                  p.firstYearGuaranteed ??
                  undefined,
              };
            }),
            picksOut: [],
            // TM-PICKS-E1: Include outgoing entitlements in persistence payload
            outgoingEntitlements: t.outgoingEntitlements || [],
            entitlementsOut: t.outgoingEntitlements || [],
          })
        );

      for (const team of teams) {
        for (const player of team.sends || []) {
          if (!player.playerId) {
            console.error('Trade missing playerId', { player, team });
            toast.error('Cannot save trade: Player ID missing');
            throw new Error(
              `Trade missing playerId for ${player.name || 'unknown'}`
            );
          }
        }
      }

      const authoritativeTradeCtx = {
        source: 'tradeMachine' as const,
        worldId,
        yearKey: currentYear,
        ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
      };
      const payload = {
        teams,
        ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
        tradeCtx: authoritativeTradeCtx,
      } satisfies TradeExecutionPayload;

      return {
        resolvedTeamCodes,
        payload,
      };
    },
    [currentYear, worldAsOfDate, worldId]
  );

  const commitTradeExecutionHandoff = useCallback(
    async (tradeExecutionHandoff: TradeExecutionHandoff): Promise<void> => {
      await runAuthoritativeWorldMutationWithDashboardSync(
        'executeTrade',
        tradeExecutionHandoff.payload
      );
    },
    [runAuthoritativeWorldMutationWithDashboardSync]
  );

  const applyTradeExecutionHandoffToBaseState = useCallback(
    async (tradeExecutionHandoff: TradeExecutionHandoff): Promise<void> => {
      const { resolvedTeamCodes, payload } = tradeExecutionHandoff;
      const teams = payload.teams;

      try {
        const loadedTeams = await Promise.all(
          resolvedTeamCodes.map(async (resolvedTeamCode, index) => {
            const baseTeamSnapshot = await loadWorldTeamData(
              null,
              resolvedTeamCode
            );
            if (!baseTeamSnapshot) {
              throw new Error(
                `Unable to load base-state snapshot for team ${resolvedTeamCode} (trade index ${index})`
              );
            }
            return {
              teamCode: resolvedTeamCode,
              team: baseTeamSnapshot,
            };
          })
        );

        const tradePayload = {
          ...payload,
          tradeCtx: {
            ...payload.tradeCtx,
            worldId: null,
          },
        } satisfies TradeExecutionPayload;

        const tradeCurrentState = {
          teams: loadedTeams,
        } as ExecuteTradeCurrentState;

        const computeResult = computeWorldMutation({
          mutationType: 'executeTrade',
          payload: tradePayload,
          currentState: tradeCurrentState,
          seasonId,
          timestamp: Date.now(),
          asOfDate: worldAsOfDate || undefined,
        }) as ComputeMutationResult;

        if (!computeResult?.success) {
          throw new Error(
            String(
              computeResult?.error ||
                'Base-state trade apply failed authoritative compute.'
            )
          );
        }

        const validatedContext = computeResult._validatedTradeContext;

        if (!validatedContext?._isValidatedTradeContext) {
          throw new Error(
            'Base-state trade apply failed: missing authoritative validated trade context.'
          );
        }

        if (!validatedContext.legal) {
          throw new Error(
            validatedContext.error ||
              validatedContext.reason ||
              'Base-state trade apply blocked by authoritative validation.'
          );
        }

        const updatedTeam = findUpdatedTeamSnapshot(
          computeResult.teamUpdates,
          teamCode
        );

        if (!updatedTeam) {
          throw new Error(
            `Base-state trade apply failed: authoritative compute did not return team snapshot for ${teamCode}.`
          );
        }

        const beforeTeamsByCode: TeamsByCode = {};
        for (const loadedTeam of loadedTeams) {
          if (loadedTeam?.teamCode && loadedTeam?.team) {
            beforeTeamsByCode[loadedTeam.teamCode] = safeCloneForAudit(
              loadedTeam.team as CapSheet
            );
          }
        }

        const afterTeamsByCode: TeamsByCode = {};
        for (const update of computeResult.teamUpdates || []) {
          if (update?.teamCode && update?.team) {
            afterTeamsByCode[update.teamCode] = safeCloneForAudit(
              update.team as CapSheet
            );
          }
        }

        const tradePlayerIds = Array.from(
          new Set(
            teams.flatMap((team) =>
              (team?.sends || [])
                .map((player) => String(player?.playerId || ''))
                .filter((playerId) => playerId.length > 0)
            )
          )
        );
        const operationId = generateLocalOperationId();
        const occurredAt = new Date().toISOString();
        const localValidatedAudit = buildCapAuditEvaluation({
          operationId,
          occurredAt,
          mutationType: 'executeTrade',
          worldId: null,
          year: currentYear,
          teamCodes: resolvedTeamCodes,
          playerIds: tradePlayerIds,
          beforeTeamsByCode,
          afterTeamsByCode,
        });
        const localValidatedAuditEvent = withLocalCapAuditLifecycleState(
          localValidatedAudit.event,
          localValidatedAudit.validation.valid
            ? 'local-validated-applied'
            : 'evaluation-blocked'
        );
        appendLocalCapAuditEvent(localValidatedAuditEvent, {
          storageKey: BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM.storageKey,
        });

        if (!localValidatedAudit.validation.valid) {
          throw new Error(
            getFirstViolationMessage(
              localValidatedAudit.validation,
              'Base-state trade apply blocked by post-state cap validation.'
            )
          );
        }

        setTeamCapSheetSafe(updatedTeam as CapSheet);
      } catch (error) {
        console.error('[Architect][Trade][BaseStateApply] failed', {
          teamCode,
          seasonId,
          currentYear,
          error,
        });
        throw error;
      }
    },
    [currentYear, seasonId, setTeamCapSheetSafe, teamCode, worldAsOfDate]
  );

  const applyTradeToCapSheet = useCallback(
    async (tradeData: TradeDataItem[]): Promise<void> => {
      if (!tradeData || !Array.isArray(tradeData)) {
        return;
      }

      /* TRADE APPLY CONTRACT:
         - TradeSection/TradeEditor hand off a staged draft only.
         - This action layer normalizes the authoritative executeTrade payload.
         - World-mode commit and base-mode preview apply branch here, not in the wrapper. */
      const tradeExecutionHandoff = buildTradeExecutionHandoff(tradeData);

      if (worldId) {
        await commitTradeExecutionHandoff(tradeExecutionHandoff);
        return;
      }

      await applyTradeExecutionHandoffToBaseState(tradeExecutionHandoff);
    },
    [
      applyTradeExecutionHandoffToBaseState,
      buildTradeExecutionHandoff,
      commitTradeExecutionHandoff,
      worldId,
    ]
  );

  // === Contract/Player Actions ===

  const handleSign = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<MutationActionResult> => {
      const idToSign = playerObj.id || playerObj.player_id;
      if (!idToSign) {
        reportMutationError('Cannot sign player: missing player ID.', {
          playerObj,
        });
        return {
          success: false,
          message: 'Cannot sign player: missing player ID.',
        };
      }

      const normalizedPlayerId = String(idToSign).trim();
      const { actionSeasonContext, standardSigningPayload } =
        prepareStandardSigningMutationPayload(
          playerObj,
          normalizedPlayerId,
          contract
        );

      if (!standardSigningPayload?.contract) {
        reportMutationError(
          'Cannot sign player: contract payload is missing salaries.',
          {
            playerId: normalizedPlayerId,
            contract,
          }
        );
        return {
          success: false,
          message: 'Cannot sign player: contract payload is missing salaries.',
        };
      }

      const standardSigningExecutionRoute =
        resolveStandardSigningExecutionRoute();
      const executionResult = await standardSigningExecutionRoute.execute(
        playerObj,
        actionSeasonContext,
        standardSigningPayload
      );

      if (executionResult.success !== true) {
        return {
          success: false,
          message: executionResult.message,
        };
      }

      try {
        await applyResolvedStandardSigningState(playerObj, executionResult);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Signing saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          playerId: normalizedPlayerId,
          error,
        });
        return {
          success: false,
          message,
        };
      }

      return { success: true };
    },
    [
      applyResolvedStandardSigningState,
      reportMutationError,
      resolveStandardSigningExecutionRoute,
    ]
  );

  const applyCommittedSignAndTradeState = useCallback(
    async (committedWorldTeam: ResolvedCommittedWorldTeam): Promise<void> => {
      await applyCommittedWorldReload('signAndTrade', {
        committedTeam: committedWorldTeam.committedTeam,
        committedTeamSource: committedWorldTeam.committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeSignAndTrade = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: SignAndTradeMutationPayload
    ): Promise<SignAndTradeExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage('signAndTrade', 'commit');
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: actionSeasonContext.seasonId,
          mutationType: 'signAndTrade',
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('signAndTrade', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to save sign-and-trade.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to save sign-and-trade.'
          );
          reportMutationError(message, {
            mutationType: 'signAndTrade',
            payload: mutationPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedWorldTeam =
          await resolveCommittedWorldTeamSnapshot(result);
        const committedTeam = committedWorldTeam?.committedTeam || null;

        if (!committedTeam) {
          const message =
            'Sign-and-trade saved but the committed team snapshot could not be reloaded.';
          reportMutationError(message, {
            mutationType: 'signAndTrade',
            payload: mutationPayload,
            playerId: mutationPayload.playerId,
            result,
          });
          finishSave(message);
          return { success: false, message };
        }

        toast.success('Saved changes');
        finishSave();
        if (!committedWorldTeam) {
          return {
            success: false,
            message:
              'Sign-and-trade saved but the committed team snapshot could not be reloaded.',
          };
        }
        return {
          success: true,
          ...committedWorldTeam,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to save sign-and-trade.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          payload: mutationPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedWorldTeamSnapshot,
      startSave,
      userId,
      worldId,
    ]
  );

  const handleSignAndTrade = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): Promise<MutationActionResult> => {
      const worldRequiredMessage =
        requireActiveWorldForFreeAgencyWorldOnlyCommit('signAndTrade', {
          playerObj,
          destinationTeamCode,
        });
      if (worldRequiredMessage) {
        return {
          success: false,
          message: worldRequiredMessage,
        };
      }

      const transactionDefinition = prepareSignAndTradeTransactionDefinition(
        playerObj,
        contract,
        destinationTeamCode
      );

      if (isSignAndTradeTransactionPreparationFailure(transactionDefinition)) {
        reportMutationError(
          transactionDefinition.message,
          transactionDefinition.logContext
        );
        return {
          success: false,
          message: transactionDefinition.message,
        };
      }

      const result = await executeWorldModeSignAndTrade(
        transactionDefinition.actionSeasonContext,
        transactionDefinition.mutationPayload
      );

      if (result.success !== true) {
        return {
          success: false,
          message: result.message,
        };
      }

      try {
        await applyCommittedSignAndTradeState(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Sign-and-trade saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          playerId: transactionDefinition.mutationPayload.playerId,
          error,
        });
        return {
          success: false,
          message,
        };
      }

      return { success: true };
    },
    [
      applyCommittedSignAndTradeState,
      executeWorldModeSignAndTrade,
      prepareSignAndTradeTransactionDefinition,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
    ]
  );

  const getSignAndTradePreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): Promise<SignAndTradePreflightResult> => {
      if (!worldId) {
        return buildBlockedWorldOnlySignAndTradePreflightResult();
      }

      const transactionDefinition = prepareSignAndTradeTransactionDefinition(
        playerObj,
        contract,
        destinationTeamCode
      );

      if (isSignAndTradeTransactionPreparationFailure(transactionDefinition)) {
        return transactionDefinition.preflightResult;
      }

      try {
        return await preflightSignAndTradeMutation({
          worldId,
          seasonId: transactionDefinition.actionSeasonContext.seasonId,
          payload: transactionDefinition.mutationPayload,
        });
      } catch (error) {
        return {
          status: 'incomplete',
          reasons: [
            error instanceof Error
              ? error.message
              : 'Authoritative sign-and-trade preflight failed before legality could be determined.',
          ],
          warnings: [],
          source: 'authoritative-preflight',
        };
      }
    },
    [
      buildBlockedWorldOnlySignAndTradePreflightResult,
      prepareSignAndTradeTransactionDefinition,
      worldId,
    ]
  );

  const getOfferSheetPreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<OfferSheetPreflightResult> => {
      if (!worldId) {
        return buildBlockedWorldOnlyOfferSheetPreflightResult();
      }

      const creationDefinition = prepareOfferSheetCreationDefinition(
        playerObj,
        contract
      );
      if (isOfferSheetCreationDefinitionFailure(creationDefinition)) {
        return creationDefinition.preflightResult;
      }

      try {
        return await preflightOfferSheetMutation({
          worldId,
          seasonId: creationDefinition.actionSeasonContext.seasonId,
          ...creationDefinition.preflightPayload,
        });
      } catch (error) {
        return {
          status: 'incomplete',
          reasons: [
            error instanceof Error
              ? error.message
              : 'Authoritative offer sheet preflight failed before legality could be determined.',
          ],
          warnings: [],
          source: 'authoritative-preflight',
        };
      }
    },
    [
      buildBlockedWorldOnlyOfferSheetPreflightResult,
      prepareOfferSheetCreationDefinition,
      worldId,
    ]
  );

  // === RFA Offer Sheet Actions ===

  const handleStoreOfferSheet = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<MutationActionResult> => {
      const worldRequiredMessage =
        requireActiveWorldForFreeAgencyWorldOnlyCommit('offerSheetCreation', {
          playerObj,
        });
      if (worldRequiredMessage) {
        return {
          success: false,
          message: worldRequiredMessage,
        };
      }

      const creationDefinition = prepareOfferSheetCreationDefinition(
        playerObj,
        contract
      );
      if (isOfferSheetCreationDefinitionFailure(creationDefinition)) {
        reportMutationError(
          creationDefinition.storeMessage,
          creationDefinition.logContext
        );
        return {
          success: false,
          message: creationDefinition.storeMessage,
        };
      }

      const result = await executeWorldModeOfferSheetStore(
        creationDefinition.actionSeasonContext,
        creationDefinition.mutationPayload
      );

      if (result.success !== true) {
        return {
          success: false,
          message: result.message,
        };
      }

      try {
        await applyCommittedOfferSheetState(
          result.committedTeam,
          result.committedTeamSource
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Offer sheet saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          playerId: creationDefinition.mutationPayload.playerId,
          error,
        });
        return {
          success: false,
          message,
        };
      }

      return { success: true };
    },
    [
      applyCommittedOfferSheetState,
      executeWorldModeOfferSheetStore,
      prepareOfferSheetCreationDefinition,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
    ]
  );

  const runOfferSheetResolutionAction = useCallback(
    (
      action: OfferSheetResolutionAction,
      offeringTeamCode: string,
      offerSheetId: string
    ): void => {
      const mutationType: OfferSheetResolutionMutationType =
        action === 'match' ? 'matchOfferSheet' : 'declineOfferSheet';
      const actionLabel = action === 'match' ? 'match' : 'decline';

      void (async () => {
        const worldRequiredMessage =
          requireActiveWorldForFreeAgencyWorldOnlyCommit(
            'offerSheetLifecycle',
            {
              offeringTeamCode,
              offerSheetId,
              action,
            }
          );
        if (worldRequiredMessage) {
          return;
        }

        if (!offeringTeamCode || !offerSheetId) {
          reportMutationError(
            `Cannot ${actionLabel} offer sheet: missing offering team or offer sheet ID.`,
            {
              offeringTeamCode,
              offerSheetId,
              action,
            }
          );
          return;
        }

        const expectation: OfferSheetLifecycleCommittedStateExpectation = {
          activeTeamArrayKey: 'incomingOfferSheets',
          presence: 'present',
          identity: {
            offerSheetId,
            offeringTeamCode,
            homeTeamCode: teamCode,
            status: action === 'match' ? 'MATCHED' : 'DECLINED',
          },
        };

        await executeWorldModeOfferSheetLifecycleMutation(
          mutationType,
          {
            teamCode,
            offeringTeamCode,
            offerSheetId,
          },
          expectation
        );
      })();
    },
    [
      executeWorldModeOfferSheetLifecycleMutation,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
      teamCode,
    ]
  );

  const resolveOfferSheetFinalizeMutationRoute = useCallback(
    (
      offerSheet: OfferSheet | null | undefined
    ): OfferSheetFinalizeMutationRoute => {
      if (!offerSheet) {
        return {
          ok: false,
          message: 'Cannot finalize offer sheet: offer sheet data is missing.',
        };
      }

      if (!offerSheet.id) {
        return {
          ok: false,
          message: 'Cannot finalize offer sheet: missing offer sheet ID.',
          logContext: {
            offerSheet,
          },
        };
      }

      if (
        offerSheet.status === 'MATCHED' &&
        offerSheet.homeTeamCode === teamCode
      ) {
        return {
          ok: true,
          mutationType: 'finalizeMatchedOfferSheet',
          payload: {
            teamCode,
            offeringTeamCode: offerSheet.offeringTeamCode,
            offerSheetId: offerSheet.id,
          },
        };
      }

      if (
        offerSheet.status === 'DECLINED' &&
        offerSheet.offeringTeamCode === teamCode
      ) {
        return {
          ok: true,
          mutationType: 'finalizeDeclinedOfferSheet',
          payload: {
            teamCode,
            offeringTeamCode: teamCode,
            homeTeamCode: offerSheet.homeTeamCode,
            offerSheetId: offerSheet.id,
            dedupKey: offerSheet.dedupKey,
            playerId: offerSheet.playerId,
            seasonKey: offerSheet.seasonKey,
          },
        };
      }

      return {
        ok: false,
        message: `Cannot finalize offer sheet: status/team mismatch (status=${offerSheet.status || 'unknown'}).`,
        logContext: {
          offerSheet,
        },
      };
    },
    [teamCode]
  );

  const handleMatchOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      runOfferSheetResolutionAction('match', offeringTeamCode, offerSheetId);
    },
    [runOfferSheetResolutionAction]
  );

  const handleDeclineOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      runOfferSheetResolutionAction('decline', offeringTeamCode, offerSheetId);
    },
    [runOfferSheetResolutionAction]
  );

  const handleFinalizeOfferSheet = useCallback(
    (offerSheet: OfferSheet | null | undefined): void => {
      void (async () => {
        const worldRequiredMessage =
          requireActiveWorldForFreeAgencyWorldOnlyCommit(
            'offerSheetLifecycle',
            {
              offerSheet,
            }
          );
        if (worldRequiredMessage) {
          return;
        }

        const finalizeRoute =
          resolveOfferSheetFinalizeMutationRoute(offerSheet);
        if ('message' in finalizeRoute) {
          reportMutationError(finalizeRoute.message, finalizeRoute.logContext);
          return;
        }

        const expectation: OfferSheetLifecycleCommittedStateExpectation =
          finalizeRoute.mutationType === 'finalizeMatchedOfferSheet'
            ? {
                activeTeamArrayKey: 'incomingOfferSheets',
                presence: 'absent',
                identity: {
                  offerSheetId: finalizeRoute.payload.offerSheetId,
                  offeringTeamCode: finalizeRoute.payload.offeringTeamCode,
                  homeTeamCode: teamCode,
                },
              }
            : {
                activeTeamArrayKey: 'offerSheets',
                presence: 'absent',
                identity: {
                  offerSheetId: finalizeRoute.payload.offerSheetId,
                  dedupKey: finalizeRoute.payload.dedupKey,
                  playerId: finalizeRoute.payload.playerId,
                  seasonKey: finalizeRoute.payload.seasonKey,
                  offeringTeamCode: finalizeRoute.payload.offeringTeamCode,
                  homeTeamCode: finalizeRoute.payload.homeTeamCode,
                },
              };

        await executeWorldModeOfferSheetLifecycleMutation(
          finalizeRoute.mutationType,
          finalizeRoute.payload,
          expectation
        );
      })();
    },
    [
      executeWorldModeOfferSheetLifecycleMutation,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
      resolveOfferSheetFinalizeMutationRoute,
      teamCode,
    ]
  );

  const runManualCapSheetLedgerMutation = useCallback(
    (params: ManualCapSheetLedgerMutationParams): Promise<boolean> => {
      const normalizedExceptions =
        params.type === 'exceptions'
          ? normalizeManualExceptionsForMutation(params.exceptions)
          : null;
      const mutationConfig =
        params.type === 'deadCap'
          ? {
              mutationType: 'setDeadCap',
              playerIds: [],
              invalidMessage:
                'Dead cap update blocked by post-state cap validation.',
              computeNextTeam: (beforeTeam: CapSheet) =>
                synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    deadCap: params.deadCap,
                  },
                  currentYear
                ) as CapSheet,
              persistPayload: {
                teamCode,
                deadCap: params.deadCap,
              },
            }
          : {
              mutationType: 'setExceptions',
              playerIds: [],
              invalidMessage:
                'Exception update blocked by post-state cap validation.',
              computeNextTeam: (beforeTeam: CapSheet) =>
                synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    exceptions: mergeManualExceptionSnapshot(
                      beforeTeam.exceptions as Record<string, unknown> | null,
                      normalizedExceptions as Record<string, unknown> | null
                    ) as NonNullable<CapSheet['exceptions']>,
                  },
                  currentYear
                ) as CapSheet,
              persistPayload: {
                teamCode,
                exceptions: normalizedExceptions,
              },
            };
      const mutationResult = applyCapAuditedTeamMutation(mutationConfig);
      if (!mutationResult.applied) {
        return Promise.resolve(false);
      }
      return mutationResult.persistPromise || Promise.resolve(true);
    },
    [applyCapAuditedTeamMutation, currentYear, teamCode]
  );

  // === Dead Money Actions (Phase 24) ===
  const handleSetDeadCap = useCallback(
    (deadCap: DeadCapEntry[]): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'deadCap',
        deadCap,
      }),
    [runManualCapSheetLedgerMutation]
  );

  // === Exception Management Actions (Phase 27) ===
  const handleSetExceptions = useCallback(
    (exceptions: ManualExceptionsSavePayload): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'exceptions',
        exceptions,
      }),
    [runManualCapSheetLedgerMutation]
  );

  const hasInjectedCapSheetFixtures = useMemo(
    () => hasInjectedCapSheetFixturesInTeam(teamCapSheet),
    [teamCapSheet]
  );

  const applyLocalDevCapSheetFixtureState = useCallback(
    (operation: 'inject' | 'clear'): MutationActionResult => {
      if (!import.meta.env.DEV) {
        return {
          success: false,
          message:
            'Cap sheet DEV fixtures are only available in local DEV builds.',
        };
      }

      if (!teamCapSheet) {
        return {
          success: false,
          message: `Cannot ${operation} fixtures: team state is not loaded.`,
        };
      }

      const nextTeam =
        operation === 'inject'
          ? injectCapSheetFixtures(teamCapSheet, currentYear)
          : clearCapSheetFixtures(teamCapSheet);

      // Local DEV seam only: fixture players never enter mutation persistence.
      setTeamCapSheetSafe(nextTeam as CapSheet);
      return { success: true };
    },
    [currentYear, setTeamCapSheetSafe, teamCapSheet]
  );

  const injectCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('inject'),
    [applyLocalDevCapSheetFixtureState]
  );

  const clearCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('clear'),
    [applyLocalDevCapSheetFixtureState]
  );

  const capSheetDevTools = useMemo<CapSheetDevTools>(
    () => ({
      injectLocalFixtures: injectCapSheetDevFixtures,
      clearLocalFixtures: clearCapSheetDevFixtures,
      hasInjectedLocalFixtures: hasInjectedCapSheetFixtures,
      localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
      syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
      runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
      injectFixtures: injectCapSheetDevFixtures,
      clearFixtures: clearCapSheetDevFixtures,
      hasInjectedFixtures: hasInjectedCapSheetFixtures,
    }),
    [
      clearCapSheetDevFixtures,
      hasInjectedCapSheetFixtures,
      injectCapSheetDevFixtures,
    ]
  );

  const hasInjectedTeamHistoryFixtures = useMemo(
    () => hasInjectedTeamHistoryFixturesInTeam(teamCapSheet ?? null),
    [teamCapSheet]
  );

  const injectTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot inject Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = injectTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const clearTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot clear Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = clearTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const teamHistoryDevTools = useMemo<TeamHistoryDevTools>(
    () => ({
      injectFixtures: injectTeamHistoryDevFixtures,
      clearFixtures: clearTeamHistoryDevFixtures,
      hasInjectedFixtures: hasInjectedTeamHistoryFixtures,
    }),
    [
      clearTeamHistoryDevFixtures,
      hasInjectedTeamHistoryFixtures,
      injectTeamHistoryDevFixtures,
    ]
  );

  const handleEditContract = useCallback(
    (
      player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer
    ): void => {
      openPlayerContractModalRoute({
        player: player as PlayerRulesProfileInput | ArchitectPlayer,
        rulesYear: currentYear,
        initialAction: null,
        targetYear: null,
        actionContext: null,
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  // Shared helper for renounce confirmation and execution
  // Now directly updates teamCapSheet instead of using capSheetState
  const confirmAndRenounceRights = useCallback(
    async (
      playerOrHold: RenounceActionTarget,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      const playerName = getRenounceTargetDisplayName(playerOrHold);

      if (
        !window.confirm(
          `Are you sure you want to renounce rights to ${playerName}? This will clear their cap hold.`
        )
      ) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const candidateIdSet = new Set<string>();
      const candidateNameSet = new Set<string>();
      const collectCandidate = (value: unknown): void => {
        const trimmed = String(value || '').trim();
        if (trimmed) {
          candidateIdSet.add(trimmed);
        }
        const normalized = normalizeEntityIdentity(value);
        if (normalized) {
          candidateNameSet.add(normalized);
        }
      };

      for (const candidateValue of getRenounceTargetCandidateValues(
        playerOrHold
      )) {
        collectCandidate(candidateValue);
      }

      const idToRenounce = getRenounceTargetPrimaryId(playerOrHold);

      // Persist to world if in world mode
      if (!idToRenounce) {
        console.error('Renounce missing playerId');
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const matchesHold = (hold: CapHold): boolean => {
        const holdId = String(hold?.playerId || '').trim();
        return (
          (holdId && candidateIdSet.has(holdId)) ||
          candidateNameSet.has(normalizeEntityIdentity(hold?.playerName)) ||
          candidateNameSet.has(normalizeEntityIdentity(holdId))
        );
      };
      const isPlayerRenounceable = (player: ArchitectPlayer): boolean => {
        const playerBirdStatus = String(
          player.contract?.birdRights?.status || ''
        ).toLowerCase();
        const rightsAlreadyCleared =
          Boolean(player.rightsRenounced) &&
          (!playerBirdStatus || playerBirdStatus === 'none');
        return !rightsAlreadyCleared;
      };
      const matchesPlayer = (player: ArchitectPlayer): boolean => {
        const playerId = String(player?.id || '').trim();
        const playerAltId = String(player?.player_id || '').trim();
        return (
          (playerId && candidateIdSet.has(playerId)) ||
          (playerAltId && candidateIdSet.has(playerAltId)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.name)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.displayName))
        );
      };

      const hasRemovableHold = (teamCapSheet?.capHolds || []).some((hold) =>
        matchesHold(hold as CapHold)
      );
      const hasRenounceablePlayer = (teamCapSheet?.players || []).some(
        (player) =>
          matchesPlayer(player as ArchitectPlayer) &&
          isPlayerRenounceable(player as ArchitectPlayer)
      );
      if (!hasRemovableHold && !hasRenounceablePlayer) {
        const message =
          'No matching cap hold or renounceable rights were found for this player.';
        reportMutationError(message, {
          playerName,
          idToRenounce,
          candidateIds: Array.from(candidateIdSet),
        });
        return { success: false, message };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'renounceRights',
        playerIds: [String(idToRenounce)],
        invalidMessage: 'Renounce rights blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          // Remove from capHolds array
          const updatedCapHolds = (beforeTeam.capHolds || []).filter(
            (h) => !matchesHold(h as CapHold)
          );

          // Update player object if it exists
          let rightsUpdates = 0;
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (matchesPlayer(p as ArchitectPlayer)) {
              let playerChanged = false;
              const updated: ArchitectPlayer = { ...p };
              if (!updated.rightsRenounced) {
                updated.rightsRenounced = true;
                playerChanged = true;
              }
              const currentStatus = String(
                updated.contract?.birdRights?.status || ''
              ).toLowerCase();
              if (updated.contract?.birdRights && currentStatus !== 'none') {
                updated.contract = {
                  ...updated.contract,
                  birdRights: {
                    ...updated.contract.birdRights,
                    status: 'None',
                  },
                };
                playerChanged = true;
              }
              if (playerChanged) {
                rightsUpdates += 1;
              }
              return updated;
            }
            return p;
          });

          const removedHoldsCount =
            (beforeTeam.capHolds || []).length - updatedCapHolds.length;
          if (removedHoldsCount === 0 && rightsUpdates === 0) {
            return beforeTeam;
          }

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'renounce',
                overrideMetadata.overrideReasons || [],
                idToRenounce,
                playerName
              )
            : beforeTeam?.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId: idToRenounce,
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save renounce action. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      reportMutationError,
      teamCapSheet,
      teamCode,
    ]
  );

  const handleCapTableModalAction = useCallback(
    (
      player: PlayerRulesProfileInput,
      actionType: CapSheetModalActionType,
      year: number
    ): void => {
      const contextMap: Record<CapSheetModalActionType, ActionContext> = {
        po: 'option',
        to: 'option',
        ufa: 'freeAgent',
        rfa: 'freeAgent',
      };

      openPlayerContractModalRoute({
        player,
        rulesYear: year || currentYear,
        initialAction: null,
        targetYear: year,
        actionContext: contextMap[actionType],
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  const handleCapHoldRenounce = useCallback(
    (capHold: CapHoldActionItem): void => {
      void confirmAndRenounceRights(capHold);
    },
    [confirmAndRenounceRights]
  );

  // handleExtendContract - directly updates teamCapSheet
  const handleExtendContract = useCallback(
    async (
      player: ArchitectPlayer,
      extensionContract: SigningDetails
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Extend player missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'extendPlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Extension blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              // Add extension years to futureContract
              const futureContract = p.futureContract || {
                salariesByYear: [],
                extension: true,
              };

              const newYears: SalaryByYear[] = (
                extensionContract.salariesByYear || []
              ).map((y) => ({
                season: String(y.season || ''),
                salary: Number(y.salary ?? y.capHit ?? 0),
                capHit: Number(y.capHit ?? y.salary ?? 0),
                guaranteed: y.guaranteed ?? true,
                option: y.option ?? null,
                optionType: y.optionType ?? null,
                optionUsed: y.optionUsed ?? null,
                isExtensionSeason: true,
              }));

              return {
                ...p,
                futureContract: {
                  ...futureContract,
                  salariesByYear: [
                    ...(futureContract.salariesByYear || []),
                    ...newYears,
                  ],
                  extension: true,
                },
              };
            }
            return p;
          });

          // Record override audit log if override was used
          const overrideAuditLog = extensionContract.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'extend',
                extensionContract.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          extension: {
            salariesByYear: extensionContract.salariesByYear || [],
          },
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save extension. Please try again.'
      );
    },
    [applyCapAuditedTeamMutation, finalizeCapMutationResult, teamCode]
  );

  // handleWaiveContract - directly updates teamCapSheet
  const handleWaiveContract = useCallback(
    async (
      player: ArchitectPlayer,
      options: WaiveOptions
    ): Promise<MutationActionResult> => {
      const { stretch, buyout, buyoutAmount, overrideUsed, overrideReasons } =
        options;
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : buyout
          ? 'Buy out this player?'
          : 'Waive this player?';
      if (!window.confirm(confirmMsg)) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Waive missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const normalizedBuyoutAmount = buyout
        ? Math.max(0, Number(buyoutAmount) || 0)
        : 0;

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'waivePlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Waive action blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const rosterPlayer = (beforeTeam.players || []).find(
            (p) =>
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
          );
          const contractRows: SalaryByYear[] =
            rosterPlayer?.contract?.salariesByYear ||
            player.contract?.salariesByYear ||
            [];

          // Calculate remaining guaranteed money from current/future rows.
          const remainingGuaranteed = contractRows
            .filter((y) => {
              const season = String(y.season);
              const yearEnd = /^\d{4}-\d{2}$/.test(season)
                ? 2000 + parseInt(season.split('-')[1], 10)
                : parseInt(season, 10);
              return yearEnd >= currentYear && y.guaranteed !== false;
            })
            .reduce((sum, y) => sum + Number(y.salary || 0), 0);

          const boundedBuyoutAmount = buyout
            ? Math.min(remainingGuaranteed, normalizedBuyoutAmount)
            : 0;

          // Buyout follows the same model in local + world paths:
          // dead cap equals remaining guaranteed minus buyout reduction amount.
          const deadCapAmount = buyout
            ? Math.max(0, remainingGuaranteed - boundedBuyoutAmount)
            : remainingGuaranteed;

          const shouldStretch = !!stretch && deadCapAmount > 0;
          const stretchYears = shouldStretch ? 3 : 1;
          const baseAmount = shouldStretch
            ? Math.floor(deadCapAmount / stretchYears)
            : deadCapAmount;
          const remainder = shouldStretch
            ? deadCapAmount - baseAmount * stretchYears
            : 0;

          const deadCapEntries =
            deadCapAmount > 0
              ? [
                  {
                    playerId: String(playerId),
                    playerName:
                      rosterPlayer?.displayName ||
                      rosterPlayer?.name ||
                      player.displayName ||
                      player.name ||
                      String(playerId),
                    originalSalary: remainingGuaranteed,
                    amountByYear: Array.from(
                      { length: stretchYears },
                      (_, index) => ({
                        season: toSeasonCode(currentYear + index),
                        amount:
                          shouldStretch && index < remainder
                            ? baseAmount + 1
                            : baseAmount,
                        isStretched: shouldStretch,
                      })
                    ),
                    waiveDate: new Date().toISOString(),
                    notes: buyout
                      ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
                      : shouldStretch
                        ? `Stretched over ${stretchYears} years`
                        : undefined,
                  },
                ]
              : [];

          const updatedPlayers = (beforeTeam.players || []).filter(
            (p) =>
              p.id !== playerId &&
              p.player_id !== playerId &&
              p.name !== playerId
          );

          const updatedRoster = (
            Array.isArray(beforeTeam.roster) ? beforeTeam.roster : []
          ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                stretch ? 'waiveStretch' : buyout ? 'buyout' : 'waive',
                overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: updatedPlayers,
            deadCap: [...(beforeTeam.deadCap || []), ...deadCapEntries],
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          stretch: !!stretch,
          stretchYears: stretch ? 3 : 0, // Default stretch years
          buyout: !!buyout,
          buyoutAmount: buyout ? normalizedBuyoutAmount : 0,
          isGracePeriod: false, // Default, UI doesn't currently expose this
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save waive/buyout action. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  // handleOptionDecision - directly updates teamCapSheet and manages cap holds
  const handleOptionDecision = useCallback(
    async (
      player: ArchitectPlayer,
      accepted: boolean,
      overrideMetadata?: OverrideMetadata | null,
      targetYearOverride?: number | null
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      const yearSeasonContext = buildYearSeasonContext(
        targetYearOverride,
        currentYear + 1
      );
      const targetYear = yearSeasonContext.actionYear;
      if (!playerId) {
        console.error('Option decision missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'optionDecision',
        playerIds: [String(playerId)],
        invalidMessage: 'Option decision blocked by post-state cap validation.',
        seasonIdOverride: yearSeasonContext.seasonId,
        yearOverride: yearSeasonContext.actionYear,
        computeNextTeam: (beforeTeam) => {
          let newCapHold: CapHold | null = null;

          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              const salaries: SalaryByYear[] = p.contract?.salariesByYear || [];

              // Find the option year entry
              const optionIndex = salaries.findIndex((y) => {
                const season = String(y.season);
                const yearEnd = /^\d{4}-\d{2}$/.test(season)
                  ? 2000 + parseInt(season.split('-')[1], 10)
                  : parseInt(season, 10);
                return yearEnd === targetYear && y.option;
              });

              if (optionIndex === -1) {
                console.warn(`No option found for year ${targetYear}`);
                return p;
              }

              // Mark option as used (canonical boolean format)
              const updatedSalaries: SalaryByYear[] = [...salaries];
              updatedSalaries[optionIndex] = {
                ...updatedSalaries[optionIndex],
                optionUsed: accepted, // CANONICAL: boolean, not string
              };

              if (!accepted) {
                const optionSeason = salaries[optionIndex]?.season || null;
                const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
                  optionSeason,
                  targetYear
                );
                const freeAgencyYear =
                  typeof faYearInfo.year === 'number'
                    ? faYearInfo.year
                    : targetYear - 1;

                // Declining: remove this year and all future years
                const filteredSalaries: SalaryByYear[] = salaries.filter(
                  (_, idx) => idx < optionIndex
                );

                // Calculate cap hold for declined option
                const priorRow = salaries[optionIndex - 1];
                const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
                const rightsType = getRightsTypeFromPlayer(p);
                const capHoldResult = computeExpectedCapHoldAmount({
                  player: p,
                  lastSalary,
                  rules: null,
                  rightsType,
                });
                if (lastSalary > 0 && capHoldResult.amount) {
                  newCapHold = {
                    playerId: p.id || p.player_id || p.name || '',
                    playerName: p.displayName || p.name || '',
                    amount: capHoldResult.amount,
                    type: 'FA Cap Hold',
                    season: toSeasonCode(targetYear),
                    isSigned: false,
                    reason: capHoldResult.usedFallback
                      ? 'Declined Option (fallback multiplier)'
                      : 'Declined Option',
                    notes: capHoldResult.usedFallback
                      ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
                      : undefined,
                    active: true,
                  };
                }

                return {
                  ...p,
                  contract: {
                    ...(p.contract || {}),
                    salariesByYear: filteredSalaries,
                    freeAgency: {
                      year: freeAgencyYear,
                      type: 'UFA' as const,
                    },
                  },
                  freeAgentYear: freeAgencyYear,
                };
              }

              // Accepted: just update the option status
              return {
                ...p,
                contract: {
                  ...(p.contract || {}),
                  salariesByYear: updatedSalaries,
                },
              };
            }
            return p;
          });

          // Update capHolds array
          let updatedCapHolds = beforeTeam.capHolds || [];
          const finalCapHold = newCapHold as CapHold | null;
          if (finalCapHold) {
            // Remove any existing hold for this player and add the new one
            const holdPlayerId = finalCapHold.playerId;
            updatedCapHolds = updatedCapHolds.filter(
              (h) => h.playerId !== holdPlayerId
            );
            updatedCapHolds = [...updatedCapHolds, finalCapHold];
          }

          const finalPlayers = accepted
            ? updatedPlayers
            : updatedPlayers.filter(
                (p) =>
                  p.id !== playerId &&
                  p.player_id !== playerId &&
                  p.name !== playerId
              );
          const updatedRoster = accepted
            ? beforeTeam.roster
            : (Array.isArray(beforeTeam.roster)
                ? beforeTeam.roster
                : []
              ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                accepted ? 'accept' : 'decline',
                overrideMetadata.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: finalPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          accepted,
          targetYear,
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save option decision. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  const handleRenounceRights = useCallback(
    async (
      player: ArchitectPlayer,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      return confirmAndRenounceRights(player, overrideMetadata);
    },
    [confirmAndRenounceRights]
  );

  const dualPathSigning = useMemo<FreeAgencyDualPathSigningOwner>(
    () => ({
      signFreeAgent: handleSign,
    }),
    [handleSign]
  );

  const freeAgencyWorldOnlyModalActionOwner =
    useMemo<FreeAgencyWorldOnlyModalActionOwner | null>(
      () =>
        worldId
          ? {
              signAndTrade: handleSignAndTrade,
              getSignAndTradePreflight,
              getOfferSheetPreflight,
              storeOfferSheet: handleStoreOfferSheet,
            }
          : null,
      [
        getOfferSheetPreflight,
        getSignAndTradePreflight,
        handleSignAndTrade,
        handleStoreOfferSheet,
        worldId,
      ]
    );

  const freeAgencyOfferSheetLifecycleActionOwner =
    useMemo<FreeAgencyOfferSheetLifecycleActionOwner | null>(
      () =>
        worldId
          ? {
              matchOfferSheet: handleMatchOfferSheet,
              declineOfferSheet: handleDeclineOfferSheet,
              finalizeOfferSheet: handleFinalizeOfferSheet,
            }
          : null,
      [
        handleDeclineOfferSheet,
        handleFinalizeOfferSheet,
        handleMatchOfferSheet,
        worldId,
      ]
    );

  const freeAgencyWorldOnlyActionOwner =
    useMemo<FreeAgencyWorldOnlyActionOwner | null>(
      () =>
        freeAgencyWorldOnlyModalActionOwner &&
        freeAgencyOfferSheetLifecycleActionOwner
          ? {
              ...freeAgencyWorldOnlyModalActionOwner,
              ...freeAgencyOfferSheetLifecycleActionOwner,
            }
          : null,
      [
        freeAgencyOfferSheetLifecycleActionOwner,
        freeAgencyWorldOnlyModalActionOwner,
      ]
    );

  const hasWorldOnlySignAndTradeAvailability = Boolean(
    freeAgencyWorldOnlyModalActionOwner?.signAndTrade &&
      freeAgencyWorldOnlyModalActionOwner.getSignAndTradePreflight
  );
  const hasWorldOnlyOfferSheetAvailability = Boolean(
    freeAgencyWorldOnlyModalActionOwner?.storeOfferSheet &&
      freeAgencyWorldOnlyModalActionOwner.getOfferSheetPreflight
  );
  const signAndTradeInitiation =
    useMemo<FreeAgentSignAndTradeInitiation | null>(
      () =>
        hasWorldOnlySignAndTradeAvailability &&
        freeAgencyWorldOnlyModalActionOwner
          ? {
              onSignAndTrade: freeAgencyWorldOnlyModalActionOwner.signAndTrade,
              getSignAndTradePreflight:
                freeAgencyWorldOnlyModalActionOwner.getSignAndTradePreflight,
            }
          : null,
      [
        freeAgencyWorldOnlyModalActionOwner,
        hasWorldOnlySignAndTradeAvailability,
      ]
    );
  const offerSheetInitiation = useMemo<FreeAgentOfferSheetInitiation | null>(
    () =>
      hasWorldOnlyOfferSheetAvailability && freeAgencyWorldOnlyModalActionOwner
        ? {
            getOfferSheetPreflight:
              freeAgencyWorldOnlyModalActionOwner.getOfferSheetPreflight,
            storeOfferSheet:
              freeAgencyWorldOnlyModalActionOwner.storeOfferSheet,
          }
        : null,
    [freeAgencyWorldOnlyModalActionOwner, hasWorldOnlyOfferSheetAvailability]
  );

  // VISUAL/MODAL CONTRACT: FreeAgentPool reads this as upstream truth for what
  // the contract modal is allowed to show. World-only initiators appear here
  // only when the world-only action lane exists.
  const freeAgentModalAvailability = useMemo<FreeAgentModalAvailability>(
    () => ({
      visibleActions: signAndTradeInitiation
        ? ['signNew', 'signAndTrade']
        : ['signNew'],
      actionLabelsOverride: {
        signNew: 'Sign Free Agent',
      },
      showOfferSheetToggle: Boolean(offerSheetInitiation),
      signAndTradeInitiation,
      offerSheetInitiation,
    }),
    [offerSheetInitiation, signAndTradeInitiation]
  );

  // SECTION/LIFECYCLE CONTRACT: FreeAgencySection renders disabled messaging
  // from this published availability surface instead of rebuilding world-mode
  // lifecycle rules locally.
  const offerSheetSectionAvailability =
    useMemo<FreeAgencyOfferSheetSectionAvailability>(
      () => ({
        lifecycleActionOwner: freeAgencyOfferSheetLifecycleActionOwner,
        actionsDisabled: !freeAgencyOfferSheetLifecycleActionOwner,
        actionsDisabledReason: freeAgencyOfferSheetLifecycleActionOwner
          ? null
          : getFreeAgencyWorldOnlyMessage('offerSheetLifecycle', 'commit'),
      }),
      [freeAgencyOfferSheetLifecycleActionOwner, getFreeAgencyWorldOnlyMessage]
    );

  // PUBLISHED FREE-AGENCY CONTRACT: downstream surfaces should consume the
  // slice they need rather than infer base-vs-world behavior from raw handlers.
  const freeAgencyActionOwner = useMemo<FreeAgencyActionOwner>(
    () => ({
      dualPathSigning,
      worldOnly: freeAgencyWorldOnlyActionOwner,
      freeAgentModalAvailability,
      offerSheetSectionAvailability,
    }),
    [
      dualPathSigning,
      freeAgentModalAvailability,
      freeAgencyWorldOnlyActionOwner,
      offerSheetSectionAvailability,
    ]
  );

  return {
    freeAgencyActionOwner,

    // Contract/Player actions
    handleSign,
    handleSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
    handleEditContract,
    handleCapTableModalAction,
    handleCapHoldRenounce,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,

    // Phase 16: Offer Sheet Actions
    handleStoreOfferSheet,
    handleMatchOfferSheet,
    handleDeclineOfferSheet,
    handleFinalizeOfferSheet,

    // Trade actions
    applyTradeToCapSheet,

    // Phase 24: Dead Money
    handleSetDeadCap,

    // Phase 27: Exception Management
    handleSetExceptions,

    // DEV-only tool surfaces
    capSheetDevTools,
    teamHistoryDevTools,
  };
}
