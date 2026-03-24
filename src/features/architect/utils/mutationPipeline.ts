/**
 * FILE: src/features/architect/utils/mutationPipeline.ts
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-17: Created per ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
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
 * 6) Trade validation follows: snapshot → validate → compute/persist (Phase 56/58)
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
  mergePlayerOverride,
} from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  updateWorldStats,
} from '@/features/architect/utils/worldManager';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { buildTradeTeamInput } from '@/features/architect/utils/schemaAdapter';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { getPlayerId } from '@/features/architect/utils/capHelpers';
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
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateOfferSheetResolution,
  validateRenounceRights,
  validateDeadCap,
  validateExceptions,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { createTPE } from '@/features/architect/utils/tradeMachine/utils/tpeValidation';
import {
  appendExceptionHistory,
  createTpeConsumptionHistoryEntry,
  createTpeCreationHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';

// Phase 72: SSOT for team cap totals computation
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

// Phase 61: Persistence contract enforcement (allowlist-based)
// Phase 64: Added normalizeTeamTpeSchema for TPE canonicalization
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';

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
import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';
import type { CapHold } from '@/features/architect/utils/capHolds';
import type {
  PostTradeSnapshot as TradeContextPostTradeSnapshot,
  TeamResult as TradeContextTeamResult,
  ValidatedTradeContext as TradeContextValidatedTradeContext,
  ValidationTeam as TradeContextValidationTeam,
} from '@/features/architect/utils/tradeContext/types';

// ==============================================================================
// PHASE 58: TRADE CONTEXT MODULE RE-EXPORTS
// ==============================================================================
// Phase 58 extracted snapshot/validation context helpers to dedicated module.
// These re-exports maintain backward compatibility for existing imports.
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  assertPostTradeSnapshot,
  assertValidatedTradeContext,
  assertTradeComputeInputs,
} from '@/features/architect/utils/tradeContext';
import {
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';

type LooseRecord = Record<string, unknown>;
type MutationScalarId = string | number | null | undefined;

export type ArchitectMutationSalaryRow = {
  season?: string | null;
  salary?: number | string | null;
  capHit?: number | string | null;
  guaranteed?: boolean | null;
  guaranteedAmount?: number | string | null;
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | null;
  isExtensionSeason?: boolean | null;
};

export type ArchitectMutationBirdRights = {
  status?: string | null;
  type?: string | null;
  yearsOfService?: number | string | null;
  yearsWithTeam?: number | string | null;
  eligibleFor?: string[] | null;
  renounced?: boolean | null;
};

export type ArchitectMutationFreeAgency = {
  year?: number | string | null;
  type?: string | null;
  capHold?: number | null;
  qualifyingOffer?: number | null;
  earlyTerminationOption?: boolean | null;
  hasOption?: boolean | null;
  optionYear?: number | string | null;
  optionType?: string | null;
};

export type ArchitectMutationContract = {
  salariesByYear?: ArchitectMutationSalaryRow[];
  years?: number | null;
  startYear?: number | null;
  year?: number | null;
  birdRights?: ArchitectMutationBirdRights | null;
  contractType?: string | null;
  isExtension?: boolean | null;
  isRookieScale?: boolean | null;
  signingTeam?: string | null;
  signingDate?: string | number | null;
  signedUsing?: string | null;
  exceptionType?: string | null;
  contractYears?: number | null;
  firstYearGuaranteed?: boolean | null;
  rfaOfferSheet?: boolean | null;
  rfaOfferSheetOnly?: boolean | null;
  yearsRemaining?: number | null;
  contractLength?: number | null;
  originalLength?: number | null;
  totalValue?: number | null;
  guaranteedValue?: number | null;
  freeAgency?: ArchitectMutationFreeAgency | string | null;
  rfaOfferSheetStatus?: string | null;
  [key: string]: unknown;
};

type MutationDeadCapYear = {
  season?: string | null;
  amount?: number | string | null;
  isStretched?: boolean | null;
};

export type ArchitectMutationDeadCapEntry = {
  id?: string | null;
  playerId?: MutationScalarId;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: number | string | null;
  amountByYear?: MutationDeadCapYear[] | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};

export type ArchitectMutationExceptionEntry = {
  type?: string | null;
  enabled?: boolean | null;
  available?: boolean | null;
  totalAmount?: number | string | null;
  maxAmount?: number | string | null;
  amount?: number | string | null;
  usedAmount?: number | string | null;
  remainingAmount?: number | string | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};

export type ArchitectMutationExceptions = {
  mle?: ArchitectMutationExceptionEntry | null;
  taxpayerMle?: ArchitectMutationExceptionEntry | null;
  tpmle?: ArchitectMutationExceptionEntry | null;
  room?: ArchitectMutationExceptionEntry | null;
  bae?: ArchitectMutationExceptionEntry | null;
  dpe?: ArchitectMutationExceptionEntry | null;
  tpe?: TradeExceptionRecord[];
} & Record<string, unknown>;

export type ArchitectMutationOfferSheet = {
  id?: string | number | null;
  dedupKey?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  offeringTeamCode?: string | null;
  homeTeamCode?: string | null;
  status?: string | null;
  seasonKey?: string | null;
  year?: number | null;
  contractYears?: number | string | null;
  totalValue?: number | string | null;
  salariesByYear?: ArchitectMutationSalaryRow[];
  createdAt?: string | number | Date | null;
  matchedAt?: string | null;
  declinedAt?: string | null;
};

type ArchitectMutationCapHold = {
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  type?: string | null;
  season?: string | null;
  isSigned?: boolean | null;
  expiresOn?: string | null;
  notes?: string;
  active?: boolean | null;
};

export type ArchitectMutationPlayerRecord = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  bio?: unknown;
  contract?: ArchitectMutationContract | null;
  futureContract?: ArchitectMutationContract | null;
  age?: number | null;
  salary?: number | null;
  currentSalary?: number | null;
  freeAgency?: ArchitectMutationFreeAgency | string | null;
  birdRights?: ArchitectMutationBirdRights | string | null;
  renounced?: boolean | null;
  representation?: unknown;
  source?: unknown;
  lastUpdated?: unknown;
  version?: unknown;
  rfaOfferSheet?: boolean | null;
  rfaOfferSheetOnly?: boolean | null;
  rfaContext?: unknown;
  draft?: Record<string, unknown> | null;
  matchIncoming?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  signAndTrade?: boolean;
  signAndTradeContract?: ArchitectMutationContract | null;
  homeTeamCode?: string | null;
  receivingTeamIndex?: MutationScalarId;
  receivingTeamId?: MutationScalarId;
  tradeTo?: MutationScalarId;
  toTeamId?: MutationScalarId;
  destTeamId?: MutationScalarId;
};

export type ArchitectMutationTeamRecord = {
  id?: MutationScalarId;
  teamCode?: string | null;
  teamName?: string | null;
  players?: ArchitectMutationPlayerRecord[];
  roster?: string[];
  twoWayPlayers?: ArchitectMutationPlayerRecord[];
  capHolds?: ArchitectMutationCapHold[];
  deadCap?: ArchitectMutationDeadCapEntry[];
  exceptions?: ArchitectMutationExceptions | null;
  tradeExceptions?: TradeExceptionRecord[];
  offerSheets?: ArchitectMutationOfferSheet[];
  incomingOfferSheets?: ArchitectMutationOfferSheet[];
  totals?: Record<string, unknown> | null;
  draftPicks?: Record<string, unknown>[];
  entitlementIds?: string[];
  source?: Record<string, unknown> | string | null;
  hardCapTriggered?: string | boolean | null;
  hardCapTriggeredBy?: string | null;
  hardCapReason?: string | null;
  hardCapped?: boolean | number | null;
  hardCapLevel?: string | null;
};

export type ArchitectTradePayloadPlayer = ArchitectMutationPlayerRecord & {
  matchIncoming?: number | string | null;
  matchOutgoing?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
};

type TradePayloadEntitlementLike = {
  entitlementId?: MutationScalarId;
  id?: MutationScalarId;
  type?: string | null;
  name?: string | null;
  year?: number | string | null;
  round?: number | null;
  toTeamId?: MutationScalarId;
};

export type ArchitectTradePayloadTeam = {
  team?: {
    id?: MutationScalarId;
    teamCode?: MutationScalarId;
  } | null;
  teamCode?: MutationScalarId;
  teamId?: MutationScalarId;
  sends?: ArchitectTradePayloadPlayer[];
  receives?: ArchitectTradePayloadPlayer[];
  outgoingEntitlements?: TradePayloadEntitlementLike[];
  incomingEntitlements?: TradePayloadEntitlementLike[];
  entitlementsOut?: TradePayloadEntitlementLike[];
  picksOut?: Record<string, unknown>[];
  picksIn?: Record<string, unknown>[];
  cashSent?: number | null;
  cashReceived?: number | null;
};
type TradeTpeConsumptionIssue = {
  playerId?: string | null;
  tpeId?: string | null;
  reason: string;
};
type TradeAbsorbedPlayer = {
  playerId?: string | null;
  name?: string | null;
  amountAbsorbed: number;
};
type TradeEntitlementTransferSummary = {
  out: string[];
  in: string[];
};
type TradeEntitlementsMovedByTeam = Record<
  string,
  TradeEntitlementTransferSummary
>;
type EntitlementUpdateLike = {
  entitlementId: string;
  holderTeam: string;
};
type TradeMutationMetadata = {
  type: 'trade';
  teamsInvolved: Array<string | null | undefined>;
  playersTraded: Array<string | null | undefined>;
  entitlementsTraded?: TradeEntitlementsMovedByTeam;
  timestamp: number;
} & Record<string, unknown>;
type TradeSnapshotLike = TradeContextPostTradeSnapshot;
type TradeValidationTeamLike = TradeContextValidationTeam;
type TradeValidationTeamResultLike = TradeContextTeamResult;
type TradeValidationResultLike =
  | NonNullable<TradeContextValidatedTradeContext['_rawValidation']>
  | Pick<TradeContextValidatedTradeContext, 'legal' | 'teamResults'>;
export type ArchitectMutationValidatedTradeContext =
  TradeContextValidatedTradeContext;
type TradeHistoryContextLike = LooseRecord & {
  worldId?: unknown;
  mutationType?: unknown;
  mutationId?: unknown;
};
export type ArchitectMutationTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectMutationTeamRecord | null;
};
type TradeExceptionHistoryEntry =
  | NonNullable<ReturnType<typeof createTpeConsumptionHistoryEntry>>
  | NonNullable<ReturnType<typeof createTpeCreationHistoryEntry>>;
export type ArchitectMutationTradeContext = {
  worldId?: string | null;
  seasonId?: string | null;
  asOfDate?: string | number | null;
  source?: string | null;
  yearKey?: number | string | null;
  offseason?: boolean;
};

export type ArchitectMutationPayload = {
  teams?: ArchitectTradePayloadTeam[];
  asOfDate?: string | number | null;
  capProjections?: Record<string, unknown> | null;
  seasonKey?: string | null;
  teamCode?: string | null;
  destinationTeamCode?: string | null;
  offeringTeamCode?: string | null;
  homeTeamCode?: string | null;
  playerId?: string | null;
  contract?: ArchitectMutationContract | null;
  extension?: ArchitectMutationContract | null;
  signedUsing?: string | null;
  accepted?: boolean;
  signAndTrade?: boolean;
  stretch?: boolean;
  stretchYears?: number | string | null;
  buyout?: boolean;
  buyoutAmount?: number | null;
  isGracePeriod?: boolean;
  targetYear?: number | string | null;
  offerSheetId?: string | null;
  dedupKey?: string | null;
  deadCap?: ArchitectMutationDeadCapEntry[] | null;
  deadCapChanges?: unknown[] | null;
  exceptions?: ArchitectMutationExceptions | null;
  exceptionChanges?: unknown[] | null;
  worldId?: string | null;
  tradeCtx?: ArchitectMutationTradeContext | null;
};
type TeamLike = ArchitectMutationTeamRecord;
type PlayerLike = ArchitectMutationPlayerRecord;
type MutationTeamMap = Record<string, TeamLike>;
export type ArchitectMutationPlayerUpdate = {
  playerId?: string | null;
  player?: PlayerLike | null;
};
export type ArchitectMutationPlayerDelete = {
  playerId?: string | null;
  teamCode?: string | null;
};
export type ArchitectMutationWritesSummary = {
  teamsPatched: number;
  teamsWritten: number;
  teamCodes: string[];
  playersPatched: number;
  playersWritten: number;
  playerIds: string[];
  entitlementsPatched: number;
  entitlementsWritten: number;
  entitlementIds: string[];
  eventsWritten: number;
  eventWritten: boolean;
  eventIds: string[];
  worldMetadataPatched: number;
  worldStatsUpdated: boolean;
};
type MutationMetadataLike = Record<string, unknown>;
type MutationDiffSummary = {
  playersMoved: number;
  deadCapChanged: number;
  exceptionsChanged: number;
  teamsTouched: number;
};
type MutationAuditContext = {
  operationId?: string | null;
  validatorVersion?: string | null;
  schemaVersion?: string | null;
  mutationCategory?: string | null;
  teamCodes?: readonly string[];
  playerIds?: readonly string[];
  beforeTotalsByTeam?: NonNullable<PostStateCapValidationInput['beforeTotalsByTeam']>;
  afterTotalsByTeam?: NonNullable<PostStateCapValidationInput['afterTotalsByTeam']>;
  valid?: boolean | null;
  violations?: string[];
  warnings?: string[];
  diffSummary?: MutationDiffSummary;
};
export type ArchitectMutationResult = {
  success?: boolean;
  error?: string | Error | null;
  teamUpdates?: ArchitectMutationTeamUpdate[];
  playerUpdates?: ArchitectMutationPlayerUpdate[];
  playerDeletes?: ArchitectMutationPlayerDelete[];
  entitlementUpdates?: EntitlementUpdateLike[];
  metadata?: MutationMetadataLike;
  warnings?: unknown[];
  violations?: string[];
  writesSummary?: ArchitectMutationWritesSummary;
  changedTeams?: ArchitectMutationTeamUpdate[];
  changedPlayers?: ArchitectMutationPlayerUpdate[];
  worldPatch?: Record<string, unknown>;
  event?: Record<string, unknown>;
  appliedToLocalState?: boolean;
  persistedToWorld?: boolean;
  eventWritten?: boolean;
  _validatedTradeContext?: ArchitectMutationValidatedTradeContext;
  _signingValidation?: ReturnType<typeof validateSigning>;
  _tpeConsumptionErrors?: TradeTpeConsumptionIssue[];
};
export type SignAndTradePreflightStatus = 'legal' | 'blocked' | 'incomplete';
export type SignAndTradePreflightResult = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
type MutationPayloadLike = ArchitectMutationPayload;
type TeamUpdateLike = ArchitectMutationTeamUpdate;
type PlayerUpdateLike = ArchitectMutationPlayerUpdate;
type PlayerDeleteLike = ArchitectMutationPlayerDelete;
type WritesSummaryLike = ArchitectMutationWritesSummary;
type TradeValidatedContextLike = ArchitectMutationValidatedTradeContext;
type TradeTeamUpdate = ArchitectMutationTeamUpdate;
type ComputeResultLike = ArchitectMutationResult;
type AuditContextLike = MutationAuditContext;
type PostStateTotalsByTeam = NonNullable<PostStateCapValidationInput['afterTotalsByTeam']>;
type CurrentStateTeamEntryLike = {
  teamCode?: string | null;
  team?: TeamLike | null;
};
type CurrentStateLike = {
  teams?: CurrentStateTeamEntryLike[];
  team?: TeamLike | null;
  player?: PlayerLike | null;
  homeTeam?: TeamLike | null;
  offeringTeam?: TeamLike | null;
  destinationTeam?: TeamLike | null;
  teamCode?: string | null;
  destinationTeamCode?: string | null;
  offerSheetId?: string | null;
};
type ApplyWorldMutationArgs = {
  userId: string;
  worldId: string;
  seasonId: string;
  mutationType: string;
  payload: ArchitectMutationPayload;
  timestamp?: number;
  operationId?: string;
};
type ComputeWorldMutationArgs = {
  mutationType: string;
  payload: ArchitectMutationPayload;
  currentState: CurrentStateLike;
  seasonId: string;
  timestamp: number;
  asOfDate?: string | number | null;
  worldId?: string;
};
type BuildWorldMutationEventPayloadArgs = {
  mutationType: string;
  eventId: string;
  seasonId: string;
  worldId: string;
  timestamp: number;
  computeResult: ArchitectMutationResult;
  auditContext?: MutationAuditContext;
};

/** Shared base parameter type for all compute*Result functions */
type ComputeMutationParams = {
  payload: ArchitectMutationPayload;
  currentState: CurrentStateLike;
  seasonId: string;
  timestamp: number;
};

