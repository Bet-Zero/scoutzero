/**
 * FILE: src/features/architect/utils/mutationPipeline.read.normalizeTeam.ts
 * PURPOSE: Team current-state construction — normalizes loaded Firestore team data
 *          into typed current-state objects for each mutation type.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 2: Extracted from mutationPipeline.read.ts (L1046-2092).
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
  normalizeCurrentStatePlayerSnapshot,
  normalizeCurrentStateTeamSource,
  normalizeStringArray,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import {
  normalizeCurrentStateCapHolds,
  normalizeCurrentStateCashLedger,
  normalizeCurrentStateDeadCap,
  normalizeCurrentStateDraftPicks,
  normalizeCurrentStateExceptionHistory,
  normalizeCurrentStateOfferSheets,
  normalizeCurrentStatePlayerArray,
  normalizeCurrentStateTeamExceptions,
  normalizeCurrentStateTeamTotals,
  normalizeCurrentStateTradeExceptions,
  resolveCurrentStateTeamTotalSalary,
} from './mutationPipeline.read.normalizeData';

import type {
  ArchitectMutationComputedTeamSnapshot,
  CurrentStateBaseTeamCashLedgerCarrier,
  CurrentStateBaseTeamDraftPicksCarrier,
  CurrentStateBaseTeamEntitlementIdsCarrier,
  CurrentStateBaseTeamExceptionHistoryCarrier,
  CurrentStateBaseTeamExceptionsCarrier,
  CurrentStateBaseTeamPreservedCarrierLike,
  CurrentStateBaseTeamPreservedFieldMap,
  CurrentStateBaseTeamRosterCarrier,
  CurrentStateBaseTeamTradeExceptionsCarrier,
  CurrentStateTeamRoundTripMaterializable,
  CurrentStateTeamPersistenceStripShape,
  MaterializedCurrentStateTeam,
  CurrentStateManualCapTeam,
  CurrentStateManualCapTeamCompute,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetMirrorTeamCompute,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStateOfferSheetResolutionTeamCompute,
  CurrentStatePlayerOpsTeam,
  CurrentStatePlayerOpsTeamCompute,
  CurrentStatePrimaryTeam,
  CurrentStateSigningTeam,
  CurrentStateSigningTeamCompute,
  CurrentStateTeam,
  CurrentStateTeamIdentityFieldMap,
  CurrentStateTeamMutationCoreFieldMap,
  CurrentStateTradeTeam,
  MutationCurrentStateBaseTeamIngress,
  MutationCurrentStateOfferSheetTeamIngress,
  MutationCurrentStateTeamEntry,
  MutationCurrentStateTradeTeamEntryInput,
  MutationCurrentStateTradeTeamIngress,
  MutationOfferSheetMirrorCurrentState,
  MutationOfferSheetMirrorCurrentStateInput,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetResolutionCurrentStateInput,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentStateInput,
  MutationSignAndTradeCurrentState,
  MutationSignAndTradeCurrentStateInput,
  MutationTeamAndPlayerCurrentState,
  MutationTeamAndPlayerCurrentStateInput,
  MutationTeamOnlyCurrentState,
  MutationTeamOnlyCurrentStateInput,
  MutationTradeCurrentState,
  MutationTradeCurrentStateInput,
  TeamLike,
  TradeTeamLike,
} from './mutationPipeline';

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

