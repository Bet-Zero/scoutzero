/** Canonical replayable contract state carried by every version-two event. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const NullableStringZ = NonEmptyStringZ.nullable();
const NullableFiniteNumberZ = z.number().finite().nullable();
const NullableIntegerZ = z.number().int().nullable();

export const ContractEvidenceStatusZ = z.enum([
  'known',
  'derived',
  'unknown',
  'unsupported',
  'conflicting',
]);

export const ContractTemporalValueZ = z.strictObject({
  precision: z.enum(['instant', 'date', 'month', 'year', 'unknown']),
  value: NullableStringZ,
  rawValue: z.string().nullable(),
});

const FIELD_EVIDENCE_SEPARATOR = '|';

export type DecodedContractFieldEvidence = Readonly<{
  fieldPath: string;
  status: z.infer<typeof ContractEvidenceStatusZ>;
  sourcePath: string;
  transformationId: string;
  limitationIds: readonly string[];
}>;

/**
 * Compact immutable field-evidence receipt:
 * field path | status | source path | transformation ID | limitation IDs.
 *
 * A baseline world carries tens of thousands of field receipts. Repeating
 * object keys would push the atomic creation request beyond Firestore's 10 MiB
 * ceiling, while tuples become arrays nested inside the evidence array and are
 * rejected by the Firestore browser SDK. This validated scalar encoding keeps
 * every value explicit and round-trippable without either failure mode.
 */
export function encodeContractFieldEvidence(
  evidence: DecodedContractFieldEvidence
): string {
  const components = [
    evidence.fieldPath,
    evidence.status,
    evidence.sourcePath,
    evidence.transformationId,
    evidence.limitationIds.join(','),
  ];
  if (
    components.slice(0, 4).some((value) => value.trim().length === 0) ||
    components.some((value) => value.includes(FIELD_EVIDENCE_SEPARATOR)) ||
    evidence.limitationIds.some(
      (value) => value.trim().length === 0 || value.includes(',')
    )
  ) {
    throw new Error('Contract field evidence contains an invalid component.');
  }
  return components.join(FIELD_EVIDENCE_SEPARATOR);
}

export function decodeContractFieldEvidence(
  receipt: string
): DecodedContractFieldEvidence {
  const [
    fieldPath,
    rawStatus,
    sourcePath,
    transformationId,
    rawLimitations,
    ...rest
  ] = receipt.split(FIELD_EVIDENCE_SEPARATOR);
  if (rest.length > 0) {
    throw new Error('Contract field evidence has too many components.');
  }
  if (rawLimitations === undefined) {
    throw new Error('Contract field evidence has too few components.');
  }
  return {
    fieldPath: NonEmptyStringZ.parse(fieldPath),
    status: ContractEvidenceStatusZ.parse(rawStatus),
    sourcePath: NonEmptyStringZ.parse(sourcePath),
    transformationId: NonEmptyStringZ.parse(transformationId),
    limitationIds:
      rawLimitations === ''
        ? []
        : rawLimitations
            .split(',')
            .map((value) => NonEmptyStringZ.parse(value)),
  };
}

export const ContractFieldEvidenceZ = z
  .string()
  .superRefine((receipt, context) => {
    try {
      decodeContractFieldEvidence(receipt);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message:
          error instanceof Error
            ? error.message
            : 'Invalid contract field evidence.',
      });
    }
  });

export const ContractGuaranteeStepZ = z.strictObject({
  effectiveDate: ContractTemporalValueZ,
  guaranteedAmount: NullableFiniteNumberZ,
  status: NullableStringZ,
  note: z.string().nullable(),
});

/**
 * Pinned counterfactual free-agency evidence for an ordinary Option.
 *
 * This stays as an explicit source receipt rather than consulting the mutable
 * current free-agency projection. The outer option-terms field is deliberately
 * parsed as unknown so incomplete or malformed retained evidence can reach the
 * decision authority and return a specific Needs input result instead of
 * making the entire governed Contract history unreadable.
 */
export const GovernedOptionRfaRelevanceEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  status: ContractEvidenceStatusZ,
  declineFreeAgencyStatus: z.enum(['RFA', 'UFA']).nullable(),
  salaryCapYear: z.number().int(),
  observedAt: ContractTemporalValueZ,
  sourceIdentity: z.strictObject({
    releaseId: NonEmptyStringZ,
    releaseVersion: z.number().int().min(1),
    releaseDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    sourceProvider: NonEmptyStringZ,
    sourceRecordVersion: NonEmptyStringZ,
    sourceObservationId: NonEmptyStringZ,
    sourceArtifactSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    sourceContractPath: z.enum(['contract', 'futureContract']),
  }),
});

/**
 * Immutable option/ETO rule inputs supplied by a governed contract source.
 *
 * The retained BZE-274 release intentionally has none of these records because
 * it does not contain exact option deadlines. Keeping this object optional
 * preserves that honest baseline while allowing a later governed release (and
 * complete acceptance fixtures) to prove the executable BZE-275 route without
 * inferring dates or amending an immutable baseline in the browser.
 */
export const GovernedOptionDecisionTermsZ = z.strictObject({
  termsVersion: z.literal(1),
  conditional: z.boolean(),
  decisionWindowOpensAt: ContractTemporalValueZ,
  contractEndsAt: ContractTemporalValueZ,
  nonCompensationTermsMatchPriorSeason: z.boolean(),
  compensationProtectionMatchesPriorSeason: z.boolean(),
  rookieScaleOptionOrdinal: z.enum(['third', 'fourth']).nullable(),
  rookieScaleFourthSeasonTermsMatchThird: z.boolean().nullable(),
  playerOptionProtectionAlternative: z.enum(['A', 'B']).nullable(),
  preExerciseProtectionApplies: z.boolean().nullable(),
  teamLastGameAt: ContractTemporalValueZ,
  rfaDeclarationDeadline: ContractTemporalValueZ,
  rfaRelevanceEvidence: z.unknown().nullable().optional(),
  etoOrigin: z.enum(['original-contract', 'rookie-scale-extension']).nullable(),
  etoAddedDuringOriginalTerm: z.boolean().nullable(),
  allowedNoticeMethods: z
    .array(
      z.enum([
        'personal-delivery',
        'email',
        'certified-mail',
        'registered-mail',
        'facsimile',
      ])
    )
    .min(1),
  noticeRecipient: z.enum(['player', 'team']),
  leagueForwardingRequired: z.boolean(),
});

export const ContractSalaryTermZ = z.strictObject({
  season: NullableStringZ,
  salary: NullableFiniteNumberZ,
  capHit: NullableFiniteNumberZ,
  guaranteed: z.boolean().nullable(),
  guaranteedAmount: NullableFiniteNumberZ,
  option: z.enum(['PO', 'TO', 'ETO']).nullable(),
  optionHolder: z.enum(['player', 'team']).nullable(),
  optionUsed: z.boolean().nullable(),
  optionDecisionDate: ContractTemporalValueZ,
  optionDecisionDeadline: ContractTemporalValueZ,
  optionDecisionTerms: GovernedOptionDecisionTermsZ.nullable().optional(),
  tradeBonus: NullableFiniteNumberZ,
  incentives: z.strictObject({
    likely: NullableFiniteNumberZ,
    unlikely: NullableFiniteNumberZ,
    criteriaEvidence: z.enum(['known', 'unknown', 'unsupported']),
  }),
  guaranteeSchedule: z.array(ContractGuaranteeStepZ),
  voidedByExtension: z.boolean().nullable(),
  voidedOn: ContractTemporalValueZ,
});

