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
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

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

export function normalizeCurrentStateCapHold(
  value: unknown
): ArchitectMutationCapHold | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationCapHold = {};
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const amount = toOptionalNumber(record.amount);
  const type = toOptionalTrimmedString(record.type);
  const season = toOptionalTrimmedString(record.season);
  const isSigned = toOptionalBoolean(record.isSigned);
  const expiresOn = toOptionalTrimmedString(record.expiresOn);
  const notes = toOptionalTrimmedString(record.notes);
  const active = toOptionalBoolean(record.active);
  const reason = toOptionalTrimmedString(record.reason);

  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (amount !== undefined) {
    normalized.amount = amount;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (season !== undefined) {
    normalized.season = season;
  }
  if (isSigned !== undefined) {
    normalized.isSigned = isSigned;
  }
  if (expiresOn !== undefined) {
    normalized.expiresOn = expiresOn;
  }
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (active !== undefined) {
    normalized.active = active;
  }
  if (reason !== undefined) {
    normalized.reason = reason;
  }

  return normalized;
}

export function normalizeCurrentStateCapHolds(
  value: unknown
): ArchitectMutationCapHold[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateCapHold(entry))
    .filter((entry): entry is ArchitectMutationCapHold => entry !== null);
}

export function normalizeCurrentStateDeadCapAmountByYear(
  value: unknown
): MutationDeadCapYear[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      const record = asLooseRecord(entry);
      if (!record) {
        return null;
      }

      const normalized: MutationDeadCapYear = {};
      const season = toOptionalTrimmedString(record.season);
      const amount = toOptionalNumberish(record.amount);
      const isStretched = toOptionalBoolean(record.isStretched);

      if (season !== undefined) {
        normalized.season = season;
      }
      if (amount !== undefined) {
        normalized.amount = amount;
      }
      if (isStretched !== undefined) {
        normalized.isStretched = isStretched;
      }

      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((entry): entry is MutationDeadCapYear => entry !== null);
}

export function normalizeCurrentStateDeadCapEntry(
  value: unknown
): ArchitectMutationDeadCapEntry | null {
  const record = asLooseRecord(value);
  if (!record) {
    return null;
  }

  const normalized: ArchitectMutationDeadCapEntry = {};
  const id = toOptionalTrimmedString(record.id);
  const playerId = toOptionalIdString(record.playerId);
  const playerName = toOptionalTrimmedString(record.playerName);
  const label = toOptionalTrimmedString(record.label);
  const originalSalary = toOptionalNumberish(record.originalSalary);
  const amountByYear = normalizeCurrentStateDeadCapAmountByYear(
    record.amountByYear
  );
  const waiveDate = toOptionalTrimmedString(record.waiveDate);
  const notes = toOptionalTrimmedString(record.notes);
  const stretched = toOptionalBoolean(record.stretched);

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

  return normalized;
}

export function normalizeCurrentStateDeadCap(
  value: unknown
): ArchitectMutationDeadCapEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => normalizeCurrentStateDeadCapEntry(entry))
    .filter((entry): entry is ArchitectMutationDeadCapEntry => entry !== null);
}



