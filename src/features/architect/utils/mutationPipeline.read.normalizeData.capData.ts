/**
 * Wave 33 Step 1: Cap hold, dead cap, and team totals normalizers extracted
 * from mutationPipeline.read.normalizeData.ts (lines 250–600).
 */

import {
  asLooseRecord,
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalNumberish,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationCapHold,
  ArchitectMutationDeadCapEntry,
  ArchitectMutationTeamTotals,
  MutationDeadCapYear,
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

export function normalizeCurrentStateCapHold(
  value: unknown
): ArchitectMutationCapHold | null {
  const record = asLooseRecord(value);
  if (!record) return null;

  const normalized: ArchitectMutationCapHold = {};
  const playerId = toOptionalTrimmedString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const amount = toOptionalNumber(record.amount);
  const type = toOptionalTrimmedString(record.type);
  const season = toOptionalTrimmedString(record.season);
  const isSigned = toOptionalBoolean(record.isSigned);
  const expiresOn = toOptionalTrimmedString(record.expiresOn);
  const notes = toOptionalTrimmedString(record.notes);
  const active = toOptionalBoolean(record.active);
  const reason = toOptionalTrimmedString(record.reason);
  const priorTeamOfferCeiling = toOptionalNumber(
    record.priorTeamOfferCeiling
  );
  const governedContractEventId = toOptionalTrimmedString(
    record.governedContractEventId
  );

  if (playerId !== undefined) normalized.playerId = playerId;
  if (playerName !== undefined) normalized.playerName = playerName;
  if (amount !== undefined) normalized.amount = amount;
  if (type !== undefined) normalized.type = type;
  if (season !== undefined) normalized.season = season;
  if (isSigned !== undefined) normalized.isSigned = isSigned;
  if (expiresOn !== undefined) normalized.expiresOn = expiresOn;
  if (notes !== undefined) normalized.notes = notes;
  if (active !== undefined) normalized.active = active;
  if (reason !== undefined) normalized.reason = reason;
  if (priorTeamOfferCeiling !== undefined) {
    normalized.priorTeamOfferCeiling = priorTeamOfferCeiling;
  }
  if (governedContractEventId !== undefined) {
    normalized.governedContractEventId = governedContractEventId;
  }

  return normalized;
}

export function normalizeCurrentStateCapHolds(
  value: unknown
): ArchitectMutationCapHold[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => normalizeCurrentStateCapHold(entry))
    .filter((entry): entry is ArchitectMutationCapHold => entry !== null);
}

export function normalizeCurrentStateDeadCapAmountByYear(
  value: unknown
): MutationDeadCapYear[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      if (!record) return null;
      const normalized: MutationDeadCapYear = {};
      const season = toOptionalTrimmedString(record.season);
      const amount = toOptionalNumberish(record.amount);
      const isStretched = toOptionalBoolean(record.isStretched);
      if (season !== undefined) normalized.season = season;
      if (amount !== undefined) normalized.amount = amount;
      if (isStretched !== undefined) normalized.isStretched = isStretched;
      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((entry): entry is MutationDeadCapYear => entry !== null);
}

export function normalizeCurrentStateDeadCapEntry(
  value: unknown
): ArchitectMutationDeadCapEntry | null {
  const record = asLooseRecord(value);
  if (!record) return null;

  const normalized: ArchitectMutationDeadCapEntry = {};
  const id = toOptionalTrimmedString(record.id);
  const playerId = toOptionalTrimmedString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const label = toOptionalTrimmedString(record.label);
  const originalSalary = toOptionalNumberish(record.originalSalary);
  const amountByYear = normalizeCurrentStateDeadCapAmountByYear(record.amountByYear);
  const waiveDate = toOptionalTrimmedString(record.waiveDate);
  const notes = toOptionalTrimmedString(record.notes);
  const stretched = toOptionalBoolean(record.stretched);

  if (id !== undefined) normalized.id = id;
  if (playerId !== undefined) normalized.playerId = playerId;
  if (playerName !== undefined) normalized.playerName = playerName;
  if (label !== undefined) normalized.label = label;
  if (originalSalary !== undefined) normalized.originalSalary = originalSalary;
  if (amountByYear !== undefined) normalized.amountByYear = amountByYear;
  if (waiveDate !== undefined) normalized.waiveDate = waiveDate;
  if (notes !== undefined) normalized.notes = notes;
  if (stretched !== undefined) normalized.stretched = stretched;

  return normalized;
}

export function normalizeCurrentStateDeadCap(
  value: unknown
): ArchitectMutationDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => normalizeCurrentStateDeadCapEntry(entry))
    .filter((entry): entry is ArchitectMutationDeadCapEntry => entry !== null);
}

