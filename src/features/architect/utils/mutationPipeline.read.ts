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
  materializeCurrentStateTeamForAudit,
} from './mutationPipeline.read.normalizeTeam';
// Wave 5 Step 3: persistence/dashboard/audit helpers extracted to submodule
export * from './mutationPipeline.read.persistence';
import {
  FREE_AGENCY_MUTATION_TYPES,
  buildCapAuditDiffSummary,
  buildComputeWritesSummary,
  buildGeneralMutationCommittedTeamSnapshot,
  buildGeneralMutationCommittedTeamUpdates,
  buildMutationFailureResult,
  buildPostStateRulesContext,
  buildTotalsByTeam,
  buildWorldMutationEventPayload,
  canonicalizeComputeResultTeamUpdates,
  canonicalizeTeamUpdatesWithCanonicalTotals,
  collectMutationPlayerIds,
  collectPlayerTouchIds,
  deriveEventPlayerIds,
  deriveEventTeamCodes,
  addTeamSnapshot,
  extractTeamsByCodeFromComputeResult,
  prepareGeneralMutationPersistenceTeamSnapshot,
} from './mutationPipeline.read.persistence';



// Wave 5 Step 4: state-loading entry point extracted to submodule
export * from './mutationPipeline.read.stateLoader';
import {
  loadStateForMutation,
  withDefaultPlayerDeletes,
  matchesOfferSheetIdentity,
  removeOfferSheetEntries,
  buildNormalizedOfferSheetFinalContract,
  resolveStoreOfferSheetAuthority,
} from './mutationPipeline.read.stateLoader';

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