export function normalizeCurrentStateTotalsDeltas(
  value: unknown
): ArchitectMutationTeamTotals['deltas'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<ArchitectMutationTeamTotals['deltas']> = {};
  const vsCap = toOptionalNumber(record.vsCap);
  const vsLuxuryTax = toOptionalNumber(record.vsLuxuryTax);
  const vsFirstApron = toOptionalNumber(record.vsFirstApron);
  const vsSecondApron = toOptionalNumber(record.vsSecondApron);

  if (vsCap !== undefined) {
    normalized.vsCap = vsCap;
  }
  if (vsLuxuryTax !== undefined) {
    normalized.vsLuxuryTax = vsLuxuryTax;
  }
  if (vsFirstApron !== undefined) {
    normalized.vsFirstApron = vsFirstApron;
  }
  if (vsSecondApron !== undefined) {
    normalized.vsSecondApron = vsSecondApron;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStateTotalsMeta(
  value: unknown
): ArchitectMutationTeamTotals['_meta'] | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: Partial<NonNullable<ArchitectMutationTeamTotals['_meta']>> =
    {};
  const source = toOptionalTrimmedString(record.source);
  const capSettingsSource = toOptionalTrimmedString(record.capSettingsSource);
  const seasonKey = toOptionalTrimmedString(record.seasonKey);
  const incompleteRosterCharge = asLooseRecord(record.incompleteRosterCharge);

  if (source === 'computeTeamCapTotals') {
    normalized.source = source;
  }
  if (record.rulesSource !== undefined) {
    normalized.rulesSource = safeCloneForAudit(record.rulesSource);
  }
  if (record.rulesSourcesSummary !== undefined) {
    normalized.rulesSourcesSummary = safeCloneForAudit(
      record.rulesSourcesSummary
    );
  }
  if (record.rulesSources !== undefined) {
    normalized.rulesSources = safeCloneForAudit(record.rulesSources);
  }
  if (capSettingsSource === 'via_facade') {
    normalized.capSettingsSource = capSettingsSource;
  }
  if (seasonKey !== undefined) {
    normalized.seasonKey = seasonKey;
  }
  if (incompleteRosterCharge) {
    const standardRosterCount = toOptionalNumber(
      incompleteRosterCharge.standardRosterCount
    );
    const minRoster = toOptionalNumber(incompleteRosterCharge.minRoster);
    const missingSlots = toOptionalNumber(incompleteRosterCharge.missingSlots);
    const chargePerSlot = toOptionalNumber(
      incompleteRosterCharge.chargePerSlot
    );

    normalized.incompleteRosterCharge = {
      standardRosterCount: standardRosterCount ?? 0,
      minRoster: minRoster ?? 0,
      missingSlots: missingSlots ?? 0,
      chargePerSlot: chargePerSlot ?? 0,
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
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationTeamTotals = {};
  const numberFields = [
    'yearKey',
    'playersTotal',
    'deadMoneyTotal',
    'capHoldsTotal',
    'incompleteChargesTotal',
    'totalCapAllocations',
    'salaryCap',
    'luxuryTax',
    'totalSalary',
    'teamSalary',
    'capHit',
    'currentCapHit',
    'guaranteedSalary',
    'nonGuaranteedSalary',
    'rosterCount',
    'guaranteedContracts',
    'nonGuaranteedContracts',
    'twoWayContracts',
    'emptyRosterCharges',
    'capSpace',
    'capRoom',
    'effectiveCap',
    'luxuryTaxLine',
    'taxablePayroll',
    'taxBill',
    'taxRate',
    'firstApron',
    'firstApronRoom',
    'secondApron',
    'secondApronRoom',
    'hardCapRoom',
  ] as const;

  for (const field of numberFields) {
    const normalizedValue = toOptionalNumber(record[field]);
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue;
    }
  }

  const booleanFields = [
    'isOverTax',
    'isFirstApron',
    'isSecondApron',
    'isHardCapped',
  ] as const;

  for (const field of booleanFields) {
    const normalizedValue = toOptionalBoolean(record[field]);
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue;
    }
  }

  const hardCapLevel = toOptionalTrimmedString(record.hardCapLevel);
  const hardCapDetail = toOptionalTrimmedString(record.hardCapDetail);
  const hardCapReason = toOptionalTrimmedStringOrNull(record.hardCapReason);
  const hardCapTriggered =
    toOptionalTrimmedString(record.hardCapTriggered) ??
    toOptionalBoolean(record.hardCapTriggered);
  const deltas = normalizeCurrentStateTotalsDeltas(record.deltas);
  const meta = normalizeCurrentStateTotalsMeta(record._meta);

  if (hardCapLevel !== undefined) {
    normalized.hardCapLevel = hardCapLevel;
  }
  if (hardCapDetail !== undefined) {
    normalized.hardCapDetail = hardCapDetail;
  }
  if (hardCapReason !== undefined) {
    normalized.hardCapReason = hardCapReason;
  }
  if (hardCapTriggered !== undefined) {
    normalized.hardCapTriggered = hardCapTriggered;
  }
  if (deltas !== undefined) {
    normalized.deltas = deltas;
  }
  if (meta !== undefined) {
    normalized._meta = meta;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
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
  // bridge. When loaded state omits it, normalize from totals.totalSalary only.
  return toOptionalNumber(totals?.totalSalary);
}

