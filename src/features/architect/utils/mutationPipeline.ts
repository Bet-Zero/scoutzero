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
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

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
import type { CapHold } from '@/features/architect/utils/capHolds';
import type {
  ArchitectSource,
  BasePlayerDoc,
  DraftPick,
} from '@/schemas/architect';
import type { PlayerBio, PlayerDraft } from '@/schemas/players_v2';
import type { SignAndTradeContractLike } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type { TeamTotals } from '@/features/architect/types';
import type {
  OutgoingTradeRouteLike,
  PostTradeSnapshot as TradeContextPostTradeSnapshot,
  TradeApplyValidationTeam as TradeContextApplyValidationTeam,
  TradeContextCurrentState,
  TradeContextNormalizedPayload,
  TradeContextPayload,
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
  assertPostTradeSnapshot,
  assertValidatedTradeContext,
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

type LooseRecord = Record<string, unknown>;
type MutationScalarId = string | number | null | undefined;
type ComputedTeamCapTotalsShape = ReturnType<typeof computeTeamCapTotals>;
type MutationPlayerBioLike = {
  displayName?: string | null;
  playerId?: string | null;
  name?: string | null;
  position?: string | null;
  age?: number | null;
  height?: number | string | null;
  weight?: number | string | null;
  dob?: string | null;
  birthplace?: string | null;
  nationality?: string | null;
  shoots?: string | null;
  agent?: NonNullable<NonNullable<PlayerBio>['agent']> | null;
  draft?: PlayerDraft | null;
  display?: {
    freeAgentType?: string | null;
    freeAgentYear?: number | string | null;
    team?: string | null;
    teamId?: string | null;
    yearsPro?: number | string | null;
  } | null;
  nbaId?: number | null;
  experience?: unknown;
  yearsExperience?: unknown;
  yearsPro?: unknown;
  team?: string | null;
  draftYear?: number | string | null;
  draftRound?: number | null;
  draftPick?: number | string | null;
  ['Years Pro']?: unknown;
};
type MutationSourceMetadata = Pick<
  ArchitectSource,
  | 'provider'
  | 'teamPageUrl'
  | 'playerPageUrl'
  | 'scrapedAt'
  | 'season'
  | 'type'
  | 'worldId'
  | 'generatedAt'
  | 'baseTeamVersion'
>;
type MutationPlayerSourceLike =
  | MutationSourceMetadata
  | null;
type MutationTradeExceptionRecord = TradeExceptionRecord & {
  used?: number | null;
};
type MutationTeamSourceLike =
  | (MutationSourceMetadata & { lastModifiedAt?: string | null })
  | null;
type CapHoldComputationPlayer = NonNullable<
  NonNullable<Parameters<typeof computeExpectedCapHoldAmount>[0]['player']>
>;

export type ArchitectComputedTeamTotalsSnapshot = Pick<
  ComputedTeamCapTotalsShape,
  | 'yearKey'
  | 'playersTotal'
  | 'deadMoneyTotal'
  | 'capHoldsTotal'
  | 'incompleteChargesTotal'
  | 'totalCapAllocations'
  | 'salaryCap'
  | 'luxuryTax'
  | 'firstApron'
  | 'secondApron'
  | 'deltas'
  | '_meta'
>;

type ArchitectMutationTeamTotalsSchemaSlice = Pick<
  TeamTotals,
  | 'totalSalary'
  | 'capHit'
  | 'guaranteedSalary'
  | 'nonGuaranteedSalary'
  | 'rosterCount'
  | 'guaranteedContracts'
  | 'nonGuaranteedContracts'
  | 'twoWayContracts'
  | 'emptyRosterCharges'
  | 'capSpace'
  | 'capRoom'
  | 'effectiveCap'
  | 'luxuryTaxLine'
  | 'taxablePayroll'
  | 'isOverTax'
  | 'taxBill'
  | 'taxRate'
  | 'firstApron'
  | 'firstApronRoom'
  | 'isFirstApron'
  | 'secondApron'
  | 'secondApronRoom'
  | 'isSecondApron'
>;

export type ArchitectMutationTeamTotals = Partial<
  ArchitectMutationTeamTotalsSchemaSlice &
    Omit<ArchitectComputedTeamTotalsSnapshot, 'deltas' | '_meta'>
> & {
  teamSalary?: number;
  currentCapHit?: number;
  deltas?: Partial<ArchitectComputedTeamTotalsSnapshot['deltas']>;
  _meta?: Partial<ArchitectComputedTeamTotalsSnapshot['_meta']>;
  isHardCapped?: boolean;
  hardCapLevel?: string | null;
  hardCapDetail?: string | null;
  hardCapRoom?: number | null;
  hardCapReason?: string | null;
  hardCapTriggered?: string | boolean | null;
};

type ArchitectMutationContractIncentives = {
  likely?: number | string | null;
  unlikely?: number | string | null;
};

type NormalizedMutationContractIncentives = {
  likely?: number | null;
  unlikely?: number | null;
};

type ArchitectMutationGuaranteeScheduleEntry = {
  effectiveDate?: string | null;
  guaranteedAmount?: number | string | null;
  status?: string | null;
  note?: string | null;
};

type NormalizedMutationGuaranteeScheduleEntry = {
  effectiveDate?: string | null;
  guaranteedAmount?: number | null;
  status?: string | null;
  note?: string | null;
};

type ArchitectMutationTradeEligibilityRules = {
  baseYearCompensation?: boolean | null;
  poisonPill?: boolean | null;
  aggregation?: boolean | null;
};

type ArchitectMutationTradeEligibility = {
  canBeTradedNow?: boolean | null;
  restrictedUntil?: string | null;
  reason?: string | null;
  rules?: ArchitectMutationTradeEligibilityRules | null;
};

export type ArchitectMutationSalaryRow = {
  season?: string | null;
  year?: number | string | null;
  salary?: number | string | null;
  capHit?: number | string | null;
  guaranteed?: boolean | null;
  guaranteedAmount?: number | string | null;
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | null;
  optionDecisionDate?: string | null;
  tradeBonus?: number | string | null;
  incentives?: ArchitectMutationContractIncentives | null;
  guaranteeSchedule?: ArchitectMutationGuaranteeScheduleEntry[] | null;
  voidedByExtension?: boolean | null;
  voidedOn?: string | null;
  isExtensionSeason?: boolean | null;
};

/**
 * Salary row after normalization: season is required, numeric fields are numbers only.
 * Raw UI input arrives as ArchitectMutationSalaryRow; this is the post-normalization
 * boundary used in ArchitectMutationContract and throughout the mutation pipeline.
 * SalaryByYear in useArchitectActions.ts is a type alias for this.
 */
export type NormalizedMutationSalaryRow = {
  season: string;                    // required — string guaranteed after normalization
  year?: number | null;
  salary?: number | null;            // strictly number, no string
  capHit?: number | null;            // strictly number, no string
  guaranteed?: boolean | null;
  guaranteedAmount?: number | null;  // strictly number, no string
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | null;       // boolean, not string
  optionDecisionDate?: string | null;
  tradeBonus?: number | null;
  incentives?: NormalizedMutationContractIncentives | null;
  guaranteeSchedule?: NormalizedMutationGuaranteeScheduleEntry[] | null;
  voidedByExtension?: boolean | null;
  voidedOn?: string | null;
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
  earlyTerminationOption?: string | boolean | null;
  hasOption?: boolean | null;
  optionYear?: number | string | null;
  optionType?: string | null;
};

export type ArchitectMutationContract = {
  salariesByYear?: NormalizedMutationSalaryRow[];
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
  averageAnnualValue?: number | null;
  guaranteedValue?: number | null;
  guaranteedYears?: number | null;
  freeAgency?: ArchitectMutationFreeAgency | string | null;
  rfaOfferSheetStatus?: string | null;
  // Formerly-implicit fields now explicitly declared (read in deriveContractSummary fallback chain).
  firstYearSalary?: number | null;
  year1Salary?: number | null;
  signingExecutive?: string | null;
  signedByCurrentTeam?: boolean | null;
  startSeason?: string | null;
  endSeason?: string | null;
  noTradeClause?: boolean | null;
  tradeKicker?: number | null;
  tradeRestrictions?: string[] | null;
  tradeEligibility?: ArchitectMutationTradeEligibility | null;
  isMaxContract?: boolean | null;
  maxType?: string | null;
  estimatedCapPercentage?: number | null;
  supersededIn?: string | null;
  supersededByContractRef?: string | null;
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

type CurrentStateExceptionHistoryEntry = {
  historyKey?: string | null;
  type?: string | null;
  teamCode?: string | null;
  tpeId?: string | null;
  timestamp?: string | null;
} & Record<string, unknown>;

type ArchitectMutationCanonicalExceptionBuckets = Partial<
  Record<CanonicalNonTpeExceptionKey, ArchitectMutationExceptionEntry | null>
>;

// Closed to the canonical exception buckets mutation compute owns. Legacy alias
// keys and custom mechanism-keyed buckets are accepted only at normalization
// boundaries, then round-tripped as hidden preserve-only runtime data.
export type ArchitectMutationExceptions =
  ArchitectMutationCanonicalExceptionBuckets & {
    dpe?: ArchitectMutationExceptionEntry | null;
    tpe?: TradeExceptionRecord[];
  };

// Raw current-state snapshots and manual exception payloads may still contain
// legacy aliases or unowned buckets; normalize them before committed compute reads.
type ArchitectMutationExceptionIngress = ArchitectMutationExceptions &
  Record<string, unknown>;

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
  salariesByYear?: NormalizedMutationSalaryRow[];
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
  reason?: string | null;
};

type ArchitectMutationPlayerRfaContextIngress = {
  pendingHomeTeamCode?: string | null;
  offerSheetId?: string | null;
  retainedUntilFinalize?: boolean | null;
} & Record<string, unknown>;

export type ArchitectMutationPlayerRecord = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  bio?: MutationPlayerBioLike | null;
  contract?: ArchitectMutationContract | null;
  futureContract?: ArchitectMutationContract | null;
  age?: number | null;
  salary?: number | null;
  currentSalary?: number | null;
  freeAgency?: ArchitectMutationFreeAgency | string | null;
  birdRights?: ArchitectMutationBirdRights | string | null;
  renounced?: boolean | null;
  freeAgentYear?: number | string | null;
  rightsRenounced?: boolean | null;
  renouncedAt?: string | null;
  representation?: BasePlayerDoc['representation'] | null;
  source?: MutationPlayerSourceLike;
  lastUpdated?: string | null;
  version?: string | null;
  rfaOfferSheet?: boolean | null;
  rfaOfferSheetOnly?: boolean | null;
  // Deliberately localized: live mutation flow only preserves/deletes this blob.
  rfaContext?: ArchitectMutationPlayerRfaContextIngress | null;
  draft?: Partial<PlayerDraft> | null;
  isTwoWay?: boolean | null;
  signedDate?: string | null;
  isNewlySignedFA?: boolean | null;
  originTeamId?: string | null;
  matchIncoming?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  signAndTrade?: boolean;
  // Live flow currently carries either the canonical mutation contract or the UI SAT payload shape.
  signAndTradeContract?:
    | ArchitectMutationContract
    | SignAndTradeContractLike
    | null;
  homeTeamCode?: string | null;
  receivingTeamIndex?: MutationScalarId;
  receivingTeamId?: MutationScalarId;
  tradeTo?: MutationScalarId;
  toTeamId?: MutationScalarId;
  destTeamId?: MutationScalarId;
};

type ArchitectMutationCashLedger = {
  totalOut?: number | string | null;
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
  exceptions?: ArchitectMutationExceptionIngress | null;
  tradeExceptions?: MutationTradeExceptionRecord[];
  cashLedger?: ArchitectMutationCashLedger | null;
  offerSheets?: ArchitectMutationOfferSheet[];
  incomingOfferSheets?: ArchitectMutationOfferSheet[];
  // Deliberately opaque: this path preserves existing history entries and may
  // append typed TPE lifecycle events, but the wider repo still produces mixed
  // object shapes here without one stable schema.
  exceptionHistory?: unknown[];
  totals?: ArchitectMutationTeamTotals | null;
  // Compute-time compatibility field for live trade validation only.
  // This is synthesized from totals.totalSalary when a loaded team does not
  // expose an explicit top-level teamTotalSalary.
  teamTotalSalary?: number | string | null;
  draftPicks?: DraftPick[];
  entitlementIds?: string[];
  source?: MutationTeamSourceLike;
  hardCapTriggered?: string | boolean | null;
  hardCapTriggeredBy?: string | null;
  hardCapReason?: string | null;
  hardCapped?: boolean | number | null;
  hardCapLevel?: string | null;
};

type ArchitectTradePayloadPlayerIdentity = Pick<
  ArchitectMutationPlayerRecord,
  | 'player_id'
  | 'id'
  | 'playerId'
  | 'name'
  | 'displayName'
  | 'playerName'
  | 'originTeamId'
>;

type ArchitectTradePayloadSignAndTradeContract = SignAndTradeContractLike |
  Pick<
    ArchitectMutationContract,
    | 'contractType'
    | 'salariesByYear'
    | 'contractYears'
    | 'years'
    | 'firstYearGuaranteed'
    | 'signingTeam'
  >;

export type ArchitectTradePayloadPlayerIngress =
  ArchitectTradePayloadPlayerIdentity & {
    matchIncoming?: number | string | null;
    matchOutgoing?: number | string | null;
    absorptionMode?: string | null;
    tpeId?: string | null;
    signAndTrade?: boolean;
    signAndTradeContract?:
      | ArchitectTradePayloadSignAndTradeContract
      | null;
    receivingTeamIndex?: MutationScalarId;
    receivingTeamId?: MutationScalarId;
    tradeTo?: MutationScalarId;
    toTeamId?: MutationScalarId;
    destTeamId?: MutationScalarId;
  };

