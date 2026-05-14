/**
 * FILE: src/features/architect/utils/mutationPipeline.read.ts
 * PURPOSE: READ-phase helpers for the mutation pipeline — extracted from mutationPipeline.ts (Wave 4 Step 4c).
 * Contains all state-loading, context-building, and read-side helper functions.
 * Shared cross-phase utilities live in mutationPipeline.helpers.ts.
 * OWNERSHIP: Feature: architect/core
 */
import { db } from '@/firebaseConfig';
import { getDoc } from 'firebase/firestore';
import {
  getTeam,
  getPlayer,
} from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
} from '@/features/architect/utils/worldManager';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldPlayerRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeFreeAgency,
  normalizeOptionUsed,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { appendExceptionHistory } from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
  normalizeCanonicalTeamExceptions,
  type CanonicalNonTpeExceptionKey,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  synchronizeTeamTotalsSnapshot,
  type ComputedTeamCapTotals,
  type LoadedTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  FORBIDDEN_TRANSIENT_KEYS,
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/persistenceContracts/enforcement';
import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  NormalizedTeamPick,
  TradeExceptionRecord,
  TradeValidatorCapProjections,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectSource,
  BasePlayerDoc,
  DraftPick,
} from '@/schemas/architect';
import type { PlayerBio, PlayerDraft } from '@/schemas/players_v2';
import type { SignAndTradeContractLike } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  PostTradeSnapshot as TradeContextPostTradeSnapshot,
  TradeApplyValidationTeam as TradeContextApplyValidationTeam,
  TradeContextCurrentState,
  TradeContextNormalizedPayload,
  TeamResult as TradeContextTeamResult,
  ValidatedTradeContext as TradeContextValidatedTradeContext,
} from '@/features/architect/utils/tradeContext/types';
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  assertTradeComputeInputs,
} from '@/features/architect/utils/tradeContext';
import {
  buildSignAndTradeTradeHandoff,
  buildTradeApplyPreparation,
  normalizeTradeContextPayload,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';

import {
  validateSigning,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';
import {
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
} from '@/features/architect/utils/capLegality/postStateCapValidator';

// Shared helpers — imported from helpers submodule, NOT re-defined here
import {
  CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY,
  AUTHORITATIVE_WORLD_TEAM_CODES,
  CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY,
  CURRENT_STATE_PLAYER_CONTRACT_KEYS,
  CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS,
  EMPTY_WRITES_SUMMARY,
  asLooseRecord,
  normalizeCurrentStateTeamSource,
  removeUndefinedDeep,
  toTradeStateSlice,
  toOptionalTrimmedString,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalBoolean,
  toOptionalBooleanOrNull,
  toOptionalNumberishOrNull,
  toOptionalContractDateLikeOrNull,
  toOptionalNumberish,
  normalizeStringArray,
  toOptionalNumberOrNull,
  toOptionalTrimmedStringOrNull,
  normalizeCurrentStatePlayerBioDisplay,
  normalizeCurrentStatePlayerBioDraft,
  normalizeCurrentStatePlayerBio,
  normalizeCurrentStatePlayerBirdRights,
  normalizeCurrentStatePlayerContractBirdRights,
  normalizeCurrentStatePlayerContractIncentives,
  normalizeCurrentStatePlayerContractGuaranteeScheduleEntry,
  normalizeCurrentStatePlayerContractGuaranteeSchedule,
  normalizeCurrentStatePlayerContractTradeEligibilityRules,
  normalizeCurrentStatePlayerContractTradeEligibility,
  normalizeCurrentStatePlayerContractFreeAgency,
  normalizeCurrentStatePlayerContractSalaryRow,
  normalizeCurrentStatePlayerContractSalaryRows,
  projectCurrentStatePlayerContractIngress,
  pickCurrentStatePlayerContractSlice,
  normalizeCurrentStatePlayerContract,
  normalizeCurrentStatePlayerFutureContract,
  normalizeCurrentStatePlayerRepresentation,
  normalizeCurrentStatePlayerSource,
  normalizeCurrentStatePlayerOverridePersistenceSidecar,
  normalizeCurrentStatePlayerDraft,
  normalizeCurrentStatePlayerRfaContext,
  normalizeCurrentStatePlayerRfaBoundary,
  buildCurrentStatePlayerSnapshot,
  toCurrentStatePlayer,
  normalizeCurrentStatePlayerSnapshot,
  toMutationExceptionPreserveOnlyBuckets,
  normalizeMutationExceptionsFromIngress,
  getMutationRosterEntryId,
  requireBasicTeamState,
  requireBasicTeamAndPlayerState,
  requireSigningState,
  requireDestinationState,
  requireOfferSheetTeamState,
  getTeamSourceRecord,
  getSalaryRowEndYear,
  synchronizeTeamTotalsSnapshotOrTeam,
  cloneWritesSummary,
  getMutationPlayerId,
  findPlayerInTeamPlayers,
  toPersistablePlayerOverrideFromNormalizedPlayer,
  toPersistablePlayerOverrideFromSnapshot,
  TradePlayerMoveCandidate,
  CanonicalPlayerPersistenceMode,
  CanonicalPlayerPersistenceCandidate,
  buildCanonicalPlayerPersistenceManifest,
  buildTradePlayerPersistenceManifest,
  materializeCurrentStateBaseTeamPreservedFields,
} from './mutationPipeline.helpers';

// Type-only imports from the pipeline orchestrator (safe: type-only = no runtime cycle)
import type {
  LooseRecord,
  MutationTeamSourceLike,
  MutationPlayerBioLike,
  MutationPlayerSourceLike,
  PlayerLike,
  ArchitectMutationExceptions,
  ArchitectMutationCanonicalExceptionBuckets,
  ArchitectMutationExceptionIngress,
  CurrentStateTeamRoundTripMaterializable,
  ArchitectMutationPlayerRecord,
  ArchitectMutationContract,
  ArchitectMutationBirdRights,
  ArchitectMutationFreeAgency,
  ArchitectMutationSalaryRow,
  NormalizedMutationSalaryRow,
  ArchitectMutationDeadCapEntry,
  ArchitectMutationExceptionEntry,
  ArchitectMutationOfferSheet,
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayerIngress,
  ArchitectTradePayloadPlayer,
  ArchitectTradePayloadTeamRef,
  ArchitectTradePayloadLegacyReceivingPlayer,
  ArchitectTradePayloadTeamIngress,
  ArchitectTradePayloadTeam,
  ArchitectMutationValidatedTradeContext,
  ArchitectMutationTradeContext,
  ArchitectMutationPayload,
  ArchitectMutationComputedTeamSnapshot,
  ArchitectMutationTeamUpdate,
  ArchitectGeneralMutationCommittedTeamSnapshot,
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  ArchitectGeneralMutationDashboardReloadTeamUpdate,
  MutationTeamMap,
  ArchitectMutationPlayerUpdate,
  ArchitectMutationPlayerDelete,
  ArchitectMutationWritesSummary,
  MutationResultIssueLike,
  ArchitectMutationResult,
  SignAndTradePreflightStatus,
  SignAndTradePreflightResult,
  OfferSheetPreflightStatus,
  OfferSheetPreflightResult,
  MutationPayloadLike,
  ComputeResultLike,
  PostStateTotalsByTeam,
  MutationCurrentState,
  TradeStateSlice,
  MutationSignAndTradeCurrentState,
  TradeTeamLike,
  MutationSigningTeamLike,
  MaterializedCurrentStateTeam,
  CurrentStateBaseTeamPreservedCarrierLike,
  CurrentStateBaseTeamMaterializedPreservedFieldMap,
  MutationCurrentStateContractDateLike,
  CurrentStatePlayerRfaBoundaryIngress,
  ArchitectMutationPlayerRfaContextIngress,
  PersistablePlayerOverride,
  PersistablePlayerOverrideSource,
  NormalizedCurrentStatePlayer,
  CurrentStatePlayerOverridePersistenceSidecar,
  TeamLike,
  MutationPipelineSalaryRow,
  OfferSheetTeamLike,
  CurrentStateBaseTeamPreservedFieldMap,
  CurrentStateBaseTeamRosterCarrier,
  CurrentStateBaseTeamRoundTripCarrier,
  CurrentStateTeamPersistenceStripShape,
  ArchitectGeneralMutationDashboardReloadBirdRights,
  ArchitectGeneralMutationDashboardReloadContractFreeAgency,
  ArchitectGeneralMutationDashboardReloadDeadCapEntry,
  ArchitectGeneralMutationDashboardReloadDeadCapYear,
  ArchitectGeneralMutationDashboardReloadExceptionEntry,
  ArchitectGeneralMutationDashboardReloadExceptions,
  ArchitectGeneralMutationDashboardReloadOfferSheet,
  ArchitectGeneralMutationDashboardReloadPlayer,
  ArchitectGeneralMutationDashboardReloadPlayerContract,
  ArchitectGeneralMutationDashboardReloadPlayerFutureContract,
  ArchitectGeneralMutationDashboardReloadTradeException,
  ArchitectMutationCapHold,
  ArchitectMutationCashLedger,
  ArchitectMutationTeamTotals,
  ArchitectWorldMutationContractSummary,
  ArchitectWorldMutationEvent,
  ArchitectWorldMutationEventDiffSummary,
  ArchitectWorldMutationHistoryMetadata,
  AuditContextLike,
  BuildTotalsTeamMap,
  BuildWorldMutationEventPayloadArgs,
  CurrentStateBaseTeamCashLedgerCarrier,
  CurrentStateBaseTeamDraftPicksCarrier,
  CurrentStateBaseTeamEntitlementIdsCarrier,
  CurrentStateBaseTeamExceptionHistoryCarrier,
  CurrentStateBaseTeamExceptionsCarrier,
  CurrentStateBaseTeamTradeExceptionsCarrier,
  CurrentStateExceptionHistoryEntry,
  CurrentStateManualCapTeam,
  CurrentStateManualCapTeamCompute,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetMirrorTeamCompute,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStateOfferSheetResolutionTeamCompute,
  CurrentStatePlayer,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  CurrentStatePlayerOpsTeam,
  CurrentStatePlayerOpsTeamCompute,
  CurrentStatePrimaryTeam,
  CurrentStateSigningTeam,
  CurrentStateSigningTeamCompute,
  CurrentStateTeam,
  CurrentStateTeamIdentityFieldMap,
  CurrentStateTeamMutationCoreFieldMap,
  CurrentStateTradeException,
  CurrentStateTradeTeam,
  GeneralMutationPersistenceTeamSnapshot,
  LineageOverrideMergePlayer,
  LineageOverrideSalaryRow,
  LoadedMutationCurrentStateByType,
  LoadedMutationPlayer,
  LoadedMutationTeam,
  MutationBridgePlayerIdSlice,
  MutationBridgePlayerTouchSlice,
  MutationBridgeTeamUpdatesSlice,
  MutationBridgeWritesSlice,
  MutationCurrentStateBaseTeamIngress,
  MutationCurrentStateOfferSheetTeamIngress,
  MutationCurrentStatePlayerIngress,
  MutationCurrentStateTeamEntry,
  MutationCurrentStateTradeTeamEntryInput,
  MutationCurrentStateTradeTeamIngress,
  MutationDeadCapYear,
  MutationDiffSummary,
  MutationEventMetadataLike,
  MutationEventSourceResult,
  MutationFailureOverrides,
  MutationOfferSheetMirrorCurrentState,
  MutationOfferSheetMirrorCurrentStateInput,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetResolutionCurrentStateInput,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentStateInput,
  MutationScalarId,
  MutationSignAndTradeCurrentStateInput,
  MutationTeamAndPlayerCurrentState,
  MutationTeamAndPlayerCurrentStateInput,
  MutationTeamOnlyCurrentState,
  MutationTeamOnlyCurrentStateInput,
  MutationTradeCurrentState,
  MutationTradeCurrentStateInput,
  PlayerDeleteLike,
  SignAndTradeAuthoritySummary,
  StoreOfferSheetOwnershipCandidate,
  SupportedComputeMutationType,
  TradeMutationPayload,
  WritesSummaryLike,
} from './mutationPipeline';


// Wave 5 Step 1: data-level normalizers extracted to submodule
export * from './mutationPipeline.read.normalizeData';
// Wave 5 Step 2: team current-state construction extracted to submodule
export * from './mutationPipeline.read.normalizeTeam';
import {
  buildCurrentStateBaseTeamBoundaryInput,
  buildCurrentStateTradeTeamBoundaryInput,
  normalizeCurrentStateTeamMutationCore,
  buildCurrentStateBaseTeamPreservedFields,
  normalizeCurrentStateBaseTeamBoundary,
  buildCurrentStateTradeTeamPreservedFields,
  normalizeCurrentStateTradeTeamBoundary,
  buildCurrentStatePlayerOpsTeam,
  buildCurrentStateManualCapTeam,
  buildCurrentStateSigningTeam,
  buildCurrentStateOfferSheetMirrorTeam,
  buildCurrentStateOfferSheetResolutionTeam,
  buildCurrentStateTradeTeam,
  normalizeCurrentStateTeamSnapshot,
  normalizeTradeMutationCurrentState,
  normalizeTeamOnlyMutationCurrentState,
  normalizeTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetMirrorMutationCurrentState,
  normalizeOfferSheetResolutionMutationCurrentState,
  normalizeSignAndTradeMutationCurrentState,
  toCurrentStateTeam,
  normalizePostComputeTeamSnapshotForPostState,
  attachCurrentStateBaseTeamPreservedFields,
} from './mutationPipeline.read.normalizeTeam';

import {
  safeCloneForAudit,
  toOptionalScalarId,
  toOptionalDateLike,
  normalizeCurrentStatePlayerArray,
  normalizeCurrentStateCapHolds,
  normalizeCurrentStateDeadCap,
  normalizeCurrentStateTeamTotals,
  normalizeCurrentStateTeamExceptions,
  normalizeCurrentStateOfferSheets,
  normalizeCurrentStateTradeExceptions,
  normalizeCurrentStateCashLedger,
  normalizeCurrentStateExceptionHistory,
  normalizeCurrentStateDraftPicks,
  resolveCurrentStateTeamTotalSalary,
  hasMutationExceptionBuckets,
} from './mutationPipeline.read.normalizeData';

// ==============================================================================
// UNDEFINED VALUE SANITIZATION
// ==============================================================================

/**
 * Recursively find all paths in an object where the value is undefined.
 * Returns an array of dot-notation paths (e.g., ["contract.totalValue", "player.name"]).
 * @param {unknown} obj - Object to inspect
 * @param {string} [parentPath] - Current path (used in recursion)
 * @returns {string[]} Array of paths with undefined values
 */
export function findUndefinedPaths(obj: unknown, parentPath = ''): string[] {
  const undefinedPaths: string[] = [];

  if (obj === null || typeof obj !== 'object') {
    return undefinedPaths;
  }

  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [i, v])
    : Object.entries(obj);

  for (const [key, value] of entries) {
    const currentPath = parentPath ? `${parentPath}.${key}` : String(key);

    if (value === undefined) {
      undefinedPaths.push(currentPath);
    } else if (value !== null && typeof value === 'object') {
      undefinedPaths.push(...findUndefinedPaths(value, currentPath));
    }
  }

  return undefinedPaths;
}

/**
 * Recursively remove all undefined values from an object or array.
 * Returns a new object/array with undefined values stripped.
 * - For objects: keys with undefined values are omitted
 * - For arrays: undefined elements are filtered out
 * @param {unknown} obj - Object or array to sanitize
 * @returns {unknown} Sanitized copy with no undefined values
 */

// Re-export the shared persistence hygiene fence for existing callers/tests.
export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };

export function backfillCurrentStateBaseTeamPreservedFields<
  T extends CurrentStateTeamRoundTripMaterializable,
>(
  team: T | null | undefined,
  fallbackTeam: CurrentStateTeamRoundTripMaterializable | null | undefined
): MaterializedCurrentStateTeam<T> | null {
  const materializedTeam = materializeCurrentStateBaseTeamPreservedFields(team);
  if (!materializedTeam) {
    return null;
  }

  const fallbackMaterialized =
    materializeCurrentStateBaseTeamPreservedFields(fallbackTeam);
  if (!fallbackMaterialized) {
    return materializedTeam;
  }

  const withBackfilledPreservedFields = {
    ...materializedTeam,
  } as MaterializedCurrentStateTeam<T>;

  if (
    withBackfilledPreservedFields.roster === undefined &&
    fallbackMaterialized.roster !== undefined
  ) {
    withBackfilledPreservedFields.roster = fallbackMaterialized.roster;
  }
  if (
    withBackfilledPreservedFields.exceptions === undefined &&
    fallbackMaterialized.exceptions !== undefined
  ) {
    withBackfilledPreservedFields.exceptions = fallbackMaterialized.exceptions;
  }
  if (
    withBackfilledPreservedFields.offerSheets === undefined &&
    fallbackMaterialized.offerSheets !== undefined
  ) {
    withBackfilledPreservedFields.offerSheets =
      fallbackMaterialized.offerSheets;
  }
  if (
    withBackfilledPreservedFields.incomingOfferSheets === undefined &&
    fallbackMaterialized.incomingOfferSheets !== undefined
  ) {
    withBackfilledPreservedFields.incomingOfferSheets =
      fallbackMaterialized.incomingOfferSheets;
  }
  if (
    withBackfilledPreservedFields.tradeExceptions === undefined &&
    fallbackMaterialized.tradeExceptions !== undefined
  ) {
    withBackfilledPreservedFields.tradeExceptions =
      fallbackMaterialized.tradeExceptions;
  }
  if (
    withBackfilledPreservedFields.cashLedger === undefined &&
    fallbackMaterialized.cashLedger !== undefined
  ) {
    withBackfilledPreservedFields.cashLedger = fallbackMaterialized.cashLedger;
  }
  if (
    withBackfilledPreservedFields.exceptionHistory === undefined &&
    fallbackMaterialized.exceptionHistory !== undefined
  ) {
    withBackfilledPreservedFields.exceptionHistory =
      fallbackMaterialized.exceptionHistory as CurrentStateBaseTeamPreservedFieldMap['exceptionHistory'];
  }
  if (
    withBackfilledPreservedFields.draftPicks === undefined &&
    fallbackMaterialized.draftPicks !== undefined
  ) {
    withBackfilledPreservedFields.draftPicks = fallbackMaterialized.draftPicks;
  }
  if (
    withBackfilledPreservedFields.entitlementIds === undefined &&
    fallbackMaterialized.entitlementIds !== undefined
  ) {
    withBackfilledPreservedFields.entitlementIds =
      fallbackMaterialized.entitlementIds;
  }

  return withBackfilledPreservedFields;
}

export function stripComputeOnlyTeamFieldsForPersistence<
  T extends CurrentStateTeamPersistenceStripShape,
>(team: T): Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'> {
  const materializedTeam = materializeCurrentStateBaseTeamPreservedFields(team);
  if (!materializedTeam) {
    return {} as Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest-destructure to strip compute-only field
  const { teamTotalSalary: _teamTotalSalary, ...persistableTeam } =
    materializedTeam;
  return persistableTeam;
}

/**
 * Dev-only guard that validates an object has no undefined values before Firestore write.
 * In DEV: logs error details and throws.
 * In PROD: silently returns (caller should sanitize).
 * @param {unknown} obj - Object to validate
 * @param {string} label - Description of the object (for error messages)
 */
export function guardAgainstUndefined(obj: unknown, label: string) {
  const undefinedPaths = findUndefinedPaths(obj);

  if (undefinedPaths.length === 0) {
    return; // All good
  }

  const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';

  if (isDev) {
    // Log detailed error for debugging
    console.error(`[mutationPipeline] Undefined values detected in ${label}:`, {
      undefinedPaths,
      objectKeys: Object.keys(obj || {}),
      shallowPreview: JSON.stringify(
        obj,
        (k, v) => (v === undefined ? '__UNDEFINED__' : v),
        2
      )?.slice(0, 500),
    });
    throw new Error(
      `Firestore write blocked: ${label} contains undefined values at paths: ${undefinedPaths.join(', ')}. ` +
        `Fix the data source or add defaults. Object keys: [${Object.keys(obj || {}).join(', ')}]`
    );
  }
  // In production, we silently allow (caller will sanitize before writing)
}

// ==============================================================================
// TYPES (JSDoc for IDE support)
// ==============================================================================

/**
 * @typedef {'executeTrade' | 'signFreeAgent' | 'waivePlayer' | 'extendPlayer' | 'optionDecision' | 'renounceRights' | 'storeOfferSheet' | 'matchOfferSheet' | 'declineOfferSheet' | 'finalizeMatchedOfferSheet' | 'finalizeDeclinedOfferSheet' | 'signAndTrade' | 'setDeadCap' | 'setExceptions'} MutationType
 */

/**
 * @typedef {Object} MutationInput
 * @property {string} userId - User performing the mutation
 * @property {string} worldId - Target world ID
 * @property {string} seasonId - Current season (e.g., "2025-26")
 * @property {MutationType} mutationType - Type of mutation
 * @property {Object} payload - Mutation-specific payload
 * @property {number} [timestamp] - Optional timestamp (defaults to Date.now())
 */

/**
 * @typedef {Object} MutationResult
 * @property {boolean} success - Whether mutation succeeded
 * @property {Array<{teamCode: string, team: Object}>} [changedTeams] - Updated team snapshots
 * @property {Array<{playerId: string, player: Object}>} [changedPlayers] - Updated player overrides
 * @property {Object} [worldPatch] - Metadata updates applied to world
 * @property {Object} [event] - Event log entry created
 * @property {boolean} [appliedToLocalState] - Whether mutation produced an applyable state delta
 * @property {boolean} [persistedToWorld] - Whether canonical world writes/event metadata were persisted
 * @property {Object} [writesSummary] - Deterministic write counters/IDs for auditability
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} ComputeResult
 * @property {boolean} success
 * @property {Array<{teamCode: string, team: Object}>} teamUpdates
 * @property {Array<{playerId: string, player: Object}>} playerUpdates
 * @property {Object} metadata - Event metadata
 * @property {string} [error]
 */

/**
 * @typedef {Object} OfferSheet
 * @property {string} id - Unique ID
 * @property {string} playerId - Target player ID
 * @property {string} playerName - Player name (snapshot)
 * @property {string} offeringTeamCode - Team making the offer
 * @property {string} homeTeamCode - RFA home team
 * @property {string} seasonKey - Season context (e.g. "2025-26")
 * @property {number} year - Cap year
 * @property {number} contractYears - Length
 * @property {Array<{season: string, salary: number, capHit: number, guaranteed: boolean}>} salariesByYear
 * @property {'PENDING_MATCH' | 'MATCHED' | 'DECLINED'} status
 * @property {string} createdAt - ISO timestamp
 */

