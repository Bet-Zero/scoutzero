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

export function attachCurrentStateBaseTeamPreservedFields(
  team: CurrentStateTeamRoundTripMaterializable,
  preserved: CurrentStateBaseTeamPreservedFieldMap
) {
  const withPreservedFields = {
    ...team,
  } as CurrentStateTeamRoundTripMaterializable &
    CurrentStateBaseTeamPreservedCarrierLike;

  if (preserved.roster !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY] =
      preserved.roster;
  }
  if (preserved.exceptions !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY] =
      preserved.exceptions;
  }
  if (preserved.offerSheets !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY] =
      preserved.offerSheets;
  }
  if (preserved.incomingOfferSheets !== undefined) {
    withPreservedFields[
      CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY
    ] = preserved.incomingOfferSheets;
  }

  if (preserved.tradeExceptions !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY] =
      preserved.tradeExceptions;
  }
  if (preserved.cashLedger !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY] =
      preserved.cashLedger;
  }
  if (preserved.exceptionHistory !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY] =
      preserved.exceptionHistory;
  }
  if (preserved.draftPicks !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY] =
      preserved.draftPicks;
  }
  if (preserved.entitlementIds !== undefined) {
    withPreservedFields[CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY] =
      preserved.entitlementIds;
  }

  return withPreservedFields;
}


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

export function safeCloneForAudit<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
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









export function toOptionalScalarId(value: unknown): MutationScalarId {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}



export function normalizeRosterEntries(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => getMutationRosterEntryId(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}

export function toOptionalDateLike(
  value: unknown
): string | number | Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

export function normalizeCurrentStateCashLedger(
  value: unknown
): ArchitectMutationCashLedger | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationCashLedger = {};
  const totalOut = toOptionalNumberish(record.totalOut);

  if (totalOut !== undefined) {
    normalized.totalOut = totalOut;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateOfferSheetSalaryRows(
  value: unknown
): NormalizedMutationSalaryRow[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const row = asLooseRecord(entry);
      if (!row) {
        return null;
      }

      const normalized: NormalizedMutationSalaryRow = {
        season: '',
      };
      const season = toOptionalTrimmedString(row.season);
      if (!season) {
        return null;
      }
      normalized.season = season;

      const salary = toOptionalNumber(row.salary);
      const capHit = toOptionalNumber(row.capHit ?? row.salary);
      const guaranteed = toOptionalBoolean(row.guaranteed);
      const guaranteedAmount = toOptionalNumber(row.guaranteedAmount);
      const option = toOptionalTrimmedString(row.option);
      const optionType = toOptionalTrimmedString(row.optionType);
      const optionUsed = normalizeOptionUsed(row.optionUsed);
      const isExtensionSeason = toOptionalBoolean(row.isExtensionSeason);

      if (salary !== undefined) {
        normalized.salary = salary;
      }
      if (capHit !== undefined) {
        normalized.capHit = capHit;
      }
      if (guaranteed !== undefined) {
        normalized.guaranteed = guaranteed;
      }
      if (guaranteedAmount !== undefined) {
        normalized.guaranteedAmount = guaranteedAmount;
      }
      if (option !== undefined) {
        normalized.option = option;
      }
      if (optionType !== undefined) {
        normalized.optionType = optionType;
      }
      if (optionUsed !== null) {
        normalized.optionUsed = optionUsed;
      }
      if (isExtensionSeason !== undefined) {
        normalized.isExtensionSeason = isExtensionSeason;
      }

      return normalized;
    })
    .filter((entry): entry is NormalizedMutationSalaryRow => entry !== null);
}

export function normalizeCurrentStateOfferSheet(
  value: unknown
): ArchitectMutationOfferSheet | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationOfferSheet = {};
  const id = toOptionalScalarId(record.id);
  const dedupKey = toOptionalTrimmedString(record.dedupKey);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const offeringTeamCode = toOptionalTrimmedString(record.offeringTeamCode);
  const homeTeamCode = toOptionalTrimmedString(record.homeTeamCode);
  const status = toOptionalTrimmedString(record.status);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const year = toOptionalNumber(record.year);
  const contractYears = toOptionalNumberish(record.contractYears);
  const totalValue = toOptionalNumberish(record.totalValue);
  const salariesByYear = normalizeCurrentStateOfferSheetSalaryRows(
    record.salariesByYear
  );
  const createdAt = toOptionalDateLike(record.createdAt);
  const matchedAt = toOptionalTrimmedString(record.matchedAt);
  const declinedAt = toOptionalTrimmedString(record.declinedAt);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (dedupKey !== undefined) {
    normalized.dedupKey = dedupKey;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
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
  if (status !== undefined) {
    normalized.status = status;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (year !== undefined) {
    normalized.year = year;
  }
  if (contractYears !== undefined) {
    normalized.contractYears = contractYears;
  }
  if (totalValue !== undefined) {
    normalized.totalValue = totalValue;
  }
  if (salariesByYear !== undefined) {
    normalized.salariesByYear = salariesByYear;
  }
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }
  if (matchedAt !== undefined) {
    normalized.matchedAt = matchedAt;
  }
  if (declinedAt !== undefined) {
    normalized.declinedAt = declinedAt;
  }

  return normalized;
}

export function normalizeCurrentStateOfferSheets(
  value: unknown
): ArchitectMutationOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateOfferSheet(entry))
    .filter((entry): entry is ArchitectMutationOfferSheet => entry !== null);
}

export function normalizeCurrentStateCapHold(
  value: unknown
): ArchitectMutationCapHold | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationCapHold = {};
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const amount = toOptionalNumber(record.amount);
  const type = toOptionalTrimmedString(record.type);
  const season = toOptionalTrimmedString(record.season);
  const isSigned = toOptionalBoolean(record.isSigned);
  const expiresOn = toOptionalTrimmedString(record.expiresOn);
  const notes = toOptionalTrimmedString(record.notes);
  const active = toOptionalBoolean(record.active);
  const reason = toOptionalTrimmedString(record.reason);

  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (amount !== undefined) {
    normalized.amount = amount;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (season !== undefined) {
    normalized.season = season;
  }
  if (isSigned !== undefined) {
    normalized.isSigned = isSigned;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (active !== undefined) {
    normalized.active = active;
  }
  if (reason !== undefined) {
    normalized.reason = reason;
  }

  return normalized;
}

export function normalizeCurrentStateCapHolds(
  value: unknown
): ArchitectMutationCapHold[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateCapHold(entry))
    .filter((entry): entry is ArchitectMutationCapHold => entry !== null);
}

export function normalizeCurrentStateDeadCapAmountByYear(
  value: unknown
): MutationDeadCapYear[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      if (!record) {
        return null;
      }

      const normalized: MutationDeadCapYear = {};
      const season = toOptionalTrimmedString(record.season);
      const amount = toOptionalNumberish(record.amount);
      const isStretched = toOptionalBoolean(record.isStretched);

      if (season !== undefined) {
        normalized.season = season;
      }
      if (amount !== undefined) {
        normalized.amount = amount;
      }
      if (isStretched !== undefined) {
        normalized.isStretched = isStretched;
      }

      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((entry): entry is MutationDeadCapYear => entry !== null);
}

