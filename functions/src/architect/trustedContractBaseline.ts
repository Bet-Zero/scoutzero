/** Trusted construction and branching for governed Architect contract baselines. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TRUSTED_CONTRACT_RELEASE_FILENAME =
  'salaryswish-retained-2026-06-05-v1.json';
export const TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256 =
  'sha256:23304518f145babfe19ab5341fc60449f39bbfa2b06ad3ce15ef3b3159b91389';
export const TRUSTED_CONTRACT_RELEASE_ID = 'salaryswish-retained-2026-06-05';
export const TRUSTED_CONTRACT_RELEASE_VERSION = 1;
export const TRUSTED_CONTRACT_RELEASE_DIGEST =
  'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950';

const CONTRACT_BASELINE_SHARD_TARGET_BYTES = 700_000;
const CONTRACT_BASELINE_WORLD_VERSION = 2;
const CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION = 2;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

type JsonRecord = Record<string, unknown>;

export type TrustedContractReleaseRecord = {
  contractId: string;
  playerId: string;
  teamId: string;
  sourceObservationId: string;
  sourceContractPath: string;
  resultingState: JsonRecord;
};

export type TrustedContractRelease = {
  releaseId: string;
  releaseVersion: number;
  releaseDigest: string;
  effectiveAt: string;
  salaryCapYear: number;
  source: {
    evidenceCatalog: JsonRecord;
  };
  records: TrustedContractReleaseRecord[];
  coverage: {
    totalSourceContracts: number;
    completeRecordIds: string[];
    needsInputRecordIds: string[];
  };
};

export type TrustedContractBaselineDocument = JsonRecord & {
  documentVersion: 1;
  worldId: string;
  teamId: string;
  shardId: string;
  shardIndex: number;
  shardCount: number;
  release: JsonRecord;
  evidenceCatalog: JsonRecord;
  ledgers: JsonRecord[];
  documentDigest: string;
};

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value: unknown, context: string): JsonRecord {
  if (!isPlainRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
}

function requireInteger(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${context} must be an integer.`);
  }
  return value;
}

function requireStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }
  return value.map((entry, index) =>
    requireString(entry, `${context}[${index}]`)
  );
}

function withoutDocumentDigest(value: JsonRecord): JsonRecord {
  const copy = { ...value };
  delete copy.documentDigest;
  return copy;
}

export function canonicalStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        'Canonical contract data cannot contain a non-finite number.'
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    if (!isPlainRecord(value)) {
      throw new Error(
        'Canonical contract data must contain only plain objects.'
      );
    }
    return `{${Object.keys(value)
      .sort(compareCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  throw new Error(`Canonical contract data cannot contain ${typeof value}.`);
}

function deterministicStateDigest(value: unknown): string {
  const bytes = Buffer.from(canonicalStringify(value), 'utf8');
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

function trustedReleasePin(release: TrustedContractRelease): JsonRecord {
  return {
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseDigest: release.releaseDigest,
  };
}

export function parseTrustedContractReleaseArtifact(
  artifact: Buffer
): TrustedContractRelease {
  const artifactDigest = `sha256:${createHash('sha256')
    .update(artifact)
    .digest('hex')}`;
  if (artifactDigest !== TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256) {
    throw new Error(
      `Trusted contract-source artifact digest mismatch: expected ${TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256}, received ${artifactDigest}.`
    );
  }

  const parsed = requireRecord(
    JSON.parse(artifact.toString('utf8')),
    'Trusted contract-source release'
  );
  const releaseId = requireString(parsed.releaseId, 'releaseId');
  const releaseVersion = requireInteger(
    parsed.releaseVersion,
    'releaseVersion'
  );
  const releaseDigest = requireString(parsed.releaseDigest, 'releaseDigest');
  if (
    releaseId !== TRUSTED_CONTRACT_RELEASE_ID ||
    releaseVersion !== TRUSTED_CONTRACT_RELEASE_VERSION ||
    releaseDigest !== TRUSTED_CONTRACT_RELEASE_DIGEST
  ) {
    throw new Error(
      'Trusted contract-source release identity does not match the deployed pin.'
    );
  }

  const effectiveAt = requireString(parsed.effectiveAt, 'effectiveAt');
  if (
    !Number.isFinite(Date.parse(effectiveAt)) ||
    !/[zZ]|[+-]\d{2}:\d{2}$/.test(effectiveAt)
  ) {
    throw new Error(
      'Trusted contract-source release effectiveAt is not a zoned instant.'
    );
  }
  const salaryCapYear = requireInteger(parsed.salaryCapYear, 'salaryCapYear');
  const source = requireRecord(parsed.source, 'source');
  const evidenceCatalog = requireRecord(
    source.evidenceCatalog,
    'source.evidenceCatalog'
  );
  const rawCoverage = requireRecord(parsed.coverage, 'coverage');
  const totalSourceContracts = requireInteger(
    rawCoverage.totalSourceContracts,
    'coverage.totalSourceContracts'
  );
  const completeRecordIds = requireStringArray(
    rawCoverage.completeRecordIds,
    'coverage.completeRecordIds'
  );
  const needsInputRecordIds = requireStringArray(
    rawCoverage.needsInputRecordIds,
    'coverage.needsInputRecordIds'
  );
  if (!Array.isArray(parsed.records)) {
    throw new Error(
      'Trusted contract-source release records must be an array.'
    );
  }
  const records = parsed.records.map((value, index) => {
    const record = requireRecord(value, `records[${index}]`);
    return {
      contractId: requireString(
        record.contractId,
        `records[${index}].contractId`
      ),
      playerId: requireString(record.playerId, `records[${index}].playerId`),
      teamId: requireString(record.teamId, `records[${index}].teamId`),
      sourceObservationId: requireString(
        record.sourceObservationId,
        `records[${index}].sourceObservationId`
      ),
      sourceContractPath: requireString(
        record.sourceContractPath,
        `records[${index}].sourceContractPath`
      ),
      resultingState: requireRecord(
        record.resultingState,
        `records[${index}].resultingState`
      ),
    };
  });
  if (
    records.length !== totalSourceContracts ||
    completeRecordIds.length + needsInputRecordIds.length !==
      totalSourceContracts ||
    new Set(records.map((record) => record.contractId)).size !== records.length
  ) {
    throw new Error(
      'Trusted contract-source release coverage or identity accounting is invalid.'
    );
  }

  return {
    releaseId,
    releaseVersion,
    releaseDigest,
    effectiveAt,
    salaryCapYear,
    source: { evidenceCatalog },
    records,
    coverage: {
      totalSourceContracts,
      completeRecordIds,
      needsInputRecordIds,
    },
  };
}

let trustedRelease: TrustedContractRelease | null = null;

export function loadTrustedContractRelease(): TrustedContractRelease {
  trustedRelease ??= parseTrustedContractReleaseArtifact(
    readFileSync(join(__dirname, 'assets', TRUSTED_CONTRACT_RELEASE_FILENAME))
  );
  return trustedRelease;
}

function partitionLedgers(
  ledgers: JsonRecord[],
  common: JsonRecord
): JsonRecord[][] {
  const shards: JsonRecord[][] = [];
  let current: JsonRecord[] = [];
  for (const ledger of ledgers) {
    const candidate = [...current, ledger];
    if (
      current.length > 0 &&
      Buffer.byteLength(
        canonicalStringify({ ...common, ledgers: candidate }),
        'utf8'
      ) > CONTRACT_BASELINE_SHARD_TARGET_BYTES
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

export function trustedContractBaselineMetadata(
  release: TrustedContractRelease
): JsonRecord {
  return {
    contractBaselineVersion: CONTRACT_BASELINE_WORLD_VERSION,
    contractSourceRelease: trustedReleasePin(release),
    contractBaselineEffectiveAt: release.effectiveAt,
    contractBaselineSalaryCapYear: release.salaryCapYear,
    contractBaselineCoverage: {
      total: release.coverage.totalSourceContracts,
      complete: release.coverage.completeRecordIds.length,
      needsInput: release.coverage.needsInputRecordIds.length,
    },
  };
}

export function buildTrustedContractBaselineDocuments(
  release: TrustedContractRelease,
  worldId: string
): TrustedContractBaselineDocument[] {
  const recordsByTeam = new Map<string, TrustedContractReleaseRecord[]>();
  for (const record of release.records) {
    const records = recordsByTeam.get(record.teamId) ?? [];
    records.push(record);
    recordsByTeam.set(record.teamId, records);
  }
  const releasePin = trustedReleasePin(release);
  return [...recordsByTeam.entries()]
    .sort(([left], [right]) => compareCodePoints(left, right))
    .flatMap(([teamId, records]) => {
      const ledgers = records
        .sort((left, right) =>
          compareCodePoints(left.contractId, right.contractId)
        )
        .map(
          (record): JsonRecord => ({
            payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
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
        );
      const common: JsonRecord = {
        documentVersion: 1,
        worldId,
        teamId,
        release: releasePin,
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
        return {
          ...withoutDigest,
          documentVersion: 1 as const,
          worldId,
          teamId,
          shardId,
          shardIndex,
          shardCount: shards.length,
          release: releasePin,
          evidenceCatalog: release.source.evidenceCatalog,
          ledgers: shardLedgers,
          documentDigest: deterministicStateDigest(withoutDigest),
        };
      });
    });
}

function validatedParentDocument(
  value: unknown,
  parentWorldId: string,
  expectedRelease: JsonRecord
): TrustedContractBaselineDocument {
  const document = requireRecord(value, 'Parent contract baseline');
  const storedDigest = requireString(
    document.documentDigest,
    'Parent contract baseline documentDigest'
  );
  const withoutDigest = withoutDocumentDigest(document);
  if (storedDigest !== deterministicStateDigest(withoutDigest)) {
    throw new Error('Parent contract baseline document digest is invalid.');
  }
  if (
    document.worldId !== parentWorldId ||
    canonicalStringify(document.release) !==
      canonicalStringify(expectedRelease) ||
    !Array.isArray(document.ledgers) ||
    document.ledgers.length === 0
  ) {
    throw new Error(
      'Parent contract baseline identity or ledger set is invalid.'
    );
  }
  return document as TrustedContractBaselineDocument;
}

export function branchTrustedContractBaselineDocuments(
  values: readonly unknown[],
  parentWorldId: string,
  childWorldId: string,
  expectedRelease: JsonRecord,
  expectedLedgerCount: number
): TrustedContractBaselineDocument[] {
  const contractIds = new Set<string>();
  let ledgerCount = 0;
  const documents = values.map((value) => {
    const source = validatedParentDocument(
      value,
      parentWorldId,
      expectedRelease
    );
    const ledgers = source.ledgers.map((ledgerValue) => {
      const ledger = requireRecord(ledgerValue, 'Parent contract ledger');
      if (!Array.isArray(ledger.events) || ledger.events.length === 0) {
        throw new Error('Parent contract baseline contains an empty ledger.');
      }
      const events = ledger.events.map((eventValue) => {
        const event = requireRecord(eventValue, 'Parent contract event');
        const contractId = requireString(
          event.contractId,
          'Parent contract event contractId'
        );
        if (event.worldId !== parentWorldId) {
          throw new Error(
            'Parent contract event belongs to a different world.'
          );
        }
        contractIds.add(contractId);
        return { ...event, worldId: childWorldId };
      });
      const firstContractId = requireString(
        requireRecord(events[0], 'First parent contract event').contractId,
        'First parent contract event contractId'
      );
      ledgerCount += 1;
      return {
        ...ledger,
        ledgerId: `${childWorldId}:${firstContractId}:contract`,
        events,
      };
    });
    const sourceWithoutDigest = withoutDocumentDigest(source);
    const withoutDigest = {
      ...sourceWithoutDigest,
      worldId: childWorldId,
      ledgers,
    };
    return {
      ...withoutDigest,
      documentVersion: 1 as const,
      worldId: childWorldId,
      teamId: requireString(source.teamId, 'Parent baseline teamId'),
      shardId: requireString(source.shardId, 'Parent baseline shardId'),
      shardIndex: requireInteger(
        source.shardIndex,
        'Parent baseline shardIndex'
      ),
      shardCount: requireInteger(
        source.shardCount,
        'Parent baseline shardCount'
      ),
      release: requireRecord(source.release, 'Parent baseline release'),
      evidenceCatalog: requireRecord(
        source.evidenceCatalog,
        'Parent baseline evidenceCatalog'
      ),
      ledgers,
      documentDigest: deterministicStateDigest(withoutDigest),
    };
  });
  if (
    documents.length === 0 ||
    ledgerCount !== expectedLedgerCount ||
    contractIds.size !== expectedLedgerCount
  ) {
    throw new Error('Parent contract baseline shard accounting is incomplete.');
  }
  return documents.sort((left, right) =>
    compareCodePoints(left.shardId, right.shardId)
  );
}