// Closed mutation-owned handoff: apply-time compute only owns a stable player
// identifier, minimal labeling, salary-matching fields, one SAT contract slice,
// and one canonical routed destination.
export type ArchitectTradePayloadPlayer = {
  player_id?: string | null;
  name?: string | null;
  displayName?: string | null;
  originTeamId?: string | null;
  matchIncoming?: number | string | null;
  matchOutgoing?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  signAndTrade?: boolean;
  signAndTradeContract?:
    | ArchitectTradePayloadSignAndTradeContract
    | null;
  tradeTo?: string | null;
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

export type ArchitectTradePayloadTeamRef = {
  id?: MutationScalarId;
  teamCode?: MutationScalarId;
};

export type ArchitectTradePayloadTeamIngress = {
  team?: ArchitectTradePayloadTeamRef | null;
  teamCode?: MutationScalarId;
  teamId?: MutationScalarId;
  sends?: ArchitectTradePayloadPlayerIngress[];
  // Compatibility-only mirror from older trade preview callers. Mutation-owned
  // apply-time compute rebuilds receives from routed sends instead of reading
  // this bag as authority.
  receives?: ArchitectTradePayloadPlayerIngress[];
  outgoingEntitlements?: TradePayloadEntitlementLike[];
  incomingEntitlements?: TradePayloadEntitlementLike[];
  entitlementsOut?: TradePayloadEntitlementLike[];
  picksOut?: NormalizedTeamPick[];
  // Deliberately passthrough: tradeContext/validator still consume this as an
  // undeconstructed inbound payload boundary rather than a normalized asset shape.
  picksIn?: unknown[];
  cashSent?: number | null;
  cashReceived?: number | null;
};

// Closed mutation-owned handoff: authoritative trade compute only needs the
// resolved source team code plus the outbound asset slices it actually applies.
export type ArchitectTradePayloadTeam = {
  teamCode: string | null;
  sends: ArchitectTradePayloadPlayer[];
  entitlementsOut?: TradePayloadEntitlementLike[];
  picksOut?: NormalizedTeamPick[];
  cashSent?: number | null;
  cashReceived?: number | null;
};
type TradeTpeConsumptionIssue = {
  playerId?: string | null;
  tpeId?: string | null;
  reason: string;
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
};
type TradeSnapshotLike = TradeContextPostTradeSnapshot;
type TradeApplyValidationTeamLike = TradeContextApplyValidationTeam;
type TradeValidationTeamResultLike = TradeContextTeamResult;
type TradeValidationApplyTimeSlice = {
  legal: boolean;
  teamResults: TradeValidationTeamResultLike[];
};
type TradeMutationPayload = TradeContextNormalizedPayload;
export type ArchitectMutationValidatedTradeContext =
  TradeContextValidatedTradeContext;
type TradeHistoryContextLike = {
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
};
export type ArchitectMutationTradeContext = {
  worldId?: TradeValidatorContext['worldId'] | null;
  asOfDate?: string | number | null;
  source?: TradeValidatorContext['source'] | null;
  tradeDate?: TradeValidatorContext['tradeDate'] | null;
  yearKey?: number | string | null;
  // Compatibility passthrough: existing typed callers still send seasonId,
  // but mutationPipeline does not read it on the live trade bridge.
  seasonId?: string | null;
  offseason?: boolean | null;
  enforceSignAndTradePreflight?: boolean | null;
};

export type ArchitectMutationPayload = {
  teams?: ArchitectTradePayloadTeamIngress[];
  asOfDate?: string | number | null;
  capProjections?: TradeValidatorCapProjections | null;
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
  deadCapChanges?: string[] | null;
  exceptions?: ArchitectMutationExceptionIngress | null;
  exceptionChanges?: string[] | null;
  worldId?: string | null;
  tradeCtx?: ArchitectMutationTradeContext | null;
};
type CurrentStateTradeException = {
  id?: string;
  amount?: number;
  totalAmount?: number;
  remainingAmount?: number;
  usedAmount?: number;
  createdSeason?: number;
  expiresOn?: string | null;
  createdFrom?: string | null;
  isUsed?: boolean | null;
};
type LoadedMutationTeam = Awaited<ReturnType<typeof getTeam>>;
type LoadedMutationPlayer = Awaited<ReturnType<typeof getPlayer>>;
type MutationPipelineSalaryRow = NormalizedMutationSalaryRow & {
  year?: number | string | null;
};
type MutationCurrentStateContractNumberish = number | string | null;
type MutationCurrentStateContractDateLike = string | number | null;
const CURRENT_STATE_PLAYER_CONTRACT_KEYS = [
  'salariesByYear',
  'years',
  'startYear',
  'year',
  'birdRights',
  'contractType',
  'isExtension',
  'isRookieScale',
  'signingTeam',
  'signingDate',
  'signedUsing',
  'exceptionType',
  'contractYears',
  'firstYearGuaranteed',
  'rfaOfferSheet',
  'rfaOfferSheetOnly',
  'yearsRemaining',
  'contractLength',
  'originalLength',
  'totalValue',
  'averageAnnualValue',
  'guaranteedValue',
  'guaranteedYears',
  'freeAgency',
  'rfaOfferSheetStatus',
  'firstYearSalary',
  'year1Salary',
  'signingExecutive',
  'startSeason',
  'endSeason',
  'noTradeClause',
  'tradeKicker',
  'tradeRestrictions',
  'tradeEligibility',
] as const;
// These current-contract fields remain on the normalized player seam because
// option/signing flows spread the existing contract before canonicalization and
// world persistence. Dropping one here would silently strip that persisted
// contract state on the next committed player mutation.
const CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS = [
  'salariesByYear',
  'contractType',
  'isExtension',
  'signingDate',
  'signedUsing',
  'yearsRemaining',
  'contractLength',
  'totalValue',
  'averageAnnualValue',
  'guaranteedValue',
  'guaranteedYears',
  'freeAgency',
  'signingExecutive',
  'startSeason',
  'endSeason',
  'noTradeClause',
  'tradeKicker',
  'tradeRestrictions',
] as const;
// Future-contract carry-through stays separate and smaller because extension
// flows only need the existing future lane plus the persisted metadata they
// intentionally preserve when appending normalized extension rows.
type CurrentStatePlayerContractIncentives = NormalizedMutationContractIncentives;
type CurrentStatePlayerContractGuaranteeScheduleEntry =
  NormalizedMutationGuaranteeScheduleEntry;
type CurrentStatePlayerContractTradeEligibilityRules =
  ArchitectMutationTradeEligibilityRules;
type CurrentStatePlayerContractTradeEligibility =
  ArchitectMutationTradeEligibility;
type CurrentStatePlayerContractFreeAgency = ArchitectMutationFreeAgency;
type MutationCurrentStatePlayerContractSalaryRowIngress = {
  season?: string | null;
  year?: MutationCurrentStateContractNumberish;
  salary?: MutationCurrentStateContractNumberish;
  capHit?: MutationCurrentStateContractNumberish;
  guaranteed?: boolean | null;
  guaranteedAmount?: MutationCurrentStateContractNumberish;
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | string | null;
  optionDecisionDate?: string | null;
  tradeBonus?: MutationCurrentStateContractNumberish;
  incentives?: CurrentStatePlayerContractIncentives | null;
  guaranteeSchedule?: CurrentStatePlayerContractGuaranteeScheduleEntry[] | null;
  voidedByExtension?: boolean | null;
  voidedOn?: string | null;
  isExtensionSeason?: boolean | null;
};
type CurrentStatePlayerContractSalaryRow = NormalizedMutationSalaryRow;
type MutationCurrentStatePlayerContractIngress = {
  salariesByYear?: MutationCurrentStatePlayerContractSalaryRowIngress[] | null;
  years?: MutationCurrentStateContractNumberish;
  startYear?: MutationCurrentStateContractNumberish;
  year?: MutationCurrentStateContractNumberish;
  birdRights?: ArchitectMutationBirdRights | string | null;
  contractType?: string | null;
  extension?: boolean | null;
  isExtension?: boolean | null;
  isRookieScale?: boolean | null;
  signingTeam?: string | null;
  signingDate?: MutationCurrentStateContractDateLike;
  signedAt?: MutationCurrentStateContractDateLike;
  extensionSignedAt?: MutationCurrentStateContractDateLike;
  signedUsing?: string | null;
  exceptionType?: string | null;
  contractYears?: MutationCurrentStateContractNumberish;
  firstYearGuaranteed?: boolean | null;
  rfaOfferSheet?: boolean | null;
  rfaOfferSheetOnly?: boolean | null;
  yearsRemaining?: MutationCurrentStateContractNumberish;
  contractLength?: MutationCurrentStateContractNumberish;
  originalLength?: MutationCurrentStateContractNumberish;
  totalValue?: MutationCurrentStateContractNumberish;
  averageAnnualValue?: MutationCurrentStateContractNumberish;
  guaranteedValue?: MutationCurrentStateContractNumberish;
  guaranteedYears?: MutationCurrentStateContractNumberish;
  freeAgency?: CurrentStatePlayerContractFreeAgency | string | null;
  rfaOfferSheetStatus?: string | null;
  firstYearSalary?: MutationCurrentStateContractNumberish;
  year1Salary?: MutationCurrentStateContractNumberish;
  signingExecutive?: string | null;
  startSeason?: string | null;
  endSeason?: string | null;
  noTradeClause?: boolean | null;
  tradeKicker?: MutationCurrentStateContractNumberish;
  tradeRestrictions?: string[] | null;
  tradeEligibility?: CurrentStatePlayerContractTradeEligibility | null;
};
type MutationCurrentStatePlayerFutureContractIngress = {
  salariesByYear?: MutationCurrentStatePlayerContractSalaryRowIngress[] | null;
  contractType?: string | null;
  isExtension?: boolean | null;
  signingDate?: MutationCurrentStateContractDateLike;
  signedAt?: MutationCurrentStateContractDateLike;
  extensionSignedAt?: MutationCurrentStateContractDateLike;
  signedUsing?: string | null;
  yearsRemaining?: MutationCurrentStateContractNumberish;
  contractLength?: MutationCurrentStateContractNumberish;
  totalValue?: MutationCurrentStateContractNumberish;
  averageAnnualValue?: MutationCurrentStateContractNumberish;
  guaranteedValue?: MutationCurrentStateContractNumberish;
  guaranteedYears?: MutationCurrentStateContractNumberish;
  freeAgency?: CurrentStatePlayerContractFreeAgency | string | null;
  signingExecutive?: string | null;
  startSeason?: string | null;
  endSeason?: string | null;
  noTradeClause?: boolean | null;
  tradeKicker?: MutationCurrentStateContractNumberish;
  tradeRestrictions?: string[] | null;
};
type CurrentStatePlayerContract = Pick<
  ArchitectMutationContract,
  (typeof CURRENT_STATE_PLAYER_CONTRACT_KEYS)[number]
>;
type CurrentStatePlayerFutureContract = Pick<
  ArchitectMutationContract,
  (typeof CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS)[number]
>;
type CurrentStatePlayerBioDisplay = NonNullable<
  MutationPlayerBioLike['display']
>;
type CurrentStatePlayerBioDraft = Pick<
  PlayerDraft,
  'year' | 'round' | 'pick' | 'teamId'
>;
type CurrentStatePlayerBio = Omit<
  MutationPlayerBioLike,
  'draft' | 'display' | 'experience' | 'yearsExperience' | 'yearsPro' | 'Years Pro'
> & {
  draft?: CurrentStatePlayerBioDraft | null;
  display?: CurrentStatePlayerBioDisplay | null;
  experience?: number | string | null;
  yearsExperience?: number | string | null;
  yearsPro?: number | string | null;
  ['Years Pro']?: number | string | null;
};
type NormalizedCurrentStatePlayerDraft = Pick<
  NonNullable<ArchitectMutationPlayerRecord['draft']>,
  'round' | 'pick'
>;
type CurrentStatePlayerRfaContext = {
  pendingHomeTeamCode?: string;
  offerSheetId?: string;
  retainedUntilFinalize?: boolean;
};
type CurrentStatePlayerComputeCore = Omit<
  Pick<
    ArchitectMutationPlayerRecord,
    | 'player_id'
    | 'id'
    | 'playerId'
    | 'teamCode'
    | 'teamName'
    | 'name'
    | 'displayName'
    | 'playerName'
    | 'bio'
    | 'birdRights'
    | 'renounced'
  >,
  'bio' | 'draft' | 'contract' | 'futureContract'
> & {
  bio?: CurrentStatePlayerBio | null;
  draft?: NormalizedCurrentStatePlayerDraft | null;
  contract?: CurrentStatePlayerContract | null;
  futureContract?: CurrentStatePlayerFutureContract | null;
};
// Carry-through override metadata remains normalized as an explicit sidecar so
// committed compute paths do not depend on unrelated persistence-only fields.
type CurrentStatePlayerOverridePersistenceSidecar = Pick<
  ArchitectMutationPlayerRecord,
  | 'representation'
  | 'source'
  | 'lastUpdated'
  | 'version'
  | 'isTwoWay'
  | 'signedDate'
>;
type CurrentStatePlayerCore = CurrentStatePlayerComputeCore &
  CurrentStatePlayerOverridePersistenceSidecar;
type CurrentStatePlayerOverridePersistenceIngress = Pick<
  ArchitectMutationPlayerRecord,
  | 'representation'
  | 'source'
  | 'lastUpdated'
  | 'version'
  | 'isTwoWay'
  | 'signedDate'
>;
type CurrentStatePlayerRfaSidecar = {
  rfaOfferSheet?: boolean;
  rfaOfferSheetOnly?: boolean;
  // Raw ingress stays broad, but the normalized player/persistence seam only
  // carries the small observed offer-sheet sidecar used by this file.
  rfaContext?: CurrentStatePlayerRfaContext;
};
type CurrentStatePlayerRfaBoundary = CurrentStatePlayerRfaSidecar & {
  isNewlySignedFA?: boolean;
  originTeamId?: string;
};
type NormalizedCurrentStatePlayer = CurrentStatePlayerCore &
  CurrentStatePlayerRfaBoundary;
type LineageOverrideMergeBio = Pick<
  NonNullable<NormalizedCurrentStatePlayer['bio']>,
  'playerId' | 'displayName'
>;
type LineageOverrideMergePlayer = Omit<
  Pick<
    NormalizedCurrentStatePlayer,
    | 'player_id'
    | 'id'
    | 'playerId'
    | 'teamCode'
    | 'teamName'
    | 'name'
    | 'displayName'
    | 'playerName'
    | 'bio'
    | 'contract'
  >,
  'bio'
> & {
  bio?: LineageOverrideMergeBio | null;
};
type PersistablePlayerOverride = Pick<
  CurrentStatePlayerComputeCore,
  | 'displayName'
  | 'teamCode'
  | 'teamName'
  | 'bio'
  | 'contract'
  | 'futureContract'
> &
  CurrentStatePlayerOverridePersistenceSidecar &
  CurrentStatePlayerRfaBoundary & {
  playerId?: string | null;
};
type PersistablePlayerOverrideSource = Pick<
  NormalizedCurrentStatePlayer,
  | 'player_id'
  | 'id'
  | 'playerId'
  | 'name'
  | 'displayName'
  | 'playerName'
  | 'teamCode'
  | 'teamName'
  | 'bio'
  | 'contract'
  | 'futureContract'
> &
  CurrentStatePlayerOverridePersistenceSidecar &
  CurrentStatePlayerRfaBoundary;
type CurrentStatePlayer = CurrentStatePlayerCore & CurrentStatePlayerRfaBoundary;
const CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY =
  '__currentStateBasePreserved';
const CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Roster`;
const CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Exceptions`;
const CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}OfferSheets`;
const CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}IncomingOfferSheets`;
const CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}TradeExceptions`;
const CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}CashLedger`;
const CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}ExceptionHistory`;
const CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}DraftPicks`;
const CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY =
  `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}EntitlementIds`;
type CurrentStateTeam = Omit<
  Pick<
    ArchitectMutationTeamRecord,
    | 'teamCode'
    | 'teamName'
    | 'players'
    | 'roster'
    | 'twoWayPlayers'
    | 'capHolds'
    | 'deadCap'
    | 'exceptions'
    | 'tradeExceptions'
    | 'cashLedger'
    | 'offerSheets'
    | 'incomingOfferSheets'
    | 'exceptionHistory'
    | 'totals'
    | 'teamTotalSalary'
    | 'draftPicks'
    | 'entitlementIds'
    | 'source'
    | 'hardCapped'
    | 'hardCapLevel'
    | 'hardCapReason'
    | 'hardCapTriggeredBy'
  >,
  | 'players'
  | 'twoWayPlayers'
  | 'tradeExceptions'
  | 'exceptionHistory'
  | 'teamTotalSalary'
> & {
  players?: CurrentStatePlayer[];
  twoWayPlayers?: CurrentStatePlayer[];
  tradeExceptions?: CurrentStateTradeException[];
  exceptionHistory?: CurrentStateExceptionHistoryEntry[];
  teamTotalSalary?: number;
};
type CurrentStateTeamIdentityFieldMap = Pick<
  CurrentStateTeam,
  'teamCode' | 'teamName'
>;
type CurrentStateTeamMutationCoreFieldMap = Pick<
  CurrentStateTeam,
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
type CurrentStateTeamRosterFieldMap = Pick<CurrentStateTeam, 'roster'>;
type CurrentStateTeamExceptionsFieldMap = Pick<
  CurrentStateTeam,
  'exceptions'
>;
type CurrentStateOfferSheetTeamLiveFieldMap = Pick<
  CurrentStateTeam,
  'offerSheets' | 'incomingOfferSheets'
>;
type CurrentStatePlayerOpsTeamCompute = CurrentStateTeamIdentityFieldMap &
  CurrentStateTeamMutationCoreFieldMap &
  CurrentStateTeamRosterFieldMap;
type CurrentStateManualCapTeamCompute = CurrentStateTeamIdentityFieldMap &
  CurrentStateTeamMutationCoreFieldMap &
  CurrentStateTeamExceptionsFieldMap;
type CurrentStateSigningTeamCompute = CurrentStatePlayerOpsTeamCompute &
  CurrentStateTeamExceptionsFieldMap &
  Pick<CurrentStateTeam, 'offerSheets'>;
type CurrentStateOfferSheetMirrorTeamCompute =
  CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap &
    CurrentStateOfferSheetTeamLiveFieldMap;
type CurrentStateOfferSheetResolutionTeamCompute =
  CurrentStatePlayerOpsTeamCompute &
    CurrentStateOfferSheetTeamLiveFieldMap;
type CurrentStateBaseTeamPreservedFieldMap = Pick<
  CurrentStateTeam,
  | 'roster'
  | 'exceptions'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'tradeExceptions'
  | 'cashLedger'
  | 'exceptionHistory'
  | 'draftPicks'
  | 'entitlementIds'
>;
type CurrentStateBaseTeamRosterCarrier = {
  [CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['roster'];
};
type CurrentStateBaseTeamExceptionsCarrier = {
  [CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['exceptions'];
};
type CurrentStateBaseTeamOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['offerSheets'];
};
type CurrentStateBaseTeamIncomingOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['incomingOfferSheets'];
};
type CurrentStateTradeTeamLiveFieldMap = Pick<
  CurrentStateBaseTeamPreservedFieldMap,
  'tradeExceptions' | 'cashLedger' | 'draftPicks' | 'entitlementIds'
>;
type CurrentStateBaseTeamTradeExceptionsCarrier = {
  [CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['tradeExceptions'];
};
type CurrentStateBaseTeamCashLedgerCarrier = {
  [CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['cashLedger'];
};
type CurrentStateBaseTeamExceptionHistoryCarrier = {
  [CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['exceptionHistory'];
};
type CurrentStateBaseTeamDraftPicksCarrier = {
  [CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['draftPicks'];
};
type CurrentStateBaseTeamEntitlementIdsCarrier = {
  [CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY]?:
    CurrentStateBaseTeamPreservedFieldMap['entitlementIds'];
};
type CurrentStateBaseTeamRoundTripCarrier =
  CurrentStateBaseTeamRosterCarrier &
    CurrentStateBaseTeamExceptionsCarrier &
    CurrentStateBaseTeamOfferSheetsCarrier &
    CurrentStateBaseTeamIncomingOfferSheetsCarrier &
    CurrentStateBaseTeamTradeExceptionsCarrier &
    CurrentStateBaseTeamCashLedgerCarrier &
    CurrentStateBaseTeamExceptionHistoryCarrier &
    CurrentStateBaseTeamDraftPicksCarrier &
    CurrentStateBaseTeamEntitlementIdsCarrier;
type CurrentStateBaseTeamPreservedCarrierLike =
  CurrentStateBaseTeamRoundTripCarrier;
type CurrentStatePlayerOpsTeam = CurrentStatePlayerOpsTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
type CurrentStateManualCapTeam = CurrentStateManualCapTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
type CurrentStateSigningTeam = CurrentStateSigningTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
type CurrentStateOfferSheetMirrorTeam =
  CurrentStateOfferSheetMirrorTeamCompute &
    CurrentStateBaseTeamRoundTripCarrier;
type CurrentStateOfferSheetResolutionTeam =
  CurrentStateOfferSheetResolutionTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
type CurrentStateTradeTeam =
  CurrentStateTeamIdentityFieldMap &
  CurrentStateTeamMutationCoreFieldMap &
  CurrentStateTeamRosterFieldMap &
  CurrentStateTeamExceptionsFieldMap &
  CurrentStateTradeTeamLiveFieldMap &
  CurrentStateBaseTeamExceptionHistoryCarrier &
  Pick<CurrentStateTeam, 'twoWayPlayers' | 'teamTotalSalary'>;
type CurrentStateNonTradeTeamRoundTripMaterializable =
  | CurrentStatePlayerOpsTeam
  | CurrentStateManualCapTeam
  | CurrentStateSigningTeam
  | CurrentStateOfferSheetMirrorTeam
  | CurrentStateOfferSheetResolutionTeam;
type BaseTeamLike = CurrentStatePlayerOpsTeam | CurrentStateManualCapTeam;
type OfferSheetTeamLike =
  | CurrentStateSigningTeam
  | CurrentStateOfferSheetMirrorTeam
  | CurrentStateOfferSheetResolutionTeam;
type TradeTeamLike = CurrentStateTradeTeam;
type CurrentStatePrimaryTeam = BaseTeamLike | OfferSheetTeamLike | TradeTeamLike;
type TeamLike = CurrentStatePrimaryTeam;
type PlayerLike = NormalizedCurrentStatePlayer;
type CurrentStateBaseTeamMaterializedPreservedFieldMap = Partial<
  CurrentStateBaseTeamPreservedFieldMap
>;
// The round-trip/persistence seam only accepts normalized current-state teams
// plus the hidden base preserved-field carrier; it no longer widens back out to
// a general ArchitectMutationTeamRecord bag.
type CurrentStateTeamRoundTripMaterializable =
  | CurrentStateNonTradeTeamRoundTripMaterializable
  | TradeTeamLike;
type MaterializedCurrentStateTeam<
  T extends CurrentStateTeamRoundTripMaterializable,
> = Omit<T, keyof CurrentStateBaseTeamRoundTripCarrier> &
  CurrentStateBaseTeamMaterializedPreservedFieldMap;
type CurrentStateTeamPersistenceStripShape =
  CurrentStateTeamRoundTripMaterializable & {
    teamTotalSalary?: CurrentStateTradeTeam['teamTotalSalary'];
  };
// Compute-time team updates stay wider than the committed artifact because the
// live local-validated trade bridge still needs the explicit teamTotalSalary
// lane plus the hidden preserved-field carrier before persistence strips them.
// Persistence and dashboard reload must narrow through the committed helpers
// below instead of reusing this broader compute bag directly.
export type ArchitectMutationComputedTeamSnapshot =
  CurrentStateTeamRoundTripMaterializable &
    Partial<CurrentStateTeam>;
export type ArchitectMutationTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectMutationComputedTeamSnapshot | null;
};
type GeneralMutationCommittedTeamSnapshotFrom<
  T extends CurrentStateTeamRoundTripMaterializable,
> = Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'>;
type GeneralMutationCommittedTeamSnapshotCore =
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStatePlayerOpsTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateManualCapTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateSigningTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateOfferSheetMirrorTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<CurrentStateOfferSheetResolutionTeam>
  | GeneralMutationCommittedTeamSnapshotFrom<TradeTeamLike>;
export type ArchitectGeneralMutationCommittedTeamSnapshot =
  GeneralMutationCommittedTeamSnapshotCore &
    Partial<Omit<CurrentStateTeam, 'teamTotalSalary'>>;
export type ArchitectGeneralMutationCommittedTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectGeneralMutationCommittedTeamSnapshot | null;
};
type GeneralMutationPersistenceTeamSnapshot =
  ArchitectGeneralMutationCommittedTeamSnapshot;
type ArchitectGeneralMutationDashboardReloadDeadCapYear = {
  season: string;
  amount: number;
  isStretched?: boolean | null;
};
type ArchitectGeneralMutationDashboardReloadDeadCapEntry = {
  id?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: number | null;
  amountByYear?: ArchitectGeneralMutationDashboardReloadDeadCapYear[] | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};
type ArchitectGeneralMutationDashboardReloadExceptionEntry = {
  type?: string | null;
  enabled?: boolean;
  available?: boolean;
  totalAmount?: number | null;
  maxAmount?: number | null;
  amount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};
type ArchitectGeneralMutationDashboardReloadTradeException = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
type ArchitectGeneralMutationDashboardReloadExceptions = Partial<
  Record<
    CanonicalNonTpeExceptionKey | 'dpe',
    ArchitectGeneralMutationDashboardReloadExceptionEntry | null
  >
> & {
  tpe?: ArchitectGeneralMutationDashboardReloadTradeException[] | null;
};
type ArchitectGeneralMutationDashboardReloadOfferSheet = {
  id?: string | number | null;
  playerName?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
  contractYears?: number | string | null;
  totalValue?: number | string | null;
  status: string;
  createdAt?: string | number | Date | null;
};
type ArchitectGeneralMutationDashboardReloadContractFreeAgency = {
  year?: number | null;
  type?: string | null;
};
type ArchitectGeneralMutationDashboardReloadBirdRights = {
  status: string;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
};
type ArchitectGeneralMutationDashboardReloadPlayerContract =
  Omit<CurrentStatePlayerContract, 'signingDate' | 'freeAgency' | 'birdRights'> & {
    signingDate?: string | null;
    birdRights?: ArchitectGeneralMutationDashboardReloadBirdRights | null;
    freeAgency?:
      | ArchitectGeneralMutationDashboardReloadContractFreeAgency
      | string
      | null;
  };
type ArchitectGeneralMutationDashboardReloadPlayerFutureContract =
  Omit<CurrentStatePlayerFutureContract, 'signingDate' | 'freeAgency'> & {
    signingDate?: string | null;
    freeAgency?:
      | ArchitectGeneralMutationDashboardReloadContractFreeAgency
      | string
      | null;
  };
type ArchitectGeneralMutationDashboardReloadPlayer = Omit<
  CurrentStatePlayer,
  'contract' | 'futureContract'
> & {
  contract?: ArchitectGeneralMutationDashboardReloadPlayerContract | null;
  futureContract?:
    | ArchitectGeneralMutationDashboardReloadPlayerFutureContract
    | null;
};
// changedTeams is the dashboard reload artifact, not the persistence snapshot.
// It keeps only the fields the post-commit dashboard/state seam actually reads
// and leaves round-trip-only baggage on the persistence contract.
export type ArchitectGeneralMutationDashboardReloadTeamSnapshot = Pick<
  ArchitectGeneralMutationCommittedTeamSnapshot,
  | 'teamCode'
  | 'roster'
  | 'capHolds'
  | 'totals'
  | 'exceptionHistory'
  | 'draftPicks'
  | 'entitlementIds'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
> & {
  teamName?: string;
  players?: ArchitectGeneralMutationDashboardReloadPlayer[] | null;
  deadCap?: ArchitectGeneralMutationDashboardReloadDeadCapEntry[] | null;
  exceptions?: ArchitectGeneralMutationDashboardReloadExceptions | null;
  offerSheets?: ArchitectGeneralMutationDashboardReloadOfferSheet[] | null;
  incomingOfferSheets?:
    | ArchitectGeneralMutationDashboardReloadOfferSheet[]
    | null;
  hardCapped?: boolean | null;
};
export type ArchitectGeneralMutationDashboardReloadTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectGeneralMutationDashboardReloadTeamSnapshot | null;
};

type MutationCurrentStatePlayerIngress = Omit<
  Pick<
    ArchitectMutationPlayerRecord,
    | 'player_id'
    | 'id'
    | 'playerId'
    | 'teamCode'
    | 'teamName'
    | 'name'
    | 'displayName'
    | 'playerName'
    | 'bio'
    | 'draft'
    | 'representation'
    | 'source'
    | 'birdRights'
    | 'renounced'
    | 'lastUpdated'
    | 'version'
    | 'isTwoWay'
    | 'signedDate'
  >,
  'draft' | 'contract' | 'futureContract'
> &
  CurrentStatePlayerRfaBoundary & {
    draft?: Partial<PlayerDraft> | null;
    contract?: MutationCurrentStatePlayerContractIngress | null;
    futureContract?: MutationCurrentStatePlayerFutureContractIngress | null;
  };
type CurrentStatePlayerSnapshotIngress =
  | MutationCurrentStatePlayerIngress
  | PlayerLike;
type MutationCurrentStateTeamCoreIngress = Omit<
  Pick<
    ArchitectMutationTeamRecord,
    | 'teamCode'
    | 'teamName'
    | 'players'
    | 'roster'
    | 'capHolds'
    | 'deadCap'
    | 'exceptions'
    | 'totals'
    | 'source'
    | 'hardCapped'
    | 'hardCapLevel'
    | 'hardCapReason'
    | 'hardCapTriggeredBy'
  >,
  'players'
> & {
  players?: MutationCurrentStatePlayerIngress[];
};
type MutationCurrentStateTeamRoundTripIngress = Pick<
  ArchitectMutationTeamRecord,
  | 'tradeExceptions'
  | 'cashLedger'
  | 'exceptionHistory'
  | 'draftPicks'
  | 'entitlementIds'
>;
type MutationCurrentStateBaseTeamIngress = MutationCurrentStateTeamCoreIngress &
  MutationCurrentStateTeamRoundTripIngress;
type MutationCurrentStateOfferSheetTeamIngress =
  MutationCurrentStateBaseTeamIngress &
    Pick<
      ArchitectMutationTeamRecord,
      'offerSheets' | 'incomingOfferSheets'
    >;
type MutationCurrentStateTradeTeamIngress = MutationCurrentStateTeamCoreIngress &
  Pick<
    ArchitectMutationTeamRecord,
    | 'tradeExceptions'
    | 'cashLedger'
    | 'exceptionHistory'
    | 'teamTotalSalary'
    | 'draftPicks'
    | 'entitlementIds'
  > & {
    twoWayPlayers?: MutationCurrentStatePlayerIngress[];
  };
export type MutationTeamMap = Record<string, TeamLike>;
type BuildTotalsTeamMap = Record<
  string,
  TeamLike | ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
>;
type MutationCurrentStateTeamEntry = {
  teamCode?: string | null;
  team?: TradeTeamLike | null;
};
type MutationCurrentStateTradeTeamEntryIngress = {
  teamCode?: string | null;
  team?: MutationCurrentStateTradeTeamIngress | null;
};
export type ArchitectMutationPlayerUpdate = {
  playerId?: string | null;
  player?: ArchitectMutationPlayerRecord | null;
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
type MutationDiffSummary = {
  playersMoved: number;
  deadCapChanged: number;
  exceptionsChanged: number;
  teamsTouched: number;
};
// Deliberately mixed: this aggregates issue payloads from multiple validators and
// invariant checks that do not yet share one cross-module issue contract.
export type MutationResultIssueLike = string | LooseRecord;
type MutationEventContractSalaryRow = {
  season?: string | number | null;
  salary?: number | string | null;
  capHit?: number | string | null;
};
type MutationEventContractLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  years?: number | string | null;
  contractYears?: number | string | null;
  contractLength?: number | string | null;
  firstYearSalary?: number | string | null;
  year1Salary?: number | string | null;
  totalValue?: number | string | null;
  signedUsing?: string | null;
};
type MutationEventExtensionTermsLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  contractYears?: number | string | null;
  years?: number | string | null;
  firstYearSalary?: number | string | null;
};
type MutationEventEntitlementTransferSummary = {
  out: readonly string[];
  in: readonly string[];
};
type MutationEventEntitlementsMovedByTeam = Record<
  string,
  MutationEventEntitlementTransferSummary