// ==============================================================================
// OVERRIDE SANITIZATION
// ==============================================================================

/**
 * Strip override metadata from payload if override is not enabled.
 *
 * SECURITY: This is a defense-in-depth mechanism. Even if the client UI
 * allows override actions to pass through, the pipeline will strip the
 * override metadata unless VITE_ENABLE_CBA_OVERRIDE=true.
 *
 * @param {Object} payload - Mutation payload
 * @returns {Object} Sanitized payload with override metadata removed if disabled
 */
export function sanitizePayloadForOverride(payload: LooseRecord | null | undefined) {
  if (!payload) return payload;

  const overrideEnabled = isOverrideEnabled();

  // If override is enabled (dev mode), allow override metadata through
  if (overrideEnabled) {
    return payload;
  }

  // In production (override disabled), strip override-related fields
  const {
    overrideUsed,
    overrideReasons: _overrideReasons, // eslint-disable-line @typescript-eslint/no-unused-vars -- rest-destructure strips override fields
    overrideTimestamp: _overrideTimestamp, // eslint-disable-line @typescript-eslint/no-unused-vars -- rest-destructure strips override fields
    overrideMetadata,
    forceTrade,
    ...sanitized
  } = payload;

  // Log if we stripped override data (helps detect bypass attempts in monitoring)
  if (overrideUsed || overrideMetadata || forceTrade) {
    console.warn(
      '[mutationPipeline] Stripped override metadata from payload. ' +
        'Override is disabled in production. Set VITE_ENABLE_CBA_OVERRIDE=true for dev mode.'
    );
  }

  return sanitized;
}

// ==============================================================================
// WORLD TIME SSOT (Phase 20)
// ==============================================================================

/**
 * Resolve canonical asOfDate for the mutation.
 *
 * This is the SINGLE SOURCE OF TRUTH for "world time" in the mutation pipeline.
 * Used for timing-based CBA rules (e.g., stretch timing, offer sheet 48-hour window).
 *
 * Priority:
 * 1. payloadAsOfDate - Explicit date from mutation payload (highest priority)
 * 2. worldAsOfDate - Date from world metadata (if set)
 * 3. System fallback - Current date (produces warning)
 *
 * @param {Object} params
 * @param {string|null} params.payloadAsOfDate - asOfDate from mutation payload
 * @param {string|null} params.worldAsOfDate - asOfDate from world metadata
 * @returns {{ asOfDate: string, defaulted: boolean }}
 */
export function resolveWorldAsOfDate({
  payloadAsOfDate,
  worldAsOfDate,
}: {
  payloadAsOfDate?: string | null;
  worldAsOfDate?: string | null;
}): { asOfDate: string; defaulted: boolean } {
  // Priority 1: Payload-supplied date
  if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
    return { asOfDate: payloadAsOfDate, defaulted: false };
  }

  // Priority 2: World metadata date
  if (worldAsOfDate && typeof worldAsOfDate === 'string') {
    return { asOfDate: worldAsOfDate, defaulted: false };
  }

  // Priority 3: System fallback (with warning)
  return {
    asOfDate: new Date().toISOString().slice(0, 10),
    defaulted: true,
  };
}

export const AUTHORITATIVE_SAT_PREFLIGHT_SOURCE = 'authoritative-preflight' as const;
export const SAT_INCOMPLETE_VALIDATION_CODES = new Set([
  'SIGN_AND_TRADE__MISSING_VALIDATION_YEAR',
  'SIGN_AND_TRADE__MISSING_CURRENT_YEAR',
  'SIGN_AND_TRADE__MISSING_FIRST_APRON',
]);

export const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';

export function generateOperationId(timestamp = Date.now()) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function toValidationMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const message =
    'message' in value && typeof value.message === 'string'
      ? value.message.trim()
      : '';
  if (message) {
    return message;
  }

  const reason =
    'reason' in value && typeof value.reason === 'string'
      ? value.reason.trim()
      : '';
  return reason || null;
}

export function dedupeMessages(values: unknown[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const message = toValidationMessage(value);
    if (!message || seen.has(message)) {
      return;
    }
    seen.add(message);
    normalized.push(message);
  });

  return normalized;
}

export function hasIncompleteSignAndTradeViolation(issues: unknown[]): boolean {
  return issues.some((issue) => {
    if (!issue || typeof issue !== 'object') {
      return false;
    }

    const code =
      'code' in issue && typeof issue.code === 'string' ? issue.code : '';
    return SAT_INCOMPLETE_VALIDATION_CODES.has(code);
  });
}

/**
 * SAT signing-stage adapter shared by preflight and mutation compute.
 *
 * Rule ownership remains in validateSigning(); this helper exists only so the
 * S&T path has one named source-team signing validation surface.
 */
export function validateSignAndTradeSigningPhase({
  team,
  player,
  contract,
  signedUsing,
  seasonId,
}: {
  team: TeamLike;
  player: PlayerLike;
  contract: ArchitectMutationPayload['contract'];
  signedUsing: ArchitectMutationPayload['signedUsing'];
  seasonId: string;
}) {
  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();

  return validateSigning({
    team,
    player,
    contract,
    signedUsing,
    year: currentYear,
  });
}

/**
 * Shared SAT authority summary surface.
 *
 * This does not own signing or trade rules. It summarizes the prevalidated
 * signing verdict plus the prevalidated trade context so preflight and
 * validateMutation('signAndTrade') read the same staged authority result.
 */
export function summarizeSignAndTradeAuthority({
  signingValidation,
  tradeValidation,
}: {
  signingValidation?: ReturnType<typeof validateSigning> | null;
  tradeValidation?: TradeContextValidatedTradeContext | null;
}): SignAndTradeAuthoritySummary {
  const signingWarnings = Array.isArray(signingValidation?.warnings)
    ? signingValidation.warnings
    : [];
  const tradeWarnings = Array.isArray(tradeValidation?.warnings)
    ? tradeValidation.warnings
    : [];
  const warnings = dedupeMessages([...signingWarnings, ...tradeWarnings]);
  const warningIssues = [...signingWarnings, ...tradeWarnings];

  if (!signingValidation || typeof signingValidation.valid !== 'boolean') {
    const reason = 'Authoritative sign-and-trade preflight is incomplete.';
    return {
      status: 'incomplete',
      reasons: [reason],
      warnings,
      error: reason,
      violations: [reason],
      warningIssues,
    };
  }

  const signingViolations = Array.isArray(signingValidation.violations)
    ? signingValidation.violations
    : [];
  const signingReasons = dedupeMessages(signingViolations);

  if (!signingValidation.valid) {
    const reasons =
      signingReasons.length > 0
        ? signingReasons
        : ['Signing validation failed'];
    return {
      status: 'blocked',
      reasons,
      warnings,
      error: reasons[0] || 'Signing validation failed',
      violations: reasons,
      warningIssues,
    };
  }

  if (!tradeValidation?._isValidatedTradeContext) {
    const reason = 'Authoritative sign-and-trade preflight is incomplete.';
    return {
      status: 'incomplete',
      reasons: [reason],
      warnings,
      error: reason,
      violations: [reason],
      warningIssues,
    };
  }

  const tradeViolations = Array.isArray(tradeValidation.violations)
    ? tradeValidation.violations
    : [];
  const tradeReasons = dedupeMessages(tradeViolations);

  if (tradeValidation.legal) {
    return {
      status: 'legal',
      reasons: [],
      warnings,
      error: null,
      violations: [],
      warningIssues,
    };
  }

  const fallbackReason =
    typeof tradeValidation.error === 'string' && tradeValidation.error.trim()
      ? tradeValidation.error.trim()
      : typeof tradeValidation.reason === 'string' &&
          tradeValidation.reason.trim()
        ? tradeValidation.reason.trim()
        : 'Sign-and-trade failed authoritative validation.';
  const reasons = tradeReasons.length > 0 ? tradeReasons : [fallbackReason];
  const status = hasIncompleteSignAndTradeViolation(tradeViolations)
    ? 'incomplete'
    : 'blocked';

  return {
    status,
    reasons,
    warnings,
    error: reasons[0] || fallbackReason,
    violations: reasons,
    warningIssues,
  };
}

export async function loadWorldAsOfDate(worldId: string): Promise<string | null> {
  try {
    const worldRef = worldMetadataRef(worldId);
    const worldSnap = await getDoc(worldRef);
    if (worldSnap.exists()) {
      return worldSnap.data()?.asOfDate || null;
    }
  } catch (error) {
    console.warn('Could not load world asOfDate:', getErrorMessage(error));
  }

  return null;
}

export function addTeamSnapshot(
  teamsByCode: MutationTeamMap,
  teamCode: string | null | undefined,
  team: TeamLike | null | undefined
) {
  if (!teamCode || !team || teamsByCode[teamCode]) {
    return;
  }
  teamsByCode[teamCode] = safeCloneForAudit(team);
}

export function extractTeamsByCodeFromCurrentState(
  currentState: MutationCurrentState = {}
): MutationTeamMap {
  const teamsByCode: MutationTeamMap = {};

  if (Array.isArray(currentState.teams)) {
    for (const entry of currentState.teams) {
      const teamCode = entry?.teamCode || entry?.team?.teamCode;
      addTeamSnapshot(teamsByCode, teamCode, entry?.team);
    }
  }

  addTeamSnapshot(
    teamsByCode,
    currentState.teamCode || currentState.team?.teamCode,
    currentState.team
  );
  addTeamSnapshot(
    teamsByCode,
    currentState.homeTeam?.teamCode,
    currentState.homeTeam
  );
  addTeamSnapshot(
    teamsByCode,
    currentState.offeringTeam?.teamCode,
    currentState.offeringTeam
  );
  addTeamSnapshot(
    teamsByCode,
    currentState.destinationTeam?.teamCode,
    currentState.destinationTeam
  );

  return teamsByCode;
}


export function toTradePayload(
  payload: Pick<
    ArchitectMutationPayload,
    'teams' | 'capProjections' | 'tradeCtx' | 'asOfDate'
  >
): TradeMutationPayload {
  return normalizeTradeContextPayload({
    teams: Array.isArray(payload.teams) ? payload.teams : [],
    ...(payload.capProjections
      ? { capProjections: payload.capProjections }
      : {}),
    ...(payload.tradeCtx ? { tradeCtx: payload.tradeCtx } : {}),
    ...(payload.asOfDate != null ? { asOfDate: payload.asOfDate } : {}),
  });
}









