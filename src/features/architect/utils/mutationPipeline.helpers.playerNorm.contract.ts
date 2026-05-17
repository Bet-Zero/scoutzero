/**
 * Wave 20 Step 2: Contract normalizer functions extracted from
 * mutationPipeline.helpers.playerNorm.ts (lines 289–1013).
 * Wave 49 Step 1: Atomic field normalizers extracted to submodule.
 */

import {
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
  toOptionalNumber,
  toOptionalNumberishOrNull,
  toOptionalNumberOrNull,
  toOptionalTrimmedString,
  toOptionalTrimmedStringOrNull,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  CurrentStatePlayerContract,
  CurrentStatePlayerFutureContract,
  CurrentStatePlayerOverridePersistenceIngress,
  CurrentStatePlayerOverridePersistenceSidecar,
  MutationCurrentStatePlayerContractIngress,
  MutationCurrentStatePlayerFutureContractIngress,
  MutationPlayerSourceLike,
} from './mutationPipeline';

// Wave 49 Step 1: atomic contract field normalizers extracted to submodule
export * from './mutationPipeline.helpers.playerNorm.contract.atoms';
import {
  normalizeCurrentStatePlayerContractFreeAgency,
  normalizeCurrentStatePlayerContractSalaryRow,
  normalizeCurrentStatePlayerContractSalaryRows,
  normalizeCurrentStatePlayerContractBirdRights,
  normalizeCurrentStatePlayerContractIncentives,
  normalizeCurrentStatePlayerContractGuaranteeSchedule,
  normalizeCurrentStatePlayerContractTradeEligibility,
} from './mutationPipeline.helpers.playerNorm.contract.atoms';

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
