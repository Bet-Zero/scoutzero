/**
 * FILE: src/features/architect/utils/mutationPipeline.read.dashboardNormalizers.ts
 * PURPOSE: Dashboard reload normalizers for dead cap, exceptions, offer sheets, contracts, and players.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 11 Step 1: Extracted from mutationPipeline.read.persistence.ts (L195–L805).
 * Wave 52 Step 1: Dead-cap and exception normalizers extracted to submodule.
 */

import {
  asLooseRecord,
  normalizeStringArray,
  removeUndefinedDeep,
  toOptionalBooleanOrNull,
  toOptionalIdString,
  toOptionalNumberishOrNull,
  toOptionalNumberOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import {
  normalizeCurrentStateCapHolds,
  safeCloneForAudit,
  toOptionalDateLike,
  toOptionalScalarId,
} from './mutationPipeline.read.normalizeData';
import type {
  ArchitectGeneralMutationCommittedTeamSnapshot,
  ArchitectGeneralMutationDashboardReloadBirdRights,
  ArchitectGeneralMutationDashboardReloadContractFreeAgency,
  ArchitectGeneralMutationDashboardReloadOfferSheet,
  ArchitectGeneralMutationDashboardReloadPlayer,
  ArchitectGeneralMutationDashboardReloadPlayerContract,
  ArchitectGeneralMutationDashboardReloadPlayerFutureContract,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  CurrentStatePlayer,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  LooseRecord,
} from './mutationPipeline';

// Wave 52 Step 1: dead-cap and exception normalizers extracted to submodule
export * from './mutationPipeline.read.dashboardNormalizers.deadcap';
import {
  normalizeDashboardReloadDeadCap,
  normalizeDashboardReloadExceptions,
} from './mutationPipeline.read.dashboardNormalizers.deadcap';

export function normalizeDashboardReloadOfferSheet(
  value: unknown
): ArchitectGeneralMutationDashboardReloadOfferSheet | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const status = toOptionalTrimmedString(record.status);
  if (!status) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadOfferSheet = {
    status,
  };
  const id = toOptionalScalarId(record.id);
  const playerName = toOptionalTrimmedString(record.playerName);
  const offeringTeamCode = toOptionalTrimmedString(record.offeringTeamCode);
  const homeTeamCode = toOptionalTrimmedString(record.homeTeamCode);
  const dedupKey = toOptionalTrimmedString(record.dedupKey);
  const playerId = toOptionalIdString(record.playerId);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const contractYears = toOptionalNumberishOrNull(record.contractYears);
  const totalValue = toOptionalNumberishOrNull(record.totalValue);
  const createdAt = toOptionalDateLike(record.createdAt);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (offeringTeamCode !== undefined) {
    normalized.offeringTeamCode = offeringTeamCode;
  }
  if (homeTeamCode !== undefined) {
    normalized.homeTeamCode = homeTeamCode;
  }
  if (dedupKey !== undefined) {
    normalized.dedupKey = dedupKey;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (contractYears !== undefined) {
    normalized.contractYears = contractYears;
  }
  if (totalValue !== undefined) {
    normalized.totalValue = totalValue;
  }
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }

  return normalized;
}

export function normalizeDashboardReloadOfferSheets(
  value: unknown
): ArchitectGeneralMutationDashboardReloadOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadOfferSheet(entry))
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadOfferSheet =>
        entry !== null
    );
}

export function normalizeDashboardReloadContractDateLike(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalTrimmedStringOrNull(value);
}

