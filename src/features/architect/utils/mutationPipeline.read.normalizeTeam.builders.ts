/**
 * Wave 36 Step 1a: Builder functions extracted from
 * mutationPipeline.read.normalizeTeam.ts (lines 116–554).
 *
 * Contains boundary-input builders, boundary normalizers, and the
 * lane-specific buildCurrentState*Team assembly functions.
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
  normalizeCurrentStateTeamSource,
  normalizeStringArray,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import {
  attachCurrentStateBaseTeamPreservedFields,
  normalizeRosterEntries,
} from './mutationPipeline.read.normalizeTeam.foundation';
import type {
  CurrentStateBaseTeamPreservedField,
  CurrentStateTeamMutationCoreBoundary,
  CurrentStateBaseTeamBoundarySource,
  CurrentStateBaseTeamBoundaryInput,
  CurrentStateTradeTeamBoundarySource,
  CurrentStateTradeTeamBoundaryInput,
  NormalizedCurrentStateBaseTeamBoundary,
  NormalizedCurrentStateTradeTeamBoundary,
} from './mutationPipeline.read.normalizeTeam.foundation';
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
import { TeamSalaryBookInputsZ } from '@/schemas/salaryBooks';
import { TradeHardCapLedgerZ } from '@/schemas/tradeApronRestriction';
import type {
  CurrentStateBaseTeamPreservedFieldMap,
  CurrentStateManualCapTeam,
  CurrentStateManualCapTeamCompute,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetMirrorTeamCompute,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStateOfferSheetResolutionTeamCompute,
  CurrentStatePlayerOpsTeam,
  CurrentStatePlayerOpsTeamCompute,
  CurrentStateSigningTeam,
  CurrentStateSigningTeamCompute,
  CurrentStateTeamIdentityFieldMap,
  CurrentStateTeamMutationCoreFieldMap,
  TradeTeamLike,
} from './mutationPipeline';

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
    rightsLedger: teamRecord.rightsLedger,
    contractEventLedgers: teamRecord.contractEventLedgers,
    salaryBookInputs: teamRecord.salaryBookInputs,
    hardCapLedger: teamRecord.hardCapLedger,
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
    rightsLedger: teamRecord.rightsLedger,
    contractEventLedgers: teamRecord.contractEventLedgers,
    salaryBookInputs: teamRecord.salaryBookInputs,
    hardCapLedger: teamRecord.hardCapLedger,
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
  const rightsLedger = teamRecord.rightsLedger;
  const contractEventLedgers = teamRecord.contractEventLedgers;
  const salaryBookInputs = TeamSalaryBookInputsZ.safeParse(
    teamRecord.salaryBookInputs
  );
  if (teamRecord.salaryBookInputs != null && !salaryBookInputs.success) {
    throw new Error('Persisted salary-book inputs are malformed or version-incompatible.');
  }
  const hardCapLedger = TradeHardCapLedgerZ.safeParse(
    teamRecord.hardCapLedger
  );
  if (teamRecord.hardCapLedger != null && !hardCapLedger.success) {
    throw new Error(
      'Persisted hard-cap ledger is malformed or version-incompatible.'
    );
  }
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
  if (rightsLedger !== undefined) {
    normalized.rightsLedger = rightsLedger;
  }
  if (contractEventLedgers !== undefined) {
    normalized.contractEventLedgers = contractEventLedgers;
  }
  if (salaryBookInputs.success) {
    normalized.salaryBookInputs = salaryBookInputs.data;
  }
  if (hardCapLedger.success) {
    normalized.hardCapLedger = hardCapLedger.data;
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
