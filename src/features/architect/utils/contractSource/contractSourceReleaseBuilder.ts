/** Pure deterministic builder for retained contract-source releases. */

import type {
  ContractSourceBaselineRecord,
  ContractSourceCoverage,
  ContractSourceObservation,
  ContractSourceRelease,
} from '@/schemas/contractSourceRelease';
import { ZonedDateTimeZ } from '@/schemas/contractSourceRelease';
import type {
  ContractEvidenceStatus,
  ContractFieldEvidence,
  ContractTemporalValue,
  GovernedContractState,
  GovernedContractTerms,
} from '@/schemas/governedContractState';
import { encodeContractFieldEvidence } from '@/schemas/governedContractState';
import {
  canonicalStringify,
  compareCodePoints,
  deterministicStateDigest,
} from './deterministicDigest';

export const CONTRACT_SOURCE_TRANSFORMATION_ID =
  'bze-274-salaryswish-retained-contract-v1' as const;

export const CONTRACT_EVIDENCE_CATALOG = Object.freeze({
  transformations: Object.freeze([
    { id: 'retain', description: 'Retain the exact source-record value.' },
    {
      id: 'date-only',
      description:
        'Preserve the raw date and normalize only to calendar-date precision.',
    },
    {
      id: 'option-holder',
      description: 'Map PO/ETO to player and TO to team.',
    },
    {
      id: 'no-deadline',
      description:
        'Retain no deadline because the source record supplies none.',
    },
    {
      id: 'incentive-envelope',
      description:
        'Retain aggregate incentive amounts without inventing earning criteria.',
    },
    {
      id: 'guarantee-schedule',
      description:
        'Retain an exact dated guarantee schedule only when present.',
    },
    {
      id: 'source-context',
      description:
        'Retain source context without authorizing a governed action.',
    },
  ]),
  limitations: Object.freeze([
    {
      id: 'team-fallback',
      description:
        'The upstream parser may substitute the observed roster team.',
    },
    {
      id: 'derived-aggregate',
      description:
        'The upstream parser derives this aggregate from retained salary rows.',
    },
    {
      id: 'salary-cap-substitution',
      description:
        'The upstream parser may substitute Salary and Cap Hit when only one column is present.',
    },
    {
      id: 'guarantee-derivation',
      description:
        'The upstream parser may derive protection from row text, option policy, or guarantee details.',
    },
    {
      id: 'not-applicable-or-unsupported',
      description: 'No applicable value or supported source fact is retained.',
    },
    {
      id: 'missing-option-deadline',
      description:
        'The source record does not contain an option notice deadline.',
    },
    {
      id: 'missing-bonus-criteria',
      description: 'The source record contains no per-bonus earning criteria.',
    },
    {
      id: 'missing-protection-schedule',
      description:
        'No dated protection schedule is retained for this salary row.',
    },
    {
      id: 'missing-bonus-allocation',
      description:
        'No bonus-payment timing or allocation schedule is retained.',
    },
    {
      id: 'negative-search-default',
      description:
        'Empty/false restriction values may be upstream negative-search defaults.',
    },
    {
      id: 'context-only',
      description:
        'Source context cannot authorize a rights or free-agency action.',
    },
  ]),
});

export type ContractSourceReleaseBuildInput = Readonly<{
  releaseId: string;
  releaseVersion: number;
  releaseDigest: string;
  supersedes: ContractSourceRelease['supersedes'];
  effectiveAt: string;
  salaryCapYear: number;
  observations: readonly ContractSourceObservation[];
}>;

export const CONTRACT_SOURCE_RELEASE_DESCRIPTOR = Object.freeze({
  provider: 'SalarySwish',
  retainedCorpus: 'player-scrape/contracts/_artifacts/output',
  selectionPolicy:
    'For each source player identity, retain every observation and establish contracts from the greatest source observedAt; artifact path is only a deterministic tie-breaker and equal-time divergent observations remain inspectable.',
  transformationId: CONTRACT_SOURCE_TRANSFORMATION_ID,
  limitations: Object.freeze([
    'The retained source is SalarySwish-derived scraper output, not an NBA-certified contract feed.',
    'Raw HTML was not retained, so field provenance names the exact JSON path and upstream transformation limitation rather than claiming direct page text.',
    'No signing transaction, option deadline, service ledger, bonus criteria, or unreported clause is invented.',
  ]),
  evidenceCatalog: CONTRACT_EVIDENCE_CATALOG,
});