export function normalizeCurrentStateTotalsDeltas(
  value: unknown
): ArchitectMutationTeamTotals['deltas'] | undefined {
  const record = asLooseRecord(value);
  if (!record) return undefined;

  const normalized: NonNullable<ArchitectMutationTeamTotals['deltas']> = {};
  const vsCap = toOptionalNumber(record.vsCap);
  const vsLuxuryTax = toOptionalNumber(record.vsLuxuryTax);
  const vsFirstApron = toOptionalNumber(record.vsFirstApron);
  const vsSecondApron = toOptionalNumber(record.vsSecondApron);

  if (vsCap !== undefined) normalized.vsCap = vsCap;
  if (vsLuxuryTax !== undefined) normalized.vsLuxuryTax = vsLuxuryTax;
  if (vsFirstApron !== undefined) normalized.vsFirstApron = vsFirstApron;
  if (vsSecondApron !== undefined) normalized.vsSecondApron = vsSecondApron;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateTotalsMeta(
  value: unknown
): ArchitectMutationTeamTotals['_meta'] | undefined {
  const record = asLooseRecord(value);
  if (!record) return undefined;

  const normalized: Partial<NonNullable<ArchitectMutationTeamTotals['_meta']>> = {};
  const source = toOptionalTrimmedString(record.source);
  const capSettingsSource = toOptionalTrimmedString(record.capSettingsSource);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const incompleteRosterCharge = asLooseRecord(record.incompleteRosterCharge);

  if (source === 'computeTeamCapTotals') normalized.source = source;
  if (record.rulesSource !== undefined) normalized.rulesSource = safeCloneForAudit(record.rulesSource);
  if (record.rulesSourcesSummary !== undefined) normalized.rulesSourcesSummary = safeCloneForAudit(record.rulesSourcesSummary);
  if (record.rulesSources !== undefined) normalized.rulesSources = safeCloneForAudit(record.rulesSources);
  if (capSettingsSource === 'via_facade') normalized.capSettingsSource = capSettingsSource;
  if (seasonKey !== undefined) normalized.seasonKey = seasonKey;

  if (incompleteRosterCharge) {
    normalized.incompleteRosterCharge = {
      standardRosterCount: toOptionalNumber(incompleteRosterCharge.standardRosterCount) ?? 0,
      minRoster: toOptionalNumber(incompleteRosterCharge.minRoster) ?? 0,
      missingSlots: toOptionalNumber(incompleteRosterCharge.missingSlots) ?? 0,
      chargePerSlot: toOptionalNumber(incompleteRosterCharge.chargePerSlot) ?? 0,
    };
  } else if (record.incompleteRosterCharge === null) {
    normalized.incompleteRosterCharge = null;
  }

  return Object.keys(normalized).length > 0
    ? (normalized as ArchitectMutationTeamTotals['_meta'])
    : undefined;
}

export function normalizeCurrentStateTeamTotals(
  value: unknown
): ArchitectMutationTeamTotals | undefined {
  const record = asLooseRecord(value);
  if (!record) return undefined;

  const normalized: ArchitectMutationTeamTotals = {};
  const numberFields = [
    'yearKey', 'playersTotal', 'deadMoneyTotal', 'capHoldsTotal',
    'incompleteChargesTotal', 'totalCapAllocations', 'salaryCap', 'luxuryTax',
    'totalSalary', 'teamSalary', 'capHit', 'currentCapHit', 'guaranteedSalary',
    'nonGuaranteedSalary', 'rosterCount', 'guaranteedContracts',
    'nonGuaranteedContracts', 'twoWayContracts', 'emptyRosterCharges', 'capSpace',
    'capRoom', 'effectiveCap', 'luxuryTaxLine', 'taxablePayroll', 'taxBill',
    'taxRate', 'firstApron', 'firstApronRoom', 'secondApron', 'secondApronRoom',
    'hardCapRoom',
  ] as const;

  for (const field of numberFields) {
    const v = toOptionalNumber(record[field]);
    if (v !== undefined) normalized[field] = v;
  }

  const booleanFields = [
    'isOverTax', 'isFirstApron', 'isSecondApron', 'isHardCapped',
  ] as const;

  for (const field of booleanFields) {
    const v = toOptionalBoolean(record[field]);
    if (v !== undefined) normalized[field] = v;
  }

  const hardCapLevel = toOptionalTrimmedString(record.hardCapLevel);
  const hardCapDetail = toOptionalTrimmedString(record.hardCapDetail);
  const hardCapReason = toOptionalTrimmedStringOrNull(record.hardCapReason);
  const hardCapTriggered =
    toOptionalTrimmedString(record.hardCapTriggered) ??
    toOptionalBoolean(record.hardCapTriggered);
  const deltas = normalizeCurrentStateTotalsDeltas(record.deltas);
  const meta = normalizeCurrentStateTotalsMeta(record._meta);

  if (hardCapLevel !== undefined) normalized.hardCapLevel = hardCapLevel;
  if (hardCapDetail !== undefined) normalized.hardCapDetail = hardCapDetail;
  if (hardCapReason !== undefined) normalized.hardCapReason = hardCapReason;
  if (hardCapTriggered !== undefined) normalized.hardCapTriggered = hardCapTriggered;
  if (deltas !== undefined) normalized.deltas = deltas;
  if (meta !== undefined) normalized._meta = meta;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