export function toLineageOverrideMergeBio(
  bio: NormalizedCurrentStatePlayer['bio']
): LineageOverrideMergePlayer['bio'] | undefined {
  if (!bio || typeof bio !== 'object' || Array.isArray(bio)) {
    return undefined;
  }

  const normalized: NonNullable<LineageOverrideMergePlayer['bio']> = {};
  const playerId = toOptionalIdString(bio.playerId);
  const displayName = toOptionalTrimmedString(bio.displayName);

  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function toLineageOverrideMergePlayer(
  player: unknown
): LineageOverrideMergePlayer {
  const playerRecord = normalizeCurrentStatePlayerSnapshot(player);
  const normalized: LineageOverrideMergePlayer = {};

  if (!playerRecord) {
    return normalized;
  }

  const {
    player_id,
    id,
    playerId,
    teamCode,
    teamName,
    name,
    displayName,
    playerName,
    bio,
    contract,
  } = playerRecord;
  const mergeBio = toLineageOverrideMergeBio(bio);

  if (player_id !== undefined) {
    normalized.player_id = player_id;
  }
  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (teamName !== undefined) {
    normalized.teamName = teamName;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (mergeBio !== undefined) {
    normalized.bio = mergeBio;
  }
  if (contract !== undefined) {
    normalized.contract = contract;
  }

  return normalized;
}

export function mergeLineageOverrideSalariesByYear(
  baseSalaries: LineageOverrideSalaryRow[] | null | undefined,
  overrideSalaries: LineageOverrideSalaryRow[] | null | undefined
): LineageOverrideSalaryRow[] | undefined {
  if (!overrideSalaries || overrideSalaries.length === 0) {
    return baseSalaries ? [...baseSalaries] : undefined;
  }

  const merged = baseSalaries ? [...baseSalaries] : [];
  overrideSalaries.forEach((override) => {
    const existingIndex = merged.findIndex(
      (salaryRow) => salaryRow.season === override.season
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...override };
    } else {
      merged.push(override);
    }
  });

  return merged.sort((first, second) => {
    const firstYear = Number.parseInt(first.season.split('-')[0], 10);
    const secondYear = Number.parseInt(second.season.split('-')[0], 10);
    return firstYear - secondYear;
  });
}

export function mergeLineageOverridePlayers(
  basePlayer: LineageOverrideMergePlayer,
  overridePlayer: LineageOverrideMergePlayer
): LineageOverrideMergePlayer {
  const merged: LineageOverrideMergePlayer = { ...basePlayer };

  if (overridePlayer.contract) {
    merged.contract = {
      ...(basePlayer.contract ?? {}),
      ...overridePlayer.contract,
    };
    const mergedSalaries = mergeLineageOverrideSalariesByYear(
      basePlayer.contract?.salariesByYear,
      overridePlayer.contract.salariesByYear
    );
    if (mergedSalaries) {
      merged.contract.salariesByYear = mergedSalaries;
    }
  }

  if (overridePlayer.bio) {
    merged.bio = {
      ...(basePlayer.bio ?? {}),
      ...overridePlayer.bio,
    };
  }

  Object.entries(overridePlayer).forEach(([key, value]) => {
    if (key !== 'contract' && key !== 'bio') {
      merged[key] = value;
    }
  });

  return merged;
}


export type CurrentStateWithBasicTeam<
  TCurrentState extends { team?: unknown | null },
> = TCurrentState & {
  team: NonNullable<TCurrentState['team']>;
};

export type CurrentStateWithBasicTeamAndPlayer<
  TCurrentState extends { team?: unknown | null; player?: PlayerLike | null },
> = CurrentStateWithBasicTeam<TCurrentState> & {
  player: PlayerLike;
};

export type CurrentStateWithSigningPair<
  TCurrentState extends {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
  },
> = TCurrentState & {
  team: MutationSigningTeamLike;
  player: PlayerLike;
};



// Local boundary helper for the live team.source spread sites only.


export function materializeCurrentStateTeamForAudit(
  team: TeamLike | null | undefined
): CurrentStateTeam | null {
  const materializedTeam = team
    ? materializeCurrentStateBaseTeamPreservedFields(
        team as CurrentStateTeamRoundTripMaterializable
      ) || team
    : null;

  return materializedTeam ? (materializedTeam as CurrentStateTeam) : null;
}

export function getSnapshotRosterMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  const materializedTeam = materializeCurrentStateTeamForAudit(team);
  if (!Array.isArray(materializedTeam?.roster)) {
    return null;
  }

  return materializedTeam.roster.some(
    (entry) => getMutationRosterEntryId(entry) === playerId
  );
}

export function getSnapshotPlayersMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  if (!Array.isArray(team?.players)) {
    return {
      playersMatch: null,
      snapshotPlayer: null,
    };
  }

  const snapshotPlayer = findPlayerInTeamPlayers(team, playerId);
  return {
    playersMatch: snapshotPlayer !== null,
    snapshotPlayer,
  };
}

export async function resolveWorldLineage(worldId: string) {
  const lineageWorldIds: string[] = [];
  const visitedWorldIds = new Set<string>();
  let currentWorldId = worldId;

  while (currentWorldId) {
    if (visitedWorldIds.has(currentWorldId)) {
      throw new Error(
        `World lineage cycle detected while resolving authoritative offer-sheet ownership for ${currentWorldId}.`
      );
    }

    visitedWorldIds.add(currentWorldId);
    lineageWorldIds.push(currentWorldId);

    const metadata = (await getWorldMetadata(currentWorldId)) as LooseRecord;
    const parentWorldId =
      typeof metadata.parentWorldId === 'string'
        ? metadata.parentWorldId.trim()
        : '';
    currentWorldId = parentWorldId || '';
  }

  return lineageWorldIds;
}

export async function getFirstExplicitWorldTeamSnapshotFromLineage(
  lineageWorldIds: string[],
  teamCode: string
) {
  for (const lineageWorldId of lineageWorldIds) {
    const snapshot = await getDoc(worldTeamRef(lineageWorldId, teamCode));
    if (snapshot.exists()) {
      const normalizedTeam = toCurrentStateTeam(
        snapshot.data() as MutationCurrentStateOfferSheetTeamIngress | null,
        'offerSheetResolution'
      );
      if (!normalizedTeam) {
        continue;
      }
      return {
        snapshotWorldId: lineageWorldId,
        team: normalizedTeam,
      };
    }
  }

  return null;
}

export async function getFirstExplicitWorldPlayerOverrideFromLineage(
  lineageWorldIds: string[],
  teamCode: string,
  playerId: string
) {
  for (const lineageWorldId of lineageWorldIds) {
    const overrideSnapshot = await getDoc(
      worldPlayerRef(lineageWorldId, teamCode, playerId)
    );
    if (overrideSnapshot.exists()) {
      const normalizedPlayer = toCurrentStatePlayer(
        overrideSnapshot.data() as MutationCurrentStatePlayerIngress | null
      );
      if (!normalizedPlayer) {
        continue;
      }
      return {
        overrideWorldId: lineageWorldId,
        player: normalizedPlayer,
      };
    }
  }

  return null;
}

export async function resolveStoreOfferSheetAuthority({
  worldId,
  offeringTeamCode,
  playerId,
}: {
  worldId: string;
  offeringTeamCode: string;
  playerId: string;
}) {
  const [offeringTeam, lineageWorldIds] = await Promise.all([
    getTeam(worldId, offeringTeamCode).then((team) =>
      toCurrentStateTeam(
        team as MutationCurrentStateOfferSheetTeamIngress | null,
        'signing'
      )
    ),
    resolveWorldLineage(worldId),
  ]);

  if (!offeringTeam) {
    throw new Error(
      `storeOfferSheet requires an authoritative offering team snapshot for ${offeringTeamCode}.`
    );
  }

  const ownershipCandidates = (
    await Promise.all(
      AUTHORITATIVE_WORLD_TEAM_CODES.map(async (teamCode) => {
        const snapshotEntry =
          await getFirstExplicitWorldTeamSnapshotFromLineage(
            lineageWorldIds,
            teamCode
          );
        if (!snapshotEntry) {
          return null;
        }

        const rosterMatch = getSnapshotRosterMembership(
          snapshotEntry.team,
          playerId
        );
        const { playersMatch, snapshotPlayer } = getSnapshotPlayersMembership(
          snapshotEntry.team,
          playerId
        );

        if (
          rosterMatch !== null &&
          playersMatch !== null &&
          rosterMatch !== playersMatch
        ) {
          throw new Error(
            `Strict storeOfferSheet ownership conflict for ${playerId}: ${teamCode} snapshot roster membership disagrees with players[] membership.`
          );
        }

        return {
          teamCode,
          snapshotWorldId: snapshotEntry.snapshotWorldId,
          team: snapshotEntry.team,
          rosterMatch,
          playersMatch,
          snapshotPlayer,
        } as StoreOfferSheetOwnershipCandidate;
      })
    )
  ).filter(Boolean) as StoreOfferSheetOwnershipCandidate[];

  const rosterOwners = ownershipCandidates.filter(
    (candidate) => candidate.rosterMatch === true
  );
  const playersOwners = ownershipCandidates.filter(
    (candidate) => candidate.playersMatch === true
  );

  let resolvedOwner: StoreOfferSheetOwnershipCandidate | null = null;

  if (rosterOwners.length === 1) {
    resolvedOwner = rosterOwners[0];
  } else if (rosterOwners.length > 1) {
    throw new Error(
      `Strict storeOfferSheet ownership is ambiguous for ${playerId}: multiple roster owners found (${rosterOwners
        .map((candidate) => candidate.teamCode)
        .join(', ')}).`
    );
  } else if (playersOwners.length === 1) {
    resolvedOwner = playersOwners[0];
  } else if (playersOwners.length > 1) {
    throw new Error(
      `Strict storeOfferSheet ownership is ambiguous for ${playerId}: multiple players[] owners found (${playersOwners
        .map((candidate) => candidate.teamCode)
        .join(', ')}).`
    );
  } else {
    throw new Error(
      `Strict storeOfferSheet ownership could not resolve an authoritative home team for ${playerId} from world snapshots.`
    );
  }

  if (resolvedOwner.teamCode === offeringTeamCode) {
    throw new Error(
      `storeOfferSheet requires a distinct home team. Player ${playerId} resolves to offering team ${offeringTeamCode}.`
    );
  }

  const overrideEntry = await getFirstExplicitWorldPlayerOverrideFromLineage(
    lineageWorldIds,
    resolvedOwner.teamCode,
    playerId
  );

  if (overrideEntry && !resolvedOwner.snapshotPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth requires a home-team snapshot player for ${playerId} on ${resolvedOwner.teamCode} before applying override truth.`
    );
  }

  const canonicalPlayer = overrideEntry
    ? normalizeCurrentStatePlayerSnapshot(
        mergeLineageOverridePlayers(
          toLineageOverrideMergePlayer(resolvedOwner.snapshotPlayer),
          toLineageOverrideMergePlayer(overrideEntry.player)
        )
      )
    : resolvedOwner.snapshotPlayer;

  if (!canonicalPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth could not resolve player ${playerId} from authoritative home team ${resolvedOwner.teamCode}.`
    );
  }

  return {
    team: offeringTeam,
    player: {
      ...canonicalPlayer,
      teamCode: resolvedOwner.teamCode,
      teamName: resolvedOwner.team.teamName || canonicalPlayer.teamName || null,
    },
    teamCode: offeringTeamCode,
    homeTeam: resolvedOwner.team,
  };
}

export function extractTeamsByCodeFromComputeResult(
  computeResult: MutationBridgeTeamUpdatesSlice = {}
): MutationTeamMap {
  const teamsByCode: MutationTeamMap = {};
  for (const update of computeResult.teamUpdates || []) {
    addTeamSnapshot(
      teamsByCode,
      update?.teamCode,
      normalizePostComputeTeamSnapshotForPostState(update?.team)
    );
  }
  return teamsByCode;
}