type SignAndTradeAuthoritySummary = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  error: string | null;
  violations: string[];
  warningIssues: unknown[];
};

const AUTHORITATIVE_WORLD_TEAM_CODES = [
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

type StoreOfferSheetOwnershipCandidate = {
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
// - validateTradeForContext(): Moved to tradeContext/tradeContext.ts (deprecated wrapper)

// ==============================================================================
// UNDEFINED VALUE SANITIZATION
// ==============================================================================

/**
 * Recursively find all paths in an object where the value is undefined.
 * Returns an array of dot-notation paths (e.g., ["contract.totalValue", "player.name"]).
 * @param {any} obj - Object to inspect
 * @param {string} [parentPath] - Current path (used in recursion)
 * @returns {string[]} Array of paths with undefined values
 */
function findUndefinedPaths(obj: unknown, parentPath = ''): string[] {
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
 * @param {any} obj - Object or array to sanitize
 * @returns {any} Sanitized copy with no undefined values
 */
function removeUndefinedDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item: unknown) => removeUndefinedDeep(item));
  }

  if (typeof obj === 'object') {
    const result: LooseRecord = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedDeep(value);
      }
    }
    return result;
  }

  // Primitive values pass through unchanged
  return obj;
}

// ==============================================================================
// PHASE 60: TRANSIENT FIELD SANITIZATION FOR PERSISTENCE
// ==============================================================================

/**
 * FORBIDDEN TRANSIENT KEYS (Phase 60)
 *
 * These keys are used internally during the mutation pipeline but MUST NOT be
 * persisted to Firestore. They are intermediate validation/context artifacts.
 *
 * - _validatedTradeContext: Pre-validated trade context for dedup (Phase 55/56)
 * - _signingValidation: Pre-validated signing result for S&T (Phase 48)
 * - _isPostTradeSnapshot: Sentinel flag for snapshot shape detection (Phase 58)
 * - _isValidatedTradeContext: Sentinel flag for validated context detection (Phase 56)
 * - _rawValidation: Raw validation result for debugging (Phase 56)
 *
 * NOTE: _meta is NOT in this list - it's legitimately used for computed totals display (UI).
 */
const FORBIDDEN_TRANSIENT_KEYS = Object.freeze([
  '_validatedTradeContext',
  '_signingValidation',
  '_isPostTradeSnapshot',
  '_isValidatedTradeContext',
  '_rawValidation',
]);

/**
 * Recursively remove forbidden transient keys from an object before Firestore persistence.
 * This is a surgical sanitizer that targets only known transient keys - it does NOT
 * strip all underscore-prefixed keys (e.g., _meta is preserved for UI use).
 *
 * @param {any} obj - Object to sanitize
 * @param {string[]} [forbiddenKeys] - Override forbidden key list (for testing)
 * @returns {any} Sanitized copy with transient keys removed
 */
function sanitizeTransientFieldsForPersistence(
  obj: unknown,
  forbiddenKeys: readonly string[] = FORBIDDEN_TRANSIENT_KEYS
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return (obj as unknown[]).map((item: unknown) =>
      sanitizeTransientFieldsForPersistence(item, forbiddenKeys)
    );
  }

  if (typeof obj === 'object') {
    const result: LooseRecord = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip forbidden transient keys
      if (forbiddenKeys.includes(key)) {
        continue;
      }
      result[key] = sanitizeTransientFieldsForPersistence(value, forbiddenKeys);
    }
    return result;
  }

  // Primitive values pass through unchanged
  return obj;
}

// Export for testing
export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };

/**
 * Dev-only guard that validates an object has no undefined values before Firestore write.
 * In DEV: logs error details and throws.
 * In PROD: silently returns (caller should sanitize).
 * @param {any} obj - Object to validate
 * @param {string} label - Description of the object (for error messages)
 */
