/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
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
  computeWorldMutation,
  preflightSignAndTradeMutation,
  preflightOfferSheetMutation,
  type ArchitectMutationContract,
  type ArchitectMutationDeadCapEntry,
  type ArchitectMutationExceptionEntry,
  type ArchitectMutationExceptions,
  type ArchitectMutationPayload,
  type ArchitectMutationResult,
  type ArchitectMutationTeamUpdate,
  type SignAndTradePreflightResult,
  type OfferSheetPreflightResult,
  type NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';
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
  BASE_CAP_AUDIT_STORAGE_KEY,
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
  appendLocalCapAuditEvent,
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
  validateSignAndTradeContractPayload,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  BasePlayerContract,
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
  UseArchitectStateReturn,
} from './useArchitectState';

// ==== Type Definitions ====

type StatePlayersMap = UseArchitectStateReturn['playersMap'];
type ComputeWorldMutationArgs = Parameters<typeof computeWorldMutation>[0];
type ComputeWorldMutationCurrentState = NonNullable<
  ComputeWorldMutationArgs['currentState']
>;
type FreeAgentComputeState = Pick<
  ComputeWorldMutationCurrentState,
  'team' | 'player' | 'teamCode'
>;
type TradeComputeState = Pick<ComputeWorldMutationCurrentState, 'teams'>;
type TradeComputeTeamEntry = NonNullable<TradeComputeState['teams']>[number];
type TradeMutationPayloadTeam = NonNullable<
  ArchitectMutationPayload['teams']
>[number];
type TradeMutationPayloadEntitlement = NonNullable<
  TradeMutationPayloadTeam['outgoingEntitlements']
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
    'birdRights' | 'freeAgency' | 'salariesByYear'
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
  playerId?: string;
  displayName?: string;
  position?: string;
  age?: number;
  height?: number | string | null;
  weight?: number | string | null;
  draftRound?: number | null;
  draftPick?: number | string | null;
  yearsExperience?: number | null;
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
  representation?: unknown;
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
  contractType?: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
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

/** Trade data item for a single team */
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

