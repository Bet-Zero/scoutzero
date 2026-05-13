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
const CURRENT_STATE_BASE_TEAM_ROSTER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Roster`;
const CURRENT_STATE_BASE_TEAM_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}Exceptions`;
const CURRENT_STATE_BASE_TEAM_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}OfferSheets`;
const CURRENT_STATE_BASE_TEAM_INCOMING_OFFER_SHEETS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}IncomingOfferSheets`;
const CURRENT_STATE_BASE_TEAM_TRADE_EXCEPTIONS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}TradeExceptions`;
const CURRENT_STATE_BASE_TEAM_CASH_LEDGER_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}CashLedger`;
const CURRENT_STATE_BASE_TEAM_EXCEPTION_HISTORY_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}ExceptionHistory`;
const CURRENT_STATE_BASE_TEAM_DRAFT_PICKS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}DraftPicks`;
const CURRENT_STATE_BASE_TEAM_ENTITLEMENT_IDS_FIELD_KEY = `${CURRENT_STATE_BASE_TEAM_PRESERVED_FIELD_KEY}EntitlementIds`;

// ==============================================================================
// PLAYER CONTRACT KEY CONSTANTS (duplicated from mutationPipeline.ts — cannot
// use runtime import due to circular dep; values are const arrays so safe to copy)
// ==============================================================================

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


// ==============================================================================
// WRITES SUMMARY CONSTANT
// ==============================================================================

const EMPTY_WRITES_SUMMARY = Object.freeze({
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

function asLooseRecord(value: unknown): LooseRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LooseRecord;
  }

  return null;
}


function normalizeCurrentStateTeamSource(
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


function removeUndefinedDeep(obj: unknown): unknown {
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


function toTradeStateSlice(
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


function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}


function toOptionalIdString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalTrimmedString(value);
}


function toOptionalNumber(value: unknown): number | undefined {
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


function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}


function toOptionalBooleanOrNull(value: unknown): boolean | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalBoolean(value);
}


function toOptionalNumberishOrNull(
  value: unknown
): number | string | null | undefined {
  if (value === null) {
    return null;
  }

  return toOptionalNumberish(value);
}


function toOptionalContractDateLikeOrNull(
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


function toOptionalNumberish(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}


function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toOptionalIdString(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}


function toOptionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalNumber(value);
}


function toOptionalTrimmedStringOrNull(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalTrimmedString(value);
}


// ==============================================================================
// PLAYER BIO / CONTRACT NORMALIZERS
// ==============================================================================