export function normalizeCurrentStateDeadCapEntry(
  value: unknown
): ArchitectMutationDeadCapEntry | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationDeadCapEntry = {};
  const id = toOptionalTrimmedString(record.id);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const label = toOptionalTrimmedString(record.label);
  const originalSalary = toOptionalNumberish(record.originalSalary);
  const amountByYear = normalizeCurrentStateDeadCapAmountByYear(
    record.amountByYear
  );
  const waiveDate = toOptionalTrimmedString(record.waiveDate);
  const notes = toOptionalTrimmedString(record.notes);
  const stretched = toOptionalBoolean(record.stretched);

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

  return normalized;
}

export function normalizeCurrentStateDeadCap(
  value: unknown
): ArchitectMutationDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateDeadCapEntry(entry))
    .filter((entry): entry is ArchitectMutationDeadCapEntry => entry !== null);
}



export function normalizeCurrentStateTotalsDeltas(
  value: unknown
): ArchitectMutationTeamTotals['deltas'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<ArchitectMutationTeamTotals['deltas']> = {};
  const vsCap = toOptionalNumber(record.vsCap);
  const vsLuxuryTax = toOptionalNumber(record.vsLuxuryTax);
  const vsFirstApron = toOptionalNumber(record.vsFirstApron);
  const vsSecondApron = toOptionalNumber(record.vsSecondApron);

  if (vsCap !== undefined) {
    normalized.vsCap = vsCap;
  }
  if (vsLuxuryTax !== undefined) {
    normalized.vsLuxuryTax = vsLuxuryTax;
  }
  if (vsFirstApron !== undefined) {
    normalized.vsFirstApron = vsFirstApron;
  }
  if (vsSecondApron !== undefined) {
    normalized.vsSecondApron = vsSecondApron;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateTotalsMeta(
  value: unknown
): ArchitectMutationTeamTotals['_meta'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: Partial<NonNullable<ArchitectMutationTeamTotals['_meta']>> =
    {};
  const source = toOptionalTrimmedString(record.source);
  const capSettingsSource = toOptionalTrimmedString(record.capSettingsSource);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const incompleteRosterCharge = asLooseRecord(record.incompleteRosterCharge);

  if (source === 'computeTeamCapTotals') {
    normalized.source = source;
  }
  if (record.rulesSource !== undefined) {
    normalized.rulesSource = safeCloneForAudit(record.rulesSource);
  }
  if (record.rulesSourcesSummary !== undefined) {
    normalized.rulesSourcesSummary = safeCloneForAudit(
      record.rulesSourcesSummary
    );
  }
  if (record.rulesSources !== undefined) {
    normalized.rulesSources = safeCloneForAudit(record.rulesSources);
  }
  if (capSettingsSource === 'via_facade') {
    normalized.capSettingsSource = capSettingsSource;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (incompleteRosterCharge) {
    const standardRosterCount = toOptionalNumber(
      incompleteRosterCharge.standardRosterCount
    );
    const minRoster = toOptionalNumber(incompleteRosterCharge.minRoster);
    const missingSlots = toOptionalNumber(incompleteRosterCharge.missingSlots);
    const chargePerSlot = toOptionalNumber(
      incompleteRosterCharge.chargePerSlot
    );

    normalized.incompleteRosterCharge = {
      standardRosterCount: standardRosterCount ?? 0,
      minRoster: minRoster ?? 0,
      missingSlots: missingSlots ?? 0,
      chargePerSlot: chargePerSlot ?? 0,
    };
  } else if (record.incompleteRosterCharge === null) {
    normalized.incompleteRosterCharge = null;
  }

  return Object.keys(normalized).length > 0
    ? (normalized as ArchitectMutationTeamTotals['_meta'])
    : undefined;
}

export function normalizeCurrentStateTeamTotals(
  value: unknown
): ArchitectMutationTeamTotals | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationTeamTotals = {};
  const numberFields = [
    'yearKey',
    'playersTotal',
    'deadMoneyTotal',
    'capHoldsTotal',
    'incompleteChargesTotal',
    'totalCapAllocations',
    'salaryCap',
    'luxuryTax',
    'totalSalary',
    'teamSalary',
    'capHit',
    'currentCapHit',
    'guaranteedSalary',
    'nonGuaranteedSalary',
    'rosterCount',
    'guaranteedContracts',
    'nonGuaranteedContracts',
    'twoWayContracts',
    'emptyRosterCharges',
    'capSpace',
    'capRoom',
    'effectiveCap',
    'luxuryTaxLine',
    'taxablePayroll',
    'taxBill',
    'taxRate',
    'firstApron',
    'firstApronRoom',
    'secondApron',
    'secondApronRoom',
    'hardCapRoom',
  ] as const;

  for (const field of numberFields) {
    const normalizedValue = toOptionalNumber(record[field]);
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue;
    }
  }

  const booleanFields = [
    'isOverTax',
    'isFirstApron',
    'isSecondApron',
    'isHardCapped',
  ] as const;

  for (const field of booleanFields) {
    const normalizedValue = toOptionalBoolean(record[field]);
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue;
    }
  }

  const hardCapLevel = toOptionalTrimmedString(record.hardCapLevel);
  const hardCapDetail = toOptionalTrimmedString(record.hardCapDetail);
  const hardCapReason = toOptionalTrimmedStringOrNull(record.hardCapReason);
  const hardCapTriggered =
    toOptionalTrimmedString(record.hardCapTriggered) ??
    toOptionalBoolean(record.hardCapTriggered);
  const deltas = normalizeCurrentStateTotalsDeltas(record.deltas);
  const meta = normalizeCurrentStateTotalsMeta(record._meta);

  if (hardCapLevel !== undefined) {
    normalized.hardCapLevel = hardCapLevel;
  }
  if (hardCapDetail !== undefined) {
    normalized.hardCapDetail = hardCapDetail;
  }
  if (hardCapReason !== undefined) {
    normalized.hardCapReason = hardCapReason;
  }
  if (hardCapTriggered !== undefined) {
    normalized.hardCapTriggered = hardCapTriggered;
  }
  if (deltas !== undefined) {
    normalized.deltas = deltas;
  }
  if (meta !== undefined) {
    normalized._meta = meta;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateDraftPickProtectionMeta(
  value: unknown
): NonNullable<DraftPick['protectionMeta']> | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const type = toOptionalTrimmedString(record.type);
  if (
    type !== 'position' &&
    type !== 'lottery' &&
    type !== 'playoff' &&
    type !== 'always' &&
    type !== 'never'
  ) {
    return undefined;
  }

  const normalized: NonNullable<DraftPick['protectionMeta']> = { type };
  const maxPosition = toOptionalNumber(record.maxPosition);
  const conversionTargetRecord = asLooseRecord(record.conversionTarget);

  if (maxPosition !== undefined) {
    normalized.maxPosition = maxPosition;
  }
  if (conversionTargetRecord) {
    const action = toOptionalTrimmedString(conversionTargetRecord.action);
    if (action === 'roll' || action === 'convert' || action === 'cancel') {
      normalized.conversionTarget = { action };
      const toYear = toOptionalNumber(conversionTargetRecord.toYear);
      const toRound = toOptionalNumber(conversionTargetRecord.toRound);
      if (toYear !== undefined) {
        normalized.conversionTarget.toYear = toYear;
      }
      if (toRound !== undefined) {
        normalized.conversionTarget.toRound = toRound;
      }
    }
  }

  return normalized;
}

export function normalizeCurrentStateDraftPickConveyance(
  value: unknown
): NonNullable<DraftPick['conveyance']> | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<DraftPick['conveyance']> = {};
  const id = toOptionalTrimmedString(record.id);
  const description = toOptionalTrimmedString(record.description);
  const originalYear = toOptionalNumber(record.originalYear);
  const currentYear = toOptionalNumber(record.currentYear);
  const finalYear = toOptionalNumber(record.finalYear);
  const conditionsRecord = asLooseRecord(record.conditions);
  const affects = normalizeStringArray(record.affects);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (description !== undefined) {
    normalized.description = description;
  }
  if (originalYear !== undefined) {
    normalized.originalYear = originalYear;
  }
  if (currentYear !== undefined) {
    normalized.currentYear = currentYear;
  }
  if (finalYear !== undefined) {
    normalized.finalYear = finalYear;
  }
  if (conditionsRecord) {
    const protection = toOptionalTrimmedString(conditionsRecord.protection);
    const ifConveys = toOptionalTrimmedString(conditionsRecord.ifConveys);
    const ifRolls = toOptionalTrimmedString(conditionsRecord.ifRolls);
    const conditions: NonNullable<
      NonNullable<DraftPick['conveyance']>['conditions']
    > = {};
    if (protection !== undefined) {
      conditions.protection = protection;
    }
    if (ifConveys !== undefined) {
      conditions.ifConveys = ifConveys;
    }
    if (ifRolls !== undefined) {
      conditions.ifRolls = ifRolls;
    }
    if (Object.keys(conditions).length > 0) {
      normalized.conditions = conditions;
    }
  }
  if (affects !== undefined) {
    normalized.affects = affects;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateDraftPickMetadata(
  value: unknown
): DraftPick['metadata'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  // Draft-pick metadata is the one schema-approved passthrough pocket on this
  // legacy field. It stays isolated to pick.metadata instead of preserving the
  // entire raw pick object.
  return safeCloneForAudit(record) as DraftPick['metadata'];
}

export function normalizeCurrentStateDraftPick(value: unknown): DraftPick | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const year = toOptionalNumber(record.year);
  const round = toOptionalNumber(record.round);
  const owner = toOptionalTrimmedString(record.owner);

  if (year === undefined || round === undefined || owner === undefined) {
    return null;
  }

  const normalized: DraftPick = {
    year,
    round,
    pick: toOptionalNumberOrNull(record.pick) ?? null,
    owner,
  };
  const id = toOptionalTrimmedString(record.id);
  const originalTeam = toOptionalTrimmedString(record.originalTeam);
  const status = toOptionalTrimmedString(record.status);
  const isSwap = toOptionalBoolean(record.isSwap);
  const swapType = toOptionalTrimmedString(record.swapType);
  const swapWithTeamId = toOptionalTrimmedString(record.swapWithTeamId);
  const protection = toOptionalTrimmedStringOrNull(record.protection);
  const protectionMeta = normalizeCurrentStateDraftPickProtectionMeta(
    record.protectionMeta
  );
  const stepienEligible = toOptionalBoolean(record.stepienEligible);
  const tradeable = toOptionalBoolean(record.tradeable);
  const via = toOptionalTrimmedString(record.via);
  const recipient = toOptionalTrimmedString(record.recipient);
  const route = normalizeStringArray(record.route);
  const notes = toOptionalTrimmedString(record.notes);
  const conveyance = normalizeCurrentStateDraftPickConveyance(
    record.conveyance
  );
  const metadata = normalizeCurrentStateDraftPickMetadata(record.metadata);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (originalTeam !== undefined) {
    normalized.originalTeam = originalTeam;
  }
  if (status !== undefined) {
    normalized.status = status;
  }
  if (isSwap !== undefined) {
    normalized.isSwap = isSwap;
  }
  if (swapType === 'best_of' || swapType === 'worst_of') {
    normalized.swapType = swapType;
  }
  if (swapWithTeamId !== undefined) {
    normalized.swapWithTeamId = swapWithTeamId;
  }
  if (protection !== undefined) {
    normalized.protection = protection;
  }
  if (protectionMeta !== undefined) {
    normalized.protectionMeta = protectionMeta;
  }
  if (stepienEligible !== undefined) {
    normalized.stepienEligible = stepienEligible;
  }
  if (tradeable !== undefined) {
    normalized.tradeable = tradeable;
  }
  if (via !== undefined) {
    normalized.via = via;
  }
  if (recipient !== undefined) {
    normalized.recipient = recipient;
  }
  if (route !== undefined) {
    normalized.route = route;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (conveyance !== undefined) {
    normalized.conveyance = conveyance;
  }
  if (metadata !== undefined) {
    normalized.metadata = metadata;
  }

  return normalized;
}

export function normalizeCurrentStateDraftPicks(
  value: unknown
): DraftPick[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeCurrentStateDraftPick(entry))
    .filter((entry): entry is DraftPick => entry !== null);

  return normalized.length > 0 ? normalized : [];
}



export function toCurrentStateTradeException(
  value: unknown
): CurrentStateTradeException | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const amount = toOptionalNumber(record.amount);
  const totalAmount = toOptionalNumber(record.totalAmount) ?? amount;
  const remainingAmount =
    toOptionalNumber(record.remainingAmount) ??
    toOptionalNumber(record.remaining) ??
    totalAmount ??
    amount;
  const usedAmount =
    toOptionalNumber(record.usedAmount) ?? toOptionalNumber(record.used);
  const normalized: CurrentStateTradeException = {};
  const id = toOptionalIdString(record.id);
  const createdSeason =
    toOptionalNumber(record.createdSeason) ??
    toOptionalNumber(record.createdAtSeason) ??
    toOptionalNumber(record.season);
  const expiresOn =
    toOptionalTrimmedString(record.expiresOn) ??
    toOptionalTrimmedString(record.expirationDate) ??
    toOptionalTrimmedString(record.expiryISO) ??
    toOptionalTrimmedString(record.expiryDate);
  const createdFrom =
    toOptionalTrimmedString(record.createdFrom) ??
    toOptionalTrimmedString(record.name);
  const isUsed = toOptionalBoolean(record.isUsed);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (amount !== undefined || totalAmount !== undefined) {
    normalized.amount = amount ?? totalAmount;
  }
  if (totalAmount !== undefined || amount !== undefined) {
    normalized.totalAmount = totalAmount ?? amount;
  }
  if (remainingAmount !== undefined) {
    normalized.remainingAmount = remainingAmount;
  }
  if (usedAmount !== undefined) {
    normalized.usedAmount = usedAmount;
  }
  if (createdSeason !== undefined) {
    normalized.createdSeason = createdSeason;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (createdFrom !== undefined) {
    normalized.createdFrom = createdFrom;
  }
  if (isUsed !== undefined) {
    normalized.isUsed = isUsed;
  }

  return normalized;
}

export function normalizeCurrentStateTradeExceptions(
  value: unknown
): CurrentStateTradeException[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toCurrentStateTradeException(entry))
    .filter((entry): entry is CurrentStateTradeException => entry !== null);
}