type CapHoldActionItem = Partial<Omit<CapHold, 'amount' | 'playerId' | 'playerName'>> & {
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

type ArchitectExceptionsLike = Exceptions &
  ArchitectMutationExceptions & {
    roomMLE?: ArchitectMutationExceptionEntry | null;
  };
type ManualCapSheetLedgerMutationParams =
  | {
      type: 'deadCap';
      deadCap: DeadCapEntry[];
    }
  | {
      type: 'exceptions';
      exceptions: NonNullable<CapSheet['exceptions']>;
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

interface CapSheetDevTools {
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
  changedTeams?: ArchitectMutationTeamUpdate[];
  event?: CapAuditEventV1Like | { operationId?: string; type?: string; timestamp?: string };
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
type OfferSheetResolutionMutationType =
  | 'matchOfferSheet'
  | 'declineOfferSheet';
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
  committedTeam: CapSheet;
  committedTeamSource: 'changedTeams' | 'reload';
  committedOfferSheet: OfferSheet;
  committedOfferSheetIdentity: OfferSheetCommittedIdentity;
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

const OFFER_SHEET_WORLD_REQUIRED_MESSAGE =
  'Offer sheet actions require an active world to commit.';

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

export interface FreeAgencyDualPathSigningOwner {
  signFreeAgent: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => Promise<MutationActionResult>;
}

export type FreeAgentModalVisibleAction = 'signNew' | 'signAndTrade';

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

export interface FreeAgentModalAvailability {
  visibleActions: FreeAgentModalVisibleAction[];
  actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
  showOfferSheetToggle: boolean;
  signAndTradeInitiation: FreeAgentSignAndTradeInitiation | null;
  offerSheetInitiation: FreeAgentOfferSheetInitiation | null;
}

export interface FreeAgencyWorldOnlyActionOwner {
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
  matchOfferSheet: (offeringTeamCode: string, offerSheetId: string) => void;
  declineOfferSheet: (offeringTeamCode: string, offerSheetId: string) => void;
  finalizeOfferSheet: (offerSheet: OfferSheet | null | undefined) => void;
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

export interface FreeAgencyActionOwner {
  dualPathSigning: FreeAgencyDualPathSigningOwner;
  worldOnly: FreeAgencyWorldOnlyActionOwner | null;
  freeAgentModalAvailability: FreeAgentModalAvailability;
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
  handleEditContract: (player: ArchitectPlayer) => void;
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
    exceptions: NonNullable<CapSheet['exceptions']>
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
    mutableOverrides.startYear ??
      contract.startYear ??
      contract.year
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

type WorldCommittedTeamSource = 'changedTeams' | 'reload';

type StandardSigningCommittedStateSource = 'compute' | WorldCommittedTeamSource;

type StandardSigningExecutionResult =
  | {
      success: true;
      committedTeam: CapSheet;
      committedTeamSource: StandardSigningCommittedStateSource;
    }
  | {
      success: false;
      message: string;
    };

type SignAndTradeExecutionResult =
  | {
      success: true;
      committedTeam: CapSheet;
      committedTeamSource: WorldCommittedTeamSource;
    }
  | {
      success: false;
      message: string;
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
  const firstSeasonValue = salaryRows.find((row) => row?.season != null)?.season;
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
    const canonicalTeam = synchronizeTeamTotalsSnapshot(team as any, year);
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
    beforeTeamsByCode: beforeTeamsByCode as Record<string, Record<string, unknown>>,
    afterTeamsByCode: afterTeamsByCode as Record<string, Record<string, unknown>>,
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

function findUpdatedTeamSnapshot(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  targetTeamCode: string
): CapSheet | null {
  const matchingUpdate = (teamUpdates || []).find(
    (update) => update?.teamCode === targetTeamCode && update?.team
  );
  return (matchingUpdate?.team as CapSheet | null | undefined) || null;
}

function toTrimmedStringOrNull(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function buildCommittedOfferSheetIdentity(params: {
  result: PersistMutationResult;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
}): OfferSheetCommittedIdentity {
  const metadata = (params.result.metadata || null) as OfferSheetMutationMetadata | null;

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

function filterSignedPlayerFromFreeAgents<
  T extends {
    name?: unknown;
    id?: unknown;
    player_id?: unknown;
  },
>(
  freeAgents: T[],
  playerObj: ArchitectPlayer
): T[] {
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
  } = state;

  // Destructure modals for easier access
  const { openContractModal } = modals;

  const setTeamCapSheetSafe = useCallback(
    (nextTeam: CapSheet | null): void => {
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

  type PreparedCapAuditedMutationLifecycle = {
    operationId: string;
    storageKey: string;
    beforeTeamSnapshot: CapSheet;
    afterTeamSnapshot: CapSheet;
    beforeTeamsByCode: TeamsByCode;
    afterTeamsByCode: TeamsByCode;
    previewAuditEvaluation: ReturnType<typeof buildCapAuditEvaluation>;
    applyLocalPreview: () => void;
    linkPersistSuccess: (result: PersistMutationResult) => void;
    rollbackPersistFailure: () => void;
  };

  const prepareCapAuditedTeamMutationLifecycle = useCallback(
    (params: {
      mutationType: string;
      playerIds?: string[];
      computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
      yearOverride?: number;
    }): PreparedCapAuditedMutationLifecycle => {
      const {
        mutationType,
        playerIds = [],
        computeNextTeam,
        yearOverride = currentYear,
      } = params;
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
      const previewAuditEvaluation = buildCapAuditEvaluation({
        operationId,
        occurredAt,
        mutationType,
        worldId,
        year: yearOverride,
        teamCodes: [teamCode],
        playerIds: playerIds.filter(Boolean).map(String),
        beforeTeamsByCode,
        afterTeamsByCode,
        preview: !!worldId,
        authoritativeEventLinked: worldId ? false : undefined,
      });
      const storageKey = worldId
        ? WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY
        : BASE_CAP_AUDIT_STORAGE_KEY;

      return {
        operationId,
        storageKey,
        beforeTeamSnapshot,
        afterTeamSnapshot,
        beforeTeamsByCode,
        afterTeamsByCode,
        previewAuditEvaluation,
        applyLocalPreview: () => {
          setTeamCapSheetSafe(afterTeamSnapshot);
        },
        linkPersistSuccess: (result) => {
          const authoritativeOperationId = String(
            result?.event?.operationId || operationId
          );
          updateLocalCapAuditEvent(
            operationId,
            {
              authoritativeEventLinked: true,
              authoritativeOperationId,
              persistFailed: false,
            },
            {
              storageKey,
            }
          );
        },
        rollbackPersistFailure: () => {
          setTeamCapSheetSafe(beforeTeamSnapshot);
          const didUpdatePreview = updateLocalCapAuditEvent(
            operationId,
            {
              persistFailed: true,
              authoritativeEventLinked: false,
            },
            {
              storageKey,
            }
          );

          if (!didUpdatePreview) {
            appendLocalCapAuditEvent(
              {
                ...previewAuditEvaluation.event,
                persistFailed: true,
                authoritativeEventLinked: false,
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

  const syncTeamFromMutationResult = useCallback(
    async (
      mutationType: string,
      result: PersistMutationResult
    ): Promise<void> => {
      const currentTeam = findUpdatedTeamSnapshot(result?.changedTeams, teamCode);

      if (currentTeam) {
        setTeamCapSheetSafe(currentTeam);
      } else if (worldId) {
        const refreshedTeam = await loadWorldTeamData(worldId, teamCode);
        if (refreshedTeam) {
          setTeamCapSheetSafe(refreshedTeam as CapSheet);
        }
      }

      try {
        await refreshWorldRosterIndex();
      } catch (error) {
        console.warn(
          `[Architect][FreeAgency] Failed to refresh roster index after ${mutationType}:`,
          error
        );
      }
    },
    [refreshWorldRosterIndex, setTeamCapSheet, teamCode, worldId]
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
      const changedTeam = findUpdatedTeamSnapshot(result.changedTeams, teamCode);
      const committedTeamSource: OfferSheetCommittedState['committedTeamSource'] =
        changedTeam ? 'changedTeams' : 'reload';
      const reloadedTeam = changedTeam
        ? null
        : ((await loadWorldTeamData(worldId, teamCode)) as CapSheet | null);
      const committedTeam = changedTeam || reloadedTeam;

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
    [loadWorldTeamData, teamCode, worldId]
  );

  const applyCommittedOfferSheetState = useCallback(
    (committedTeam: CapSheet): void => {
      setTeamCapSheetSafe(committedTeam);
    },
    [setTeamCapSheetSafe]
  );

  const executeWorldModeOfferSheetStore = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: OfferSheetMutationPayload
    ): Promise<OfferSheetStoreExecutionResult> => {
      if (!worldId) {
        const message = 'Offer sheet actions require an active world to commit.';
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
          const message = String(result.error || 'Failed to store offer sheet.');
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
      reportMutationError,
      resolveCommittedOfferSheetState,
      startSave,
      userId,
      worldId,
    ]
  );

  const applyCommittedStandardSigningState = useCallback(
    (
      playerObj: ArchitectPlayer,
      committedTeam: CapSheet
    ): void => {
      setTeamCapSheetSafe(committedTeam);
      setFreeAgents((prev) =>
        filterSignedPlayerFromFreeAgents(prev, playerObj)
      );
    },
    [setFreeAgents, setTeamCapSheetSafe]
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

        const changedTeam = findUpdatedTeamSnapshot(result.changedTeams, teamCode);
        const reloadedTeam = changedTeam
          ? null
          : ((await loadWorldTeamData(worldId, teamCode)) as CapSheet | null);
        const committedTeam = changedTeam || reloadedTeam;

        if (!committedTeam) {
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

        try {
          await refreshWorldRosterIndex();
        } catch (error) {
          console.warn(
            '[Architect][FreeAgency] Failed to refresh roster index after signFreeAgent:',
            error
          );
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          committedTeam,
          committedTeamSource: changedTeam ? 'changedTeams' : 'reload',
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
      loadWorldTeamData,
      refreshWorldRosterIndex,
      reportMutationError,
      startSave,
      teamCode,
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

      const validation = validateSigning({
        team: teamCapSheet,
        player: canonicalPlayer,
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

      const computeResult = computeWorldMutation({
        mutationType: 'signFreeAgent',
        payload: standardSigningPayload,
        currentState: {
          team: teamCapSheet as FreeAgentComputeState['team'],
          player: canonicalPlayer as FreeAgentComputeState['player'],
          teamCode,
        } satisfies FreeAgentComputeState,
        seasonId: actionSeasonContext.seasonId,
        timestamp: Date.now(),
        worldId: null,
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
      const baseAudit = buildCapAuditEvaluation({
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
      appendLocalCapAuditEvent(baseAudit.event, {
        storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
      });

      if (!baseAudit.validation.valid) {
        const message = getFirstViolationMessage(
          baseAudit.validation,
          'Signing blocked by post-state cap validation in vacuum mode.'
        );
        reportMutationError(message, {
          playerId: idToSign,
          operationId,
          violations: baseAudit.validation.violations,
        });
        return { success: false, message };
      }

      return {
        success: true,
        committedTeam: updatedTeam as CapSheet,
        committedTeamSource: 'compute',
      };
    },
    [playersMap, reportMutationError, teamCapSheet, teamCode]
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

        const lifecycle = prepareCapAuditedTeamMutationLifecycle({
          mutationType,
          playerIds,
          computeNextTeam,
          yearOverride,
        });

        appendLocalCapAuditEvent(lifecycle.previewAuditEvaluation.event, {
          storageKey: lifecycle.storageKey,
        });

        if (!lifecycle.previewAuditEvaluation.validation.valid) {
          reportMutationError(
            getFirstViolationMessage(
              lifecycle.previewAuditEvaluation.validation,
              invalidMessage
            ),
            {
              mutationType,
              operationId: lifecycle.operationId,
              violations: lifecycle.previewAuditEvaluation.validation.violations,
            }
          );
          return {
            applied: false,
            operationId: lifecycle.operationId,
            persistPromise: null,
          };
        }

        lifecycle.applyLocalPreview();

        if (!worldId) {
          return {
            applied: true,
            operationId: lifecycle.operationId,
            persistPromise: Promise.resolve(true),
          };
        }

        const persistPromise = persistMutation(mutationType, persistPayload, {
          operationId: lifecycle.operationId,
          seasonIdOverride,
          onSuccess: lifecycle.linkPersistSuccess,
          onFailure: (message) => {
            lifecycle.rollbackPersistFailure();
            reportMutationError(
              message || `Failed to persist ${mutationType} mutation.`,
              {
                mutationType,
                operationId: lifecycle.operationId,
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
          operationId: lifecycle.operationId,
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
      prepareCapAuditedTeamMutationLifecycle,
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
        stripPrebuiltSigningRowsForAuthority(contract) || (contract as LocalContract);
      const actionSeasonContext = buildActionSeasonContext(
        contractForAuthority,
        currentYear
      );
      const signedUsing = deriveSigningMechanism(contract);
      const normalizedExceptionType =
        typeof contract.exceptionType === 'string'
          ? contract.exceptionType.trim()
          : '';
      const preparedContract = ensureContractStructure(contractForAuthority, {
        ...overrides,
        contractType: overrides.contractType,
        signingTeam: teamCode,
        startYear: actionSeasonContext.actionYear,
        signedUsing,
        exceptionType: normalizedExceptionType || signedUsing || undefined,
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
          signedUsing,
          exceptionType: normalizedExceptionType || signedUsing || undefined,
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
      if (!worldId) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Sign-and-trade requires an active world to commit.',
          {
            playerObj,
            destinationTeamCode,
          }
        );
      }

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
    [prepareAuthoritativeSigningDetails, teamCode, worldId]
  );

  const applyTradeToCapSheet = useCallback(
    async (tradeData: TradeDataItem[]): Promise<void> => {
      if (!tradeData || !Array.isArray(tradeData)) return;

      // Persist to world if in world mode
      // Transform tradeData to mutation pipeline format
      // Note: Each team's teamId needs to be resolved to canonical teamCode
      const resolvedTeamCodes = tradeData.map(
        (t) => resolveTeamCode(t.teamId) || t.teamId
      );
      const teamIndexByCode = new Map<string, number>();
      resolvedTeamCodes.forEach((code, index) => {
        teamIndexByCode.set(code, index);
      });

      const teams: NonNullable<ArchitectMutationPayload['teams']> = tradeData.map(
        (t, teamIndex): TradeMutationPayloadTeam => ({
          teamCode: resolvedTeamCodes[teamIndex],
          sends: ((t.outgoing || t.outgoingPlayers || []) as ArchitectPlayer[]).map(
            (p) => {
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
                p.signAndTradeContract ||
                (p.contract
                  ? {
                      ...p.contract,
                      years:
                        typeof p.contract.years === 'string'
                          ? Number(p.contract.years) || null
                          : typeof p.contract.years === 'number'
                            ? p.contract.years
                            : null,
                      contractYears:
                        typeof p.contract.contractYears === 'string'
                          ? Number(p.contract.contractYears) || null
                          : typeof p.contract.contractYears === 'number'
                            ? p.contract.contractYears
                            : null,
                      firstYearGuaranteed:
                        typeof p.contract.firstYearGuaranteed === 'boolean'
                          ? p.contract.firstYearGuaranteed
                          : null,
                    }
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
                  destinationTeamCode === (resolveTeamCode(t.teamId) || t.teamId))
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
                  (signAndTradeValidation?.contract || p.contract || undefined) as
                    ArchitectMutationContract | undefined,
                contractYears:
                  signAndTradeValidation?.contract?.contractYears ||
                  p.contractYears ||
                  undefined,
                firstYearGuaranteed:
                  signAndTradeValidation?.contract?.firstYearGuaranteed ??
                  p.firstYearGuaranteed ??
                  undefined,
              };
            }
          ),
          picksOut: [],
          // TM-PICKS-E1: Include outgoing entitlements in persistence payload
          outgoingEntitlements: t.outgoingEntitlements || [],
          entitlementsOut: t.outgoingEntitlements || [],
        })
      );

      // Validation guard
      for (const team of teams) {
        for (const player of team.sends) {
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
        source: 'tradeMachine',
        worldId,
        yearKey: currentYear,
        ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
      };

      if (worldId) {
        await runAuthoritativeFAMutation('executeTrade', {
          teams,
          ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
          tradeCtx: authoritativeTradeCtx,
        });
        return;
      }

      try {
        const loadedTeams: NonNullable<TradeComputeState['teams']> =
          await Promise.all(
            resolvedTeamCodes.map(
              async (
                resolvedTeamCode,
                index
              ): Promise<TradeComputeTeamEntry> => {
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
                  team: baseTeamSnapshot as TradeComputeTeamEntry['team'],
                };
              }
            )
          );

        const tradePayload = {
          teams,
          ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
          tradeCtx: {
            ...authoritativeTradeCtx,
            worldId: null,
          },
        };

        const computeResult = computeWorldMutation({
          mutationType: 'executeTrade',
          payload: tradePayload,
          currentState: {
            teams: loadedTeams,
          } satisfies TradeComputeState,
          seasonId,
          timestamp: Date.now(),
          asOfDate: worldAsOfDate || undefined,
          worldId: null,
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
        const baseAudit = buildCapAuditEvaluation({
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
        appendLocalCapAuditEvent(baseAudit.event, {
          storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
        });

        if (!baseAudit.validation.valid) {
          throw new Error(
            getFirstViolationMessage(
              baseAudit.validation,
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
    [
      teamCode,
      currentYear,
      runAuthoritativeFAMutation,
      seasonId,
      setTeamCapSheet,
      worldAsOfDate,
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

      const executionResult = worldId
        ? await executeWorldModeStandardSigning(
            playerObj,
            actionSeasonContext,
            standardSigningPayload
          )
        : await executeVacuumModeStandardSigning(
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

      applyCommittedStandardSigningState(
        playerObj,
        executionResult.committedTeam
      );
      return { success: true };
    },
    [
      applyCommittedStandardSigningState,
      executeVacuumModeStandardSigning,
      executeWorldModeStandardSigning,
      reportMutationError,
      worldId,
    ]
  );

  const applyCommittedSignAndTradeState = useCallback(
    (committedTeam: CapSheet): void => {
      setTeamCapSheetSafe(committedTeam);
    },
    [setTeamCapSheetSafe]
  );

  const executeWorldModeSignAndTrade = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: SignAndTradeMutationPayload
    ): Promise<SignAndTradeExecutionResult> => {
      if (!worldId) {
        const message = 'Sign-and-trade requires an active world to commit.';
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

        const changedTeam = findUpdatedTeamSnapshot(result.changedTeams, teamCode);
        const reloadedTeam = changedTeam
          ? null
          : ((await loadWorldTeamData(worldId, teamCode)) as CapSheet | null);
        const committedTeam = changedTeam || reloadedTeam;

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

        try {
          await refreshWorldRosterIndex();
        } catch (error) {
          console.warn(
            '[Architect][FreeAgency] Failed to refresh roster index after signAndTrade:',
            error
          );
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          committedTeam,
          committedTeamSource: changedTeam ? 'changedTeams' : 'reload',
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
      refreshWorldRosterIndex,
      reportMutationError,
      startSave,
      teamCode,
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
        transactionDefinition.mutationPayload,
      );

      if (result.success !== true) {
        return {
          success: false,
          message: result.message,
        };
      }

      applyCommittedSignAndTradeState(result.committedTeam);
      return { success: true };
    },
    [
      applyCommittedSignAndTradeState,
      executeWorldModeSignAndTrade,
      prepareSignAndTradeTransactionDefinition,
      reportMutationError,
    ]
  );

  const getSignAndTradePreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): Promise<SignAndTradePreflightResult> => {
      const transactionDefinition = prepareSignAndTradeTransactionDefinition(
        playerObj,
        contract,
        destinationTeamCode
      );

      if (isSignAndTradeTransactionPreparationFailure(transactionDefinition)) {
        return transactionDefinition.preflightResult;
      }

      try {
        const activeWorldId = worldId;
        if (!activeWorldId) {
          return buildBlockedSignAndTradePreflightResult(
            'Sign-and-trade requires an active world to preview.'
          );
        }

        return await preflightSignAndTradeMutation({
          worldId: activeWorldId,
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
    [prepareSignAndTradeTransactionDefinition, worldId]
  );

  const getOfferSheetPreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<OfferSheetPreflightResult> => {
      if (!worldId) {
        return buildOfferSheetPreflightResult(
          'blocked',
          'Offer sheet requires an active world to commit.'
        );
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
    [prepareOfferSheetCreationDefinition, worldId]
  );

  // === RFA Offer Sheet Actions ===

  const handleStoreOfferSheet = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<MutationActionResult> => {
      if (!worldId) {
        reportMutationError(
          'Offer sheet actions require an active world to commit.',
          {
            playerObj,
          }
        );
        return {
          success: false,
          message: 'Offer sheet actions require an active world to commit.',
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

      applyCommittedOfferSheetState(result.committedTeam);
      return { success: true };
    },
    [
      applyCommittedOfferSheetState,
      executeWorldModeOfferSheetStore,
      prepareOfferSheetCreationDefinition,
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
        if (!worldId) {
          reportMutationError(OFFER_SHEET_WORLD_REQUIRED_MESSAGE, {
            offeringTeamCode,
            offerSheetId,
            action,
          });
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

        await runAuthoritativeFAMutation(
          mutationType,
          {
            teamCode,
            offeringTeamCode,
            offerSheetId,
          },
          {
            worldRequiredMessage: OFFER_SHEET_WORLD_REQUIRED_MESSAGE,
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
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
      runOfferSheetResolutionAction(
        'decline',
        offeringTeamCode,
        offerSheetId
      );
    },
    [runOfferSheetResolutionAction]
  );

  const handleFinalizeOfferSheet = useCallback(
    (offerSheet: OfferSheet | null | undefined): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(OFFER_SHEET_WORLD_REQUIRED_MESSAGE, {
            offerSheet,
          });
          return;
        }

        const finalizeRoute = resolveOfferSheetFinalizeMutationRoute(offerSheet);
        if ('message' in finalizeRoute) {
          reportMutationError(
            finalizeRoute.message,
            finalizeRoute.logContext
          );
          return;
        }

        await runAuthoritativeFAMutation(
          finalizeRoute.mutationType,
          finalizeRoute.payload,
          {
            worldRequiredMessage: OFFER_SHEET_WORLD_REQUIRED_MESSAGE,
          }
        );
      })();
    },
    [
      reportMutationError,
      resolveOfferSheetFinalizeMutationRoute,
      runAuthoritativeFAMutation,
      worldId,
    ]
  );

  const runManualCapSheetLedgerMutation = useCallback(
    (params: ManualCapSheetLedgerMutationParams): Promise<boolean> => {
      const mutationConfig =
        params.type === 'deadCap'
          ? {
              mutationType: 'setDeadCap',
              playerIds: [],
              invalidMessage:
                'Dead cap update blocked by post-state cap validation.',
              computeNextTeam: (beforeTeam: CapSheet) =>
                (synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    deadCap: params.deadCap,
                  },
                  currentYear
                ) as CapSheet),
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
                (synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    exceptions: mergeManualExceptionSnapshot(
                      beforeTeam.exceptions as Record<string, unknown> | null,
                      params.exceptions as Record<string, unknown> | null
                    ) as NonNullable<CapSheet['exceptions']>,
                  },
                  currentYear
                ) as CapSheet),
              persistPayload: {
                teamCode,
                exceptions: params.exceptions,
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
    (exceptions: NonNullable<CapSheet['exceptions']>): Promise<boolean> =>
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

  const injectCapSheetDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message: 'Cannot inject fixtures: team state is not loaded.',
      };
    }

    const nextTeam = injectCapSheetFixtures(teamCapSheet, currentYear);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [currentYear, setTeamCapSheet, teamCapSheet]);

  const clearCapSheetDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message: 'Cannot clear fixtures: team state is not loaded.',
      };
    }

    const nextTeam = clearCapSheetFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheet, teamCapSheet]);

  const capSheetDevTools = useMemo<CapSheetDevTools>(
    () => ({
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

  const injectTeamHistoryDevFixtures =
    useCallback((): MutationActionResult => {
      if (!teamCapSheet) {
        return {
          success: false,
          message:
            'Cannot inject Team History fixtures: team state is not loaded.',
        };
      }

      const nextTeam = injectTeamHistoryFixtures(
        teamCapSheet
      );
      setTeamCapSheetSafe(nextTeam as CapSheet);
      return { success: true };
    }, [setTeamCapSheet, teamCapSheet]);

  const clearTeamHistoryDevFixtures =
    useCallback((): MutationActionResult => {
      if (!teamCapSheet) {
        return {
          success: false,
          message:
            'Cannot clear Team History fixtures: team state is not loaded.',
        };
      }

      const nextTeam = clearTeamHistoryFixtures(
        teamCapSheet
      );
      setTeamCapSheetSafe(nextTeam as CapSheet);
      return { success: true };
    }, [setTeamCapSheet, teamCapSheet]);

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
    (player: ArchitectPlayer): void => {
      openPlayerContractModalRoute({
        player,
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
                player.name || player.displayName
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
                player.name || player.displayName
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
                player.name || player.displayName
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

  const freeAgencyWorldOnlyActionOwner =
    useMemo<FreeAgencyWorldOnlyActionOwner | null>(
      () =>
        worldId
          ? {
              signAndTrade: handleSignAndTrade,
              getSignAndTradePreflight,
              getOfferSheetPreflight,
              storeOfferSheet: handleStoreOfferSheet,
              matchOfferSheet: handleMatchOfferSheet,
              declineOfferSheet: handleDeclineOfferSheet,
              finalizeOfferSheet: handleFinalizeOfferSheet,
            }
          : null,
      [
        getOfferSheetPreflight,
        getSignAndTradePreflight,
        handleDeclineOfferSheet,
        handleFinalizeOfferSheet,
        handleMatchOfferSheet,
        handleSignAndTrade,
        handleStoreOfferSheet,
        worldId,
      ]
    );

  const hasWorldOnlySignAndTradeAvailability = Boolean(
    freeAgencyWorldOnlyActionOwner?.signAndTrade &&
      freeAgencyWorldOnlyActionOwner.getSignAndTradePreflight
  );
  const hasWorldOnlyOfferSheetAvailability = Boolean(
      freeAgencyWorldOnlyActionOwner?.storeOfferSheet &&
      freeAgencyWorldOnlyActionOwner.getOfferSheetPreflight
  );
  const signAndTradeInitiation = useMemo<FreeAgentSignAndTradeInitiation | null>(
    () =>
      hasWorldOnlySignAndTradeAvailability && freeAgencyWorldOnlyActionOwner
        ? {
            onSignAndTrade: freeAgencyWorldOnlyActionOwner.signAndTrade,
            getSignAndTradePreflight:
              freeAgencyWorldOnlyActionOwner.getSignAndTradePreflight,
          }
        : null,
    [freeAgencyWorldOnlyActionOwner, hasWorldOnlySignAndTradeAvailability]
  );
  const offerSheetInitiation = useMemo<FreeAgentOfferSheetInitiation | null>(
    () =>
      hasWorldOnlyOfferSheetAvailability && freeAgencyWorldOnlyActionOwner
        ? {
            getOfferSheetPreflight:
              freeAgencyWorldOnlyActionOwner.getOfferSheetPreflight,
            storeOfferSheet: freeAgencyWorldOnlyActionOwner.storeOfferSheet,
          }
        : null,
    [freeAgencyWorldOnlyActionOwner, hasWorldOnlyOfferSheetAvailability]
  );

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
    [
      offerSheetInitiation,
      signAndTradeInitiation,
    ]
  );

  const freeAgencyActionOwner = useMemo<FreeAgencyActionOwner>(
    () => ({
      dualPathSigning: {
        signFreeAgent: handleSign,
      },
      worldOnly: freeAgencyWorldOnlyActionOwner,
      freeAgentModalAvailability,
    }),
    [freeAgentModalAvailability, freeAgencyWorldOnlyActionOwner, handleSign]
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
