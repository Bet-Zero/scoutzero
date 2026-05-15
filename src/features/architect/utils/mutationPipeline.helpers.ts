/**
 * FILE: src/features/architect/utils/mutationPipeline.helpers.ts
 * PURPOSE: Shared utility functions for the mutation pipeline — extracted from mutationPipeline.ts (Wave 4 Step 4a.5).
 * These helpers are called from both the READ section and COMPUTE section, making them
 * ineligible to live in either read.ts or compute.ts exclusively.
 * OWNERSHIP: Feature: architect/core
 */
import { toEndYear, toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  synchronizeTeamTotalsSnapshot,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  normalizeCanonicalTeamExceptions,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import {
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';
import {
  normalizeFreeAgency,
  normalizeOptionUsed,
  normalizeSalaryRow,
  normalizeContractForWorld,
  normalizeFutureContract,
} from '@/features/architect/utils/contractNormalization';
import type { BasePlayerDoc } from '@/schemas/architect';
import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';

// Type-only imports from the pipeline (safe: import type is erased at runtime — no circular dep at runtime)
import type {
  LooseRecord,
  MutationTeamSourceLike,
  MutationSigningTeamLike,
  PlayerLike,
  ArchitectMutationExceptions,
  ArchitectMutationCanonicalExceptionBuckets,
  ArchitectMutationExceptionIngress,
  CurrentStateTeamRoundTripMaterializable,
  MaterializedCurrentStateTeam,
  CurrentStateBaseTeamPreservedCarrierLike,
  CurrentStateBaseTeamMaterializedPreservedFieldMap,
  ArchitectMutationPlayerRecord,
  TradeMutationPayload,
  ArchitectMutationTeamUpdate,
  PlayerUpdateLike,
  PlayerDeleteLike,
  ArchitectGeneralMutationCommittedTeamSnapshot,
  MutationSignAndTradeCurrentState,
  TradeTeamLike,
  MutationScalarId,
  MutationPlayerBioLike,
  MutationPlayerSourceLike,
  ArchitectMutationContractIncentives,
  ArchitectMutationGuaranteeScheduleEntry,
  NormalizedMutationContractIncentives,
  NormalizedMutationGuaranteeScheduleEntry,
  ArchitectMutationTradeEligibilityRules,
  ArchitectMutationTradeEligibility,
  ArchitectMutationFreeAgency,
  ArchitectMutationBirdRights,
  ArchitectMutationContract,
  NormalizedMutationSalaryRow,
  MutationCurrentStateContractDateLike,
  MutationCurrentStateContractNumberish,
  CurrentStatePlayerContractIncentives,
  CurrentStatePlayerContractGuaranteeScheduleEntry,
  CurrentStatePlayerContractTradeEligibilityRules,
  CurrentStatePlayerContractTradeEligibility,
  CurrentStatePlayerContractFreeAgency,
  MutationCurrentStatePlayerContractSalaryRowIngress,
  CurrentStatePlayerContractSalaryRow,
  MutationCurrentStatePlayerContractIngress,
  MutationCurrentStatePlayerFutureContractIngress,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  CurrentStatePlayerBioDisplay,
  CurrentStatePlayerBioDraft,
  CurrentStatePlayerBio,
  NormalizedCurrentStatePlayerDraft,
  CurrentStatePlayerRfaContext,
  CurrentStatePlayerOverridePersistenceSidecar,
  CurrentStatePlayerOverridePersistenceIngress,
  CurrentStatePlayerRfaBoundary,
  NormalizedCurrentStatePlayer,
  PersistablePlayerOverride,
  PersistablePlayerOverrideSource,
  MutationCurrentStatePlayerIngress,
  ArchitectMutationPlayerRfaContextIngress,
  CurrentStatePlayerBoundaryInput,
  OfferSheetTeamLike,
  ArchitectMutationWritesSummary,
  TradeStateSlice,
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
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
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


// ==============================================================================
// LOCAL UTILITY FUNCTIONS
// ==============================================================================

export function asLooseRecord(value: unknown): LooseRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LooseRecord;
  }

  return null;
}


export function normalizeCurrentStateTeamSource(
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


export function removeUndefinedDeep(obj: unknown): unknown {
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


export function toTradeStateSlice(
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


export function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}


export function toOptionalIdString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalTrimmedString(value);
}


export function toOptionalNumber(value: unknown): number | undefined {
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


export function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}


export function toOptionalBooleanOrNull(value: unknown): boolean | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalBoolean(value);
}


export function toOptionalNumberishOrNull(
  value: unknown
): number | string | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalNumberish(value);
}