// Exceptions still accept legacy/custom ingress buckets here because canonical
// normalization owns collapsing them before committed compute reads them.
export type MutationExceptionPreserveOnlyBuckets = ArchitectMutationExceptionIngress;


export function hasMutationExceptionBuckets(
  exceptions: ArchitectMutationExceptions
): boolean {
  return Object.keys(exceptions).length > 0;
}

export function normalizeCurrentStateTeamExceptions(
  value: unknown
): ArchitectMutationExceptions | undefined {
  const normalizedExceptions = normalizeMutationExceptionsFromIngress(value);

  return hasMutationExceptionBuckets(normalizedExceptions)
    ? normalizedExceptions
    : undefined;
}

export function normalizeCurrentStateExceptionHistory(
  value: unknown
): CurrentStateExceptionHistoryEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  // Preserve-only compatibility pocket: history rows are object-shaped but the
  // historical payload fields still vary by producer, so the open part stays on
  // the entry itself rather than widening the whole team snapshot.
  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      return record
        ? (safeCloneForAudit(record) as CurrentStateExceptionHistoryEntry)
        : null;
    })
    .filter(
      (entry): entry is CurrentStateExceptionHistoryEntry => entry !== null
    );
}

export type CurrentStatePlayerBoundaryInput =
  | MutationCurrentStatePlayerIngress
  | PlayerLike;

