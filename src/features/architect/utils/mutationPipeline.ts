/**
 * FILE: src/features/architect/utils/mutationPipeline.ts
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * ARCHITECT OWNERSHIP:
 * - Canonical committed-write authority for general world mutations.
 * - Sibling committed-write authority to seasonManager.ts for point-in-time world mutations.
 * - Public mutation entrypoint: READ -> COMPUTE -> VALIDATE -> PERSIST.
 * - Returns changedTeams as the preferred direct post-commit team snapshot when available.
 * - UI/hooks must route general committed mutation writes here.
 * - Uses shared lower-level persistence hygiene from persistenceContracts/enforcement.ts.
 * - Season advancement remains a separate committed authority in seasonManager.ts.
 *
 * HISTORY:
 *  - 2025-12-17: Created per docs/architect/ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
 *  - 2025-12-25: Removed legacy teamPlans reference (worlds-only cleanup)
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold amounts
 *  - 2026-01-18: Phase 7.3 option state invariant validation wiring
 *  - 2026-01-30: Phase 58 - Extracted trade context helpers to tradeContext module
 *  - 2026-01-30: Phase 59 - Removed validateTradeForPipeline, moved validateTradeForContext to legacy namespace
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Trade Context Module: src/features/architect/utils/tradeContext/
 *  - Latest Chunk: n/a (no chunks used)
 *
 * DESIGN CONSTRAINTS (NON-NEGOTIABLE):
 * 1) All Firestore writes MUST occur in one place (persistWorldMutation)
 * 2) All mutation computation MUST be pure (no Firestore, no React state)
 * 3) UI components and hooks MUST NOT write to Firestore directly
 * 4) World context (worldId) MUST be respected for all reads and writes
 * 5) The pipeline must be movable into Cloud Functions later with minimal rewrite
 * 6) Trade validation follows the staged chain:
 *    buildTradeApplyPreparation → validateTradeExecutionAuthority →
 *    persistWorldMutation (Phase 56/58, TM-3B/TM-5D)
 *
 * MUTATION TYPES SUPPORTED:
 * - executeTrade
 * - signFreeAgent
 * - waivePlayer
 * - extendPlayer
 * - optionDecision
 * - renounceRights
 */

