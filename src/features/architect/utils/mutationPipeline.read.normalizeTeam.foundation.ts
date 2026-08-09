/**
 * Wave 19 Step 1: Foundation functions, preserved field constants, and private boundary
 * types extracted from mutationPipeline.read.normalizeTeam.ts (lines 93–431).
 */

import {
  CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY,
  CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY,
  getMutationRosterEntryId,
  materializeCurrentStateBaseTeamPreservedFields,
} from './mutationPipeline.helpers';
import type {
  CurrentStateBaseTeamCashLedgerCarrier,
  CurrentStateBaseTeamDraftPicksCarrier,
  CurrentStateBaseTeamEntitlementIdsCarrier,
  CurrentStateBaseTeamExceptionHistoryCarrier,
  CurrentStateBaseTeamExceptionsCarrier,
  CurrentStateBaseTeamPreservedCarrierLike,
  CurrentStateBaseTeamPreservedFieldMap,
  CurrentStateBaseTeamRosterCarrier,
  CurrentStateBaseTeamTradeExceptionsCarrier,
  CurrentStateTeam,
  CurrentStateTeamIdentityFieldMap,
  CurrentStateTeamMutationCoreFieldMap,
  CurrentStateTeamPersistenceStripShape,
  CurrentStateTeamRoundTripMaterializable,
  CurrentStateTradeTeam,
  MaterializedCurrentStateTeam,
  MutationCurrentStateBaseTeamIngress,
  MutationCurrentStateOfferSheetTeamIngress,
  MutationCurrentStateTradeTeamIngress,
  TeamLike,
} from './mutationPipeline';

// ============================================================
// Foundation functions
// ============================================================

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

export function normalizeRosterEntries(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => getMutationRosterEntryId(entry))
    .filter((entry): entry is string => typeof entry === 'string');
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

// ============================================================
// Preserved field constants
// ============================================================

export type CurrentStateBaseTeamPreservedField =
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

// ============================================================
// Private boundary-layer types (used by boundary builders in normalizeTeam.ts)
// ============================================================

export type CurrentStateTeamMutationCoreBoundary = Pick<
  MutationCurrentStateTradeTeamIngress | CurrentStateTradeTeam,
  | 'teamCode'
  | 'teamName'
  | 'players'
  | 'capHolds'
  | 'rightsLedger'
  | 'deadCap'
  | 'totals'
  | 'source'
  | 'hardCapped'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
>;
export type CurrentStateBaseTeamBoundaryFields = {
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
export type CurrentStateBaseTeamBoundarySource = CurrentStateTeamMutationCoreBoundary &
  CurrentStateBaseTeamBoundaryFields &
  CurrentStateBaseTeamPreservedCarrierLike;
export type CurrentStateBaseTeamBoundaryInput = CurrentStateTeamMutationCoreBoundary &
  CurrentStateBaseTeamBoundaryFields;
export type CurrentStateTradeTeamBoundaryBaseFields = {
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
export type CurrentStateTradeTeamBoundaryLiveFields = {
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
export type CurrentStateTradeTeamBoundarySource =
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
export type CurrentStateTradeTeamBoundaryInput = CurrentStateTeamMutationCoreBoundary &
  CurrentStateTradeTeamBoundaryBaseFields &
  CurrentStateTradeTeamBoundaryLiveFields;
export type NormalizedCurrentStateBaseTeamBoundary = {
  mutationCore: CurrentStateTeamIdentityFieldMap &
    CurrentStateTeamMutationCoreFieldMap;
  roster?: CurrentStateTeam['roster'];
  exceptions?: CurrentStateTeam['exceptions'];
  offerSheets?: CurrentStateTeam['offerSheets'];
  incomingOfferSheets?: CurrentStateTeam['incomingOfferSheets'];
  preserved: CurrentStateBaseTeamPreservedFieldMap;
};
export type NormalizedCurrentStateTradeTeamBoundary = {
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