export function buildTotalsByTeam(
  teamsByCode: BuildTotalsTeamMap,
  year: number
): PostStateTotalsByTeam {
  const totalsByTeam: PostStateTotalsByTeam = {};
  for (const [teamCode, team] of Object.entries(teamsByCode)) {
    const canonicalTeam = synchronizeTeamTotalsSnapshot(team, year) || team;
    totalsByTeam[teamCode] =
      canonicalTeam?.totals || computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}


export function prepareGeneralMutationPersistenceTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  const persistenceReadyTeam = stripComputeOnlyTeamFieldsForPersistence(
    team as CurrentStateTeamPersistenceStripShape
  );
  const canonicalYear = toEndYear(seasonId);
  const totalsAlignedTeam = Number.isFinite(canonicalYear)
    ? backfillCurrentStateBaseTeamPreservedFields(
        synchronizeTeamTotalsSnapshot(persistenceReadyTeam, canonicalYear) ||
          persistenceReadyTeam,
        persistenceReadyTeam
      ) || persistenceReadyTeam
    : persistenceReadyTeam;
  const afterSanitize =
    sanitizeTransientFieldsForPersistence(totalsAlignedTeam);
  const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);

  return afterTpeNormalize as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  return removeUndefinedDeep(
    prepareGeneralMutationPersistenceTeamSnapshot(team, seasonId)
  ) as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamUpdates(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string
): ArchitectGeneralMutationCommittedTeamUpdate[] {
  if (!Array.isArray(teamUpdates)) {
    return [];
  }

  return teamUpdates.map((update) => ({
    teamCode: update.teamCode,
    team: update?.team
      ? buildGeneralMutationCommittedTeamSnapshot(update.team, seasonId)
      : null,
  }));
}

export function normalizeDashboardReloadDeadCapAmountByYear(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapYear[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      if (!record) {
        return null;
      }

      const season = toOptionalTrimmedString(record.season);
      const amount = toOptionalNumber(record.amount);
      const isStretched = toOptionalBooleanOrNull(record.isStretched);

      if (season === undefined || amount === undefined) {
        return null;
      }

      const normalized: ArchitectGeneralMutationDashboardReloadDeadCapYear = {
        season,
        amount,
      };
      if (isStretched !== undefined) {
        normalized.isStretched = isStretched;
      }

      return normalized;
    })
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadDeadCapYear =>
        entry !== null
    );
}

export function normalizeDashboardReloadDeadCapEntry(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapEntry | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadDeadCapEntry = {};
  const id = toOptionalTrimmedStringOrNull(record.id);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedStringOrNull(record.playerName);
  const label = toOptionalTrimmedStringOrNull(record.label);
  const originalSalary = toOptionalNumberOrNull(record.originalSalary);
  const amountByYear = normalizeDashboardReloadDeadCapAmountByYear(
    record.amountByYear
  );
  const waiveDate = toOptionalTrimmedStringOrNull(record.waiveDate);
  const notes = toOptionalTrimmedStringOrNull(record.notes);
  const stretched = toOptionalBooleanOrNull(record.stretched);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (label !== undefined) {
    normalized.label = label;
  }
  if (originalSalary !== undefined) {
    normalized.originalSalary = originalSalary;
  }
  if (amountByYear !== undefined) {
    normalized.amountByYear = amountByYear;
  }
  if (waiveDate !== undefined) {
    normalized.waiveDate = waiveDate;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (stretched !== undefined) {
    normalized.stretched = stretched;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function normalizeDashboardReloadDeadCap(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadDeadCapEntry(entry))
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadDeadCapEntry =>
        entry !== null
    );
}

export function normalizeDashboardReloadExceptionEntry(
  value: unknown
): ArchitectGeneralMutationDashboardReloadExceptionEntry | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadExceptionEntry = {};
  const type = toOptionalTrimmedStringOrNull(record.type);
  const enabled = toOptionalBoolean(record.enabled);
  const available = toOptionalBoolean(record.available);
  const totalAmount = toOptionalNumberOrNull(record.totalAmount);
  const maxAmount = toOptionalNumberOrNull(record.maxAmount);
  const amount = toOptionalNumberOrNull(record.amount);
  const usedAmount = toOptionalNumberOrNull(record.usedAmount);
  const remainingAmount = toOptionalNumberOrNull(record.remainingAmount);
  const createdFrom = toOptionalTrimmedStringOrNull(record.createdFrom);
  const createdOn = toOptionalTrimmedStringOrNull(record.createdOn);
  const expiresOn = toOptionalTrimmedStringOrNull(record.expiresOn);
  const notes = toOptionalTrimmedStringOrNull(record.notes);
  const seasonKey = toOptionalTrimmedStringOrNull(record.seasonKey);
  const lastUsedAt = toOptionalTrimmedStringOrNull(record.lastUsedAt);

  if (type !== undefined) {
    normalized.type = type;
  }
  if (enabled !== undefined) {
    normalized.enabled = enabled;
  }
  if (available !== undefined) {
    normalized.available = available;
  }
  if (totalAmount !== undefined) {
    normalized.totalAmount = totalAmount;
  }
  if (maxAmount !== undefined) {
    normalized.maxAmount = maxAmount;
  }
  if (amount !== undefined) {
    normalized.amount = amount;
  }
  if (usedAmount !== undefined) {
    normalized.usedAmount = usedAmount;
  }
  if (remainingAmount !== undefined) {
    normalized.remainingAmount = remainingAmount;
  }
  if (createdFrom !== undefined) {
    normalized.createdFrom = createdFrom;
  }
  if (createdOn !== undefined) {
    normalized.createdOn = createdOn;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (lastUsedAt !== undefined) {
    normalized.lastUsedAt = lastUsedAt;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeDashboardReloadExceptions(
  value: unknown
): ArchitectGeneralMutationDashboardReloadExceptions | undefined {
  const normalizedExceptions = normalizeMutationExceptionsFromIngress(value);
  if (!hasMutationExceptionBuckets(normalizedExceptions)) {
    return undefined;
  }

  const dashboardExceptions: ArchitectGeneralMutationDashboardReloadExceptions =
    {};
  const nonTpeKeys: Array<CanonicalNonTpeExceptionKey | 'dpe'> = [
    'mle',
    'tpmle',
    'room',
    'bae',
    'dpe',
  ];

  for (const key of nonTpeKeys) {
    const normalizedEntry = normalizeDashboardReloadExceptionEntry(
      normalizedExceptions[key]
    );
    if (normalizedEntry !== undefined) {
      dashboardExceptions[key] = normalizedEntry;
    }
  }

  if (Array.isArray(normalizedExceptions.tpe)) {
    dashboardExceptions.tpe = normalizedExceptions.tpe
      .map((entry) => {
        const record = asLooseRecord(entry);
        if (!record) {
          return null;
        }

        const id = toOptionalTrimmedString(record.id);
        if (!id) {
          return null;
        }

        const normalized: ArchitectGeneralMutationDashboardReloadTradeException =
          {
            id,
          };
        const totalAmount = toOptionalNumberOrNull(record.totalAmount);
        const usedAmount = toOptionalNumberOrNull(record.usedAmount);
        const remainingAmount = toOptionalNumberOrNull(record.remainingAmount);
        const createdFrom = toOptionalTrimmedStringOrNull(record.createdFrom);
        const createdOn = toOptionalTrimmedStringOrNull(record.createdOn);
        const expiresOn = toOptionalTrimmedStringOrNull(record.expiresOn);
        const notes = toOptionalTrimmedStringOrNull(record.notes);

        if (totalAmount !== undefined) {
          normalized.totalAmount = totalAmount;
        }
        if (usedAmount !== undefined) {
          normalized.usedAmount = usedAmount;
        }
        if (remainingAmount !== undefined) {
          normalized.remainingAmount = remainingAmount;
        }
        if (createdFrom !== undefined) {
          normalized.createdFrom = createdFrom;
        }
        if (createdOn !== undefined) {
          normalized.createdOn = createdOn;
        }
        if (expiresOn !== undefined) {
          normalized.expiresOn = expiresOn;
        }
        if (notes !== undefined) {
          normalized.notes = notes;
        }

        return normalized;
      })
      .filter(
        (
          entry
        ): entry is ArchitectGeneralMutationDashboardReloadTradeException =>
          entry !== null
      );
  }

  return Object.keys(dashboardExceptions).length > 0
    ? dashboardExceptions
    : undefined;
}

export function normalizeDashboardReloadOfferSheet(
  value: unknown
): ArchitectGeneralMutationDashboardReloadOfferSheet | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const status = toOptionalTrimmedString(record.status);
  if (!status) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadOfferSheet = {
    status,
  };
  const id = toOptionalScalarId(record.id);
  const playerName = toOptionalTrimmedString(record.playerName);
  const offeringTeamCode = toOptionalTrimmedString(record.offeringTeamCode);
  const homeTeamCode = toOptionalTrimmedString(record.homeTeamCode);
  const dedupKey = toOptionalTrimmedString(record.dedupKey);
  const playerId = toOptionalIdString(record.playerId);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const contractYears = toOptionalNumberishOrNull(record.contractYears);
  const totalValue = toOptionalNumberishOrNull(record.totalValue);
  const createdAt = toOptionalDateLike(record.createdAt);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (offeringTeamCode !== undefined) {
    normalized.offeringTeamCode = offeringTeamCode;
  }
  if (homeTeamCode !== undefined) {
    normalized.homeTeamCode = homeTeamCode;
  }
  if (dedupKey !== undefined) {
    normalized.dedupKey = dedupKey;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (contractYears !== undefined) {
    normalized.contractYears = contractYears;
  }
  if (totalValue !== undefined) {
    normalized.totalValue = totalValue;
  }
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }

  return normalized;
}

export function normalizeDashboardReloadOfferSheets(
  value: unknown
): ArchitectGeneralMutationDashboardReloadOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadOfferSheet(entry))
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadOfferSheet =>
        entry !== null
    );
}

export function normalizeDashboardReloadContractDateLike(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalTrimmedStringOrNull(value);
}

