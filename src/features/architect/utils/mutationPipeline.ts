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
export * from './mutationPipeline.read';

export type LooseRecord = Record<string, unknown>;
export type MutationScalarId = string | number | null | undefined;
export type MutationPlayerBioLike = {
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
export type MutationPlayerSourceLike = MutationSourceMetadata | null;
type MutationTradeExceptionRecord = TradeExceptionRecord & {
  isUsed?: boolean | null;
  used?: number | null;
};
export type MutationTeamSourceLike =
  | (MutationSourceMetadata & { lastModifiedAt?: string | null })
  | null;
type CapHoldComputationPlayer = NonNullable<
  NonNullable<Parameters<typeof computeExpectedCapHoldAmount>[0]['player']>
>;

export type ArchitectComputedTeamTotalsSnapshot = Pick<
  ComputedTeamCapTotals,
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

// Loaded totals preserve Firestore-facing salary/tax fields while synchronized
// mutation snapshots materialize the canonical compute fields on top.
export type ArchitectMutationTeamTotals = LoadedTeamCapTotals;

export type ArchitectMutationContractIncentives = {
  likely?: number | string | null;
  unlikely?: number | string | null;
};

export type NormalizedMutationContractIncentives = {
  likely?: number | null;
  unlikely?: number | null;
};

export type ArchitectMutationGuaranteeScheduleEntry = {
  effectiveDate?: string | null;
  guaranteedAmount?: number | string | null;
  status?: string | null;
  note?: string | null;
};

export type NormalizedMutationGuaranteeScheduleEntry = {
  effectiveDate?: string | null;
  guaranteedAmount?: number | null;
  status?: string | null;
  note?: string | null;
};

export type ArchitectMutationTradeEligibilityRules = {
  baseYearCompensation?: boolean | null;
  poisonPill?: boolean | null;
  aggregation?: boolean | null;
};

export type ArchitectMutationTradeEligibility = {
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
  season: string; // required — string guaranteed after normalization
  year?: number | null;
  salary?: number | null; // strictly number, no string
  capHit?: number | null; // strictly number, no string
  guaranteed?: boolean | null;
  guaranteedAmount?: number | null; // strictly number, no string
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | null; // boolean, not string
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

export type MutationDeadCapYear = {
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

export type CurrentStateExceptionHistoryEntry = {
  historyKey?: string | null;
  type?: string | null;
  teamCode?: string | null;
  tpeId?: string | null;
  timestamp?: string | null;
} & Record<string, unknown>;

export type ArchitectMutationCanonicalExceptionBuckets = Partial<
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
export type ArchitectMutationExceptionIngress = ArchitectMutationExceptions &
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

export type ArchitectMutationCapHold = {
  playerId?: string | number | null;
  playerName?: string;
  amount?: number;
  type?: string;
  season?: string;
  isSigned?: boolean;
  expiresOn?: string | null;
  notes?: string;
  active?: boolean;
  reason?: string;
};

export type ArchitectMutationPlayerRfaContextIngress = {
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

export type ArchitectMutationCashLedger = {
  totalOut?: number | string | null;
};

export type ArchitectMutationTeamRecord = {
  id?: MutationScalarId;
  teamCode?: string | null;
  teamName?: string | null;
  players?: ArchitectMutationPlayerRecord[];
  roster?: Array<string | number>;
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

type ArchitectTradePayloadSignAndTradeContract =
  | SignAndTradeContractLike
  | Pick<
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
    isTwoWay?: boolean | null;
    signAndTrade?: boolean;
    signAndTradeContract?: ArchitectTradePayloadSignAndTradeContract | null;
    receivingTeamIndex?: MutationScalarId;
    receivingTeamId?: MutationScalarId;
    tradeTo?: MutationScalarId;
    toTeamId?: MutationScalarId;
    destTeamId?: MutationScalarId;
  };

// Closed mutation-owned handoff: apply-time compute only owns a stable player
// identifier, minimal labeling, salary-matching fields, one SAT contract slice,
// one canonical routed destination, and the two-way flag needed by roster /
// eligibility normalization.
export type ArchitectTradePayloadPlayer = {
  player_id?: string | null;
  name?: string | null;
  displayName?: string | null;
  originTeamId?: string | null;
  matchIncoming?: number | string | null;
  matchOutgoing?: number | string | null;
  absorptionMode?: string | null;
  tpeId?: string | null;
  isTwoWay?: boolean;
  signAndTrade?: boolean;
  signAndTradeContract?: ArchitectTradePayloadSignAndTradeContract | null;
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

// Legacy incoming-player field carried on older executeTrade payloads.
// Only read by leagueInvariants.extractIncomingPlayers for cross-team duplicate detection.
export type ArchitectTradePayloadLegacyReceivingPlayer = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'id' | 'playerId' | 'bio' | 'displayName' | 'name' | 'playerName'
>;

export type ArchitectTradePayloadTeamIngress = {
  team?: ArchitectTradePayloadTeamRef | null;
  teamCode?: MutationScalarId;
  teamId?: MutationScalarId;
  sends?: ArchitectTradePayloadPlayerIngress[];
  // Compatibility-only mirror from older trade preview callers. Mutation-owned
  // apply-time compute rebuilds receives from routed sends instead of reading
  // this bag as authority.
  receives?: ArchitectTradePayloadPlayerIngress[];
  // Legacy field names from older executeTrade payload shapes; only consumed by
  // leagueInvariants.extractIncomingPlayers for duplicate-player detection.
  receiving?: ArchitectTradePayloadLegacyReceivingPlayer[];
  playersReceiving?: ArchitectTradePayloadLegacyReceivingPlayer[];
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

// Closed mutation-owned handoff: authoritative trade compute anchors on the
// resolved source team code and outbound assets, while still preserving
// normalized receive mirrors for validation/snapshot compatibility.
export type ArchitectTradePayloadTeam = {
  teamCode: string | null;
  sends: ArchitectTradePayloadPlayer[];
  receives: ArchitectTradePayloadPlayer[];
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
export type TradeMutationPayload = TradeContextNormalizedPayload;
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
  playerName?: string | null;
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
type MutationPayloadClosedShape = {
  [KMutationPayloadKey in keyof ArchitectMutationPayload]?: undefined;
};
type PublicMutationPayloadSlice<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
> = Omit<MutationPayloadClosedShape, TMutationPayloadKey> &
  Pick<ArchitectMutationPayload, TMutationPayloadKey>;
type NormalizedMutationPayloadSlice<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
> = Omit<MutationPayloadClosedShape, TMutationPayloadKey> &
  Pick<ArchitectMutationPayload, TMutationPayloadKey>;
type PublicTradeMutationPayloadInput = PublicMutationPayloadSlice<
  'teams' | 'capProjections' | 'tradeCtx' | 'asOfDate'
>;
type PublicSigningMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
type PublicWaiveMutationPayloadInput = PublicMutationPayloadSlice<
  | 'teamCode'
  | 'playerId'
  | 'stretch'
  | 'stretchYears'
  | 'buyout'
  | 'buyoutAmount'
  | 'isGracePeriod'
>;
type PublicExtensionMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'extension'
>;
type PublicOptionMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'accepted' | 'targetYear'
>;
type PublicRenounceMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId'
>;
type PublicStoreOfferSheetMutationPayloadInput = PublicMutationPayloadSlice<
  | 'teamCode'
  | 'playerId'
  | 'contract'
  | 'signedUsing'
  | 'offerSheetId'
  | 'worldId'
>;
type PublicOfferSheetMirrorMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'homeTeamCode' | 'offeringTeamCode' | 'offerSheetId'
>;
type PublicOfferSheetResolutionMutationPayloadInput =
  PublicMutationPayloadSlice<
    | 'teamCode'
    | 'homeTeamCode'
    | 'offeringTeamCode'
    | 'offerSheetId'
    | 'dedupKey'
  >;
type PublicSignAndTradeMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'destinationTeamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
type PublicSetDeadCapMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'deadCap' | 'deadCapChanges'
>;
type PublicSetExceptionsMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'exceptions' | 'exceptionChanges'
>;
type SigningMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'contract' | 'signedUsing'
>;
type WaiveMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'stretch' | 'stretchYears' | 'buyout' | 'buyoutAmount'
>;
type ExtensionMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'extension'
>;
type OptionMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'accepted' | 'targetYear'
>;
type RenounceMutationPayloadInput = NormalizedMutationPayloadSlice<'playerId'>;
type StoreOfferSheetMutationPayloadInput = NormalizedMutationPayloadSlice<
  'contract' | 'offerSheetId' | 'worldId'
>;
type OfferSheetMirrorMutationPayloadInput =
  NormalizedMutationPayloadSlice<never>;
type OfferSheetResolutionMutationPayloadInput =
  NormalizedMutationPayloadSlice<'dedupKey'>;
type SignAndTradeMutationPayloadInput = NormalizedMutationPayloadSlice<
  'teamCode' | 'destinationTeamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
type SetDeadCapMutationPayloadInput = NormalizedMutationPayloadSlice<
  'teamCode' | 'deadCap' | 'deadCapChanges'
>;
type SetExceptionsMutationPayloadInput = NormalizedMutationPayloadSlice<
  'teamCode' | 'exceptions' | 'exceptionChanges'
>;
export type CurrentStateTradeException = {
  id?: string;
  amount?: number;
  totalAmount?: number;
  remainingAmount?: number;
  usedAmount?: number;
  createdSeason?: number;
  expiresOn?: string | null;
  createdFrom?: string;
  isUsed?: boolean;
};
export type LoadedMutationTeam = Awaited<ReturnType<typeof getTeam>>;
export type LoadedMutationPlayer = Awaited<ReturnType<typeof getPlayer>>;
export type MutationPipelineSalaryRow = NormalizedMutationSalaryRow & {
  year?: number | string | null;
};
export type MutationCurrentStateContractNumberish = number | string | null;
export type MutationCurrentStateContractDateLike = string | number | null;
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
export type CurrentStatePlayerContractIncentives =
  NormalizedMutationContractIncentives;
export type CurrentStatePlayerContractGuaranteeScheduleEntry =
  NormalizedMutationGuaranteeScheduleEntry;
export type CurrentStatePlayerContractTradeEligibilityRules =
  ArchitectMutationTradeEligibilityRules;
export type CurrentStatePlayerContractTradeEligibility =
  ArchitectMutationTradeEligibility;
export type CurrentStatePlayerContractFreeAgency = ArchitectMutationFreeAgency;
export type MutationCurrentStatePlayerContractSalaryRowIngress = {
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
export type CurrentStatePlayerContractSalaryRow = NormalizedMutationSalaryRow;
export type MutationCurrentStatePlayerContractIngress = {
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
export type MutationCurrentStatePlayerFutureContractIngress = {
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
export type CurrentStatePlayerContract = Pick<
  ArchitectMutationContract,
  (typeof CURRENT_STATE_PLAYER_CONTRACT_KEYS)[number]
>;
export type CurrentStatePlayerFutureContract = Pick<
  ArchitectMutationContract,
  (typeof CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS)[number]
>;
export type CurrentStatePlayerBioDisplay = NonNullable<
  MutationPlayerBioLike['display']
>;
export type CurrentStatePlayerBioDraft = Pick<
  PlayerDraft,
  'year' | 'round' | 'pick' | 'teamId'
>;
export type CurrentStatePlayerBio = Omit<
  MutationPlayerBioLike,
  | 'draft'
  | 'display'
  | 'experience'
  | 'yearsExperience'
  | 'yearsPro'
  | 'Years Pro'
> & {
  draft?: CurrentStatePlayerBioDraft | null;
  display?: CurrentStatePlayerBioDisplay | null;
  experience?: number | string | null;
  yearsExperience?: number | string | null;
  yearsPro?: number | string | null;
  ['Years Pro']?: number | string | null;
};
export type NormalizedCurrentStatePlayerDraft = Pick<
  NonNullable<ArchitectMutationPlayerRecord['draft']>,
  'round' | 'pick'
>;
export type CurrentStatePlayerRfaContext = {
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
export type CurrentStatePlayerOverridePersistenceSidecar = Pick<
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
export type CurrentStatePlayerOverridePersistenceIngress = Pick<
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
export type CurrentStatePlayerRfaBoundary = CurrentStatePlayerRfaSidecar & {
  isNewlySignedFA?: boolean;
  originTeamId?: string;
};
export type NormalizedCurrentStatePlayer = CurrentStatePlayerCore &
  CurrentStatePlayerRfaBoundary;
type LineageOverrideMergeBio = Pick<
  NonNullable<NormalizedCurrentStatePlayer['bio']>,
  'playerId' | 'displayName'
>;
export type LineageOverrideMergePlayer = LooseRecord &
  Omit<
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
export type LineageOverrideSalaryRow = NonNullable<
  NonNullable<LineageOverrideMergePlayer['contract']>['salariesByYear']
>[number];
export type PersistablePlayerOverride = Pick<
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
export type PersistablePlayerOverrideSource = Pick<
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
export type CurrentStatePlayer = CurrentStatePlayerCore &
  CurrentStatePlayerRfaBoundary;
const CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY =
  '__currentStateBasePreserved';
const CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Roster`;
const CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Exceptions`;
const CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}OfferSheets`;
const CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}IncomingOfferSheets`;
const CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}TradeExceptions`;
const CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}CashLedger`;
const CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}ExceptionHistory`;
const CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}DraftPicks`;
const CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}EntitlementIds`;
export type CurrentStateTeam = Omit<
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
export type CurrentStateTeamIdentityFieldMap = Pick<
  CurrentStateTeam,
  'teamCode' | 'teamName'
>;
export type CurrentStateTeamMutationCoreFieldMap = Pick<
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
type CurrentStateTeamExceptionsFieldMap = Pick<CurrentStateTeam, 'exceptions'>;
type CurrentStateOfferSheetTeamLiveFieldMap = Pick<
  CurrentStateTeam,
  'offerSheets' | 'incomingOfferSheets'
>;
export type CurrentStatePlayerOpsTeamCompute = CurrentStateTeamIdentityFieldMap &
  CurrentStateTeamMutationCoreFieldMap &
  CurrentStateTeamRosterFieldMap;
export type CurrentStateManualCapTeamCompute = CurrentStateTeamIdentityFieldMap &
  CurrentStateTeamMutationCoreFieldMap &
  CurrentStateTeamExceptionsFieldMap;
export type CurrentStateSigningTeamCompute = CurrentStatePlayerOpsTeamCompute &
  CurrentStateTeamExceptionsFieldMap &
  Pick<CurrentStateTeam, 'offerSheets'>;
export type CurrentStateOfferSheetMirrorTeamCompute =
  CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap &
    CurrentStateOfferSheetTeamLiveFieldMap;
export type CurrentStateOfferSheetResolutionTeamCompute =
  CurrentStatePlayerOpsTeamCompute & CurrentStateOfferSheetTeamLiveFieldMap;
export type CurrentStateBaseTeamPreservedFieldMap = Pick<
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
export type CurrentStateBaseTeamRosterCarrier = {
  [CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['roster'];
};
export type CurrentStateBaseTeamExceptionsCarrier = {
  [CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['exceptions'];
};
type CurrentStateBaseTeamOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['offerSheets'];
};
type CurrentStateBaseTeamIncomingOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['incomingOfferSheets'];
};
type CurrentStateTradeTeamLiveFieldMap = Pick<
  CurrentStateBaseTeamPreservedFieldMap,
  'tradeExceptions' | 'cashLedger' | 'draftPicks' | 'entitlementIds'
>;
export type CurrentStateBaseTeamTradeExceptionsCarrier = {
  [CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['tradeExceptions'];
};
export type CurrentStateBaseTeamCashLedgerCarrier = {
  [CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['cashLedger'];
};
export type CurrentStateBaseTeamExceptionHistoryCarrier = {
  [CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['exceptionHistory'];
};
export type CurrentStateBaseTeamDraftPicksCarrier = {
  [CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['draftPicks'];
};
export type CurrentStateBaseTeamEntitlementIdsCarrier = {
  [CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['entitlementIds'];
};
export type CurrentStateBaseTeamRoundTripCarrier = CurrentStateBaseTeamRosterCarrier &
  CurrentStateBaseTeamExceptionsCarrier &
  CurrentStateBaseTeamOfferSheetsCarrier &
  CurrentStateBaseTeamIncomingOfferSheetsCarrier &
  CurrentStateBaseTeamTradeExceptionsCarrier &
  CurrentStateBaseTeamCashLedgerCarrier &
  CurrentStateBaseTeamExceptionHistoryCarrier &
  CurrentStateBaseTeamDraftPicksCarrier &
  CurrentStateBaseTeamEntitlementIdsCarrier;
export type CurrentStateBaseTeamPreservedCarrierLike =
  CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStatePlayerOpsTeam = CurrentStatePlayerOpsTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStateManualCapTeam = CurrentStateManualCapTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStateSigningTeam = CurrentStateSigningTeamCompute &
  CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStateOfferSheetMirrorTeam =
  CurrentStateOfferSheetMirrorTeamCompute &
    CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStateOfferSheetResolutionTeam =
  CurrentStateOfferSheetResolutionTeamCompute &
    CurrentStateBaseTeamRoundTripCarrier;
export type CurrentStateTradeTeam = CurrentStateTeamIdentityFieldMap &
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
export type OfferSheetTeamLike =
  | CurrentStateSigningTeam
  | CurrentStateOfferSheetMirrorTeam
  | CurrentStateOfferSheetResolutionTeam;
export type TradeTeamLike = CurrentStateTradeTeam;
export type CurrentStatePrimaryTeam =
  | BaseTeamLike
  | OfferSheetTeamLike
  | TradeTeamLike;
export type TeamLike = CurrentStatePrimaryTeam;
export type PlayerLike = NormalizedCurrentStatePlayer;
export type CurrentStateBaseTeamMaterializedPreservedFieldMap =
  Partial<CurrentStateBaseTeamPreservedFieldMap>;
// The round-trip/persistence seam only accepts normalized current-state teams
// plus the hidden base preserved-field carrier; it no longer widens back out to
// a general ArchitectMutationTeamRecord bag.
export type CurrentStateTeamRoundTripMaterializable =
  | CurrentStateNonTradeTeamRoundTripMaterializable
  | TradeTeamLike;
export type MaterializedCurrentStateTeam<
  T extends CurrentStateTeamRoundTripMaterializable,
> = Omit<T, keyof CurrentStateBaseTeamRoundTripCarrier> &
  CurrentStateBaseTeamMaterializedPreservedFieldMap;
export type CurrentStateTeamPersistenceStripShape =
  CurrentStateTeamRoundTripMaterializable & {
    teamTotalSalary?: CurrentStateTradeTeam['teamTotalSalary'];
  };
// Compute-time team updates stay wider than the committed artifact because the
// live local-validated trade bridge still needs the explicit teamTotalSalary
// lane plus the hidden preserved-field carrier before persistence strips them.
// Persistence and dashboard reload must narrow through the committed helpers
// below instead of reusing this broader compute bag directly.
export type ArchitectMutationComputedTeamSnapshot =
  CurrentStateTeamRoundTripMaterializable & Partial<CurrentStateTeam>;
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
export type GeneralMutationPersistenceTeamSnapshot =
  ArchitectGeneralMutationCommittedTeamSnapshot;
export type ArchitectGeneralMutationDashboardReloadDeadCapYear = {
  season: string;
  amount: number;
  isStretched?: boolean | null;
};
export type ArchitectGeneralMutationDashboardReloadDeadCapEntry = {
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
export type ArchitectGeneralMutationDashboardReloadExceptionEntry = {
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
export type ArchitectGeneralMutationDashboardReloadTradeException = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
export type ArchitectGeneralMutationDashboardReloadExceptions = Partial<
  Record<
    CanonicalNonTpeExceptionKey | 'dpe',
    ArchitectGeneralMutationDashboardReloadExceptionEntry | null
  >
> & {
  tpe?: ArchitectGeneralMutationDashboardReloadTradeException[] | null;
};
export type ArchitectGeneralMutationDashboardReloadOfferSheet = {
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
export type ArchitectGeneralMutationDashboardReloadContractFreeAgency = {
  year?: number | null;
  type?: string | null;
};
export type ArchitectGeneralMutationDashboardReloadBirdRights = {
  status: string;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayerContract = Omit<
  CurrentStatePlayerContract,
  'signingDate' | 'freeAgency' | 'birdRights'
> & {
  signingDate?: string | null;
  birdRights?: ArchitectGeneralMutationDashboardReloadBirdRights | null;
  freeAgency?:
    | ArchitectGeneralMutationDashboardReloadContractFreeAgency
    | string
    | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayerFutureContract = Omit<
  CurrentStatePlayerFutureContract,
  'signingDate' | 'freeAgency'
> & {
  signingDate?: string | null;
  freeAgency?:
    | ArchitectGeneralMutationDashboardReloadContractFreeAgency
    | string
    | null;
};
export type ArchitectGeneralMutationDashboardReloadPlayer = Omit<
  CurrentStatePlayer,
  'contract' | 'futureContract'
> & {
  contract?: ArchitectGeneralMutationDashboardReloadPlayerContract | null;
  futureContract?: ArchitectGeneralMutationDashboardReloadPlayerFutureContract | null;
};
// changedTeams is the dashboard reload artifact, not the persistence snapshot.
// It keeps only the fields the post-commit dashboard/state seam actually reads
// and leaves round-trip-only baggage on the persistence contract.
export type ArchitectGeneralMutationDashboardReloadTeamSnapshot = Pick<
  ArchitectGeneralMutationCommittedTeamSnapshot,
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
  teamCode?: string;
};
export type ArchitectGeneralMutationDashboardReloadTeamUpdate = {
  teamCode?: string | null;
  team?: ArchitectGeneralMutationDashboardReloadTeamSnapshot | null;
};

export type MutationCurrentStatePlayerIngress = Omit<
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
  'players' | 'roster' | 'capHolds' | 'deadCap' | 'exceptions' | 'totals'
> & {
  players?: unknown[] | null;
  roster?: unknown[] | null;
  capHolds?: unknown[] | null;
  deadCap?: unknown[] | null;
  exceptions?: ArchitectMutationTeamRecord['exceptions'] | null;
  totals?: ArchitectMutationTeamRecord['totals'] | null;
};
type MutationCurrentStateTeamRoundTripIngress = {
  tradeExceptions?: unknown[] | null;
  cashLedger?: ArchitectMutationCashLedger | null;
  exceptionHistory?: ArchitectMutationTeamRecord['exceptionHistory'] | null;
  draftPicks?: ArchitectMutationTeamRecord['draftPicks'] | null;
  entitlementIds?: ArchitectMutationTeamRecord['entitlementIds'] | null;
};
export type MutationCurrentStateBaseTeamIngress = MutationCurrentStateTeamCoreIngress &
  MutationCurrentStateTeamRoundTripIngress;
export type MutationCurrentStateOfferSheetTeamIngress =
  MutationCurrentStateBaseTeamIngress &
    Pick<ArchitectMutationTeamRecord, 'offerSheets' | 'incomingOfferSheets'>;
export type MutationCurrentStateTradeTeamIngress =
  MutationCurrentStateTeamCoreIngress &
    Pick<
      ArchitectMutationTeamRecord,
      | 'tradeExceptions'
      | 'cashLedger'
      | 'exceptionHistory'
      | 'teamTotalSalary'
      | 'draftPicks'
      | 'entitlementIds'
    > & {
      twoWayPlayers?: unknown[] | null;
    };
export type MutationTeamMap = Record<string, TeamLike>;
export type BuildTotalsTeamMap = Record<
  string,
  TeamLike | ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
>;
export type MutationCurrentStateTeamEntry = {
  teamCode?: string | null;
  team?: TradeTeamLike | null;
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
export type MutationDiffSummary = {
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
export type MutationEventMetadataLike = {
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
export type ArchitectWorldMutationContractSummary = {
  years?: number;
  firstYearSalary?: number;
  totalValue?: number;
  startYear?: string;
  endYear?: string;
  signedUsing?: string;
};
export type ArchitectWorldMutationHistoryMetadata = {
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
export type ArchitectWorldMutationEventDiffSummary = {
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
export type ArchitectWorldMutationEvent = {
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
  beforeTotalsByTeam: NonNullable<
    PostStateCapValidationInput['beforeTotalsByTeam']
  >;
  afterTotalsByTeam: NonNullable<
    PostStateCapValidationInput['afterTotalsByTeam']
  >;
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
  beforeTotalsByTeam?: NonNullable<
    PostStateCapValidationInput['beforeTotalsByTeam']
  >;
  afterTotalsByTeam?: NonNullable<
    PostStateCapValidationInput['afterTotalsByTeam']
  >;
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
export type PlayerUpdateLike = ArchitectMutationPlayerUpdate;
export type PlayerDeleteLike = ArchitectMutationPlayerDelete;
export type WritesSummaryLike = ArchitectMutationWritesSummary;
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
export type MutationBridgeTeamUpdatesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates'
>;
export type MutationBridgePlayerTouchSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'playerDeletes'
>;
export type MutationBridgeWritesSlice = Pick<
  ArchitectMutationBridgeResult,
  'teamUpdates' | 'playerUpdates' | 'playerDeletes' | 'entitlementUpdates'
>;
export type MutationBridgePlayerIdSlice = Pick<
  ArchitectMutationBridgeResult,
  'playerUpdates' | 'metadata'
>;
export type MutationEventSourceResult = Pick<
  ArchitectMutationBridgeResult,
  'metadata' | 'teamUpdates' | 'playerUpdates' | 'playerDeletes'
>;
export type MutationFailureOverrides = Pick<
  ArchitectMutationResult,
  | 'appliedToLocalState'
  | 'persistedToWorld'
  | 'eventWritten'
  | 'writesSummary'
  | 'violations'
  | 'warnings'
>;
export type ComputeResultLike = ArchitectMutationBridgeResult;
export type AuditContextLike = MutationAuditContext;
export type PostStateTotalsByTeam = NonNullable<
  PostStateCapValidationInput['afterTotalsByTeam']
>;
export type SupportedComputeMutationType =
  | 'executeTrade'
  | 'signFreeAgent'
  | 'waivePlayer'
  | 'extendPlayer'
  | 'optionDecision'
  | 'renounceRights'
  | 'storeOfferSheet'
  | 'matchOfferSheet'
  | 'declineOfferSheet'
  | 'finalizeMatchedOfferSheet'
  | 'finalizeDeclinedOfferSheet'
  | 'signAndTrade'
  | 'setDeadCap'
  | 'setExceptions';
type MutationCurrentStateClosedShape = {
  teams?: undefined;
  team?: undefined;
  player?: undefined;
  homeTeam?: undefined;
  offeringTeam?: undefined;
  destinationTeam?: undefined;
  teamCode?: undefined;
  destinationTeamCode?: undefined;
  offerSheetId?: undefined;
};
export type MutationCurrentStateTradeTeamEntryInput = {
  teamCode?: string | null;
  team?: MutationCurrentStateTradeTeamIngress | null;
};
type MutationTradeCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'teams'
> & {
  teams?: MutationCurrentStateTradeTeamEntryInput[];
};
type MutationTeamOnlyCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'teamCode'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  teamCode?: string | null;
};
type MutationTeamAndPlayerCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'teamCode'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  teamCode?: string | null;
};
type MutationSigningCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> & {
  team?: MutationCurrentStateOfferSheetTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  teamCode?: string | null;
};
type MutationOfferSheetMirrorCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
type MutationOfferSheetResolutionCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
export type MutationSignAndTradeCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'destinationTeam' | 'teamCode' | 'destinationTeamCode'
> & {
  team?: MutationCurrentStateTradeTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  destinationTeam?: MutationCurrentStateTradeTeamIngress | null;
  teamCode?: string | null;
  // Compatibility-only outer-edge field. This remains explicit on the
  // sign-and-trade lane only, instead of leaking through the shared ingress bag.
  destinationTeamCode?: string | null;
};

// Public current-state ingress is now a family-owned union instead of one
// cross-lane object bag. Mixed compute-ready tolerance is reintroduced only by
// the per-family input types below.
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
export type MutationTradeCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'teams'
> &
  Pick<MutationCurrentState, 'teams'>;
export type MutationTeamOnlyCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'teamCode'> & {
    team?: CurrentStateManualCapTeam | null;
  };
export type MutationTeamAndPlayerCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'player' | 'teamCode'> & {
    team?: CurrentStatePlayerOpsTeam | null;
    player?: PlayerLike | null;
  };
export type MutationOfferSheetTeamAndPlayerCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'player' | 'homeTeam' | 'teamCode'> & {
    team?: CurrentStateSigningTeam | null;
    player?: PlayerLike | null;
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationSigningTeamLike = CurrentStateSigningTeam | TradeTeamLike;
type MutationSigningCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'player' | 'homeTeam' | 'teamCode'> & {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationOfferSheetMirrorCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> &
  Pick<MutationCurrentState, 'homeTeam' | 'offeringTeam' | 'offerSheetId'> & {
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
    offeringTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationOfferSheetResolutionCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> &
  Pick<MutationCurrentState, 'homeTeam' | 'offeringTeam' | 'offerSheetId'> & {
    homeTeam?: CurrentStateOfferSheetResolutionTeam | null;
    offeringTeam?: CurrentStateOfferSheetResolutionTeam | null;
  };
export type MutationSignAndTradeCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'destinationTeam' | 'teamCode'
> &
  Pick<
    MutationCurrentState,
    'team' | 'player' | 'destinationTeam' | 'teamCode'
  > & {
    team?: TradeTeamLike | null;
    player?: PlayerLike | null;
    destinationTeam?: TradeTeamLike | null;
  };
export type MutationTradeCurrentStateInput =
  | MutationTradeCurrentStateIngress
  | MutationTradeCurrentState;
export type MutationTeamOnlyCurrentStateInput =
  | MutationTeamOnlyCurrentStateIngress
  | MutationTeamOnlyCurrentState;
export type MutationTeamAndPlayerCurrentStateInput =
  | MutationTeamAndPlayerCurrentStateIngress
  | MutationTeamAndPlayerCurrentState;
export type MutationOfferSheetTeamAndPlayerCurrentStateInput =
  | MutationSigningCurrentStateIngress
  | MutationOfferSheetTeamAndPlayerCurrentState;
export type MutationOfferSheetMirrorCurrentStateInput =
  | MutationOfferSheetMirrorCurrentStateIngress
  | MutationOfferSheetMirrorCurrentState;
export type MutationOfferSheetResolutionCurrentStateInput =
  | MutationOfferSheetResolutionCurrentStateIngress
  | MutationOfferSheetResolutionCurrentState;
export type MutationSignAndTradeCurrentStateInput =
  | MutationSignAndTradeCurrentStateIngress
  | MutationSignAndTradeCurrentState;

// Public compute callers may still pass raw loader-shaped snapshots or already
// normalized lane state. That compatibility is kept here and adapted once by
// normalizeComputeWorldMutationArgs before the core compute switch runs.
type PublicMutationCurrentStateInputByType = {
  executeTrade: MutationTradeCurrentStateInput;
  signFreeAgent: MutationOfferSheetTeamAndPlayerCurrentStateInput;
  waivePlayer: MutationTeamAndPlayerCurrentStateInput;
  extendPlayer: MutationTeamAndPlayerCurrentStateInput;
  optionDecision: MutationTeamAndPlayerCurrentStateInput;
  renounceRights: MutationTeamAndPlayerCurrentStateInput;
  storeOfferSheet: MutationOfferSheetTeamAndPlayerCurrentStateInput;
  matchOfferSheet: MutationOfferSheetMirrorCurrentStateInput;
  declineOfferSheet: MutationOfferSheetMirrorCurrentStateInput;
  finalizeMatchedOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  finalizeDeclinedOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  signAndTrade: MutationSignAndTradeCurrentStateInput;
  setDeadCap: MutationTeamOnlyCurrentStateInput;
  setExceptions: MutationTeamOnlyCurrentStateInput;
};
type PublicMutationPayloadInputByType = {
  executeTrade: PublicTradeMutationPayloadInput;
  signFreeAgent: PublicSigningMutationPayloadInput;
  waivePlayer: PublicWaiveMutationPayloadInput;
  extendPlayer: PublicExtensionMutationPayloadInput;
  optionDecision: PublicOptionMutationPayloadInput;
  renounceRights: PublicRenounceMutationPayloadInput;
  storeOfferSheet: PublicStoreOfferSheetMutationPayloadInput;
  matchOfferSheet: PublicOfferSheetMirrorMutationPayloadInput;
  declineOfferSheet: PublicOfferSheetMirrorMutationPayloadInput;
  finalizeMatchedOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  finalizeDeclinedOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  signAndTrade: PublicSignAndTradeMutationPayloadInput;
  setDeadCap: PublicSetDeadCapMutationPayloadInput;
  setExceptions: PublicSetExceptionsMutationPayloadInput;
};

// Core mutation compute only receives lane-owned current state. Loader output
// and public direct-call compatibility must normalize into these shapes first.
type MutationCurrentStateInputByType = {
  executeTrade: MutationTradeCurrentState;
  signFreeAgent: MutationOfferSheetTeamAndPlayerCurrentState;
  waivePlayer: MutationTeamAndPlayerCurrentState;
  extendPlayer: MutationTeamAndPlayerCurrentState;
  optionDecision: MutationTeamAndPlayerCurrentState;
  renounceRights: MutationTeamAndPlayerCurrentState;
  storeOfferSheet: MutationOfferSheetTeamAndPlayerCurrentState;
  matchOfferSheet: MutationOfferSheetMirrorCurrentState;
  declineOfferSheet: MutationOfferSheetMirrorCurrentState;
  finalizeMatchedOfferSheet: MutationOfferSheetResolutionCurrentState;
  finalizeDeclinedOfferSheet: MutationOfferSheetResolutionCurrentState;
  signAndTrade: MutationSignAndTradeCurrentState;
  setDeadCap: MutationTeamOnlyCurrentState;
  setExceptions: MutationTeamOnlyCurrentState;
};
type MutationPayloadInputByType = {
  executeTrade: TradeMutationPayload;
  signFreeAgent: SigningMutationPayloadInput;
  waivePlayer: WaiveMutationPayloadInput;
  extendPlayer: ExtensionMutationPayloadInput;
  optionDecision: OptionMutationPayloadInput;
  renounceRights: RenounceMutationPayloadInput;
  storeOfferSheet: StoreOfferSheetMutationPayloadInput;
  matchOfferSheet: OfferSheetMirrorMutationPayloadInput;
  declineOfferSheet: OfferSheetMirrorMutationPayloadInput;
  finalizeMatchedOfferSheet: OfferSheetResolutionMutationPayloadInput;
  finalizeDeclinedOfferSheet: OfferSheetResolutionMutationPayloadInput;
  signAndTrade: SignAndTradeMutationPayloadInput;
  setDeadCap: SetDeadCapMutationPayloadInput;
  setExceptions: SetExceptionsMutationPayloadInput;
};
export type LoadedMutationCurrentStateByType = MutationCurrentStateInputByType;
export type TradeStateSlice = Pick<MutationCurrentState, 'teams'>;
export type ApplyWorldMutationArgs = {
  userId: string;
  worldId: string;
  seasonId: string;
  mutationType: string;
  payload: ArchitectMutationPayload;
  timestamp?: number;
  operationId?: string;
};
export type PublicComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: PublicMutationPayloadInputByType[TMutationType];
    currentState: PublicMutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
  };
};
type LegacyPublicComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: ArchitectMutationPayload;
    currentState: PublicMutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
  };
};
type PublicComputeWorldMutationArgs =
  | PublicComputeWorldMutationArgsByType[SupportedComputeMutationType]
  | LegacyPublicComputeWorldMutationArgsByType[SupportedComputeMutationType];
export type ComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: MutationPayloadInputByType[TMutationType];
    currentState: MutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
  };
};
type ComputeWorldMutationArgs =
  ComputeWorldMutationArgsByType[SupportedComputeMutationType];
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
type ComputeMutationParamsWithCurrentState<TCurrentState, TPayload> =
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

  const currentYear = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const timestampISO = new Date(timestamp).toISOString();
  const resolvedWorldId =
    historyContext.worldId || payload?.tradeCtx?.worldId || null;
  const resolvedMutationType = historyContext.mutationType || 'executeTrade';
  const resolvedMutationId = historyContext.mutationId;

  // Phase 56: Use pre-built snapshot teamUpdates (already has roster changes applied)
  // Deep clone to avoid mutating the snapshot
  const teamUpdates: TradeTeamUpdate[] = (
    postTradeSnapshot.teamUpdates || []
  ).map((entry) => {
    const clonedTeam = JSON.parse(JSON.stringify(entry.team || {})) as TeamLike;
    return {
      teamCode: entry.teamCode ?? null,
      team:
        materializeCurrentStateBaseTeamPreservedFields(clonedTeam) ||
        clonedTeam,
    };
  });

  // Phase 56: Use validation results from validatedContext (already validated once)
  const validation = getTradeValidationApplyTimeSlice(validatedContext);

  // Phase 56: Use only the authoritative apply-time validationTeams from context.
  const validationTeams: TradeApplyValidationTeamLike[] =
    validatedContext.validationTeams;

  // Warn if multi-team trade without directed routing (informational only)
  if (tradeTeams.length > 2) {
    const hasDirectedRouting = tradeTeams.some((teamTrade) =>
      (teamTrade.sends || []).some(
        (sentPlayer) =>
          toOptionalTrimmedString(sentPlayer.tradeTo) !== undefined
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
    if (!updatedTeam) return;
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
      .filter((entitlementId): entitlementId is string =>
        Boolean(entitlementId)
      );

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
    (total, row) => total + toFiniteAmount(row?.salary ?? row?.capHit, 0),
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

  const availability = getCanonicalExceptionAvailability(
    updatedTeam,
    exceptionKey
  );
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
}: ComputeMutationParamsWithCurrentState<
  MutationSigningCurrentState,
  MutationPayloadInputByType['signFreeAgent']
>): ComputeResultLike {
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
  const playerId = String(
    payload.playerId || player.player_id || player.id || ''
  ).trim();
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
    !rosterEntries.some((entry) => getMutationRosterEntryId(entry) === playerId)
  ) {
    updatedTeam.roster = [...rosterEntries, playerId];
  }

  // Update or add player to players array
  const existingPlayers = updatedTeam.players || [];
  const existingIndex = existingPlayers.findIndex(
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
    updatedTeam.players = [...existingPlayers];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...existingPlayers, updatedPlayer];
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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
    Array.isArray(currentState.homeTeam.incomingOfferSheets)
  ) {
    const existingIncomingOfferSheets = currentState.homeTeam.incomingOfferSheets;
    const updatedHomeTeam = {
      ...currentState.homeTeam,
      incomingOfferSheets: existingIncomingOfferSheets.filter(
        (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
      ),
    };
    // Only add update if something changed
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      existingIncomingOfferSheets.length
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
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['waivePlayer']
>): ComputeResultLike {
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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
function computeExtensionResult({
  payload,
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['extendPlayer']
>): ComputeResultLike {
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
    ? extension.salariesByYear.map((row): MutationPipelineSalaryRow => {
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
      })
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
    return typeof rowYear === 'number' && extensionYearSet.has(rowYear)
      ? { ...row, voidedByExtension: true }
      : row;
  });

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...(existingFutureContract || {}),
    salariesByYear: [...existingRows, ...normalizedExtensionRows],
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
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['optionDecision']
>): ComputeResultLike {
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
      typeof faYearInfo.year === 'number'
        ? faYearInfo.year
        : Number(targetYear) - 1;

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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['renounceRights']
>): ComputeResultLike {
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
        pid === playerId || (pid == null && teamPlayer.name === playerName);
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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
  const editedBuckets =
    toMutationExceptionPreserveOnlyBuckets(editedExceptions);
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
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setExceptions']
>): ComputeResultLike {
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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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

function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType['storeOfferSheet']
>): ComputeResultLike {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  if (!offeringTeam || !teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires an authoritative offering team snapshot.',
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
  if (!contract) {
    return {
      success: false,
      error:
        'storeOfferSheet requires contract terms before offer-sheet creation.',
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
      (contract.salariesByYear?.map(normalizeSalaryRow) as
        | NormalizedMutationSalaryRow[]
        | undefined) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };
  const offeringOfferSheets = updatedOfferingTeam.offerSheets ?? [];

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = offeringOfferSheets.findIndex(
    (existingOfferSheet) => existingOfferSheet.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = offeringOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = offeringOfferSheets[existingIndex];
    const newSheets = [...offeringOfferSheets];
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
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = incomingOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.id === offerSheetId
    );
    if (existingHomeIndex === -1) {
      existingHomeIndex = incomingOfferSheets.findIndex(
        (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet = incomingOfferSheets[existingHomeIndex];
      const newSheets = [...incomingOfferSheets];
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
function computeMatchOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['matchOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'matchOfferSheet'
  );

  // Find offer sheet on offering team
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];

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
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
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
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
    updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
function computeDeclineOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['declineOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'declineOfferSheet'
  );

  // Find offer sheet
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];
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
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
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
      const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
      updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
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
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeMatchedOfferSheet']
>): ComputeResultLike {
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

  const homeTeamPlayers = homeTeam.players ?? [];
  const playerIndex = homeTeamPlayers.findIndex(
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
    ...homeTeamPlayers[playerIndex],
    teamCode: homeTeam.teamCode,
    teamName: homeTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const resolvedDedupKey = String(
    offerSheet.dedupKey || requestedDedupKey || ''
  ).trim();
  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    incomingOfferSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.players = [
    ...homeTeamPlayers.slice(0, playerIndex),
    updatedPlayer,
    ...homeTeamPlayers.slice(playerIndex + 1),
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
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeDeclinedOfferSheet']
>): ComputeResultLike {
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
  const offeringTeamPlayers = updatedOfferingTeam.players ?? [];
  const offeringPlayerIndex = offeringTeamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );
  if (offeringPlayerIndex !== -1) {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers.slice(0, offeringPlayerIndex),
      updatedPlayer,
      ...offeringTeamPlayers.slice(offeringPlayerIndex + 1),
    ];
  } else {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers,
      updatedPlayer,
    ];
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
  updatedOfferingTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
}: ComputeMutationParamsWithCurrentState<
  MutationSignAndTradeCurrentState,
  MutationPayloadInputByType['signAndTrade']
> & {
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
  const signingTeamUpdate = signingResult.teamUpdates?.[0]?.team;
  const signedPlayer = signingResult.playerUpdates?.[0]?.player;
  if (!signingTeamUpdate || !signedPlayer) {
    return {
      success: false,
      error:
        'Signing step did not return the source-team and player truth required for sign-and-trade handoff.',
    };
  }
  const updatedSourceTeam =
    (materializeCurrentStateBaseTeamPreservedFields(
      signingTeamUpdate as CurrentStateTeamRoundTripMaterializable
    ) as ArchitectMutationTeamRecord | null) ||
    (signingTeamUpdate as ArchitectMutationTeamRecord);

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
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setDeadCap']
>): ComputeResultLike {
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
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
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
