/** Governed contract-source release verification and world-baseline construction. */

import {
  CONTRACT_BASELINE_WORLD_VERSION,
  ContractBaselineTeamDocumentZ,
  ContractSourceReleaseZ,
  WorldContractBaselineMetadataZ,
  type ContractBaselineTeamDocument,
  type ContractSourceRelease,
  type ContractSourceReleasePin,
  type WorldContractBaselineMetadata,
} from '@/schemas/contractSourceRelease';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import {
  canonicalStringify,
  deterministicStateDigest,
  sha256Digest,
} from './deterministicDigest';
import {
  buildContractSourceRelease,
  contractSourceReleaseDigestMaterial,
} from './contractSourceReleaseBuilder';

export const BUNDLED_CONTRACT_SOURCE_RELEASE_URL =
  '/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json';

export const BUNDLED_CONTRACT_SOURCE_RELEASE_PIN: ContractSourceReleasePin =
  Object.freeze({
    releaseId: 'salaryswish-retained-2026-06-05',
    releaseVersion: 1,
    releaseDigest:
      'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950',
  });

let releaseLoaderOverride: (() => Promise<ContractSourceRelease>) | null = null;
let bundledReleasePromise: Promise<ContractSourceRelease> | null = null;

/** Test harness injection; production callers never set this boundary. */
export function setContractSourceReleaseLoaderForTests(
  loader: (() => Promise<ContractSourceRelease>) | null
): void {
  releaseLoaderOverride = loader;
  bundledReleasePromise = null;
}

export class ContractSourceReleaseError extends Error {
  constructor(message: string) {
    super(`Invalid contract-source release: ${message}`);
    this.name = 'ContractSourceReleaseError';
  }
}

function releasePin(release: ContractSourceRelease): ContractSourceReleasePin {
  return Object.freeze({
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseDigest: release.releaseDigest,
  });
}

export async function verifyContractSourceRelease(
  value: unknown,
  expectedPin: ContractSourceReleasePin = BUNDLED_CONTRACT_SOURCE_RELEASE_PIN
): Promise<ContractSourceRelease> {
  const parsed = ContractSourceReleaseZ.safeParse(value);
  if (!parsed.success) {
    throw new ContractSourceReleaseError(parsed.error.issues[0]?.message ?? 'manifest is malformed');
  }
  const release = parsed.data;
  if (
    release.releaseId !== expectedPin.releaseId ||
    release.releaseVersion !== expectedPin.releaseVersion ||
    release.releaseDigest !== expectedPin.releaseDigest
  ) {
    throw new ContractSourceReleaseError(
      `expected ${expectedPin.releaseId}@v${expectedPin.releaseVersion} (${expectedPin.releaseDigest}) but received ${release.releaseId}@v${release.releaseVersion} (${release.releaseDigest})`
    );
  }
  if (release.releaseVersion === 1 && release.supersedes !== null) {
    throw new ContractSourceReleaseError('version one cannot supersede another release');
  }
  if (
    release.releaseVersion > 1 &&
    (!release.supersedes ||
      release.supersedes.releaseId !== release.releaseId ||
      release.supersedes.releaseVersion >= release.releaseVersion)
  ) {
    throw new ContractSourceReleaseError('the release supersession chain is broken');
  }

  const observationIds = new Set<string>();
  for (const observation of release.observations) {
    if (observationIds.has(observation.observationId)) {
      throw new ContractSourceReleaseError(
        `duplicate source observation ${observation.observationId}`
      );
    }
    observationIds.add(observation.observationId);
  }
  const artifactDigests = await Promise.all(
    release.observations.map((observation) =>
      sha256Digest(observation.artifactContent)
    )
  );
  artifactDigests.forEach((digest, index) => {
    const observation = release.observations[index];
    if (digest !== observation.artifactSha256) {
      throw new ContractSourceReleaseError(
        `artifact digest mismatch for ${observation.observationId}`
      );
    }
  });

  const digestMaterial = contractSourceReleaseDigestMaterial({
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    supersedes: release.supersedes,
    effectiveAt: release.effectiveAt,
    salaryCapYear: release.salaryCapYear,
    observations: release.observations,
  });
  const computedReleaseDigest = await sha256Digest(
    canonicalStringify(digestMaterial)
  );
  if (computedReleaseDigest !== release.releaseDigest) {
    throw new ContractSourceReleaseError(
      `release digest mismatch: expected ${release.releaseDigest}, recomputed ${computedReleaseDigest}`
    );
  }

  const rebuilt = buildContractSourceRelease({
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseDigest: release.releaseDigest,
    supersedes: release.supersedes,
    effectiveAt: release.effectiveAt,
    salaryCapYear: release.salaryCapYear,
    observations: release.observations,
  });
  if (canonicalStringify(rebuilt) !== canonicalStringify(release)) {
    throw new ContractSourceReleaseError(
      'normalized records or coverage do not reproduce from the retained source observations'
    );
  }
  return Object.freeze(release);
}

