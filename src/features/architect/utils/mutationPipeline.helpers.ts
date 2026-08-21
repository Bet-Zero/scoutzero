/**
 * FILE: src/features/architect/utils/mutationPipeline.helpers.ts
 * PURPOSE: Shared utility functions for the mutation pipeline — extracted from mutationPipeline.ts (Wave 4 Step 4a.5).
 * These helpers are called from both the READ section and COMPUTE section, making them
 * ineligible to live in either read.ts or compute.ts exclusively.
 * OWNERSHIP: Feature: architect/core
 */
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { normalizeCanonicalTeamExceptions } from '@/features/architect/utils/exceptions/exceptionOwnership';

// Type-only imports from the pipeline (safe: import type is erased at runtime — no circular dep at runtime)
import type {
  LooseRecord,
  MutationTeamSourceLike,
  MutationSigningTeamLike,
  PlayerLike,
  ArchitectMutationExceptions,
  CurrentStateTeamRoundTripMaterializable,
  MaterializedCurrentStateTeam,
  CurrentStateBaseTeamPreservedCarrierLike,
  CurrentStateBaseTeamMaterializedPreservedFieldMap,
  ArchitectGeneralMutationCommittedTeamSnapshot,
  MutationSignAndTradeCurrentState,
  TradeTeamLike,
  OfferSheetTeamLike,
  ArchitectMutationWritesSummary,
  MutationExceptionPreserveOnlyBuckets,
  TeamLike,
  MutationPipelineSalaryRow,
} from './mutationPipeline';

type WritesSummaryLike = ArchitectMutationWritesSummary;

// ==============================================================================
// PRESERVED FIELD KEY CONSTANTS
// ==============================================================================

export const CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY =
  '__currentStateBasePreserved';
export const CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Roster`;
export const CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Exceptions`;
export const CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}OfferSheets`;
export const CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}IncomingOfferSheets`;
export const CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}TradeExceptions`;
export const CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}CashLedger`;
export const CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}ExceptionHistory`;
export const CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}DraftPicks`;
export const CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}EntitlementIds`;

// ==============================================================================
// PLAYER CONTRACT KEY CONSTANTS (duplicated from mutationPipeline.ts — cannot
// use runtime import due to circular dep; values are const arrays so safe to copy)
// ==============================================================================

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

export const CURRENT_STATE_PLAYER_CONTRACT_KEYS = [
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
export const CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS = [
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

// ==============================================================================
// WRITES SUMMARY CONSTANT
// ==============================================================================

export const EMPTY_WRITES_SUMMARY = Object.freeze({
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

// Wave 22 Step 1: primitive coercions extracted to submodule
export * from './mutationPipeline.helpers.primitives';
import {
  asLooseRecord,
  normalizeCurrentStateTeamSource,
} from './mutationPipeline.helpers.primitives';

// Wave 8 Step 4: player normalizer stack extracted to submodule
export * from './mutationPipeline.helpers.playerNorm';
import {
  normalizeCurrentStatePlayerBioDisplay,
  normalizeCurrentStatePlayerBioDraft,
  normalizeCurrentStatePlayerBio,
  normalizeCurrentStatePlayerBirdRights,
  normalizeCurrentStatePlayerContractBirdRights,
  normalizeCurrentStatePlayerContractIncentives,
  normalizeCurrentStatePlayerContractGuaranteeScheduleEntry,
  normalizeCurrentStatePlayerContractGuaranteeSchedule,
  normalizeCurrentStatePlayerContractTradeEligibilityRules,
  normalizeCurrentStatePlayerContractTradeEligibility,
  normalizeCurrentStatePlayerContractFreeAgency,
  normalizeCurrentStatePlayerContractSalaryRow,
  normalizeCurrentStatePlayerContractSalaryRows,
  projectCurrentStatePlayerContractIngress,
  pickCurrentStatePlayerContractSlice,
  normalizeCurrentStatePlayerContract,
  normalizeCurrentStatePlayerFutureContract,
  normalizeCurrentStatePlayerRepresentation,
  normalizeCurrentStatePlayerSource,
  normalizeCurrentStatePlayerOverridePersistenceSidecar,
  normalizeCurrentStatePlayerDraft,
  normalizeCurrentStatePlayerRfaContext,
  normalizeCurrentStatePlayerRfaBoundary,
  buildCurrentStatePlayerSnapshot,
  toCurrentStatePlayer,
  normalizeCurrentStatePlayerSnapshot,
} from './mutationPipeline.helpers.playerNorm';

// Wave 22 Step 2: player persistence helpers extracted to submodule
export * from './mutationPipeline.helpers.persistence';

// ==============================================================================
// LOCAL TYPES
// ==============================================================================

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

type CurrentStateWithSigningPair<
  TCurrentState extends {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
  },
> = TCurrentState & {
  team: MutationSigningTeamLike;
  player: PlayerLike;
};

type CurrentStateWithDestination =
  CurrentStateWithSigningPair<MutationSignAndTradeCurrentState> & {
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

// ==============================================================================
// SHARED HELPERS (called from both READ and COMPUTE sections)
// ==============================================================================

export function materializeCurrentStateBaseTeamPreservedFields<
  T extends CurrentStateTeamRoundTripMaterializable,
>(team: T | null | undefined): MaterializedCurrentStateTeam<T> | null {
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
  if (exceptions !== undefined && materializedTeam.exceptions === undefined) {
    materializedTeam.exceptions = exceptions;
  }
  if (offerSheets !== undefined && materializedTeam.offerSheets === undefined) {
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

export function toMutationExceptionPreserveOnlyBuckets(
  value: unknown
): MutationExceptionPreserveOnlyBuckets | null {
  return asLooseRecord(value) as MutationExceptionPreserveOnlyBuckets | null;
}

export function normalizeMutationExceptionsFromIngress(
  value: unknown
): ArchitectMutationExceptions {
  return normalizeCanonicalTeamExceptions({
    exceptions: toMutationExceptionPreserveOnlyBuckets(value) || null,
  });
}

export function getMutationRosterEntryId(entry: unknown) {
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

export function requireBasicTeamState<
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

export function requireBasicTeamAndPlayerState<
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

export function requireSigningState<
  TCurrentState extends {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
  },
>(
  currentState: TCurrentState,
  mutationType: string
): CurrentStateWithSigningPair<TCurrentState> {
  if (!currentState.team) {
    throw new Error(`${mutationType} current state missing team`);
  }
  if (!currentState.player) {
    throw new Error(`${mutationType} current state missing player`);
  }

  return currentState as CurrentStateWithSigningPair<TCurrentState>;
}

export function requireDestinationState(
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

export function requireOfferSheetTeamState<
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
export function getTeamSourceRecord(
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

export function getSalaryRowEndYear(
  row: MutationPipelineSalaryRow | null | undefined
): number | null {
  const explicitYear = row?.year == null ? Number.NaN : Number(row.year);
  if (Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  return toEndYear(row?.season) ?? null;
}

export function synchronizeTeamTotalsSnapshotOrTeam<
  T extends
    | CurrentStateTeamRoundTripMaterializable
    | ArchitectGeneralMutationCommittedTeamSnapshot,
>(
  team: T,
  year: number | null | undefined,
  asOfDate: string | number | null | undefined = null
): T {
  if (typeof year !== 'number' || !Number.isFinite(year)) {
    return team;
  }

  return (
    synchronizeTeamTotalsSnapshot(team, year, {
      asOfDate: typeof asOfDate === 'string' ? asOfDate : null,
    }) || team
  ) as T;
}

export function cloneWritesSummary(
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