export function normalizeDashboardReloadContractFreeAgency(
  value: unknown
):
  | ArchitectGeneralMutationDashboardReloadContractFreeAgency
  | string
  | null
  | undefined {
  if (typeof value === 'string') {
    return toOptionalTrimmedStringOrNull(value);
  }

  const record = asLooseRecord(value);
  if (!record) {
    return value === null ? null : undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadContractFreeAgency =
    {};
  const year = toOptionalNumberOrNull(record.year);
  const type = toOptionalTrimmedStringOrNull(record.type);

  if (year !== undefined) {
    normalized.year = year;
  }
  if (type !== undefined) {
    normalized.type = type;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeDashboardReloadContractBirdRights(
  value: unknown
): ArchitectGeneralMutationDashboardReloadBirdRights | null | undefined {
  if (value === null) {
    return null;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const status = toOptionalTrimmedString(record.status);
  if (!status) {
    return undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadBirdRights = {
    status,
  };
  const yearsOfService = toOptionalNumberOrNull(record.yearsOfService);
  const yearsWithTeam = toOptionalNumberOrNull(record.yearsWithTeam);
  const eligibleFor = normalizeStringArray(record.eligibleFor);

  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }

  return normalized;
}

export function normalizeDashboardReloadPlayerContract<
  T extends CurrentStatePlayerContract | CurrentStatePlayerFutureContract,
>(
  value: T | null | undefined
):
  | ArchitectGeneralMutationDashboardReloadPlayerContract
  | ArchitectGeneralMutationDashboardReloadPlayerFutureContract
  | null
  | undefined {
  if (value === null) {
    return null;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized = {
    ...(safeCloneForAudit(record) as LooseRecord),
  };

  const signingDate = normalizeDashboardReloadContractDateLike(
    record.signingDate
  );
  if (signingDate !== undefined) {
    normalized.signingDate = signingDate;
  } else {
    delete normalized.signingDate;
  }

  const freeAgency = normalizeDashboardReloadContractFreeAgency(
    record.freeAgency
  );
  if (freeAgency !== undefined) {
    normalized.freeAgency = freeAgency;
  } else {
    delete normalized.freeAgency;
  }

  const birdRights = normalizeDashboardReloadContractBirdRights(
    record.birdRights
  );
  if (birdRights !== undefined) {
    normalized.birdRights = birdRights;
  } else {
    delete normalized.birdRights;
  }

  return normalized as
    | ArchitectGeneralMutationDashboardReloadPlayerContract
    | ArchitectGeneralMutationDashboardReloadPlayerFutureContract;
}

export function normalizeDashboardReloadPlayer(
  value: CurrentStatePlayer | null | undefined
): ArchitectGeneralMutationDashboardReloadPlayer | null {
  if (!value) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadPlayer = {
    ...(safeCloneForAudit(value) as Omit<
      ArchitectGeneralMutationDashboardReloadPlayer,
      'contract' | 'futureContract'
    >),
  };

  const contract = normalizeDashboardReloadPlayerContract(value.contract);
  if (contract !== undefined) {
    normalized.contract =
      contract as ArchitectGeneralMutationDashboardReloadPlayerContract | null;
  }

  const futureContract = normalizeDashboardReloadPlayerContract(
    value.futureContract
  );
  if (futureContract !== undefined) {
    normalized.futureContract =
      futureContract as ArchitectGeneralMutationDashboardReloadPlayerFutureContract | null;
  }

  return removeUndefinedDeep(
    normalized
  ) as ArchitectGeneralMutationDashboardReloadPlayer;
}

export function normalizeDashboardReloadPlayers(
  value: CurrentStatePlayer[] | null | undefined
): ArchitectGeneralMutationDashboardReloadPlayer[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((player) => normalizeDashboardReloadPlayer(player))
    .filter(
      (player): player is ArchitectGeneralMutationDashboardReloadPlayer =>
        player !== null
    );
}

export function buildGeneralMutationDashboardReloadTeamSnapshot(
  team: ArchitectGeneralMutationCommittedTeamSnapshot | null | undefined
): ArchitectGeneralMutationDashboardReloadTeamSnapshot | null {
  if (!team) {
    return null;
  }

  const reloadSnapshot: ArchitectGeneralMutationDashboardReloadTeamSnapshot = {};
  const teamCode = toOptionalTrimmedString(team.teamCode);

  if (teamCode !== undefined) {
    reloadSnapshot.teamCode = teamCode;
  }

  const teamName = toOptionalTrimmedString(team.teamName);
  if (teamName !== undefined) {
    reloadSnapshot.teamName = teamName;
  }
  const players = normalizeDashboardReloadPlayers(team.players);
  if (players !== undefined) {
    reloadSnapshot.players = players;
  }
  if (team.roster !== undefined) {
    reloadSnapshot.roster = team.roster;
  }

  const capHolds = normalizeCurrentStateCapHolds(team.capHolds);
  if (capHolds !== undefined) {
    reloadSnapshot.capHolds = capHolds;
  }

  const deadCap = normalizeDashboardReloadDeadCap(team.deadCap);
  if (deadCap !== undefined) {
    reloadSnapshot.deadCap = deadCap;
  }

  const exceptions = normalizeDashboardReloadExceptions(team.exceptions);
  if (exceptions !== undefined) {
    reloadSnapshot.exceptions = exceptions;
  }

  const offerSheets = normalizeDashboardReloadOfferSheets(team.offerSheets);
  if (offerSheets !== undefined) {
    reloadSnapshot.offerSheets = offerSheets;
  }

  const incomingOfferSheets = normalizeDashboardReloadOfferSheets(
    team.incomingOfferSheets
  );
  if (incomingOfferSheets !== undefined) {
    reloadSnapshot.incomingOfferSheets = incomingOfferSheets;
  }

  if (team.exceptionHistory !== undefined) {
    reloadSnapshot.exceptionHistory = team.exceptionHistory;
  }
  if (team.draftPicks !== undefined) {
    reloadSnapshot.draftPicks = team.draftPicks;
  }
  if (team.entitlementIds !== undefined) {
    reloadSnapshot.entitlementIds = team.entitlementIds;
  }
  if (team.totals !== undefined) {
    reloadSnapshot.totals = team.totals;
  }
  const hardCapped = toOptionalBooleanOrNull(team.hardCapped);
  if (hardCapped !== undefined) {
    reloadSnapshot.hardCapped = hardCapped;
  }
  if (team.hardCapLevel !== undefined) {
    reloadSnapshot.hardCapLevel = team.hardCapLevel;
  }
  if (team.hardCapReason !== undefined) {
    reloadSnapshot.hardCapReason = team.hardCapReason;
  }
  if (team.hardCapTriggeredBy !== undefined) {
    reloadSnapshot.hardCapTriggeredBy = team.hardCapTriggeredBy;
  }

  return removeUndefinedDeep(
    reloadSnapshot
  ) as ArchitectGeneralMutationDashboardReloadTeamSnapshot;
}