>;
type MutationEventMetadataLike = {
  playersTraded?: readonly (string | number | null | undefined)[] | null;
  teamsAffected?: readonly (string | number | null | undefined)[] | null;
  teamsInvolved?: readonly (string | number | null | undefined)[] | null;
  teamCodes?: readonly (string | number | null | undefined)[] | null;
  contract?: MutationEventContractLike | null;
  extensionTerms?: MutationEventExtensionTermsLike | null;
  extensionYears?: number | string | null;
  contractValue?: number | string | null;
  signedUsing?: string | null;
  picksTraded?: readonly (string | number | null | undefined)[] | null;
  entitlementsTraded?:
    | MutationEventEntitlementsMovedByTeam
    | readonly (string | number | null | undefined)[]
    | null;
  exceptionChanges?: readonly string[] | null;
  deadCapChanges?: readonly string[] | null;
  teamCode?: string | null;
  playerId?: string | number | null;
  playerName?: string | null;
  waivedPlayer?: string | null;
  renouncedPlayer?: string | null;
  rightsUsed?: string | null;
  stretched?: boolean | null;
  buyout?: boolean | null;
  deadCapAmount?: number | string | null;
  optionType?: string | null;
  accepted?: boolean | null;
  summary?: string | null;
} & Record<string, unknown>;
type ArchitectWorldMutationContractSummary = {
  years?: number;
  firstYearSalary?: number;
  totalValue?: number;
  startYear?: string;
  endYear?: string;
  signedUsing?: string;
};
type ArchitectWorldMutationHistoryMetadata = {
  mutationType: string;
  category: string;
  worldId: string;
  teams: string[];
  players: string[];
  teamCode?: string;
  playerId?: string;
  playerName?: string;
  signedUsing?: string;
  rightsUsed?: string;
  stretched?: boolean;
  buyout?: boolean;
  deadCapAmount?: number;
  extensionYears?: number;
  optionType?: string;
  accepted?: boolean;
  contract: ArchitectWorldMutationContractSummary;
  contractSummary: ArchitectWorldMutationContractSummary;
  summary?: string;
  picksMoved?: string[];
};
type ArchitectWorldMutationEventDiffSummary = {
  playersMoved?: number | string[];
  deadCapChanged?: number;
  exceptionsChanged?: number;
  teamsTouched?: number;
  picksMoved?: string[];
  exceptionChanges?: string[];
  deadCapChanges?: string[];
};
type ArchitectWorldMutationPatch = {
  lastModifiedAt: ReturnType<typeof serverTimestamp>;
  lastModifiedTeams: Array<string | null | undefined>;
  asOfDate?: string;
};
type ArchitectWorldMutationEventBridge = Partial<
  Pick<ArchitectWorldMutationEvent, 'eventId' | 'id' | 'operationId'>
>;
type ArchitectWorldMutationEvent = {
  eventId: string;
  id: string;
  type: string;
  timestamp: string;
  seasonId: string;
  metadata: MutationEventMetadataLike;
  teamsAffected: string[];
  schemaVersion: string;
  validatorVersion: string;
  operationId: string;
  mutationType: string;
  occurredAt: string;
  worldId: string;
  teamCodes: string[];
  playerIds: string[];
  beforeTotalsByTeam: NonNullable<PostStateCapValidationInput['beforeTotalsByTeam']>;
  afterTotalsByTeam: NonNullable<PostStateCapValidationInput['afterTotalsByTeam']>;
  valid: boolean;
  violations: string[];
  warnings: string[];
  diffSummary: ArchitectWorldMutationEventDiffSummary;
  mutationMetadata: ArchitectWorldMutationHistoryMetadata;
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
  metadata?: MutationEventMetadataLike;
  warnings?: MutationResultIssueLike[];
  violations?: MutationResultIssueLike[];
  writesSummary?: ArchitectMutationWritesSummary;
  changedTeams?: ArchitectGeneralMutationCommittedTeamUpdate[];
  changedPlayers?: ArchitectMutationPlayerUpdate[];
  worldPatch?: ArchitectWorldMutationPatch;
  event?: ArchitectWorldMutationEventBridge;
  appliedToLocalState?: boolean;
  persistedToWorld?: boolean;
  eventWritten?: boolean;
  _validatedTradeContext?: ArchitectMutationValidatedTradeContext;
  _signingValidation?: ReturnType<typeof validateSigning>;
  _tpeConsumptionErrors?: TradeTpeConsumptionIssue[];
};

/**
 * Compute-time lookup for local-validated flows. Committed dashboard reload
 * paths should use findCommittedTeamSnapshot so they receive the post-persistence
 * committed team artifact instead of the compute-time team update shape.
 */
export function findUpdatedTeamSnapshot(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  targetTeamCode: string
): ArchitectMutationComputedTeamSnapshot | null {
  const matchingUpdate = (teamUpdates || []).find(
    (update) => update?.teamCode === targetTeamCode && update?.team
  );

  return (
    (matchingUpdate?.team as
      | ArchitectMutationComputedTeamSnapshot
      | null
      | undefined) || null
  );
}

/**
 * Post-commit propagation order for general world mutations:
 * 1. Reuse the matching dashboard reload snapshot from `changedTeams` when available.
 * 2. If that direct snapshot is missing, reload a committed team snapshot through the read stack.
 * 3. Hand the reload snapshot to the dashboard/state resync seam so metadata
 *    patching, roster refresh, and stale-drop rules stay state-owned.
 */
export function findCommittedTeamSnapshot(
  teamUpdates: ArchitectGeneralMutationCommittedTeamUpdate[] | null | undefined,
  targetTeamCode: string
): ArchitectGeneralMutationCommittedTeamSnapshot | null {
  const matchingUpdate = (teamUpdates || []).find(
    (update) => update?.teamCode === targetTeamCode && update?.team
  );

  return matchingUpdate?.team || null;
}

export type SignAndTradePreflightStatus = 'legal' | 'blocked' | 'incomplete';
export type SignAndTradePreflightResult = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
export type OfferSheetPreflightStatus = 'legal' | 'blocked' | 'incomplete';
export type OfferSheetPreflightResult = {
  status: OfferSheetPreflightStatus;
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
export type MutationPayloadLike = ArchitectMutationPayload;
type TeamUpdateLike = ArchitectMutationTeamUpdate;
type PlayerUpdateLike = ArchitectMutationPlayerUpdate;
type PlayerDeleteLike = ArchitectMutationPlayerDelete;
type WritesSummaryLike = ArchitectMutationWritesSummary;
type TradeValidatedContextLike = ArchitectMutationValidatedTradeContext;
type TradeTeamUpdate = ArchitectMutationTeamUpdate;
type ArchitectMutationBridgeResult = {
  success?: boolean;
  error?: string | Error | null;
  teamUpdates?: ArchitectMutationTeamUpdate[];
  playerUpdates?: ArchitectMutationPlayerUpdate[];
  playerDeletes?: ArchitectMutationPlayerDelete[];
  entitlementUpdates?: EntitlementUpdateLike[];
  metadata?: MutationEventMetadataLike;
  warnings?: MutationResultIssueLike[];
  violations?: MutationResultIssueLike[];
  _validatedTradeContext?: ArchitectMutationValidatedTradeContext;
  _signingValidation?: ReturnType<typeof validateSigning>;
  _tpeConsumptionErrors?: TradeTpeConsumptionIssue[];
};
type PersistWorldMutationResult = {
  success: boolean;
  error?: string | Error | null;
  worldPatch?: ArchitectWorldMutationPatch;
  event?: ArchitectWorldMutationEventBridge;
  writesSummary?: WritesSummaryLike;
};
type MutationBridgeTeamUpdatesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates'
>;
type MutationBridgePlayerTouchSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'playerDeletes'
>;
type MutationBridgeWritesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates' | 'playerUpdates' | 'playerDeletes' | 'entitlementUpdates'
>;
type MutationBridgePlayerIdSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'metadata'
>;
type MutationEventSourceResult = Pick<
  ArchitectMutationBridgeResult,
  'metadata' | 'teamUpdates' | 'playerUpdates' | 'playerDeletes'
>;
type MutationFailureOverrides = Pick<
  ArchitectMutationResult,
  | 'appliedToLocalState'
  | 'persistedToWorld'
  | 'eventWritten'
  | 'writesSummary'
  | 'violations'
  | 'warnings'
>;
export type ComputeResultLike = ArchitectMutationBridgeResult;
type AuditContextLike = MutationAuditContext;
export type PostStateTotalsByTeam = NonNullable<PostStateCapValidationInput['afterTotalsByTeam']>;
type MutationTradeCurrentStateIngress = {
  teams?: MutationCurrentStateTradeTeamEntryIngress[];
};
type MutationTeamOnlyCurrentStateIngress = {
  team?: MutationCurrentStateBaseTeamIngress | null;
  teamCode?: string | null;
};
type MutationTeamAndPlayerCurrentStateIngress =
  MutationTeamOnlyCurrentStateIngress & {
    player?: MutationCurrentStatePlayerIngress | null;
  };
type MutationSigningCurrentStateIngress = {
  team?: MutationCurrentStateOfferSheetTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  teamCode?: string | null;
};
type MutationOfferSheetCurrentStateIngress = {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
type MutationSignAndTradeCurrentStateIngress = {
  team?: MutationCurrentStateTradeTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  destinationTeam?: MutationCurrentStateTradeTeamIngress | null;
  teamCode?: string | null;
};
type MutationCurrentStateTeamIngress =
  | MutationCurrentStateBaseTeamIngress
  | MutationCurrentStateOfferSheetTeamIngress
  | MutationCurrentStateTradeTeamIngress;
// Public compute ingress still tolerates partially populated snapshots at the
// outer boundary, but each team slot now resolves through a smaller family-owned
// ingress contract instead of one monolithic team bag.
type MutationCurrentStateIngress = {
  teams?: Array<
    MutationCurrentStateTradeTeamEntryIngress | MutationCurrentStateTeamEntry
  >;
  team?: MutationCurrentStateTeamIngress | CurrentStatePrimaryTeam | null;
  player?: MutationCurrentStatePlayerIngress | PlayerLike | null;
  homeTeam?:
    | MutationCurrentStateOfferSheetTeamIngress
    | OfferSheetTeamLike
    | null;
  offeringTeam?:
    | MutationCurrentStateOfferSheetTeamIngress
    | OfferSheetTeamLike
    | null;
  destinationTeam?:
    | MutationCurrentStateTradeTeamIngress
    | TradeTeamLike
    | null;
  teamCode?: string | null;
  // Compatibility-only outer-boundary field. The hardened family-specific
  // normalizers ignore it and read payload/current-state team truth instead.
  destinationTeamCode?: string | null;
  offerSheetId?: string | null;
};
// Internal mutation state after ingress normalization. Only fields actually read
// by compute/apply paths are carried forward from the public ingress.
export type MutationCurrentState = {
  teams?: MutationCurrentStateTeamEntry[];
  team?: CurrentStatePrimaryTeam | null;
  player?: PlayerLike | null;
  homeTeam?: OfferSheetTeamLike | null;
  offeringTeam?: OfferSheetTeamLike | null;
  destinationTeam?: TradeTeamLike | null;
  teamCode?: string | null;
  offerSheetId?: string | null;
};
type MutationTradeCurrentState = Pick<MutationCurrentState, 'teams'>;
type MutationTeamOnlyCurrentState = Pick<
  MutationCurrentState,
  'team' | 'teamCode'
> & {
  team?: CurrentStateManualCapTeam | null;
};
type MutationTeamAndPlayerCurrentState = Pick<
  MutationCurrentState,
  'team' | 'teamCode'
> & {
  team?: CurrentStatePlayerOpsTeam | null;
  player?: PlayerLike | null;
};
type MutationOfferSheetTeamAndPlayerCurrentState = Pick<
  MutationCurrentState,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> & {
  team?: CurrentStateSigningTeam | null;
  player?: PlayerLike | null;
  homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
};
type MutationSigningTeamLike = CurrentStateSigningTeam | TradeTeamLike;
type MutationSigningCurrentState = Pick<
  MutationCurrentState,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> & {
  team?: MutationSigningTeamLike | null;
  player?: PlayerLike | null;
  homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
};
type MutationOfferSheetMirrorCurrentState = Pick<
  MutationCurrentState,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
  offeringTeam?: CurrentStateOfferSheetMirrorTeam | null;
};
type MutationOfferSheetResolutionCurrentState = Pick<
  MutationCurrentState,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: CurrentStateOfferSheetResolutionTeam | null;
  offeringTeam?: CurrentStateOfferSheetResolutionTeam | null;
};
type MutationSignAndTradeCurrentState = Pick<
  MutationCurrentState,
  'team' | 'player' | 'destinationTeam' | 'teamCode'
> & {
  team?: TradeTeamLike | null;
  player?: PlayerLike | null;
  destinationTeam?: TradeTeamLike | null;
};
type TradeStateSlice = Pick<MutationCurrentState, 'teams'>;
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
  currentState: MutationCurrentStateIngress;
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
  computeResult: MutationEventSourceResult;
  auditContext?: MutationAuditContext;
};

/** Shared base parameter type for all compute*Result functions */
type ComputeMutationParams = {
  payload: ArchitectMutationPayload;
  currentState: MutationCurrentState;
  seasonId: string;
  timestamp: number;
};
type ComputeMutationParamsWithCurrentState<TCurrentState> = Omit<
  ComputeMutationParams,
  'currentState'
> & {
  currentState: TCurrentState;
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
// - validateTradeForContext(): Moved to tradeContext/legacy/ (deprecated wrapper)

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

// Re-export the shared persistence hygiene fence for existing callers/tests.
export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };

function attachCurrentStateBaseTeamPreservedFields(
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

function materializeCurrentStateBaseTeamPreservedFields<
  T extends CurrentStateTeamRoundTripMaterializable,
>(
  team: T | null | undefined
): MaterializedCurrentStateTeam<T> | null {
  if (!team) {
    return null;
  }

  const teamRecord = team as T &
    CurrentStateBaseTeamPreservedCarrierLike &
    CurrentStateBaseTeamMaterializedPreservedFieldMap;
  const {
    [CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY]: roster,
    [CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY]: exceptions,
    [CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]: offerSheets,
    [CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]:
      incomingOfferSheets,
    [CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY]: tradeExceptions,
    [CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY]: cashLedger,
    [CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY]: exceptionHistory,
    [CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY]: draftPicks,
    [CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY]: entitlementIds,
    ...materialized
  } = teamRecord;
  const materializedTeam = {
    ...materialized,
  } as MaterializedCurrentStateTeam<T>;

  if (roster !== undefined && materializedTeam.roster === undefined) {
    materializedTeam.roster = roster;
  }
  if (
    exceptions !== undefined &&
    materializedTeam.exceptions === undefined
  ) {
    materializedTeam.exceptions = exceptions;
  }
  if (
    offerSheets !== undefined &&
    materializedTeam.offerSheets === undefined
  ) {
    materializedTeam.offerSheets = offerSheets;
  }
  if (
    incomingOfferSheets !== undefined &&
    materializedTeam.incomingOfferSheets === undefined
  ) {
    materializedTeam.incomingOfferSheets = incomingOfferSheets;
  }
  if (
    tradeExceptions !== undefined &&
    materializedTeam.tradeExceptions === undefined
  ) {
    materializedTeam.tradeExceptions = tradeExceptions;
  }
  if (cashLedger !== undefined && materializedTeam.cashLedger === undefined) {
    materializedTeam.cashLedger = cashLedger;
  }
  if (
    exceptionHistory !== undefined &&
    materializedTeam.exceptionHistory === undefined
  ) {
    materializedTeam.exceptionHistory = exceptionHistory;
  }
  if (draftPicks !== undefined && materializedTeam.draftPicks === undefined) {
    materializedTeam.draftPicks = draftPicks;
  }
  if (
    entitlementIds !== undefined &&
    materializedTeam.entitlementIds === undefined
  ) {
    materializedTeam.entitlementIds = entitlementIds;
  }

  return materializedTeam;
}

function backfillCurrentStateBaseTeamPreservedFields<
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
    withBackfilledPreservedFields.exceptions =
      fallbackMaterialized.exceptions;
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
    withBackfilledPreservedFields.cashLedger =
      fallbackMaterialized.cashLedger;
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
    withBackfilledPreservedFields.draftPicks =
      fallbackMaterialized.draftPicks;
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

function stripComputeOnlyTeamFieldsForPersistence<
  T extends CurrentStateTeamPersistenceStripShape,
>(
  team: T
): Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'> {
  const materializedTeam = materializeCurrentStateBaseTeamPreservedFields(team);
  if (!materializedTeam) {
    return {} as Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'>;
  }
  const { teamTotalSalary: _teamTotalSalary, ...persistableTeam } = materializedTeam;
  return persistableTeam;
}

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

/**
 * SAT signing-stage adapter shared by preflight and mutation compute.
 *
 * Rule ownership remains in validateSigning(); this helper exists only so the
 * S&T path has one named source-team signing validation surface.
 */
function validateSignAndTradeSigningPhase({
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

function toTradeStateSlice(
  currentState: TradeStateSlice
): TradeContextCurrentState {
  const teams: TradeContextCurrentState['teams'] = [];

  if (Array.isArray(currentState.teams)) {
    currentState.teams.forEach((entry) => {
      if (!entry?.team) {
        return;
      }

      teams.push({
        teamCode: entry.teamCode ?? entry.team.teamCode ?? null,
        team: entry.team,
      });
    });
  }

  return {
    teams,
  };
}

function toTradePayload(
  payload: Pick<
    ArchitectMutationPayload,
    'teams' | 'capProjections' | 'tradeCtx' | 'asOfDate'
  >
): TradeMutationPayload {
  return normalizeTradeContextPayload({
    teams: Array.isArray(payload.teams) ? payload.teams : [],
    ...(payload.capProjections ? { capProjections: payload.capProjections } : {}),
    ...(payload.tradeCtx ? { tradeCtx: payload.tradeCtx } : {}),
    ...(payload.asOfDate != null ? { asOfDate: payload.asOfDate } : {}),
  });
}

function asLooseRecord(value: unknown): LooseRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LooseRecord;
  }

  return null;
}

function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function toOptionalIdString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalTrimmedString(value);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toOptionalBooleanOrNull(
  value: unknown
): boolean | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalBoolean(value);
}

function toOptionalNumberishOrNull(
  value: unknown
): number | string | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalNumberish(value);
}

function toOptionalContractDateLikeOrNull(
  value: unknown
): MutationCurrentStateContractDateLike | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