export function normalizeCurrentStatePlayerArray(
  value: unknown
): PlayerLike[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStatePlayerSnapshot(entry))
    .filter((entry): entry is PlayerLike => entry !== null);
}

export function resolveCurrentStateTeamTotalSalary(
  teamRecord: Pick<
    MutationCurrentStateTradeTeamIngress | CurrentStateTradeTeam,
    'teamTotalSalary'
  >,
  totals: ArchitectMutationTeamTotals | null | undefined
): number | undefined {
  const explicitTeamTotalSalary = toOptionalNumber(teamRecord.teamTotalSalary);
  if (explicitTeamTotalSalary !== undefined) {
    return explicitTeamTotalSalary;
  }

  // Live trade validation/apply expects the explicit top-level teamTotalSalary
  // bridge. When loaded state omits it, normalize from totals.totalSalary only.
  return toOptionalNumber(totals?.totalSalary);
}

type CurrentStateBaseTeamPreservedField =
  keyof CurrentStateBaseTeamPreservedFieldMap;

export const CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'exceptions',
    'offerSheets',
    'incomingOfferSheets',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
export const CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'roster',
    'offerSheets',
    'incomingOfferSheets',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
export const CURRENT_STATE_SIGNING_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'incomingOfferSheets',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
export const CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'roster',
    'exceptions',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
export const CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'exceptions',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];

type CurrentStateTeamMutationCoreBoundary = Pick<
  MutationCurrentStateTradeTeamIngress | CurrentStateTradeTeam,
  | 'teamCode'
  | 'teamName'
  | 'players'
  | 'capHolds'
  | 'deadCap'
  | 'totals'
  | 'source'
  | 'hardCapped'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
>;
type CurrentStateBaseTeamBoundaryFields = {
  roster?:
    | MutationCurrentStateBaseTeamIngress['roster']
    | CurrentStateBaseTeamPreservedFieldMap['roster'];
  exceptions?:
    | MutationCurrentStateBaseTeamIngress['exceptions']
    | CurrentStateBaseTeamPreservedFieldMap['exceptions'];
  offerSheets?:
    | MutationCurrentStateOfferSheetTeamIngress['offerSheets']
    | CurrentStateBaseTeamPreservedFieldMap['offerSheets'];
  incomingOfferSheets?:
    | MutationCurrentStateOfferSheetTeamIngress['incomingOfferSheets']
    | CurrentStateBaseTeamPreservedFieldMap['incomingOfferSheets'];
  tradeExceptions?:
    | MutationCurrentStateBaseTeamIngress['tradeExceptions']
    | CurrentStateBaseTeamPreservedFieldMap['tradeExceptions'];
  cashLedger?:
    | MutationCurrentStateBaseTeamIngress['cashLedger']
    | CurrentStateBaseTeamPreservedFieldMap['cashLedger'];
  exceptionHistory?:
    | MutationCurrentStateBaseTeamIngress['exceptionHistory']
    | CurrentStateBaseTeamPreservedFieldMap['exceptionHistory'];
  draftPicks?:
    | MutationCurrentStateBaseTeamIngress['draftPicks']
    | CurrentStateBaseTeamPreservedFieldMap['draftPicks'];
  entitlementIds?:
    | MutationCurrentStateBaseTeamIngress['entitlementIds']
    | CurrentStateBaseTeamPreservedFieldMap['entitlementIds'];
};
type CurrentStateBaseTeamBoundarySource = CurrentStateTeamMutationCoreBoundary &
  CurrentStateBaseTeamBoundaryFields &
  CurrentStateBaseTeamPreservedCarrierLike;
type CurrentStateBaseTeamBoundaryInput = CurrentStateTeamMutationCoreBoundary &
  CurrentStateBaseTeamBoundaryFields;
type CurrentStateTradeTeamBoundaryBaseFields = {
  roster?:
    | MutationCurrentStateTradeTeamIngress['roster']
    | CurrentStateTradeTeam['roster'];
  exceptions?:
    | MutationCurrentStateTradeTeamIngress['exceptions']
    | CurrentStateTradeTeam['exceptions'];
  exceptionHistory?:
    | MutationCurrentStateTradeTeamIngress['exceptionHistory']
    | CurrentStateBaseTeamPreservedFieldMap['exceptionHistory'];
};
type CurrentStateTradeTeamBoundaryLiveFields = {
  tradeExceptions?:
    | MutationCurrentStateTradeTeamIngress['tradeExceptions']
    | CurrentStateTradeTeam['tradeExceptions'];
  cashLedger?:
    | MutationCurrentStateTradeTeamIngress['cashLedger']
    | CurrentStateTradeTeam['cashLedger'];
  draftPicks?:
    | MutationCurrentStateTradeTeamIngress['draftPicks']
    | CurrentStateTradeTeam['draftPicks'];
  entitlementIds?:
    | MutationCurrentStateTradeTeamIngress['entitlementIds']
    | CurrentStateTradeTeam['entitlementIds'];
  twoWayPlayers?:
    | MutationCurrentStateTradeTeamIngress['twoWayPlayers']
    | CurrentStateTradeTeam['twoWayPlayers'];
  teamTotalSalary?:
    | MutationCurrentStateTradeTeamIngress['teamTotalSalary']
    | CurrentStateTradeTeam['teamTotalSalary'];
};
type CurrentStateTradeTeamBoundarySource =
  CurrentStateTeamMutationCoreBoundary &
    CurrentStateTradeTeamBoundaryBaseFields &
    CurrentStateTradeTeamBoundaryLiveFields &
    CurrentStateBaseTeamRosterCarrier &
    CurrentStateBaseTeamExceptionsCarrier &
    CurrentStateBaseTeamTradeExceptionsCarrier &
    CurrentStateBaseTeamCashLedgerCarrier &
    CurrentStateBaseTeamExceptionHistoryCarrier &
    CurrentStateBaseTeamDraftPicksCarrier &
    CurrentStateBaseTeamEntitlementIdsCarrier;