export function contractSourceReleaseDigestMaterial(
  input: Omit<ContractSourceReleaseBuildInput, 'releaseDigest'>
): unknown {
  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
    supersedes: input.supersedes,
    effectiveAt: input.effectiveAt,
    salaryCapYear: input.salaryCapYear,
    source: CONTRACT_SOURCE_RELEASE_DESCRIPTOR,
    observations: [...input.observations].sort((a, b) =>
      compareCodePoints(a.observationId, b.observationId)
    ),
  };
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;
const numberValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const integerValue = (value: unknown): number | null => {
  const valueAsNumber = numberValue(value);
  return valueAsNumber !== null && Number.isInteger(valueAsNumber)
    ? valueAsNumber
    : null;
};
const booleanValue = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;
const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

function dateOnly(raw: unknown): ContractTemporalValue {
  const rawValue = stringValue(raw);
  if (!rawValue) {
    return { precision: 'unknown', value: null, rawValue: null };
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? rawValue
    : (() => {
        const parsed = Date.parse(`${rawValue} 00:00:00 UTC`);
        return Number.isFinite(parsed)
          ? new Date(parsed).toISOString().slice(0, 10)
          : null;
      })();
  return iso
    ? { precision: 'date', value: iso, rawValue }
    : { precision: 'unknown', value: null, rawValue };
}

const optionHolder = (value: unknown): 'player' | 'team' | null =>
  value === 'TO' ? 'team' : value === 'PO' || value === 'ETO' ? 'player' : null;

const slug = (value: string | null): string =>
  (value ?? 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';

export function stableContractIdentity(
  playerId: string,
  contract: UnknownRecord
): string {
  return [
    'salaryswish',
    slug(playerId),
    slug(stringValue(contract.signingDate)),
    slug(stringValue(contract.startSeason)),
    slug(stringValue(contract.endSeason)),
    slug(stringValue(contract.contractType)),
  ].join(':');
}

function normalizeSalaryRow(
  row: UnknownRecord
): GovernedContractTerms['salaries'][number] {
  const incentives = isRecord(row.incentives) ? row.incentives : {};
  const schedule = Array.isArray(row.guaranteeSchedule)
    ? row.guaranteeSchedule.filter(isRecord)
    : [];
  const option: 'PO' | 'TO' | 'ETO' | null =
    row.option === 'PO' || row.option === 'TO' || row.option === 'ETO'
      ? row.option
      : null;
  const likely = numberValue(incentives.likely);
  const unlikely = numberValue(incentives.unlikely);

  return {
    season: stringValue(row.season),
    salary: numberValue(row.salary),
    capHit: numberValue(row.capHit),
    guaranteed: booleanValue(row.guaranteed),
    guaranteedAmount: numberValue(row.guaranteedAmount),
    option,
    optionHolder: optionHolder(option),
    optionUsed: booleanValue(row.optionUsed),
    optionDecisionDate: dateOnly(row.optionDecisionDate),
    optionDecisionDeadline: {
      precision: 'unknown' as const,
      value: null,
      rawValue: null,
    },
    tradeBonus: numberValue(row.tradeBonus),
    incentives: {
      likely,
      unlikely,
      criteriaEvidence:
        (likely ?? 0) !== 0 || (unlikely ?? 0) !== 0
          ? ('unknown' as const)
          : ('unsupported' as const),
    },
    guaranteeSchedule: schedule.map((step) => ({
      effectiveDate: dateOnly(step.effectiveDate),
      guaranteedAmount: numberValue(step.guaranteedAmount),
      status: stringValue(step.status),
      note: typeof step.note === 'string' ? step.note : null,
    })),
    voidedByExtension: booleanValue(row.voidedByExtension),
    voidedOn: dateOnly(row.voidedOn),
  };
}

function normalizeTerms(contract: UnknownRecord): GovernedContractTerms {
  const salaries = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear.filter(isRecord).map(normalizeSalaryRow)
    : [];
  const birdRights = isRecord(contract.birdRights) ? contract.birdRights : {};
  const freeAgency = isRecord(contract.freeAgency) ? contract.freeAgency : {};
  const tradeEligibility = isRecord(contract.tradeEligibility)
    ? contract.tradeEligibility
    : {};
  const tradeRules = isRecord(tradeEligibility.rules)
    ? tradeEligibility.rules
    : {};

  return {
    contractType: stringValue(contract.contractType),
    isExtension: booleanValue(contract.isExtension),
    isRookieScale: booleanValue(contract.isRookieScale),
    signedUsing:
      typeof contract.signedUsing === 'string' ? contract.signedUsing : null,
    signingTeam: stringValue(contract.signingTeam),
    signingDate: dateOnly(contract.signingDate),
    signingExecutive:
      typeof contract.signingExecutive === 'string'
        ? contract.signingExecutive
        : null,
    signedByCurrentTeam: booleanValue(contract.signedByCurrentTeam),
    startSeason: stringValue(contract.startSeason),
    endSeason: stringValue(contract.endSeason),
    contractLength: integerValue(contract.contractLength),
    totalValue: numberValue(contract.totalValue),
    averageAnnualValue: numberValue(contract.averageAnnualValue),
    guaranteedValue: numberValue(contract.guaranteedValue),
    guaranteedYears: integerValue(contract.guaranteedYears),
    salaries,
    bonuses: { tradeKickerPercent: numberValue(contract.tradeKicker) },
    restrictions: {
      noTradeClause: booleanValue(contract.noTradeClause),
      tradeRestrictions: stringArray(contract.tradeRestrictions),
      canBeTradedNow: booleanValue(tradeEligibility.canBeTradedNow),
      restrictedUntil: dateOnly(tradeEligibility.restrictedUntil),
      reason:
        typeof tradeEligibility.reason === 'string'
          ? tradeEligibility.reason
          : null,
      baseYearCompensation: booleanValue(tradeRules.baseYearCompensation),
      poisonPill: booleanValue(tradeRules.poisonPill),
      aggregation: booleanValue(tradeRules.aggregation),
    },
    birdRights: {
      status: typeof birdRights.status === 'string' ? birdRights.status : null,
      yearsOfService: integerValue(birdRights.yearsOfService),
      yearsWithTeam: integerValue(birdRights.yearsWithTeam),
      eligibleFor: stringArray(birdRights.eligibleFor),
    },
    freeAgency: {
      type: typeof freeAgency.type === 'string' ? freeAgency.type : null,
      year: integerValue(freeAgency.year),
      capHold: numberValue(freeAgency.capHold),
      qualifyingOffer: numberValue(freeAgency.qualifyingOffer),
      earlyTerminationOption:
        typeof freeAgency.earlyTerminationOption === 'string'
          ? freeAgency.earlyTerminationOption
          : null,
      hasOption: booleanValue(freeAgency.hasOption),
      optionYear:
        typeof freeAgency.optionYear === 'string'
          ? freeAgency.optionYear
          : null,
      optionType:
        typeof freeAgency.optionType === 'string'
          ? freeAgency.optionType
          : null,
    },
    sourceLimitations: [
      'SalarySwish-derived retained scraper output is reproducible source evidence, not league certification.',
      'The retained JSON does not distinguish every directly published value from parser-derived fallbacks; each transformation remains named in field evidence.',
      'Empty restriction lists and zero bonus values do not prove that no undisclosed clause or component exists.',
      'A source-establishment event documents the world baseline and is not the historical signing transaction.',
    ],
  };
}

function evidenceForTerms(
  contractPath: 'contract' | 'futureContract',
  terms: GovernedContractTerms
): ContractFieldEvidence[] {
  const evidence: ContractFieldEvidence[] = [];
  const add = (
    fieldPath: string,
    status: ContractEvidenceStatus,
    sourcePath: string,
    transformationId: string,
    limitationIds: string[] = []
  ) => {
    evidence.push(
      encodeContractFieldEvidence({
        fieldPath,
        status,
        sourcePath,
        transformationId,
        limitationIds,
      })
    );
  };

  const topLevelFields = [
    'contractType',
    'isExtension',
    'isRookieScale',
    'signedUsing',
    'signingTeam',
    'signingDate',
    'signingExecutive',
    'signedByCurrentTeam',
    'startSeason',
    'endSeason',
    'contractLength',
    'totalValue',
    'averageAnnualValue',
    'guaranteedValue',
    'guaranteedYears',
  ] as const;
  topLevelFields.forEach((field) => {
    const value = terms[field];
    const missing =
      value === null || (isRecord(value) && value.precision === 'unknown');
    add(
      `terms.${field}`,
      missing
        ? 'unknown'
        : field === 'signingDate' ||
            field === 'signingTeam' ||
            field === 'contractLength' ||
            field === 'totalValue' ||
            field === 'averageAnnualValue'
          ? 'derived'
          : 'known',
      `${contractPath}.${field}`,
      field === 'signingDate' ? 'date-only' : 'retain',
      field === 'signingTeam'
        ? ['team-fallback']
        : field === 'contractLength' ||
            field === 'totalValue' ||
            field === 'averageAnnualValue'
          ? ['derived-aggregate']
          : []
    );
  });

  terms.salaries.forEach((row, index) => {
    const sourceBase = `${contractPath}.salariesByYear[${index}]`;
    (
      [
        'season',
        'salary',
        'capHit',
        'guaranteed',
        'guaranteedAmount',
        'option',
        'optionUsed',
        'optionDecisionDate',
        'tradeBonus',
        'voidedByExtension',
        'voidedOn',
      ] as const
    ).forEach((field) => {
      const value = row[field];
      const missing =
        value === null || (isRecord(value) && value.precision === 'unknown');
      add(
        `terms.salaries[${index}].${field}`,
        missing
          ? 'unknown'
          : field === 'optionDecisionDate' ||
              field === 'voidedOn' ||
              field === 'salary' ||
              field === 'capHit' ||
              field === 'guaranteed' ||
              field === 'guaranteedAmount'
            ? 'derived'
            : 'known',
        `${sourceBase}.${field}`,
        field === 'optionDecisionDate' || field === 'voidedOn'
          ? 'date-only'
          : 'retain',
        field === 'salary' || field === 'capHit'
          ? ['salary-cap-substitution']
          : field === 'guaranteed' || field === 'guaranteedAmount'
            ? ['guarantee-derivation']
            : []
      );
    });
    add(
      `terms.salaries[${index}].optionHolder`,
      row.optionHolder ? 'derived' : 'unknown',
      `${sourceBase}.option`,
      'option-holder',
      row.optionHolder ? [] : ['not-applicable-or-unsupported']
    );
    add(
      `terms.salaries[${index}].optionDecisionDeadline`,
      row.option ? 'unknown' : 'unsupported',
      `${sourceBase}.option`,
      'no-deadline',
      ['missing-option-deadline']
    );
    add(
      `terms.salaries[${index}].incentives`,
      row.incentives.criteriaEvidence === 'unknown' ? 'unknown' : 'unsupported',
      `${sourceBase}.incentives`,
      'incentive-envelope',
      ['missing-bonus-criteria']
    );
    add(
      `terms.salaries[${index}].guaranteeSchedule`,
      row.guaranteeSchedule.length > 0 ? 'known' : 'unsupported',
      `${sourceBase}.guaranteeSchedule`,
      'guarantee-schedule',
      row.guaranteeSchedule.length > 0 ? [] : ['missing-protection-schedule']
    );
  });

  add(
    'terms.bonuses',
    terms.bonuses.tradeKickerPercent === null ? 'unsupported' : 'known',
    `${contractPath}.tradeKicker`,
    'retain',
    ['missing-bonus-allocation']
  );
  add(
    'terms.restrictions',
    'derived',
    `${contractPath}.tradeRestrictions`,
    'source-context',
    ['negative-search-default']
  );
  add(
    'terms.birdRights',
    'derived',
    `${contractPath}.birdRights`,
    'source-context',
    ['context-only']
  );
  add(
    'terms.freeAgency',
    'derived',
    `${contractPath}.freeAgency`,
    'source-context',
    ['context-only']
  );

  return evidence.sort(compareCodePoints);
}

function contractProblems(
  contract: UnknownRecord,
  terms: GovernedContractTerms
) {
  const reasons: string[] = [];
  if (terms.signingDate.precision === 'unknown') {
    reasons.push('Missing a source-supported signing date.');
  }
  if (terms.salaries.length === 0) {
    reasons.push('Missing a replayable salary schedule.');
  }
  if (!terms.startSeason || !terms.endSeason) {
    reasons.push('Missing a source-supported contract term boundary.');
  }
  if (!terms.contractType || !terms.signingTeam) {
    reasons.push('Missing source-supported contract type or team identity.');
  }
  if (
    Array.isArray(contract.salariesByYear) &&
    contract.salariesByYear.some(
      (row) =>
        !isRecord(row) ||
        !stringValue(row.season) ||
        numberValue(row.salary) === null ||
        numberValue(row.capHit) === null
    )
  ) {
    reasons.push('A salary row is malformed or lacks Salary/Cap Hit evidence.');
  }
  return [...new Set(reasons)].sort(compareCodePoints);
}

function parseObservation(
  observation: ContractSourceObservation
): UnknownRecord {
  const parsed: unknown = JSON.parse(observation.artifactContent);
  if (!isRecord(parsed)) {
    throw new Error(`${observation.observationId} does not contain an object.`);
  }
  return parsed;
}

function releaseState(
  release: ContractSourceReleaseBuildInput,
  observation: ContractSourceObservation,
  raw: UnknownRecord,
  contractPath: 'contract' | 'futureContract'
): GovernedContractState | null {
  const contract = raw[contractPath];
  if (!isRecord(contract)) return null;
  const playerId = stringValue(raw.playerId);
  const teamId = stringValue(raw.teamCode);
  if (!playerId || !teamId) return null;
  const contractId = stableContractIdentity(playerId, contract);
  const terms = normalizeTerms(contract);
  const reasons = contractProblems(contract, terms);
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    stateVersion: 1,
    contractId,
    contractVersion: 1,
    playerId,
    teamId,
    establishmentKind: 'source-establishment',
    terms,
    evidence: evidenceForTerms(contractPath, terms),
    completeness: {
      status: reasons.length === 0 ? 'complete' : 'needs-input',
      reasons,
    },
    source: {
      releaseId: release.releaseId,
      releaseVersion: release.releaseVersion,
      releaseDigest: release.releaseDigest,
      sourceProvider: observation.sourceProvider,
      sourceRecordVersion: observation.sourceRecordVersion,
      sourceObservationId: observation.observationId,
      sourceArtifactSha256: observation.artifactSha256,
      sourceContractPath: contractPath,
    },
  };
  return {
    ...stateWithoutDigest,
    stateDigest: deterministicStateDigest(stateWithoutDigest),
  };
}

function selectedObservations(
  observations: readonly ContractSourceObservation[]
): ContractSourceObservation[] {
  const byPlayer = new Map<string, ContractSourceObservation[]>();
  observations.forEach((observation) => {
    ZonedDateTimeZ.parse(observation.observedAt);
    const values = byPlayer.get(observation.playerId) ?? [];
    values.push(observation);
    byPlayer.set(observation.playerId, values);
  });
  return [...byPlayer.values()]
    .map(
      (values) =>
        [...values]
          .sort((a, b) =>
            Date.parse(ZonedDateTimeZ.parse(a.observedAt)) ===
            Date.parse(ZonedDateTimeZ.parse(b.observedAt))
              ? compareCodePoints(a.artifactPath, b.artifactPath)
              : Date.parse(ZonedDateTimeZ.parse(a.observedAt)) -
                Date.parse(ZonedDateTimeZ.parse(b.observedAt))
          )
          .at(-1) as ContractSourceObservation
    )
    .sort((a, b) => compareCodePoints(a.playerId, b.playerId));
}

function coverageFor(
  observations: readonly ContractSourceObservation[],
  records: readonly ContractSourceBaselineRecord[]
): ContractSourceCoverage {
  const completeRecordIds = records
    .filter(
      (record) => record.resultingState.completeness.status === 'complete'
    )
    .map((record) => record.contractId)
    .sort(compareCodePoints);
  const needsInputRecordIds = records
    .filter(
      (record) => record.resultingState.completeness.status === 'needs-input'
    )
    .map((record) => record.contractId)
    .sort(compareCodePoints);
  const categories = new Map<string, string[]>();
  records.forEach((record) => {
    record.resultingState.completeness.reasons.forEach((reason) => {
      const ids = categories.get(reason) ?? [];
      ids.push(record.contractId);
      categories.set(reason, ids);
    });
  });
  const pendingOptions = records.filter((record) =>
    record.resultingState.terms.salaries.some(
      (row) => row.option !== null && row.optionUsed === null
    )
  );
  const incentiveCriteriaMissing = records
    .filter((record) =>
      record.resultingState.terms.salaries.some(
        (row) => row.incentives.criteriaEvidence === 'unknown'
      )
    )
    .map((record) => record.contractId)
    .sort(compareCodePoints);
  const allRecordIds = records
    .map((record) => record.contractId)
    .sort(compareCodePoints);

  return {
    sourceObservationCount: observations.length,
    uniquePlayerCount: new Set(observations.map((entry) => entry.playerId))
      .size,
    totalSourceContracts: records.length,
    completeRecordIds,
    needsInputRecordIds,
    excludedCorruptRecordIds: [],
    missingByCategory: [...categories.entries()]
      .sort(([a], [b]) => compareCodePoints(a, b))
      .map(([category, recordIds]) => ({
        category,
        recordIds: recordIds.sort(compareCodePoints),
      })),
    laterRouteReadiness: {
      option: {
        readyRecordIds: [],
        blockedRecordIds: pendingOptions
          .map((record) => record.contractId)
          .sort(compareCodePoints),
        missingByCategory: [
          {
            category:
              'Source records do not retain the applicable option notice deadline.',
            recordIds: pendingOptions
              .map((record) => record.contractId)
              .sort(compareCodePoints),
          },
        ],
      },
      extension: {
        readyRecordIds: [],
        blockedRecordIds: allRecordIds,
        missingByCategory: [
          {
            category:
              'Exact service, team/transaction history, and dated restriction evidence is outside this source release.',
            recordIds: allRecordIds,
          },
          {
            category:
              'Per-bonus criteria are missing where incentive amounts are retained.',
            recordIds: incentiveCriteriaMissing,
          },
        ],
      },
    },
  };
}

export function buildContractSourceRelease(
  input: ContractSourceReleaseBuildInput
): ContractSourceRelease {
  const records: ContractSourceBaselineRecord[] = [];
  selectedObservations(input.observations).forEach((observation) => {
    const raw = parseObservation(observation);
    (['contract', 'futureContract'] as const).forEach((contractPath) => {
      const resultingState = releaseState(
        input,
        observation,
        raw,
        contractPath
      );
      if (!resultingState) return;
      records.push({
        contractId: resultingState.contractId,
        contractVersion: 1,
        playerId: resultingState.playerId,
        teamId: resultingState.teamId,
        sourceObservationId: observation.observationId,
        sourceContractPath: contractPath,
        resultingState,
      });
    });
  });
  records.sort((a, b) => compareCodePoints(a.contractId, b.contractId));
  const duplicates = records.filter(
    (record, index) =>
      index > 0 && record.contractId === records[index - 1].contractId
  );
  if (duplicates.length > 0) {
    throw new Error(
      `Contract-source release has duplicate stable identities: ${duplicates
        .map((record) => record.contractId)
        .join(', ')}`
    );
  }

  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
    releaseDigest: input.releaseDigest,
    supersedes: input.supersedes,
    effectiveAt: input.effectiveAt,
    salaryCapYear: input.salaryCapYear,
    source: {
      ...CONTRACT_SOURCE_RELEASE_DESCRIPTOR,
      limitations: [...CONTRACT_SOURCE_RELEASE_DESCRIPTOR.limitations],
      evidenceCatalog: {
        transformations: CONTRACT_EVIDENCE_CATALOG.transformations.map(
          (entry) => ({ ...entry })
        ),
        limitations: CONTRACT_EVIDENCE_CATALOG.limitations.map((entry) => ({
          ...entry,
        })),
      },
    },
    observations: [...input.observations].sort((a, b) =>
      compareCodePoints(a.observationId, b.observationId)
    ),
    records,
    coverage: coverageFor(input.observations, records),
  };
}

export function normalizedReleaseContent(
  release: ContractSourceRelease
): string {
  return canonicalStringify(release);
}