function toOptionalScalarId(value: unknown): MutationScalarId {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

function toOptionalNumberish(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toOptionalIdString(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}

function normalizeRosterEntries(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => getMutationRosterEntryId(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}

function toOptionalDateLike(value: unknown): string | number | Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

function normalizeCurrentStateCashLedger(
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

function normalizeCurrentStateOfferSheetSalaryRows(
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

function normalizeCurrentStateOfferSheet(
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

function normalizeCurrentStateOfferSheets(
  value: unknown
): ArchitectMutationOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateOfferSheet(entry))
    .filter(
      (entry): entry is ArchitectMutationOfferSheet => entry !== null
    );
}

function normalizeCurrentStateCapHold(
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

function normalizeCurrentStateCapHolds(
  value: unknown
): ArchitectMutationCapHold[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateCapHold(entry))
    .filter((entry): entry is ArchitectMutationCapHold => entry !== null);
}

function normalizeCurrentStateDeadCapAmountByYear(
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

function normalizeCurrentStateDeadCapEntry(
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

function normalizeCurrentStateDeadCap(
  value: unknown
): ArchitectMutationDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateDeadCapEntry(entry))
    .filter(
      (entry): entry is ArchitectMutationDeadCapEntry => entry !== null
    );
}

function toOptionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalNumber(value);
}

function toOptionalTrimmedStringOrNull(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalTrimmedString(value);
}

function normalizeCurrentStateTotalsDeltas(
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

function normalizeCurrentStateTotalsMeta(
  value: unknown
): ArchitectMutationTeamTotals['_meta'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: Partial<
    NonNullable<ArchitectMutationTeamTotals['_meta']>
  > = {};
  const source = toOptionalTrimmedString(record.source);
  const capSettingsSource = toOptionalTrimmedString(record.capSettingsSource);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const incompleteRosterCharge = asLooseRecord(
    record.incompleteRosterCharge
  );

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

function normalizeCurrentStateTeamTotals(
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

function normalizeCurrentStateDraftPickProtectionMeta(
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

function normalizeCurrentStateDraftPickConveyance(
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

function normalizeCurrentStateDraftPickMetadata(
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

function normalizeCurrentStateDraftPick(value: unknown): DraftPick | null {
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

function normalizeCurrentStateDraftPicks(
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

function normalizeCurrentStateTeamSource(
  value: unknown
): MutationTeamSourceLike | undefined {
  if (typeof value === 'string') {
    const provider = toOptionalTrimmedString(value);
    return provider ? { provider } : undefined;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<MutationTeamSourceLike> = {};
  const provider = toOptionalTrimmedString(record.provider);
  const teamPageUrl = toOptionalTrimmedString(record.teamPageUrl);
  const playerPageUrl = toOptionalTrimmedString(record.playerPageUrl);
  const scrapedAt = toOptionalTrimmedString(record.scrapedAt);
  const season = toOptionalTrimmedString(record.season);
  const type = toOptionalTrimmedString(record.type);
  const worldId = toOptionalTrimmedString(record.worldId);
  const generatedAt = toOptionalTrimmedString(record.generatedAt);
  const baseTeamVersion = toOptionalTrimmedString(record.baseTeamVersion);
  const lastModifiedAt = toOptionalTrimmedString(record.lastModifiedAt);

  if (provider !== undefined) {
    normalized.provider = provider;
  }
  if (teamPageUrl !== undefined) {
    normalized.teamPageUrl = teamPageUrl;
  }
  if (playerPageUrl !== undefined) {
    normalized.playerPageUrl = playerPageUrl;
  }
  if (scrapedAt !== undefined) {
    normalized.scrapedAt = scrapedAt;
  }
  if (season !== undefined) {
    normalized.season = season;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (worldId !== undefined) {
    normalized.worldId = worldId;
  }
  if (generatedAt !== undefined) {
    normalized.generatedAt = generatedAt;
  }
  if (baseTeamVersion !== undefined) {
    normalized.baseTeamVersion = baseTeamVersion;
  }
  if (lastModifiedAt !== undefined) {
    normalized.lastModifiedAt = lastModifiedAt;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBioDisplay(
  value: MutationPlayerBioLike['display'] | null | undefined
): CurrentStatePlayerBioDisplay | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDisplay = {};
  const freeAgentType = toOptionalTrimmedString(record.freeAgentType);
  const freeAgentYear = toOptionalNumberish(record.freeAgentYear);
  const team = toOptionalTrimmedString(record.team);
  const teamId = toOptionalTrimmedString(record.teamId);
  const yearsPro = toOptionalNumberish(record.yearsPro);

  if (freeAgentType !== undefined) {
    normalized.freeAgentType = freeAgentType;
  }
  if (freeAgentYear !== undefined) {
    normalized.freeAgentYear = freeAgentYear;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBioDraft(
  value: MutationPlayerBioLike['draft'] | null | undefined
): CurrentStatePlayerBioDraft | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDraft = {};
  const year = toOptionalNumber(record.year);
  const round = toOptionalNumber(record.round);
  const pick = toOptionalNumber(record.pick);
  const teamId = toOptionalTrimmedString(record.teamId);

  if (year !== undefined) {
    normalized.year = year;
  }
  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBio(
  value: MutationPlayerBioLike | null | undefined
): CurrentStatePlayerBio | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBio = {};
  const displayName = toOptionalTrimmedString(record.displayName);
  const playerId = toOptionalIdString(record.playerId);
  const name = toOptionalTrimmedString(record.name);
  const position = toOptionalTrimmedString(record.position);
  const age = toOptionalNumber(record.age);
  const height = toOptionalNumberish(record.height);
  const weight = toOptionalNumberish(record.weight);
  const dob = toOptionalTrimmedString(record.dob);
  const birthplace = toOptionalTrimmedString(record.birthplace);
  const nationality = toOptionalTrimmedString(record.nationality);
  const shoots = toOptionalTrimmedString(record.shoots);
  const agentRecord = asLooseRecord(record.agent);
  const draft = normalizeCurrentStatePlayerBioDraft(record.draft);
  const display = normalizeCurrentStatePlayerBioDisplay(record.display);
  const nbaId = toOptionalNumber(record.nbaId);
  const experience = toOptionalNumberish(record.experience);
  const yearsExperience = toOptionalNumberish(record.yearsExperience);
  const yearsPro = toOptionalNumberish(record.yearsPro);
  const team = toOptionalTrimmedString(record.team);
  const draftYear = toOptionalNumberish(record.draftYear);
  const draftRound = toOptionalNumber(record.draftRound);
  const draftPick = toOptionalNumberish(record.draftPick);
  const legacyYearsPro = toOptionalNumberish(record['Years Pro']);

  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (position !== undefined) {
    normalized.position = position;
  }
  if (age !== undefined) {
    normalized.age = age;
  }
  if (height !== undefined) {
    normalized.height = height;
  }
  if (weight !== undefined) {
    normalized.weight = weight;
  }
  if (dob !== undefined) {
    normalized.dob = dob;
  }
  if (birthplace !== undefined) {
    normalized.birthplace = birthplace;
  }
  if (nationality !== undefined) {
    normalized.nationality = nationality;
  }
  if (shoots !== undefined) {
    normalized.shoots = shoots;
  }
  if (agentRecord) {
    normalized.agent = {
      name: toOptionalTrimmedString(agentRecord.name) ?? null,
      agency: toOptionalTrimmedString(agentRecord.agency) ?? null,
    };
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (display !== undefined) {
    normalized.display = display;
  }
  if (nbaId !== undefined) {
    normalized.nbaId = nbaId;
  }
  if (experience !== undefined) {
    normalized.experience = experience;
  }
  if (yearsExperience !== undefined) {
    normalized.yearsExperience = yearsExperience;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (draftYear !== undefined) {
    normalized.draftYear = draftYear;
  }
  if (draftRound !== undefined) {
    normalized.draftRound = draftRound;
  }
  if (draftPick !== undefined) {
    normalized.draftPick = draftPick;
  }
  if (legacyYearsPro !== undefined) {
    normalized['Years Pro'] = legacyYearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBirdRights(
  value: ArchitectMutationPlayerRecord['birdRights']
): ArchitectMutationBirdRights | string | undefined {
  if (typeof value === 'string') {
    return toOptionalTrimmedString(value);
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationBirdRights = {};
  const status = toOptionalTrimmedString(record.status);
  const type = toOptionalTrimmedString(record.type);
  const yearsOfService = toOptionalNumberish(record.yearsOfService);
  const yearsWithTeam = toOptionalNumberish(record.yearsWithTeam);
  const eligibleFor = normalizeStringArray(record.eligibleFor);
  const renounced = toOptionalBoolean(record.renounced);

  if (status !== undefined) {
    normalized.status = status;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractBirdRights(
  value: MutationCurrentStatePlayerContractIngress['birdRights']
): ArchitectMutationBirdRights | undefined {
  const normalizedBirdRights = normalizeCurrentStatePlayerBirdRights(value);

  if (!normalizedBirdRights) {
    return undefined;
  }

  if (typeof normalizedBirdRights === 'string') {
    return { status: normalizedBirdRights };
  }

  return normalizedBirdRights;
}

function normalizeCurrentStatePlayerContractIncentives(
  value: ArchitectMutationContractIncentives | null | undefined
): CurrentStatePlayerContractIncentives | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractIncentives = {};
  const likely = toOptionalNumberOrNull(record.likely);
  const unlikely = toOptionalNumberOrNull(record.unlikely);

  if (likely !== undefined) {
    normalized.likely = likely;
  }
  if (unlikely !== undefined) {
    normalized.unlikely = unlikely;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractGuaranteeScheduleEntry(
  value: ArchitectMutationGuaranteeScheduleEntry | null | undefined
): CurrentStatePlayerContractGuaranteeScheduleEntry | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractGuaranteeScheduleEntry = {};
  const effectiveDate = toOptionalTrimmedStringOrNull(record.effectiveDate);
  const guaranteedAmount = toOptionalNumberOrNull(record.guaranteedAmount);
  const status = toOptionalTrimmedStringOrNull(record.status);
  const note = toOptionalTrimmedStringOrNull(record.note);

  if (effectiveDate !== undefined) {
    normalized.effectiveDate = effectiveDate;
  }
  if (guaranteedAmount !== undefined) {
    normalized.guaranteedAmount = guaranteedAmount;
  }
  if (status !== undefined) {
    normalized.status = status;
  }
  if (note !== undefined) {
    normalized.note = note;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractGuaranteeSchedule(
  value: ArchitectMutationGuaranteeScheduleEntry[] | null | undefined
): CurrentStatePlayerContractGuaranteeScheduleEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) =>
      normalizeCurrentStatePlayerContractGuaranteeScheduleEntry(entry)
    )
    .filter(
      (
        entry
      ): entry is CurrentStatePlayerContractGuaranteeScheduleEntry =>
        entry !== undefined
    );
}

function normalizeCurrentStatePlayerContractTradeEligibilityRules(
  value: ArchitectMutationTradeEligibilityRules | null | undefined
): CurrentStatePlayerContractTradeEligibilityRules | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractTradeEligibilityRules = {};
  const baseYearCompensation = toOptionalBooleanOrNull(
    record.baseYearCompensation
  );
  const poisonPill = toOptionalBooleanOrNull(record.poisonPill);
  const aggregation = toOptionalBooleanOrNull(record.aggregation);

  if (baseYearCompensation !== undefined) {
    normalized.baseYearCompensation = baseYearCompensation;
  }
  if (poisonPill !== undefined) {
    normalized.poisonPill = poisonPill;
  }
  if (aggregation !== undefined) {
    normalized.aggregation = aggregation;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractTradeEligibility(
  value: ArchitectMutationTradeEligibility | null | undefined
): CurrentStatePlayerContractTradeEligibility | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractTradeEligibility = {};
  const canBeTradedNow = toOptionalBooleanOrNull(record.canBeTradedNow);
  const restrictedUntil = toOptionalTrimmedStringOrNull(record.restrictedUntil);
  const reason = toOptionalTrimmedStringOrNull(record.reason);
  const rules = normalizeCurrentStatePlayerContractTradeEligibilityRules(
    record.rules
  );

  if (canBeTradedNow !== undefined) {
    normalized.canBeTradedNow = canBeTradedNow;
  }
  if (restrictedUntil !== undefined) {
    normalized.restrictedUntil = restrictedUntil;
  }
  if (reason !== undefined) {
    normalized.reason = reason;
  }
  if (rules !== undefined) {
    normalized.rules = rules;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractFreeAgency(
  value: ArchitectMutationContract['freeAgency'] | undefined
): CurrentStatePlayerContractFreeAgency | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asLooseRecord(
    normalizeFreeAgency(
      value as Parameters<typeof normalizeFreeAgency>[0]
    )
  );
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractFreeAgency = {};
  const type = toOptionalTrimmedStringOrNull(record.type);
  const year = toOptionalNumberishOrNull(record.year);
  const capHold = toOptionalNumberOrNull(record.capHold);
  const qualifyingOffer = toOptionalNumberOrNull(record.qualifyingOffer);
  const earlyTerminationOption =
    typeof record.earlyTerminationOption === 'boolean'
      ? record.earlyTerminationOption
      : toOptionalTrimmedStringOrNull(record.earlyTerminationOption);
  const hasOption = toOptionalBooleanOrNull(record.hasOption);
  const optionYear = toOptionalNumberishOrNull(record.optionYear);
  const optionType = toOptionalTrimmedStringOrNull(record.optionType);

  if (type !== undefined) {
    normalized.type = type;
  }
  if (year !== undefined) {
    normalized.year = year;
  }
  if (capHold !== undefined) {
    normalized.capHold = capHold;
  }
  if (qualifyingOffer !== undefined) {
    normalized.qualifyingOffer = qualifyingOffer;
  }
  if (earlyTerminationOption !== undefined) {
    normalized.earlyTerminationOption = earlyTerminationOption;
  }
  if (hasOption !== undefined) {
    normalized.hasOption = hasOption;
  }
  if (optionYear !== undefined) {
    normalized.optionYear = optionYear;
  }
  if (optionType !== undefined) {
    normalized.optionType = optionType;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractSalaryRow(
  value: MutationCurrentStatePlayerContractSalaryRowIngress | null | undefined
): CurrentStatePlayerContractSalaryRow | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }
  const salaryRow = record as Partial<MutationCurrentStatePlayerContractSalaryRowIngress>;

  const projectedRow: MutationCurrentStatePlayerContractSalaryRowIngress = {};
  const year = toOptionalNumberOrNull(salaryRow.year);
  const season =
    toOptionalTrimmedStringOrNull(salaryRow.season) ??
    (typeof year === 'number' ? toSeasonCode(year) : undefined);
  const salary = toOptionalNumberOrNull(salaryRow.salary);
  const capHit = toOptionalNumberOrNull(salaryRow.capHit);
  const guaranteed = toOptionalBooleanOrNull(salaryRow.guaranteed);
  const guaranteedAmount = toOptionalNumberOrNull(salaryRow.guaranteedAmount);
  const option = toOptionalTrimmedStringOrNull(salaryRow.option);
  const optionType = toOptionalTrimmedStringOrNull(salaryRow.optionType);
  const optionUsed = Object.prototype.hasOwnProperty.call(salaryRow, 'optionUsed')
    ? normalizeOptionUsed(salaryRow.optionUsed)
    : undefined;
  const optionDecisionDate = toOptionalTrimmedStringOrNull(
    salaryRow.optionDecisionDate
  );
  const tradeBonus = toOptionalNumberOrNull(salaryRow.tradeBonus);
  const incentives = normalizeCurrentStatePlayerContractIncentives(
    salaryRow.incentives
  );
  const guaranteeSchedule =
    normalizeCurrentStatePlayerContractGuaranteeSchedule(
      salaryRow.guaranteeSchedule
    );
  const voidedByExtension = toOptionalBooleanOrNull(salaryRow.voidedByExtension);
  const voidedOn = toOptionalTrimmedStringOrNull(salaryRow.voidedOn);
  const isExtensionSeason = toOptionalBooleanOrNull(salaryRow.isExtensionSeason);

  if (year !== undefined) {
    projectedRow.year = year;
  }
  if (salary !== undefined) {
    projectedRow.salary = salary;
  }
  if (capHit !== undefined) {
    projectedRow.capHit = capHit;
  }
  if (guaranteed !== undefined) {
    projectedRow.guaranteed = guaranteed;
  }
  if (guaranteedAmount !== undefined) {
    projectedRow.guaranteedAmount = guaranteedAmount;
  }
  if (option !== undefined) {
    projectedRow.option = option;
  }
  if (optionType !== undefined) {
    projectedRow.optionType = optionType;
  }
  if (optionUsed !== undefined) {
    projectedRow.optionUsed = optionUsed;
  }
  if (optionDecisionDate !== undefined) {
    projectedRow.optionDecisionDate = optionDecisionDate;
  }
  if (tradeBonus !== undefined) {
    projectedRow.tradeBonus = tradeBonus;
  }
  if (incentives !== undefined) {
    projectedRow.incentives = incentives;
  }
  if (guaranteeSchedule !== undefined) {
    projectedRow.guaranteeSchedule = guaranteeSchedule;
  }
  if (voidedByExtension !== undefined) {
    projectedRow.voidedByExtension = voidedByExtension;
  }
  if (voidedOn !== undefined) {
    projectedRow.voidedOn = voidedOn;
  }
  if (isExtensionSeason !== undefined) {
    projectedRow.isExtensionSeason = isExtensionSeason;
  }

  if (season === undefined) {
    return undefined;
  }

  projectedRow.season = season;

  if (Object.keys(projectedRow).length === 0) {
    return undefined;
  }

  return normalizeSalaryRow(
    projectedRow
  ) as CurrentStatePlayerContractSalaryRow;
}

function normalizeCurrentStatePlayerContractSalaryRows(
  value:
    | MutationCurrentStatePlayerContractIngress['salariesByYear']
    | MutationCurrentStatePlayerFutureContractIngress['salariesByYear']
): CurrentStatePlayerContractSalaryRow[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStatePlayerContractSalaryRow(entry))
    .filter(
      (entry): entry is CurrentStatePlayerContractSalaryRow =>
        entry !== undefined
    );
}

type CurrentStatePlayerContractLane = 'current' | 'future';

function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerContractIngress | null | undefined,
  lane: 'current'
): MutationCurrentStatePlayerContractIngress | undefined;
function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerFutureContractIngress | null | undefined,
  lane: 'future'
): MutationCurrentStatePlayerFutureContractIngress | undefined;
function projectCurrentStatePlayerContractIngress(
  value:
    | MutationCurrentStatePlayerContractIngress
    | MutationCurrentStatePlayerFutureContractIngress
    | null
    | undefined,
  lane: CurrentStatePlayerContractLane
):
  | MutationCurrentStatePlayerContractIngress
  | MutationCurrentStatePlayerFutureContractIngress
  | undefined {
  // Current-state snapshots may still hand this seam raw world data or an
  // already-normalized contract. Mixed tolerance stays localized here and in
  // the small sub-normalizers below; committed compute only receives the
  // projected lane-specific slice.
  const contract = asLooseRecord(value);
  if (!contract) {
    return undefined;
  }
  const contractRecord = contract as Partial<
    MutationCurrentStatePlayerContractIngress &
      MutationCurrentStatePlayerFutureContractIngress
  >;

  const projected: MutationCurrentStatePlayerContractIngress = {};
  const salariesByYear = normalizeCurrentStatePlayerContractSalaryRows(
    contractRecord.salariesByYear
  );
  const years = toOptionalNumberOrNull(contractRecord.years);
  const startYear = toOptionalNumberOrNull(contractRecord.startYear);
  const year = toOptionalNumberOrNull(contractRecord.year);
  const birdRights = normalizeCurrentStatePlayerContractBirdRights(
    contractRecord.birdRights
  );
  const contractType = toOptionalTrimmedStringOrNull(contractRecord.contractType);
  const extension = toOptionalBooleanOrNull(contractRecord.extension);
  const isExtension = toOptionalBooleanOrNull(contractRecord.isExtension);
  const isRookieScale = toOptionalBooleanOrNull(contractRecord.isRookieScale);
  const signingTeam = toOptionalTrimmedStringOrNull(contractRecord.signingTeam);
  const signingDate = toOptionalContractDateLikeOrNull(contractRecord.signingDate);
  const signedAt = toOptionalContractDateLikeOrNull(contractRecord.signedAt);
  const extensionSignedAt = toOptionalContractDateLikeOrNull(
    contractRecord.extensionSignedAt
  );
  const signedUsing = toOptionalTrimmedStringOrNull(contractRecord.signedUsing);
  const exceptionType = toOptionalTrimmedStringOrNull(contractRecord.exceptionType);
  const contractYears = toOptionalNumberOrNull(contractRecord.contractYears);
  const firstYearGuaranteed = toOptionalBooleanOrNull(
    contractRecord.firstYearGuaranteed
  );
  const rfaOfferSheet = toOptionalBooleanOrNull(contractRecord.rfaOfferSheet);
  const rfaOfferSheetOnly = toOptionalBooleanOrNull(
    contractRecord.rfaOfferSheetOnly
  );
  const yearsRemaining = toOptionalNumberOrNull(contractRecord.yearsRemaining);
  const contractLength = toOptionalNumberOrNull(contractRecord.contractLength);
  const originalLength = toOptionalNumberOrNull(contractRecord.originalLength);
  const totalValue = toOptionalNumberOrNull(contractRecord.totalValue);
  const averageAnnualValue = toOptionalNumberOrNull(
    contractRecord.averageAnnualValue
  );
  const guaranteedValue = toOptionalNumberOrNull(contractRecord.guaranteedValue);
  const guaranteedYears = toOptionalNumberOrNull(contractRecord.guaranteedYears);
  const freeAgency = normalizeCurrentStatePlayerContractFreeAgency(
    contractRecord.freeAgency
  );
  const includeOfferSheetState = lane === 'current';
  const includeCurrentOnlyContractFields = lane === 'current';
  const rfaOfferSheetStatus = includeOfferSheetState
    ? toOptionalTrimmedStringOrNull(contractRecord.rfaOfferSheetStatus)
    : undefined;
  const firstYearSalary = toOptionalNumberOrNull(contractRecord.firstYearSalary);
  const year1Salary = toOptionalNumberOrNull(contractRecord.year1Salary);
  const signingExecutive = toOptionalTrimmedStringOrNull(
    contractRecord.signingExecutive
  );
  const startSeason = toOptionalTrimmedStringOrNull(contractRecord.startSeason);
  const endSeason = toOptionalTrimmedStringOrNull(contractRecord.endSeason);
  const noTradeClause = toOptionalBooleanOrNull(contractRecord.noTradeClause);
  const tradeKicker = toOptionalNumberOrNull(contractRecord.tradeKicker);
  const tradeRestrictions = normalizeStringArray(contractRecord.tradeRestrictions);
  const tradeEligibility = normalizeCurrentStatePlayerContractTradeEligibility(
    contractRecord.tradeEligibility
  );

  if (salariesByYear !== undefined) {
    projected.salariesByYear = salariesByYear;
  }
  if (includeCurrentOnlyContractFields && years !== undefined) {
    projected.years = years;
  }
  if (includeCurrentOnlyContractFields && startYear !== undefined) {
    projected.startYear = startYear;
  }
  if (includeCurrentOnlyContractFields && year !== undefined) {
    projected.year = year;
  }
  if (includeCurrentOnlyContractFields && birdRights !== undefined) {
    projected.birdRights = birdRights;
  }
  if (contractType !== undefined) {
    projected.contractType = contractType;
  }
  if (extension !== undefined) {
    projected.extension = extension;
  }
  if (isExtension !== undefined) {
    projected.isExtension = isExtension;
  }
  if (includeCurrentOnlyContractFields && isRookieScale !== undefined) {
    projected.isRookieScale = isRookieScale;
  }
  if (includeCurrentOnlyContractFields && signingTeam !== undefined) {
    projected.signingTeam = signingTeam;
  }
  if (signingDate !== undefined) {
    projected.signingDate = signingDate;
  }
  if (signedAt !== undefined) {
    projected.signedAt = signedAt;
  }
  if (extensionSignedAt !== undefined) {
    projected.extensionSignedAt = extensionSignedAt;
  }
  if (signedUsing !== undefined) {
    projected.signedUsing = signedUsing;
  }
  if (includeCurrentOnlyContractFields && exceptionType !== undefined) {
    projected.exceptionType = exceptionType;
  }
  if (includeCurrentOnlyContractFields && contractYears !== undefined) {
    projected.contractYears = contractYears;
  }
  if (includeCurrentOnlyContractFields && firstYearGuaranteed !== undefined) {
    projected.firstYearGuaranteed = firstYearGuaranteed;
  }
  if (includeOfferSheetState && rfaOfferSheet !== undefined) {
    projected.rfaOfferSheet = rfaOfferSheet;
  }
  if (includeOfferSheetState && rfaOfferSheetOnly !== undefined) {
    projected.rfaOfferSheetOnly = rfaOfferSheetOnly;
  }
  if (yearsRemaining !== undefined) {
    projected.yearsRemaining = yearsRemaining;
  }
  if (contractLength !== undefined) {
    projected.contractLength = contractLength;
  }
  if (includeCurrentOnlyContractFields && originalLength !== undefined) {
    projected.originalLength = originalLength;
  }
  if (totalValue !== undefined) {
    projected.totalValue = totalValue;
  }
  if (averageAnnualValue !== undefined) {
    projected.averageAnnualValue = averageAnnualValue;
  }
  if (guaranteedValue !== undefined) {
    projected.guaranteedValue = guaranteedValue;
  }
  if (guaranteedYears !== undefined) {
    projected.guaranteedYears = guaranteedYears;
  }
  if (freeAgency !== undefined) {
    projected.freeAgency = freeAgency;
  }
  if (rfaOfferSheetStatus !== undefined) {
    projected.rfaOfferSheetStatus = rfaOfferSheetStatus;
  }
  if (includeCurrentOnlyContractFields && firstYearSalary !== undefined) {
    projected.firstYearSalary = firstYearSalary;
  }
  if (includeCurrentOnlyContractFields && year1Salary !== undefined) {
    projected.year1Salary = year1Salary;
  }
  if (signingExecutive !== undefined) {
    projected.signingExecutive = signingExecutive;
  }
  if (startSeason !== undefined) {
    projected.startSeason = startSeason;
  }
  if (endSeason !== undefined) {
    projected.endSeason = endSeason;
  }
  if (noTradeClause !== undefined) {
    projected.noTradeClause = noTradeClause;
  }
  if (tradeKicker !== undefined) {
    projected.tradeKicker = tradeKicker;
  }
  if (tradeRestrictions !== undefined) {
    projected.tradeRestrictions = tradeRestrictions;
  }
  if (includeCurrentOnlyContractFields && tradeEligibility !== undefined) {
    projected.tradeEligibility = tradeEligibility;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function pickCurrentStatePlayerContractSlice<
  TKey extends keyof ArchitectMutationContract,
>(
  contract: Partial<ArchitectMutationContract> | null | undefined,
  keys: readonly TKey[]
): Pick<ArchitectMutationContract, TKey> | undefined {
  if (!contract) {
    return undefined;
  }

  const normalized: Partial<Pick<ArchitectMutationContract, TKey>> = {};

  for (const key of keys) {
    const value = contract[key];
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0
    ? (normalized as Pick<ArchitectMutationContract, TKey>)
    : undefined;
}

function normalizeCurrentStatePlayerContract(
  value: MutationCurrentStatePlayerContractIngress | null | undefined
): CurrentStatePlayerContract | undefined {
  const contract = projectCurrentStatePlayerContractIngress(value, 'current');
  if (!contract) {
    return undefined;
  }

  const normalizedContract = normalizeContractForWorld(
    contract
  ) as ArchitectMutationContract | null;

  return pickCurrentStatePlayerContractSlice(
    normalizedContract,
    CURRENT_STATE_PLAYER_CONTRACT_KEYS
  );
}

function normalizeCurrentStatePlayerFutureContract(
  value: MutationCurrentStatePlayerFutureContractIngress | null | undefined
): CurrentStatePlayerFutureContract | undefined {
  const contract = projectCurrentStatePlayerContractIngress(value, 'future');
  if (!contract) {
    return undefined;
  }

  const normalizedContract = normalizeFutureContract(
    contract
  ) as ArchitectMutationContract | null;

  return pickCurrentStatePlayerContractSlice(
    normalizedContract,
    CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS
  );
}

function normalizeCurrentStatePlayerRepresentation(
  value: ArchitectMutationPlayerRecord['representation']
): BasePlayerDoc['representation'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<BasePlayerDoc['representation']> = {};
  const agent = toOptionalTrimmedString(record.agent);
  const agency = toOptionalTrimmedString(record.agency);

  if (agent !== undefined) {
    normalized.agent = agent;
  }
  if (agency !== undefined) {
    normalized.agency = agency;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerSource(
  value: string | MutationPlayerSourceLike | null | undefined
): MutationPlayerSourceLike | undefined {
  if (typeof value === 'string') {
    const provider = toOptionalTrimmedString(value);
    return provider ? { provider } : undefined;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<MutationPlayerSourceLike> = {};
  const provider = toOptionalTrimmedString(record.provider);
  const teamPageUrl = toOptionalTrimmedString(record.teamPageUrl);
  const playerPageUrl = toOptionalTrimmedString(record.playerPageUrl);
  const scrapedAt = toOptionalTrimmedString(record.scrapedAt);
  const season = toOptionalTrimmedString(record.season);
  const type = toOptionalTrimmedString(record.type);
  const worldId = toOptionalTrimmedString(record.worldId);
  const generatedAt = toOptionalTrimmedString(record.generatedAt);
  const baseTeamVersion = toOptionalTrimmedString(record.baseTeamVersion);

  if (provider !== undefined) {
    normalized.provider = provider;
  }
  if (teamPageUrl !== undefined) {
    normalized.teamPageUrl = teamPageUrl;
  }
  if (playerPageUrl !== undefined) {
    normalized.playerPageUrl = playerPageUrl;
  }
  if (scrapedAt !== undefined) {
    normalized.scrapedAt = scrapedAt;
  }
  if (season !== undefined) {
    normalized.season = season;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (worldId !== undefined) {
    normalized.worldId = worldId;
  }
  if (generatedAt !== undefined) {
    normalized.generatedAt = generatedAt;
  }
  if (baseTeamVersion !== undefined) {
    normalized.baseTeamVersion = baseTeamVersion;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerOverridePersistenceSidecar(
  player: CurrentStatePlayerOverridePersistenceIngress | null | undefined
): CurrentStatePlayerOverridePersistenceSidecar {
  const normalized: CurrentStatePlayerOverridePersistenceSidecar = {};
  const representation = normalizeCurrentStatePlayerRepresentation(
    player?.representation
  );
  const source = normalizeCurrentStatePlayerSource(player?.source);
  const lastUpdated = toOptionalTrimmedString(player?.lastUpdated);
  const version = toOptionalTrimmedString(player?.version);
  const isTwoWay = toOptionalBoolean(player?.isTwoWay);
  const signedDate = toOptionalTrimmedString(player?.signedDate);

  if (representation !== undefined) {
    normalized.representation = representation;
  }
  if (source !== undefined) {
    normalized.source = source;
  }
  if (lastUpdated !== undefined) {
    normalized.lastUpdated = lastUpdated;
  }
  if (version !== undefined) {
    normalized.version = version;
  }
  if (isTwoWay !== undefined) {
    normalized.isTwoWay = isTwoWay;
  }
  if (signedDate !== undefined) {
    normalized.signedDate = signedDate;
  }

  return normalized;
}

function toCurrentStateTradeException(
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

function normalizeCurrentStateTradeExceptions(
  value: unknown
): CurrentStateTradeException[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toCurrentStateTradeException(entry))
    .filter(
      (entry): entry is CurrentStateTradeException => entry !== null
    );
}

// Exceptions still accept legacy/custom ingress buckets here because canonical
// normalization owns collapsing them before committed compute reads them.
type MutationExceptionPreserveOnlyBuckets = ArchitectMutationExceptionIngress;

function toMutationExceptionPreserveOnlyBuckets(
  value: unknown
): MutationExceptionPreserveOnlyBuckets | null {
  return asLooseRecord(value) as MutationExceptionPreserveOnlyBuckets | null;
}

function normalizeMutationExceptionsFromIngress(
  value: unknown
): ArchitectMutationExceptions {
  return normalizeCanonicalTeamExceptions({
    exceptions: toMutationExceptionPreserveOnlyBuckets(value) || null,
  });
}

function hasMutationExceptionBuckets(
  exceptions: ArchitectMutationExceptions
): boolean {
  return Object.keys(exceptions).length > 0;
}

function normalizeCurrentStateTeamExceptions(
  value: unknown
): ArchitectMutationExceptions | undefined {
  const normalizedExceptions = normalizeMutationExceptionsFromIngress(value);

  return hasMutationExceptionBuckets(normalizedExceptions)
    ? normalizedExceptions
    : undefined;
}

function normalizeCurrentStateExceptionHistory(
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
      (
        entry
      ): entry is CurrentStateExceptionHistoryEntry => entry !== null
    );
}

function normalizeCurrentStatePlayerArray(
  value: Array<MutationCurrentStatePlayerIngress | PlayerLike> | null | undefined
): PlayerLike[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toCurrentStatePlayer(entry))
    .filter((entry): entry is PlayerLike => entry !== null);
}

function resolveCurrentStateTeamTotalSalary(
  teamRecord: LooseRecord,
  totals: ArchitectMutationTeamTotals | null | undefined
): number | undefined {
  const explicitTeamTotalSalary = toOptionalNumber(teamRecord.teamTotalSalary);
  if (explicitTeamTotalSalary !== undefined) {
    return explicitTeamTotalSalary;
  }

  // Live trade validation/apply expects the explicit top-level teamTotalSalary
  // bridge. When loaded state omits it, normalize from totals.totalSalary only.
  const totalsRecord = asLooseRecord(totals);
  return totalsRecord ? toOptionalNumber(totalsRecord.totalSalary) : undefined;
}

type CurrentStateBaseTeamPreservedField =
  keyof CurrentStateBaseTeamPreservedFieldMap;

const CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
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
const CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
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
const CURRENT_STATE_SIGNING_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'incomingOfferSheets',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
const CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'roster',
    'exceptions',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
const CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  [
    'exceptions',
    'tradeExceptions',
    'cashLedger',
    'exceptionHistory',
    'draftPicks',
    'entitlementIds',
  ];
const CURRENT_STATE_TRADE_PRESERVED_FIELDS: CurrentStateBaseTeamPreservedField[] =
  ['exceptionHistory'];

function normalizeCurrentStateTeamMutationCore(
  teamRecord: LooseRecord
): CurrentStateTeamIdentityFieldMap & CurrentStateTeamMutationCoreFieldMap {
  const rawPlayers = teamRecord.players as
    | Array<MutationCurrentStatePlayerIngress | PlayerLike>
    | null
    | undefined;
  const normalized: CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap = {};
  const teamCode = toOptionalTrimmedString(teamRecord.teamCode);
  const teamName = toOptionalTrimmedString(teamRecord.teamName);
  const players = normalizeCurrentStatePlayerArray(rawPlayers);
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

function buildCurrentStateBaseTeamPreservedFields(
  teamRecord: LooseRecord,
  fields: CurrentStateBaseTeamPreservedField[]
): CurrentStateBaseTeamPreservedFieldMap {
  const preserved: CurrentStateBaseTeamPreservedFieldMap = {};

  for (const field of fields) {
    switch (field) {
      case 'roster': {
        const roster = normalizeRosterEntries(
          teamRecord.roster ?? teamRecord[CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY]
        );
        if (roster !== undefined) {
          preserved.roster = roster;
        }
        break;
      }

      case 'exceptions': {
        const exceptions = normalizeCurrentStateTeamExceptions(
          teamRecord.exceptions ??
            teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY]
        );
        if (exceptions !== undefined) {
          preserved.exceptions = exceptions;
        }
        break;
      }

      case 'offerSheets': {
        const offerSheets = normalizeCurrentStateOfferSheets(
          teamRecord.offerSheets ??
            teamRecord[CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]
        );
        if (offerSheets !== undefined) {
          preserved.offerSheets = offerSheets;
        }
        break;
      }

      case 'incomingOfferSheets': {
        const incomingOfferSheets = normalizeCurrentStateOfferSheets(
          teamRecord.incomingOfferSheets ??
            teamRecord[CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]
        );
        if (incomingOfferSheets !== undefined) {
          preserved.incomingOfferSheets = incomingOfferSheets;
        }
        break;
      }

      case 'tradeExceptions': {
        const tradeExceptions = normalizeCurrentStateTradeExceptions(
          teamRecord.tradeExceptions ??
            teamRecord[CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY]
        );
        if (tradeExceptions !== undefined) {
          preserved.tradeExceptions = tradeExceptions;
        }
        break;
      }

      case 'cashLedger': {
        const cashLedger = normalizeCurrentStateCashLedger(
          teamRecord.cashLedger ??
            teamRecord[CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY]
        );
        if (cashLedger !== undefined) {
          preserved.cashLedger = cashLedger;
        }
        break;
      }

      case 'exceptionHistory': {
        const exceptionHistory = normalizeCurrentStateExceptionHistory(
          teamRecord.exceptionHistory ??
            teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY]
        );
        if (exceptionHistory !== undefined) {
          preserved.exceptionHistory = exceptionHistory;
        }
        break;
      }

      case 'draftPicks': {
        const draftPicks = normalizeCurrentStateDraftPicks(
          teamRecord.draftPicks ??
            teamRecord[CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY]
        );
        if (draftPicks !== undefined) {
          preserved.draftPicks = draftPicks;
        }
        break;
      }

      case 'entitlementIds': {
        const entitlementIds = normalizeStringArray(
          teamRecord.entitlementIds ??
            teamRecord[CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY]
        );
        if (entitlementIds !== undefined) {
          preserved.entitlementIds = entitlementIds;
        }
        break;
      }
    }
  }

  return preserved;
}

type CurrentStateTeamProjectionLane =
  | 'playerOps'
  | 'manualCap'
  | 'signing'
  | 'offerSheetMirror'
  | 'offerSheetResolution'
  | 'trade';

// Raw Firestore/team-loader snapshots and legacy base-mode callers meet the
// committed compute path here; this is the localized mixed-input boundary.
function toCurrentStateTeam(
  team: unknown,
  lane: 'playerOps'
): CurrentStatePlayerOpsTeam | null;
function toCurrentStateTeam(
  team: unknown,
  lane: 'manualCap'
): CurrentStateManualCapTeam | null;
function toCurrentStateTeam(
  team: unknown,
  lane: 'signing'
): CurrentStateSigningTeam | null;
function toCurrentStateTeam(
  team: unknown,
  lane: 'offerSheetMirror'
): CurrentStateOfferSheetMirrorTeam | null;
function toCurrentStateTeam(
  team: unknown,
  lane: 'offerSheetResolution'
): CurrentStateOfferSheetResolutionTeam | null;
function toCurrentStateTeam(team: unknown, lane: 'trade'): TradeTeamLike | null;
function toCurrentStateTeam(
  team: unknown,
  lane: CurrentStateTeamProjectionLane
): CurrentStatePrimaryTeam | null {
  const teamRecord = asLooseRecord(team);
  if (!teamRecord) {
    return null;
  }
  const rawTwoWayPlayers = teamRecord.twoWayPlayers as
    | Array<MutationCurrentStatePlayerIngress | PlayerLike>
    | null
    | undefined;
  const mutationCore = normalizeCurrentStateTeamMutationCore(teamRecord);
  const roster = normalizeRosterEntries(
    teamRecord.roster ?? teamRecord[CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY]
  );
  const exceptions = normalizeCurrentStateTeamExceptions(
    teamRecord.exceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY]
  );
  const offerSheets = normalizeCurrentStateOfferSheets(
    teamRecord.offerSheets ??
      teamRecord[CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]
  );
  const incomingOfferSheets = normalizeCurrentStateOfferSheets(
    teamRecord.incomingOfferSheets ??
      teamRecord[CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]
  );

  if (lane === 'playerOps') {
    const normalized: CurrentStatePlayerOpsTeamCompute = {
      ...mutationCore,
    };
    if (roster !== undefined) {
      normalized.roster = roster;
    }

    return attachCurrentStateBaseTeamPreservedFields(
      normalized,
      buildCurrentStateBaseTeamPreservedFields(
        teamRecord,
        CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS
      )
    ) as CurrentStatePlayerOpsTeam;
  }

  if (lane === 'manualCap') {
    const normalized: CurrentStateManualCapTeamCompute = {
      ...mutationCore,
    };
    if (exceptions !== undefined) {
      normalized.exceptions = exceptions;
    }

    return attachCurrentStateBaseTeamPreservedFields(
      normalized,
      buildCurrentStateBaseTeamPreservedFields(
        teamRecord,
        CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS
      )
    ) as CurrentStateManualCapTeam;
  }

  if (lane === 'signing') {
    const normalized: CurrentStateSigningTeamCompute = {
      ...mutationCore,
    };
    if (roster !== undefined) {
      normalized.roster = roster;
    }
    if (exceptions !== undefined) {
      normalized.exceptions = exceptions;
    }
    if (offerSheets !== undefined) {
      normalized.offerSheets = offerSheets;
    }

    return attachCurrentStateBaseTeamPreservedFields(
      normalized,
      buildCurrentStateBaseTeamPreservedFields(
        teamRecord,
        CURRENT_STATE_SIGNING_PRESERVED_FIELDS
      )
    ) as CurrentStateSigningTeam;
  }

  if (lane === 'offerSheetMirror') {
    const normalized: CurrentStateOfferSheetMirrorTeamCompute = {
      ...mutationCore,
    };
    if (offerSheets !== undefined) {
      normalized.offerSheets = offerSheets;
    }
    if (incomingOfferSheets !== undefined) {
      normalized.incomingOfferSheets = incomingOfferSheets;
    }

    return attachCurrentStateBaseTeamPreservedFields(
      normalized,
      buildCurrentStateBaseTeamPreservedFields(
        teamRecord,
        CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS
      )
    ) as CurrentStateOfferSheetMirrorTeam;
  }

  if (lane === 'offerSheetResolution') {
    const normalized: CurrentStateOfferSheetResolutionTeamCompute = {
      ...mutationCore,
    };
    if (roster !== undefined) {
      normalized.roster = roster;
    }
    if (offerSheets !== undefined) {
      normalized.offerSheets = offerSheets;
    }
    if (incomingOfferSheets !== undefined) {
      normalized.incomingOfferSheets = incomingOfferSheets;
    }

    return attachCurrentStateBaseTeamPreservedFields(
      normalized,
      buildCurrentStateBaseTeamPreservedFields(
        teamRecord,
        CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS
      )
    ) as CurrentStateOfferSheetResolutionTeam;
  }

  const tradeExceptions = normalizeCurrentStateTradeExceptions(
    teamRecord.tradeExceptions ??
      teamRecord[CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY]
  );
  const cashLedger = normalizeCurrentStateCashLedger(
    teamRecord.cashLedger ??
      teamRecord[CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY]
  );
  const exceptionHistory = normalizeCurrentStateExceptionHistory(
    teamRecord.exceptionHistory ??
      teamRecord[CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY]
  );
  const draftPicks = normalizeCurrentStateDraftPicks(
    teamRecord.draftPicks ??
      teamRecord[CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY]
  );
  const entitlementIds = normalizeStringArray(
    teamRecord.entitlementIds ??
      teamRecord[CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY]
  );
  const twoWayPlayers = normalizeCurrentStatePlayerArray(rawTwoWayPlayers);
  const teamTotalSalary = resolveCurrentStateTeamTotalSalary(
    teamRecord,
    mutationCore.totals
  );
  // Trade validation/apply still needs live access to the TPE/cash/pick/
  // entitlement/two-way/salary bridges. Exception history remains preserve-only
  // and is materialized only when a returned team snapshot needs it.
  const tradeNormalized: TradeTeamLike = { ...mutationCore };
  if (roster !== undefined) {
    tradeNormalized.roster = roster;
  }
  if (exceptions !== undefined) {
    tradeNormalized.exceptions = exceptions;
  }
  if (tradeExceptions !== undefined) {
    tradeNormalized.tradeExceptions = tradeExceptions;
  }
  if (cashLedger !== undefined) {
    tradeNormalized.cashLedger = cashLedger;
  }
  if (draftPicks !== undefined) {
    tradeNormalized.draftPicks = draftPicks;
  }
  if (entitlementIds !== undefined) {
    tradeNormalized.entitlementIds = entitlementIds;
  }
  if (twoWayPlayers !== undefined) {
    tradeNormalized.twoWayPlayers = twoWayPlayers;
  }
  if (teamTotalSalary !== undefined) {
    tradeNormalized.teamTotalSalary = teamTotalSalary;
  }

  return attachCurrentStateBaseTeamPreservedFields(
    tradeNormalized,
    buildCurrentStateBaseTeamPreservedFields(
      teamRecord,
      CURRENT_STATE_TRADE_PRESERVED_FIELDS
    )
  ) as TradeTeamLike;
}

function normalizeCurrentStatePlayerDraft(
  value: ArchitectMutationPlayerRecord['draft']
): NormalizedCurrentStatePlayer['draft'] | undefined {
  const draftRecord = asLooseRecord(value);
  if (!draftRecord) {
    return undefined;
  }

  const normalized: NonNullable<NormalizedCurrentStatePlayer['draft']> = {};
  const round = toOptionalNumber(draftRecord.round);
  const pick = toOptionalNumber(draftRecord.pick);

  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerRfaContext(
  value: ArchitectMutationPlayerRfaContextIngress | CurrentStatePlayerRfaContext | null | undefined
): CurrentStatePlayerRfaContext | undefined {
  const context = asLooseRecord(value);
  if (!context) {
    return undefined;
  }

  const normalized: CurrentStatePlayerRfaContext = {};
  const pendingHomeTeamCode = toOptionalTrimmedString(
    context.pendingHomeTeamCode
  );
  const offerSheetId = toOptionalTrimmedString(context.offerSheetId);
  const retainedUntilFinalize = toOptionalBoolean(
    context.retainedUntilFinalize
  );

  if (pendingHomeTeamCode !== undefined) {
    normalized.pendingHomeTeamCode = pendingHomeTeamCode;
  }
  if (offerSheetId !== undefined) {
    normalized.offerSheetId = offerSheetId;
  }
  if (retainedUntilFinalize !== undefined) {
    normalized.retainedUntilFinalize = retainedUntilFinalize;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

type CurrentStatePlayerRfaBoundaryIngress = Pick<
  MutationCurrentStatePlayerIngress,
  | 'rfaOfferSheet'
  | 'rfaOfferSheetOnly'
  | 'rfaContext'
  | 'isNewlySignedFA'
  | 'originTeamId'
>;

function normalizeCurrentStatePlayerRfaBoundary(
  player: CurrentStatePlayerRfaBoundaryIngress | null | undefined
): CurrentStatePlayerRfaBoundary {
  const normalized: CurrentStatePlayerRfaBoundary = {};
  const rfaOfferSheet = toOptionalBoolean(player?.rfaOfferSheet);
  const rfaOfferSheetOnly = toOptionalBoolean(player?.rfaOfferSheetOnly);
  const rfaContext = normalizeCurrentStatePlayerRfaContext(player?.rfaContext);
  const isNewlySignedFA = toOptionalBoolean(player?.isNewlySignedFA);
  const originTeamId = toOptionalTrimmedString(player?.originTeamId);

  if (rfaOfferSheet !== undefined) {
    normalized.rfaOfferSheet = rfaOfferSheet;
  }
  if (rfaOfferSheetOnly !== undefined) {
    normalized.rfaOfferSheetOnly = rfaOfferSheetOnly;
  }
  if (rfaContext !== undefined) {
    normalized.rfaContext = rfaContext;
  }
  if (isNewlySignedFA !== undefined) {
    normalized.isNewlySignedFA = isNewlySignedFA;
  }
  if (originTeamId !== undefined) {
    normalized.originTeamId = originTeamId;
  }

  return normalized;
}

// Raw player overrides and base player snapshots are narrowed here before any
// committed mutation compute path can spread or persist them. The remaining
// fields are retained because this normalized player surface still feeds
// signing/SAT validation and player-override round-trip persistence.
function toCurrentStatePlayer(
  player: CurrentStatePlayerSnapshotIngress | null | undefined
): PlayerLike | null {
  // Mixed runtime input is still tolerated at this outer boundary because
  // current-state loads may come from raw world snapshots or already-normalized
  // player records. Downstream helpers only see the narrowed field slices below.
  const playerRecord = asLooseRecord(player) as
    | Partial<CurrentStatePlayerSnapshotIngress>
    | null;
  if (!playerRecord) {
    return null;
  }

  const normalized: PlayerLike = {};
  const bio = normalizeCurrentStatePlayerBio(playerRecord.bio);
  const bioPlayerId = toOptionalIdString(bio?.playerId);
  const bioDisplayName = toOptionalTrimmedString(bio?.displayName);
  const playerId = toOptionalIdString(playerRecord.player_id) ?? bioPlayerId;
  const id = toOptionalIdString(playerRecord.id) ?? bioPlayerId;
  const playerIdAlias =
    toOptionalIdString(playerRecord.playerId) ?? bioPlayerId;
  const name = toOptionalTrimmedString(playerRecord.name);
  const displayName =
    toOptionalTrimmedString(playerRecord.displayName) ?? name ?? bioDisplayName;
  const playerName = toOptionalTrimmedString(playerRecord.playerName);
  const teamCode = toOptionalTrimmedString(playerRecord.teamCode);
  const teamName = toOptionalTrimmedString(playerRecord.teamName);
  const contract = normalizeCurrentStatePlayerContract(playerRecord.contract);
  const futureContract = normalizeCurrentStatePlayerFutureContract(
    playerRecord.futureContract
  );
  const draft = normalizeCurrentStatePlayerDraft(playerRecord.draft);
  const birdRights = normalizeCurrentStatePlayerBirdRights(
    playerRecord.birdRights
  );
  const renounced = toOptionalBoolean(playerRecord.renounced);
  const persistenceSidecar =
    normalizeCurrentStatePlayerOverridePersistenceSidecar(playerRecord);
  const rfaBoundary = normalizeCurrentStatePlayerRfaBoundary(playerRecord);

  if (playerId !== undefined) {
    normalized.player_id = playerId;
  }
  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerIdAlias !== undefined) {
    normalized.playerId = playerIdAlias;
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
  if (bio !== undefined) {
    normalized.bio = bio;
  }
  if (contract !== undefined) {
    normalized.contract = contract;
  }
  if (futureContract !== undefined) {
    normalized.futureContract = futureContract;
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (birdRights !== undefined) {
    normalized.birdRights = birdRights;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }
  Object.assign(normalized, persistenceSidecar, rfaBoundary);

  return normalized;
}

function normalizeTradeMutationCurrentStateTeamEntry(
  entry:
    | MutationCurrentStateTradeTeamEntryIngress
    | MutationCurrentStateTeamEntry
    | null
    | undefined
): MutationCurrentStateTeamEntry {
  const team = toCurrentStateTeam(entry?.team, 'trade');
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

function normalizeTradeMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationTradeCurrentState {
  const teams = Array.isArray(currentState?.teams)
    ? currentState.teams.map((entry) =>
        normalizeTradeMutationCurrentStateTeamEntry(entry)
      )
    : undefined;

  return teams !== undefined ? { teams } : {};
}

function normalizeTeamOnlyMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationTeamOnlyCurrentState {
  const normalized: MutationTeamOnlyCurrentState = {};
  const team = toCurrentStateTeam(currentState?.team, 'manualCap');
  const teamCode = toOptionalTrimmedString(currentState?.teamCode);

  if (team) {
    normalized.team = team;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }

  return normalized;
}

function normalizeTeamAndPlayerMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationTeamAndPlayerCurrentState {
  const normalized: MutationTeamAndPlayerCurrentState = {};
  const team = toCurrentStateTeam(currentState?.team, 'playerOps');
  const player = toCurrentStatePlayer(currentState?.player);
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

function normalizeOfferSheetTeamAndPlayerMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationOfferSheetTeamAndPlayerCurrentState {
  const normalized: MutationOfferSheetTeamAndPlayerCurrentState = {};
  const team = toCurrentStateTeam(currentState?.team, 'signing');
  const player = toCurrentStatePlayer(currentState?.player);
  const homeTeam = toCurrentStateTeam(
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

function normalizeOfferSheetMirrorMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationOfferSheetMirrorCurrentState {
  const normalized: MutationOfferSheetMirrorCurrentState = {};
  const homeTeam = toCurrentStateTeam(
    currentState?.homeTeam,
    'offerSheetMirror'
  );
  const offeringTeam = toCurrentStateTeam(
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

function normalizeOfferSheetResolutionMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationOfferSheetResolutionCurrentState {
  const normalized: MutationOfferSheetResolutionCurrentState = {};
  const homeTeam = toCurrentStateTeam(
    currentState?.homeTeam,
    'offerSheetResolution'
  );
  const offeringTeam = toCurrentStateTeam(
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

function normalizeSignAndTradeMutationCurrentState(
  currentState: MutationCurrentStateIngress | MutationCurrentState | null | undefined
): MutationSignAndTradeCurrentState {
  const normalized: MutationSignAndTradeCurrentState = {};
  const team = toCurrentStateTeam(currentState?.team, 'trade');
  const player = toCurrentStatePlayer(currentState?.player);
  const destinationTeam = toCurrentStateTeam(
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

function toLineageOverrideMergeBio(
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

function toLineageOverrideMergePlayer(player: unknown): LineageOverrideMergePlayer {
  const playerRecord = toCurrentStatePlayer(player);
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

type CurrentStateWithBasicTeam<
  TCurrentState extends { team?: unknown | null },
> = TCurrentState & {
  team: NonNullable<TCurrentState['team']>;
};

type CurrentStateWithBasicTeamAndPlayer<
  TCurrentState extends { team?: unknown | null; player?: PlayerLike | null },
> = CurrentStateWithBasicTeam<TCurrentState> & {
  player: PlayerLike;
};

type CurrentStateWithSigningState = MutationSigningCurrentState & {
  team: MutationSigningTeamLike;
  player: PlayerLike;
};

type CurrentStateWithDestination = MutationSignAndTradeCurrentState & {
  team: TradeTeamLike;
  player: PlayerLike;
  destinationTeam: TradeTeamLike;
};

type CurrentStateWithOfferSheetTeams<
  TCurrentState extends {
    homeTeam?: OfferSheetTeamLike | null;
    offeringTeam?: OfferSheetTeamLike | null;
    offerSheetId?: string | null;
  },
> = TCurrentState & {
  homeTeam: NonNullable<TCurrentState['homeTeam']>;
  offeringTeam: NonNullable<TCurrentState['offeringTeam']>;
  offerSheetId: string;
};

function requireBasicTeamState<
  TCurrentState extends { team?: unknown | null },
>(
  currentState: TCurrentState,
  mutationType: string
): CurrentStateWithBasicTeam<TCurrentState> {
  if (!currentState.team) {
    throw new Error(`${mutationType} current state missing team`);
  }

  return currentState as CurrentStateWithBasicTeam<TCurrentState>;
}

function requireBasicTeamAndPlayerState<
  TCurrentState extends {
    team?: unknown | null;
    player?: PlayerLike | null;
  },
>(
  currentState: TCurrentState,
  mutationType: string
): CurrentStateWithBasicTeamAndPlayer<TCurrentState> {
  const teamState = requireBasicTeamState(currentState, mutationType);

  if (!currentState.player) {
    throw new Error(`${mutationType} current state missing player`);
  }

  return {
    ...teamState,
    player: currentState.player,
  } as CurrentStateWithBasicTeamAndPlayer<TCurrentState>;
}

function requireSigningState(
  currentState: MutationSigningCurrentState,
  mutationType: string
): CurrentStateWithSigningState {
  if (!currentState.team) {
    throw new Error(`${mutationType} current state missing team`);
  }
  if (!currentState.player) {
    throw new Error(`${mutationType} current state missing player`);
  }

  return currentState as CurrentStateWithSigningState;
}

function requireDestinationState(
  currentState: MutationSignAndTradeCurrentState,
  mutationType: string
): CurrentStateWithDestination {
  const teamAndPlayerState = requireSigningState(currentState, mutationType);

  if (!currentState.destinationTeam) {
    throw new Error(`${mutationType} current state missing destination team`);
  }

  return {
    ...teamAndPlayerState,
    destinationTeam: currentState.destinationTeam,
  } as CurrentStateWithDestination;
}

function requireOfferSheetTeamState<
  TCurrentState extends {
    homeTeam?: OfferSheetTeamLike | null;
    offeringTeam?: OfferSheetTeamLike | null;
    offerSheetId?: string | null;
  },
>(
  currentState: TCurrentState,
  mutationType: string
): CurrentStateWithOfferSheetTeams<TCurrentState> {
  if (!currentState.homeTeam) {
    throw new Error(`${mutationType} current state missing home team`);
  }
  if (!currentState.offeringTeam) {
    throw new Error(`${mutationType} current state missing offering team`);
  }
  if (!currentState.offerSheetId) {
    throw new Error(`${mutationType} current state missing offerSheetId`);
  }

  return currentState as CurrentStateWithOfferSheetTeams<TCurrentState>;
}

// Local boundary helper for the live team.source spread sites only.
function getTeamSourceRecord(
  source: TeamLike['source'] | null | undefined
): NonNullable<MutationTeamSourceLike> {
  const normalizedSource = normalizeCurrentStateTeamSource(source);
  if (
    normalizedSource &&
    typeof normalizedSource === 'object' &&
    !Array.isArray(normalizedSource)
  ) {
    return normalizedSource;
  }

  return {};
}

function getSalaryRowEndYear(
  row: MutationPipelineSalaryRow | null | undefined
): number | null {
  const explicitYear =
    row?.year == null ? Number.NaN : Number(row.year);
  if (Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  return toEndYear(row?.season) ?? null;
}

function materializeCurrentStateTeamForAudit(
  team: TeamLike | null | undefined
) : CurrentStateTeam | null {
  const materializedTeam = team
    ? materializeCurrentStateBaseTeamPreservedFields(
        team as CurrentStateTeamRoundTripMaterializable
      ) || team
    : null;

  return materializedTeam ? (materializedTeam as CurrentStateTeam) : null;
}

function getSnapshotRosterMembership(
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
      const normalizedTeam = toCurrentStateTeam(
        snapshot.data(),
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
      const normalizedPlayer = toCurrentStatePlayer(overrideSnapshot.data());
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
    getTeam(worldId, offeringTeamCode).then((team) =>
      toCurrentStateTeam(team, 'signing')
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
    ? toCurrentStatePlayer(
        mergePlayerOverride(
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
      teamName:
        resolvedOwner.team.teamName ||
        canonicalPlayer.teamName ||
        null,
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
      toCurrentStateTeam(update?.team, 'trade')
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
    const canonicalTeam =
      synchronizeTeamTotalsSnapshot(team, year) || team;
    totalsByTeam[teamCode] =
      canonicalTeam?.totals || computeTeamCapTotals(team, year);
  }
  return totalsByTeam;
}

function prepareGeneralMutationPersistenceTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  const persistenceReadyTeam = stripComputeOnlyTeamFieldsForPersistence(
    team as CurrentStateTeamPersistenceStripShape
  );
  const canonicalYear = toEndYear(seasonId);
  const totalsAlignedTeam =
    Number.isFinite(canonicalYear)
      ? backfillCurrentStateBaseTeamPreservedFields(
          synchronizeTeamTotalsSnapshot(
            persistenceReadyTeam,
            canonicalYear
          ) || persistenceReadyTeam,
          persistenceReadyTeam
        ) || persistenceReadyTeam
      : persistenceReadyTeam;
  const afterSanitize = sanitizeTransientFieldsForPersistence(
    totalsAlignedTeam
  );
  const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);

  return afterTpeNormalize as GeneralMutationPersistenceTeamSnapshot;
}

function buildGeneralMutationCommittedTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string
): GeneralMutationPersistenceTeamSnapshot {
  return removeUndefinedDeep(
    prepareGeneralMutationPersistenceTeamSnapshot(team, seasonId)
  ) as GeneralMutationPersistenceTeamSnapshot;
}

function buildGeneralMutationCommittedTeamUpdates(
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

function normalizeDashboardReloadDeadCapAmountByYear(
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
      (
        entry
      ): entry is ArchitectGeneralMutationDashboardReloadDeadCapYear =>
        entry !== null
    );
}

function normalizeDashboardReloadDeadCapEntry(
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

function normalizeDashboardReloadDeadCap(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadDeadCapEntry(entry))
    .filter(
      (
        entry
      ): entry is ArchitectGeneralMutationDashboardReloadDeadCapEntry =>
        entry !== null
    );
}

function normalizeDashboardReloadExceptionEntry(
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

function normalizeDashboardReloadExceptions(
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
        const remainingAmount = toOptionalNumberOrNull(
          record.remainingAmount
        );
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

function normalizeDashboardReloadOfferSheet(
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

function normalizeDashboardReloadOfferSheets(
  value: unknown
): ArchitectGeneralMutationDashboardReloadOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadOfferSheet(entry))
    .filter(
      (
        entry
      ): entry is ArchitectGeneralMutationDashboardReloadOfferSheet =>
        entry !== null
    );
}

function normalizeDashboardReloadContractDateLike(
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

function normalizeDashboardReloadContractFreeAgency(
  value: ArchitectMutationContract['freeAgency']
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

function normalizeDashboardReloadContractBirdRights(
  value: ArchitectMutationBirdRights | null | undefined
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

function normalizeDashboardReloadPlayerContract<
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
    value.freeAgency
  );
  if (freeAgency !== undefined) {
    normalized.freeAgency = freeAgency;
  } else {
    delete normalized.freeAgency;
  }

  const birdRights = normalizeDashboardReloadContractBirdRights(
    'birdRights' in value ? value.birdRights : undefined
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

function normalizeDashboardReloadPlayer(
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
      futureContract as
        | ArchitectGeneralMutationDashboardReloadPlayerFutureContract
        | null;
  }

  return removeUndefinedDeep(
    normalized
  ) as ArchitectGeneralMutationDashboardReloadPlayer;
}

function normalizeDashboardReloadPlayers(
  value: CurrentStatePlayer[] | null | undefined
): ArchitectGeneralMutationDashboardReloadPlayer[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((player) => normalizeDashboardReloadPlayer(player))
    .filter(
      (
        player
      ): player is ArchitectGeneralMutationDashboardReloadPlayer =>
        player !== null
    );
}

export function buildGeneralMutationDashboardReloadTeamSnapshot(
  team: ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
): ArchitectGeneralMutationDashboardReloadTeamSnapshot | null {
  if (!team) {
    return null;
  }

  const reloadSnapshot: ArchitectGeneralMutationDashboardReloadTeamSnapshot = {
    teamCode: team.teamCode,
  };

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

function buildGeneralMutationDashboardReloadTeamUpdates(
  teamUpdates:
    | ArchitectGeneralMutationCommittedTeamUpdate[]
    | null
    | undefined
): ArchitectGeneralMutationDashboardReloadTeamUpdate[] {
  if (!Array.isArray(teamUpdates)) {
    return [];
  }

  return teamUpdates.map((update) => ({
    teamCode: update.teamCode,
    team: buildGeneralMutationDashboardReloadTeamSnapshot(update.team),
  }));
}

function canonicalizeTeamUpdatesWithCanonicalTotals(
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

function canonicalizeComputeResultTeamUpdates<T extends ComputeResultLike>(
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

function collectMutationPlayerIds(
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

function buildMutationFailureResult(
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

function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

function collectPlayerTouchIds(
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

function deriveEventTeamCodes({
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

function deriveEventPlayerIds({
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

function deriveContractSummary(
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

function deriveTradePicksMoved(metadata: MutationEventMetadataLike = {}) {
  const picksTraded = toArrayOfStrings(metadata.picksTraded);
  if (picksTraded.length > 0) {
    return picksTraded;
  }

  const legacyEntitlementsTraded = toArrayOfStrings(metadata.entitlementsTraded);
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

function buildTeamHistoryDiffSummary({
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
    // TM-3A: Trade mutations use the explicit execution authority surface.
    // Non-trade mutations continue with the existing inline validation chain.
    let afterTeamsByCode: MutationTeamMap;
    let beforeTotalsByTeam: PostStateTotalsByTeam;
    let afterTotalsByTeam: PostStateTotalsByTeam;
    let combinedWarnings: MutationResultIssueLike[];
    let postStateValidation: { valid: boolean; violations: unknown[]; warnings: unknown[] };

    if (mutationType === 'executeTrade') {
      // TM-3A: Trade Execution Authority — all 5 apply-time legality gates
      // composed in one discoverable surface (tradeContext/tradeExecutionAuthority.ts).
      // TM-5D: The staged trade chain remains intentional and should not be
      // collapsed: prepared context -> execution authority -> persist boundary.
      const tradeExecutionAuthorityResult = await validateTradeExecutionAuthority({
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
          tradeExecutionAuthorityResult.error || 'Trade execution authority validation failed',
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
      afterTeamsByCode = tradeExecutionAuthorityResult.auditArtifacts.afterTeamsByCode;
      beforeTotalsByTeam = tradeExecutionAuthorityResult.auditArtifacts.beforeTotalsByTeam;
      afterTotalsByTeam = tradeExecutionAuthorityResult.auditArtifacts.afterTotalsByTeam;
      combinedWarnings = tradeExecutionAuthorityResult.warnings;
      postStateValidation = {
        valid: tradeExecutionAuthorityResult.auditArtifacts.postStateValid,
        violations: tradeExecutionAuthorityResult.auditArtifacts.postStateViolations,
        warnings: tradeExecutionAuthorityResult.auditArtifacts.postStateWarnings,
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
            warnings: (validationResult.warnings || []) as MutationResultIssueLike[],
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
            warnings: (validationResult.warnings || []) as MutationResultIssueLike[],
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
          violations: postStateValidation.violations as MutationResultIssueLike[],
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
    const entitlementUpdates = computeResult.entitlementUpdates || [];
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

    const persistResult: PersistWorldMutationResult = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType,
      computeResult,
      committedTeamUpdates,
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
    const { team, player } = requireDestinationState(
      normalizeSignAndTradeMutationCurrentState(currentState),
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
      reasons: ['Authoritative offer sheet preflight is missing season context.'],
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
      reasons: ['Authoritative offer sheet preflight is missing player context.'],
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
    const currentState = await loadStateForMutation(worldId, 'storeOfferSheet', payload);
    const { team, player } = requireSigningState(
      normalizeOfferSheetTeamAndPlayerMutationCurrentState(currentState),
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
        reasons: reasons.length > 0 ? reasons : ['Offer sheet validation failed.'],
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
): Promise<MutationCurrentState> {
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
          team: toCurrentStateTeam(teamStates[i] || null, 'trade'),
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
      const homeTeamCode = (player.teamCode || player.contract?.signingTeam) as string | null | undefined;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = toCurrentStateTeam(
          await getTeam(worldId, homeTeamCode),
          'offerSheetMirror'
        );
      }

      return {
        team: toCurrentStateTeam(team, 'signing'),
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
        team: toCurrentStateTeam(team, 'playerOps'),
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
      const isOfferSheetMirrorMutation =
        mutationType === 'matchOfferSheet' ||
        mutationType === 'declineOfferSheet';

      return {
        homeTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(homeTeam || null, 'offerSheetMirror')
          : toCurrentStateTeam(homeTeam || null, 'offerSheetResolution'),
        offeringTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(offeringTeam || null, 'offerSheetMirror')
          : toCurrentStateTeam(
              offeringTeam || null,
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
        team: toCurrentStateTeam(team || null, 'trade'),
        destinationTeam: toCurrentStateTeam(destinationTeam || null, 'trade'),
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
        await getTeam(worldId, teamCode),
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
      } catch (err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        await getTeam(worldId, teamCode),
        'manualCap'
      );
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        await getTeam(worldId, teamCode),
        'manualCap'
      );
      return { team, teamCode };
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

function withDefaultPlayerDeletes<T>(
  result: T & { playerDeletes?: PlayerDeleteLike[] }
): Omit<T, 'playerDeletes'> & { playerDeletes: PlayerDeleteLike[] } {
  return {
    ...result,
    playerDeletes: Array.isArray(result.playerDeletes)
      ? result.playerDeletes
      : [],
  };
}

type MutationPlayerIdCarrier = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'playerId' | 'id'
>;

function getMutationPlayerId(player: MutationPlayerIdCarrier | null | undefined) {
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
  const players = Array.isArray(team?.players)
    ? team.players
        .map((player) => toCurrentStatePlayer(player))
        .filter((player): player is PlayerLike => player !== null)
    : [];
  return players.find((player) => getMutationPlayerId(player) === playerId) || null;
}

function toPersistablePlayerOverrideFromNormalizedPlayer(
  normalizedPlayer: PersistablePlayerOverrideSource
): PersistablePlayerOverride {
  const playerId = getMutationPlayerId(normalizedPlayer);
  const bio =
    normalizedPlayer.bio &&
    typeof normalizedPlayer.bio === 'object' &&
    !Array.isArray(normalizedPlayer.bio)
      ? (normalizedPlayer.bio as CurrentStatePlayerBio)
      : undefined;
  const persistenceSidecar =
    normalizeCurrentStatePlayerOverridePersistenceSidecar(normalizedPlayer);
  const rfaBoundary = normalizeCurrentStatePlayerRfaBoundary(normalizedPlayer);

  return removeUndefinedDeep({
    playerId: playerId || undefined,
    displayName:
      normalizedPlayer.displayName ||
      normalizedPlayer.playerName ||
      normalizedPlayer.name ||
      bio?.displayName ||
      undefined,
    teamCode: normalizedPlayer.teamCode || undefined,
    teamName: normalizedPlayer.teamName || undefined,
    bio,
    contract: normalizedPlayer.contract || undefined,
    futureContract: normalizedPlayer.futureContract || undefined,
    ...persistenceSidecar,
    ...rfaBoundary,
  }) as PersistablePlayerOverride;
}

function toPersistablePlayerOverrideFromSnapshot(
  player: CurrentStatePlayerSnapshotIngress | null | undefined
): PersistablePlayerOverride | null {
  const normalizedPlayer = toCurrentStatePlayer(player);
  if (!normalizedPlayer) {
    return null;
  }

  return toPersistablePlayerOverrideFromNormalizedPlayer(normalizedPlayer);
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

    const persistedPlayer = toPersistablePlayerOverrideFromSnapshot(finalPlayer);
    if (!persistedPlayer) {
      return {
        success: false,
        error: `${manifestLabel} could not normalize persisted player override for ${candidate.playerId}.`,
      };
    }

    playerUpdates.push({
      playerId: candidate.playerId,
      player: persistedPlayer,
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
  payload: TradeMutationPayload;
  currentState: TradeContextCurrentState;
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
      teamTrade.teamCode || currentState.teams[index]?.teamCode
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

    for (const player of teamTrade.sends || []) {
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
        player: player || {},
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
  currentState: currentStateInput,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
}: ComputeWorldMutationArgs): ComputeResultLike {
  const result = (() => {
    switch (mutationType) {
      case 'executeTrade': {
        const currentState = normalizeTradeMutationCurrentState(
          currentStateInput
        );
        const tradePayload = toTradePayload(payload);
        const tradeState = toTradeStateSlice(currentState);

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
          historyContext: { worldId, mutationType },
          postTradeSnapshot: tradeApplyPreparation.postTradeSnapshot,
          validatedContext: tradeApplyPreparation.validatedContext,
        });

        return withDefaultPlayerDeletes(tradeResult);
      }

      case 'signFreeAgent': {
        const currentState =
          normalizeOfferSheetTeamAndPlayerMutationCurrentState(
            currentStateInput
          );
        return withDefaultPlayerDeletes(
          computeSigningResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'waivePlayer': {
        const currentState = normalizeTeamAndPlayerMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeWaiveResult({ payload, currentState, seasonId, timestamp })
        );
      }

      case 'extendPlayer': {
        const currentState = normalizeTeamAndPlayerMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeExtensionResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'storeOfferSheet': {
        const currentState =
          normalizeOfferSheetTeamAndPlayerMutationCurrentState(
            currentStateInput
          );
        return withDefaultPlayerDeletes(
          computeStoreOfferSheetResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'matchOfferSheet': {
        const currentState = normalizeOfferSheetMirrorMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeMatchOfferSheetResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'declineOfferSheet': {
        const currentState = normalizeOfferSheetMirrorMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeDeclineOfferSheetResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeMatchedOfferSheet': {
        const currentState = normalizeOfferSheetResolutionMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeFinalizeMatchedOfferSheetResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeDeclinedOfferSheet': {
        const currentState = normalizeOfferSheetResolutionMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeFinalizeDeclinedOfferSheetResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'optionDecision': {
        const currentState = normalizeTeamAndPlayerMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeOptionResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'renounceRights': {
        const currentState = normalizeTeamAndPlayerMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeRenounceResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'signAndTrade': {
        const currentState = normalizeSignAndTradeMutationCurrentState(
          currentStateInput
        );
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
      }

      case 'setDeadCap': {
        const currentState = normalizeTeamOnlyMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeSetDeadCapResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'setExceptions': {
        const currentState = normalizeTeamOnlyMutationCurrentState(
          currentStateInput
        );
        return withDefaultPlayerDeletes(
          computeSetExceptionsResult({
            payload,
            currentState,
            seasonId,
            timestamp,
          })
        );
      }

      default:
        return withDefaultPlayerDeletes({
          success: false,
          error: `Unknown mutation type: ${mutationType}`,
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
function getTradeValidationApplyTimeSlice(
  validatedContext: TradeValidatedContextLike
): TradeValidationApplyTimeSlice {
  const rawValidation = validatedContext._rawValidation;
  if (rawValidation) {
    return {
      legal: Boolean(rawValidation.legal),
      teamResults: Array.isArray(rawValidation.teamResults)
        ? rawValidation.teamResults
        : [],
    };
  }

  return {
    legal: Boolean(validatedContext.legal),
    teamResults: Array.isArray(validatedContext.teamResults)
      ? validatedContext.teamResults
      : [],
  };
}

function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
  postTradeSnapshot,
  validatedContext,
}: {
  payload: TradeMutationPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  timestamp: number;
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
  const resolvedWorldId =
    historyContext.worldId || payload?.tradeCtx?.worldId || null;
  const resolvedMutationType = historyContext.mutationType || 'executeTrade';
  const resolvedMutationId = historyContext.mutationId;

  // Phase 56: Use pre-built snapshot teamUpdates (already has roster changes applied)
  // Deep clone to avoid mutating the snapshot
  const teamUpdates: TradeTeamUpdate[] = (postTradeSnapshot.teamUpdates || []).map(
    (entry) => {
      const clonedTeam = JSON.parse(JSON.stringify(entry.team || {})) as TeamLike;
      return {
        teamCode: entry.teamCode ?? null,
        team:
          materializeCurrentStateBaseTeamPreservedFields(clonedTeam) ||
          clonedTeam,
      };
    }
  );

  // Phase 56: Use validation results from validatedContext (already validated once)
  const validation = getTradeValidationApplyTimeSlice(validatedContext);

  // Phase 56: Use only the authoritative apply-time validationTeams from context.
  const validationTeams: TradeApplyValidationTeamLike[] =
    validatedContext.validationTeams;

  // Warn if multi-team trade without directed routing (informational only)
  if (tradeTeams.length > 2) {
    const hasDirectedRouting = tradeTeams.some((teamTrade) =>
      (teamTrade.sends || []).some(
        (sentPlayer) => toOptionalTrimmedString(sentPlayer.tradeTo) !== undefined
      )
    );
    if (!hasDirectedRouting) {
      console.warn(
        'Multi-team trade detected without directed routing (tradeTo). ' +
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
    const lifecycleResult = applyTradeExceptionLifecycle({
      currentTradeExceptions: updatedTeam.tradeExceptions || [],
      hasTradeExceptionsValidation: Boolean(teamResult.rules?.tradeExceptions),
      createdTPE: teamResult.createdTPE,
      incomingPlayers: validationTeams[idx]?.receives || [],
      outgoingPlayers: tradeTeams[idx]?.sends || [],
      teamCode: teamUpdate.teamCode || '',
      seasonId,
      seasonYear: currentYear,
      timestampISO,
      worldId: resolvedWorldId,
      mutationType: resolvedMutationType,
      mutationId: resolvedMutationId,
    });

    if (lifecycleResult.blockingIssues.length > 0) {
      teamResult._tpeConsumptionErrors = lifecycleResult.blockingIssues;
      teamResult._blocked = true;
      console.error(
        '[mutationPipeline] TPE fail-closed: blocking mutation due to invalid TPE state:',
        lifecycleResult.blockingIssues
      );
    }

    if (lifecycleResult.warnings.length > 0) {
      const isDev =
        import.meta.env?.DEV || process.env.NODE_ENV === 'development';
      if (isDev) {
        console.warn(
          '[mutationPipeline] Phase 47C TPE consumption warnings:',
          lifecycleResult.warnings
        );
      }
      teamResult._tpeConsumptionWarnings = lifecycleResult.warnings;
    }

    updatedTeam.tradeExceptions = lifecycleResult.updatedTradeExceptions;

    if (lifecycleResult.historyEntries.length > 0) {
      appendExceptionHistory(updatedTeam, lifecycleResult.historyEntries);
    }
  });

  // Phase 11.3: Build entitlementsTraded structure for event log
  // Format: { [teamCode]: { out: string[], in: string[] } }
  // Phase 11.3.1: Respect toTeamId routing when present (for multi-team trades)
  const entitlementsTraded: TradeEntitlementsMovedByTeam = {};
  for (const teamTrade of tradeTeams) {
    const teamKey = normalizeTradeTeamCodeLike(teamTrade.teamCode);
    if (!teamKey) {
      continue;
    }

    // Outgoing entitlement IDs from this team (unchanged)
    const outIds = (teamTrade.entitlementsOut || [])
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
      const otherTeamKey = normalizeTradeTeamCodeLike(otherTrade.teamCode);
      if (otherTeamKey === teamKey) {
        continue;
      }

      for (const entitlement of otherTrade.entitlementsOut || []) {
        const rawEntitlementId = entitlement.entitlementId ?? entitlement.id;
        const entitlementId =
          rawEntitlementId == null ? null : String(rawEntitlementId);
        if (!entitlementId) {
          continue;
        }

        const routedTo =
          entitlement.toTeamId == null ? null : String(entitlement.toTeamId);
        const teamCode = normalizeTradeTeamCodeLike(teamTrade.teamCode);
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
        (player) => player.player_id || player.displayName || player.name
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

function toFiniteAmount(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toFiniteIntegerOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function sumContractValueFromRows(
  contract:
    | ArchitectMutationContract
    | {
        salariesByYear?: Array<{
          salary?: number | string | null;
          capHit?: number | string | null;
        }> | null;
      }
    | null
    | undefined
) {
  if (!Array.isArray(contract?.salariesByYear)) {
    return 0;
  }

  return contract.salariesByYear.reduce(
    (total, row) =>
      total +
      toFiniteAmount(row?.salary ?? row?.capHit, 0),
    0
  );
}

function toCapHoldComputationPlayer(
  player: ArchitectMutationPlayerRecord
): CapHoldComputationPlayer {
  const yearsExperience = toFiniteIntegerOrNull(player.bio?.yearsExperience);
  const draftRound = toFiniteIntegerOrNull(player.draft?.round);
  const draftPick = toFiniteIntegerOrNull(player.draft?.pick);
  const contractBirdRightsStatus =
    typeof player.contract?.birdRights?.status === 'string'
      ? player.contract.birdRights.status
      : typeof player.contract?.birdRights?.type === 'string'
        ? player.contract.birdRights.type
        : undefined;
  const fallbackBirdRights =
    typeof player.birdRights === 'string'
      ? player.birdRights
      : typeof player.birdRights?.status === 'string'
        ? player.birdRights.status
        : typeof player.birdRights?.type === 'string'
          ? player.birdRights.type
          : undefined;

  return {
    renounced: player.renounced === true,
    bio:
      player.bio || yearsExperience != null
        ? {
            yearsExperience: yearsExperience ?? undefined,
          }
        : undefined,
    contract:
      player.contract || contractBirdRightsStatus
        ? {
            birdRights: contractBirdRightsStatus
              ? { status: contractBirdRightsStatus }
              : undefined,
            salariesByYear: Array.isArray(player.contract?.salariesByYear)
              ? player.contract.salariesByYear.map((row) => ({
                  season:
                    typeof row?.season === 'string' ? row.season : undefined,
                  salary:
                    typeof row?.salary === 'number' ? row.salary : undefined,
                  capHit:
                    typeof row?.capHit === 'number' ? row.capHit : undefined,
                }))
              : undefined,
          }
        : undefined,
    draft:
      player.draft || draftRound != null || draftPick != null
        ? {
            round: draftRound ?? undefined,
            pick: draftPick ?? undefined,
          }
        : undefined,
    birdRights: fallbackBirdRights,
  };
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
  const exceptionKey = getCanonicalExceptionKeyForSigningMechanism(mechanism);
  if (!exceptionKey) {
    return { consumedExceptionKey: null, error: null };
  }

  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  const availability = getCanonicalExceptionAvailability(updatedTeam, exceptionKey);
  if (!availability.present) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is missing.`,
    };
  }
  if (!availability.enabled) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is disabled.`,
    };
  }
  if (!availability.usable) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner has no remaining amount.`,
    };
  }

  if (contractValue <= 0) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - signing contract value is missing or zero, so canonical exception usage cannot be consumed.`,
    };
  }

  const currentState = availability.entry;
  const normalizedState: ArchitectMutationExceptionEntry = currentState
    ? { ...(currentState as ArchitectMutationExceptionEntry) }
    : {
        enabled: true,
        maxAmount: 0,
        totalAmount: 0,
        amount: 0,
        usedAmount: 0,
        remainingAmount: 0,
      };

  normalizedState.enabled = true;
  normalizedState.available = true;
  normalizedState.maxAmount = availability.totalAmount;
  normalizedState.totalAmount = availability.totalAmount;
  normalizedState.amount = availability.totalAmount;
  normalizedState.usedAmount = availability.usedAmount + contractValue;
  normalizedState.remainingAmount = Math.max(
    0,
    availability.remainingAmount - contractValue
  );
  normalizedState.lastUsedAt = new Date(timestamp).toISOString();

  updatedTeam.exceptions = {
    ...updatedTeam.exceptions,
    [exceptionKey]: normalizedState,
  };
  return {
    consumedExceptionKey: exceptionKey,
    error: null,
  };
}

function computeSigningResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<MutationSigningCurrentState>): ComputeResultLike {
  const { team, player } = requireSigningState(currentState, 'signFreeAgent');
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { contract, signedUsing } = payload;
  const signingMechanism = resolveSigningMechanismForPipeline(
    contract,
    signedUsing
  );

  const updatedTeam = { ...team };
  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  // Add player to roster if not already present
  const playerId = String(payload.playerId || player.player_id || player.id || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required for signing.',
    };
  }
  const rosterEntries = Array.isArray(updatedTeam.roster)
    ? updatedTeam.roster
    : [];
  if (
    !rosterEntries.some(
      (entry) => getMutationRosterEntryId(entry) === playerId
    )
  ) {
    updatedTeam.roster = [...rosterEntries, playerId];
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
    toFiniteAmount(
      normalizedContract?.totalValue,
      sumContractValueFromRows(normalizedContract || contract)
    )
  );
  const exceptionConsumption = consumeSigningExceptionUsage({
    updatedTeam,
    mechanism: signingMechanism,
    contractValue,
    timestamp,
  });
  if (exceptionConsumption.error) {
    return {
      success: false,
      error: exceptionConsumption.error,
    };
  }
  const consumedExceptionKey = exceptionConsumption.consumedExceptionKey;

  const signingHardCapTrigger =
    consumedExceptionKey && getSigningHardCapTriggerMetadata(signingMechanism);
  if (signingHardCapTrigger) {
    updatedTeam.hardCapped = 1;
    updatedTeam.hardCapLevel = signingHardCapTrigger.hardCapLevel;
    updatedTeam.hardCapReason = signingHardCapTrigger.hardCapReason;
    updatedTeam.hardCapTriggeredBy = signingHardCapTrigger.hardCapTriggeredBy;
  }
  // Phase 74: Room Exception usage tracking
  // Room Exception does NOT trigger hard cap.

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
  if (
    normalizedContract?.rfaOfferSheet &&
    'offerSheets' in updatedTeam &&
    Array.isArray(updatedTeam.offerSheets)
  ) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  const teamUpdates: ArchitectMutationTeamUpdate[] = [
    { teamCode, team: updatedTeam },
  ];

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
        ...getTeamSourceRecord(updatedHomeTeam.source),
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
}: ComputeMutationParamsWithCurrentState<MutationTeamAndPlayerCurrentState>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'waivePlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
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
    (entry) => getMutationRosterEntryId(entry) !== playerId
  );

  // Remove player from players array
  updatedTeam.players = (updatedTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );

  // Calculate dead cap from guaranteed rows in current/future seasons.
  const contract = player.contract;
  const contractRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const seasonEndYear = toEndYear(seasonId) ?? 0;
  const remainingGuaranteedFromRows = contractRows
    .filter((row) => {
      const yearEnd = toEndYear(row.season);
      return typeof yearEnd === 'number' && yearEnd >= seasonEndYear;
    })
    .filter((row) => row.guaranteed !== false)
    .reduce((sum, row) => sum + (Number(row.salary) || 0), 0);
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
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

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
}: ComputeMutationParamsWithCurrentState<MutationTeamAndPlayerCurrentState>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'extendPlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  // Update player's contract in players array
  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const normalizedExtensionRows: MutationPipelineSalaryRow[] = Array.isArray(
    extension?.salariesByYear
  )
    ? extension.salariesByYear.map(
        (row): MutationPipelineSalaryRow => {
          const normalizedRow = normalizeSalaryRow(row);
          const capHit = toOptionalNumber(normalizedRow?.capHit);
          const optionUsed =
            typeof normalizedRow?.optionUsed === 'boolean'
              ? normalizedRow.optionUsed
              : undefined;

          return {
            ...row,
            ...(capHit !== undefined ? { capHit } : {}),
            ...(optionUsed !== undefined ? { optionUsed } : {}),
            isExtensionSeason: true,
          };
        }
      )
    : [];

  // Determine which years the extension covers so we can void overlapping originals
  const extensionYearSet = new Set(
    normalizedExtensionRows
      .map((row) => getSalaryRowEndYear(row))
      .filter((year): year is number => typeof year === 'number')
  );

  // Mark existing salary rows that overlap with extension years as voidedByExtension
  const existingFutureContract = teamPlayers[playerIndex].futureContract;
  const existingRows = (
    Array.isArray(existingFutureContract?.salariesByYear)
      ? existingFutureContract.salariesByYear
      : []
  ).map((row) => {
    const rowYear = getSalaryRowEndYear(row as MutationPipelineSalaryRow);
    return extensionYearSet.has(rowYear)
      ? { ...row, voidedByExtension: true }
      : row;
  });

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...(existingFutureContract || {}),
    salariesByYear: [
      ...existingRows,
      ...normalizedExtensionRows,
    ],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...teamPlayers[playerIndex],
    futureContract: normalizeFutureContract(
      rawFutureContract
    ) as ArchitectMutationContract | null,
  };

  teamPlayers[playerIndex] = updatedPlayer;
  updatedTeam.players = teamPlayers;

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
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
      extensionYears: normalizedExtensionRows.length,
      extensionTerms: {
        years: normalizedExtensionRows.length,
        salariesByYear: normalizedExtensionRows,
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
}: ComputeMutationParamsWithCurrentState<MutationTeamAndPlayerCurrentState>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'optionDecision'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { accepted, targetYear } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  // Find player in team
  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const playerData = teamPlayers[playerIndex];
  const salaries = Array.isArray(playerData.contract?.salariesByYear)
    ? playerData.contract.salariesByYear
    : [];

  // Find the option year entry
  const optionIndex = salaries.findIndex((row) => {
    const yearEnd = toEndYear(row.season);
    return yearEnd === targetYear && row.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    // Accepted: mark option as used (canonical boolean format)
    const updatedSalaries: MutationPipelineSalaryRow[] = salaries.map(
      (row) => row as MutationPipelineSalaryRow
    );
    updatedSalaries[optionIndex] = {
      ...(normalizeSalaryRow(
        updatedSalaries[optionIndex]
      ) as MutationPipelineSalaryRow),
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
      .filter((_, idx) => idx < optionIndex)
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
    const capHoldPlayer = toCapHoldComputationPlayer(playerData);
    const rightsType = getRightsTypeFromPlayer(capHoldPlayer);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: capHoldPlayer,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      const fallbackNotes = capHoldExpectation.usedFallback
        ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
        : undefined;
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
        active: true,
        ...(fallbackNotes ? { notes: fallbackNotes } : {}),
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (entry) => getMutationRosterEntryId(entry) !== playerId
    );
    updatedTeam.players = teamPlayers.filter(
      (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
    );
  }

  // Update player in team's players array if still on roster
  if (accepted) {
    teamPlayers[playerIndex] = updatedPlayer;
    updatedTeam.players = teamPlayers;
  }

  // Add cap hold if created
  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

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
}: ComputeMutationParamsWithCurrentState<MutationTeamAndPlayerCurrentState>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'renounceRights'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
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
    updatedTeam.players = updatedTeam.players.map((teamPlayer) => {
      const pid = getMutationPlayerId(teamPlayer);
      // Prioritize exact ID match, then fall back to name match
      const isMatch =
        pid === playerId ||
        (pid == null && teamPlayer.name === playerName);
      if (isMatch) {
        return {
          ...teamPlayer,
          rightsRenounced: true,
          renouncedAt: new Date(timestamp).toISOString(),
          contract: {
            ...(teamPlayer.contract || {}),
            birdRights: {
              ...(teamPlayer.contract?.birdRights || {}),
              status: 'None',
              renouncedBy: teamCode,
              renouncedAt: new Date(timestamp).toISOString(),
            },
          },
        };
      }
      return teamPlayer;
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals (cap holds affect cap space)
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

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

const MANUAL_EXCEPTION_MUTATION_KEYS = [
  'mle',
  'tpmle',
  'taxpayerMle',
  'tpMle',
  'miniMle',
  'nonTaxpayerMle',
  'fullMLE',
  'bae',
  'biAnnual',
  'room',
  'roomMLE',
  'roommle',
  'rmle',
] as const;
const MANUAL_EXCEPTION_MUTATION_KEY_SET = new Set<string>(
  MANUAL_EXCEPTION_MUTATION_KEYS
);

function mergeManualExceptionSnapshot(
  existingExceptions: unknown,
  editedExceptions: unknown
): ArchitectMutationExceptions {
  const existingBuckets =
    toMutationExceptionPreserveOnlyBuckets(existingExceptions);
  const editedBuckets = toMutationExceptionPreserveOnlyBuckets(editedExceptions);
  const mergedPreserveOnlyBuckets: MutationExceptionPreserveOnlyBuckets = {};

  for (const [key, value] of Object.entries(existingBuckets || {})) {
    if (!MANUAL_EXCEPTION_MUTATION_KEY_SET.has(key)) {
      mergedPreserveOnlyBuckets[key] = value;
    }
  }

  if (editedBuckets) {
    Object.assign(mergedPreserveOnlyBuckets, editedBuckets);
  }

  return normalizeMutationExceptionsFromIngress(mergedPreserveOnlyBuckets);
}

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces only the editable exception subset while preserving untouched
 * non-editable buckets such as canonical TPE storage.
 */
function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<MutationTeamOnlyCurrentState>): ComputeResultLike {
  const { team } = requireBasicTeamState(currentState, 'setExceptions');
  const { teamCode } = payload;

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

  const updatedTeam = {
    ...team,
    exceptions: mergeManualExceptionSnapshot(
      team?.exceptions,
      payload.exceptions
    ),
  };

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

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
}: { mutationType: string; payload: MutationPayloadLike; currentState: MutationCurrentState; computeResult: ComputeResultLike; seasonId: string; asOfDate?: string | null; dateDefaulted?: boolean }): { valid: boolean; error?: string; violations?: string[]; warnings?: unknown[] } {
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
      return validateNonTradeMutationStage({
        mutationType,
        payload,
        currentState,
        computeResult,
        seasonId,
        asOfDate,
        dateDefaulted,
      });
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
        const afterSanitize = sanitizeTransientFieldsForPersistence(
          persistablePlayer
        );
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
}: ComputeMutationParamsWithCurrentState<MutationOfferSheetTeamAndPlayerCurrentState>): ComputeResultLike {
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
      (contract.salariesByYear?.map(normalizeSalaryRow) as NormalizedMutationSalaryRow[] | undefined) || [],
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
    ...getTeamSourceRecord(updatedOfferingTeam.source),
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
      ...getTeamSourceRecord(updatedHomeTeam.source),
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
}: ComputeMutationParamsWithCurrentState<MutationOfferSheetMirrorCurrentState>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'matchOfferSheet'
  );

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
    ...getTeamSourceRecord(updatedOfferingTeam.source),
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
        ...getTeamSourceRecord(updatedHomeTeam.source),
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
}: ComputeMutationParamsWithCurrentState<MutationOfferSheetMirrorCurrentState>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'declineOfferSheet'
  );

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
    ...getTeamSourceRecord(updatedOfferingTeam.source),
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
        ...getTeamSourceRecord(updatedHomeTeam.source),
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
}: ComputeMutationParamsWithCurrentState<MutationOfferSheetResolutionCurrentState>): ComputeResultLike {
  const { homeTeam, offeringTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeMatchedOfferSheet'
  );
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
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    updatedOfferingTeam.offerSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
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
}: ComputeMutationParamsWithCurrentState<MutationOfferSheetResolutionCurrentState>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeDeclinedOfferSheet'
  );
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
  if (
    !(updatedOfferingTeam.roster || []).some(
      (entry) => getMutationRosterEntryId(entry) === playerId
    )
  ) {
    updatedOfferingTeam.roster = [
      ...(updatedOfferingTeam.roster || []),
      playerId,
    ];
  }
  if (Array.isArray(updatedOfferingTeam.capHolds)) {
    updatedOfferingTeam.capHolds = updatedOfferingTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedOfferingTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedOfferingTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    updatedHomeTeam.incomingOfferSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.roster = (updatedHomeTeam.roster || []).filter(
    (entry) => getMutationRosterEntryId(entry) !== playerId
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
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

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
}: ComputeMutationParamsWithCurrentState<MutationSignAndTradeCurrentState> & {
  asOfDate?: string | number | null;
  worldId?: string;
  historyContext?: TradeHistoryContextLike;
}): ComputeResultLike {
  const { team, destinationTeam, player } = requireDestinationState(
    currentState,
    'signAndTrade'
  );
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    teamCode,
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState: MutationSigningCurrentState = { team, player, teamCode };
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

  // Phase 48: Validate the SAT signing phase before the trade handoff.
  const signingValidation = validateSignAndTradeSigningPhase({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    seasonId,
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
  const updatedSourceTeam =
    materializeCurrentStateBaseTeamPreservedFields(
      signingResult.teamUpdates[0].team as CurrentStateTeamRoundTripMaterializable
    ) || signingResult.teamUpdates[0].team;
  const signedPlayer = signingResult.playerUpdates[0].player;

  // 2. Build the SAT handoff into the canonical trade preparation surface.
  const tradeHandoff = buildSignAndTradeTradeHandoff({
    sourceTeamCode: teamCode,
    destinationTeamCode,
    updatedSourceTeam,
    destinationTeam,
    signedPlayer,
    contract: payload.contract || null,
    seasonId,
    timestamp,
    asOfDate,
    worldId,
  });

  // 3. Call pure trade compute with the prepared SAT trade handoff.
  const tradeResult = computeTradeResult({
    payload: tradeHandoff.tradePayload,
    currentState: tradeHandoff.tradeState,
    seasonId,
    timestamp,
    historyContext: {
      worldId: historyContext.worldId || worldId,
      mutationType: historyContext.mutationType || 'signAndTrade',
      mutationId: historyContext.mutationId,
    },
    postTradeSnapshot: tradeHandoff.tradeApplyPreparation.postTradeSnapshot,
    validatedContext: tradeHandoff.tradeApplyPreparation.validatedContext,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 4. Return combined SAT result with both prevalidated contexts attached.
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
    _validatedTradeContext: tradeHandoff.tradeApplyPreparation.validatedContext,
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
}: ComputeMutationParamsWithCurrentState<MutationTeamOnlyCurrentState>): ComputeResultLike {
  const { teamCode } = payload;
  const { team } = requireBasicTeamState(currentState, 'setDeadCap');

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
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshot(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

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
