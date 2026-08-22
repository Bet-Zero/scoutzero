/**
 * Wave 33 Step 2: Draft pick, trade exception, and player array normalizers
 * extracted from mutationPipeline.read.normalizeData.ts (lines 601–978).
 */

import {
  asLooseRecord,
  toOptionalBoolean,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberOrNull,
  toOptionalNumberish,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
  normalizeStringArray,
  normalizeCurrentStatePlayerSnapshot,
  normalizeMutationExceptionsFromIngress,
} from './mutationPipeline.helpers';
import type { DraftPick } from '@/schemas/architect';
import type {
  ArchitectMutationExceptionIngress,
  ArchitectMutationExceptions,
  CurrentStateTradeException,
  CurrentStateExceptionHistoryEntry,
  MutationCurrentStatePlayerIngress,
  MutationCurrentStateTradeTeamIngress,
  CurrentStateTradeTeam,
  ArchitectMutationTeamTotals,
  PlayerLike,
} from './mutationPipeline';

function safeCloneForAudit<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function normalizeCurrentStateDraftPickProtectionMeta(
  value: unknown
): NonNullable<DraftPick['protectionMeta']> | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const type = toOptionalTrimmedString(record.type);
  if (
    type !== 'position' &&
    type !== 'lottery' &&
    type !== 'playoff' &&
    type !== 'always' &&
    type !== 'never'
  ) {
    return undefined;
  }

  const normalized: NonNullable<DraftPick['protectionMeta']> = { type };
  const maxPosition = toOptionalNumber(record.maxPosition);
  const conversionTargetRecord = asLooseRecord(record.conversionTarget);

  if (maxPosition !== undefined) {
    normalized.maxPosition = maxPosition;
  }
  if (conversionTargetRecord) {
    const action = toOptionalTrimmedString(conversionTargetRecord.action);
    if (action === 'roll' || action === 'convert' || action === 'cancel') {
      normalized.conversionTarget = { action };
      const toYear = toOptionalNumber(conversionTargetRecord.toYear);
      const toRound = toOptionalNumber(conversionTargetRecord.toRound);
      if (toYear !== undefined) {
        normalized.conversionTarget.toYear = toYear;
      }
      if (toRound !== undefined) {
        normalized.conversionTarget.toRound = toRound;
      }
    }
  }

  return normalized;
}

