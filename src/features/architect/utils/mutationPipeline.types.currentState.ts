/**
 * FILE: src/features/architect/utils/mutationPipeline.types.currentState.ts
 * PURPOSE: Normalized current-state player and team shapes used during mutation compute.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 13 Step 2: Extracted from mutationPipeline.types.ts (L758–L1265 of original).
 */

import type { PlayerDraft } from '@/schemas/players_v2';
import type {
  ArchitectMutationBirdRights,
  ArchitectMutationContract,
  ArchitectMutationFreeAgency,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTradeEligibility,
  ArchitectMutationTradeEligibilityRules,
  CurrentStateExceptionHistoryEntry,
  CurrentStateTradeException,
  LooseRecord,
  MutationCurrentStateContractDateLike,
  MutationCurrentStateContractNumberish,
  MutationPlayerBioLike,
  NormalizedMutationContractIncentives,
  NormalizedMutationGuaranteeScheduleEntry,
  NormalizedMutationSalaryRow,
} from './mutationPipeline.types.record';

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
  'offerSheetMatchRestriction',
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
  offerSheetMatchRestriction?: unknown;
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
  governedEvidence?: unknown;
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
    | 'rightsLedger'
    | 'contractEventLedgers'
    | 'salaryBookInputs'
    | 'hardCapLedger'
    | 'deadCap'
    | 'exceptions'
    | 'tradeExceptions'
    | 'cashLedger'
    | 'offerSheets'
    | 'incomingOfferSheets'
    | 'exceptionHistory'
    | 'totals'
    | 'teamTotalSalary'
    | 'teamSalary'
    | 'apronTeamSalary'
    | 'taxSalary'
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
  | 'teamSalary'
  | 'apronTeamSalary'
  | 'taxSalary'
> & {
  players?: CurrentStatePlayer[];
  twoWayPlayers?: CurrentStatePlayer[];
  tradeExceptions?: CurrentStateTradeException[];
  exceptionHistory?: CurrentStateExceptionHistoryEntry[];
  teamTotalSalary?: number;
  teamSalary?: number;
  apronTeamSalary?: number;
  taxSalary?: number;
};
export type CurrentStateTeamIdentityFieldMap = Pick<
  CurrentStateTeam,
  'teamCode' | 'teamName'
>;
export type CurrentStateTeamMutationCoreFieldMap = Pick<
  CurrentStateTeam,
  | 'players'
  | 'capHolds'
  | 'rightsLedger'
  | 'contractEventLedgers'
  | 'salaryBookInputs'
  | 'hardCapLedger'
  | 'deadCap'
  | 'totals'
  | 'source'
  | 'hardCapped'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
>;
export type CurrentStateTeamRosterFieldMap = Pick<CurrentStateTeam, 'roster'>;
export type CurrentStateTeamExceptionsFieldMap = Pick<
  CurrentStateTeam,
  'exceptions'
>;
export type CurrentStateOfferSheetTeamLiveFieldMap = Pick<
  CurrentStateTeam,
  'offerSheets' | 'incomingOfferSheets'
>;
export type CurrentStatePlayerOpsTeamCompute =
  CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap &
    CurrentStateTeamRosterFieldMap;
export type CurrentStateManualCapTeamCompute =
  CurrentStateTeamIdentityFieldMap &
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
export type CurrentStateBaseTeamRoundTripCarrier =
  CurrentStateBaseTeamRosterCarrier &
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
  Pick<
    CurrentStateTeam,
    | 'twoWayPlayers'
    | 'teamTotalSalary'
    | 'teamSalary'
    | 'apronTeamSalary'
    | 'taxSalary'
  >;
export type CurrentStateNonTradeTeamRoundTripMaterializable =
  | CurrentStatePlayerOpsTeam
  | CurrentStateManualCapTeam
  | CurrentStateSigningTeam
  | CurrentStateOfferSheetMirrorTeam
  | CurrentStateOfferSheetResolutionTeam;
export type BaseTeamLike =
  | CurrentStatePlayerOpsTeam
  | CurrentStateManualCapTeam;
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
    teamSalary?: CurrentStateTradeTeam['teamSalary'];
    apronTeamSalary?: CurrentStateTradeTeam['apronTeamSalary'];
    taxSalary?: CurrentStateTradeTeam['taxSalary'];
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
