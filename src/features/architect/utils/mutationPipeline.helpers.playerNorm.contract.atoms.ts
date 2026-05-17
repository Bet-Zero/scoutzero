/**
 * Wave 49 Step 1: Atomic contract field normalizers extracted from
 * mutationPipeline.helpers.playerNorm.contract.ts (lines 52–374).
 *
 * Exports normalizeCurrentStatePlayerContractBirdRights,
 * normalizeCurrentStatePlayerContractIncentives,
 * normalizeCurrentStatePlayerContractGuaranteeScheduleEntry,
 * normalizeCurrentStatePlayerContractGuaranteeSchedule,
 * normalizeCurrentStatePlayerContractTradeEligibilityRules,
 * normalizeCurrentStatePlayerContractTradeEligibility,
 * normalizeCurrentStatePlayerContractFreeAgency,
 * normalizeCurrentStatePlayerContractSalaryRow,
 * normalizeCurrentStatePlayerContractSalaryRows.
 */

import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  normalizeFreeAgency,
  normalizeOptionUsed,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  asLooseRecord,
  toOptionalBooleanOrNull,
  toOptionalNumberishOrNull,
  toOptionalNumberOrNull,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import { normalizeCurrentStatePlayerBirdRights } from './mutationPipeline.helpers.playerNorm.bio';
import type {
  ArchitectMutationBirdRights,
  ArchitectMutationContract,
  ArchitectMutationContractIncentives,
  ArchitectMutationGuaranteeScheduleEntry,
  CurrentStatePlayerContractFreeAgency,
  CurrentStatePlayerContractGuaranteeScheduleEntry,
  CurrentStatePlayerContractIncentives,
  CurrentStatePlayerContractSalaryRow,
  CurrentStatePlayerContractTradeEligibility,
  CurrentStatePlayerContractTradeEligibilityRules,
  MutationCurrentStatePlayerContractIngress,
  MutationCurrentStatePlayerContractSalaryRowIngress,
  MutationCurrentStatePlayerFutureContractIngress,
} from './mutationPipeline';

export function normalizeCurrentStatePlayerContractBirdRights(
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

export function normalizeCurrentStatePlayerContractIncentives(
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

export function normalizeCurrentStatePlayerContractGuaranteeScheduleEntry(
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

export function normalizeCurrentStatePlayerContractGuaranteeSchedule(
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

export function normalizeCurrentStatePlayerContractTradeEligibilityRules(
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

export function normalizeCurrentStatePlayerContractTradeEligibility(
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

export function normalizeCurrentStatePlayerContractFreeAgency(
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

export function normalizeCurrentStatePlayerContractSalaryRow(
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

export function normalizeCurrentStatePlayerContractSalaryRows(
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