export function normalizeCurrentStateDraftPickConveyance(
  value: unknown
): NonNullable<DraftPick['conveyance']> | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<DraftPick['conveyance']> = {};
  const id = toOptionalTrimmedString(record.id);
  const description = toOptionalTrimmedString(record.description);
  const originalYear = toOptionalNumber(record.originalYear);
  const currentYear = toOptionalNumber(record.currentYear);
  const finalYear = toOptionalNumber(record.finalYear);
  const conditionsRecord = asLooseRecord(record.conditions);
  const affects = normalizeStringArray(record.affects);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (description !== undefined) {
    normalized.description = description;
  }
  if (originalYear !== undefined) {
    normalized.originalYear = originalYear;
  }
  if (currentYear !== undefined) {
    normalized.currentYear = currentYear;
  }
  if (finalYear !== undefined) {
    normalized.finalYear = finalYear;
  }
  if (conditionsRecord) {
    const protection = toOptionalTrimmedString(conditionsRecord.protection);
    const ifConveys = toOptionalTrimmedString(conditionsRecord.ifConveys);
    const ifRolls = toOptionalTrimmedString(conditionsRecord.ifRolls);
    const conditions: NonNullable<
      NonNullable<DraftPick['conveyance']>['conditions']
    > = {};
    if (protection !== undefined) {
      conditions.protection = protection;
    }
    if (ifConveys !== undefined) {
      conditions.ifConveys = ifConveys;
    }
    if (ifRolls !== undefined) {
      conditions.ifRolls = ifRolls;
    }
    if (Object.keys(conditions).length > 0) {
      normalized.conditions = conditions;
    }
  }
  if (affects !== undefined) {
    normalized.affects = affects;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateDraftPickMetadata(
  value: unknown
): DraftPick['metadata'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  // Draft-pick metadata is the one schema-approved passthrough pocket on this
  // legacy field. It stays isolated to pick.metadata instead of preserving the
  // entire raw pick object.
  return safeCloneForAudit(record) as DraftPick['metadata'];
}

export function normalizeCurrentStateDraftPick(value: unknown): DraftPick | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const year = toOptionalNumber(record.year);
  const round = toOptionalNumber(record.round);
  const owner = toOptionalTrimmedString(record.owner);

  if (year === undefined || round === undefined || owner === undefined) {
    return null;
  }

  const normalized: DraftPick = {
    year,
    round,
    pick: toOptionalNumberOrNull(record.pick) ?? null,
    owner,
  };
  const id = toOptionalTrimmedString(record.id);
  const originalTeam = toOptionalTrimmedString(record.originalTeam);
  const status = toOptionalTrimmedString(record.status);
  const isSwap = toOptionalBoolean(record.isSwap);
  const swapType = toOptionalTrimmedString(record.swapType);
  const swapWithTeamId = toOptionalTrimmedString(record.swapWithTeamId);
  const protection = toOptionalTrimmedStringOrNull(record.protection);
  const protectionMeta = normalizeCurrentStateDraftPickProtectionMeta(
    record.protectionMeta
  );
  const stepienEligible = toOptionalBoolean(record.stepienEligible);
  const tradeable = toOptionalBoolean(record.tradeable);
  const via = toOptionalTrimmedString(record.via);
  const recipient = toOptionalTrimmedString(record.recipient);
  const route = normalizeStringArray(record.route);
  const notes = toOptionalTrimmedString(record.notes);
  const conveyance = normalizeCurrentStateDraftPickConveyance(
    record.conveyance
  );
  const metadata = normalizeCurrentStateDraftPickMetadata(record.metadata);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (originalTeam !== undefined) {
    normalized.originalTeam = originalTeam;
  }
  if (status !== undefined) {
    normalized.status = status;
  }
  if (isSwap !== undefined) {
    normalized.isSwap = isSwap;
  }
  if (swapType === 'best_of' || swapType === 'worst_of') {
    normalized.swapType = swapType;
  }
  if (swapWithTeamId !== undefined) {
    normalized.swapWithTeamId = swapWithTeamId;
  }
  if (protection !== undefined) {
    normalized.protection = protection;
  }
  if (protectionMeta !== undefined) {
    normalized.protectionMeta = protectionMeta;
  }
  if (stepienEligible !== undefined) {
    normalized.stepienEligible = stepienEligible;
  }
  if (tradeable !== undefined) {
    normalized.tradeable = tradeable;
  }
  if (via !== undefined) {
    normalized.via = via;
  }
  if (recipient !== undefined) {
    normalized.recipient = recipient;
  }
  if (route !== undefined) {
    normalized.route = route;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (conveyance !== undefined) {
    normalized.conveyance = conveyance;
  }
  if (metadata !== undefined) {
    normalized.metadata = metadata;
  }

  return normalized;
}

export function normalizeCurrentStateDraftPicks(
  value: unknown
): DraftPick[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeCurrentStateDraftPick(entry))
    .filter((entry): entry is DraftPick => entry !== null);

  return normalized.length > 0 ? normalized : [];
}



