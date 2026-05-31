/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.types.ts
 * PURPOSE: Type definitions for useArchitectActions hook.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 1: Extracted from useArchitectActions.ts (L116-1325).
 */

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import {
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
} from '@/features/architect/capSheet/devCapSheetFixtures';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

import type {
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectMutationContract,
  ArchitectMutationDeadCapEntry,
  ArchitectMutationExceptionEntry,
  ArchitectMutationExceptions,
  ArchitectMutationPayload,
  ArchitectMutationResult,
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
  NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';
import type { ManualExceptionsSavePayload } from '@/features/architect/capSheet/CapSheet/CapSheet';
import type {
  LocalCapAuditLifecycleState,
  CapAuditEventV1Like,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import type {
  SignAndTradeContractLike,
  SignAndTradeSalaryRow,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  BasePlayerContract,
  BasePlayerDoc,
  DeadCapItem,
  Exceptions,
  PlayerRulesProfileInput,
} from '@/features/architect/types';
import type { CapHold as SharedCapHold } from '@/features/architect/utils/capHolds';
import type { CapSheetModalActionType } from '@/features/architect/capSheet/CapSheetFull/CapSheetFull';
import type {
  ArchitectDashboardCapSheet,
  ArchitectDashboardPlayer,
  ReloadActiveWorldMetadataPatch,
  UseArchitectStateReturn,
} from './useArchitectState';

// ==== Type Definitions ====

export type StatePlayersMap = UseArchitectStateReturn['playersMap'];
export type ArchitectActionTeamCapSheet = NonNullable<
  UseArchitectStateReturn['teamCapSheet']
>;
export type DashboardCommittedTeamSnapshot = NonNullable<
  UseArchitectStateReturn['teamCapSheet']
>;
export type ComputeWorldMutationArgs = Parameters<typeof computeWorldMutation>[0];
export type SignFreeAgentComputeArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'signFreeAgent' }
>;
export type ExecuteTradeComputeArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'executeTrade' }
>;
export type FreeAgentComputeState = SignFreeAgentComputeArgs['currentState'];
export type ExecuteTradeCurrentState = ExecuteTradeComputeArgs['currentState'];
export type TradeMutationPayloadTeam = NonNullable<
  ArchitectMutationPayload['teams']
>[number];
export type TradeMutationPayloadEntitlement = NonNullable<
  TradeMutationPayloadTeam['outgoingEntitlements']
>[number];
export type SigningValidationTeam = Parameters<typeof validateSigning>[0]['team'];
export type SigningValidationPlayer = Parameters<typeof validateSigning>[0]['player'];
export type SigningValidationCapHold = NonNullable<
  SigningValidationTeam['capHolds']
>[number];

/** Salary entry by year in a contract — canonical (normalized) form. */
export type SalaryByYear = NormalizedMutationSalaryRow;

export type LocalContractLegacySalaryInput =
  | number
  | string
  | {
      salary?: number | string | null;
      season?: string | null;
    };

export interface LocalBirdRights {
  status?: string | null;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
}