function normalizeCurrentStatePlayerBioDisplay(
  value: unknown
): CurrentStatePlayerBioDisplay | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDisplay = {};
  const freeAgentType = toOptionalTrimmedString(record.freeAgentType);
  const freeAgentYear = toOptionalNumberish(record.freeAgentYear);
  const team = toOptionalTrimmedString(record.team);
  const teamId = toOptionalTrimmedString(record.teamId);
  const yearsPro = toOptionalNumberish(record.yearsPro);

  if (freeAgentType !== undefined) {
    normalized.freeAgentType = freeAgentType;
  }
  if (freeAgentYear !== undefined) {
    normalized.freeAgentYear = freeAgentYear;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBioDraft(
  value: unknown
): CurrentStatePlayerBioDraft | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDraft = {};
  const year = toOptionalNumber(record.year);
  const round = toOptionalNumber(record.round);
  const pick = toOptionalNumber(record.pick);
  const teamId = toOptionalTrimmedString(record.teamId);

  if (year !== undefined) {
    normalized.year = year;
  }
  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBio(
  value: MutationPlayerBioLike | null | undefined
): CurrentStatePlayerBio | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBio = {};
  const displayName = toOptionalTrimmedString(record.displayName);
  const playerId = toOptionalIdString(record.playerId);
  const name = toOptionalTrimmedString(record.name);
  const position = toOptionalTrimmedString(record.position);
  const age = toOptionalNumber(record.age);
  const height = toOptionalNumberish(record.height);
  const weight = toOptionalNumberish(record.weight);
  const dob = toOptionalTrimmedString(record.dob);
  const birthplace = toOptionalTrimmedString(record.birthplace);
  const nationality = toOptionalTrimmedString(record.nationality);
  const shoots = toOptionalTrimmedString(record.shoots);
  const agentRecord = asLooseRecord(record.agent);
  const draft = normalizeCurrentStatePlayerBioDraft(record.draft);
  const display = normalizeCurrentStatePlayerBioDisplay(record.display);
  const nbaId = toOptionalNumber(record.nbaId);
  const experience = toOptionalNumberish(record.experience);
  const yearsExperience = toOptionalNumberish(record.yearsExperience);
  const yearsPro = toOptionalNumberish(record.yearsPro);
  const team = toOptionalTrimmedString(record.team);
  const draftYear = toOptionalNumberish(record.draftYear);
  const draftRound = toOptionalNumber(record.draftRound);
  const draftPick = toOptionalNumberish(record.draftPick);
  const legacyYearsPro = toOptionalNumberish(record['Years Pro']);

  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (position !== undefined) {
    normalized.position = position;
  }
  if (age !== undefined) {
    normalized.age = age;
  }
  if (height !== undefined) {
    normalized.height = height;
  }
  if (weight !== undefined) {
    normalized.weight = weight;
  }
  if (dob !== undefined) {
    normalized.dob = dob;
  }
  if (birthplace !== undefined) {
    normalized.birthplace = birthplace;
  }
  if (nationality !== undefined) {
    normalized.nationality = nationality;
  }
  if (shoots !== undefined) {
    normalized.shoots = shoots;
  }
  if (agentRecord) {
    normalized.agent = {
      name: toOptionalTrimmedString(agentRecord.name) ?? null,
      agency: toOptionalTrimmedString(agentRecord.agency) ?? null,
    };
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (display !== undefined) {
    normalized.display = display;
  }
  if (nbaId !== undefined) {
    normalized.nbaId = nbaId;
  }
  if (experience !== undefined) {
    normalized.experience = experience;
  }
  if (yearsExperience !== undefined) {
    normalized.yearsExperience = yearsExperience;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (draftYear !== undefined) {
    normalized.draftYear = draftYear;
  }
  if (draftRound !== undefined) {
    normalized.draftRound = draftRound;
  }
  if (draftPick !== undefined) {
    normalized.draftPick = draftPick;
  }
  if (legacyYearsPro !== undefined) {
    normalized['Years Pro'] = legacyYearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerBirdRights(
  value: ArchitectMutationPlayerRecord['birdRights']
): ArchitectMutationBirdRights | string | undefined {
  if (typeof value === 'string') {
    return toOptionalTrimmedString(value);
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationBirdRights = {};
  const status = toOptionalTrimmedString(record.status);
  const type = toOptionalTrimmedString(record.type);
  const yearsOfService = toOptionalNumberish(record.yearsOfService);
  const yearsWithTeam = toOptionalNumberish(record.yearsWithTeam);
  const eligibleFor = normalizeStringArray(record.eligibleFor);
  const renounced = toOptionalBoolean(record.renounced);

  if (status !== undefined) {
    normalized.status = status;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractBirdRights(
  value: MutationCurrentStatePlayerContractIngress['birdRights']
): ArchitectMutationBirdRights | undefined {
  const normalizedBirdRights = normalizeCurrentStatePlayerBirdRights(value);

  if (!normalizedBirdRights) {
    return undefined;
  }

  if (typeof normalizedBirdRights === 'string') {
    return { status: normalizedBirdRights };
  }

  return normalizedBirdRights;
}

function normalizeCurrentStatePlayerContractIncentives(
  value: ArchitectMutationContractIncentives | null | undefined
): CurrentStatePlayerContractIncentives | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractIncentives = {};
  const likely = toOptionalNumberOrNull(record.likely);
  const unlikely = toOptionalNumberOrNull(record.unlikely);

  if (likely !== undefined) {
    normalized.likely = likely;
  }
  if (unlikely !== undefined) {
    normalized.unlikely = unlikely;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractGuaranteeScheduleEntry(
  value: ArchitectMutationGuaranteeScheduleEntry | null | undefined
): CurrentStatePlayerContractGuaranteeScheduleEntry | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractGuaranteeScheduleEntry = {};
  const effectiveDate = toOptionalTrimmedStringOrNull(record.effectiveDate);
  const guaranteedAmount = toOptionalNumberOrNull(record.guaranteedAmount);
  const status = toOptionalTrimmedStringOrNull(record.status);
  const note = toOptionalTrimmedStringOrNull(record.note);

  if (effectiveDate !== undefined) {
    normalized.effectiveDate = effectiveDate;
  }
  if (guaranteedAmount !== undefined) {
    normalized.guaranteedAmount = guaranteedAmount;
  }
  if (status !== undefined) {
    normalized.status = status;
  }
  if (note !== undefined) {
    normalized.note = note;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractGuaranteeSchedule(
  value: ArchitectMutationGuaranteeScheduleEntry[] | null | undefined
): CurrentStatePlayerContractGuaranteeScheduleEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) =>
      normalizeCurrentStatePlayerContractGuaranteeScheduleEntry(entry)
    )
    .filter(
      (entry): entry is CurrentStatePlayerContractGuaranteeScheduleEntry =>
        entry !== undefined
    );
}

function normalizeCurrentStatePlayerContractTradeEligibilityRules(
  value: unknown
): CurrentStatePlayerContractTradeEligibilityRules | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractTradeEligibilityRules = {};
  const baseYearCompensation = toOptionalBooleanOrNull(
    record.baseYearCompensation
  );
  const poisonPill = toOptionalBooleanOrNull(record.poisonPill);
  const aggregation = toOptionalBooleanOrNull(record.aggregation);

  if (baseYearCompensation !== undefined) {
    normalized.baseYearCompensation = baseYearCompensation;
  }
  if (poisonPill !== undefined) {
    normalized.poisonPill = poisonPill;
  }
  if (aggregation !== undefined) {
    normalized.aggregation = aggregation;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractTradeEligibility(
  value: unknown
): CurrentStatePlayerContractTradeEligibility | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractTradeEligibility = {};
  const canBeTradedNow = toOptionalBooleanOrNull(record.canBeTradedNow);
  const restrictedUntil = toOptionalTrimmedStringOrNull(record.restrictedUntil);
  const reason = toOptionalTrimmedStringOrNull(record.reason);
  const rules = normalizeCurrentStatePlayerContractTradeEligibilityRules(
    record.rules
  );

  if (canBeTradedNow !== undefined) {
    normalized.canBeTradedNow = canBeTradedNow;
  }
  if (restrictedUntil !== undefined) {
    normalized.restrictedUntil = restrictedUntil;
  }
  if (reason !== undefined) {
    normalized.reason = reason;
  }
  if (rules !== undefined) {
    normalized.rules = rules;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractFreeAgency(
  value: ArchitectMutationContract['freeAgency'] | undefined
): CurrentStatePlayerContractFreeAgency | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asLooseRecord(
    normalizeFreeAgency(value as Parameters<typeof normalizeFreeAgency>[0])
  );
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerContractFreeAgency = {};
  const type = toOptionalTrimmedStringOrNull(record.type);
  const year = toOptionalNumberishOrNull(record.year);
  const capHold = toOptionalNumberOrNull(record.capHold);
  const qualifyingOffer = toOptionalNumberOrNull(record.qualifyingOffer);
  const earlyTerminationOption =
    typeof record.earlyTerminationOption === 'boolean'
      ? record.earlyTerminationOption
      : toOptionalTrimmedStringOrNull(record.earlyTerminationOption);
  const hasOption = toOptionalBooleanOrNull(record.hasOption);
  const optionYear = toOptionalNumberishOrNull(record.optionYear);
  const optionType = toOptionalTrimmedStringOrNull(record.optionType);

  if (type !== undefined) {
    normalized.type = type;
  }
  if (year !== undefined) {
    normalized.year = year;
  }
  if (capHold !== undefined) {
    normalized.capHold = capHold;
  }
  if (qualifyingOffer !== undefined) {
    normalized.qualifyingOffer = qualifyingOffer;
  }
  if (earlyTerminationOption !== undefined) {
    normalized.earlyTerminationOption = earlyTerminationOption;
  }
  if (hasOption !== undefined) {
    normalized.hasOption = hasOption;
  }
  if (optionYear !== undefined) {
    normalized.optionYear = optionYear;
  }
  if (optionType !== undefined) {
    normalized.optionType = optionType;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerContractSalaryRow(
  value: MutationCurrentStatePlayerContractSalaryRowIngress | null | undefined
): CurrentStatePlayerContractSalaryRow | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }
  const salaryRow =
    record as Partial<MutationCurrentStatePlayerContractSalaryRowIngress>;

  const projectedRow: MutationCurrentStatePlayerContractSalaryRowIngress = {};
  const year = toOptionalNumberOrNull(salaryRow.year);
  const season =
    toOptionalTrimmedStringOrNull(salaryRow.season) ??
    (typeof year === 'number' ? toSeasonCode(year) : undefined);
  const salary = toOptionalNumberOrNull(salaryRow.salary);
  const capHit = toOptionalNumberOrNull(salaryRow.capHit);
  const guaranteed = toOptionalBooleanOrNull(salaryRow.guaranteed);
  const guaranteedAmount = toOptionalNumberOrNull(salaryRow.guaranteedAmount);
  const option = toOptionalTrimmedStringOrNull(salaryRow.option);
  const optionType = toOptionalTrimmedStringOrNull(salaryRow.optionType);
  const optionUsed = Object.prototype.hasOwnProperty.call(
    salaryRow,
    'optionUsed'
  )
    ? normalizeOptionUsed(salaryRow.optionUsed)
    : undefined;
  const optionDecisionDate = toOptionalTrimmedStringOrNull(
    salaryRow.optionDecisionDate
  );
  const tradeBonus = toOptionalNumberOrNull(salaryRow.tradeBonus);
  const incentives = normalizeCurrentStatePlayerContractIncentives(
    salaryRow.incentives
  );
  const guaranteeSchedule =
    normalizeCurrentStatePlayerContractGuaranteeSchedule(
      salaryRow.guaranteeSchedule
    );
  const voidedByExtension = toOptionalBooleanOrNull(
    salaryRow.voidedByExtension
  );
  const voidedOn = toOptionalTrimmedStringOrNull(salaryRow.voidedOn);
  const isExtensionSeason = toOptionalBooleanOrNull(
    salaryRow.isExtensionSeason
  );

  if (year !== undefined) {
    projectedRow.year = year;
  }
  if (salary !== undefined) {
    projectedRow.salary = salary;
  }
  if (capHit !== undefined) {
    projectedRow.capHit = capHit;
  }
  if (guaranteed !== undefined) {
    projectedRow.guaranteed = guaranteed;
  }
  if (guaranteedAmount !== undefined) {
    projectedRow.guaranteedAmount = guaranteedAmount;
  }
  if (option !== undefined) {
    projectedRow.option = option;
  }
  if (optionType !== undefined) {
    projectedRow.optionType = optionType;
  }
  if (optionUsed !== undefined) {
    projectedRow.optionUsed = optionUsed;
  }
  if (optionDecisionDate !== undefined) {
    projectedRow.optionDecisionDate = optionDecisionDate;
  }
  if (tradeBonus !== undefined) {
    projectedRow.tradeBonus = tradeBonus;
  }
  if (incentives !== undefined) {
    projectedRow.incentives = incentives;
  }
  if (guaranteeSchedule !== undefined) {
    projectedRow.guaranteeSchedule = guaranteeSchedule;
  }
  if (voidedByExtension !== undefined) {
    projectedRow.voidedByExtension = voidedByExtension;
  }
  if (voidedOn !== undefined) {
    projectedRow.voidedOn = voidedOn;
  }
  if (isExtensionSeason !== undefined) {
    projectedRow.isExtensionSeason = isExtensionSeason;
  }

  if (season === undefined) {
    return undefined;
  }

  projectedRow.season = season;

  if (Object.keys(projectedRow).length === 0) {
    return undefined;
  }

  return normalizeSalaryRow(
    projectedRow
  ) as CurrentStatePlayerContractSalaryRow;
}

function normalizeCurrentStatePlayerContractSalaryRows(
  value:
    | MutationCurrentStatePlayerContractIngress['salariesByYear']
    | MutationCurrentStatePlayerFutureContractIngress['salariesByYear']
): CurrentStatePlayerContractSalaryRow[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStatePlayerContractSalaryRow(entry))
    .filter(
      (entry): entry is CurrentStatePlayerContractSalaryRow =>
        entry !== undefined
    );
}

type CurrentStatePlayerContractLane = 'current' | 'future';

function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerContractIngress | null | undefined,
  lane: 'current'
): MutationCurrentStatePlayerContractIngress | undefined;
function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerFutureContractIngress | null | undefined,
  lane: 'future'
): MutationCurrentStatePlayerFutureContractIngress | undefined;
function projectCurrentStatePlayerContractIngress(
  value:
    | MutationCurrentStatePlayerContractIngress
    | MutationCurrentStatePlayerFutureContractIngress
    | null
    | undefined,
  lane: CurrentStatePlayerContractLane
):
  | MutationCurrentStatePlayerContractIngress
  | MutationCurrentStatePlayerFutureContractIngress
  | undefined {
  // Current-state snapshots may still hand this seam raw world data or an
  // already-normalized contract. Mixed tolerance stays localized here and in
  // the small sub-normalizers below; committed compute only receives the
  // projected lane-specific slice.
  const contract = asLooseRecord(value);
  if (!contract) {
    return undefined;
  }
  const contractRecord = contract as Partial<
    MutationCurrentStatePlayerContractIngress &
      MutationCurrentStatePlayerFutureContractIngress
  >;

  const projected: MutationCurrentStatePlayerContractIngress = {};
  const salariesByYear = normalizeCurrentStatePlayerContractSalaryRows(
    contractRecord.salariesByYear
  );
  const years = toOptionalNumberOrNull(contractRecord.years);
  const startYear = toOptionalNumberOrNull(contractRecord.startYear);
  const year = toOptionalNumberOrNull(contractRecord.year);
  const birdRights = normalizeCurrentStatePlayerContractBirdRights(
    contractRecord.birdRights
  );
  const contractType = toOptionalTrimmedStringOrNull(
    contractRecord.contractType
  );
  const extension = toOptionalBooleanOrNull(contractRecord.extension);
  const isExtension = toOptionalBooleanOrNull(contractRecord.isExtension);
  const isRookieScale = toOptionalBooleanOrNull(contractRecord.isRookieScale);
  const signingTeam = toOptionalTrimmedStringOrNull(contractRecord.signingTeam);
  const signingDate = toOptionalContractDateLikeOrNull(
    contractRecord.signingDate
  );
  const signedAt = toOptionalContractDateLikeOrNull(contractRecord.signedAt);
  const extensionSignedAt = toOptionalContractDateLikeOrNull(
    contractRecord.extensionSignedAt
  );
  const signedUsing = toOptionalTrimmedStringOrNull(contractRecord.signedUsing);
  const exceptionType = toOptionalTrimmedStringOrNull(
    contractRecord.exceptionType
  );
  const contractYears = toOptionalNumberOrNull(contractRecord.contractYears);
  const firstYearGuaranteed = toOptionalBooleanOrNull(
    contractRecord.firstYearGuaranteed
  );
  const rfaOfferSheet = toOptionalBooleanOrNull(contractRecord.rfaOfferSheet);
  const rfaOfferSheetOnly = toOptionalBooleanOrNull(
    contractRecord.rfaOfferSheetOnly
  );
  const yearsRemaining = toOptionalNumberOrNull(contractRecord.yearsRemaining);
  const contractLength = toOptionalNumberOrNull(contractRecord.contractLength);
  const originalLength = toOptionalNumberOrNull(contractRecord.originalLength);
  const totalValue = toOptionalNumberOrNull(contractRecord.totalValue);
  const averageAnnualValue = toOptionalNumberOrNull(
    contractRecord.averageAnnualValue
  );
  const guaranteedValue = toOptionalNumberOrNull(
    contractRecord.guaranteedValue
  );
  const guaranteedYears = toOptionalNumberOrNull(
    contractRecord.guaranteedYears
  );
  const freeAgency = normalizeCurrentStatePlayerContractFreeAgency(
    contractRecord.freeAgency
  );
  const includeOfferSheetState = lane === 'current';
  const includeCurrentOnlyContractFields = lane === 'current';
  const rfaOfferSheetStatus = includeOfferSheetState
    ? toOptionalTrimmedStringOrNull(contractRecord.rfaOfferSheetStatus)
    : undefined;
  const firstYearSalary = toOptionalNumberOrNull(
    contractRecord.firstYearSalary
  );
  const year1Salary = toOptionalNumberOrNull(contractRecord.year1Salary);
  const signingExecutive = toOptionalTrimmedStringOrNull(
    contractRecord.signingExecutive
  );
  const startSeason = toOptionalTrimmedStringOrNull(contractRecord.startSeason);
  const endSeason = toOptionalTrimmedStringOrNull(contractRecord.endSeason);
  const noTradeClause = toOptionalBooleanOrNull(contractRecord.noTradeClause);
  const tradeKicker = toOptionalNumberOrNull(contractRecord.tradeKicker);
  const tradeRestrictions = normalizeStringArray(
    contractRecord.tradeRestrictions
  );
  const tradeEligibility = normalizeCurrentStatePlayerContractTradeEligibility(
    contractRecord.tradeEligibility
  );

  if (salariesByYear !== undefined) {
    projected.salariesByYear = salariesByYear;
  }
  if (includeCurrentOnlyContractFields && years !== undefined) {
    projected.years = years;
  }
  if (includeCurrentOnlyContractFields && startYear !== undefined) {
    projected.startYear = startYear;
  }
  if (includeCurrentOnlyContractFields && year !== undefined) {
    projected.year = year;
  }
  if (includeCurrentOnlyContractFields && birdRights !== undefined) {
    projected.birdRights = birdRights;
  }
  if (contractType !== undefined) {
    projected.contractType = contractType;
  }
  if (extension !== undefined) {
    projected.extension = extension;
  }
  if (isExtension !== undefined) {
    projected.isExtension = isExtension;
  }
  if (includeCurrentOnlyContractFields && isRookieScale !== undefined) {
    projected.isRookieScale = isRookieScale;
  }
  if (includeCurrentOnlyContractFields && signingTeam !== undefined) {
    projected.signingTeam = signingTeam;
  }
  if (signingDate !== undefined) {
    projected.signingDate = signingDate;
  }
  if (signedAt !== undefined) {
    projected.signedAt = signedAt;
  }
  if (extensionSignedAt !== undefined) {
    projected.extensionSignedAt = extensionSignedAt;
  }
  if (signedUsing !== undefined) {
    projected.signedUsing = signedUsing;
  }
  if (includeCurrentOnlyContractFields && exceptionType !== undefined) {
    projected.exceptionType = exceptionType;
  }
  if (includeCurrentOnlyContractFields && contractYears !== undefined) {
    projected.contractYears = contractYears;
  }
  if (includeCurrentOnlyContractFields && firstYearGuaranteed !== undefined) {
    projected.firstYearGuaranteed = firstYearGuaranteed;
  }
  if (includeOfferSheetState && rfaOfferSheet !== undefined) {
    projected.rfaOfferSheet = rfaOfferSheet;
  }
  if (includeOfferSheetState && rfaOfferSheetOnly !== undefined) {
    projected.rfaOfferSheetOnly = rfaOfferSheetOnly;
  }
  if (yearsRemaining !== undefined) {
    projected.yearsRemaining = yearsRemaining;
  }
  if (contractLength !== undefined) {
    projected.contractLength = contractLength;
  }
  if (includeCurrentOnlyContractFields && originalLength !== undefined) {
    projected.originalLength = originalLength;
  }
  if (totalValue !== undefined) {
    projected.totalValue = totalValue;
  }
  if (averageAnnualValue !== undefined) {
    projected.averageAnnualValue = averageAnnualValue;
  }
  if (guaranteedValue !== undefined) {
    projected.guaranteedValue = guaranteedValue;
  }
  if (guaranteedYears !== undefined) {
    projected.guaranteedYears = guaranteedYears;
  }
  if (freeAgency !== undefined) {
    projected.freeAgency = freeAgency;
  }
  if (rfaOfferSheetStatus !== undefined) {
    projected.rfaOfferSheetStatus = rfaOfferSheetStatus;
  }
  if (includeCurrentOnlyContractFields && firstYearSalary !== undefined) {
    projected.firstYearSalary = firstYearSalary;
  }
  if (includeCurrentOnlyContractFields && year1Salary !== undefined) {
    projected.year1Salary = year1Salary;
  }
  if (signingExecutive !== undefined) {
    projected.signingExecutive = signingExecutive;
  }
  if (startSeason !== undefined) {
    projected.startSeason = startSeason;
  }
  if (endSeason !== undefined) {
    projected.endSeason = endSeason;
  }
  if (noTradeClause !== undefined) {
    projected.noTradeClause = noTradeClause;
  }
  if (tradeKicker !== undefined) {
    projected.tradeKicker = tradeKicker;
  }
  if (tradeRestrictions !== undefined) {
    projected.tradeRestrictions = tradeRestrictions;
  }
  if (includeCurrentOnlyContractFields && tradeEligibility !== undefined) {
    projected.tradeEligibility = tradeEligibility;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function pickCurrentStatePlayerContractSlice<
  TKey extends keyof ArchitectMutationContract,
>(
  contract: Partial<ArchitectMutationContract> | null | undefined,
  keys: readonly TKey[]
): Pick<ArchitectMutationContract, TKey> | undefined {
  if (!contract) {
    return undefined;
  }

  const normalized: Partial<Pick<ArchitectMutationContract, TKey>> = {};

  for (const key of keys) {
    const value = contract[key];
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0
    ? (normalized as Pick<ArchitectMutationContract, TKey>)
    : undefined;
}

function normalizeCurrentStatePlayerContract(
  value: MutationCurrentStatePlayerContractIngress | null | undefined
): CurrentStatePlayerContract | undefined {
  const contract = projectCurrentStatePlayerContractIngress(value, 'current');
  if (!contract) {
    return undefined;
  }

  const normalizedContract = normalizeContractForWorld(
    contract
  ) as ArchitectMutationContract | null;

  return pickCurrentStatePlayerContractSlice(
    normalizedContract,
    CURRENT_STATE_PLAYER_CONTRACT_KEYS
  );
}

function normalizeCurrentStatePlayerFutureContract(
  value: MutationCurrentStatePlayerFutureContractIngress | null | undefined
): CurrentStatePlayerFutureContract | undefined {
  const contract = projectCurrentStatePlayerContractIngress(value, 'future');
  if (!contract) {
    return undefined;
  }

  const normalizedContract = normalizeFutureContract(
    contract
  ) as ArchitectMutationContract | null;

  return pickCurrentStatePlayerContractSlice(
    normalizedContract,
    CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS
  );
}

function normalizeCurrentStatePlayerRepresentation(
  value: ArchitectMutationPlayerRecord['representation']
): BasePlayerDoc['representation'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<BasePlayerDoc['representation']> = {
    agent: null,
    agency: null,
  };
  let hasRepresentationField = false;
  const agent = toOptionalTrimmedString(record.agent);
  const agency = toOptionalTrimmedString(record.agency);

  if (agent !== undefined) {
    normalized.agent = agent;
    hasRepresentationField = true;
  }
  if (agency !== undefined) {
    normalized.agency = agency;
    hasRepresentationField = true;
  }

  return hasRepresentationField ? normalized : undefined;
}

function normalizeCurrentStatePlayerSource(
  value: string | MutationPlayerSourceLike | null | undefined
): MutationPlayerSourceLike | undefined {
  if (typeof value === 'string') {
    const provider = toOptionalTrimmedString(value);
    return provider ? { provider } : undefined;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<MutationPlayerSourceLike> = {};
  const provider = toOptionalTrimmedString(record.provider);
  const teamPageUrl = toOptionalTrimmedString(record.teamPageUrl);
  const playerPageUrl = toOptionalTrimmedString(record.playerPageUrl);
  const scrapedAt = toOptionalTrimmedString(record.scrapedAt);
  const season = toOptionalTrimmedString(record.season);
  const type = toOptionalTrimmedString(record.type);
  const worldId = toOptionalTrimmedString(record.worldId);
  const generatedAt = toOptionalTrimmedString(record.generatedAt);
  const baseTeamVersion = toOptionalTrimmedString(record.baseTeamVersion);

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

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerOverridePersistenceSidecar(
  player: CurrentStatePlayerOverridePersistenceIngress | null | undefined
): CurrentStatePlayerOverridePersistenceSidecar {
  const normalized: CurrentStatePlayerOverridePersistenceSidecar = {};
  const representation = normalizeCurrentStatePlayerRepresentation(
    player?.representation
  );
  const source = normalizeCurrentStatePlayerSource(player?.source);
  const lastUpdated = toOptionalTrimmedString(player?.lastUpdated);
  const version = toOptionalTrimmedString(player?.version);
  const isTwoWay = toOptionalBoolean(player?.isTwoWay);
  const signedDate = toOptionalTrimmedString(player?.signedDate);

  if (representation !== undefined) {
    normalized.representation = representation;
  }
  if (source !== undefined) {
    normalized.source = source;
  }
  if (lastUpdated !== undefined) {
    normalized.lastUpdated = lastUpdated;
  }
  if (version !== undefined) {
    normalized.version = version;
  }
  if (isTwoWay !== undefined) {
    normalized.isTwoWay = isTwoWay;
  }
  if (signedDate !== undefined) {
    normalized.signedDate = signedDate;
  }

  return normalized;
}


// ==============================================================================
// PLAYER SNAPSHOT BUILDERS
// ==============================================================================

function normalizeCurrentStatePlayerDraft(
  value: ArchitectMutationPlayerRecord['draft']
): NormalizedCurrentStatePlayer['draft'] | undefined {
  const draftRecord = asLooseRecord(value);
  if (!draftRecord) {
    return undefined;
  }

  const normalized: NonNullable<NormalizedCurrentStatePlayer['draft']> = {};
  const round = toOptionalNumber(draftRecord.round);
  const pick = toOptionalNumber(draftRecord.pick);

  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCurrentStatePlayerRfaContext(
  value:
    | ArchitectMutationPlayerRfaContextIngress
    | CurrentStatePlayerRfaContext
    | null
    | undefined
): CurrentStatePlayerRfaContext | undefined {
  const context = asLooseRecord(value);
  if (!context) {
    return undefined;
  }

  const normalized: CurrentStatePlayerRfaContext = {};
  const pendingHomeTeamCode = toOptionalTrimmedString(
    context.pendingHomeTeamCode
  );
  const offerSheetId = toOptionalTrimmedString(context.offerSheetId);
  const retainedUntilFinalize = toOptionalBoolean(
    context.retainedUntilFinalize
  );

  if (pendingHomeTeamCode !== undefined) {
    normalized.pendingHomeTeamCode = pendingHomeTeamCode;
  }
  if (offerSheetId !== undefined) {
    normalized.offerSheetId = offerSheetId;
  }
  if (retainedUntilFinalize !== undefined) {
    normalized.retainedUntilFinalize = retainedUntilFinalize;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export type CurrentStatePlayerRfaBoundaryIngress = Pick<
  MutationCurrentStatePlayerIngress,
  | 'rfaOfferSheet'
  | 'rfaOfferSheetOnly'
  | 'rfaContext'
  | 'isNewlySignedFA'
  | 'originTeamId'
>;

function normalizeCurrentStatePlayerRfaBoundary(
  player: CurrentStatePlayerRfaBoundaryIngress | null | undefined
): CurrentStatePlayerRfaBoundary {
  const normalized: CurrentStatePlayerRfaBoundary = {};
  const rfaOfferSheet = toOptionalBoolean(player?.rfaOfferSheet);
  const rfaOfferSheetOnly = toOptionalBoolean(player?.rfaOfferSheetOnly);
  const rfaContext = normalizeCurrentStatePlayerRfaContext(player?.rfaContext);
  const isNewlySignedFA = toOptionalBoolean(player?.isNewlySignedFA);
  const originTeamId = toOptionalTrimmedString(player?.originTeamId);

  if (rfaOfferSheet !== undefined) {
    normalized.rfaOfferSheet = rfaOfferSheet;
  }
  if (rfaOfferSheetOnly !== undefined) {
    normalized.rfaOfferSheetOnly = rfaOfferSheetOnly;
  }
  if (rfaContext !== undefined) {
    normalized.rfaContext = rfaContext;
  }
  if (isNewlySignedFA !== undefined) {
    normalized.isNewlySignedFA = isNewlySignedFA;
  }
  if (originTeamId !== undefined) {
    normalized.originTeamId = originTeamId;
  }

  return normalized;
}

function buildCurrentStatePlayerSnapshot(
  playerRecord: CurrentStatePlayerBoundaryInput
): PlayerLike {
  const normalized: PlayerLike = {};
  const bio = normalizeCurrentStatePlayerBio(playerRecord.bio);
  const bioPlayerId = toOptionalIdString(bio?.playerId);
  const bioDisplayName = toOptionalTrimmedString(bio?.displayName);
  const playerId = toOptionalIdString(playerRecord.player_id) ?? bioPlayerId;
  const id = toOptionalIdString(playerRecord.id) ?? bioPlayerId;
  const playerIdAlias =
    toOptionalIdString(playerRecord.playerId) ?? bioPlayerId;
  const name = toOptionalTrimmedString(playerRecord.name);
  const displayName =
    toOptionalTrimmedString(playerRecord.displayName) ?? name ?? bioDisplayName;
  const playerName = toOptionalTrimmedString(playerRecord.playerName);
  const teamCode = toOptionalTrimmedString(playerRecord.teamCode);
  const teamName = toOptionalTrimmedString(playerRecord.teamName);
  const contract = normalizeCurrentStatePlayerContract(playerRecord.contract);
  const futureContract = normalizeCurrentStatePlayerFutureContract(
    playerRecord.futureContract
  );
  const draft = normalizeCurrentStatePlayerDraft(playerRecord.draft);
  const birdRights = normalizeCurrentStatePlayerBirdRights(
    playerRecord.birdRights
  );
  const renounced = toOptionalBoolean(playerRecord.renounced);
  const persistenceSidecar =
    normalizeCurrentStatePlayerOverridePersistenceSidecar(playerRecord);
  const rfaBoundary = normalizeCurrentStatePlayerRfaBoundary(playerRecord);

  if (playerId !== undefined) {
    normalized.player_id = playerId;
  }
  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerIdAlias !== undefined) {
    normalized.playerId = playerIdAlias;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (teamName !== undefined) {
    normalized.teamName = teamName;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (bio !== undefined) {
    normalized.bio = bio;
  }
  if (contract !== undefined) {
    normalized.contract = contract;
  }
  if (futureContract !== undefined) {
    normalized.futureContract = futureContract;
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (birdRights !== undefined) {
    normalized.birdRights = birdRights;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }
  Object.assign(normalized, persistenceSidecar, rfaBoundary);

  return normalized;
}

// Raw player overrides and loaded player snapshots normalize here before they
// reach family-owned current-state compatibility handling.
function toCurrentStatePlayer(
  player: MutationCurrentStatePlayerIngress | null | undefined
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}

// Mixed raw/direct-compute player compatibility is tolerated only where
// current-state ingress or persistence round-trips still truthfully need it.
function normalizeCurrentStatePlayerSnapshot(
  player: unknown
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}


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

function materializeCurrentStateBaseTeamPreservedFields<
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


function toMutationExceptionPreserveOnlyBuckets(
  value: unknown
): MutationExceptionPreserveOnlyBuckets | null {
  return asLooseRecord(value) as MutationExceptionPreserveOnlyBuckets | null;
}

function normalizeMutationExceptionsFromIngress(
  value: unknown
): ArchitectMutationExceptions {
  return normalizeCanonicalTeamExceptions({
    exceptions: toMutationExceptionPreserveOnlyBuckets(value) || null,
  });
}


function getMutationRosterEntryId(entry: unknown) {
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


function requireBasicTeamState<TCurrentState extends { team?: unknown | null }>(
  currentState: TCurrentState,
  mutationType: string
): CurrentStateWithBasicTeam<TCurrentState> {
  if (!currentState.team) {
    throw new Error(`${mutationType} current state missing team`);
  }

  return currentState as CurrentStateWithBasicTeam<TCurrentState>;
}

function requireBasicTeamAndPlayerState<
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

function requireSigningState<
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


function requireDestinationState(
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

function requireOfferSheetTeamState<
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
function getTeamSourceRecord(
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


function getSalaryRowEndYear(
  row: MutationPipelineSalaryRow | null | undefined
): number | null {
  const explicitYear = row?.year == null ? Number.NaN : Number(row.year);
  if (Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  return toEndYear(row?.season) ?? null;
}


function synchronizeTeamTotalsSnapshotOrTeam<
  T extends
    | CurrentStateTeamRoundTripMaterializable
    | ArchitectGeneralMutationCommittedTeamSnapshot,
>(team: T, year: number | null | undefined): T {
  if (typeof year !== 'number' || !Number.isFinite(year)) {
    return team;
  }

  return (synchronizeTeamTotalsSnapshot(team, year) || team) as T;
}


function cloneWritesSummary(
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


function getMutationPlayerId(
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

function findPlayerInTeamPlayers(
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

function toPersistablePlayerOverrideFromNormalizedPlayer(
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

function toPersistablePlayerOverrideFromSnapshot(
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

function buildCanonicalPlayerPersistenceManifest({
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

function buildTradePlayerPersistenceManifest({
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