import { db } from '@/firebaseConfig';
import { getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  getTeam,
  getPlayer,
} from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  updateWorldStats,
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
import { collection, doc } from 'firebase/firestore';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
// Cap legality validators for non-trade mutations (Phase 5 Production Hardening)
import {
  validateSigning,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
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

// Phase 72: SSOT for team cap totals computation
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  synchronizeTeamTotalsSnapshot,
  type ComputedTeamCapTotals,
  type LoadedTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';

// Phase 61: Persistence contract enforcement (allowlist-based)
// Phase 64: Added normalizeTeamTpeSchema for TPE canonicalization
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';
import {
  FORBIDDEN_TRANSIENT_KEYS,
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/persistenceContracts/enforcement';

// Phase 86: League-wide invariant validation (cross-team duplicate player prevention)
// Phase B5: Entitlement invariant validation (cross-team duplicate entitlement prevention)
import {
  validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants,
} from '@/features/architect/utils/leagueInvariants';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
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

// ==============================================================================
// PHASE 58: TRADE CONTEXT MODULE RE-EXPORTS
// ==============================================================================
// Phase 58 extracted snapshot/validation context helpers to dedicated module.
// These re-exports maintain backward compatibility for existing imports.
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  assertTradeComputeInputs,
} from '@/features/architect/utils/tradeContext';
// TM-3A/TM-3C: Direct import to avoid circular dependency through barrel.
// tradeExecutionAuthority imports from mutationPipeline, so routing through
// tradeContext/index.ts would create a circular initialization path.
import {
  evaluateTradeSnapshotValidationStage,
  validateTradeExecutionAuthority,
} from '@/features/architect/utils/tradeContext/tradeExecutionAuthority';
import {
  buildSignAndTradeTradeHandoff,
  buildTradeApplyPreparation,
  normalizeTradeContextPayload,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';

// Wave 4 Step 4a.5: shared helpers submodule (cross-phase utilities used by both READ and COMPUTE)
export * from './mutationPipeline.helpers';
// Wave 4 Step 4c
export * from './mutationPipeline.read';
// Wave 4 Step 4d
export * from './mutationPipeline.compute';


// Wave 7 Step 1: type definitions extracted to submodule
export * from './mutationPipeline.types';
import type {
  ApplyWorldMutationArgs,
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectMutationBridgeResult,
  ArchitectMutationContract,
  ArchitectMutationPayload,
  ArchitectMutationResult,
  ArchitectWorldMutationPatch,
  AuditContextLike,
  ComputeResultLike,
  ComputeWorldMutationArgs,
  MutationAuditContext,
  MutationCurrentState,
  MutationCurrentStateInputByType,
  MutationEventMetadataLike,
  MutationEventSourceResult,
  MutationPayloadInputByType,
  MutationPayloadLike,
  MutationResultIssueLike,
  MutationTeamMap,
  OfferSheetPreflightResult,
  PersistWorldMutationResult,
  PlayerLike,
  PostStateTotalsByTeam,
  PublicComputeWorldMutationArgs,
  PublicMutationPayloadInputByType,
  SignAndTradePreflightResult,
  SignAndTradePreflightStatus,
  SupportedComputeMutationType,
  TeamLike,
} from './mutationPipeline.types';

const SUPPORTED_COMPUTE_MUTATION_TYPES = [
  'executeTrade',
  'signFreeAgent',
  'waivePlayer',
  'extendPlayer',
  'optionDecision',
  'renounceRights',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'signAndTrade',
  'setDeadCap',
  'setExceptions',
] as const satisfies readonly SupportedComputeMutationType[];
const SUPPORTED_COMPUTE_MUTATION_TYPE_SET =
  new Set<SupportedComputeMutationType>(SUPPORTED_COMPUTE_MUTATION_TYPES);

function isSupportedComputeMutationType(
  mutationType: string
): mutationType is SupportedComputeMutationType {
  return SUPPORTED_COMPUTE_MUTATION_TYPE_SET.has(
    mutationType as SupportedComputeMutationType
  );
}

const TRADE_MUTATION_PAYLOAD_KEYS = [
  'teams',
  'capProjections',
  'tradeCtx',
  'asOfDate',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SIGNING_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'contract',
  'signedUsing',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const WAIVE_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'stretch',
  'stretchYears',
  'buyout',
  'buyoutAmount',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const EXTENSION_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'extension',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const OPTION_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'accepted',
  'targetYear',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const RENOUNCE_MUTATION_PAYLOAD_KEYS = [
  'playerId',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const STORE_OFFER_SHEET_MUTATION_PAYLOAD_KEYS = [
  'contract',
  'offerSheetId',
  'worldId',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const OFFER_SHEET_MIRROR_MUTATION_PAYLOAD_KEYS =
  [] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const OFFER_SHEET_RESOLUTION_MUTATION_PAYLOAD_KEYS = [
  'dedupKey',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SIGN_AND_TRADE_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'destinationTeamCode',
  'playerId',
  'contract',
  'signedUsing',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SET_DEAD_CAP_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'deadCap',
  'deadCapChanges',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SET_EXCEPTIONS_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'exceptions',
  'exceptionChanges',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];

function pickMutationPayloadFields<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
>(
  payload: ArchitectMutationPayload,
  keys: readonly TMutationPayloadKey[]
): Pick<ArchitectMutationPayload, TMutationPayloadKey> {
  return Object.fromEntries(
    keys
      .filter((key) => payload[key] !== undefined)
      .map((key) => [key, payload[key]])
  ) as Pick<ArchitectMutationPayload, TMutationPayloadKey>;
}

function normalizeComputeWorldMutationPayload<
  TMutationType extends SupportedComputeMutationType,
>(
  mutationType: TMutationType,
  payload:
    | PublicMutationPayloadInputByType[TMutationType]
    | ArchitectMutationPayload
): MutationPayloadInputByType[TMutationType] {
  const publicPayload = payload as ArchitectMutationPayload;

  switch (mutationType) {
    case 'executeTrade':
      return toTradePayload(
        pickMutationPayloadFields(publicPayload, TRADE_MUTATION_PAYLOAD_KEYS)
      ) as MutationPayloadInputByType[TMutationType];

    case 'signFreeAgent':
      return pickMutationPayloadFields(
        publicPayload,
        SIGNING_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'waivePlayer':
      return pickMutationPayloadFields(
        publicPayload,
        WAIVE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'extendPlayer':
      return pickMutationPayloadFields(
        publicPayload,
        EXTENSION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'optionDecision':
      return pickMutationPayloadFields(
        publicPayload,
        OPTION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'renounceRights':
      return pickMutationPayloadFields(
        publicPayload,
        RENOUNCE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'storeOfferSheet':
      return pickMutationPayloadFields(
        publicPayload,
        STORE_OFFER_SHEET_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'matchOfferSheet':
    case 'declineOfferSheet':
      return pickMutationPayloadFields(
        publicPayload,
        OFFER_SHEET_MIRROR_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
      return pickMutationPayloadFields(
        publicPayload,
        OFFER_SHEET_RESOLUTION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'signAndTrade':
      return pickMutationPayloadFields(
        publicPayload,
        SIGN_AND_TRADE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'setDeadCap':
      return pickMutationPayloadFields(
        publicPayload,
        SET_DEAD_CAP_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'setExceptions':
      return pickMutationPayloadFields(
        publicPayload,
        SET_EXCEPTIONS_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];
  }
}

function normalizeComputeWorldMutationArgs(
  args: PublicComputeWorldMutationArgs
): ComputeWorldMutationArgs {
  switch (args.mutationType) {
    case 'executeTrade':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTradeMutationCurrentState(args.currentState),
      };

    case 'signFreeAgent':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'storeOfferSheet':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'waivePlayer':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'extendPlayer':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'optionDecision':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'renounceRights':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'matchOfferSheet':
    case 'declineOfferSheet':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetMirrorMutationCurrentState(
          args.currentState
        ),
      };

    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetResolutionMutationCurrentState(
          args.currentState
        ),
      };

    case 'signAndTrade':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeSignAndTradeMutationCurrentState(
          args.currentState
        ),
      };

    case 'setDeadCap':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamOnlyMutationCurrentState(args.currentState),
      };

    case 'setExceptions':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamOnlyMutationCurrentState(args.currentState),
      };
  }
}

function computeTypedWorldMutation<
  TMutationType extends SupportedComputeMutationType,
>({
  mutationType,
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
}: {
  mutationType: TMutationType;
  payload:
    | PublicMutationPayloadInputByType[TMutationType]
    | ArchitectMutationPayload;
  currentState: MutationCurrentStateInputByType[TMutationType];
  seasonId: string;
  timestamp: number;
  asOfDate?: string | number | null;
  worldId?: string;
}): ComputeResultLike {
  return computeNormalizedWorldMutation({
    mutationType,
    payload: normalizeComputeWorldMutationPayload(mutationType, payload),
    currentState,
    seasonId,
    timestamp,
    asOfDate,
    worldId,
  } as ComputeWorldMutationArgs);
}

export type BuildWorldMutationEventPayloadArgs = {
  mutationType: string;
  eventId: string;
  seasonId: string;
  worldId: string;
  timestamp: number;
  computeResult: MutationEventSourceResult;
  auditContext?: MutationAuditContext;
};

/** Shared base parameter type for all compute*Result functions */
type ComputeMutationParams<TPayload, TCurrentState> = {
  payload: TPayload;
  currentState: TCurrentState;
  seasonId: string;
  timestamp: number;
};
export type ComputeMutationParamsWithCurrentState<TCurrentState, TPayload> =
  ComputeMutationParams<TPayload, TCurrentState>;

export type SignAndTradeAuthoritySummary = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  error: string | null;
  violations: string[];
  warningIssues: unknown[];
};

export const AUTHORITATIVE_WORLD_TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
] as const;

export type StoreOfferSheetOwnershipCandidate = {
  teamCode: string;
  snapshotWorldId: string;
  team: TeamLike;
  rosterMatch: boolean | null;
  playersMatch: boolean | null;
  snapshotPlayer: PlayerLike | null;
};

// Re-export for backward compatibility
export { buildPostTradeTeamsSnapshot, validatePostTradeSnapshotForContext };

// Phase 59: Legacy helpers moved to tradeContext/legacy/ namespace
// Import from '@/features/architect/utils/tradeContext/legacy' for deprecated validateTradeForContext

// ==============================================================================
// PHASE 58: LEGACY FUNCTION MARKER (kept for reference, replaced by tradeContext module)
// ==============================================================================
// The following comment block shows what was removed in Phase 58:
// - buildPostTradeTeamsSnapshot(): Moved to tradeContext/tradeContext.ts
// - validatePostTradeSnapshotForContext(): Moved to tradeContext/tradeContext.ts
// - validateTradeForContext(): Moved to tradeContext/legacy/ (deprecated wrapper)

// Wave 4 Step 4c: explicit value imports from read.ts and helpers.ts
// (export * only re-exports; the orchestrator also needs to USE these locally)
import {
  buildMutationFailureResult,
  sanitizePayloadForOverride,
  generateOperationId,
  loadStateForMutation,
  loadWorldAsOfDate,
  extractTeamsByCodeFromCurrentState,
  buildComputeWritesSummary,
  buildGeneralMutationCommittedTeamUpdates,
  canonicalizeComputeResultTeamUpdates,
  collectMutationPlayerIds,
  buildCapAuditDiffSummary,
  FREE_AGENCY_MUTATION_TYPES,
  CAP_AUDIT_EVENT_SCHEMA_VERSION,
  AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
  toTradePayload,
  normalizeTradeMutationCurrentState,
  normalizeTeamOnlyMutationCurrentState,
  normalizeTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetMirrorMutationCurrentState,
  normalizeOfferSheetResolutionMutationCurrentState,
  normalizeSignAndTradeMutationCurrentState,
  dedupeMessages,
  validateSignAndTradeSigningPhase,
  summarizeSignAndTradeAuthority,
  guardAgainstUndefined,
  getErrorMessage,
  matchesOfferSheetIdentity,
  removeOfferSheetEntries,
  buildNormalizedOfferSheetFinalContract,
  withDefaultPlayerDeletes,
  resolveWorldAsOfDate,
  extractTeamsByCodeFromComputeResult,
  buildTotalsByTeam,
  buildPostStateRulesContext,
  buildWorldMutationEventPayload,
} from './mutationPipeline.read';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
import {
  computeTradeResult,
  computeSigningResult,
  computeWaiveResult,
  computeExtensionResult,
  computeOptionResult,
  computeRenounceResult,
  computeSetExceptionsResult,
  computeStoreOfferSheetResult,
  computeMatchOfferSheetResult,
  computeDeclineOfferSheetResult,
  computeFinalizeMatchedOfferSheetResult,
  computeFinalizeDeclinedOfferSheetResult,
  computeSignAndTradeResult,
  computeSetDeadCapResult,
  getMutationActionType,
} from './mutationPipeline.compute';
import {
  cloneWritesSummary,
  getMutationPlayerId,
  getMutationRosterEntryId,
  getSalaryRowEndYear,
  getTeamSourceRecord,
  materializeCurrentStateBaseTeamPreservedFields,
  normalizeMutationExceptionsFromIngress,
  removeUndefinedDeep,
  requireBasicTeamAndPlayerState,
  requireBasicTeamState,
  requireDestinationState,
  requireOfferSheetTeamState,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toMutationExceptionPreserveOnlyBuckets,
  toOptionalNumber,
  toOptionalTrimmedString,
  toPersistablePlayerOverrideFromSnapshot,
  toTradeStateSlice,
  buildCanonicalPlayerPersistenceManifest,
  buildTradePlayerPersistenceManifest,
  findPlayerInTeamPlayers,
} from './mutationPipeline.helpers';

export async function applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType,
  payload,
  timestamp = Date.now(),
  operationId: operationIdOverride,
}: ApplyWorldMutationArgs): Promise<ArchitectMutationResult> {
  // Input validation
  if (!userId) {
    return buildMutationFailureResult('userId is required');
  }
  if (!worldId) {
    return buildMutationFailureResult('worldId is required');
  }
  if (!seasonId) {
    return buildMutationFailureResult('seasonId is required');
  }
  if (!mutationType) {
    return buildMutationFailureResult('mutationType is required');
  }
  if (!payload) {
    return buildMutationFailureResult('payload is required');
  }
  if (!isSupportedComputeMutationType(mutationType)) {
    return buildMutationFailureResult(
      `Unknown mutation type: ${String(mutationType)}`
    );
  }

  // SECURITY: Strip override metadata if override is disabled
  // This prevents clients from bypassing validation by sending overrideMetadata
  const sanitizedPayload = sanitizePayloadForOverride(
    payload
  ) as MutationPayloadLike;
  const operationId =
    typeof operationIdOverride === 'string' && operationIdOverride.trim()
      ? operationIdOverride
      : generateOperationId(timestamp);

  try {
    // PHASE 1: READ - Load required current state
    const currentState = await loadStateForMutation(
      worldId,
      mutationType,
      sanitizedPayload
    );
    const beforeTeamsByCode = extractTeamsByCodeFromCurrentState(currentState);

    // Phase 20: Load world metadata asOfDate for SSOT resolution
    const worldAsOfDate = await loadWorldAsOfDate(worldId);

    // Phase 20: Resolve canonical asOfDate SSOT
    const { asOfDate, defaulted: dateDefaulted } = resolveWorldAsOfDate({
      payloadAsOfDate:
        sanitizedPayload.asOfDate != null
          ? String(sanitizedPayload.asOfDate)
          : null,
      worldAsOfDate,
    });

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult: ComputeResultLike = computeTypedWorldMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate, // Phase 20: World time SSOT
      worldId,
    });

    if (!computeResult.success) {
      return buildMutationFailureResult(computeResult.error);
    }

    const computeWritesSummary = cloneWritesSummary(
      buildComputeWritesSummary(computeResult)
    );
    const appliedToLocalState =
      computeWritesSummary.teamsPatched > 0 ||
      computeWritesSummary.playersPatched > 0 ||
      computeWritesSummary.entitlementsPatched > 0;

    if (FREE_AGENCY_MUTATION_TYPES.has(mutationType) && !appliedToLocalState) {
      return buildMutationFailureResult(
        `${mutationType} produced no state delta and was fail-closed before persistence.`,
        {
          appliedToLocalState: false,
          persistedToWorld: false,
          writesSummary: computeWritesSummary,
        }
      );
    }

    // PHASE 3: VALIDATE - Ensure mutation is legal
    // TM-3A: Trade mutations use the explicit execution authority surface.
    // Non-trade mutations continue with the existing inline validation chain.
    let afterTeamsByCode: MutationTeamMap;
    let beforeTotalsByTeam: PostStateTotalsByTeam;
    let afterTotalsByTeam: PostStateTotalsByTeam;
    let combinedWarnings: MutationResultIssueLike[];
    let postStateValidation: {
      valid: boolean;
      violations: unknown[];
      warnings: unknown[];
    };

    if (mutationType === 'executeTrade') {
      // TM-3A: Trade Execution Authority — all 5 apply-time legality gates
      // composed in one discoverable surface (tradeContext/tradeExecutionAuthority.ts).
      // TM-5D: The staged trade chain remains intentional and should not be
      // collapsed: prepared context -> execution authority -> persist boundary.
      const tradeExecutionAuthorityResult =
        await validateTradeExecutionAuthority({
          worldId,
          operationId,
          mutationType,
          payload: sanitizedPayload,
          computeResult,
          validatedTradeContext:
            computeResult._validatedTradeContext as TradeContextValidatedTradeContext,
          seasonId,
          asOfDate,
          dateDefaulted,
          timestamp,
          beforeTeamsByCode,
        });

      if (!tradeExecutionAuthorityResult.valid) {
        return buildMutationFailureResult(
          tradeExecutionAuthorityResult.error ||
            'Trade execution authority validation failed',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: tradeExecutionAuthorityResult.violations,
            warnings: tradeExecutionAuthorityResult.warnings,
          }
        );
      }

      // TM-3E: Trade legality is complete above. Everything below this point
      // is persist/audit handoff into persistWorldMutation().
      afterTeamsByCode =
        tradeExecutionAuthorityResult.auditArtifacts.afterTeamsByCode;
      beforeTotalsByTeam =
        tradeExecutionAuthorityResult.auditArtifacts.beforeTotalsByTeam;
      afterTotalsByTeam =
        tradeExecutionAuthorityResult.auditArtifacts.afterTotalsByTeam;
      combinedWarnings = tradeExecutionAuthorityResult.warnings;
      postStateValidation = {
        valid: tradeExecutionAuthorityResult.auditArtifacts.postStateValid,
        violations:
          tradeExecutionAuthorityResult.auditArtifacts.postStateViolations,
        warnings:
          tradeExecutionAuthorityResult.auditArtifacts.postStateWarnings,
      };
    } else {
      // Non-trade orchestration stays here:
      // validation stage -> league invariants -> entitlement invariants ->
      // exclusivity -> post-state cap validator -> persistence.
      // Mutation-specific validation-stage adaptation now lives in
      // validateNonTradeMutationStage().
      const validationResult = validateMutation({
        mutationType,
        payload: sanitizedPayload,
        currentState,
        computeResult,
        seasonId,
        asOfDate,
        dateDefaulted,
      });

      if (!validationResult.valid) {
        return buildMutationFailureResult(
          validationResult.error || 'Validation failed',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: validationResult.violations,
            warnings: (validationResult.warnings ||
              []) as MutationResultIssueLike[],
          }
        );
      }

      // PHASE 3.5: LEAGUE INVARIANTS - Validate no cross-team duplicates
      const leagueInvariantResult = await validateMutationLeagueInvariants(
        worldId,
        mutationType,
        sanitizedPayload,
        computeResult
      );

      if (!leagueInvariantResult.valid) {
        return buildMutationFailureResult(
          leagueInvariantResult.error || 'League invariant violation',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: leagueInvariantResult.duplicates
              ? [
                  {
                    rule: 'LEAGUE_DUPLICATE_PLAYER',
                    details: leagueInvariantResult.duplicates,
                  },
                ]
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.6: ENTITLEMENT INVARIANTS - Validate no cross-team duplicate entitlements
      const entitlementInvariantResult =
        await validateMutationEntitlementInvariants(
          worldId,
          mutationType,
          computeResult
        );

      if (!entitlementInvariantResult.valid) {
        return buildMutationFailureResult(
          entitlementInvariantResult.error || 'Entitlement invariant violation',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: entitlementInvariantResult.duplicates
              ? [
                  {
                    rule: 'LEAGUE_DUPLICATE_ENTITLEMENT',
                    details: entitlementInvariantResult.duplicates,
                  },
                ]
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.7: PER-TEAM ENTITLEMENT EXCLUSIVITY (TM-EXCL-E3)
      const { validateTradeApplyExclusivity } = await import(
        './leagueInvariants'
      );
      const exclusivityResult = await validateTradeApplyExclusivity(
        worldId,
        mutationType,
        computeResult
      );

      if (!exclusivityResult.valid) {
        return buildMutationFailureResult(
          exclusivityResult.error ||
            'Trade would create exclusivity-violating entitlement set',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: exclusivityResult.teamViolations
              ? exclusivityResult.teamViolations.map((tv) => ({
                  rule: 'ENTITLEMENT_EXCLUSIVITY_VIOLATION',
                  details: tv,
                }))
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.8: SHARED POST-STATE FINAL-ARTIFACT GATE
      // This shared validator runs after compute has produced authoritative
      // final artifacts and before persistence begins.
      // The mutation-stage validators above remain required, but they are not
      // substitutes for final-state artifact validation.
      const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
      afterTeamsByCode = extractTeamsByCodeFromComputeResult(computeResult);
      beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
      afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);

      if (Object.keys(afterTotalsByTeam).length === 0) {
        return buildMutationFailureResult(
          'Post-state validator requires afterTotalsByTeam for at least one affected team',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: [
              {
                rule: 'POST_STATE_TOTALS_UNAVAILABLE',
                message:
                  'Unable to build afterTotalsByTeam from computeResult.teamUpdates',
                severity: 'error',
              },
            ],
            warnings: (validationResult.warnings ||
              []) as MutationResultIssueLike[],
          }
        );
      }

      const rulesContext = buildPostStateRulesContext(year);
      postStateValidation = validatePostStateCapLegality({
        operationId,
        mutationType,
        worldId,
        year,
        beforeTeamsByCode,
        afterTeamsByCode,
        beforeTotalsByTeam,
        afterTotalsByTeam,
        rulesContext,
      });

      combinedWarnings = [
        ...((validationResult.warnings || []) as MutationResultIssueLike[]),
        ...((postStateValidation.warnings || []) as MutationResultIssueLike[]),
      ];

      if (!postStateValidation.valid) {
        return buildMutationFailureResult('Post-state cap validation failed', {
          appliedToLocalState: false,
          persistedToWorld: false,
          writesSummary: computeWritesSummary,
          violations:
            postStateValidation.violations as MutationResultIssueLike[],
          warnings: combinedWarnings,
        });
      }
    }

    const teamUpdates = computeResult.teamUpdates || [];
    const committedTeamUpdates = buildGeneralMutationCommittedTeamUpdates(
      teamUpdates,
      seasonId
    );
    const playerUpdates = computeResult.playerUpdates || [];
    const teamCodes = committedTeamUpdates
      .map((u) => String(u.teamCode || ''))
      .filter(Boolean);
    const playerIds = collectMutationPlayerIds(sanitizedPayload, computeResult);
    const diffSummary = buildCapAuditDiffSummary({
      beforeTeamsByCode,
      afterTeamsByCode,
    });

    // PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
    // DEV DEBUG: Check for UID mismatch which causes PERMISSION_DENIED
    if (import.meta.env.DEV) {
      try {
        const worldRef = worldMetadataRef(worldId);
        const { getDoc } = await import('firebase/firestore');
        const worldSnap = await getDoc(worldRef);
        if (worldSnap.exists()) {
          const worldData = worldSnap.data();
          const worldOwner = worldData.createdBy;
          if (worldOwner !== userId) {
            console.error(
              `🚨 UID MISMATCH: World createdBy=${worldOwner} but current userId=${userId}\n` +
                `This causes PERMISSION_DENIED. Fix: In Emulator UI, update createdBy to ${userId}`
            );
          }
        }
      } catch (e) {
        console.warn(
          'DEV DEBUG: Could not check world ownership:',
          getErrorMessage(e)
        );
      }
    }

    const persistResult: PersistWorldMutationResult =
      await persistWorldMutation({
        worldId,
        seasonId,
        mutationType,
        computeResult,
        committedTeamUpdates,
        timestamp,
        payloadAsOfDate:
          sanitizedPayload.asOfDate != null
            ? String(sanitizedPayload.asOfDate)
            : null, // Phase 20: Only persist if explicitly provided
        auditContext: {
          operationId,
          validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
          schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
          mutationCategory: getMutationActionType(mutationType),
          teamCodes,
          playerIds: playerIds as string[],
          beforeTotalsByTeam,
          afterTotalsByTeam,
          valid: postStateValidation.valid,
          violations: (postStateValidation.violations || []).map((v) =>
            typeof v === 'string' ? v : JSON.stringify(v)
          ),
          warnings: (postStateValidation.warnings || []).map((w) =>
            typeof w === 'string' ? w : JSON.stringify(w)
          ),
          diffSummary,
        },
      });

    if (!persistResult.success) {
      return buildMutationFailureResult(persistResult.error, {
        appliedToLocalState,
        persistedToWorld: false,
        eventWritten: false,
        writesSummary: persistResult.writesSummary || computeWritesSummary,
      });
    }

    const writesSummary = {
      ...cloneWritesSummary(computeWritesSummary),
      ...cloneWritesSummary(persistResult.writesSummary),
      worldStatsUpdated: false,
    };
    const persistedToWorld =
      writesSummary.teamsPatched > 0 &&
      writesSummary.eventsWritten > 0 &&
      writesSummary.worldMetadataPatched > 0;

    if (!persistedToWorld) {
      return buildMutationFailureResult(
        `${mutationType} did not persist canonical world writes. Save blocked.`,
        {
          appliedToLocalState,
          persistedToWorld: false,
          eventWritten: writesSummary.eventsWritten > 0,
          writesSummary,
        }
      );
    }

    // PHASE 5: POST-UPDATE - Update world stats and metadata
    await updateWorldStats(
      worldId,
      getMutationActionType(mutationType),
      teamCodes
    );
    writesSummary.worldStatsUpdated = true;

    // Return success result
    return {
      success: true,
      changedTeams: committedTeamUpdates,
      changedPlayers: playerUpdates,
      worldPatch: persistResult.worldPatch,
      event: persistResult.event,
      appliedToLocalState,
      persistedToWorld: true,
      eventWritten: writesSummary.eventsWritten > 0,
      writesSummary,
      warnings: combinedWarnings,
    };
  } catch (error) {
    console.error(`applyWorldMutation failed for ${mutationType}:`, error);
    return buildMutationFailureResult(getErrorMessage(error));
  }
}

export async function preflightSignAndTradeMutation({
  worldId,
  seasonId,
  payload,
  timestamp = Date.now(),
}: {
  worldId: string;
  seasonId: string;
  payload: ArchitectMutationPayload;
  timestamp?: number;
}): Promise<SignAndTradePreflightResult> {
  if (!worldId) {
    return {
      status: 'blocked',
      reasons: ['Sign-and-trade requires an active world to commit.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  if (!seasonId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative sign-and-trade preflight is missing season context.',
      ],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  const sanitizedPayload = sanitizePayloadForOverride(
    payload
  ) as MutationPayloadLike;
  if (!sanitizedPayload.destinationTeamCode) {
    return {
      status: 'blocked',
      reasons: ['Destination team is required for sign-and-trade.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  if (
    !sanitizedPayload.teamCode ||
    !sanitizedPayload.playerId ||
    !sanitizedPayload.contract
  ) {
    return {
      status: 'blocked',
      reasons: ['Cannot complete sign-and-trade: contract payload is invalid.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  try {
    const currentState = await loadStateForMutation(
      worldId,
      'signAndTrade',
      sanitizedPayload
    );
    const { team, player } = requireDestinationState(
      currentState,
      'signAndTrade'
    );
    const signingValidation = validateSignAndTradeSigningPhase({
      team,
      player,
      contract: sanitizedPayload.contract,
      signedUsing: sanitizedPayload.signedUsing,
      seasonId,
    });

    if (!signingValidation.valid) {
      const summary = summarizeSignAndTradeAuthority({
        signingValidation,
        tradeValidation: null,
      });

      return {
        status: summary.status,
        reasons: summary.reasons,
        warnings: summary.warnings,
        source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
      };
    }

    const worldAsOfDate = await loadWorldAsOfDate(worldId);
    const { asOfDate } = resolveWorldAsOfDate({
      payloadAsOfDate:
        sanitizedPayload.asOfDate != null
          ? String(sanitizedPayload.asOfDate)
          : null,
      worldAsOfDate,
    });
    const computeResult = computeWorldMutation({
      mutationType: 'signAndTrade',
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate,
      worldId,
    });

    if (!computeResult.success) {
      return {
        status: 'incomplete',
        reasons: [
          String(
            computeResult.error ||
              'Authoritative sign-and-trade preflight failed before legality could be determined.'
          ),
        ],
        warnings: dedupeMessages(
          Array.isArray(computeResult.warnings) ? computeResult.warnings : []
        ),
        source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
      };
    }

    const summary = summarizeSignAndTradeAuthority({
      signingValidation: computeResult._signingValidation || signingValidation,
      tradeValidation: computeResult._validatedTradeContext || null,
    });

    return {
      status: summary.status,
      reasons: summary.reasons,
      warnings: summary.warnings,
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  } catch (error) {
    return {
      status: 'incomplete',
      reasons: [
        getErrorMessage(error) ||
          'Authoritative sign-and-trade preflight failed before legality could be determined.',
      ],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }
}

export async function preflightOfferSheetMutation({
  worldId,
  seasonId,
  offeringTeamCode,
  playerId,
  contract,
  timestamp = Date.now(),
}: {
  worldId: string;
  seasonId: string;
  offeringTeamCode: string;
  playerId: string;
  contract: ArchitectMutationContract;
  timestamp?: number;
}): Promise<OfferSheetPreflightResult> {
  const source = AUTHORITATIVE_SAT_PREFLIGHT_SOURCE;

  if (!worldId) {
    return {
      status: 'blocked',
      reasons: ['Offer sheet requires an active world to commit.'],
      warnings: [],
      source,
    };
  }

  if (!seasonId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative offer sheet preflight is missing season context.',
      ],
      warnings: [],
      source,
    };
  }

  if (!offeringTeamCode) {
    return {
      status: 'blocked',
      reasons: ['Offering team is required for offer sheet.'],
      warnings: [],
      source,
    };
  }

  if (!playerId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative offer sheet preflight is missing player context.',
      ],
      warnings: [],
      source,
    };
  }

  if (!contract) {
    return {
      status: 'blocked',
      reasons: ['Cannot complete offer sheet: contract payload is invalid.'],
      warnings: [],
      source,
    };
  }

  // Ensure offer-sheet flags are set; computeStoreOfferSheetResult hard-fails without them.
  const preflightContract: ArchitectMutationContract = {
    ...contract,
    rfaOfferSheet: true,
    rfaOfferSheetOnly: true,
    rfaOfferSheetStatus: contract.rfaOfferSheetStatus || 'PENDING_MATCH',
    contractType: 'Offer Sheet',
  };

  const payload: ArchitectMutationPayload = {
    teamCode: offeringTeamCode,
    playerId,
    contract: preflightContract,
    signedUsing: contract.exceptionType ?? null,
  };

  try {
    // loadStateForMutation('storeOfferSheet') calls resolveStoreOfferSheetAuthority (E5):
    // scans world lineage snapshots, resolves authoritative home team, fails closed on ambiguity.
    const currentState = await loadStateForMutation(
      worldId,
      'storeOfferSheet',
      payload
    );
    const { team, player } = requireSigningState(
      currentState,
      'storeOfferSheet'
    );
    const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();

    // validateSigning with offer-sheet flags routes into the RFA/offer-sheet validation path:
    // validateOfferSheetTerms (years 1–4, raises ≤8%) + offering-team-vs-home-team checks.
    const signingValidation = validateSigning({
      team,
      player,
      contract: preflightContract,
      signedUsing: payload.signedUsing,
      year: currentYear,
    });

    if (!signingValidation.valid) {
      const reasons = dedupeMessages(
        signingValidation.violations.map((v) => v.message)
      );
      const warnMessages = dedupeMessages(
        signingValidation.warnings.map((w) => w.message)
      );
      return {
        status: 'blocked',
        reasons:
          reasons.length > 0 ? reasons : ['Offer sheet validation failed.'],
        warnings: warnMessages,
        source,
      };
    }

    // computeWorldMutation catches pre-compute guardrails: player in home team players[],
    // dedup/worldId checks. Pure compute — does not persist.
    const computeResult = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState,
      seasonId,
      timestamp,
      worldId,
    });

    if (!computeResult.success) {
      return {
        status: 'blocked',
        reasons: [
          String(
            computeResult.error ||
              'Offer sheet would be rejected by authoritative validation.'
          ),
        ],
        warnings: dedupeMessages(
          Array.isArray(computeResult.warnings) ? computeResult.warnings : []
        ),
        source,
      };
    }

    const warnings = dedupeMessages([
      ...signingValidation.warnings.map((w) => w.message),
      ...(Array.isArray(computeResult.warnings) ? computeResult.warnings : []),
    ]);

    return { status: 'legal', reasons: [], warnings, source };
  } catch (error) {
    return {
      status: 'incomplete',
      reasons: [
        getErrorMessage(error) ||
          'Authoritative offer sheet preflight failed before legality could be determined.',
      ],
      warnings: [],
      source,
    };
  }
}

// ==============================================================================
// PHASE 2: COMPUTE (PURE) - Calculate mutation result
// ==============================================================================

/**
 * Compute mutation result without side effects.
 * This function is PURE - no Firestore, no Date.now(), deterministic output.
 *
 * @param {Object} params
 * @param {MutationType} params.mutationType
 * @param {Object} params.payload
 * @param {Object} params.currentState
 * @param {string} params.seasonId
 * @param {number} params.timestamp
 * @returns {ComputeResult}
 */
export function computeWorldMutation(
  args: PublicComputeWorldMutationArgs
): ComputeResultLike {
  const mutationType = String(args?.mutationType || '');
  if (!isSupportedComputeMutationType(mutationType)) {
    return withDefaultPlayerDeletes({
      success: false,
      error: `Unknown mutation type: ${mutationType}`,
    });
  }

  return computeNormalizedWorldMutation(
    normalizeComputeWorldMutationArgs(args)
  );
}

function computeNormalizedWorldMutation(
  args: ComputeWorldMutationArgs
): ComputeResultLike {
  const { seasonId, timestamp, asOfDate, worldId } = args;
  const result = (() => {
    switch (args.mutationType) {
      case 'executeTrade': {
        const tradePayload = args.payload;
        const tradeState = toTradeStateSlice(args.currentState);

        // TM-3B: Prepare trade apply inputs in one canonical handoff surface.
        const tradeApplyPreparation = buildTradeApplyPreparation({
          payload: tradePayload,
          currentState: tradeState,
          seasonId,
          timestamp,
          asOfDate,
        });

        // Step 2: Call pure computeTradeResult with prepared snapshot/context
        const tradeResult = computeTradeResult({
          payload: tradePayload,
          currentState: tradeState,
          seasonId,
          timestamp,
          historyContext: { worldId, mutationType: args.mutationType },
          postTradeSnapshot: tradeApplyPreparation.postTradeSnapshot,
          validatedContext: tradeApplyPreparation.validatedContext,
        });

        return withDefaultPlayerDeletes(tradeResult);
      }

      case 'signFreeAgent': {
        return withDefaultPlayerDeletes(
          computeSigningResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'waivePlayer': {
        return withDefaultPlayerDeletes(
          computeWaiveResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'extendPlayer': {
        return withDefaultPlayerDeletes(
          computeExtensionResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'storeOfferSheet': {
        return withDefaultPlayerDeletes(
          computeStoreOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'matchOfferSheet': {
        return withDefaultPlayerDeletes(
          computeMatchOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'declineOfferSheet': {
        return withDefaultPlayerDeletes(
          computeDeclineOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeMatchedOfferSheet': {
        return withDefaultPlayerDeletes(
          computeFinalizeMatchedOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeDeclinedOfferSheet': {
        return withDefaultPlayerDeletes(
          computeFinalizeDeclinedOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'optionDecision': {
        return withDefaultPlayerDeletes(
          computeOptionResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'renounceRights': {
        return withDefaultPlayerDeletes(
          computeRenounceResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'signAndTrade': {
        return withDefaultPlayerDeletes(
          computeSignAndTradeResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
            worldId,
            historyContext: { worldId, mutationType: args.mutationType },
          })
        );
      }

      case 'setDeadCap': {
        return withDefaultPlayerDeletes(
          computeSetDeadCapResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'setExceptions': {
        return withDefaultPlayerDeletes(
          computeSetExceptionsResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      default:
        return withDefaultPlayerDeletes({
          success: false,
          error: 'Unknown mutation type',
        });
    }
  })();

  return canonicalizeComputeResultTeamUpdates(result, seasonId);
}

/**
 * Compute trade result
 *
 * Phase 56: PURE FUNCTION - Does NOT call validateTrade internally.
 * Requires validatedContext (from validatePostTradeSnapshotForContext) and
 * postTradeSnapshot (from buildPostTradeTeamsSnapshot) to be passed in.
 *
 * This function only:
 * - Applies SSOT outputs for persistence (createdTPE, consumption from matchIncoming)
 * - Writes tradeExceptions[] and exceptionHistory[]
 * - Returns compute result with team/player updates
 *
 * @param {Object} params
 * @param {Object} params.payload - Trade payload
 * @param {Object} params.currentState - Current team states (used for reference only)
 * @param {string} params.seasonId - Season ID
 * @param {number} params.timestamp - Mutation timestamp
 * @param {Object} [params.historyContext] - History context for audit logging
 * @param {Object} params.postTradeSnapshot - Result from buildPostTradeTeamsSnapshot (REQUIRED for Phase 56)
 * @param {Object} params.validatedContext - Result from validatePostTradeSnapshotForContext (REQUIRED for Phase 56)
 */


// ==============================================================================
// PHASE 3: VALIDATE - Ensure mutation is legal
// ==============================================================================

/**
 * Validate mutation before persistence.
 *
 * Phase 5 Enhancement: All mutation types now have real validation.
 * Previously only trades were validated; signings/waives/etc bypassed validation.
 *
 * IMPORTANT: This function blocks persistence when violations exist.
 * There is no bypass mechanism - illegal states cannot be persisted.
 *
 * For executeTrade, this function only exposes a compatibility-stage adapter
 * over the prepared trade context. It is not the canonical trade execution
 * authority surface; applyWorldMutation() keeps the prepared context →
 * execution authority → persist boundary chain.
 *
 * @param {Object} params
 * @param {string} [params.asOfDate] - Phase 20: World time SSOT
 * @param {boolean} [params.dateDefaulted] - Phase 20: True if asOfDate was defaulted
 * @returns {{valid: boolean, error?: string, violations?: Array}}
 */
export function validateMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  computeResult: ComputeResultLike;
  seasonId: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
}): {
  valid: boolean;
  error?: string;
  violations?: string[];
  warnings?: unknown[];
} {
  // Phase 20: Collect warnings including world time defaulted warning
  const pipelineWarnings = [];

  if (dateDefaulted) {
    pipelineWarnings.push({
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    });
  }

  // Trade validation uses the prepared Trade Machine context.
  if (mutationType === 'executeTrade') {
    // This remains a compatibility-stage adapter for callers that still route
    // through validateMutation(). It is NOT the canonical execution surface.
    // applyWorldMutation() must continue to use:
    // prepared context -> validateTradeExecutionAuthority() -> persistWorldMutation().
    // Phase 56+/TM-3B: Trade validation MUST have already occurred via
    // buildTradeApplyPreparation, which attaches _validatedTradeContext.
    // TM-3C: The authority layer owns the stage-1 verdict adapter for that context.
    // computeWorldMutation guarantees _validatedTradeContext is attached to computeResult
    if (computeResult?._validatedTradeContext?._isValidatedTradeContext) {
      return evaluateTradeSnapshotValidationStage({
        validatedTradeContext: computeResult._validatedTradeContext,
        asOfDate: asOfDate ?? null,
        dateDefaulted,
      });
    }

    // Phase 57: Hard error if context is missing - no fallback validation
    // This should never happen if the pipeline is correctly structured
    throw new Error(
      '[validateMutation] Phase 57 violation: executeTrade requires pre-validated context. ' +
        'computeWorldMutation must attach _validatedTradeContext via buildTradeApplyPreparation().'
    );
  }

  switch (mutationType) {
    case 'signAndTrade': {
      // Phase 56+: S&T validation MUST have already occurred via computeSignAndTradeResult
      // which calls validateSigning + validatePostTradeSnapshotForContext before computeTradeResult
      const hasPreValidatedSigning =
        computeResult?._signingValidation?.valid !== undefined;
      const hasPreValidatedTrade =
        computeResult?._validatedTradeContext?._isValidatedTradeContext;

      if (hasPreValidatedSigning && hasPreValidatedTrade) {
        const summary = summarizeSignAndTradeAuthority({
          signingValidation: computeResult._signingValidation,
          tradeValidation: computeResult._validatedTradeContext,
        });

        return {
          valid: summary.status === 'legal',
          error: summary.error || undefined,
          violations: summary.violations,
          warnings: [...summary.warningIssues, ...pipelineWarnings],
        };
      }

      // Phase 57: Hard error if contexts are missing - no fallback validation
      // computeSignAndTradeResult must attach both _signingValidation and _validatedTradeContext
      throw new Error(
        '[validateMutation] Phase 57 violation: signAndTrade requires pre-validated contexts. ' +
          'computeSignAndTradeResult must attach _signingValidation and _validatedTradeContext.'
      );
    }

    default:
      {
        const stageResult = validateNonTradeMutationStage({
          mutationType,
          payload,
          currentState,
          computeResult,
          seasonId,
          asOfDate,
          dateDefaulted,
        });

        return {
          valid: stageResult.valid,
          ...(stageResult.error ? { error: stageResult.error } : {}),
          ...(stageResult.violations
            ? { violations: stageResult.violations }
            : {}),
          ...(stageResult.warnings ? { warnings: stageResult.warnings } : {}),
        };
      }
  }
}

// ==============================================================================
// PHASE 59: LEGACY VALIDATION HELPERS REMOVED
// ==============================================================================
// validateTradeForPipeline was a deprecated function that validated PRE-TRADE state.
// It has been removed in Phase 59 as no production or test code uses it.
// The correct approach (Phase 56+/TM-3B) validates POST-TRADE state via:
//   buildTradeApplyPreparation → compute/persist
//
// validateTradeForContext has been moved to tradeContext/legacy/ namespace.
// Import from '@/features/architect/utils/tradeContext/legacy' if needed.

// ==============================================================================
// PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
// ==============================================================================

/**
 * Persist mutation to Firestore.
 * THIS IS THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS.
 * It owns sanitization, persistence contract enforcement, canonical writes,
 * and event emission only.
 *
 * It must not absorb legality/business-rule ownership, authority sequencing,
 * or mutation computation.
 *
 * @param {Object} params
 * @returns {Promise<{success: boolean, worldPatch?: Object, event?: Object, error?: string}>}
 */
async function persistWorldMutation({
  worldId,
  seasonId,
  mutationType,
  computeResult,
  committedTeamUpdates,
  timestamp,
  payloadAsOfDate, // Phase 20: Only write asOfDate if explicitly provided in payload
  auditContext = {},
}: {
  worldId: string;
  seasonId: string;
  mutationType: string;
  computeResult: ArchitectMutationBridgeResult;
  committedTeamUpdates: ArchitectGeneralMutationCommittedTeamUpdate[];
  timestamp: number;
  payloadAsOfDate?: string | null;
  auditContext?: AuditContextLike;
}): Promise<PersistWorldMutationResult> {
  const batch = writeBatch(db);
  const teamCodesPatched = [];
  const playerIdsPatched = new Set<string>();
  const entitlementIdsPatched = [];
  let eventId: string | null = null;
  const teamUpdates = committedTeamUpdates || [];
  const playerUpdates = computeResult.playerUpdates || [];
  const playerDeletes = computeResult.playerDeletes || [];
  const entitlementUpdates = computeResult.entitlementUpdates || [];

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of teamUpdates) {
      if (!team) {
        continue;
      }

      const persistenceReadyTeam = team;
      // Guard against undefined values (dev throws, prod allows)
      guardAgainstUndefined(
        persistenceReadyTeam,
        `architect_worlds/${worldId}/teams/${teamCode}`
      );
      // Phase 61: Validate against persistence contract (test-only enforcement)
      // Ordering: sanitize → normalize TPE → validate contract → removeUndefined
      assertPersistableOrThrow({
        obj: persistenceReadyTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      // Then remove undefined values
      const sanitizedTeam = removeUndefinedDeep(persistenceReadyTeam);
      if (!teamCode) {
        continue;
      }
      const teamRef = worldTeamRef(worldId, teamCode);
      batch.set(teamRef, sanitizedTeam);
      teamCodesPatched.push(String(teamCode));
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of playerUpdates) {
      // Player overrides go in the team's players subcollection
      if (!player) {
        continue;
      }
      const normalizedPlayerId = String(
        playerId || getMutationPlayerId(player) || ''
      ).trim();
      const persistablePlayer = toPersistablePlayerOverrideFromSnapshot(player);
      const teamCode = persistablePlayer?.teamCode;
      if (teamCode && persistablePlayer && normalizedPlayerId) {
        // Guard against undefined values (dev throws, prod allows)
        guardAgainstUndefined(
          persistablePlayer,
          `architect_worlds/${worldId}/teams/${teamCode}/players/${normalizedPlayerId}`
        );
        // Phase 60: Sanitize transient fields first
        const afterSanitize =
          sanitizeTransientFieldsForPersistence(persistablePlayer);
        // Phase 61: Validate against persistence contract (test-only enforcement)
        // Ordering: sanitize → validate contract → removeUndefined
        assertPersistableOrThrow({
          obj: afterSanitize,
          contract: PERSISTENCE_CONTRACTS.PLAYER,
          label: 'PLAYER',
        });
        // Then remove undefined values
        const sanitizedPlayer = removeUndefinedDeep(afterSanitize);
        const playerRef = worldPlayerRef(worldId, teamCode, normalizedPlayerId);
        batch.set(playerRef, sanitizedPlayer);
        playerIdsPatched.add(normalizedPlayerId);
      }
    }

    // 2.25 Delete superseded player overrides for canonical move flows
    for (const { playerId, teamCode } of playerDeletes) {
      const normalizedPlayerId = String(playerId || '').trim();
      const normalizedTeamCode = String(teamCode || '').trim();
      if (!normalizedPlayerId || !normalizedTeamCode) {
        continue;
      }
      const playerRef = worldPlayerRef(
        worldId,
        normalizedTeamCode,
        normalizedPlayerId
      );
      batch.delete(playerRef);
      playerIdsPatched.add(normalizedPlayerId);
    }

    // 2.5 TM-PICKS-E1: Write entitlement overrides (holderTeam patches)
    if (entitlementUpdates.length > 0) {
      for (const entitlementUpdate of entitlementUpdates) {
        const entitlementId = entitlementUpdate.entitlementId as
          | string
          | null
          | undefined;
        const holderTeam = entitlementUpdate.holderTeam;
        if (!entitlementId) continue;
        const entitlementRef = doc(
          db,
          ARCHITECT_WORLDS_COLLECTION,
          worldId,
          ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
          entitlementId
        );
        // Merge holderTeam onto existing override doc (or create if none exists)
        batch.set(entitlementRef, { holderTeam }, { merge: true });
        entitlementIdsPatched.push(String(entitlementId));
      }
    }

    // 3. Write event log entry
    // Use timestamp + random suffix to avoid collisions if multiple mutations occur at same millisecond
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    eventId = `${mutationType}_${timestamp}_${randomSuffix}`;
    const eventsCol = collection(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION
    );
    const eventRef = doc(eventsCol, eventId);

    // Phase 60/61: Sanitize and validate metadata first
    const sanitizedMetadataRaw = sanitizeTransientFieldsForPersistence(
      computeResult.metadata
    );
    // Phase 61: Validate metadata against persistence contract (test-only enforcement)
    assertPersistableOrThrow({
      obj: sanitizedMetadataRaw,
      contract: PERSISTENCE_CONTRACTS.EVENT_METADATA,
      label: 'EVENT_METADATA',
    });
    const sanitizedMetadata = removeUndefinedDeep(sanitizedMetadataRaw);

    const event = buildWorldMutationEventPayload({
      mutationType,
      eventId,
      seasonId,
      worldId,
      timestamp,
      computeResult: {
        ...computeResult,
        metadata: sanitizedMetadata as MutationEventMetadataLike,
      },
      auditContext,
    });

    // Phase 60: Sanitize entire event (defense-in-depth)
    const afterEventSanitize = sanitizeTransientFieldsForPersistence(event);
    // Phase 61: Validate event against persistence contract (test-only enforcement)
    // Ordering: sanitize → validate contract → removeUndefined
    assertPersistableOrThrow({
      obj: afterEventSanitize,
      contract: PERSISTENCE_CONTRACTS.EVENT,
      label: 'EVENT',
    });
    const sanitizedEvent = removeUndefinedDeep(afterEventSanitize);
    batch.set(eventRef, sanitizedEvent);

    // 4. Update world metadata
    // Use lastModifiedTeams (not modifiedTeams) to clarify this field records
    // only teams modified by this single mutation, not cumulative history
    const worldPatch: ArchitectWorldMutationPatch = {
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: teamUpdates.map((u) => u.teamCode),
    };

    // Phase 20: Only update asOfDate if explicitly provided in payload
    // This prevents silent overwrites and allows mutations to reference a date
    // without advancing world time
    if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
      worldPatch.asOfDate = payloadAsOfDate;
    }

    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, worldPatch);

    // Commit all writes atomically
    await batch.commit();

    const writesSummary = {
      ...cloneWritesSummary(),
      teamsPatched: teamCodesPatched.length,
      teamCodes: teamCodesPatched,
      playersPatched: playerIdsPatched.size,
      playerIds: Array.from(playerIdsPatched),
      entitlementsPatched: entitlementIdsPatched.length,
      entitlementIds: entitlementIdsPatched,
      eventsWritten: eventId ? 1 : 0,
      eventIds: eventId ? [eventId] : [],
      worldMetadataPatched: 1,
      worldStatsUpdated: false,
    };

    return {
      success: true,
      worldPatch,
      event,
      writesSummary,
    };
  } catch (error) {
    console.error('persistWorldMutation failed:', error);
    const writesSummary = {
      ...cloneWritesSummary(),
      teamsPatched: teamCodesPatched.length,
      teamCodes: teamCodesPatched,
      playersPatched: playerIdsPatched.size,
      playerIds: Array.from(playerIdsPatched),
      entitlementsPatched: entitlementIdsPatched.length,
      entitlementIds: entitlementIdsPatched,
      eventsWritten: 0,
      eventIds: [] as string[],
      worldMetadataPatched: 0,
      worldStatsUpdated: false,
    };
    return {
      success: false,
      error:
        (error instanceof Error ? error.message : String(error)) ||
        'Failed to persist mutation',
      writesSummary,
    };
  }
}


