/**
 * FILE: src/features/architect/utils/mutationPipeline.types.record.ts
 * PURPOSE: Raw mutation record shapes — primitives, entity records, trade payload types, and mutation payload types.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 13 Step 1: Extracted from mutationPipeline.types.ts (L43–L759).
 */

import type { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import type {
  ComputedTeamCapTotals,
  LoadedTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
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
  TradeContextNormalizedPayload,
  TeamResult as TradeContextTeamResult,
  ValidatedTradeContext as TradeContextValidatedTradeContext,
} from '@/features/architect/utils/tradeContext/types';
import type { CanonicalNonTpeExceptionKey } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type { computeExpectedCapHoldAmount } from '@/features/architect/utils/capHoldTransitionHelpers';

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
export type MutationSourceMetadata = Pick<
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
export type MutationTradeExceptionRecord = TradeExceptionRecord & {
  isUsed?: boolean | null;
  used?: number | null;
};
export type MutationTeamSourceLike =
  | (MutationSourceMetadata & { lastModifiedAt?: string | null })
  | null;
export type CapHoldComputationPlayer = NonNullable<
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

export type ArchitectTradePayloadPlayerIdentity = Pick<
  ArchitectMutationPlayerRecord,
  | 'player_id'
  | 'id'
  | 'playerId'
  | 'name'
  | 'displayName'
  | 'playerName'
  | 'originTeamId'
>;

export type ArchitectTradePayloadSignAndTradeContract =
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

export type TradePayloadEntitlementLike = {
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
export type TradeTpeConsumptionIssue = {
  playerId?: string | null;
  tpeId?: string | null;
  reason: string;
};
export type TradeEntitlementTransferSummary = {
  out: string[];
  in: string[];
};
export type TradeEntitlementsMovedByTeam = Record<
  string,
  TradeEntitlementTransferSummary
>;
export type EntitlementUpdateLike = {
  entitlementId: string;
  holderTeam: string;
};
export type TradeMutationMetadata = {
  type: 'trade';
  teamsInvolved: Array<string | null | undefined>;
  playersTraded: Array<string | null | undefined>;
  entitlementsTraded?: TradeEntitlementsMovedByTeam;
  timestamp: number;
};
export type TradeSnapshotLike = TradeContextPostTradeSnapshot;
export type TradeApplyValidationTeamLike = TradeContextApplyValidationTeam;
export type TradeValidationTeamResultLike = TradeContextTeamResult;
export type TradeValidationApplyTimeSlice = {
  legal: boolean;
  teamResults: TradeValidationTeamResultLike[];
};
export type TradeMutationPayload = TradeContextNormalizedPayload;
export type ArchitectMutationValidatedTradeContext =
  TradeContextValidatedTradeContext;
export type TradeHistoryContextLike = {
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
export type MutationPayloadClosedShape = {
  [KMutationPayloadKey in keyof ArchitectMutationPayload]?: undefined;
};
export type PublicMutationPayloadSlice<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
> = Omit<MutationPayloadClosedShape, TMutationPayloadKey> &
  Pick<ArchitectMutationPayload, TMutationPayloadKey>;
export type NormalizedMutationPayloadSlice<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
> = Omit<MutationPayloadClosedShape, TMutationPayloadKey> &
  Pick<ArchitectMutationPayload, TMutationPayloadKey>;
export type PublicTradeMutationPayloadInput = PublicMutationPayloadSlice<
  'teams' | 'capProjections' | 'tradeCtx' | 'asOfDate'
>;
export type PublicSigningMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
export type PublicWaiveMutationPayloadInput = PublicMutationPayloadSlice<
  | 'teamCode'
  | 'playerId'
  | 'stretch'
  | 'stretchYears'
  | 'buyout'
  | 'buyoutAmount'
  | 'isGracePeriod'
>;
export type PublicExtensionMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'extension'
>;
export type PublicOptionMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId' | 'accepted' | 'targetYear'
>;
export type PublicRenounceMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'playerId'
>;
export type PublicStoreOfferSheetMutationPayloadInput = PublicMutationPayloadSlice<
  | 'teamCode'
  | 'playerId'
  | 'contract'
  | 'signedUsing'
  | 'offerSheetId'
  | 'worldId'
>;
export type PublicOfferSheetMirrorMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'homeTeamCode' | 'offeringTeamCode' | 'offerSheetId'
>;
export type PublicOfferSheetResolutionMutationPayloadInput =
  PublicMutationPayloadSlice<
    | 'teamCode'
    | 'homeTeamCode'
    | 'offeringTeamCode'
    | 'offerSheetId'
    | 'dedupKey'
  >;
export type PublicSignAndTradeMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'destinationTeamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
export type PublicSetDeadCapMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'deadCap' | 'deadCapChanges'
>;
export type PublicSetExceptionsMutationPayloadInput = PublicMutationPayloadSlice<
  'teamCode' | 'exceptions' | 'exceptionChanges'
>;
export type SigningMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'contract' | 'signedUsing'
>;
export type WaiveMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'stretch' | 'stretchYears' | 'buyout' | 'buyoutAmount'
>;
export type ExtensionMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'extension'
>;
export type OptionMutationPayloadInput = NormalizedMutationPayloadSlice<
  'playerId' | 'accepted' | 'targetYear'
>;
export type RenounceMutationPayloadInput = NormalizedMutationPayloadSlice<'playerId'>;
export type StoreOfferSheetMutationPayloadInput = NormalizedMutationPayloadSlice<
  'contract' | 'offerSheetId' | 'worldId'
>;
export type OfferSheetMirrorMutationPayloadInput =
  NormalizedMutationPayloadSlice<never>;
export type OfferSheetResolutionMutationPayloadInput =
  NormalizedMutationPayloadSlice<'dedupKey'>;
export type SignAndTradeMutationPayloadInput = NormalizedMutationPayloadSlice<
  'teamCode' | 'destinationTeamCode' | 'playerId' | 'contract' | 'signedUsing'
>;
export type SetDeadCapMutationPayloadInput = NormalizedMutationPayloadSlice<
  'teamCode' | 'deadCap' | 'deadCapChanges'
>;
export type SetExceptionsMutationPayloadInput = NormalizedMutationPayloadSlice<
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
