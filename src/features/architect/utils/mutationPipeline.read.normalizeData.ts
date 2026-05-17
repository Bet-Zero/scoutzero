/**
 * FILE: src/features/architect/utils/mutationPipeline.read.normalizeData.ts
 * PURPOSE: Raw-value normalization helpers — Firestore ingress → typed internal values.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 1: Extracted from mutationPipeline.read.ts (L1061-1957).
 * Pure data-shaping functions. No Firebase calls, no side effects.
 */

import {
  asLooseRecord,
  normalizeCurrentStatePlayerSnapshot,
  normalizeMutationExceptionsFromIngress,
  normalizeStringArray,
  toOptionalBoolean,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberOrNull,
  toOptionalNumberish,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';

import { normalizeOptionUsed } from '@/features/architect/utils/contractNormalization';

import type { DraftPick } from '@/schemas/architect';
import type { MutationCurrentStateContractDateLike } from './mutationPipeline';
import type {
  ArchitectMutationCapHold,
  ArchitectMutationCashLedger,
  ArchitectMutationDeadCapEntry,
  ArchitectMutationExceptionIngress,
  ArchitectMutationExceptions,
  ArchitectMutationOfferSheet,
  ArchitectMutationTeamTotals,
  CurrentStateBaseTeamPreservedFieldMap,
  CurrentStateExceptionHistoryEntry,
  CurrentStateTradeException,
  CurrentStateTradeTeam,
  MutationCurrentStatePlayerIngress,
  MutationCurrentStateTradeTeamIngress,
  MutationDeadCapYear,
  NormalizedMutationSalaryRow,
  MutationScalarId,
  PlayerLike,
} from './mutationPipeline';

// Wave 33 Step 1: cap hold, dead cap, team totals normalizers
export * from './mutationPipeline.read.normalizeData.capData';
// Wave 33 Step 2: draft picks, exceptions, player array normalizers
export * from './mutationPipeline.read.normalizeData.assets';

export function safeCloneForAudit<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function toOptionalScalarId(value: unknown): MutationScalarId {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

export function toOptionalDateLike(
  value: unknown
): string | number | Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return toOptionalTrimmedString(value);
}

export function normalizeCurrentStateCashLedger(
  value: unknown
): ArchitectMutationCashLedger | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationCashLedger = {};
  const totalOut = toOptionalNumberish(record.totalOut);

  if (totalOut !== undefined) {
    normalized.totalOut = totalOut;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateOfferSheetSalaryRows(
  value: unknown
): NormalizedMutationSalaryRow[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const row = asLooseRecord(entry);
      if (!row) {
        return null;
      }

      const normalized: NormalizedMutationSalaryRow = {
        season: '',
      };
      const season = toOptionalTrimmedString(row.season);
      if (!season) {
        return null;
      }
      normalized.season = season;

      const salary = toOptionalNumber(row.salary);
      const capHit = toOptionalNumber(row.capHit ?? row.salary);
      const guaranteed = toOptionalBoolean(row.guaranteed);
      const guaranteedAmount = toOptionalNumber(row.guaranteedAmount);
      const option = toOptionalTrimmedString(row.option);
      const optionType = toOptionalTrimmedString(row.optionType);
      const optionUsed = normalizeOptionUsed(row.optionUsed);
      const isExtensionSeason = toOptionalBoolean(row.isExtensionSeason);

      if (salary !== undefined) {
        normalized.salary = salary;
      }
      if (capHit !== undefined) {
        normalized.capHit = capHit;
      }
      if (guaranteed !== undefined) {
        normalized.guaranteed = guaranteed;
      }
      if (guaranteedAmount !== undefined) {
        normalized.guaranteedAmount = guaranteedAmount;
      }
      if (option !== undefined) {
        normalized.option = option;
      }
      if (optionType !== undefined) {
        normalized.optionType = optionType;
      }
      if (optionUsed !== null) {
        normalized.optionUsed = optionUsed;
      }
      if (isExtensionSeason !== undefined) {
        normalized.isExtensionSeason = isExtensionSeason;
      }

      return normalized;
    })
    .filter((entry): entry is NormalizedMutationSalaryRow => entry !== null);
}

export function normalizeCurrentStateOfferSheet(
  value: unknown
): ArchitectMutationOfferSheet | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationOfferSheet = {};
  const id = toOptionalScalarId(record.id);
  const dedupKey = toOptionalTrimmedString(record.dedupKey);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const offeringTeamCode = toOptionalTrimmedString(record.offeringTeamCode);
  const homeTeamCode = toOptionalTrimmedString(record.homeTeamCode);
  const status = toOptionalTrimmedString(record.status);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const year = toOptionalNumber(record.year);
  const contractYears = toOptionalNumberish(record.contractYears);
  const totalValue = toOptionalNumberish(record.totalValue);
  const salariesByYear = normalizeCurrentStateOfferSheetSalaryRows(
    record.salariesByYear
  );
  const createdAt = toOptionalDateLike(record.createdAt);
  const matchedAt = toOptionalTrimmedString(record.matchedAt);
  const declinedAt = toOptionalTrimmedString(record.declinedAt);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (dedupKey !== undefined) {
    normalized.dedupKey = dedupKey;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
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
  if (status !== undefined) {
    normalized.status = status;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (year !== undefined) {
    normalized.year = year;
  }
  if (contractYears !== undefined) {
    normalized.contractYears = contractYears;
  }
  if (totalValue !== undefined) {
    normalized.totalValue = totalValue;
  }
  if (salariesByYear !== undefined) {
    normalized.salariesByYear = salariesByYear;
  }
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }
  if (matchedAt !== undefined) {
    normalized.matchedAt = matchedAt;
  }
  if (declinedAt !== undefined) {
    normalized.declinedAt = declinedAt;
  }

  return normalized;
}

export function normalizeCurrentStateOfferSheets(
  value: unknown
): ArchitectMutationOfferSheet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateOfferSheet(entry))
    .filter((entry): entry is ArchitectMutationOfferSheet => entry !== null);
}