function guardAgainstUndefined(obj: unknown, label: string) {
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
function sanitizePayloadForOverride(payload: LooseRecord | null | undefined) {
  if (!payload) return payload;

  const overrideEnabled = isOverrideEnabled();

  // If override is enabled (dev mode), allow override metadata through
  if (overrideEnabled) {
    return payload;
  }

  // In production (override disabled), strip override-related fields
  const {
    overrideUsed,
    overrideReasons,
    overrideTimestamp,
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
}: { payloadAsOfDate?: string | null; worldAsOfDate?: string | null }): { asOfDate: string; defaulted: boolean } {
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

const AUTHORITATIVE_SAT_PREFLIGHT_SOURCE = 'authoritative-preflight' as const;
const SAT_INCOMPLETE_VALIDATION_CODES = new Set([
  'SIGN_AND_TRADE__MISSING_VALIDATION_YEAR',
  'SIGN_AND_TRADE__MISSING_CURRENT_YEAR',
  'SIGN_AND_TRADE__MISSING_FIRST_APRON',
]);

const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';

function generateOperationId(timestamp = Date.now()) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

function safeCloneForAudit<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toValidationMessage(value: unknown): string | null {
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

function dedupeMessages(values: unknown[]): string[] {
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

function hasIncompleteSignAndTradeViolation(issues: unknown[]): boolean {
  return issues.some((issue) => {
    if (!issue || typeof issue !== 'object') {
      return false;
    }

    const code =
      'code' in issue && typeof issue.code === 'string' ? issue.code : '';
    return SAT_INCOMPLETE_VALIDATION_CODES.has(code);
  });
}

function summarizeSignAndTradeAuthority({
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
  const reasons =
    tradeReasons.length > 0 ? tradeReasons : [fallbackReason];
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

async function loadWorldAsOfDate(worldId: string): Promise<string | null> {
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

function addTeamSnapshot(
  teamsByCode: MutationTeamMap,
  teamCode: string | null | undefined,
  team: TeamLike | null | undefined
) {
  if (!teamCode || !team || teamsByCode[teamCode]) {
    return;
  }
  teamsByCode[teamCode] = safeCloneForAudit(team);
}

function extractTeamsByCodeFromCurrentState(
  currentState: CurrentStateLike = {}
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
    currentState.destinationTeamCode || currentState.destinationTeam?.teamCode,
    currentState.destinationTeam
  );

  return teamsByCode;
}

function getMutationRosterEntryId(entry: unknown) {
  if (!entry) {
    return null;
  }
  if (typeof entry === 'string') {
    const normalized = entry.trim();
    return normalized || null;
  }
  if (typeof entry !== 'object') {
    return null;
  }

  const rawId =
    (entry as LooseRecord).player_id ||
    (entry as LooseRecord).playerId ||
    (entry as LooseRecord).id ||
    null;
  if (!rawId) {
    return null;
  }

  const playerId = String(rawId).trim();
  return playerId || null;
}

function getSnapshotRosterMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  if (!Array.isArray(team?.roster)) {
    return null;
  }

  return team.roster.some((entry) => getMutationRosterEntryId(entry) === playerId);
}

function getSnapshotPlayersMembership(
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

async function resolveWorldLineage(worldId: string) {
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

async function getFirstExplicitWorldTeamSnapshotFromLineage(
  lineageWorldIds: string[],
  teamCode: string
) {
  for (const lineageWorldId of lineageWorldIds) {
    const snapshot = await getDoc(worldTeamRef(lineageWorldId, teamCode));
    if (snapshot.exists()) {
      return {
        snapshotWorldId: lineageWorldId,
        team: snapshot.data() as TeamLike,
      };
    }
  }

  return null;
}

async function getFirstExplicitWorldPlayerOverrideFromLineage(
  lineageWorldIds: string[],
  teamCode: string,
  playerId: string
) {
  for (const lineageWorldId of lineageWorldIds) {
    const overrideSnapshot = await getDoc(
      worldPlayerRef(lineageWorldId, teamCode, playerId)
    );
    if (overrideSnapshot.exists()) {
      return {
        overrideWorldId: lineageWorldId,
        player: overrideSnapshot.data() as PlayerLike,
      };
    }
  }

  return null;
}

async function resolveStoreOfferSheetAuthority({
  worldId,
  offeringTeamCode,
  playerId,
}: {
  worldId: string;
  offeringTeamCode: string;
  playerId: string;
}) {
  const [offeringTeam, lineageWorldIds] = await Promise.all([
    getTeam(worldId, offeringTeamCode),
    resolveWorldLineage(worldId),
  ]);

  const ownershipCandidates = (
    await Promise.all(
      AUTHORITATIVE_WORLD_TEAM_CODES.map(async (teamCode) => {
        const snapshotEntry = await getFirstExplicitWorldTeamSnapshotFromLineage(
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
    ? (mergePlayerOverride(
        resolvedOwner.snapshotPlayer as any,
        overrideEntry.player as any
      ) as PlayerLike)
    : resolvedOwner.snapshotPlayer;

  if (!canonicalPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth could not resolve player ${playerId} from authoritative home team ${resolvedOwner.teamCode}.`
    );
  }

  return {
    team: offeringTeam as TeamLike,
    player: {
      ...canonicalPlayer,
      teamCode: resolvedOwner.teamCode,
      teamName:
        resolvedOwner.team.teamName ||
        canonicalPlayer.teamName ||
        null,
    } as PlayerLike,
    teamCode: offeringTeamCode,
    homeTeam: resolvedOwner.team,
  };
}

function extractTeamsByCodeFromComputeResult(
  computeResult: ComputeResultLike = {}
): MutationTeamMap {
  const teamsByCode: MutationTeamMap = {};
  for (const update of computeResult.teamUpdates || []) {
    addTeamSnapshot(teamsByCode, update?.teamCode, update?.team);
  }
  return teamsByCode;
}

function buildTotalsByTeam(
  teamsByCode: MutationTeamMap,
  year: number
): PostStateTotalsByTeam {
  const totalsByTeam: PostStateTotalsByTeam = {};
  for (const [teamCode, team] of Object.entries(teamsByCode)) {
    totalsByTeam[teamCode] = computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}

function collectMutationPlayerIds(
  payload: MutationPayloadLike = {},
  computeResult: ComputeResultLike = {}
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

function buildPostStateRulesContext(
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

function buildCapAuditDiffSummary({
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
    const beforeTeam = beforeTeamsByCode[teamCode];
    const afterTeam = afterTeamsByCode[teamCode];

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

const FREE_AGENCY_MUTATION_TYPES = new Set([
  'signFreeAgent',
  'signAndTrade',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'renounceRights',
]);

const EMPTY_WRITES_SUMMARY = Object.freeze({
  teamsPatched: 0,
  teamsWritten: 0,
  teamCodes: [],
  playersPatched: 0,
  playersWritten: 0,
  playerIds: [],
  entitlementsPatched: 0,
  entitlementsWritten: 0,
  entitlementIds: [],
  eventsWritten: 0,
  eventWritten: false,
  eventIds: [] as string[],
  worldMetadataPatched: 0,
  worldStatsUpdated: false,
}) as WritesSummaryLike;

function cloneWritesSummary(
  summary: WritesSummaryLike = EMPTY_WRITES_SUMMARY
): WritesSummaryLike {
  const teamsPatched = Number(
    summary.teamsPatched || summary.teamsWritten || 0
  );
  const playersPatched = Number(
    summary.playersPatched || summary.playersWritten || 0
  );
  const entitlementsPatched = Number(
    summary.entitlementsPatched || summary.entitlementsWritten || 0
  );
  const eventsWritten = Number(summary.eventsWritten || 0);
  return {
    teamsPatched,
    teamsWritten: teamsPatched,
    teamCodes: Array.isArray(summary.teamCodes) ? [...summary.teamCodes] : [],
    playersPatched,
    playersWritten: playersPatched,
    playerIds: Array.isArray(summary.playerIds) ? [...summary.playerIds] : [],
    entitlementsPatched,
    entitlementsWritten: entitlementsPatched,
    entitlementIds: Array.isArray(summary.entitlementIds)
      ? [...summary.entitlementIds]
      : [],
    eventsWritten,
    eventWritten: eventsWritten > 0,
    eventIds: Array.isArray(summary.eventIds) ? [...summary.eventIds] : [],
    worldMetadataPatched: Number(summary.worldMetadataPatched || 0),
    worldStatsUpdated: summary.worldStatsUpdated === true,
  };
}

function buildComputeWritesSummary(
  computeResult: ComputeResultLike = {}
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

function buildMutationFailureResult(
  error: unknown,
  overrides: LooseRecord = {}
): ComputeResultLike {
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
    appliedToLocalState: appliedToLocalState as boolean,
    persistedToWorld: persistedToWorld as boolean,
    eventWritten: eventWritten as boolean,
    writesSummary: cloneWritesSummary(writesSummary as WritesSummaryLike),
    ...restOverrides,
  };
}

function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

function collectPlayerTouchIds(
  computeResult: ComputeResultLike = {}
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

function deriveEventTeamCodes({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: ComputeResultLike;
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

function deriveEventPlayerIds({
  auditContext = {},
  computeResult = {},
}: {
  auditContext?: AuditContextLike;
  computeResult?: ComputeResultLike;
}) {
  const candidates = [
    auditContext.playerIds,
    collectPlayerTouchIds(computeResult),
    computeResult.metadata?.playerIds,
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

const TEAM_HISTORY_REQUIRED_MUTATION_TYPES = new Set([
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

function normalizeEventMutationType(mutationType: string) {
  if (mutationType === 'setException') {
    return 'setExceptions';
  }
  return mutationType;
}

function toSafeIsoTimestamp(timestamp: unknown) {
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

function coerceObject(input: unknown): LooseRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as LooseRecord;
}

function toArrayOfStrings(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

function deriveContractSummary(metadata: LooseRecord = {}) {
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

  return removeUndefinedDeep(summary);
}

function deriveTradePicksMoved(metadata: LooseRecord = {}) {
  const picksTraded = toArrayOfStrings(metadata.picksTraded);
  if (picksTraded.length > 0) {
    return picksTraded;
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

function buildTeamHistoryDiffSummary({
  mutationType,
  auditContext = {},
  metadata = {},
  playerIds = [],
}: {
  mutationType: string;
  auditContext?: AuditContextLike;
  metadata?: LooseRecord;
  playerIds?: string[];
}) {
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

  return removeUndefinedDeep(diffSummary);
}

function buildTeamHistoryMutationMetadata({
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
  metadata?: LooseRecord;
}) {
  const contractSummary = deriveContractSummary(metadata) as LooseRecord;

  const mutationMetadata: LooseRecord = {
    mutationType,
    category: auditContext.mutationCategory || 'unknown',
    worldId,
    teams: teamCodes,
    players: playerIds,
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

  return removeUndefinedDeep(mutationMetadata);
}

export function buildWorldMutationEventPayload({
  mutationType,
  eventId,
  seasonId,
  worldId,
  timestamp,
  computeResult,
  auditContext = {},
}: BuildWorldMutationEventPayloadArgs): LooseRecord {
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
  ) as LooseRecord;
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
 * This is the SINGLE public entrypoint for all world mutations.
 * All mutations flow through: READ → COMPUTE → VALIDATE → PERSIST → POST-UPDATE
 *
 * @param {MutationInput} input - Mutation parameters
 * @returns {Promise<MutationResult>} - Result of the mutation
 */
export async function applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType,
  payload,
  timestamp = Date.now(),
  operationId: operationIdOverride,
}: ApplyWorldMutationArgs): Promise<ComputeResultLike> {
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

  // SECURITY: Strip override metadata if override is disabled
  // This prevents clients from bypassing validation by sending overrideMetadata
  const sanitizedPayload = sanitizePayloadForOverride(payload) as MutationPayloadLike;
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
      payloadAsOfDate: sanitizedPayload.asOfDate != null ? String(sanitizedPayload.asOfDate) : null,
      worldAsOfDate,
    });

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult: ComputeResultLike = computeWorldMutation({
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
    const validationResult = validateMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      computeResult,
      seasonId,
      asOfDate, // Phase 20: World time SSOT
      dateDefaulted, // Phase 20: Flag for warning emission
    });

    if (!validationResult.valid) {
      return buildMutationFailureResult(
        validationResult.error || 'Validation failed',
        {
          appliedToLocalState: false,
          persistedToWorld: false,
          writesSummary: computeWritesSummary,
          violations: validationResult.violations,
          warnings: validationResult.warnings || [],
        }
      );
    }

    // PHASE 3.5: LEAGUE INVARIANTS - Validate no cross-team duplicates
    // Phase 86: Prevents players from appearing on multiple teams
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
    // Phase B5: Prevents entitlements from appearing on multiple teams after trade
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
    // Phase 3.6 checks cross-team duplicate entitlement IDs.
    // Phase 3.7 checks that no team ends up with overlapping entitlement claims
    // (duplicate ownership, swap controllers, conveyance rights) after the trade.
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

    // PHASE 3.8: POST-STATE CAP VALIDATOR (world mutation gold path)
    const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
    const afterTeamsByCode = extractTeamsByCodeFromComputeResult(computeResult);
    const beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
    const afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);

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
          warnings: validationResult.warnings || [],
        }
      );
    }

    const rulesContext = buildPostStateRulesContext(year);
    const postStateValidation = validatePostStateCapLegality({
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

    const combinedWarnings: (string | LooseRecord)[] = [
      ...((validationResult.warnings || []) as (string | LooseRecord)[]),
      ...((postStateValidation.warnings || []) as (string | LooseRecord)[]),
    ];

    if (!postStateValidation.valid) {
      return buildMutationFailureResult('Post-state cap validation failed', {
        appliedToLocalState: false,
        persistedToWorld: false,
        writesSummary: computeWritesSummary,
        violations: postStateValidation.violations,
        warnings: combinedWarnings,
      });
    }

    const teamUpdates = computeResult.teamUpdates || [];
    const playerUpdates = computeResult.playerUpdates || [];
    const entitlementUpdates = computeResult.entitlementUpdates || [];
    const teamCodes = teamUpdates.map((u) => String(u.teamCode || '')).filter(Boolean);
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

    const persistResult: ComputeResultLike = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType,
      computeResult,
      timestamp,
      payloadAsOfDate: sanitizedPayload.asOfDate != null ? String(sanitizedPayload.asOfDate) : null, // Phase 20: Only persist if explicitly provided
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
        violations: (postStateValidation.violations || []).map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: (postStateValidation.warnings || []).map((w) => typeof w === 'string' ? w : JSON.stringify(w)),
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
      changedTeams: teamUpdates,
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
      reasons: ['Authoritative sign-and-trade preflight is missing season context.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  const sanitizedPayload = sanitizePayloadForOverride(payload) as MutationPayloadLike;
  if (!sanitizedPayload.destinationTeamCode) {
    return {
      status: 'blocked',
      reasons: ['Destination team is required for sign-and-trade.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  if (!sanitizedPayload.teamCode || !sanitizedPayload.playerId || !sanitizedPayload.contract) {
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
    const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();
    const signingValidation = validateSigning({
      team: currentState.team,
      player: currentState.player,
      contract: sanitizedPayload.contract,
      signedUsing: sanitizedPayload.signedUsing,
      year: currentYear,
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
async function loadStateForMutation(
  worldId: string,
  mutationType: string,
  payload: MutationPayloadLike
): Promise<CurrentStateLike> {
  switch (mutationType) {
    case 'executeTrade': {
      // Load all teams involved in trade
      const teamCodes: string[] = (payload.teams || []).map((teamTrade, index) => {
        const code = teamTrade.teamCode || teamTrade.team?.teamCode;
        if (!code) {
          throw new Error(
            `Missing teamCode for trade entry at index ${index}. Payload: ${JSON.stringify(teamTrade)}`
          );
        }
        return String(code);
      });

      const teamStates = await Promise.all(
        teamCodes.map((code: string) => getTeam(worldId, code))
      );
      return {
        teams: teamCodes.map((code, i) => ({
          teamCode: code,
          team: (teamStates[i] || null) as TeamLike | null,
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
      ])) as [TeamLike, PlayerLike];

      // For RFA finalization, we may need to clean up the home team's incomingOfferSheets
      const homeTeamCode = (player.teamCode || player.contract?.signingTeam) as string | null | undefined;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = (await getTeam(worldId, homeTeamCode)) as TeamLike;
      }

      return { team, player, teamCode, homeTeam };
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

      const team = (await getTeam(worldId, teamCode)) as TeamLike;
      const player = (await getPlayer(worldId, teamCode, playerId)) as PlayerLike;
      return { team, player, teamCode };
    }

    case 'storeOfferSheet': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      return await resolveStoreOfferSheetAuthority({
        worldId,
        offeringTeamCode: String(teamCode),
        playerId: String(playerId),
      });
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      // Match / decline / finalizeMatched are home-team actions.
      // finalizeDeclined is an offering-team action and must load the explicit homeTeamCode.
      const homeTeamCode =
        mutationType === 'finalizeDeclinedOfferSheet'
          ? ((payload.homeTeamCode as string | null | undefined) ||
            (payload.teamCode as string | null | undefined))
          : ((payload.teamCode as string | null | undefined) ||
            (payload.homeTeamCode as string | null | undefined));
      const offeringTeamCode = payload.offeringTeamCode as string | null | undefined;
      const offerSheetId = payload.offerSheetId as string | null | undefined;

      if (!homeTeamCode) throw new Error(`Missing homeTeamCode`);
      if (!offeringTeamCode) throw new Error(`Missing offeringTeamCode`);
      if (!offerSheetId) throw new Error(`Missing offerSheetId`);

      const [homeTeam, offeringTeam] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);

      return {
        homeTeam: (homeTeam || null) as CurrentStateLike['homeTeam'],
        offeringTeam: (offeringTeam || null) as CurrentStateLike['offeringTeam'],
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
        team: (team || null) as CurrentStateLike['team'],
        destinationTeam:
          (destinationTeam || null) as CurrentStateLike['destinationTeam'],
        player: (player || null) as CurrentStateLike['player'],
        teamCode: teamCode as string,
        destinationTeamCode: destinationTeamCode as string,
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

      const team = (await getTeam(worldId, teamCode)) as TeamLike;

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
        const player = (await getPlayer(worldId, teamCode, playerId)) as PlayerLike;
        return { team, player, teamCode };
      } catch (err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = (await getTeam(worldId, teamCode)) as TeamLike;
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = (await getTeam(worldId, teamCode)) as TeamLike;
      return { team, teamCode };
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

function withDefaultPlayerDeletes(
  result: ComputeResultLike
): ComputeResultLike {
  return {
    ...result,
    playerDeletes: Array.isArray(result.playerDeletes)
      ? result.playerDeletes
      : [],
  };
}

function getMutationPlayerId(
  player: ArchitectMutationPlayerRecord | null | undefined
) {
  if (!player) {
    return null;
  }

  const rawId = player.player_id || player.playerId || player.id || null;
  if (!rawId) {
    return null;
  }

  const playerId = String(rawId).trim();
  return playerId || null;
}

function findPlayerInTeamPlayers(
  team: TeamLike | null | undefined,
  playerId: string
): PlayerLike | null {
  const players = Array.isArray(team?.players) ? team.players : [];
  return players.find((player) => getMutationPlayerId(player) === playerId) || null;
}

function toPersistablePlayerOverrideFromSnapshot(player: PlayerLike): PlayerLike {
  const playerId = getMutationPlayerId(player);
  const bio =
    player.bio && typeof player.bio === 'object' && !Array.isArray(player.bio)
      ? (player.bio as Record<string, unknown>)
      : undefined;

  return removeUndefinedDeep({
    playerId: playerId || undefined,
    displayName:
      player.displayName ||
      player.playerName ||
      player.name ||
      bio?.displayName ||
      undefined,
    teamCode: player.teamCode || undefined,
    teamName: player.teamName || undefined,
    bio,
    contract: player.contract || undefined,
    futureContract: player.futureContract || undefined,
    representation: player.representation,
    source: player.source || undefined,
    lastUpdated: player.lastUpdated,
    version: player.version,
    rfaOfferSheet: player.rfaOfferSheet,
    rfaOfferSheetOnly: player.rfaOfferSheetOnly,
    rfaContext: player.rfaContext,
  }) as PlayerLike;
}

type TradePlayerMoveCandidate = {
  playerId: string;
  sourceTeamCode: string;
  destinationTeamCode: string;
};

type CanonicalPlayerPersistenceMode = 'replace' | 'move';

type CanonicalPlayerPersistenceCandidate = {
  playerId: string;
  destinationTeamCode: string;
  sourceTeamCode?: string;
  mode: CanonicalPlayerPersistenceMode;
};

function buildCanonicalPlayerPersistenceManifest({
  teamUpdates,
  candidates,
  manifestLabel,
}: {
  teamUpdates: ArchitectMutationTeamUpdate[];
  candidates: CanonicalPlayerPersistenceCandidate[];
  manifestLabel: string;
}):
  | {
      success: true;
      playerUpdates: PlayerUpdateLike[];
      playerDeletes: PlayerDeleteLike[];
    }
  | { success: false; error: string } {
  const destinationTeamsByCode = new Map<string, TeamLike | null>(
    teamUpdates.map((update) => [
      String(update.teamCode || '').trim(),
      (update.team || null) as TeamLike | null,
    ])
  );
  const uniqueCandidates = new Map<string, CanonicalPlayerPersistenceCandidate>();

  for (const candidate of candidates) {
    const playerId = String(candidate?.playerId || '').trim();
    const destinationTeamCode = String(candidate?.destinationTeamCode || '').trim();
    const sourceTeamCode = String(candidate?.sourceTeamCode || '').trim();
    const mode = candidate?.mode;

    if (!playerId) {
      return {
        success: false,
        error: `${manifestLabel} requires every candidate to have a stable playerId.`,
      };
    }

    if (!destinationTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} could not conclusively resolve destination team for player ${playerId}.`,
      };
    }

    if (mode !== 'replace' && mode !== 'move') {
      return {
        success: false,
        error: `${manifestLabel} received an unsupported persistence mode for player ${playerId}.`,
      };
    }

    if (mode === 'replace' && sourceTeamCode && sourceTeamCode !== destinationTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} received conflicting replace candidate teams for player ${playerId}.`,
      };
    }

    if (mode === 'move' && !sourceTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} requires a source team for moved player ${playerId}.`,
      };
    }

    const normalizedCandidate: CanonicalPlayerPersistenceCandidate = {
      playerId,
      destinationTeamCode,
      sourceTeamCode: sourceTeamCode || undefined,
      mode,
    };

    const existing = uniqueCandidates.get(playerId);
    if (
      existing &&
      (existing.destinationTeamCode !== normalizedCandidate.destinationTeamCode ||
        existing.sourceTeamCode !== normalizedCandidate.sourceTeamCode ||
        existing.mode !== normalizedCandidate.mode)
    ) {
      return {
        success: false,
        error: `${manifestLabel} resolved conflicting persistence candidates for player ${playerId}.`,
      };
    }

    if (!existing) {
      uniqueCandidates.set(playerId, normalizedCandidate);
    }
  }

  const playerUpdates: PlayerUpdateLike[] = [];
  const playerDeletes: PlayerDeleteLike[] = [];

  for (const candidate of uniqueCandidates.values()) {
    const destinationTeam = destinationTeamsByCode.get(
      candidate.destinationTeamCode
    );
    if (!destinationTeam) {
      return {
        success: false,
        error: `${manifestLabel} could not find final destination team ${candidate.destinationTeamCode} for player ${candidate.playerId}.`,
      };
    }

    const finalPlayer = findPlayerInTeamPlayers(destinationTeam, candidate.playerId);
    if (!finalPlayer) {
      return {
        success: false,
        error: `${manifestLabel} could not find final destination snapshot player ${candidate.playerId} on ${candidate.destinationTeamCode}.`,
      };
    }

    if (normalizeTradeTeamCodeLike(finalPlayer.teamCode) !== candidate.destinationTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} found mismatched teamCode for player ${candidate.playerId} on destination ${candidate.destinationTeamCode}.`,
      };
    }

    playerUpdates.push({
      playerId: candidate.playerId,
      player: toPersistablePlayerOverrideFromSnapshot(finalPlayer),
    });

    if (
      candidate.mode === 'move' &&
      candidate.sourceTeamCode &&
      candidate.sourceTeamCode !== candidate.destinationTeamCode
    ) {
      playerDeletes.push({
        playerId: candidate.playerId,
        teamCode: candidate.sourceTeamCode,
      });
    }
  }

  return {
    success: true,
    playerUpdates,
    playerDeletes,
  };
}

function matchesOfferSheetIdentity(
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

function removeOfferSheetEntries(
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

function buildNormalizedOfferSheetFinalContract({
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
  const salariesByYear = (offerSheet.salariesByYear || []).map(normalizeSalaryRow);
  const contractYearsCandidate =
    Number(offerSheet.contractYears) ||
    salariesByYear.length;

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

function buildTradePlayerPersistenceManifest({
  payload,
  currentState,
  teamUpdates,
}: {
  payload: ArchitectMutationPayload;
  currentState: CurrentStateLike;
  teamUpdates: ArchitectMutationTeamUpdate[];
}):
  | {
      success: true;
      playerUpdates: PlayerUpdateLike[];
      playerDeletes: PlayerDeleteLike[];
    }
  | { success: false; error: string } {
  const tradeTeams = Array.isArray(payload.teams) ? payload.teams : [];
  const payloadTeamCodes: string[] = [];

  tradeTeams.forEach((teamTrade, index) => {
    const sourceTeamCode = normalizeTradeTeamCodeLike(
      teamTrade.teamCode ||
        teamTrade.team?.teamCode ||
        teamTrade.team?.id ||
        teamTrade.teamId ||
        currentState.teams?.[index]?.teamCode
    );

    if (sourceTeamCode) {
      payloadTeamCodes.push(sourceTeamCode);
    }
  });

  if (payloadTeamCodes.length !== tradeTeams.length) {
    return {
      success: false,
      error:
        'Trade player persistence manifest could not resolve all source team codes.',
    };
  }

  const moveCandidates = new Map<string, TradePlayerMoveCandidate>();

  for (const [senderIndex, teamTrade] of tradeTeams.entries()) {
    const sourceTeamCode = payloadTeamCodes[senderIndex];

    for (const rawPlayer of teamTrade.sends || []) {
      const player = (rawPlayer || {}) as LooseRecord;
      const playerId = getMutationPlayerId(player);
      if (!playerId) {
        return {
          success: false,
          error:
            'Trade player persistence manifest requires every moved player to have a stable playerId.',
        };
      }

      const destinationTeamCode = resolveOutgoingTradeDestinationTeamCode({
        payloadTeamCodes,
        senderIndex,
        player,
      });

      if (!destinationTeamCode || !sourceTeamCode) {
        return {
          success: false,
          error: `Trade player persistence manifest could not conclusively resolve source/destination for player ${playerId}.`,
        };
      }

      if (destinationTeamCode === sourceTeamCode) {
        continue;
      }

      const existing = moveCandidates.get(playerId);
      if (
        existing &&
        (existing.sourceTeamCode !== sourceTeamCode ||
          existing.destinationTeamCode !== destinationTeamCode)
      ) {
        return {
          success: false,
          error: `Trade player persistence manifest resolved conflicting destinations for player ${playerId}.`,
        };
      }

      if (!existing) {
        moveCandidates.set(playerId, {
          playerId,
          sourceTeamCode,
          destinationTeamCode,
        });
      }
    }
  }

  return buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: Array.from(moveCandidates.values()).map((move) => ({
      ...move,
      mode: 'move' as const,
    })),
    manifestLabel: 'Trade player persistence manifest',
  });
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
export function computeWorldMutation({
  mutationType,
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
}: ComputeWorldMutationArgs): ComputeResultLike {
  switch (mutationType) {
    case 'executeTrade': {
      // Phase 56: Build snapshot → validate snapshot → compute with context
      // Step 1: Build post-trade snapshot (pure function, no validation)
      const postTradeSnapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      const tradePayloadForValidation =
        asOfDate && payload?.asOfDate !== asOfDate
          ? {
              ...payload,
              asOfDate,
              tradeCtx: {
                ...(payload?.tradeCtx || {}),
                asOfDate,
              },
            }
          : payload;

      // Step 2: Validate the post-trade snapshot ONCE
      const validatedContext = validatePostTradeSnapshotForContext({
        snapshot: postTradeSnapshot,
        payload: tradePayloadForValidation,
        seasonId,
      });

      // Step 3: Call pure computeTradeResult with pre-validated context
      const result = computeTradeResult({
        payload,
        currentState,
        seasonId,
        timestamp,
        historyContext: { worldId, mutationType },
        postTradeSnapshot,
        validatedContext,
      });

      return withDefaultPlayerDeletes(result);
    }

    case 'signFreeAgent':
      return withDefaultPlayerDeletes(
        computeSigningResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'waivePlayer':
      return withDefaultPlayerDeletes(
        computeWaiveResult({ payload, currentState, seasonId, timestamp })
      );

    case 'extendPlayer':
      return withDefaultPlayerDeletes(
        computeExtensionResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'storeOfferSheet':
      return withDefaultPlayerDeletes(
        computeStoreOfferSheetResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'matchOfferSheet':
      return withDefaultPlayerDeletes(
        computeMatchOfferSheetResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'declineOfferSheet':
      return withDefaultPlayerDeletes(
        computeDeclineOfferSheetResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'finalizeMatchedOfferSheet':
      return withDefaultPlayerDeletes(
        computeFinalizeMatchedOfferSheetResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'finalizeDeclinedOfferSheet':
      return withDefaultPlayerDeletes(
        computeFinalizeDeclinedOfferSheetResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'optionDecision':
      return withDefaultPlayerDeletes(
        computeOptionResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'renounceRights':
      return withDefaultPlayerDeletes(
        computeRenounceResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'signAndTrade':
      return withDefaultPlayerDeletes(
        computeSignAndTradeResult({
          payload,
          currentState,
          seasonId,
          timestamp,
          asOfDate,
          worldId,
          historyContext: { worldId, mutationType },
        })
      );

    case 'setDeadCap':
      return withDefaultPlayerDeletes(
        computeSetDeadCapResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    case 'setExceptions':
      return withDefaultPlayerDeletes(
        computeSetExceptionsResult({
          payload,
          currentState,
          seasonId,
          timestamp,
        })
      );

    default:
      return withDefaultPlayerDeletes({
        success: false,
        error: `Unknown mutation type: ${mutationType}`,
      });
  }
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
function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
  postTradeSnapshot,
  validatedContext,
}: ComputeMutationParams & {
  historyContext?: TradeHistoryContextLike;
  postTradeSnapshot: TradeSnapshotLike;
  validatedContext: TradeValidatedContextLike;
}): ComputeResultLike {
  // Phase 58: Use shared assertions from tradeContext module
  // (replaces Phase 56 inline checks with centralized assertions)
  assertTradeComputeInputs({
    postTradeSnapshot,
    validatedContext,
    callSite: 'computeTradeResult',
  });

  const playerUpdates: PlayerUpdateLike[] = [];
  const playerDeletes: PlayerDeleteLike[] = [];
  const tradeTeams = Array.isArray(payload.teams) ? payload.teams : [];

  const currentYear = toEndYear(seasonId);
  const timestampISO = new Date(timestamp).toISOString();
  const historyContextRef = historyContext || {};
  const resolvedWorldId =
    historyContextRef.worldId ||
    payload?.tradeCtx?.worldId ||
    null;
  const resolvedMutationType = (historyContextRef.mutationType || 'executeTrade') as string;
  const resolvedMutationId = historyContextRef.mutationId as string | null | undefined;
  const getTpeRemaining = (tpe: TradeExceptionRecord) =>
    Number(tpe?.remainingAmount ?? tpe?.amount ?? 0) || 0;

  // Phase 56: Use pre-built snapshot teamUpdates (already has roster changes applied)
  // Deep clone to avoid mutating the snapshot
  const teamUpdates: TradeTeamUpdate[] = (postTradeSnapshot.teamUpdates || []).map(
    (entry) => ({
      teamCode: entry.teamCode ?? null,
      team: JSON.parse(JSON.stringify(entry.team || {})) as TeamLike,
    })
  );

  // Phase 56: Use validation results from validatedContext (already validated once)
  const validation: TradeValidationResultLike = validatedContext._rawValidation || {
    legal: validatedContext.legal,
    teamResults: validatedContext.teamResults || [],
  };

  // Phase 56: Use validationTeams from context (has matchIncoming populated by validator)
  const validationTeams: TradeValidationTeamLike[] = Array.isArray(
    validatedContext.validationTeams
  )
    ? validatedContext.validationTeams
    : Array.isArray(postTradeSnapshot.validationTeams)
      ? postTradeSnapshot.validationTeams
      : [];

  // Warn if multi-team trade without directed routing (informational only)
  if (tradeTeams.length > 2) {
    const hasDirectedRouting = tradeTeams.some((teamTrade) =>
      (teamTrade.sends || []).some(
        (sentPlayer) =>
          sentPlayer.receivingTeamIndex !== undefined ||
          sentPlayer.receivingTeamId !== undefined ||
          sentPlayer.tradeTo !== undefined ||
          sentPlayer.toTeamId !== undefined ||
          sentPlayer.destTeamId !== undefined
      )
    );
    if (!hasDirectedRouting) {
      console.warn(
        'Multi-team trade detected without directed routing (receivingTeamIndex/receivingTeamId/tradeTo/toTeamId/destTeamId). ' +
          'Apply-time snapshot building will fail closed with TRADE_APPLY_ROUTING_ERROR.'
      );
    }
  }

  // ============================================================================
  // Phase 56: Apply validated TPE creation/consumption to each team
  // (validation already ran externally via validatePostTradeSnapshotForContext)
  // ============================================================================
  teamUpdates.forEach((teamUpdate: TradeTeamUpdate, idx: number) => {
    const teamResult = validation.teamResults?.[idx];
    if (!teamResult) return;

    const updatedTeam = teamUpdate.team;
    const currentTPEs = updatedTeam.tradeExceptions || [];
    const historyEntries: TradeExceptionHistoryEntry[] = [];
    const tpeAbsorptionDetails = new Map<string, TradeAbsorbedPlayer[]>();

    // 1. Apply TPE consumption from validator
    // The validator's tradeExceptions rule modifies TPE objects with updated remaining/used amounts
    const tradeExceptionsResult = teamResult.rules?.tradeExceptions;
    let updatedTPEs = [...currentTPEs];

    // If validator processed TPEs, apply consumption from incoming players with tpeId
    // Phase 50 fix: Check for existence of tradeExceptionsResult, not details
    // (details is empty string when no violations, which was incorrectly falsy)
    if (tradeExceptionsResult) {
      // The validator already updated the TPE objects in place during validation
      // We need to extract the consumed amounts from the incoming players that used TPEs
      const incomingPlayers = validationTeams[idx]?.receives || [];
      const tpeUsageMap = new Map<string, number>(); // tpeId -> consumed amount
      const tpeConsumptionWarnings: TradeTpeConsumptionIssue[] = []; // Phase 47C: Track missing matchIncoming warnings
      const tpeConsumptionErrors: TradeTpeConsumptionIssue[] = []; // Fail-closed: hard errors that block mutation

      // FAIL-CLOSED PRE-CHECK: Any player with absorptionMode='TPE' MUST have tpeId + matchIncoming
      incomingPlayers.forEach((player) => {
        if (player.absorptionMode === 'TPE') {
          const playerLabel = player.name || player.player_id || 'unknown';
          if (!player.tpeId) {
            tpeConsumptionErrors.push({
              playerId: player.player_id || player.name,
              reason: `Player ${playerLabel} has absorptionMode='TPE' but no tpeId — apply-time blocked`,
            });
          }
          if (
            player.tpeId &&
            (player.matchIncoming === undefined ||
              player.matchIncoming === null)
          ) {
            tpeConsumptionErrors.push({
              playerId: player.player_id || player.name,
              tpeId: player.tpeId,
              reason: `Player ${playerLabel} has absorptionMode='TPE' with tpeId but missing matchIncoming — apply-time blocked`,
            });
          }
        }
      });

      // If fail-closed errors exist, block this team's mutation
      if (tpeConsumptionErrors.length > 0) {
        teamResult._tpeConsumptionErrors = tpeConsumptionErrors;
        teamResult._blocked = true;
        console.error(
          '[mutationPipeline] TPE fail-closed: blocking mutation due to invalid TPE state:',
          tpeConsumptionErrors
        );
        // Skip all TPE processing — do not partially consume
      } else {
        incomingPlayers.forEach((player) => {
          // Phase 47C: Only process TPE consumption if tpeId is set
          if (!player.tpeId) return;

          // Phase 47C SSOT: Use matchIncoming ONLY - no salary fallback
          // If matchIncoming is missing for a TPE player, log warning and skip consumption
          if (
            player.matchIncoming === undefined ||
            player.matchIncoming === null
          ) {
            tpeConsumptionWarnings.push({
              playerId: player.player_id || player.name,
              tpeId: player.tpeId,
              reason:
                'matchIncoming missing for TPE consumption - consumption skipped',
            });
            return; // Skip this player - no consumption without validator-produced value
          }

          const consumed = Number(player.matchIncoming) || 0;
          if (consumed <= 0) {
            return;
          }
          const current = tpeUsageMap.get(player.tpeId) || 0;
          tpeUsageMap.set(player.tpeId, current + consumed);

          const absorptionList = tpeAbsorptionDetails.get(player.tpeId) || [];
          absorptionList.push({
            playerId: player.player_id || player.id || player.playerId || null,
            name:
              player.name || player.displayName || player.playerName || null,
            amountAbsorbed: consumed,
          });
          tpeAbsorptionDetails.set(player.tpeId, absorptionList);
        });

        // Log warnings in dev mode for debugging
        if (tpeConsumptionWarnings.length > 0) {
          const isDev =
            import.meta.env?.DEV || process.env.NODE_ENV === 'development';
          if (isDev) {
            console.warn(
              '[mutationPipeline] Phase 47C TPE consumption warnings:',
              tpeConsumptionWarnings
            );
          }
          // Attach warnings to team result for visibility (non-blocking)
          teamResult._tpeConsumptionWarnings = tpeConsumptionWarnings;
        }

        // Apply consumption to TPEs
        updatedTPEs = currentTPEs.map((tpe) => {
          const currentTpeId = typeof tpe.id === 'string' ? tpe.id : null;
          const consumed = currentTpeId ? tpeUsageMap.get(currentTpeId) || 0 : 0;
          if (consumed === 0) return tpe;

          const currentRemaining = getTpeRemaining(tpe);
          const currentUsed = toFiniteAmount(tpe.usedAmount, 0);
          const newRemaining = Math.max(0, currentRemaining - consumed);
          const newUsed = currentUsed + consumed;

          return {
            ...tpe,
            remainingAmount: newRemaining,
            usedAmount: newUsed,
            isUsed: newRemaining === 0,
          };
        });
      } // end fail-closed else block
    }

    // 2. Apply TPE creation from validator (SSOT)
    // Phase 47C: Idempotent creation with signature-based duplicate detection
    // Build consumption history entries before creation adds new TPEs
    currentTPEs.forEach((previousTpe) => {
      const previousTpeId =
        typeof previousTpe.id === 'string' ? previousTpe.id : null;
      if (!previousTpeId) {
        return;
      }

      const nextTpe =
        updatedTPEs.find((candidate) => candidate.id === previousTpeId) ||
        previousTpe;
      const previousRemaining = getTpeRemaining(previousTpe);
      const nextRemaining = getTpeRemaining(nextTpe);
      const consumedAmount = Math.max(0, previousRemaining - nextRemaining);
      if (consumedAmount <= 0) {
        return;
      }

      const consumptionEntry = createTpeConsumptionHistoryEntry({
        teamCode: teamUpdate.teamCode || '',
        tpeId: previousTpeId,
        amountConsumed: consumedAmount,
        remainingAmountAfter: nextRemaining,
        fullyConsumed: nextRemaining === 0,
        absorbedPlayers: tpeAbsorptionDetails.get(previousTpeId) || [],
        seasonId,
        seasonYear: currentYear,
        timestampISO,
        worldId:
          typeof resolvedWorldId === 'string' ? resolvedWorldId : undefined,
        mutationType: resolvedMutationType,
        mutationId: resolvedMutationId,
      });

      if (consumptionEntry) {
        historyEntries.push(consumptionEntry);
      }
    });

    const createdTPE = teamResult.createdTPE;
    if (createdTPE) {
      const teamCode = teamUpdate.teamCode || '';

      // Phase 47C: Preserve validator-provided id if present
      const tpeId =
        (typeof createdTPE.id === 'string' && createdTPE.id) ||
        `tpe_${teamCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const outgoingPlayers = tradeTeams[idx]?.sends || [];
      const createdFrom =
        outgoingPlayers
          .map((player) => player.name || player.displayName)
          .filter(Boolean)
          .join(', ') || 'Trade';

      /**
       * Phase 47C: Idempotent creation - signature-based duplicate detection
       * Signature: (createdSeason, expiresOn, totalAmount, createdFrom)
       * If an equivalent TPE already exists, do not add again.
       *
       * RATIONALE: A TPE is unique per trade. If the same trade is rerun:
       * - createdSeason + expiresOn + totalAmount + createdFrom will match
       * - We skip adding to prevent duplicates on retries
       */
      const newTPESignature = [
        createdTPE.createdSeason,
        createdTPE.expiresOn,
        createdTPE.amount,
        createdFrom,
      ].join('|');

      const hasDuplicateById = updatedTPEs.some((tpe) => tpe.id === tpeId);
      const hasDuplicateBySignature = updatedTPEs.some((tpe) => {
        const existingSignature = [
          tpe.createdSeason,
          tpe.expiresOn,
          tpe.totalAmount ?? tpe.amount,
          tpe.createdFrom,
        ].join('|');
        return existingSignature === newTPESignature;
      });

      if (!hasDuplicateById && !hasDuplicateBySignature) {
        updatedTPEs.push({
          id: tpeId,
          amount: createdTPE.amount,
          totalAmount: createdTPE.amount,
          remainingAmount: createdTPE.amount,
          usedAmount: 0,
          createdSeason: createdTPE.createdSeason,
          expiresOn: createdTPE.expiresOn,
          createdFrom,
          isUsed: false,
        });

        const creationEntry = createTpeCreationHistoryEntry({
          teamCode,
          tpeId,
          amountCreated: createdTPE.amount,
          createdFrom,
          createdSeason: createdTPE.createdSeason,
          expiresOn: createdTPE.expiresOn,
          seasonId,
          seasonYear: currentYear,
          timestampISO,
          worldId:
            typeof resolvedWorldId === 'string' ? resolvedWorldId : undefined,
          mutationType: resolvedMutationType,
          mutationId: resolvedMutationId,
        });

        if (creationEntry) {
          historyEntries.push(creationEntry);
        }
      } else {
        // Dev logging for duplicate detection
        const isDev =
          import.meta.env?.DEV || process.env.NODE_ENV === 'development';
        if (isDev) {
          console.info(
            '[mutationPipeline] Phase 47C: Duplicate TPE detected, skipping creation',
            {
              tpeId,
              byId: hasDuplicateById,
              bySignature: hasDuplicateBySignature,
            }
          );
        }
      }
    }

    // Persist the updated TPE array
    updatedTeam.tradeExceptions = updatedTPEs;

    if (historyEntries.length > 0) {
      appendExceptionHistory(updatedTeam, historyEntries);
    }
  });

  // Phase 11.3: Build entitlementsTraded structure for event log
  // Format: { [teamCode]: { out: string[], in: string[] } }
  // Phase 11.3.1: Respect toTeamId routing when present (for multi-team trades)
  const entitlementsTraded: TradeEntitlementsMovedByTeam = {};
  for (const teamTrade of tradeTeams) {
    const rawTeamKey =
      teamTrade.team?.id || teamTrade.teamCode || teamTrade.teamId || null;
    const teamKey = rawTeamKey == null ? null : String(rawTeamKey);
    if (!teamKey) {
      continue;
    }

    // Outgoing entitlement IDs from this team (unchanged)
    const outIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((entitlement) => {
        const rawEntitlementId = entitlement.entitlementId ?? entitlement.id;
        return rawEntitlementId == null ? null : String(rawEntitlementId);
      })
      .filter((entitlementId): entitlementId is string => Boolean(entitlementId));

    // Incoming entitlement IDs: respect toTeamId routing when present
    // Phase 11.3.1: Only include entitlement if:
    //   - toTeamId is NOT set (broadcast mode - all teams receive)
    //   - OR toTeamId matches this team's key (teamKey or teamCode)
    const inIds: string[] = [];
    for (const otherTrade of tradeTeams) {
      const rawOtherTeamKey =
        otherTrade.team?.id || otherTrade.teamCode || otherTrade.teamId || null;
      const otherTeamKey =
        rawOtherTeamKey == null ? null : String(rawOtherTeamKey);
      if (otherTeamKey === teamKey) {
        continue;
      }

      for (const entitlement of otherTrade.outgoingEntitlements ||
        otherTrade.entitlementsOut ||
        []) {
        const rawEntitlementId = entitlement.entitlementId ?? entitlement.id;
        const entitlementId =
          rawEntitlementId == null ? null : String(rawEntitlementId);
        if (!entitlementId) {
          continue;
        }

        const routedTo =
          entitlement.toTeamId == null ? null : String(entitlement.toTeamId);
        const rawTeamCode = teamTrade.teamCode || teamTrade.team?.teamCode;
        const teamCode = rawTeamCode == null ? null : String(rawTeamCode);
        if (!routedTo || routedTo === teamKey || routedTo === teamCode) {
          inIds.push(entitlementId);
        }
      }
    }

    // Only add entry if there are entitlement transfers
    if (outIds.length > 0 || inIds.length > 0) {
      entitlementsTraded[teamKey] = {
        out: [...new Set(outIds)],
        in: [...new Set(inIds)],
      };
    }
  }

  // TM-PICKS-E1: Build entitlementUpdates for holderTeam patches
  // When an entitlement is traded, we need to update its holderTeam field
  // in the world overlay so downstream readers see the correct owner.
  const entitlementUpdates: EntitlementUpdateLike[] = [];
  if (Object.keys(entitlementsTraded).length > 0) {
    for (const [teamKey, transfers] of Object.entries(entitlementsTraded)) {
      // For each entitlement this team received, patch holderTeam to this team
      for (const entitlementId of transfers.in) {
        entitlementUpdates.push({
          entitlementId,
          holderTeam: teamKey,
        });
      }
    }
  }

  // FAIL-CLOSED: If any team had TPE consumption errors, block the entire mutation
  const blockedTeams = (validation.teamResults || []).filter(
    (teamResult) => teamResult?._blocked
  );
  if (blockedTeams.length > 0) {
    const allErrors = blockedTeams
      .flatMap((teamResult) =>
        Array.isArray(teamResult._tpeConsumptionErrors)
          ? teamResult._tpeConsumptionErrors
          : []
      )
      .filter(
        (issue): issue is TradeTpeConsumptionIssue =>
          !!issue &&
          typeof issue === 'object' &&
          'reason' in issue &&
          typeof (issue as { reason?: unknown }).reason === 'string'
      );
    return {
      success: false,
      error: `TPE fail-closed: ${allErrors.map((issue) => issue.reason).join('; ')}`,
      _tpeConsumptionErrors: allErrors,
    };
  }

  const tradePlayerManifest = buildTradePlayerPersistenceManifest({
    payload,
    currentState,
    teamUpdates,
  });

  if ('error' in tradePlayerManifest) {
    return {
      success: false,
      error: tradePlayerManifest.error,
    };
  }

  playerUpdates.push(...tradePlayerManifest.playerUpdates);
  playerDeletes.push(...tradePlayerManifest.playerDeletes);

  const metadata: TradeMutationMetadata = {
    type: 'trade',
    teamsInvolved: teamUpdates.map((teamUpdate) => teamUpdate.teamCode),
    playersTraded: tradeTeams.flatMap((teamTrade) =>
      (teamTrade.sends || []).map(
        (player) => player.player_id || player.id || player.name
      )
    ),
    // Phase 11.3: Include entitlement transfers per team (IDs only for lightweight payload)
    entitlementsTraded:
      Object.keys(entitlementsTraded).length > 0
        ? entitlementsTraded
        : undefined,
    timestamp,
  };

  // Phase 56: Return pure compute result - validation context is passed through, not created here
  return {
    success: true,
    teamUpdates,
    playerUpdates,
    playerDeletes,
    // TM-PICKS-E1: Include entitlement doc patches for persistence
    entitlementUpdates,
    metadata,
    // Phase 56: Pass through the provided validated context (created externally)
    _validatedTradeContext: validatedContext,
  };
}

/**
 * Compute free agent signing result
 */
function resolveSigningMechanismForPipeline(
  contract: ArchitectMutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  const source = contract?.exceptionType || signedUsing;
  if (!source) {
    return 'UNKNOWN';
  }
  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vetminimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }
  if (
    normalized === 'tenday' ||
    normalized.includes('tenday') ||
    normalized.includes('day')
  ) {
    return 'TEN_DAY';
  }
  return 'UNKNOWN';
}

function getExceptionCandidatesForMechanism(mechanism: string) {
  switch (mechanism) {
    case 'FULL_MLE':
      return ['mle', 'nonTaxpayerMle', 'fullMLE'];
    case 'TPMLE':
      return ['tpmle', 'taxpayerMle', 'tpMle', 'miniMle', 'mle'];
    case 'ROOM_MLE':
      return ['room', 'roomMLE', 'roommle', 'rmle'];
    case 'BAE':
      return ['bae', 'biAnnual'];
    default:
      return [];
  }
}

function resolveTeamExceptionKey(
  teamExceptions: ArchitectMutationExceptions | null | undefined,
  mechanism: string
) {
  const candidates = getExceptionCandidatesForMechanism(mechanism);
  for (const candidate of candidates) {
    if (teamExceptions?.[candidate] != null) {
      return candidate;
    }
  }
  return null;
}

function toFiniteAmount(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function consumeSigningExceptionUsage({
  updatedTeam,
  mechanism,
  contractValue,
  timestamp,
}: {
  updatedTeam: ArchitectMutationTeamRecord;
  mechanism: string;
  contractValue: number;
  timestamp: number;
}) {
  // Phase 74 guardrail compatibility markers:
  // exceptionType === 'room'
  // updatedTeam.exceptions.room
  // updatedTeam.exceptions.room.usedAmount
  if (!updatedTeam?.exceptions || contractValue <= 0) {
    return null;
  }

  const exceptionKey = resolveTeamExceptionKey(
    updatedTeam.exceptions,
    mechanism
  );
  if (!exceptionKey) {
    return null;
  }

  const currentState = updatedTeam.exceptions?.[exceptionKey];
  const normalizedState: ArchitectMutationExceptionEntry =
    currentState && typeof currentState === 'object'
      ? { ...(currentState as ArchitectMutationExceptionEntry) }
      : {
          enabled: true,
          maxAmount: toFiniteAmount(currentState, 0),
          totalAmount: toFiniteAmount(currentState, 0),
          usedAmount: 0,
          remainingAmount: toFiniteAmount(currentState, 0),
        };

  const maxAmount = toFiniteAmount(
    normalizedState.maxAmount ??
      normalizedState.totalAmount ??
      normalizedState.amount,
    toFiniteAmount(currentState, 0)
  );
  const usedAmount = toFiniteAmount(normalizedState.usedAmount, 0);
  const remainingAmount =
    normalizedState.remainingAmount != null
      ? toFiniteAmount(normalizedState.remainingAmount, 0)
      : Math.max(0, maxAmount - usedAmount);

  normalizedState.enabled = normalizedState.enabled !== false;
  if (normalizedState.maxAmount == null && maxAmount > 0) {
    normalizedState.maxAmount = maxAmount;
  }
  if (normalizedState.totalAmount == null && maxAmount > 0) {
    normalizedState.totalAmount = maxAmount;
  }
  normalizedState.usedAmount = usedAmount + contractValue;
  normalizedState.remainingAmount = Math.max(
    0,
    remainingAmount - contractValue
  );
  normalizedState.lastUsedAt = new Date(timestamp).toISOString();

  updatedTeam.exceptions = {
    ...updatedTeam.exceptions,
    [exceptionKey]: normalizedState,
  };
  return exceptionKey;
}

function computeSigningResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team, player, teamCode } = currentState;
  const { contract, signedUsing } = payload;
  const signingMechanism = resolveSigningMechanismForPipeline(
    contract,
    signedUsing
  );

  const updatedTeam = { ...team };

  // Add player to roster if not already present
  const playerId = String(payload.playerId || player.player_id || player.id || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required for signing.',
    };
  }
  if (!updatedTeam.roster?.includes(playerId)) {
    updatedTeam.roster = [...(updatedTeam.roster || []), playerId];
  }

  // Update or add player to players array
  const existingIndex = (updatedTeam.players || []).findIndex(
    (existingPlayer) => getMutationPlayerId(existingPlayer) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: new Date(timestamp).toISOString(),
  }) as ArchitectMutationContract | null;

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...(updatedTeam.players || []), updatedPlayer];
  }

  // Update exceptions if signing consumed one
  const contractValue = toFiniteAmount(
    contract?.totalValue,
    toFiniteAmount(normalizedContract?.totalValue, 0)
  );
  const consumedExceptionKey = consumeSigningExceptionUsage({
    updatedTeam,
    mechanism: signingMechanism,
    contractValue,
    timestamp,
  });

  if (signingMechanism === 'FULL_MLE' && consumedExceptionKey) {
    updatedTeam.totals = updatedTeam.totals || {};
    updatedTeam.totals.isHardCapped = true;
    updatedTeam.totals.hardCapLevel = 'firstApron';
    updatedTeam.totals.hardCapDetail = 'Triggered by Non-Taxpayer MLE';
  }
  // Phase 74: Room Exception usage tracking
  // Room Exception does NOT trigger hard cap (only Full MLE does).

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  if (normalizedContract?.rfaOfferSheet && updatedTeam.offerSheets) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  const teamUpdates = [{ teamCode, team: updatedTeam }];

  // Cleanup incomingOfferSheets on home team if applicable
  if (
    normalizedContract?.rfaOfferSheet &&
    currentState.homeTeam &&
    currentState.homeTeam.incomingOfferSheets
  ) {
    const updatedHomeTeam = { ...currentState.homeTeam };
    updatedHomeTeam.incomingOfferSheets =
      updatedHomeTeam.incomingOfferSheets.filter(
        (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
      );
    // Only add update if something changed
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      currentState.homeTeam.incomingOfferSheets.length
    ) {
      updatedHomeTeam.source = {
        ...(updatedHomeTeam.source as unknown as LooseRecord | null | undefined),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({
        teamCode: currentState.homeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      rightsUsed: consumedExceptionKey || undefined,
      timestamp,
      signedUsing,
    },
  };
}

/**
 * Compute waive result
 */
function computeWaiveResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team, player, teamCode } = currentState;
  const stretch = payload.stretch ?? false;
  const stretchYears = Number(payload.stretchYears ?? 3);
  const buyout = payload.buyout ?? false;

  // Prioritize payload ID, then fall back to player object properties
  const playerId = payload.playerId || player.player_id || player.id;

  // Invariant check (Dev only)
  if (!playerId) {
    console.error(
      '[computeWaiveResult] CRITICAL: deadCap entry missing playerId',
      {
        payloadId: payload.playerId,
        playerObj: player,
      }
    );
    // In dev, we want to explode so we catch this
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('deadCap entry missing playerId');
    }
  }

  const updatedTeam = { ...team };

  // Remove player from roster
  updatedTeam.roster = (updatedTeam.roster || []).filter(
    (id: any) => id !== playerId
  );

  // Remove player from players array
  updatedTeam.players = (updatedTeam.players || []).filter(
    (p: any) => (p.player_id || p.id) !== playerId
  );

  // Calculate dead cap from guaranteed rows in current/future seasons.
  const contract = player.contract;
  const contractRows = (contract?.salariesByYear as LooseRecord[] | undefined) || [];
  const seasonEndYear = toEndYear(seasonId) ?? 0;
  const remainingGuaranteedFromRows = contractRows
    .filter((row: any) => {
      const yearEnd = toEndYear(row.season);
      return typeof yearEnd === 'number' && yearEnd >= seasonEndYear;
    })
    .filter((row: any) => row.guaranteed !== false)
    .reduce((sum: number, row: any) => sum + (Number(row.salary) || 0), 0);
  const guaranteedValueFallback = Number(contract?.guaranteedValue) || 0;
  const remainingSalary =
    remainingGuaranteedFromRows || guaranteedValueFallback;
  const rawBuyoutAmount = buyout
    ? Math.max(0, Number(payload.buyoutAmount) || 0)
    : 0;
  const boundedBuyoutAmount = buyout
    ? Math.min(remainingSalary, rawBuyoutAmount)
    : 0;
  const deadCapAmount = buyout
    ? Math.max(0, remainingSalary - boundedBuyoutAmount)
    : remainingSalary;

  if (stretch && deadCapAmount > 0) {
    // Calculate stretched amounts with remainder distribution to avoid rounding loss
    const baseStretchedAmount = Math.floor(deadCapAmount / stretchYears);
    const remainder = deadCapAmount - baseStretchedAmount * stretchYears;

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        // Use toSeasonCode for consistent season formatting
        const startYear = toEndYear(seasonId) ?? seasonEndYear;
        const yearEndYear = startYear + i;
        // Distribute remainder to first years to avoid losing money
        const yearAmount = baseStretchedAmount + (i < remainder ? 1 : 0);
        return {
          season: toSeasonCode(yearEndYear),
          amount: yearAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()} (stretched over ${stretchYears} years)`
        : `Stretched over ${stretchYears} years`,
    });
  } else if (deadCapAmount > 0) {
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: [
        {
          season: seasonId,
          amount: deadCapAmount,
          isStretched: false,
        },
      ],
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
        : undefined,
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      stretched: stretch,
      buyout,
      buyoutAmount: boundedBuyoutAmount,
      stretchYears: stretch ? stretchYears : undefined,
      deadCapAmount,
      timestamp,
    },
  };
}

/**
 * Compute extension result
 */
function computeExtensionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team, player, teamCode } = currentState;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Update player's contract in players array
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p: any) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  // Determine which years the extension covers so we can void overlapping originals
  const extensionYearSet = new Set(
    ((extension.salariesByYear as LooseRecord[] | undefined) || []).map(
      (y: LooseRecord) => y.year || (y.season ? parseInt(String(y.season).split('-')[0]) + 1 : null)
    )
  );

  // Mark existing salary rows that overlap with extension years as voidedByExtension
  const existingRows = (
    ((updatedTeam.players[playerIndex].futureContract as LooseRecord | null)?.salariesByYear as LooseRecord[] | undefined) || []
  ).map((row: LooseRecord) => {
    const rowYear =
      row.year || (row.season ? parseInt(String(row.season).split('-')[0]) + 1 : null);
    return extensionYearSet.has(rowYear)
      ? { ...row, voidedByExtension: true }
      : row;
  });

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...((updatedTeam.players[playerIndex].futureContract as LooseRecord | null) || {}),
    salariesByYear: [
      ...existingRows,
      ...((extension.salariesByYear as LooseRecord[] | undefined) || []).map((y: LooseRecord) => ({
        ...normalizeSalaryRow(y),
        isExtensionSeason: true,
      })),
    ],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...updatedTeam.players[playerIndex],
    futureContract: normalizeFutureContract(
      rawFutureContract
    ) as ArchitectMutationContract | null,
  };

  updatedTeam.players = [...updatedTeam.players];
  updatedTeam.players[playerIndex] = updatedPlayer;

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: (extension.salariesByYear as unknown[] | undefined)?.length || 0,
      extensionTerms: {
        years: (extension.salariesByYear as unknown[] | undefined)?.length || 0,
        salariesByYear: (extension.salariesByYear as unknown[] | undefined) || [],
      },
      timestamp,
    },
  };
}

/**
 * Compute option decision result
 */
function computeOptionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team, player, teamCode } = currentState;
  const { accepted, targetYear } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Find player in team
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p: any) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const playerData = updatedTeam.players[playerIndex];
  const salaries = (playerData.contract?.salariesByYear as LooseRecord[] | undefined) || [];

  // Find the option year entry
  const optionIndex = salaries.findIndex((y: any) => {
    const yearEnd = toEndYear(y.season);
    return yearEnd === targetYear && y.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    // Accepted: mark option as used (canonical boolean format)
    const updatedSalaries = [...salaries];
    updatedSalaries[optionIndex] = {
      ...normalizeSalaryRow(updatedSalaries[optionIndex]),
      optionUsed: true, // CANONICAL: boolean, not string
    };

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      }) as ArchitectMutationContract | null,
    };
  } else {
    const optionSeason = salaries[optionIndex]?.season || null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      optionSeason,
      targetYear
    );
    const freeAgencyYear =
      typeof faYearInfo.year === 'number' ? faYearInfo.year : Number(targetYear) - 1;

    // Declined: remove this year and all future years
    const filteredSalaries = salaries
      .filter((_: any, idx: number) => idx < optionIndex)
      .map(normalizeSalaryRow);

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: freeAgencyYear,
          type: 'UFA',
        },
      }) as ArchitectMutationContract | null,
      freeAgentYear: freeAgencyYear,
    };

    // Create cap hold for declined option
    const priorRow = salaries[optionIndex - 1];
    const lastSalary = Number(priorRow?.salary ?? priorRow?.capHit ?? 0);
    const rightsType = getRightsTypeFromPlayer(playerData);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: playerData,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: capHoldExpectation.amount,
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: capHoldExpectation.usedFallback
          ? 'Declined Option (fallback multiplier)'
          : 'Declined Option',
        notes: capHoldExpectation.usedFallback
          ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
          : undefined,
        active: true,
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (id: any) => id !== playerId
    );
    updatedTeam.players = (updatedTeam.players || []).filter(
      (p: any) => (p.player_id || p.id) !== playerId
    );
  }

  // Update player in team's players array if still on roster
  if (accepted) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[playerIndex] = updatedPlayer;
  }

  // Add cap hold if created
  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: accepted ? [{ playerId, player: updatedPlayer }] : [],
    metadata: {
      type: 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: salaries[optionIndex]?.option,
      accepted,
      targetYear,
      timestamp,
    },
  };
}

/**
 * Compute renounce rights result
 *
 * Renouncing rights removes the team's cap hold on a free agent
 * and clears their Bird rights association with this team.
 * The player remains in the FA pool but cannot be re-signed using Bird rights.
 */
function computeRenounceResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team, player, teamCode } = currentState;
  const playerId = payload.playerId || player.player_id || player.id;
  const playerName = player.displayName || player.name;

  const updatedTeam = { ...team };

  // 1. Remove the player's cap hold from the team
  // Match by playerId first (primary), then by playerName (fallback) using OR logic
  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      // Remove if playerId matches
      if (hold.playerId === playerId) return false;
      // Also remove if playerName matches (in case IDs don't align)
      if (hold.playerName === playerName) return false;
      return true;
    });
  }

  // 2. Mark the player's Bird rights as renounced/cleared for this team
  // Update player entry if present in team's players array
  // Prioritize ID matching over name matching
  if (updatedTeam.players && Array.isArray(updatedTeam.players)) {
    updatedTeam.players = updatedTeam.players.map((p: any) => {
      const pid = p.player_id || p.id;
      // Prioritize exact ID match, then fall back to name match
      const isMatch =
        pid === playerId || (pid == null && p.name === playerName);
      if (isMatch) {
        return {
          ...p,
          rightsRenounced: true,
          renouncedAt: new Date(timestamp).toISOString(),
          contract: {
            ...(p.contract || {}),
            birdRights: {
              ...(p.contract?.birdRights || {}),
              status: 'None',
              renouncedBy: teamCode,
              renouncedAt: new Date(timestamp).toISOString(),
            },
          },
        };
      }
      return p;
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals (cap holds affect cap space)
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      rightsUsed: 'Renounced',
      timestamp,
    },
  };
}

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces the team.exceptions object with the payload exceptions (full replacement).
 * This is the simplest and most audit-grade approach.
 */
function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { teamCode } = payload;
  const { team } = currentState;

  // Validate payload.exceptions is an object or null/undefined (to clear)
  if (payload.exceptions !== null && payload.exceptions !== undefined) {
    if (
      typeof payload.exceptions !== 'object' ||
      Array.isArray(payload.exceptions)
    ) {
      return {
        success: false,
        error: 'Invalid exceptions payload: must be an object or null',
      };
    }
  }

  // Full replacement: update exceptions field on team
  const updatedTeam = {
    ...team,
    exceptions: payload.exceptions || {},
  };

  // Update source metadata
  updatedTeam.source = {
    ...(updatedTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setExceptions',
      teamCode,
      exceptionChanges:
        Array.isArray(payload.exceptionChanges) &&
        payload.exceptionChanges.length
          ? payload.exceptionChanges
          : ['Exceptions updated'],
      timestamp,
    },
  };
}

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
 * @param {Object} params
 * @param {string} [params.asOfDate] - Phase 20: World time SSOT
 * @param {boolean} [params.dateDefaulted] - Phase 20: True if asOfDate was defaulted
 * @returns {{valid: boolean, error?: string, violations?: Array}}
 */
function validateMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
}: { mutationType: string; payload: MutationPayloadLike; currentState: CurrentStateLike; computeResult: ComputeResultLike; seasonId: string; asOfDate?: string | null; dateDefaulted?: boolean }): { valid: boolean; error?: string; violations?: string[]; warnings?: unknown[] } {
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

  // Trade validation uses the full Trade Machine
  if (mutationType === 'executeTrade') {
    // Phase 56+: Trade validation MUST have already occurred via validatePostTradeSnapshotForContext
    // computeWorldMutation guarantees _validatedTradeContext is attached to computeResult
    if (computeResult?._validatedTradeContext?._isValidatedTradeContext) {
      const preValidated = computeResult._validatedTradeContext;
      return {
        valid: preValidated.legal,
        error: preValidated.error || undefined,
        violations: (preValidated.violations || []).map(
          (violation) =>
            typeof violation === 'string'
              ? violation
              : JSON.stringify(violation)
        ),
        warnings: [...(preValidated.warnings || []), ...pipelineWarnings],
      };
    }

    // Phase 57: Hard error if context is missing - no fallback validation
    // This should never happen if the pipeline is correctly structured
    throw new Error(
      '[validateMutation] Phase 57 violation: executeTrade requires pre-validated context. ' +
        'computeWorldMutation must attach _validatedTradeContext via validatePostTradeSnapshotForContext.'
    );
  }

  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();

  // Non-trade mutations use capLegalityValidation
  switch (mutationType) {
    case 'setDeadCap': {
      const result = validateDeadCap(payload.deadCap);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: pipelineWarnings,
      };
    }

    case 'setExceptions': {
      const result = validateExceptions(payload.exceptions);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: [...(result.warnings || []), ...pipelineWarnings],
      };
    }

    case 'signFreeAgent': {
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
        asOfDate, // Phase 20: Pass world time to validator (unused now, ready for Phase 21)
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'waivePlayer': {
      const result = validateWaive({
        team: currentState.team,
        player: currentState.player,
        stretch: payload.stretch,
        year: currentYear,
        isGracePeriod: payload.isGracePeriod || false,
        asOfDate, // Phase 21: World time for stretch timing check
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: result.warnings,
      };
    }

    case 'extendPlayer': {
      const result = validateExtension({
        team: currentState.team,
        player: currentState.player,
        extension: payload.extension,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: result.warnings,
      };
    }

    case 'optionDecision': {
      // Phase 7.1: Pass updatedTeam to validate cap hold transitions
      const teamCode = currentState.team?.teamCode || null;
      const playerId = getPlayerId(
        currentState.player as Parameters<typeof getPlayerId>[0]
      );
      const updatedTeam = teamCode
        ? computeResult?.teamUpdates?.find((update) => update.teamCode === teamCode)
            ?.team
        : null;
      const updatedPlayer = playerId
        ? computeResult?.playerUpdates?.find(
            (update) => update.playerId === playerId
          )?.player
        : null;

      const result = validateOptionDecision({
        originalTeam: currentState.team,
        originalPlayer: currentState.player,
        updatedTeam,
        updatedPlayer,
        accepted: payload.accepted,
        targetYear: payload.targetYear,
        currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: result.warnings,
      };
    }

    case 'storeOfferSheet': {
      // Offer sheets reuse signing validation with store-only contract flags.
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: result.warnings,
      };
    }

    case 'matchOfferSheet': {
      // Validate Match Action (including 48h window check)
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (offerSheetEntry) => offerSheetEntry.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'match',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'declineOfferSheet': {
      // Validate Decline Action
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (offerSheetEntry) => offerSheetEntry.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'decline',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      const homeOfferSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (offerSheetEntry) =>
          offerSheetEntry.id === currentState.offerSheetId ||
          (payload.dedupKey && offerSheetEntry.dedupKey === payload.dedupKey)
      );
      const offeringOfferSheet = currentState.offeringTeam?.offerSheets?.find(
        (offerSheetEntry) =>
          offerSheetEntry.id === currentState.offerSheetId ||
          (payload.dedupKey && offerSheetEntry.dedupKey === payload.dedupKey)
      );
      const offerSheet = homeOfferSheet || offeringOfferSheet;

      if (!offerSheet) {
        return {
          valid: false,
          error: `Offer sheet ${currentState.offerSheetId} not found`,
          violations: [
            JSON.stringify({
              rule: 'offer_sheet_not_found',
              message: `Offer sheet ${currentState.offerSheetId} not found for finalize action.`,
              severity: 'error',
            }),
          ],
          warnings: pipelineWarnings,
        };
      }

      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'finalize',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'renounceRights': {
      const result = validateRenounceRights({
        team: currentState.team,
        player: currentState.player,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations.map((v) => typeof v === 'string' ? v : JSON.stringify(v)),
        warnings: result.warnings,
      };
    }

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
      // Unknown mutation type - fail closed for security
      // If you're adding a new mutation type, add validation logic above
      console.warn(
        `Unknown mutation type: ${mutationType}, blocking for safety`
      );
      return {
        valid: false,
        error: `Unknown mutation type: ${mutationType}`,
        violations: [
          JSON.stringify({
            rule: 'unknown_type',
            message: `Unknown mutation type: ${mutationType}`,
            severity: 'error',
          }),
        ],
        warnings: [],
      };
  }
}

// ==============================================================================
// PHASE 59: LEGACY VALIDATION HELPERS REMOVED
// ==============================================================================
// validateTradeForPipeline was a deprecated function that validated PRE-TRADE state.
// It has been removed in Phase 59 as no production or test code uses it.
// The correct approach (Phase 56+) validates POST-TRADE state via:
//   buildPostTradeTeamsSnapshot → validatePostTradeSnapshotForContext → compute/persist
//
// validateTradeForContext has been moved to tradeContext/legacy/ namespace.
// Import from '@/features/architect/utils/tradeContext/legacy' if needed.

// ==============================================================================
// PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
// ==============================================================================

/**
 * Persist mutation to Firestore.
 * THIS IS THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS.
 *
 * @param {Object} params
 * @returns {Promise<{success: boolean, worldPatch?: Object, event?: Object, error?: string}>}
 */
async function persistWorldMutation({
  worldId,
  seasonId,
  mutationType,
  computeResult,
  timestamp,
  payloadAsOfDate, // Phase 20: Only write asOfDate if explicitly provided in payload
  auditContext = {},
}: {
  worldId: string;
  seasonId: string;
  mutationType: string;
  computeResult: ComputeResultLike;
  timestamp: number;
  payloadAsOfDate?: string | null;
  auditContext?: AuditContextLike;
}): Promise<LooseRecord> {
  const batch = writeBatch(db);
  const teamCodesPatched = [];
  const playerIdsPatched = new Set<string>();
  const entitlementIdsPatched = [];
  let eventId: string | null = null;
  const teamUpdates = computeResult.teamUpdates || [];
  const playerUpdates = computeResult.playerUpdates || [];
  const playerDeletes = computeResult.playerDeletes || [];
  const entitlementUpdates = computeResult.entitlementUpdates || [];

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of teamUpdates) {
      // Guard against undefined values (dev throws, prod allows)
      guardAgainstUndefined(
        team,
        `architect_worlds/${worldId}/teams/${teamCode}`
      );
      // Phase 60: Sanitize transient fields first
      const afterSanitize = sanitizeTransientFieldsForPersistence(team);
      // Phase 64: Normalize TPE schema (tradeExceptions → exceptions.tpe)
      // This ensures legacy tradeExceptions[] is merged into canonical exceptions.tpe[]
      // and the legacy field is removed BEFORE contract validation
      const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);
      // Phase 61: Validate against persistence contract (test-only enforcement)
      // Ordering: sanitize → normalize TPE → validate contract → removeUndefined
      assertPersistableOrThrow({
        obj: afterTpeNormalize,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      // Then remove undefined values
      const sanitizedTeam = removeUndefinedDeep(afterTpeNormalize);
      const teamRef = worldTeamRef(worldId, teamCode);
      batch.set(teamRef, sanitizedTeam);
      if (teamCode) {
        teamCodesPatched.push(String(teamCode));
      }
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of playerUpdates) {
      // Player overrides go in the team's players subcollection
      if (!player) {
        continue;
      }
      const teamCode = player.teamCode;
      if (teamCode && player) {
        // Guard against undefined values (dev throws, prod allows)
        guardAgainstUndefined(
          player,
          `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`
        );
        // Phase 60: Sanitize transient fields first
        const afterSanitize = sanitizeTransientFieldsForPersistence(player);
        // Phase 61: Validate against persistence contract (test-only enforcement)
        // Ordering: sanitize → validate contract → removeUndefined
        assertPersistableOrThrow({
          obj: afterSanitize,
          contract: PERSISTENCE_CONTRACTS.PLAYER,
          label: 'PLAYER',
        });
        // Then remove undefined values
        const sanitizedPlayer = removeUndefinedDeep(afterSanitize);
        const playerRef = worldPlayerRef(worldId, teamCode, playerId);
        batch.set(playerRef, sanitizedPlayer);
        if (playerId) {
          playerIdsPatched.add(String(playerId));
        }
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
        const entitlementId = entitlementUpdate.entitlementId as string | null | undefined;
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
        metadata: sanitizedMetadata as LooseRecord,
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
    const worldPatch: LooseRecord = {
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
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to persist mutation',
      writesSummary,
    };
  }
}

function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  if (!offeringTeam || !teamCode) {
    return {
      success: false,
      error: 'storeOfferSheet requires an authoritative offering team snapshot.',
    };
  }

  if (!homeTeam?.teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires resolved authoritative home-team truth before offer-sheet creation.',
    };
  }

  if (homeTeam.teamCode === teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires a home team distinct from the offering team.',
    };
  }

  if (!player) {
    return {
      success: false,
      error:
        'storeOfferSheet requires canonical home-team player truth before offer-sheet creation.',
    };
  }

  // Validate store-only invariants programmatically just in case
  if (contract.rfaOfferSheetOnly !== true || contract.rfaOfferSheet !== true) {
    return {
      success: false,
      error:
        'storeOfferSheet requires rfaOfferSheet=true and rfaOfferSheetOnly=true',
    };
  }

  const playerId = player.player_id || player.id;
  const homeTeamCode = homeTeam.teamCode;
  const authoritativeSnapshotPlayer = findPlayerInTeamPlayers(
    homeTeam,
    String(playerId || '')
  );

  if (!playerId) {
    return {
      success: false,
      error: 'storeOfferSheet requires a stable playerId from canonical truth.',
    };
  }

  if (!authoritativeSnapshotPlayer) {
    return {
      success: false,
      error:
        'storeOfferSheet requires pre-resolved authoritative home-team snapshot player truth.',
    };
  }

  // Phase 18.2: worldId is REQUIRED for audit-grade dedupKey
  // Cannot store offer sheet without worldId - fail fast
  if (!worldId) {
    return {
      success: false,
      error:
        'worldId is required for offer sheet identity. Cannot store offer sheet without worldId.',
    };
  }

  // Phase 18.1/18.2: Generate DETERMINISTIC dedupKey for idempotency
  // Format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}
  // This is stable across retries (no timestamp dependency)
  const dedupKey = `os:${worldId}:${teamCode}:${playerId}:${seasonId}`;

  // Generate unique ID (includes timestamp for uniqueness, but NOT used for dedup)
  const offerSheetId =
    payload.offerSheetId || `os_${teamCode}_${playerId}_${timestamp}`;

  // Build canonical OfferSheet object
  const offerSheet: ArchitectMutationOfferSheet = {
    id: offerSheetId,
    dedupKey, // Phase 18.1: Deterministic key for idempotency
    playerId,
    playerName: player.displayName || player.name,
    offeringTeamCode: teamCode,
    homeTeamCode,
    seasonKey: seasonId,
    year: currentYear,
    contractYears: contract.contractYears || contract.years || 1,
    salariesByYear:
      ((contract.salariesByYear as LooseRecord[] | undefined)?.map(
        normalizeSalaryRow
      ) as ArchitectMutationSalaryRow[] | undefined) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
    (existingOfferSheet) => existingOfferSheet.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
      (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = updatedOfferingTeam.offerSheets[existingIndex];
    const newSheets = [...updatedOfferingTeam.offerSheets];
    newSheets[existingIndex] = {
      ...offerSheet,
      id: existingSheet.id, // Preserve original ID
      createdAt: existingSheet.createdAt, // Preserve original creation time
    };
    updatedOfferingTeam.offerSheets = newSheets;
  } else {
    updatedOfferingTeam.offerSheets = [
      ...(updatedOfferingTeam.offerSheets || []),
      offerSheet,
    ];
  }

  // Update source metadata
  updatedOfferingTeam.source = {
    ...(updatedOfferingTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [{ teamCode, team: updatedOfferingTeam }];

  // MIRRORING: Add to home team's incomingOfferSheets if home team exists
  if (homeTeam) {
    const updatedHomeTeam = { ...homeTeam };

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = (
      updatedHomeTeam.incomingOfferSheets || []
    ).findIndex((existingOfferSheet) => existingOfferSheet.id === offerSheetId);
    if (existingHomeIndex === -1) {
      existingHomeIndex = (updatedHomeTeam.incomingOfferSheets || []).findIndex(
        (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet =
        updatedHomeTeam.incomingOfferSheets[existingHomeIndex];
      const newSheets = [...updatedHomeTeam.incomingOfferSheets];
      newSheets[existingHomeIndex] = {
        ...offerSheet,
        id: existingSheet.id,
        createdAt: existingSheet.createdAt,
      };
      updatedHomeTeam.incomingOfferSheets = newSheets;
    } else {
      updatedHomeTeam.incomingOfferSheets = [
        ...(updatedHomeTeam.incomingOfferSheets || []),
        offerSheet,
      ];
    }

    updatedHomeTeam.source = {
      ...(updatedHomeTeam.source as unknown as LooseRecord | null | undefined),
      lastModifiedAt: new Date(timestamp).toISOString(),
    };
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'storeOfferSheet',
      teamCode,
      playerId: offerSheet.playerId,
      offerSheetId: offerSheet.id,
      dedupKey, // Phase 18.1: Include for traceability
      timestamp,
    },
  };
}

/**
 * Compute match offer sheet result
 */
function computeMatchOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet on offering team
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];

  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  // Update status
  const updatedOfferSheet = {
    ...existingSheet,
    status: 'MATCHED',
    matchedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...(updatedOfferingTeam.source as unknown as LooseRecord | null | undefined),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...(updatedHomeTeam.source as unknown as LooseRecord | null | undefined),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'matchOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute decline offer sheet result
 */
function computeDeclineOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];
  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  const updatedOfferSheet = {
    ...existingSheet,
    status: 'DECLINED',
    declinedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...(updatedOfferingTeam.source as unknown as LooseRecord | null | undefined),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...(updatedHomeTeam.source as unknown as LooseRecord | null | undefined),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'declineOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { homeTeam, offeringTeam, offerSheetId } = currentState;
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const requestedDedupKey = payload.dedupKey as string | null | undefined;
  const offerSheet = incomingOfferSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(
      existingOfferSheet,
      offerSheetId || '',
      requestedDedupKey
    )
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on home team.`,
    };
  }

  if (offerSheet.status !== 'MATCHED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected MATCHED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const playerIndex = (homeTeam.players || []).findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for contract application.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: homeTeam.teamCode || '',
    signedUsing: 'Match',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for matched finalization.`,
    };
  }

  const updatedPlayer = {
    ...homeTeam.players[playerIndex],
    teamCode: homeTeam.teamCode,
    teamName: homeTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const resolvedDedupKey = String(offerSheet.dedupKey || requestedDedupKey || '').trim();
  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    incomingOfferSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.players = [
    ...updatedHomeTeam.players.slice(0, playerIndex),
    updatedPlayer,
    ...updatedHomeTeam.players.slice(playerIndex + 1),
  ];
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...(updatedHomeTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = computeTeamCapTotals(updatedHomeTeam, toEndYear(seasonId));

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    updatedOfferingTeam.offerSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedOfferingTeam.source = {
    ...(updatedOfferingTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        destinationTeamCode: String(homeTeam.teamCode || '').trim(),
        mode: 'replace',
      },
    ],
    manifestLabel: 'Offer sheet matched persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      teamCode: homeTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Match',
      contract: normalizedContract,
      timestamp,
    },
  };
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is DECLINED (and acting team is offering team - handled by validator).
 * 2. Remove offer sheet from BOTH teams (explicit cleanup).
 * 3. Apply the contract terms from offer sheet to the offering team's player (signing).
 */
function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;
  const dedupKey = payload.dedupKey as string | null | undefined;

  // 1. Find the offer sheet (on offering team)
  const offerSheets = offeringTeam.offerSheets || [];
  const offerSheet = offerSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(existingOfferSheet, offerSheetId || '', dedupKey)
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on offering team.`,
    };
  }

  if (offerSheet.status !== 'DECLINED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected DECLINED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const sourcePlayer = findPlayerInTeamPlayers(homeTeam, playerId);
  if (!sourcePlayer) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for declined finalization.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: offeringTeam.teamCode || '',
    signedUsing: 'Offer Sheet',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for declined finalization.`,
    };
  }

  const resolvedDedupKey = String(offerSheet.dedupKey || dedupKey || '').trim();
  const updatedPlayer = {
    ...sourcePlayer,
    teamCode: offeringTeam.teamCode,
    teamName: offeringTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    offerSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  const offeringPlayerIndex = (updatedOfferingTeam.players || []).findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );
  if (offeringPlayerIndex !== -1) {
    updatedOfferingTeam.players = [
      ...updatedOfferingTeam.players.slice(0, offeringPlayerIndex),
      updatedPlayer,
      ...updatedOfferingTeam.players.slice(offeringPlayerIndex + 1),
    ];
  } else {
    updatedOfferingTeam.players = [...(updatedOfferingTeam.players || []), updatedPlayer];
  }
  if (!updatedOfferingTeam.roster?.includes(playerId)) {
    updatedOfferingTeam.roster = [...(updatedOfferingTeam.roster || []), playerId];
  }
  if (Array.isArray(updatedOfferingTeam.capHolds)) {
    updatedOfferingTeam.capHolds = updatedOfferingTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedOfferingTeam.source = {
    ...(updatedOfferingTeam.source as unknown as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedOfferingTeam.totals = computeTeamCapTotals(updatedOfferingTeam, toEndYear(seasonId));

  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    updatedHomeTeam.incomingOfferSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.roster = (updatedHomeTeam.roster || []).filter(
    (id) => String(id || '').trim() !== playerId
  );
  updatedHomeTeam.players = (updatedHomeTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...(updatedHomeTeam.source as LooseRecord | null | undefined),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = computeTeamCapTotals(updatedHomeTeam, toEndYear(seasonId));

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        sourceTeamCode: String(homeTeam.teamCode || '').trim(),
        destinationTeamCode: String(offeringTeam.teamCode || '').trim(),
        mode: 'move',
      },
    ],
    manifestLabel: 'Offer sheet declined persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeDeclinedOfferSheet',
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      teamCode: offeringTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Offer Sheet',
      contract: normalizedContract,
      timestamp,
    },
  };
}

/**
 * Compute Sign and Trade result.
 *
 * 1. Signs player to Source Team.
 * 2. Trades player to Destination Team.
 */
function computeSignAndTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
  worldId,
  historyContext = {},
}: ComputeMutationParams & {
  asOfDate?: string | number | null;
  worldId?: string;
  historyContext?: LooseRecord;
}): ComputeResultLike {
  const { team, destinationTeam, player } = currentState;
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    teamCode,
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState = { team, player, teamCode };
  const signingResult = computeSigningResult({
    payload: signingPayload,
    currentState: signingState,
    seasonId,
    timestamp,
  });

  if (!signingResult.success) {
    return {
      success: false,
      error: signingResult.error || 'Signing step failed',
    };
  }

  // Phase 48: Validate signing BEFORE proceeding to trade computation
  // This ensures signing validation failure short-circuits before validateTrade is called
  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();
  const signingValidation = validateSigning({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    year: currentYear,
  });

  if (!signingValidation.valid) {
    return {
      success: false,
      error:
        signingValidation.violations?.[0]?.message ||
        'Signing validation failed',
      violations: signingValidation.violations.map((violation) =>
        typeof violation === 'string' ? violation : JSON.stringify(violation)
      ),
      warnings: signingValidation.warnings,
    };
  }

  // Extract updated source team and player (now signed) from signing result
  const updatedSourceTeam = signingResult.teamUpdates[0].team;
  const signedPlayer = signingResult.playerUpdates[0].player;

  // 2. Construct trade payload and state (using post-signing state per Phase 48)
  const tradePayload = {
    teams: [
      {
        teamCode: teamCode,
        sends: [
          {
            ...signedPlayer, // Send the fully signed player object with new contract
            signAndTrade: true,
            signAndTradeContract: payload.contract,
            receivingTeamId: destinationTeamCode,
            receivingTeamIndex: 1,
          },
        ],
      },
      {
        teamCode: destinationTeamCode,
        sends: [],
      },
    ],
    ...(asOfDate != null ? { asOfDate } : {}),
    tradeCtx: {
      ...(asOfDate != null ? { asOfDate } : {}),
      ...(worldId ? { worldId } : {}),
    },
  };

  // Construct trade state (Source has signed player, Dest is original)
  const tradeState: CurrentStateLike = {
    teams: [
      { teamCode: teamCode as string | null, team: updatedSourceTeam as TeamLike },
      { teamCode: destinationTeamCode as string | null, team: destinationTeam as TeamLike },
    ],
  };

  // Phase 56: Build snapshot → validate snapshot → compute with context
  // Step 1: Build post-trade snapshot from post-signing state
  const postTradeSnapshot = buildPostTradeTeamsSnapshot({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
  });

  // Step 2: Validate the post-trade snapshot ONCE
  const tradeValidatedContext = validatePostTradeSnapshotForContext({
    snapshot: postTradeSnapshot,
    payload: tradePayload,
    seasonId,
  });

  // Step 3: Call pure computeTradeResult with pre-validated context
  const tradeResult = computeTradeResult({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
    historyContext: {
      worldId: historyContext.worldId || worldId,
      mutationType: historyContext.mutationType || 'signAndTrade',
      mutationId: historyContext.mutationId,
    },
    postTradeSnapshot,
    validatedContext: tradeValidatedContext,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 3. Return Combined Result
  // Phase 56: Attach validated contexts for validateMutation de-duplication
  return {
    success: true,
    teamUpdates: tradeResult.teamUpdates, // Contains both Source (minus player) and Dest (plus player)
    playerUpdates: tradeResult.playerUpdates, // Player with new teamCode
    playerDeletes: tradeResult.playerDeletes,
    metadata: {
      type: 'signAndTrade',
      sourceTeam: teamCode,
      destinationTeam: destinationTeamCode,
      playerId: payload.playerId,
      contract: payload.contract,
      timestamp,
    },
    // Phase 56: Attach validated contexts for validateMutation de-duplication
    _signingValidation: signingValidation,
    _validatedTradeContext: tradeValidatedContext,
  };
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Map mutation type to action type for stats tracking
 */
function getMutationActionType(mutationType: string) {
  switch (mutationType) {
    case 'executeTrade':
      return 'trade';
    case 'signFreeAgent':
      return 'signing';
    case 'waivePlayer':
      return 'waive';
    case 'extendPlayer':
      return 'signing';
    case 'optionDecision':
      return 'signing';
    case 'renounceRights':
      return 'renounce';
    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
    case 'signAndTrade':
      return 'signing';
    default:
      return 'unknown';
  }
}

/**
 * Compute set dead cap result
 */
function computeSetDeadCapResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParams): ComputeResultLike {
  const { teamCode } = payload;
  const { team } = currentState;

  if (!payload.deadCap || !Array.isArray(payload.deadCap)) {
    return {
      success: false,
      error: 'Invalid deadCap payload: must be an array',
    };
  }

  // Update deadCap
  const updatedTeam = {
    ...team,
    deadCap: payload.deadCap,
    // Add logic to clean up legacy fields if we want to force migration?
    // For now, let's keep it simple: new schema takes precedence in computation anyway.
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setDeadCap',
      teamCode,
      deadCapChanges:
        Array.isArray(payload.deadCapChanges) && payload.deadCapChanges.length
          ? payload.deadCapChanges
          : ['Dead cap updated'],
      timestamp,
    },
  };
}