export function toOptionalContractDateLikeOrNull(
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


export function toOptionalNumberish(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}


export function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toOptionalIdString(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}


export function toOptionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalNumber(value);
}


export function toOptionalTrimmedStringOrNull(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalTrimmedString(value);
}


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

type MutationPlayerIdCarrier = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'playerId' | 'id'
>;

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


export function requireBasicTeamState<TCurrentState extends { team?: unknown | null }>(
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
>(team: T, year: number | null | undefined): T {
  if (typeof year !== 'number' || !Number.isFinite(year)) {
    return team;
  }

  return (synchronizeTeamTotalsSnapshot(team, year) || team) as T;
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


export function getMutationPlayerId(
  player: MutationPlayerIdCarrier | null | undefined
) {
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


// ==============================================================================
// PLAYER PERSISTENCE HELPERS
// ==============================================================================

export function findPlayerInTeamPlayers(
  team: TeamLike | null | undefined,
  playerId: string
): PlayerLike | null {
  const players = Array.isArray(team?.players)
    ? team.players
        .map((player) => normalizeCurrentStatePlayerSnapshot(player))
        .filter((player): player is PlayerLike => player !== null)
    : [];
  return (
    players.find((player) => getMutationPlayerId(player) === playerId) || null
  );
}

export function toPersistablePlayerOverrideFromNormalizedPlayer(
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

export function toPersistablePlayerOverrideFromSnapshot(
  player: unknown
): PersistablePlayerOverride | null {
  const normalizedPlayer = normalizeCurrentStatePlayerSnapshot(player);
  if (!normalizedPlayer) {
    return null;
  }

  return toPersistablePlayerOverrideFromNormalizedPlayer(normalizedPlayer);
}

export type TradePlayerMoveCandidate = {
  playerId: string;
  sourceTeamCode: string;
  destinationTeamCode: string;
};

export type CanonicalPlayerPersistenceMode = 'replace' | 'move';

export type CanonicalPlayerPersistenceCandidate = {
  playerId: string;
  destinationTeamCode: string;
  sourceTeamCode?: string;
  mode: CanonicalPlayerPersistenceMode;
};

export function buildCanonicalPlayerPersistenceManifest({
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
  const uniqueCandidates = new Map<
    string,
    CanonicalPlayerPersistenceCandidate
  >();

  for (const candidate of candidates) {
    const playerId = String(candidate?.playerId || '').trim();
    const destinationTeamCode = String(
      candidate?.destinationTeamCode || ''
    ).trim();
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

    if (
      mode === 'replace' &&
      sourceTeamCode &&
      sourceTeamCode !== destinationTeamCode
    ) {
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
      (existing.destinationTeamCode !==
        normalizedCandidate.destinationTeamCode ||
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

    const finalPlayer = findPlayerInTeamPlayers(
      destinationTeam,
      candidate.playerId
    );
    if (!finalPlayer) {
      return {
        success: false,
        error: `${manifestLabel} could not find final destination snapshot player ${candidate.playerId} on ${candidate.destinationTeamCode}.`,
      };
    }

    if (
      normalizeTradeTeamCodeLike(finalPlayer.teamCode) !==
      candidate.destinationTeamCode
    ) {
      return {
        success: false,
        error: `${manifestLabel} found mismatched teamCode for player ${candidate.playerId} on destination ${candidate.destinationTeamCode}.`,
      };
    }

    const persistedPlayer =
      toPersistablePlayerOverrideFromSnapshot(finalPlayer);
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


// ==============================================================================
// COMPUTE-ONLY HELPERS (no read-section calls, but needed in helpers for PERSIST too)
// ==============================================================================

export function buildTradePlayerPersistenceManifest({
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

