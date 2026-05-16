/**
 * FILE: src/features/architect/utils/mutationPipeline.types.ts
 * PURPOSE: All type and interface declarations for mutationPipeline.ts.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 7 Step 1: Extracted from mutationPipeline.ts (L186-L2286).
 * Wave 13: Split into sub-files; this file is now a barrel re-export.
 */

// Wave 13 Step 1: raw record/payload shapes
export * from './mutationPipeline.types.record';
import type {
  ArchitectMutationBirdRights,
  ArchitectMutationCashLedger,
  ArchitectMutationContract,
  ArchitectMutationFreeAgency,
  ArchitectMutationPayload,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTradeEligibility,
  ArchitectMutationTradeEligibilityRules,
  ArchitectMutationValidatedTradeContext,
  CurrentStateExceptionHistoryEntry,
  CurrentStateTradeException,
  EntitlementUpdateLike,
  ExtensionMutationPayloadInput,
  LooseRecord,
  MutationCurrentStateContractDateLike,
  MutationCurrentStateContractNumberish,
  MutationPlayerBioLike,
  NormalizedMutationContractIncentives,
  NormalizedMutationGuaranteeScheduleEntry,
  NormalizedMutationSalaryRow,
  OfferSheetMirrorMutationPayloadInput,
  OfferSheetResolutionMutationPayloadInput,
  OptionMutationPayloadInput,
  PublicExtensionMutationPayloadInput,
  PublicOfferSheetMirrorMutationPayloadInput,
  PublicOfferSheetResolutionMutationPayloadInput,
  PublicOptionMutationPayloadInput,
  PublicRenounceMutationPayloadInput,
  PublicSetDeadCapMutationPayloadInput,
  PublicSetExceptionsMutationPayloadInput,
  PublicSignAndTradeMutationPayloadInput,
  PublicSigningMutationPayloadInput,
  PublicStoreOfferSheetMutationPayloadInput,
  PublicTradeMutationPayloadInput,
  PublicWaiveMutationPayloadInput,
  RenounceMutationPayloadInput,
  SetDeadCapMutationPayloadInput,
  SetExceptionsMutationPayloadInput,
  SignAndTradeMutationPayloadInput,
  SigningMutationPayloadInput,
  StoreOfferSheetMutationPayloadInput,
  TradeMutationPayload,
  TradeTpeConsumptionIssue,
  WaiveMutationPayloadInput,
} from './mutationPipeline.types.record';

import type { PlayerDraft } from '@/schemas/players_v2';
import type { CanonicalNonTpeExceptionKey } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  TradeContextCurrentState,
} from '@/features/architect/utils/tradeContext/types';
import type { serverTimestamp } from 'firebase/firestore';
import type { validateSigning } from '@/features/architect/utils/capLegalityValidation';


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
export type CurrentStatePlayerComputeCore = Omit<
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
export type CurrentStatePlayerCore = CurrentStatePlayerComputeCore &
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
export type CurrentStatePlayerRfaSidecar = {
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
export type LineageOverrideMergeBio = Pick<
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
export type CurrentStateTeamRosterFieldMap = Pick<CurrentStateTeam, 'roster'>;
export type CurrentStateTeamExceptionsFieldMap = Pick<CurrentStateTeam, 'exceptions'>;
export type CurrentStateOfferSheetTeamLiveFieldMap = Pick<
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
export type CurrentStateBaseTeamOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['offerSheets'];
};
export type CurrentStateBaseTeamIncomingOfferSheetsCarrier = {
  [CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY]?: CurrentStateBaseTeamPreservedFieldMap['incomingOfferSheets'];
};
export type CurrentStateTradeTeamLiveFieldMap = Pick<
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
export type CurrentStateNonTradeTeamRoundTripMaterializable =
  | CurrentStatePlayerOpsTeam
  | CurrentStateManualCapTeam
  | CurrentStateSigningTeam
  | CurrentStateOfferSheetMirrorTeam
  | CurrentStateOfferSheetResolutionTeam;
export type BaseTeamLike = CurrentStatePlayerOpsTeam | CurrentStateManualCapTeam;
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
export type GeneralMutationCommittedTeamSnapshotFrom<
  T extends CurrentStateTeamRoundTripMaterializable,
> = Omit<MaterializedCurrentStateTeam<T>, 'teamTotalSalary'>;
export type GeneralMutationCommittedTeamSnapshotCore =
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
export type MutationCurrentStateTeamCoreIngress = Omit<
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
export type MutationCurrentStateTeamRoundTripIngress = {
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
export type MutationEventContractSalaryRow = {
  season?: string | number | null;
  salary?: number | string | null;
  capHit?: number | string | null;
};
export type MutationEventContractLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  years?: number | string | null;
  contractYears?: number | string | null;
  contractLength?: number | string | null;
  firstYearSalary?: number | string | null;
  year1Salary?: number | string | null;
  totalValue?: number | string | null;
  signedUsing?: string | null;
};
export type MutationEventExtensionTermsLike = {
  salariesByYear?: readonly MutationEventContractSalaryRow[] | null;
  contractYears?: number | string | null;
  years?: number | string | null;
  firstYearSalary?: number | string | null;
};
export type MutationEventEntitlementTransferSummary = {
  out: readonly string[];
  in: readonly string[];
};
export type MutationEventEntitlementsMovedByTeam = Record<
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
export type ArchitectWorldMutationPatch = {
  lastModifiedAt: ReturnType<typeof serverTimestamp>;
  lastModifiedTeams: Array<string | null | undefined>;
  asOfDate?: string;
};
export type ArchitectWorldMutationEventBridge = Partial<
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
export type MutationAuditContext = {
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
export type TradeValidatedContextLike = ArchitectMutationValidatedTradeContext;
export type TradeTeamUpdate = ArchitectMutationTeamUpdate;
export type ArchitectMutationBridgeResult = {
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
export type PersistWorldMutationResult = {
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
export type MutationCurrentStateClosedShape = {
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
export type MutationTradeCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'teams'
> & {
  teams?: MutationCurrentStateTradeTeamEntryInput[];
};
export type MutationTeamOnlyCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'teamCode'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  teamCode?: string | null;
};
export type MutationTeamAndPlayerCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'teamCode'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  teamCode?: string | null;
};
export type MutationSigningCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> & {
  team?: MutationCurrentStateOfferSheetTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  teamCode?: string | null;
};
export type MutationOfferSheetMirrorCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
export type MutationOfferSheetResolutionCurrentStateIngress = Omit<
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
export type MutationSigningCurrentState = Omit<
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
export type PublicMutationCurrentStateInputByType = {
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
export type PublicMutationPayloadInputByType = {
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
export type MutationCurrentStateInputByType = {
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
export type MutationPayloadInputByType = {
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
export type LegacyPublicComputeWorldMutationArgsByType = {
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
export type PublicComputeWorldMutationArgs =
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
export type ComputeWorldMutationArgs =
  ComputeWorldMutationArgsByType[SupportedComputeMutationType];