type CurrentStateTradeTeamBoundaryInput = CurrentStateTeamMutationCoreBoundary &
  CurrentStateTradeTeamBoundaryBaseFields &
  CurrentStateTradeTeamBoundaryLiveFields;
type NormalizedCurrentStateBaseTeamBoundary = {
  mutationCore: CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap;
  roster?: CurrentStateTeam['roster'];
  exceptions?: CurrentStateTeam['exceptions'];
  offerSheets?: CurrentStateTeam['offerSheets'];
  incomingOfferSheets?: CurrentStateTeam['incomingOfferSheets'];
  preserved: CurrentStateBaseTeamPreservedFieldMap;
};
type NormalizedCurrentStateTradeTeamBoundary = {
  mutationCore: CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap;
  roster?: CurrentStateTeam['roster'];
  exceptions?: CurrentStateTeam['exceptions'];
  preserved: CurrentStateBaseTeamPreservedFieldMap;
  tradeExceptions?: CurrentStateTradeTeam['tradeExceptions'];
  cashLedger?: CurrentStateTradeTeam['cashLedger'];
  draftPicks?: CurrentStateTradeTeam['draftPicks'];
  entitlementIds?: CurrentStateTradeTeam['entitlementIds'];
  twoWayPlayers?: CurrentStateTradeTeam['twoWayPlayers'];
  teamTotalSalary?: CurrentStateTradeTeam['teamTotalSalary'];
};

export function buildCurrentStateBaseTeamBoundaryInput(
  teamRecord: CurrentStateBaseTeamBoundarySource
): CurrentStateBaseTeamBoundaryInput {
  return {
    teamCode: teamRecord.teamCode,
    teamName: teamRecord.teamName,
    players: teamRecord.players,
    roster:
      teamRecord.roster ?? teamRecord[CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY],
    capHolds: teamRecord.capHolds,
    deadCap: teamRecord.deadCap,
    exceptions:
      teamRecord.exceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY],
    offerSheets:
      teamRecord.offerSheets ??
      teamRecord[CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY],
    incomingOfferSheets:
      teamRecord.incomingOfferSheets ??
      teamRecord[CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY],
    tradeExceptions:
      teamRecord.tradeExceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY],
    cashLedger:
      teamRecord.cashLedger ??
      teamRecord[CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY],
    exceptionHistory:
      teamRecord.exceptionHistory ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY],
    totals: teamRecord.totals,
    draftPicks:
      teamRecord.draftPicks ??
      teamRecord[CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY],
    entitlementIds:
      teamRecord.entitlementIds ??
      teamRecord[CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY],
    source: teamRecord.source,
    hardCapped: teamRecord.hardCapped,
    hardCapLevel: teamRecord.hardCapLevel,
    hardCapReason: teamRecord.hardCapReason,
    hardCapTriggeredBy: teamRecord.hardCapTriggeredBy,
  };
}

export function buildCurrentStateTradeTeamBoundaryInput(
  teamRecord: CurrentStateTradeTeamBoundarySource
): CurrentStateTradeTeamBoundaryInput {
  // Chained compute callers can hand a non-trade computed snapshot back into
  // the trade lane. On that path these round-trip fields may live only on the
  // preserved carriers, so materialize them here once instead of widening the
  // trade normalizer itself.
  return {
    teamCode: teamRecord.teamCode,
    teamName: teamRecord.teamName,
    players: teamRecord.players,
    roster:
      teamRecord.roster ?? teamRecord[CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY],
    capHolds: teamRecord.capHolds,
    deadCap: teamRecord.deadCap,
    exceptions:
      teamRecord.exceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY],
    tradeExceptions:
      teamRecord.tradeExceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY],
    cashLedger:
      teamRecord.cashLedger ??
      teamRecord[CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY],
    exceptionHistory:
      teamRecord.exceptionHistory ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY],
    totals: teamRecord.totals,
    source: teamRecord.source,
    hardCapped: teamRecord.hardCapped,
    hardCapLevel: teamRecord.hardCapLevel,
    hardCapReason: teamRecord.hardCapReason,
    hardCapTriggeredBy: teamRecord.hardCapTriggeredBy,
    teamTotalSalary: teamRecord.teamTotalSalary,
    draftPicks:
      teamRecord.draftPicks ??
      teamRecord[CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY],
    entitlementIds:
      teamRecord.entitlementIds ??
      teamRecord[CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY],
    twoWayPlayers: teamRecord.twoWayPlayers,
  };
}

export function normalizeCurrentStateTeamMutationCore(
  teamRecord: CurrentStateTeamMutationCoreBoundary
): CurrentStateTeamIdentityFieldMap & CurrentStateTeamMutationCoreFieldMap {
  const normalized: CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap = {};
  const teamCode = toOptionalTrimmedString(teamRecord.teamCode);
  const teamName = toOptionalTrimmedString(teamRecord.teamName);
  const players = normalizeCurrentStatePlayerArray(teamRecord.players);
  const capHolds = normalizeCurrentStateCapHolds(teamRecord.capHolds);
  const deadCap = normalizeCurrentStateDeadCap(teamRecord.deadCap);
  const totals = normalizeCurrentStateTeamTotals(teamRecord.totals);
  const source = normalizeCurrentStateTeamSource(teamRecord.source);
  const hardCapped = teamRecord.hardCapped;
  const hardCapLevel = toOptionalTrimmedString(teamRecord.hardCapLevel);
  const hardCapReason = toOptionalTrimmedString(teamRecord.hardCapReason);
  const hardCapTriggeredBy = toOptionalTrimmedString(
    teamRecord.hardCapTriggeredBy
  );

  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (teamName !== undefined) {
    normalized.teamName = teamName;
  }
  if (players !== undefined) {
    normalized.players = players;
  }
  if (capHolds !== undefined) {
    normalized.capHolds = capHolds;
  }
  if (deadCap !== undefined) {
    normalized.deadCap = deadCap;
  }
  if (totals !== undefined) {
    normalized.totals = totals;
  }
  if (source !== undefined) {
    normalized.source = source;
  }
  if (
    typeof hardCapped === 'boolean' ||
    (typeof hardCapped === 'number' && Number.isFinite(hardCapped))
  ) {
    normalized.hardCapped = hardCapped;
  }
  if (hardCapLevel !== undefined) {
    normalized.hardCapLevel = hardCapLevel;
  }
  if (hardCapReason !== undefined) {
    normalized.hardCapReason = hardCapReason;
  }
  if (hardCapTriggeredBy !== undefined) {
    normalized.hardCapTriggeredBy = hardCapTriggeredBy;
  }

  return normalized;
}