export function toCurrentStateTradeException(
  value: unknown
): CurrentStateTradeException | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const amount = toOptionalNumber(record.amount);
  const totalAmount = toOptionalNumber(record.totalAmount) ?? amount;
  const remainingAmount =
    toOptionalNumber(record.remainingAmount) ??
    toOptionalNumber(record.remaining) ??
    totalAmount ??
    amount;
  const usedAmount =
    toOptionalNumber(record.usedAmount) ?? toOptionalNumber(record.used);
  const normalized: CurrentStateTradeException = {};
  const id = toOptionalIdString(record.id);
  const createdSeason =
    toOptionalNumber(record.createdSeason) ??
    toOptionalNumber(record.createdAtSeason) ??
    toOptionalNumber(record.season);
  const expiresOn =
    toOptionalTrimmedString(record.expiresOn) ??
    toOptionalTrimmedString(record.expirationDate) ??
    toOptionalTrimmedString(record.expiryISO) ??
    toOptionalTrimmedString(record.expiryDate);
  const createdFrom =
    toOptionalTrimmedString(record.createdFrom) ??
    toOptionalTrimmedString(record.name);
  const isUsed = toOptionalBoolean(record.isUsed);

  if (id !== undefined) {
    normalized.id = id;
  }
  if (amount !== undefined || totalAmount !== undefined) {
    normalized.amount = amount ?? totalAmount;
  }
  if (totalAmount !== undefined || amount !== undefined) {
    normalized.totalAmount = totalAmount ?? amount;
  }
  if (remainingAmount !== undefined) {
    normalized.remainingAmount = remainingAmount;
  }
  if (usedAmount !== undefined) {
    normalized.usedAmount = usedAmount;
  }
  if (createdSeason !== undefined) {
    normalized.createdSeason = createdSeason;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (createdFrom !== undefined) {
    normalized.createdFrom = createdFrom;
  }
  if (isUsed !== undefined) {
    normalized.isUsed = isUsed;
  }

  return normalized;
}

export function normalizeCurrentStateTradeExceptions(
  value: unknown
): CurrentStateTradeException[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => toCurrentStateTradeException(entry))
    .filter((entry): entry is CurrentStateTradeException => entry !== null);
}

// Exceptions still accept legacy/custom ingress buckets here because canonical
// normalization owns collapsing them before committed compute reads them.
export type MutationExceptionPreserveOnlyBuckets = ArchitectMutationExceptionIngress;


export function hasMutationExceptionBuckets(
  exceptions: ArchitectMutationExceptions
): boolean {
  return Object.keys(exceptions).length > 0;
}

export function normalizeCurrentStateTeamExceptions(
  value: unknown
): ArchitectMutationExceptions | undefined {
  const normalizedExceptions = normalizeMutationExceptionsFromIngress(value);

  return hasMutationExceptionBuckets(normalizedExceptions)
    ? normalizedExceptions
    : undefined;
}

export function normalizeCurrentStateExceptionHistory(
  value: unknown
): CurrentStateExceptionHistoryEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  // Preserve-only compatibility pocket: history rows are object-shaped but the
  // historical payload fields still vary by producer, so the open part stays on
  // the entry itself rather than widening the whole team snapshot.
  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      return record
        ? (safeCloneForAudit(record) as CurrentStateExceptionHistoryEntry)
        : null;
    })
    .filter(
      (entry): entry is CurrentStateExceptionHistoryEntry => entry !== null
    );
}

export type CurrentStatePlayerBoundaryInput =
  | MutationCurrentStatePlayerIngress
  | PlayerLike;

export function normalizeCurrentStatePlayerArray(
  value: unknown
): PlayerLike[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStatePlayerSnapshot(entry))
    .filter((entry): entry is PlayerLike => entry !== null);
}

export function resolveCurrentStateTeamTotalSalary(
  teamRecord: Pick<
    MutationCurrentStateTradeTeamIngress | CurrentStateTradeTeam,
    'teamTotalSalary'
  >,
  totals: ArchitectMutationTeamTotals | null | undefined
): number | undefined {
  const explicitTeamTotalSalary = toOptionalNumber(teamRecord.teamTotalSalary);
  if (explicitTeamTotalSalary !== undefined) {
    return explicitTeamTotalSalary;
  }

  // Live trade validation/apply expects the explicit top-level teamTotalSalary
  // bridge to mean Apron Team Salary. Never recover it from a generic alias.
  return toOptionalNumber(totals?.apronTeamSalary);
}