export function normalizeDashboardReloadContractFreeAgency(
  value: unknown
):
  | ArchitectGeneralMutationDashboardReloadContractFreeAgency
  | string
  | null
  | undefined {
  if (typeof value === 'string') {
    return toOptionalTrimmedStringOrNull(value);
  }

  const record = asLooseRecord(value);
  if (!record) {
    return value === null ? null : undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadContractFreeAgency =
    {};
  const year = toOptionalNumberOrNull(record.year);
  const type = toOptionalTrimmedStringOrNull(record.type);

  if (year !== undefined) {
    normalized.year = year;
  }
  if (type !== undefined) {
    normalized.type = type;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeDashboardReloadContractBirdRights(
  value: unknown
): ArchitectGeneralMutationDashboardReloadBirdRights | null | undefined {
  if (value === null) {
    return null;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const status = toOptionalTrimmedString(record.status);
  if (!status) {
    return undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadBirdRights = {
    status,
  };
  const yearsOfService = toOptionalNumberOrNull(record.yearsOfService);
  const yearsWithTeam = toOptionalNumberOrNull(record.yearsWithTeam);
  const eligibleFor = normalizeStringArray(record.eligibleFor);

  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }

  return normalized;
}

export function normalizeDashboardReloadPlayerContract<
  T extends CurrentStatePlayerContract | CurrentStatePlayerFutureContract,
>(
  value: T | null | undefined
):
  | ArchitectGeneralMutationDashboardReloadPlayerContract
  | ArchitectGeneralMutationDashboardReloadPlayerFutureContract
  | null
  | undefined {
  if (value === null) {
    return null;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized = {
    ...(safeCloneForAudit(record) as LooseRecord),
  };

  const signingDate = normalizeDashboardReloadContractDateLike(
    record.signingDate
  );
  if (signingDate !== undefined) {
    normalized.signingDate = signingDate;
  } else {
    delete normalized.signingDate;
  }

  const freeAgency = normalizeDashboardReloadContractFreeAgency(
    record.freeAgency
  );
  if (freeAgency !== undefined) {
    normalized.freeAgency = freeAgency;
  } else {
    delete normalized.freeAgency;
  }

  const birdRights = normalizeDashboardReloadContractBirdRights(
    record.birdRights
  );
  if (birdRights !== undefined) {
    normalized.birdRights = birdRights;
  } else {
    delete normalized.birdRights;
  }

  return normalized as
    | ArchitectGeneralMutationDashboardReloadPlayerContract
    | ArchitectGeneralMutationDashboardReloadPlayerFutureContract;
}

export function normalizeDashboardReloadPlayer(
  value: CurrentStatePlayer | null | undefined
): ArchitectGeneralMutationDashboardReloadPlayer | null {
  if (!value) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadPlayer = {
    ...(safeCloneForAudit(value) as Omit<
      ArchitectGeneralMutationDashboardReloadPlayer,
      'contract' | 'futureContract'
    >),
  };

  const contract = normalizeDashboardReloadPlayerContract(value.contract);
  if (contract !== undefined) {
    normalized.contract =
      contract as ArchitectGeneralMutationDashboardReloadPlayerContract | null;
  }

  const futureContract = normalizeDashboardReloadPlayerContract(
    value.futureContract
  );
  if (futureContract !== undefined) {
    normalized.futureContract =
      futureContract as ArchitectGeneralMutationDashboardReloadPlayerFutureContract | null;
  }

  return removeUndefinedDeep(
    normalized
  ) as ArchitectGeneralMutationDashboardReloadPlayer;
}

export function normalizeDashboardReloadPlayers(
  value: CurrentStatePlayer[] | null | undefined
): ArchitectGeneralMutationDashboardReloadPlayer[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((player) => normalizeDashboardReloadPlayer(player))
    .filter(
      (player): player is ArchitectGeneralMutationDashboardReloadPlayer =>
        player !== null
    );
}

export function buildGeneralMutationDashboardReloadTeamSnapshot(
  team: ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
): ArchitectGeneralMutationDashboardReloadTeamSnapshot | null {
  if (!team) {
    return null;
  }

  const reloadSnapshot: ArchitectGeneralMutationDashboardReloadTeamSnapshot = {};
  const teamCode = toOptionalTrimmedString(team.teamCode);

  if (teamCode !== undefined) {
    reloadSnapshot.teamCode = teamCode;
  }

  const teamName = toOptionalTrimmedString(team.teamName);
  if (teamName !== undefined) {
    reloadSnapshot.teamName = teamName;
  }
  const players = normalizeDashboardReloadPlayers(team.players);
  if (players !== undefined) {
    reloadSnapshot.players = players;
  }
  if (team.roster !== undefined) {
    reloadSnapshot.roster = team.roster;
  }

  const capHolds = normalizeCurrentStateCapHolds(team.capHolds);
  if (capHolds !== undefined) {
    reloadSnapshot.capHolds = capHolds;
  }

  const deadCap = normalizeDashboardReloadDeadCap(team.deadCap);
  if (deadCap !== undefined) {
    reloadSnapshot.deadCap = deadCap;
  }

  const exceptions = normalizeDashboardReloadExceptions(team.exceptions);
  if (exceptions !== undefined) {
    reloadSnapshot.exceptions = exceptions;
  }

  const offerSheets = normalizeDashboardReloadOfferSheets(team.offerSheets);
  if (offerSheets !== undefined) {
    reloadSnapshot.offerSheets = offerSheets;
  }

  const incomingOfferSheets = normalizeDashboardReloadOfferSheets(
    team.incomingOfferSheets
  );
  if (incomingOfferSheets !== undefined) {
    reloadSnapshot.incomingOfferSheets = incomingOfferSheets;
  }

  if (team.exceptionHistory !== undefined) {
    reloadSnapshot.exceptionHistory = team.exceptionHistory;
  }
  if (team.draftPicks !== undefined) {
    reloadSnapshot.draftPicks = team.draftPicks;
  }
  if (team.entitlementIds !== undefined) {
    reloadSnapshot.entitlementIds = team.entitlementIds;
  }
  if (team.totals !== undefined) {
    reloadSnapshot.totals = team.totals;
  }
  const hardCapped = toOptionalBooleanOrNull(team.hardCapped);
  if (hardCapped !== undefined) {
    reloadSnapshot.hardCapped = hardCapped;
  }
  if (team.hardCapLevel !== undefined) {
    reloadSnapshot.hardCapLevel = team.hardCapLevel;
  }
  if (team.hardCapReason !== undefined) {
    reloadSnapshot.hardCapReason = team.hardCapReason;
  }
  if (team.hardCapTriggeredBy !== undefined) {
    reloadSnapshot.hardCapTriggeredBy = team.hardCapTriggeredBy;
  }

  return removeUndefinedDeep(
    reloadSnapshot
  ) as ArchitectGeneralMutationDashboardReloadTeamSnapshot;
}

export function canonicalizeTeamUpdatesWithCanonicalTotals(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string
): ArchitectMutationTeamUpdate[] {
  const canonicalYear = toEndYear(seasonId);

  if (!Array.isArray(teamUpdates) || !Number.isFinite(canonicalYear)) {
    return Array.isArray(teamUpdates) ? teamUpdates : [];
  }

  return teamUpdates.map((update) => ({
    ...update,
    team: backfillCurrentStateBaseTeamPreservedFields(
      (synchronizeTeamTotalsSnapshot(update?.team, canonicalYear) ||
        update?.team) as CurrentStateTeamRoundTripMaterializable,
      update?.team as CurrentStateTeamRoundTripMaterializable
    ),
  }));
}

export function canonicalizeComputeResultTeamUpdates<T extends ComputeResultLike>(
  result: T,
  seasonId: string
): T {
  if (!Array.isArray(result?.teamUpdates) || result.teamUpdates.length === 0) {
    return result;
  }

  return {
    ...result,
    teamUpdates: canonicalizeTeamUpdatesWithCanonicalTotals(
      result.teamUpdates,
      seasonId
    ),
  };
}

export function collectMutationPlayerIds(
  payload: Pick<ArchitectMutationPayload, 'playerId' | 'teams'> = {},
  computeResult: MutationBridgePlayerIdSlice = {}
) {
  const playerIds = new Set();

  if (payload.playerId) {
    playerIds.add(String(payload.playerId));
  }

  for (const teamEntry of payload.teams || []) {
    for (const player of teamEntry.sends || []) {
      const playerId = player?.player_id || player?.id || player?.playerId;
      if (playerId) {
        playerIds.add(String(playerId));
      }
    }
  }

  for (const update of computeResult.playerUpdates || []) {
    if (update?.playerId) {
      playerIds.add(String(update.playerId));
    }
  }

  const tradedPlayerIds = Array.isArray(computeResult.metadata?.playersTraded)
    ? computeResult.metadata.playersTraded
    : [];
  for (const playerId of tradedPlayerIds) {
    if (playerId) {
      playerIds.add(String(playerId));
    }
  }

  return Array.from(playerIds);
}

export function buildPostStateRulesContext(
  year: number
): NonNullable<PostStateCapValidationInput['rulesContext']> {
  const capSettingsResult = getCapSettings({ year });
  const minimumTeamSalary = Number(capSettingsResult?.settings?.floor);

  return {
    capSettings: capSettingsResult?.settings || null,
    minimumTeamSalary: Number.isFinite(minimumTeamSalary)
      ? minimumTeamSalary
      : undefined,
    capSettingsSource: capSettingsResult?.source || null,
  };
}

export function buildCapAuditDiffSummary({
  beforeTeamsByCode = {},
  afterTeamsByCode = {},
}: {
  beforeTeamsByCode?: MutationTeamMap;
  afterTeamsByCode?: MutationTeamMap;
}): MutationDiffSummary {
  const teamCodes = Array.from(
    new Set([
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(afterTeamsByCode),
    ])
  );
  const changedPlayerIds = new Set();
  let deadCapChanged = 0;
  let exceptionsChanged = 0;

  for (const teamCode of teamCodes) {
    const beforeTeam = materializeCurrentStateTeamForAudit(
      beforeTeamsByCode[teamCode]
    );
    const afterTeam = materializeCurrentStateTeamForAudit(
      afterTeamsByCode[teamCode]
    );

    const beforeRoster = new Set((beforeTeam?.roster || []).map(String));
    const afterRoster = new Set((afterTeam?.roster || []).map(String));

    for (const playerId of beforeRoster) {
      if (!afterRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }
    for (const playerId of afterRoster) {
      if (!beforeRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    if (
      JSON.stringify(beforeTeam?.deadCap || []) !==
      JSON.stringify(afterTeam?.deadCap || [])
    ) {
      deadCapChanged += 1;
    }
    if (
      JSON.stringify(beforeTeam?.exceptions || {}) !==
      JSON.stringify(afterTeam?.exceptions || {})
    ) {
      exceptionsChanged += 1;
    }
  }

  return {
    playersMoved: changedPlayerIds.size,
    deadCapChanged,
    exceptionsChanged,
    teamsTouched: teamCodes.length,
  };
}

export const FREE_AGENCY_MUTATION_TYPES = new Set([
  'signFreeAgent',
  'signAndTrade',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'renounceRights',
]);



export function buildComputeWritesSummary(
  computeResult: MutationBridgeWritesSlice = {}
): WritesSummaryLike {
  const teamCodes = (computeResult.teamUpdates || [])
    .map((update) => String(update?.teamCode || '').trim())
    .filter(Boolean);
  const playerIds = collectPlayerTouchIds(computeResult);
  const entitlementIds = (computeResult.entitlementUpdates || [])
    .map((update) => String(update?.entitlementId || '').trim())
    .filter(Boolean);

  return {
    ...cloneWritesSummary(),
    teamsPatched: teamCodes.length,
    teamCodes,
    playersPatched: playerIds.length,
    playerIds,
    entitlementsPatched: entitlementIds.length,
    entitlementIds,
  };
}

export function buildMutationFailureResult(
  error: unknown,
  overrides: MutationFailureOverrides = {}
): ArchitectMutationResult {
  const {
    appliedToLocalState = false,
    persistedToWorld = false,
    eventWritten = false,
    writesSummary = EMPTY_WRITES_SUMMARY,
    ...restOverrides
  } = overrides;

  return {
    success: false,
    error: error as string | Error,
    appliedToLocalState,
    persistedToWorld,
    eventWritten,
    writesSummary: cloneWritesSummary(writesSummary || EMPTY_WRITES_SUMMARY),
    ...restOverrides,
  };
}

export function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function collectPlayerTouchIds(
  computeResult: MutationBridgePlayerTouchSlice = {}
): string[] {
  const playerIds = new Set<string>();

  for (const update of computeResult.playerUpdates || []) {
    const playerId = String(update?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  for (const deletion of computeResult.playerDeletes || []) {
    const playerId = String(deletion?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  return Array.from(playerIds);
}

export function deriveEventTeamCodes({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: Pick<MutationEventSourceResult, 'teamUpdates' | 'metadata'>;
}) {
  const candidates = [
    auditContext.teamCodes,
    (computeResult.teamUpdates || []).map((update) => update?.teamCode),
    computeResult.metadata?.teamsAffected,
    computeResult.metadata?.teamsInvolved,
    computeResult.metadata?.teamCodes,
  ];

  for (const candidate of candidates) {
    const teamCodes = sanitizeStringList(candidate);
    if (teamCodes.length > 0) {
      return Array.from(new Set(teamCodes));
    }
  }

  return [];
}

export function deriveEventPlayerIds({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: Pick<
    MutationEventSourceResult,
    'playerUpdates' | 'playerDeletes' | 'metadata'
  >;
}) {
  const candidates = [
    auditContext.playerIds,
    collectPlayerTouchIds(computeResult),
    computeResult.metadata?.playersTraded,
    computeResult.metadata?.playerId ? [computeResult.metadata.playerId] : [],
  ];

  for (const candidate of candidates) {
    const playerIds = sanitizeStringList(candidate);
    if (playerIds.length > 0) {
      return Array.from(new Set(playerIds));
    }
  }

  return [];
}

export const TEAM_HISTORY_REQUIRED_MUTATION_TYPES = new Set([
  'executeTrade',
  'signFreeAgent',
  'signAndTrade',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'waivePlayer',
  'extendPlayer',
  'optionDecision',
  'renounceRights',
  'setExceptions',
  'setDeadCap',
]);

export function normalizeEventMutationType(mutationType: string) {
  if (mutationType === 'setException') {
    return 'setExceptions';
  }
  return mutationType;
}

export function toSafeIsoTimestamp(timestamp: unknown) {
  const numericTimestamp = Number(timestamp);
  if (Number.isFinite(numericTimestamp)) {
    return new Date(numericTimestamp).toISOString();
  }

  const parsed = Date.parse(String(timestamp ?? ''));
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function coerceObject(input: unknown): LooseRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as LooseRecord;
}

export function toArrayOfStrings(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function deriveContractSummary(
  metadata: MutationEventMetadataLike = {}
): ArchitectWorldMutationContractSummary {
  const contract = coerceObject(metadata.contract);
  const extensionTerms = coerceObject(metadata.extensionTerms);
  const salariesByYear = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
    : Array.isArray(extensionTerms.salariesByYear)
      ? extensionTerms.salariesByYear
      : [];

  const firstSalaryRow = salariesByYear[0] || {};
  const yearsCandidate =
    Number(contract.years) ||
    Number(contract.contractYears) ||
    Number(contract.contractLength) ||
    Number(metadata.extensionYears) ||
    Number(extensionTerms.contractYears) ||
    Number(extensionTerms.years) ||
    (salariesByYear.length > 0 ? salariesByYear.length : 0);
  const firstYearSalaryCandidate =
    Number(contract.firstYearSalary) ||
    Number(contract.year1Salary) ||
    Number(firstSalaryRow.salary) ||
    Number(firstSalaryRow.capHit) ||
    Number(extensionTerms.firstYearSalary) ||
    0;
  const totalValueCandidate =
    Number(contract.totalValue) ||
    Number(metadata.contractValue) ||
    (salariesByYear.length > 0
      ? salariesByYear.reduce(
          (sum, row) => sum + (Number(row?.salary || row?.capHit) || 0),
          0
        )
      : 0);

  const startSeason = String(firstSalaryRow.season || '').trim();
  const endSeason = String(
    salariesByYear[salariesByYear.length - 1]?.season || ''
  ).trim();

  const summary = {
    years:
      Number.isFinite(yearsCandidate) && yearsCandidate > 0
        ? yearsCandidate
        : undefined,
    firstYearSalary:
      Number.isFinite(firstYearSalaryCandidate) && firstYearSalaryCandidate > 0
        ? firstYearSalaryCandidate
        : undefined,
    totalValue:
      Number.isFinite(totalValueCandidate) && totalValueCandidate > 0
        ? totalValueCandidate
        : undefined,
    startYear: startSeason || undefined,
    endYear: endSeason || undefined,
    signedUsing:
      typeof metadata.signedUsing === 'string' && metadata.signedUsing
        ? metadata.signedUsing
        : typeof contract.signedUsing === 'string' && contract.signedUsing
          ? contract.signedUsing
          : undefined,
  };

  return removeUndefinedDeep(summary) as ArchitectWorldMutationContractSummary;
}

export function deriveTradePicksMoved(metadata: MutationEventMetadataLike = {}) {
  const picksTraded = toArrayOfStrings(metadata.picksTraded);
  if (picksTraded.length > 0) {
    return picksTraded;
  }

  const legacyEntitlementsTraded = toArrayOfStrings(
    metadata.entitlementsTraded
  );
  if (legacyEntitlementsTraded.length > 0) {
    return legacyEntitlementsTraded;
  }

  const entitlementsTraded = coerceObject(metadata.entitlementsTraded);
  const lines = [];
  for (const [teamCode, transfer] of Object.entries(entitlementsTraded)) {
    const transferObj = coerceObject(transfer);
    const out = toArrayOfStrings(transferObj.out);
    const incoming = toArrayOfStrings(transferObj.in);
    if (out.length > 0) {
      lines.push(`${teamCode}: out ${out.join(', ')}`);
    }
    if (incoming.length > 0) {
      lines.push(`${teamCode}: in ${incoming.join(', ')}`);
    }
  }

  return lines;
}

export function buildTeamHistoryDiffSummary({
  mutationType,
  auditContext = {},
  metadata = {},
  playerIds = [],
}: {
  mutationType: string;
  auditContext?: AuditContextLike;
  metadata?: MutationEventMetadataLike;
  playerIds?: string[];
}): ArchitectWorldMutationEventDiffSummary {
  const baseDiffSummary = coerceObject(auditContext.diffSummary);
  const diffSummary = {
    ...baseDiffSummary,
  };

  if ('executeTrade' === mutationType) {
    if (!Array.isArray(diffSummary.playersMoved)) {
      diffSummary.playersMoved =
        toArrayOfStrings(metadata.playersTraded).length > 0
          ? toArrayOfStrings(metadata.playersTraded)
          : playerIds;
    }

    if (!Array.isArray(diffSummary.picksMoved)) {
      const picksMoved = deriveTradePicksMoved(metadata);
      if (picksMoved.length > 0) {
        diffSummary.picksMoved = picksMoved;
      }
    }
  }

  if (mutationType === 'setExceptions') {
    const existing = toArrayOfStrings(diffSummary.exceptionChanges);
    if (existing.length === 0) {
      const fromMetadata = toArrayOfStrings(metadata.exceptionChanges);
      diffSummary.exceptionChanges =
        fromMetadata.length > 0 ? fromMetadata : ['Exceptions updated'];
    }
  }

  if (mutationType === 'setDeadCap') {
    const existing = toArrayOfStrings(diffSummary.deadCapChanges);
    if (existing.length === 0) {
      const fromMetadata = toArrayOfStrings(metadata.deadCapChanges);
      diffSummary.deadCapChanges =
        fromMetadata.length > 0 ? fromMetadata : ['Dead cap updated'];
    }
  }

  return removeUndefinedDeep(
    diffSummary
  ) as ArchitectWorldMutationEventDiffSummary;
}

export function buildTeamHistoryMutationMetadata({
  mutationType,
  auditContext = {},
  worldId,
  teamCodes = [],
  playerIds = [],
  metadata = {},
}: {
  mutationType: string;
  auditContext?: AuditContextLike;
  worldId: string;
  teamCodes?: readonly string[];
  playerIds?: readonly string[];
  metadata?: MutationEventMetadataLike;
}): ArchitectWorldMutationHistoryMetadata {
  const contractSummary = deriveContractSummary(metadata);

  const mutationMetadata: ArchitectWorldMutationHistoryMetadata = {
    mutationType,
    category: auditContext.mutationCategory || 'unknown',
    worldId,
    teams: [...teamCodes],
    players: [...playerIds],
    teamCode:
      typeof metadata.teamCode === 'string' && metadata.teamCode
        ? metadata.teamCode
        : teamCodes[0],
    playerId:
      typeof metadata.playerId === 'string' && metadata.playerId
        ? metadata.playerId
        : playerIds[0],
    playerName:
      typeof metadata.playerName === 'string' && metadata.playerName
        ? metadata.playerName
        : typeof metadata.waivedPlayer === 'string' && metadata.waivedPlayer
          ? metadata.waivedPlayer
          : typeof metadata.renouncedPlayer === 'string' &&
              metadata.renouncedPlayer
            ? metadata.renouncedPlayer
            : undefined,
    signedUsing:
      typeof metadata.signedUsing === 'string' && metadata.signedUsing
        ? metadata.signedUsing
        : contractSummary.signedUsing,
    rightsUsed:
      typeof metadata.rightsUsed === 'string' && metadata.rightsUsed
        ? metadata.rightsUsed
        : undefined,
    stretched: metadata.stretched === true,
    buyout: metadata.buyout === true,
    deadCapAmount:
      Number.isFinite(Number(metadata.deadCapAmount)) &&
      Number(metadata.deadCapAmount) > 0
        ? Number(metadata.deadCapAmount)
        : undefined,
    extensionYears:
      Number.isFinite(Number(metadata.extensionYears)) &&
      Number(metadata.extensionYears) > 0
        ? Number(metadata.extensionYears)
        : undefined,
    optionType:
      typeof metadata.optionType === 'string' && metadata.optionType
        ? metadata.optionType
        : undefined,
    accepted:
      typeof metadata.accepted === 'boolean' ? metadata.accepted : undefined,
    contract: contractSummary,
    contractSummary,
    summary:
      typeof metadata.summary === 'string' && metadata.summary.trim()
        ? metadata.summary.trim()
        : undefined,
  };

  if ('executeTrade' === mutationType) {
    const tradePicksMoved = deriveTradePicksMoved(metadata);
    if (tradePicksMoved.length > 0) {
      mutationMetadata.picksMoved = tradePicksMoved;
    }
  }

  return removeUndefinedDeep(
    mutationMetadata
  ) as ArchitectWorldMutationHistoryMetadata;
}

export function buildWorldMutationEventPayload({
  mutationType,
  eventId,
  seasonId,
  worldId,
  timestamp,
  computeResult,
  auditContext = {},
}: BuildWorldMutationEventPayloadArgs): ArchitectWorldMutationEvent {
  const canonicalMutationType = normalizeEventMutationType(mutationType);
  const teamCodes = deriveEventTeamCodes({ auditContext, computeResult });
  if (
    teamCodes.length === 0 &&
    TEAM_HISTORY_REQUIRED_MUTATION_TYPES.has(canonicalMutationType)
  ) {
    throw new Error(
      `persistWorldMutation requires non-empty teamCodes for ${canonicalMutationType}`
    );
  }

  const playerIds = deriveEventPlayerIds({ auditContext, computeResult });
  const occurredAt = toSafeIsoTimestamp(timestamp);
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error(
      `persistWorldMutation produced invalid occurredAt for ${canonicalMutationType}`
    );
  }

  const stableEventId =
    typeof eventId === 'string' && eventId.trim()
      ? eventId.trim()
      : `${canonicalMutationType}_${Date.parse(occurredAt)}`;
  const operationId =
    typeof auditContext.operationId === 'string' && auditContext.operationId
      ? auditContext.operationId
      : stableEventId;
  const metadata = removeUndefinedDeep(
    sanitizeTransientFieldsForPersistence(computeResult.metadata)
  ) as MutationEventMetadataLike;
  const diffSummary = buildTeamHistoryDiffSummary({
    mutationType: canonicalMutationType,
    auditContext,
    metadata,
    playerIds,
  });
  const mutationMetadata = buildTeamHistoryMutationMetadata({
    mutationType: canonicalMutationType,
    auditContext,
    worldId,
    teamCodes,
    playerIds,
    metadata,
  });

  return {
    // Legacy fields retained for compatibility with existing event consumers.
    eventId: stableEventId,
    id: stableEventId,
    type: canonicalMutationType,
    timestamp: occurredAt,
    seasonId,
    metadata,
    teamsAffected: teamCodes,

    // Cap Audit Event V1 envelope.
    schemaVersion: auditContext.schemaVersion || CAP_AUDIT_EVENT_SCHEMA_VERSION,
    validatorVersion:
      auditContext.validatorVersion || POST_STATE_CAP_VALIDATOR_VERSION,
    operationId,
    mutationType: canonicalMutationType,
    occurredAt,
    worldId,
    teamCodes,
    playerIds,
    beforeTotalsByTeam: auditContext.beforeTotalsByTeam || {},
    afterTotalsByTeam: auditContext.afterTotalsByTeam || {},
    valid: auditContext.valid === true,
    violations: auditContext.violations || [],
    warnings: auditContext.warnings || [],
    diffSummary,
    mutationMetadata,
  };
}

// ==============================================================================
// MAIN ENTRY POINT
// ==============================================================================

/**
 * Apply a mutation to an Architect world.
 *
 * This is the public entrypoint for general / point-in-time Architect world mutations.
 * It is not the single entrypoint for every committed-write operation in Architect;
 * season/world transitions remain in seasonManager.ts.
 * General mutations flow through: READ → COMPUTE → VALIDATE → PERSIST → POST-UPDATE
 *
 * @param {MutationInput} input - Mutation parameters
 * @returns {Promise<MutationResult>} - Result of the mutation
 */
// ==============================================================================
// PHASE 1: READ - Load state for mutation
// ==============================================================================

/**
 * Load required state for a mutation.
 * Uses teamLoader to respect world → parent → base fallback chain.
 *
 * @param {string} worldId
 * @param {MutationType} mutationType
 * @param {Object} payload
 * @returns {Promise<Object>} Current state needed for mutation
 */
export async function loadStateForMutation<
  TMutationType extends SupportedComputeMutationType,
>(
  worldId: string,
  mutationType: TMutationType,
  payload: MutationPayloadLike
): Promise<LoadedMutationCurrentStateByType[TMutationType]>;
export async function loadStateForMutation(
  worldId: string,
  mutationType: string,
  payload: MutationPayloadLike
): Promise<MutationCurrentState> {
  switch (mutationType) {
    case 'executeTrade': {
      // Load all teams involved in trade
      const teamCodes: string[] = (payload.teams || []).map(
        (teamTrade, index) => {
          const code = teamTrade.teamCode || teamTrade.team?.teamCode;
          if (!code) {
            throw new Error(
              `Missing teamCode for trade entry at index ${index}. Payload: ${JSON.stringify(teamTrade)}`
            );
          }
          return String(code);
        }
      );

      const teamStates = await Promise.all(
        teamCodes.map((code: string) => getTeam(worldId, code))
      );
      return {
        teams: teamCodes.map((code, i) => ({
          teamCode: code,
          team: toCurrentStateTeam(
            (teamStates[i] as MutationCurrentStateTradeTeamIngress | null) ||
              null,
            'trade'
          ),
        })),
      };
    }

    case 'signFreeAgent': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [team, player] = (await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ])) as [LoadedMutationTeam, LoadedMutationPlayer];

      // For RFA finalization, we may need to clean up the home team's incomingOfferSheets
      const homeTeamCode = (player.teamCode || player.contract?.signingTeam) as
        | string
        | null
        | undefined;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = toCurrentStateTeam(
          (await getTeam(
            worldId,
            homeTeamCode
          )) as MutationCurrentStateOfferSheetTeamIngress | null,
          'offerSheetMirror'
        );
      }

      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateOfferSheetTeamIngress | null,
          'signing'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        homeTeam,
      };
    }

    case 'waivePlayer': // fallthrough
    case 'extendPlayer': // fallthrough
    case 'optionDecision': {
      // Load single team and player
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for ${mutationType}`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for ${mutationType}`);
      }

      const team = await getTeam(worldId, teamCode);
      const player = await getPlayer(worldId, teamCode, playerId);
      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateBaseTeamIngress | null,
          'playerOps'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
      };
    }

    case 'storeOfferSheet': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const authority = await resolveStoreOfferSheetAuthority({
        worldId,
        offeringTeamCode: String(teamCode),
        playerId: String(playerId),
      });
      return {
        ...authority,
        team: authority.team,
        homeTeam: authority.homeTeam,
      };
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      // Match / decline / finalizeMatched are home-team actions.
      // finalizeDeclined is an offering-team action and must load the explicit homeTeamCode.
      const homeTeamCode =
        mutationType === 'finalizeDeclinedOfferSheet'
          ? (payload.homeTeamCode as string | null | undefined) ||
            (payload.teamCode as string | null | undefined)
          : (payload.teamCode as string | null | undefined) ||
            (payload.homeTeamCode as string | null | undefined);
      const offeringTeamCode = payload.offeringTeamCode as
        | string
        | null
        | undefined;
      const offerSheetId = payload.offerSheetId as string | null | undefined;

      if (!homeTeamCode) throw new Error(`Missing homeTeamCode`);
      if (!offeringTeamCode) throw new Error(`Missing offeringTeamCode`);
      if (!offerSheetId) throw new Error(`Missing offerSheetId`);

      const [homeTeam, offeringTeam] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);
      const isOfferSheetMirrorMutation =
        mutationType === 'matchOfferSheet' ||
        mutationType === 'declineOfferSheet';

      return {
        homeTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(
              (homeTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetMirror'
            )
          : toCurrentStateTeam(
              (homeTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetResolution'
            ),
        offeringTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(
              (offeringTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetMirror'
            )
          : toCurrentStateTeam(
              (offeringTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetResolution'
            ),
        offerSheetId,
      };
    }

    case 'signAndTrade': {
      const { teamCode, destinationTeamCode, playerId } = payload;
      if (!teamCode) throw new Error('Missing source teamCode');
      if (!destinationTeamCode) throw new Error('Missing destinationTeamCode');
      if (!playerId) throw new Error('Missing playerId');

      const [team, destinationTeam, player] = await Promise.all([
        getTeam(worldId, teamCode as string),
        getTeam(worldId, destinationTeamCode as string),
        getPlayer(worldId, teamCode as string, playerId as string),
      ]);

      return {
        team: toCurrentStateTeam(
          (team as MutationCurrentStateTradeTeamIngress | null) || null,
          'trade'
        ),
        destinationTeam: toCurrentStateTeam(
          (destinationTeam as MutationCurrentStateTradeTeamIngress | null) ||
            null,
          'trade'
        ),
        player: toCurrentStatePlayer(player || null),
        teamCode: teamCode as string,
      };
    }

    case 'renounceRights': {
      // Renounce rights: player may only exist in team's players array or cap holds
      // (free agents with cap holds might not have a base player record)
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for renounceRights`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for renounceRights`);
      }

      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'playerOps'
      );
      if (!team) {
        throw new Error(`Team ${teamCode} not found for renounceRights`);
      }

      // Try to find player in team's players array first (prioritize ID match)
      const playerInTeam = (team.players || []).find((p) => {
        const pid = p.player_id || p.id;
        // Prioritize exact ID match
        if (pid && pid === playerId) return true;
        // Fall back to name match only if ID isn't available
        if (!pid && p.name === playerId) return true;
        return false;
      });

      // If found in team, use that data
      if (playerInTeam) {
        return { team, player: playerInTeam, teamCode };
      }

      // Try to find in cap holds
      const capHold = (team.capHolds || []).find(
        (h) => h.playerId === playerId || h.playerName === playerId
      );

      if (capHold) {
        // Build minimal player object from cap hold
        // Use 'None' for bird rights since we're renouncing (will be cleared anyway)
        return {
          team,
          player: {
            player_id: capHold.playerId as string | null,
            name: capHold.playerName as string | null,
            displayName: capHold.playerName as string | null,
            contract: { birdRights: { status: 'None' } },
          },
          teamCode,
        };
      }

      // Finally, try base player collection
      try {
        const player = toCurrentStatePlayer(
          await getPlayer(worldId, teamCode, playerId)
        );
        return { team, player, teamCode };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rethrows with context
      } catch (_err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'manualCap'
      );
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'manualCap'
      );
      return { team, teamCode };
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

export function withDefaultPlayerDeletes<T>(
  result: T & { playerDeletes?: PlayerDeleteLike[] }
): Omit<T, 'playerDeletes'> & { playerDeletes: PlayerDeleteLike[] } {
  return {
    ...result,
    playerDeletes: Array.isArray(result.playerDeletes)
      ? result.playerDeletes
      : [],
  };
}

export type MutationPlayerIdCarrier = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'playerId' | 'id'
>;






export function matchesOfferSheetIdentity(
  offerSheet: ArchitectMutationOfferSheet | null | undefined,
  offerSheetId: string,
  dedupKey?: string | null
) {
  if (!offerSheet) {
    return false;
  }

  const normalizedDedupKey = String(dedupKey || '').trim();
  return (
    String(offerSheet.id || '') === offerSheetId ||
    (normalizedDedupKey.length > 0 &&
      String(offerSheet.dedupKey || '') === normalizedDedupKey)
  );
}

export function removeOfferSheetEntries(
  entries: ArchitectMutationOfferSheet[] | null | undefined,
  offerSheetId: string,
  dedupKey?: string | null
): ArchitectMutationOfferSheet[] {
  const normalizedOfferSheetId = String(offerSheetId || '').trim();
  const normalizedDedupKey = String(dedupKey || '').trim();

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => {
    const entryId = String(entry.id || '').trim();
    const entryDedupKey = String(entry.dedupKey || '').trim();

    if (normalizedOfferSheetId && entryId === normalizedOfferSheetId) {
      return false;
    }

    if (normalizedDedupKey && entryDedupKey === normalizedDedupKey) {
      return false;
    }

    return true;
  });
}

export function buildNormalizedOfferSheetFinalContract({
  offerSheet,
  signingTeam,
  signedUsing,
  timestamp,
}: {
  offerSheet: ArchitectMutationOfferSheet;
  signingTeam: string;
  signedUsing: string;
  timestamp: number;
}) {
  const salariesByYear = (offerSheet.salariesByYear || [])
    .map(normalizeSalaryRow)
    .filter((row): row is NormalizedMutationSalaryRow => row != null);
  const contractYearsCandidate =
    Number(offerSheet.contractYears) || salariesByYear.length;

  if (
    salariesByYear.length === 0 ||
    !Number.isFinite(contractYearsCandidate) ||
    contractYearsCandidate <= 0
  ) {
    return null;
  }

  const computedTotalValue = salariesByYear.reduce(
    (sum, row) => sum + (Number(row.salary ?? row.capHit) || 0),
    0
  );
  const explicitTotalValue = Number(offerSheet.totalValue);
  const totalValue =
    Number.isFinite(explicitTotalValue) && explicitTotalValue > 0
      ? explicitTotalValue
      : computedTotalValue > 0
        ? computedTotalValue
        : undefined;

  const normalizedContract = normalizeContractForWorld({
    contractType: 'Standard',
    signedUsing,
    signingTeam,
    signingDate: new Date(timestamp).toISOString(),
    contractLength: contractYearsCandidate,
    years: contractYearsCandidate,
    totalValue,
    salariesByYear,
    freeAgency: undefined,
    rfaOfferSheet: undefined,
    rfaOfferSheetOnly: undefined,
    rfaOfferSheetStatus: undefined,
  }) as ArchitectMutationContract | null;

  return removeUndefinedDeep(normalizedContract) as ArchitectMutationContract;
}