/** Local contract structure for architect actions (avoids schema naming pattern) */
export type LocalContract = ArchitectMutationContract &
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
export interface LocalBio {
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
export type ArchitectPlayer = Omit<
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
export interface TradeDataItem {
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

export type TradeExecutionPayload = {
  teams: NonNullable<ArchitectMutationPayload['teams']>;
  asOfDate?: string;
  tradeCtx: {
    source: 'tradeMachine';
    worldId: string | null;
    yearKey: number;
    asOfDate?: string;
  };
};

export type TradeExecutionHandoff = {
  resolvedTeamCodes: string[];
  payload: TradeExecutionPayload;
};

/** Contract details for signing/saving (avoids schema naming pattern) */
export type SigningDetails = Omit<Partial<LocalContract>, 'birdRights'> & {
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
export interface WaiveOptions {
  stretch?: boolean;
  buyout?: boolean;
  buyoutAmount?: number;
  // Override metadata when action bypasses validation
  overrideUsed?: boolean;
  overrideReasons?: string[];
  overrideTimestamp?: string;
}

/** Active contract entry in cap sheet */
export interface ActiveContract {
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
export type CapHold = Omit<SharedCapHold, 'playerId' | 'active'> & {
  playerId?: SharedCapHold['playerId'] | number | null;
  active?: boolean | null;
  notes?: string | null;
};

export type CapHoldActionItem = Partial<
  Omit<CapHold, 'amount' | 'playerId' | 'playerName'>
> & {
  amount?: unknown;
  playerId?: CapHold['playerId'];
  playerName?: string | null;
};

export type DeadCapEntry = ArchitectMutationDeadCapEntry & {
  id?: string | null;
  playerId?: string | number | null;
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

export type ArchitectExceptionsLike = Omit<
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
export type ManualCapSheetLedgerMutationParams =
  | {
      type: 'deadCap';
      deadCap: DeadCapEntry[];
    }
  | {
      type: 'exceptions';
      exceptions: ManualExceptionsSavePayload;
    };

/** Override audit log entry */
export interface OverrideAuditEntry {
  actionType: string;
  timestamp: string;
  reasons: string[];
  overrideUsed: true;
  playerId?: string;
  playerName?: string;
}

/** Cap sheet structure */
export type CapSheet = Omit<
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
export interface OverrideMetadata {
  overrideUsed: boolean;
  overrideReasons: string[];
  overrideTimestamp: string;
}

export interface MutationActionResult {
  success: boolean;
  message?: string;
}

// Wave 16 Step 1: normalizer functions extracted to useArchitectActions.types.normalizers.ts
export * from './useArchitectActions.types.normalizers';

export interface CapSheetDevTools {
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

export interface TeamHistoryDevTools {
  injectFixtures: () => MutationActionResult;
  clearFixtures: () => MutationActionResult;
  hasInjectedFixtures: boolean;
}

export type PersistMutationResult = ArchitectMutationResult & {
  skipped?: boolean;
  changedTeams?: ArchitectGeneralMutationCommittedTeamUpdate[];
  event?:
    | CapAuditEventV1Like
    | { operationId?: string; type?: string; timestamp?: string };
};

export type ComputeMutationResult = ArchitectMutationResult;

export type MutationTruthResult = Pick<
  ArchitectMutationResult,
  | 'success'
  | 'error'
  | 'appliedToLocalState'
  | 'persistedToWorld'
  | 'writesSummary'
> & {
  skipped?: boolean;
};

export interface OfferSheet {
  id?: string;
  status?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
}

export type OfferSheetResolutionAction = 'match' | 'decline';
export type OfferSheetResolutionMutationType = 'matchOfferSheet' | 'declineOfferSheet';
export type OfferSheetLifecycleMutationType =
  | OfferSheetResolutionMutationType
  | 'finalizeMatchedOfferSheet'
  | 'finalizeDeclinedOfferSheet';
export type OfferSheetLifecycleVisibleArrayKey = 'incomingOfferSheets' | 'offerSheets';
export type OfferSheetLifecycleExpectationPresence = 'present' | 'absent';
export type OfferSheetFinalizeMutationRoute =
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

export interface OfferSheetMutationMetadata {
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

export interface OfferSheetCommittedIdentity {
  dedupKey: string | null;
  offerSheetId: string | null;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
  status: 'PENDING_MATCH';
}

export interface OfferSheetCommittedState {
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: 'changedTeams' | 'reload';
  committedOfferSheet: OfferSheet;
  committedOfferSheetIdentity: OfferSheetCommittedIdentity;
}

export interface OfferSheetLifecycleCommittedIdentityInput {
  dedupKey?: string | null;
  offerSheetId?: string | null;
  playerId?: string | null;
  seasonKey?: string | null;
  offeringTeamCode?: string | null;
  homeTeamCode?: string | null;
  status?: string | null;
}

export interface OfferSheetLifecycleCommittedIdentity {
  dedupKey: string | null;
  offerSheetId: string | null;
  playerId: string | null;
  seasonKey: string | null;
  offeringTeamCode: string | null;
  homeTeamCode: string | null;
  status: string | null;
}

export interface OfferSheetLifecycleCommittedStateExpectation {
  activeTeamArrayKey: OfferSheetLifecycleVisibleArrayKey;
  presence: OfferSheetLifecycleExpectationPresence;
  identity: OfferSheetLifecycleCommittedIdentityInput;
}

export interface OfferSheetLifecycleCommittedState {
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: 'changedTeams' | 'reload';
  committedOfferSheet: OfferSheet | null;
  committedOfferSheetIdentity: OfferSheetLifecycleCommittedIdentity;
  expectation: OfferSheetLifecycleCommittedStateExpectation;
}

export type OfferSheetCommittedStateResolution =
  | {
      ok: true;
      value: OfferSheetCommittedState;
    }
  | {
      ok: false;
      message: string;
      logContext: Record<string, unknown>;
    };

export type OfferSheetStoreExecutionResult =
  | ({
      success: true;
    } & OfferSheetCommittedState)
  | {
      success: false;
      message: string;
    };

export type OfferSheetLifecycleCommittedStateResolution =
  | {
      ok: true;
      value: OfferSheetLifecycleCommittedState;
    }
  | {
      ok: false;
      message: string;
      logContext: Record<string, unknown>;
    };

export type OfferSheetLifecycleExecutionResult =
  | ({
      success: true;
    } & OfferSheetLifecycleCommittedState)
  | {
      success: false;
      message: string;
    };

export const OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE =
  'Offer sheet lifecycle action saved but the committed team snapshot could not be reloaded.';
export const OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE =
  'Offer sheet lifecycle action saved but the committed lifecycle state could not be verified in the active team snapshot.';

export const MANUAL_EXCEPTION_MUTATION_KEYS = [
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

export function mergeManualExceptionSnapshot(
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

import type { UseArchitectModalsReturn } from './useArchitectModals';

/** Modal helpers from useArchitectModals (subset needed by actions) */
export type ArchitectModalsForActions = Pick<
  UseArchitectModalsReturn,
  'openContractModal' | 'closeContractModal'
>;

export type ArchitectStateForActions = Omit<
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
  /**
   * Stage 2B post-action receipt publisher. Optional; when provided,
   * successful committed mutations route through internal publishers
   * which derive receipts from canonical mutation results.
   */
  publishPostActionReceipt?: (
    receipt: import('../postActionHandoff/types').ArchitectPostActionReceipt
  ) => void;
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
  handleLaunchPlayerContractAction: (
    player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer,
    action: 'waive' | 'extend' | 'stretch'
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