export function buildCurrentStateBaseTeamPreservedFields(
  teamRecord: CurrentStateBaseTeamBoundaryInput,
  fields: CurrentStateBaseTeamPreservedField[]
): CurrentStateBaseTeamPreservedFieldMap {
  const preserved: CurrentStateBaseTeamPreservedFieldMap = {};

  for (const field of fields) {
    switch (field) {
      case 'roster': {
        const roster = normalizeRosterEntries(teamRecord.roster);
        if (roster !== undefined) {
          preserved.roster = roster;
        }
        break;
      }

      case 'exceptions': {
        const exceptions = normalizeCurrentStateTeamExceptions(
          teamRecord.exceptions
        );
        if (exceptions !== undefined) {
          preserved.exceptions = exceptions;
        }
        break;
      }

      case 'offerSheets': {
        const offerSheets = normalizeCurrentStateOfferSheets(
          teamRecord.offerSheets
        );
        if (offerSheets !== undefined) {
          preserved.offerSheets = offerSheets;
        }
        break;
      }

      case 'incomingOfferSheets': {
        const incomingOfferSheets = normalizeCurrentStateOfferSheets(
          teamRecord.incomingOfferSheets
        );
        if (incomingOfferSheets !== undefined) {
          preserved.incomingOfferSheets = incomingOfferSheets;
        }
        break;
      }

      case 'tradeExceptions': {
        const tradeExceptions = normalizeCurrentStateTradeExceptions(
          teamRecord.tradeExceptions
        );
        if (tradeExceptions !== undefined) {
          preserved.tradeExceptions = tradeExceptions;
        }
        break;
      }

      case 'cashLedger': {
        const cashLedger = normalizeCurrentStateCashLedger(
          teamRecord.cashLedger
        );
        if (cashLedger !== undefined) {
          preserved.cashLedger = cashLedger;
        }
        break;
      }

      case 'exceptionHistory': {
        const exceptionHistory = normalizeCurrentStateExceptionHistory(
          teamRecord.exceptionHistory
        );
        if (exceptionHistory !== undefined) {
          preserved.exceptionHistory = exceptionHistory;
        }
        break;
      }

      case 'draftPicks': {
        const draftPicks = normalizeCurrentStateDraftPicks(
          teamRecord.draftPicks
        );
        if (draftPicks !== undefined) {
          preserved.draftPicks = draftPicks;
        }
        break;
      }

      case 'entitlementIds': {
        const entitlementIds = normalizeStringArray(teamRecord.entitlementIds);
        if (entitlementIds !== undefined) {
          preserved.entitlementIds = entitlementIds;
        }
        break;
      }
    }
  }

  return preserved;
}

export function normalizeCurrentStateBaseTeamBoundary(
  teamRecord: CurrentStateBaseTeamBoundaryInput,
  preservedFields: CurrentStateBaseTeamPreservedField[]
): NormalizedCurrentStateBaseTeamBoundary {
  return {
    mutationCore: normalizeCurrentStateTeamMutationCore(teamRecord),
    roster: normalizeRosterEntries(teamRecord.roster),
    exceptions: normalizeCurrentStateTeamExceptions(teamRecord.exceptions),
    offerSheets: normalizeCurrentStateOfferSheets(teamRecord.offerSheets),
    incomingOfferSheets: normalizeCurrentStateOfferSheets(
      teamRecord.incomingOfferSheets
    ),
    preserved: buildCurrentStateBaseTeamPreservedFields(
      teamRecord,
      preservedFields
    ),
  };
}

export function buildCurrentStateTradeTeamPreservedFields(
  teamRecord: CurrentStateTradeTeamBoundaryInput
): CurrentStateBaseTeamPreservedFieldMap {
  const preserved: CurrentStateBaseTeamPreservedFieldMap = {};
  const exceptionHistory = normalizeCurrentStateExceptionHistory(
    teamRecord.exceptionHistory
  );

  if (exceptionHistory !== undefined) {
    preserved.exceptionHistory = exceptionHistory;
  }

  return preserved;
}

export function normalizeCurrentStateTradeTeamBoundary(
  teamRecord: CurrentStateTradeTeamBoundaryInput
): NormalizedCurrentStateTradeTeamBoundary {
  const mutationCore = normalizeCurrentStateTeamMutationCore(teamRecord);

  return {
    mutationCore,
    roster: normalizeRosterEntries(teamRecord.roster),
    exceptions: normalizeCurrentStateTeamExceptions(teamRecord.exceptions),
    preserved: buildCurrentStateTradeTeamPreservedFields(teamRecord),
    tradeExceptions: normalizeCurrentStateTradeExceptions(
      teamRecord.tradeExceptions
    ),
    cashLedger: normalizeCurrentStateCashLedger(teamRecord.cashLedger),
    draftPicks: normalizeCurrentStateDraftPicks(teamRecord.draftPicks),
    entitlementIds: normalizeStringArray(teamRecord.entitlementIds),
    twoWayPlayers: normalizeCurrentStatePlayerArray(teamRecord.twoWayPlayers),
    teamTotalSalary: resolveCurrentStateTeamTotalSalary(
      teamRecord,
      mutationCore.totals
    ),
  };
}

