/**
 * FILE: src/features/architect/utils/mutationPipeline.read.dashboardNormalizers.ts
 * PURPOSE: Dashboard reload normalizers for dead cap, exceptions, offer sheets, contracts, and players.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 11 Step 1: Extracted from mutationPipeline.read.persistence.ts (L195–L805).
 */

import {
  asLooseRecord,
  normalizeMutationExceptionsFromIngress,
  normalizeStringArray,
  removeUndefinedDeep,
  toOptionalBoolean,
  toOptionalBooleanOrNull,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberOrNull,
  toOptionalNumberishOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import {
  hasMutationExceptionBuckets,
  normalizeCurrentStateCapHolds,
  safeCloneForAudit,
  toOptionalDateLike,
  toOptionalScalarId,
} from './mutationPipeline.read.normalizeData';
import type { CanonicalNonTpeExceptionKey } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type {
  ArchitectGeneralMutationCommittedTeamSnapshot,
  ArchitectGeneralMutationDashboardReloadBirdRights,
  ArchitectGeneralMutationDashboardReloadContractFreeAgency,
  ArchitectGeneralMutationDashboardReloadDeadCapEntry,
  ArchitectGeneralMutationDashboardReloadDeadCapYear,
  ArchitectGeneralMutationDashboardReloadExceptionEntry,
  ArchitectGeneralMutationDashboardReloadExceptions,
  ArchitectGeneralMutationDashboardReloadOfferSheet,
  ArchitectGeneralMutationDashboardReloadPlayer,
  ArchitectGeneralMutationDashboardReloadPlayerContract,
  ArchitectGeneralMutationDashboardReloadPlayerFutureContract,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  ArchitectGeneralMutationDashboardReloadTradeException,
  CurrentStatePlayer,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  LooseRecord,
} from './mutationPipeline';

export function normalizeDashboardReloadDeadCapAmountByYear(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapYear[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      if (!record) {
        return null;
      }

      const season = toOptionalTrimmedString(record.season);
      const amount = toOptionalNumber(record.amount);
      const isStretched = toOptionalBooleanOrNull(record.isStretched);

      if (season === undefined || amount === undefined) {
        return null;
      }

      const normalized: ArchitectGeneralMutationDashboardReloadDeadCapYear = {
        season,
        amount,
      };
      if (isStretched !== undefined) {
        normalized.isStretched = isStretched;
      }

      return normalized;
    })
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadDeadCapYear =>
        entry !== null
    );
}

