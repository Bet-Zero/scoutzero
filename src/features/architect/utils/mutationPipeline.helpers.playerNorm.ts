/**
 * FILE: src/features/architect/utils/mutationPipeline.helpers.playerNorm.ts
 * PURPOSE: Player bio, contract, and representation normalizers for the mutation pipeline.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 4: Extracted from mutationPipeline.helpers.ts (L445-L1590).
 * Imports `toOptional*` utilities back from ./mutationPipeline.helpers (leaf→sibling, no cycle).
 */

import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  normalizeFreeAgency,
  normalizeOptionUsed,
  normalizeSalaryRow,
  normalizeContractForWorld,
  normalizeFutureContract,
} from '@/features/architect/utils/contractNormalization';
import type { BasePlayerDoc } from '@/schemas/architect';
import {
  asLooseRecord,
  CURRENT_STATE_PLAYER_CONTRACT_KEYS,
  CURRENT_STATE_PLAYER_FUTURE_CONTRACT_KEYS,
  normalizeStringArray,
  toOptionalBoolean,
  toOptionalBooleanOrNull,
  toOptionalContractDateLikeOrNull,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberish,
  toOptionalNumberishOrNull,
  toOptionalNumberOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationBirdRights,
  ArchitectMutationContract,
  ArchitectMutationContractIncentives,
  ArchitectMutationGuaranteeScheduleEntry,
  ArchitectMutationPlayerRecord,
  ArchitectMutationPlayerRfaContextIngress,
  CurrentStatePlayerBio,
  CurrentStatePlayerBioDisplay,
  CurrentStatePlayerBioDraft,
  CurrentStatePlayerBoundaryInput,
  CurrentStatePlayerContract,
  CurrentStatePlayerContractFreeAgency,
  CurrentStatePlayerContractGuaranteeScheduleEntry,
  CurrentStatePlayerContractIncentives,
  CurrentStatePlayerContractSalaryRow,
  CurrentStatePlayerContractTradeEligibility,
  CurrentStatePlayerContractTradeEligibilityRules,
  CurrentStatePlayerFutureContract,
  CurrentStatePlayerOverridePersistenceIngress,
  CurrentStatePlayerOverridePersistenceSidecar,
  CurrentStatePlayerRfaBoundary,
  CurrentStatePlayerRfaContext,
  MutationCurrentStatePlayerContractIngress,
  MutationCurrentStatePlayerContractSalaryRowIngress,
  MutationCurrentStatePlayerFutureContractIngress,
  MutationCurrentStatePlayerIngress,
  MutationPlayerBioLike,
  MutationPlayerSourceLike,
  NormalizedCurrentStatePlayer,
  PlayerLike,
} from './mutationPipeline';



// ==============================================================================
// PLAYER BIO / CONTRACT NORMALIZERS
// ==============================================================================

export function normalizeCurrentStatePlayerBioDisplay(
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

export function normalizeCurrentStatePlayerBioDraft(
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

export function normalizeCurrentStatePlayerBio(
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

export function normalizeCurrentStatePlayerBirdRights(
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

type CurrentStatePlayerContractLane = 'current' | 'future';

export function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerContractIngress | null | undefined,
  lane: 'current'
): MutationCurrentStatePlayerContractIngress | undefined;
export function projectCurrentStatePlayerContractIngress(
  value: MutationCurrentStatePlayerFutureContractIngress | null | undefined,
  lane: 'future'
): MutationCurrentStatePlayerFutureContractIngress | undefined;
export function projectCurrentStatePlayerContractIngress(
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

export function pickCurrentStatePlayerContractSlice<
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

export function normalizeCurrentStatePlayerContract(
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

export function normalizeCurrentStatePlayerFutureContract(
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

export function normalizeCurrentStatePlayerRepresentation(
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

export function normalizeCurrentStatePlayerSource(
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

export function normalizeCurrentStatePlayerOverridePersistenceSidecar(
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

export function normalizeCurrentStatePlayerDraft(
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

export function normalizeCurrentStatePlayerRfaContext(
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

export function normalizeCurrentStatePlayerRfaBoundary(
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

export function buildCurrentStatePlayerSnapshot(
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
export function toCurrentStatePlayer(
  player: MutationCurrentStatePlayerIngress | null | undefined
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}

// Mixed raw/direct-compute player compatibility is tolerated only where
// current-state ingress or persistence round-trips still truthfully need it.
export function normalizeCurrentStatePlayerSnapshot(
  player: unknown
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}