export function buildCurrentStatePlayerOpsTeam(
  boundary: NormalizedCurrentStateBaseTeamBoundary
): CurrentStatePlayerOpsTeam {
  const normalized: CurrentStatePlayerOpsTeamCompute = {
    ...boundary.mutationCore,
  };
  if (boundary.roster !== undefined) {
    normalized.roster = boundary.roster;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as CurrentStatePlayerOpsTeam;
}

export function buildCurrentStateManualCapTeam(
  boundary: NormalizedCurrentStateBaseTeamBoundary
): CurrentStateManualCapTeam {
  const normalized: CurrentStateManualCapTeamCompute = {
    ...boundary.mutationCore,
  };
  if (boundary.exceptions !== undefined) {
    normalized.exceptions = boundary.exceptions;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as CurrentStateManualCapTeam;
}

export function buildCurrentStateSigningTeam(
  boundary: NormalizedCurrentStateBaseTeamBoundary
): CurrentStateSigningTeam {
  const normalized: CurrentStateSigningTeamCompute = {
    ...boundary.mutationCore,
  };
  if (boundary.roster !== undefined) {
    normalized.roster = boundary.roster;
  }
  if (boundary.exceptions !== undefined) {
    normalized.exceptions = boundary.exceptions;
  }
  if (boundary.offerSheets !== undefined) {
    normalized.offerSheets = boundary.offerSheets;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as CurrentStateSigningTeam;
}

export function buildCurrentStateOfferSheetMirrorTeam(
  boundary: NormalizedCurrentStateBaseTeamBoundary
): CurrentStateOfferSheetMirrorTeam {
  const normalized: CurrentStateOfferSheetMirrorTeamCompute = {
    ...boundary.mutationCore,
  };
  if (boundary.offerSheets !== undefined) {
    normalized.offerSheets = boundary.offerSheets;
  }
  if (boundary.incomingOfferSheets !== undefined) {
    normalized.incomingOfferSheets = boundary.incomingOfferSheets;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as CurrentStateOfferSheetMirrorTeam;
}

export function buildCurrentStateOfferSheetResolutionTeam(
  boundary: NormalizedCurrentStateBaseTeamBoundary
): CurrentStateOfferSheetResolutionTeam {
  const normalized: CurrentStateOfferSheetResolutionTeamCompute = {
    ...boundary.mutationCore,
  };
  if (boundary.roster !== undefined) {
    normalized.roster = boundary.roster;
  }
  if (boundary.offerSheets !== undefined) {
    normalized.offerSheets = boundary.offerSheets;
  }
  if (boundary.incomingOfferSheets !== undefined) {
    normalized.incomingOfferSheets = boundary.incomingOfferSheets;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as CurrentStateOfferSheetResolutionTeam;
}

export function buildCurrentStateTradeTeam(
  boundary: NormalizedCurrentStateTradeTeamBoundary
): TradeTeamLike {
  // Trade validation/apply still needs live access to the TPE/cash/pick/
  // entitlement/two-way/salary bridges. Exception history remains preserve-only
  // and is materialized only when a returned team snapshot needs it.
  const normalized: TradeTeamLike = {
    ...boundary.mutationCore,
  };
  if (boundary.roster !== undefined) {
    normalized.roster = boundary.roster;
  }
  if (boundary.exceptions !== undefined) {
    normalized.exceptions = boundary.exceptions;
  }
  if (boundary.tradeExceptions !== undefined) {
    normalized.tradeExceptions = boundary.tradeExceptions;
  }
  if (boundary.cashLedger !== undefined) {
    normalized.cashLedger = boundary.cashLedger;
  }
  if (boundary.draftPicks !== undefined) {
    normalized.draftPicks = boundary.draftPicks;
  }
  if (boundary.entitlementIds !== undefined) {
    normalized.entitlementIds = boundary.entitlementIds;
  }
  if (boundary.twoWayPlayers !== undefined) {
    normalized.twoWayPlayers = boundary.twoWayPlayers;
  }
  if (boundary.teamTotalSalary !== undefined) {
    normalized.teamTotalSalary = boundary.teamTotalSalary;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    normalized,
    boundary.preserved
  ) as TradeTeamLike;
}

type CurrentStateTeamProjectionLane =
  | 'playerOps'
  | 'manualCap'
  | 'signing'
  | 'offerSheetMirror'
  | 'offerSheetResolution'
  | 'trade';
type CurrentStateTeamIngressByLane = {
  playerOps: MutationCurrentStateBaseTeamIngress | null | undefined;
  manualCap: MutationCurrentStateBaseTeamIngress | null | undefined;
  signing: MutationCurrentStateOfferSheetTeamIngress | null | undefined;
  offerSheetMirror:
    | MutationCurrentStateOfferSheetTeamIngress
    | null
    | undefined;
  offerSheetResolution:
    | MutationCurrentStateOfferSheetTeamIngress
    | null
    | undefined;
  trade: MutationCurrentStateTradeTeamIngress | null | undefined;
};
type CurrentStateTeamBoundaryByLane = {
  playerOps: CurrentStateBaseTeamBoundarySource | null | undefined;
  manualCap: CurrentStateBaseTeamBoundarySource | null | undefined;
  signing: CurrentStateBaseTeamBoundarySource | null | undefined;
  offerSheetMirror: CurrentStateBaseTeamBoundarySource | null | undefined;
  offerSheetResolution: CurrentStateBaseTeamBoundarySource | null | undefined;
  trade: CurrentStateTradeTeamBoundarySource | null | undefined;
};
type CurrentStateTeamIngressArgs = {
  [TLane in CurrentStateTeamProjectionLane]: [
    team: CurrentStateTeamIngressByLane[TLane],
    lane: TLane,
  ];
}[CurrentStateTeamProjectionLane];
type CurrentStateTeamBoundaryArgs = {
  [TLane in CurrentStateTeamProjectionLane]: [
    team: CurrentStateTeamBoundaryByLane[TLane],
    lane: TLane,
  ];
}[CurrentStateTeamProjectionLane];

export function isCurrentStateTeamBoundaryObject<T extends object>(
  team: T | null | undefined
): team is T {
  return Boolean(team && typeof team === 'object' && !Array.isArray(team));
}

export function buildPostComputeTradeBoundaryInput(
  team: ArchitectMutationComputedTeamSnapshot
): CurrentStateTradeTeamBoundaryInput {
  const materializedTeam =
    materializeCurrentStateBaseTeamPreservedFields(team) || team;

  return {
    teamCode: materializedTeam.teamCode,
    teamName: materializedTeam.teamName,
    players: materializedTeam.players,
    roster: materializedTeam.roster,
    capHolds: materializedTeam.capHolds,
    deadCap: materializedTeam.deadCap,
    exceptions: materializedTeam.exceptions,
    tradeExceptions: materializedTeam.tradeExceptions,
    cashLedger: materializedTeam.cashLedger,
    exceptionHistory: materializedTeam.exceptionHistory,
    totals: materializedTeam.totals,
    source: materializedTeam.source,
    hardCapped: materializedTeam.hardCapped,
    hardCapLevel: materializedTeam.hardCapLevel,
    hardCapReason: materializedTeam.hardCapReason,
    hardCapTriggeredBy: materializedTeam.hardCapTriggeredBy,
    teamTotalSalary: materializedTeam.teamTotalSalary,
    draftPicks: materializedTeam.draftPicks,
    entitlementIds: materializedTeam.entitlementIds,
    twoWayPlayers: materializedTeam.twoWayPlayers,
  };
}

export function normalizePostComputeTeamSnapshotForPostState(
  team: ArchitectMutationComputedTeamSnapshot | null | undefined
): TradeTeamLike | null {
  if (!isCurrentStateTeamBoundaryObject(team)) {
    return null;
  }

  return normalizeCurrentStateTeamSnapshot(
    buildPostComputeTradeBoundaryInput(team),
    'trade'
  );
}

// Raw Firestore/team-loader snapshots normalize here before they reach the
// family-specific current-state compatibility layer.
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['playerOps'],
  lane: 'playerOps'
): CurrentStatePlayerOpsTeam | null;
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['manualCap'],
  lane: 'manualCap'
): CurrentStateManualCapTeam | null;
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['signing'],
  lane: 'signing'
): CurrentStateSigningTeam | null;
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['offerSheetMirror'],
  lane: 'offerSheetMirror'
): CurrentStateOfferSheetMirrorTeam | null;
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['offerSheetResolution'],
  lane: 'offerSheetResolution'
): CurrentStateOfferSheetResolutionTeam | null;
export function toCurrentStateTeam(
  team: CurrentStateTeamIngressByLane['trade'],
  lane: 'trade'
): TradeTeamLike | null;
export function toCurrentStateTeam(
  ...[team, lane]: CurrentStateTeamIngressArgs
): CurrentStatePrimaryTeam | null {
  if (!isCurrentStateTeamBoundaryObject(team)) {
    return null;
  }

  switch (lane) {
    case 'playerOps':
      return buildCurrentStatePlayerOpsTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS
        )
      );
    case 'manualCap':
      return buildCurrentStateManualCapTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS
        )
      );
    case 'signing':
      return buildCurrentStateSigningTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_SIGNING_PRESERVED_FIELDS
        )
      );
    case 'offerSheetMirror':
      return buildCurrentStateOfferSheetMirrorTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS
        )
      );
    case 'offerSheetResolution':
      return buildCurrentStateOfferSheetResolutionTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS
        )
      );
    case 'trade':
      return buildCurrentStateTradeTeam(
        normalizeCurrentStateTradeTeamBoundary(
          buildCurrentStateTradeTeamBoundaryInput(team)
        )
      );
  }
}

