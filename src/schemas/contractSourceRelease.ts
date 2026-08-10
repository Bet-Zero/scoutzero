/** Immutable retained-source release and fresh-world baseline wire contracts. */

import { z } from 'zod';
import { GovernedContractStateZ } from './governedContractState';
import { ContractEventLedgerPayloadZ } from './contractEventLedger';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const Sha256Z = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const ContractSourceReleasePinZ = z.strictObject({
  releaseId: NonEmptyStringZ,
  releaseVersion: z.number().int().min(1),
  releaseDigest: Sha256Z,
});

export const ContractSourceObservationZ = z.strictObject({
  observationId: NonEmptyStringZ,
  artifactPath: NonEmptyStringZ,
  artifactSha256: Sha256Z,
  sourceProvider: NonEmptyStringZ,
  sourceRecordVersion: NonEmptyStringZ,
  observedAt: NonEmptyStringZ,
  playerId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  artifactContent: NonEmptyStringZ,
});

export const ContractSourceBaselineRecordZ = z.strictObject({
  contractId: NonEmptyStringZ,
  contractVersion: z.literal(1),
  playerId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  sourceObservationId: NonEmptyStringZ,
  sourceContractPath: z.enum(['contract', 'futureContract']),
  resultingState: GovernedContractStateZ,
});

const CoverageCategoryZ = z.strictObject({
  category: NonEmptyStringZ,
  recordIds: z.array(NonEmptyStringZ),
});

const RouteReadinessZ = z.strictObject({
  readyRecordIds: z.array(NonEmptyStringZ),
  blockedRecordIds: z.array(NonEmptyStringZ),
  missingByCategory: z.array(CoverageCategoryZ),
});

const EvidenceCatalogZ = z.strictObject({
  transformations: z.array(
    z.strictObject({ id: NonEmptyStringZ, description: NonEmptyStringZ })
  ),
  limitations: z.array(
    z.strictObject({ id: NonEmptyStringZ, description: NonEmptyStringZ })
  ),
});

export const ContractSourceCoverageZ = z.strictObject({
  sourceObservationCount: z.number().int().nonnegative(),
  uniquePlayerCount: z.number().int().nonnegative(),
  totalSourceContracts: z.number().int().nonnegative(),
  completeRecordIds: z.array(NonEmptyStringZ),
  needsInputRecordIds: z.array(NonEmptyStringZ),
  excludedCorruptRecordIds: z.array(NonEmptyStringZ),
  missingByCategory: z.array(CoverageCategoryZ),
  laterRouteReadiness: z.strictObject({
    option: RouteReadinessZ,
    extension: RouteReadinessZ,
  }),
});

export const ContractSourceReleaseZ = z.strictObject({
  schemaVersion: z.literal(1),
  releaseId: NonEmptyStringZ,
  releaseVersion: z.number().int().min(1),
  releaseDigest: Sha256Z,
  supersedes: ContractSourceReleasePinZ.nullable(),
  effectiveAt: NonEmptyStringZ,
  salaryCapYear: z.number().int().min(2000).max(3000),
  source: z.strictObject({
    provider: NonEmptyStringZ,
    retainedCorpus: NonEmptyStringZ,
    selectionPolicy: NonEmptyStringZ,
    transformationId: NonEmptyStringZ,
    limitations: z.array(NonEmptyStringZ),
    evidenceCatalog: EvidenceCatalogZ,
  }),
  observations: z.array(ContractSourceObservationZ),
  records: z.array(ContractSourceBaselineRecordZ),
  coverage: ContractSourceCoverageZ,
});

export const CONTRACT_BASELINE_WORLD_VERSION = 2;

export const WorldContractBaselineMetadataZ = z.strictObject({
  contractBaselineVersion: z.literal(CONTRACT_BASELINE_WORLD_VERSION),
  contractSourceRelease: ContractSourceReleasePinZ,
  contractBaselineEffectiveAt: NonEmptyStringZ,
  contractBaselineSalaryCapYear: z.number().int().min(2000).max(3000),
  contractBaselineCoverage: z.strictObject({
    total: z.number().int().nonnegative(),
    complete: z.number().int().nonnegative(),
    needsInput: z.number().int().nonnegative(),
  }),
});

export const ContractBaselineTeamDocumentZ = z.strictObject({
  documentVersion: z.literal(1),
  worldId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  shardId: NonEmptyStringZ,
  shardIndex: z.number().int().nonnegative(),
  shardCount: z.number().int().min(1),
  release: ContractSourceReleasePinZ,
  evidenceCatalog: EvidenceCatalogZ,
  ledgers: z.array(ContractEventLedgerPayloadZ),
  documentDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
});

export type ContractSourceReleasePin = z.infer<typeof ContractSourceReleasePinZ>;
export type ContractSourceObservation = z.infer<typeof ContractSourceObservationZ>;
export type ContractSourceBaselineRecord = z.infer<
  typeof ContractSourceBaselineRecordZ
>;
export type ContractSourceCoverage = z.infer<typeof ContractSourceCoverageZ>;
export type ContractSourceRelease = z.infer<typeof ContractSourceReleaseZ>;
export type WorldContractBaselineMetadata = z.infer<
  typeof WorldContractBaselineMetadataZ
>;
export type ContractBaselineTeamDocument = z.infer<
  typeof ContractBaselineTeamDocumentZ
>;