export async function loadBundledContractSourceRelease(): Promise<ContractSourceRelease> {
  if (releaseLoaderOverride) return releaseLoaderOverride();
  bundledReleasePromise ??= (async () => {
    const response = await fetch(BUNDLED_CONTRACT_SOURCE_RELEASE_URL, {
      cache: 'force-cache',
    });
    if (!response.ok) {
      throw new ContractSourceReleaseError(
        `bundled release could not be loaded (${response.status})`
      );
    }
    return verifyContractSourceRelease(await response.json());
  })();
  return bundledReleasePromise;
}

function documentDigest(value: unknown): string {
  return deterministicStateDigest(value);
}

// Leave ample headroom beneath Firestore's 1 MiB document ceiling for wire
// encoding overhead. The split is content-addressed and deterministic.
const CONTRACT_BASELINE_SHARD_TARGET_BYTES = 700_000;

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(canonicalStringify(value)).length;
}

function partitionLedgers(
  ledgers: readonly ContractEventLedgerPayload[],
  common: Pick<
    ContractBaselineTeamDocument,
    'documentVersion' | 'worldId' | 'teamId' | 'release' | 'evidenceCatalog'
  >
): ContractEventLedgerPayload[][] {
  const shards: ContractEventLedgerPayload[][] = [];
  let current: ContractEventLedgerPayload[] = [];
  for (const ledger of ledgers) {
    const candidate = [...current, ledger];
    if (
      current.length > 0 &&
      serializedBytes({ ...common, ledgers: candidate }) >
        CONTRACT_BASELINE_SHARD_TARGET_BYTES
    ) {
      shards.push(current);
      current = [ledger];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) shards.push(current);
  return shards;
}

export function buildContractBaselineTeamDocuments(
  release: ContractSourceRelease,
  worldId: string
): readonly ContractBaselineTeamDocument[] {
  const recordsByTeam = new Map<
    string,
    ContractSourceRelease['records'][number][]
  >();
  release.records.forEach((record) => {
    const records = recordsByTeam.get(record.teamId) ?? [];
    records.push(record);
    recordsByTeam.set(record.teamId, records);
  });
  const pin = releasePin(release);
  return Object.freeze(
    [...recordsByTeam.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([teamId, records]) => {
        const ledgers = records
          .sort((a, b) => a.contractId.localeCompare(b.contractId))
          .map((record) =>
            toContractEventLedgerPayload(
              createContractEventLedger({
                ledgerId: `${worldId}:${record.contractId}:contract`,
                ledgerVersion: 1,
                events: [
                  {
                    eventId: `${record.contractId}:source-establishment`,
                    eventVersion: 1,
                    eventKind: 'source-establishment',
                    worldId,
                    contractId: record.contractId,
                    playerId: record.playerId,
                    teamId: record.teamId,
                    executedAt: release.effectiveAt,
                    effectiveAt: release.effectiveAt,
                    recordedAt: release.effectiveAt,
                    predecessorContractVersion: null,
                    resultingContractVersion: 1,
                    predecessorEventId: null,
                    sourceTransactionId: `${release.releaseId}@v${release.releaseVersion}:${record.sourceObservationId}:${record.sourceContractPath}`,
                    authoringIdentity: null,
                    recordStatus: 'current',
                    supersedesEventVersion: null,
                    canonLeafIds: ['CBA2-L02.1'],
                    resultingState: record.resultingState,
                  },
                ],
              })
            )
          );
        const common = {
          documentVersion: 1 as const,
          worldId,
          teamId,
          release: pin,
          evidenceCatalog: release.source.evidenceCatalog,
        };
        const shards = partitionLedgers(ledgers, common);
        return shards.map((shardLedgers, shardIndex) => {
          const shardId = `${teamId}-${String(shardIndex).padStart(3, '0')}`;
          const withoutDigest = {
            ...common,
            shardId,
            shardIndex,
            shardCount: shards.length,
            ledgers: shardLedgers,
          };
          return ContractBaselineTeamDocumentZ.parse({
            ...withoutDigest,
            documentDigest: documentDigest(withoutDigest),
          });
        });
      })
  );
}

export function contractBaselineMetadata(
  release: ContractSourceRelease
): WorldContractBaselineMetadata {
  return Object.freeze({
    contractBaselineVersion: CONTRACT_BASELINE_WORLD_VERSION,
    contractSourceRelease: releasePin(release),
    contractBaselineEffectiveAt: release.effectiveAt,
    contractBaselineSalaryCapYear: release.salaryCapYear,
    contractBaselineCoverage: Object.freeze({
      total: release.coverage.totalSourceContracts,
      complete: release.coverage.completeRecordIds.length,
      needsInput: release.coverage.needsInputRecordIds.length,
    }),
  });
}

export function parseContractBaselineTeamDocument(
  value: unknown,
  expected: { worldId: string; release: ContractSourceReleasePin }
): ContractBaselineTeamDocument {
  const parsed = ContractBaselineTeamDocumentZ.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Contract baseline is malformed: ${parsed.error.issues[0]?.message ?? 'unknown schema error'}`
    );
  }
  const document = parsed.data;
  if (document.worldId !== expected.worldId) {
    throw new Error('Contract baseline belongs to a different world.');
  }
  if (canonicalStringify(document.release) !== canonicalStringify(expected.release)) {
    throw new Error('Contract baseline release conflicts with the world pin.');
  }
  const expectedShardId = `${document.teamId}-${String(document.shardIndex).padStart(3, '0')}`;
  if (
    document.shardId !== expectedShardId ||
    document.shardIndex >= document.shardCount
  ) {
    throw new Error('Contract baseline shard identity is invalid.');
  }
  const { documentDigest: storedDigest, ...withoutDigest } = document;
  if (storedDigest !== documentDigest(withoutDigest)) {
    throw new Error('Contract baseline document digest is invalid.');
  }
  document.ledgers.forEach((ledger) => {
    createContractEventLedger({
      ledgerId: ledger.ledgerId,
      ledgerVersion: ledger.ledgerVersion,
      events: ledger.events,
    });
  });
  return Object.freeze(document);
}

export function validateContractBaselineDocumentSet(
  documents: readonly ContractBaselineTeamDocument[],
  expectedLedgerCount: number
): readonly ContractBaselineTeamDocument[] {
  const sorted = [...documents].sort((a, b) => a.shardId.localeCompare(b.shardId));
  const ledgerCount = sorted.reduce(
    (count, document) => count + document.ledgers.length,
    0
  );
  if (ledgerCount !== expectedLedgerCount) {
    throw new Error(
      `Governed contract baseline is incomplete: expected ${expectedLedgerCount} ledgers, found ${ledgerCount}.`
    );
  }
  const contractIds = sorted.flatMap((document) =>
    document.ledgers.map((ledger) => ledger.events[0]?.contractId)
  );
  if (
    contractIds.some((contractId) => !contractId) ||
    new Set(contractIds).size !== contractIds.length
  ) {
    throw new Error('Governed contract baseline has a duplicate or missing contract identity.');
  }
  const shardsByTeam = new Map<string, ContractBaselineTeamDocument[]>();
  sorted.forEach((document) => {
    const shards = shardsByTeam.get(document.teamId) ?? [];
    shards.push(document);
    shardsByTeam.set(document.teamId, shards);
  });
  shardsByTeam.forEach((shards, teamId) => {
    const expectedCount = shards[0]?.shardCount ?? 0;
    const indexes = shards.map((shard) => shard.shardIndex).sort((a, b) => a - b);
    if (
      shards.length !== expectedCount ||
      shards.some((shard) => shard.shardCount !== expectedCount) ||
      indexes.some((index, position) => index !== position)
    ) {
      throw new Error(`Governed contract baseline ${teamId} has an incomplete shard set.`);
    }
  });
  return Object.freeze(sorted);
}

export function branchContractBaselineTeamDocument(
  source: ContractBaselineTeamDocument,
  childWorldId: string
): ContractBaselineTeamDocument {
  const ledgers = source.ledgers.map((ledger) => ({
    ...ledger,
    ledgerId: `${childWorldId}:${ledger.events[0]?.contractId}:contract`,
    events: ledger.events.map((event) => ({ ...event, worldId: childWorldId })),
  }));
  const withoutDigest = {
    documentVersion: 1 as const,
    worldId: childWorldId,
    teamId: source.teamId,
    shardId: source.shardId,
    shardIndex: source.shardIndex,
    shardCount: source.shardCount,
    release: source.release,
    evidenceCatalog: source.evidenceCatalog,
    ledgers,
  };
  return ContractBaselineTeamDocumentZ.parse({
    ...withoutDigest,
    documentDigest: documentDigest(withoutDigest),
  });
}

export type ContractBaselineWorldCompatibility =
  | { readonly compatible: true; readonly metadata: WorldContractBaselineMetadata }
  | { readonly compatible: false; readonly message: string };

export function resolveContractBaselineWorldCompatibility(
  metadata: unknown
): ContractBaselineWorldCompatibility {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return Object.freeze({
      compatible: false as const,
      message:
        'This Team Plan predates governed baseline contracts. Recreate it to use contract history.',
    });
  }
  const record = metadata as Record<string, unknown>;
  const parsed = WorldContractBaselineMetadataZ.safeParse({
    contractBaselineVersion: record.contractBaselineVersion,
    contractSourceRelease: record.contractSourceRelease,
    contractBaselineEffectiveAt: record.contractBaselineEffectiveAt,
    contractBaselineSalaryCapYear: record.contractBaselineSalaryCapYear,
    contractBaselineCoverage: record.contractBaselineCoverage,
  });
  if (!parsed.success) {
    return Object.freeze({
      compatible: false as const,
      message:
        'This Team Plan predates governed baseline contracts. Recreate it to use contract history.',
    });
  }
  return Object.freeze({ compatible: true as const, metadata: parsed.data });
}
