/**
 * Wave 52 Step 1: Dead-cap and exception normalizers extracted from
 * mutationPipeline.read.dashboardNormalizers.ts (lines 51–313).
 *
 * Exports normalizeDashboardReloadDeadCapAmountByYear,
 * normalizeDashboardReloadDeadCapEntry, normalizeDashboardReloadDeadCap,
 * normalizeDashboardReloadExceptionEntry, normalizeDashboardReloadExceptions.
 */

import {
  asLooseRecord,
  normalizeMutationExceptionsFromIngress,
  toOptionalBoolean,
  toOptionalBooleanOrNull,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import { hasMutationExceptionBuckets } from './mutationPipeline.read.normalizeData';
import type { CanonicalNonTpeExceptionKey } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type {
  ArchitectGeneralMutationDashboardReloadDeadCapEntry,
  ArchitectGeneralMutationDashboardReloadDeadCapYear,
  ArchitectGeneralMutationDashboardReloadExceptionEntry,
  ArchitectGeneralMutationDashboardReloadExceptions,
  ArchitectGeneralMutationDashboardReloadTradeException,
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