// Mixed raw/direct-compute team compatibility is tolerated only on the
// current-state ingress/result boundaries, not on the raw loader helper above.
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['playerOps'],
  lane: 'playerOps'
): CurrentStatePlayerOpsTeam | null;
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['manualCap'],
  lane: 'manualCap'
): CurrentStateManualCapTeam | null;
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['signing'],
  lane: 'signing'
): CurrentStateSigningTeam | null;
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['offerSheetMirror'],
  lane: 'offerSheetMirror'
): CurrentStateOfferSheetMirrorTeam | null;
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['offerSheetResolution'],
  lane: 'offerSheetResolution'
): CurrentStateOfferSheetResolutionTeam | null;
export function normalizeCurrentStateTeamSnapshot(
  team: CurrentStateTeamBoundaryByLane['trade'],
  lane: 'trade'
): TradeTeamLike | null;
export function normalizeCurrentStateTeamSnapshot(
  ...[team, lane]: CurrentStateTeamBoundaryArgs
): CurrentStatePrimaryTeam | null {
  if (!isCurrentStateTeamBoundaryObject(team)) {
    return null;
  }

  switch (lane) {
    case 'playerOps':
      return buildCurrentStatePlayerOpsTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS
        )
      );
    case 'manualCap':
      return buildCurrentStateManualCapTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS
        )
      );
    case 'signing':
      return buildCurrentStateSigningTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_SIGNING_PRESERVED_FIELDS
        )
      );
    case 'offerSheetMirror':
      return buildCurrentStateOfferSheetMirrorTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS
        )
      );
    case 'offerSheetResolution':
      return buildCurrentStateOfferSheetResolutionTeam(
        normalizeCurrentStateBaseTeamBoundary(
          buildCurrentStateBaseTeamBoundaryInput(team),
          CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS
        )
      );
    case 'trade':
      return buildCurrentStateTradeTeam(
        normalizeCurrentStateTradeTeamBoundary(
          buildCurrentStateTradeTeamBoundaryInput(team)
        )
      );
  }
}


export function normalizeTradeMutationCurrentStateTeamEntry(
  entry:
    | MutationCurrentStateTradeTeamEntryInput
    | MutationCurrentStateTeamEntry
    | null
    | undefined
): MutationCurrentStateTeamEntry {
  const team = normalizeCurrentStateTeamSnapshot(entry?.team, 'trade');
  const normalized: MutationCurrentStateTeamEntry = {};
  const teamCode = toOptionalTrimmedString(entry?.teamCode) ?? team?.teamCode;

  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (team) {
    normalized.team = team;
  }

  return normalized;
}

export function normalizeTradeMutationCurrentState(
  currentState: MutationTradeCurrentStateInput | null | undefined
): MutationTradeCurrentState {
  const teams = Array.isArray(currentState?.teams)
    ? currentState.teams.map((entry) =>
        normalizeTradeMutationCurrentStateTeamEntry(entry)
      )
    : undefined;

  return teams !== undefined ? { teams } : {};
}

export function normalizeTeamOnlyMutationCurrentState(
  currentState: MutationTeamOnlyCurrentStateInput | null | undefined
): MutationTeamOnlyCurrentState {
  const normalized: MutationTeamOnlyCurrentState = {};
  const team = normalizeCurrentStateTeamSnapshot(
    currentState?.team,
    'manualCap'
  );
  const teamCode = toOptionalTrimmedString(currentState?.teamCode);

  if (team) {
    normalized.team = team;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }

  return normalized;
}

export function normalizeTeamAndPlayerMutationCurrentState(
  currentState: MutationTeamAndPlayerCurrentStateInput | null | undefined
): MutationTeamAndPlayerCurrentState {
  const normalized: MutationTeamAndPlayerCurrentState = {};
  const team = normalizeCurrentStateTeamSnapshot(
    currentState?.team,
    'playerOps'
  );
  const player = normalizeCurrentStatePlayerSnapshot(currentState?.player);
  const teamCode = toOptionalTrimmedString(currentState?.teamCode);

  if (team) {
    normalized.team = team;
  }
  if (player) {
    normalized.player = player;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }

  return normalized;
}

export function normalizeOfferSheetTeamAndPlayerMutationCurrentState(
  currentState:
    | MutationOfferSheetTeamAndPlayerCurrentStateInput
    | null
    | undefined
): MutationOfferSheetTeamAndPlayerCurrentState {
  const normalized: MutationOfferSheetTeamAndPlayerCurrentState = {};
  const team = normalizeCurrentStateTeamSnapshot(currentState?.team, 'signing');
  const player = normalizeCurrentStatePlayerSnapshot(currentState?.player);
  const homeTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.homeTeam,
    'offerSheetMirror'
  );
  const teamCode = toOptionalTrimmedString(currentState?.teamCode);

  if (team) {
    normalized.team = team;
  }
  if (player) {
    normalized.player = player;
  }
  if (homeTeam) {
    normalized.homeTeam = homeTeam;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }

  return normalized;
}

export function normalizeOfferSheetMirrorMutationCurrentState(
  currentState: MutationOfferSheetMirrorCurrentStateInput | null | undefined
): MutationOfferSheetMirrorCurrentState {
  const normalized: MutationOfferSheetMirrorCurrentState = {};
  const homeTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.homeTeam,
    'offerSheetMirror'
  );
  const offeringTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.offeringTeam,
    'offerSheetMirror'
  );
  const offerSheetId = toOptionalTrimmedString(currentState?.offerSheetId);

  if (homeTeam) {
    normalized.homeTeam = homeTeam;
  }
  if (offeringTeam) {
    normalized.offeringTeam = offeringTeam;
  }
  if (offerSheetId !== undefined) {
    normalized.offerSheetId = offerSheetId;
  }

  return normalized;
}

export function normalizeOfferSheetResolutionMutationCurrentState(
  currentState: MutationOfferSheetResolutionCurrentStateInput | null | undefined
): MutationOfferSheetResolutionCurrentState {
  const normalized: MutationOfferSheetResolutionCurrentState = {};
  const homeTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.homeTeam,
    'offerSheetResolution'
  );
  const offeringTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.offeringTeam,
    'offerSheetResolution'
  );
  const offerSheetId = toOptionalTrimmedString(currentState?.offerSheetId);

  if (homeTeam) {
    normalized.homeTeam = homeTeam;
  }
  if (offeringTeam) {
    normalized.offeringTeam = offeringTeam;
  }
  if (offerSheetId !== undefined) {
    normalized.offerSheetId = offerSheetId;
  }

  return normalized;
}

export function normalizeSignAndTradeMutationCurrentState(
  currentState: MutationSignAndTradeCurrentStateInput | null | undefined
): MutationSignAndTradeCurrentState {
  const normalized: MutationSignAndTradeCurrentState = {};
  const team = normalizeCurrentStateTeamSnapshot(currentState?.team, 'trade');
  const player = normalizeCurrentStatePlayerSnapshot(currentState?.player);
  const destinationTeam = normalizeCurrentStateTeamSnapshot(
    currentState?.destinationTeam,
    'trade'
  );
  const teamCode = toOptionalTrimmedString(currentState?.teamCode);

  if (team) {
    normalized.team = team;
  }
  if (player) {
    normalized.player = player;
  }
  if (destinationTeam) {
    normalized.destinationTeam = destinationTeam;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }

  return normalized;
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