export const GovernedContractTermsZ = z.strictObject({
  contractType: NullableStringZ,
  isExtension: z.boolean().nullable(),
  isRookieScale: z.boolean().nullable(),
  signedUsing: z.string().nullable(),
  signingTeam: NullableStringZ,
  signingDate: ContractTemporalValueZ,
  signingExecutive: z.string().nullable(),
  signedByCurrentTeam: z.boolean().nullable(),
  startSeason: NullableStringZ,
  endSeason: NullableStringZ,
  contractLength: NullableIntegerZ,
  totalValue: NullableFiniteNumberZ,
  averageAnnualValue: NullableFiniteNumberZ,
  guaranteedValue: NullableFiniteNumberZ,
  guaranteedYears: NullableIntegerZ,
  salaries: z.array(ContractSalaryTermZ),
  bonuses: z.strictObject({
    tradeKickerPercent: NullableFiniteNumberZ,
  }),
  restrictions: z.strictObject({
    noTradeClause: z.boolean().nullable(),
    tradeRestrictions: z.array(z.string()),
    canBeTradedNow: z.boolean().nullable(),
    restrictedUntil: ContractTemporalValueZ,
    reason: z.string().nullable(),
    baseYearCompensation: z.boolean().nullable(),
    poisonPill: z.boolean().nullable(),
    aggregation: z.boolean().nullable(),
  }),
  birdRights: z.strictObject({
    status: z.string().nullable(),
    yearsOfService: NullableIntegerZ,
    yearsWithTeam: NullableIntegerZ,
    eligibleFor: z.array(z.string()),
  }),
  freeAgency: z.strictObject({
    type: z.string().nullable(),
    year: NullableIntegerZ,
    capHold: NullableFiniteNumberZ,
    qualifyingOffer: NullableFiniteNumberZ,
    earlyTerminationOption: z.string().nullable(),
    hasOption: z.boolean().nullable(),
    optionYear: z.string().nullable(),
    optionType: z.string().nullable(),
  }),
  // Parsed by the governed extension path. Unknown here by design so a
  // malformed future release returns a precise Needs input result instead of
  // making the entire immutable Contract history unreadable.
  extensionEvidence: z.unknown().nullable().optional(),
  extensionLeagueEvidence: z.unknown().nullable().optional(),
  extensionHigherMax: z
    .strictObject({
      percentage: z.number().finite().min(25).max(30),
      status: z.enum(['pending', 'qualified-at-signing']),
      firstExtendedSalaryCapYear: z.number().int(),
      determinationId: NullableStringZ,
      resolutionEventId: NullableStringZ,
    })
    .nullable()
    .optional(),
  sourceLimitations: z.array(NonEmptyStringZ),
});

const RetainedContractSourceZ = z.strictObject({
  releaseId: NonEmptyStringZ,
  releaseVersion: z.number().int().min(1),
  releaseDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceProvider: NonEmptyStringZ,
  sourceRecordVersion: NonEmptyStringZ,
  sourceObservationId: NonEmptyStringZ,
  sourceArtifactSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceContractPath: z.enum(['contract', 'futureContract']),
});

/** Provenance for a Contract authored by an atomic saved-world mutation. */
const AuthoredSigningContractSourceZ = z.strictObject({
  sourceKind: z.literal('saved-world-signing'),
  operationId: NonEmptyStringZ,
  authoringIdentity: NonEmptyStringZ,
  recordedAt: NonEmptyStringZ,
  worldAsOfDate: NonEmptyStringZ,
});

export const GovernedContractStateZ = z.strictObject({
  stateVersion: z.literal(1),
  contractId: NonEmptyStringZ,
  contractVersion: z.number().int().min(1),
  playerId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  establishmentKind: z.enum(['signing', 'source-establishment']),
  terms: GovernedContractTermsZ,
  evidence: z.array(ContractFieldEvidenceZ),
  completeness: z.strictObject({
    status: z.enum(['complete', 'needs-input']),
    reasons: z.array(NonEmptyStringZ),
  }),
  source: z.union([RetainedContractSourceZ, AuthoredSigningContractSourceZ]),
  stateDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
});

export type ContractEvidenceStatus = z.infer<typeof ContractEvidenceStatusZ>;
export type ContractTemporalValue = z.infer<typeof ContractTemporalValueZ>;
export type ContractFieldEvidence = z.infer<typeof ContractFieldEvidenceZ>;
export type GovernedOptionDecisionTerms = z.infer<
  typeof GovernedOptionDecisionTermsZ
>;
export type GovernedOptionRfaRelevanceEvidence = z.infer<
  typeof GovernedOptionRfaRelevanceEvidenceZ
>;
export type ContractSalaryTerm = z.infer<typeof ContractSalaryTermZ>;
export type GovernedContractTerms = z.infer<typeof GovernedContractTermsZ>;
export type GovernedContractState = z.infer<typeof GovernedContractStateZ>;