export function normalizeDashboardReloadDeadCapEntry(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapEntry | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadDeadCapEntry = {};
  const id = toOptionalTrimmedStringOrNull(record.id);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedStringOrNull(record.playerName);
  const label = toOptionalTrimmedStringOrNull(record.label);
  const originalSalary = toOptionalNumberOrNull(record.originalSalary);
  const amountByYear = normalizeDashboardReloadDeadCapAmountByYear(
    record.amountByYear
  );
  const waiveDate = toOptionalTrimmedStringOrNull(record.waiveDate);
  const notes = toOptionalTrimmedStringOrNull(record.notes);
  const stretched = toOptionalBooleanOrNull(record.stretched);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (label !== undefined) {
    normalized.label = label;
  }
  if (originalSalary !== undefined) {
    normalized.originalSalary = originalSalary;
  }
  if (amountByYear !== undefined) {
    normalized.amountByYear = amountByYear;
  }
  if (waiveDate !== undefined) {
    normalized.waiveDate = waiveDate;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (stretched !== undefined) {
    normalized.stretched = stretched;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function normalizeDashboardReloadDeadCap(
  value: unknown
): ArchitectGeneralMutationDashboardReloadDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeDashboardReloadDeadCapEntry(entry))
    .filter(
      (entry): entry is ArchitectGeneralMutationDashboardReloadDeadCapEntry =>
        entry !== null
    );
}

export function normalizeDashboardReloadExceptionEntry(
  value: unknown
): ArchitectGeneralMutationDashboardReloadExceptionEntry | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectGeneralMutationDashboardReloadExceptionEntry = {};
  const type = toOptionalTrimmedStringOrNull(record.type);
  const enabled = toOptionalBoolean(record.enabled);
  const available = toOptionalBoolean(record.available);
  const totalAmount = toOptionalNumberOrNull(record.totalAmount);
  const maxAmount = toOptionalNumberOrNull(record.maxAmount);
  const amount = toOptionalNumberOrNull(record.amount);
  const usedAmount = toOptionalNumberOrNull(record.usedAmount);
  const remainingAmount = toOptionalNumberOrNull(record.remainingAmount);
  const createdFrom = toOptionalTrimmedStringOrNull(record.createdFrom);
  const createdOn = toOptionalTrimmedStringOrNull(record.createdOn);
  const expiresOn = toOptionalTrimmedStringOrNull(record.expiresOn);
  const notes = toOptionalTrimmedStringOrNull(record.notes);
  const seasonKey = toOptionalTrimmedStringOrNull(record.seasonKey);
  const lastUsedAt = toOptionalTrimmedStringOrNull(record.lastUsedAt);

  if (type !== undefined) {
    normalized.type = type;
  }
  if (enabled !== undefined) {
    normalized.enabled = enabled;
  }
  if (available !== undefined) {
    normalized.available = available;
  }
  if (totalAmount !== undefined) {
    normalized.totalAmount = totalAmount;
  }
  if (maxAmount !== undefined) {
    normalized.maxAmount = maxAmount;
  }
  if (amount !== undefined) {
    normalized.amount = amount;
  }
  if (usedAmount !== undefined) {
    normalized.usedAmount = usedAmount;
  }
  if (remainingAmount !== undefined) {
    normalized.remainingAmount = remainingAmount;
  }
  if (createdFrom !== undefined) {
    normalized.createdFrom = createdFrom;
  }
  if (createdOn !== undefined) {
    normalized.createdOn = createdOn;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (lastUsedAt !== undefined) {
    normalized.lastUsedAt = lastUsedAt;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeDashboardReloadExceptions(
  value: unknown
): ArchitectGeneralMutationDashboardReloadExceptions | undefined {
  const normalizedExceptions = normalizeMutationExceptionsFromIngress(value);
  if (!hasMutationExceptionBuckets(normalizedExceptions)) {
    return undefined;
  }

  const dashboardExceptions: ArchitectGeneralMutationDashboardReloadExceptions =
    {};
  const nonTpeKeys: Array<CanonicalNonTpeExceptionKey | 'dpe'> = [
    'mle',
    'tpmle',
    'room',
    'bae',
    'dpe',
  ];

  for (const key of nonTpeKeys) {
    const normalizedEntry = normalizeDashboardReloadExceptionEntry(
      normalizedExceptions[key]
    );
    if (normalizedEntry !== undefined) {
      dashboardExceptions[key] = normalizedEntry;
    }
  }

  if (Array.isArray(normalizedExceptions.tpe)) {
    dashboardExceptions.tpe = normalizedExceptions.tpe
      .map((entry) => {
        const record = asLooseRecord(entry);
        if (!record) {
          return null;
        }

        const id = toOptionalTrimmedString(record.id);
        if (!id) {
          return null;
        }

        const normalized: ArchitectGeneralMutationDashboardReloadTradeException =
          {
            id,
          };
        const totalAmount = toOptionalNumberOrNull(record.totalAmount);
        const usedAmount = toOptionalNumberOrNull(record.usedAmount);
        const remainingAmount = toOptionalNumberOrNull(record.remainingAmount);
        const createdFrom = toOptionalTrimmedStringOrNull(record.createdFrom);
        const createdOn = toOptionalTrimmedStringOrNull(record.createdOn);
        const expiresOn = toOptionalTrimmedStringOrNull(record.expiresOn);
        const notes = toOptionalTrimmedStringOrNull(record.notes);

        if (totalAmount !== undefined) {
          normalized.totalAmount = totalAmount;
        }
        if (usedAmount !== undefined) {
          normalized.usedAmount = usedAmount;
        }
        if (remainingAmount !== undefined) {
          normalized.remainingAmount = remainingAmount;
        }
        if (createdFrom !== undefined) {
          normalized.createdFrom = createdFrom;
        }
        if (createdOn !== undefined) {
          normalized.createdOn = createdOn;
        }
        if (expiresOn !== undefined) {
          normalized.expiresOn = expiresOn;
        }
        if (notes !== undefined) {
          normalized.notes = notes;
        }

        return normalized;
      })
      .filter(
        (
          entry
        ): entry is ArchitectGeneralMutationDashboardReloadTradeException =>
          entry !== null
      );
  }

  return Object.keys(dashboardExceptions).length > 0
    ? dashboardExceptions
    : undefined;
}

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
