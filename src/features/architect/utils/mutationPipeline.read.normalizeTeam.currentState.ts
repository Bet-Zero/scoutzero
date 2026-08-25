/**
 * Wave 36 Step 1: Current-state snapshot normalization extracted from
 * mutationPipeline.read.normalizeTeam.ts (lines 555–992).
 *
 * Contains the projection-lane type blocks, `isCurrentStateTeamBoundaryObject`,
 * `buildPostComputeTradeBoundaryInput`, `normalizePostComputeTeamSnapshotForPostState`,
 * `toCurrentStateTeam`, `normalizeCurrentStateTeamSnapshot`, and all
 * mutation-family current-state normalizers.
 */

import {
  materializeCurrentStateBaseTeamPreservedFields,
  toOptionalTrimmedString,
  normalizeCurrentStatePlayerSnapshot,
} from './mutationPipeline.helpers';
import {
  attachCurrentStateBaseTeamPreservedFields,
  CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS,
  CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS,
  CURRENT_STATE_SIGNING_PRESERVED_FIELDS,
  CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS,
  CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS,
} from './mutationPipeline.read.normalizeTeam.foundation';
import type {
  CurrentStateBaseTeamBoundarySource,
  CurrentStateTradeTeamBoundarySource,
  CurrentStateBaseTeamBoundaryInput,
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
import type {
  ArchitectMutationComputedTeamSnapshot,
  CurrentStateManualCapTeam,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStatePlayerOpsTeam,
  CurrentStatePrimaryTeam,
  CurrentStateSigningTeam,
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
  TradeTeamLike,
} from './mutationPipeline';

import {
  buildCurrentStateBaseTeamBoundaryInput,
  buildCurrentStateTradeTeamBoundaryInput,
  normalizeCurrentStateBaseTeamBoundary,
  normalizeCurrentStateTradeTeamBoundary,
  buildCurrentStatePlayerOpsTeam,
  buildCurrentStateManualCapTeam,
  buildCurrentStateSigningTeam,
  buildCurrentStateOfferSheetMirrorTeam,
  buildCurrentStateOfferSheetResolutionTeam,
  buildCurrentStateTradeTeam,
} from './mutationPipeline.read.normalizeTeam.builders';

// ============================================================
// Private projection-lane type blocks
// ============================================================

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

// ============================================================
// Exported functions
// ============================================================

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
    rightsLedger: materializedTeam.rightsLedger,
    contractEventLedgers: materializedTeam.contractEventLedgers,
    salaryBookInputs: materializedTeam.salaryBookInputs,
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

  return {
    ...(teams !== undefined ? { teams } : {}),
    ...(currentState?.governedSignAndTradeEvidence
      ? {
          governedSignAndTradeEvidence:
            currentState.governedSignAndTradeEvidence,
        }
      : {}),
  };
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
  const optionAuthority = currentState?.optionAuthority;
  const extensionAuthority = currentState?.extensionAuthority;
  const extensionTeamSnapshot = currentState?.extensionTeamSnapshot;
  const extensionPlayerSnapshot = currentState?.extensionPlayerSnapshot;
  const waiverAuthority = currentState?.waiverAuthority;
  const waiverTeamSnapshot = currentState?.waiverTeamSnapshot;
  const waiverPlayerSnapshot = currentState?.waiverPlayerSnapshot;

  if (team) {
    normalized.team = team;
  }
  if (player) {
    normalized.player = player;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (optionAuthority) {
    normalized.optionAuthority = optionAuthority;
  }
  if (extensionAuthority) {
    normalized.extensionAuthority = extensionAuthority;
  }
  if (extensionTeamSnapshot) {
    normalized.extensionTeamSnapshot = extensionTeamSnapshot;
  }
  if (extensionPlayerSnapshot) {
    normalized.extensionPlayerSnapshot = extensionPlayerSnapshot;
  }
  if (waiverAuthority) {
    normalized.waiverAuthority = waiverAuthority;
  }
  if (waiverTeamSnapshot) {
    normalized.waiverTeamSnapshot = waiverTeamSnapshot;
  }
  if (waiverPlayerSnapshot) {
    normalized.waiverPlayerSnapshot = waiverPlayerSnapshot;
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
  const offerSheetCreationSnapshots = currentState?.offerSheetCreationSnapshots;
  const signingTeamSnapshot = currentState?.signingTeamSnapshot;
  const signingPlayerSnapshot = currentState?.signingPlayerSnapshot;
  const signingPriorTeamSnapshot = currentState?.signingPriorTeamSnapshot;

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
  if (offerSheetCreationSnapshots) {
    normalized.offerSheetCreationSnapshots = offerSheetCreationSnapshots;
  }
  if (signingTeamSnapshot) normalized.signingTeamSnapshot = signingTeamSnapshot;
  if (signingPlayerSnapshot) {
    normalized.signingPlayerSnapshot = signingPlayerSnapshot;
  }
  if (signingPriorTeamSnapshot) {
    normalized.signingPriorTeamSnapshot = signingPriorTeamSnapshot;
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
  if (currentState?.offerSheetResolutionSnapshots) {
    normalized.offerSheetResolutionSnapshots =
      currentState.offerSheetResolutionSnapshots;
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
