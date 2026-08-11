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

export type TrustedContractReleasePin = {
  releaseId: string;
  releaseVersion: number;
  releaseDigest: string;
};

export type TrustedContractReleaseDescriptor = TrustedContractReleasePin & {
  filename: string;
  artifactSha256: string;
};

export const RETAINED_TRUSTED_CONTRACT_RELEASES = Object.freeze([
  Object.freeze({
    filename: TRUSTED_CONTRACT_RELEASE_FILENAME,
    artifactSha256: TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256,
    releaseId: TRUSTED_CONTRACT_RELEASE_ID,
    releaseVersion: TRUSTED_CONTRACT_RELEASE_VERSION,
    releaseDigest: TRUSTED_CONTRACT_RELEASE_DIGEST,
  }),
] satisfies readonly TrustedContractReleaseDescriptor[]);

export const DEFAULT_TRUSTED_CONTRACT_RELEASE =
  RETAINED_TRUSTED_CONTRACT_RELEASES[
    RETAINED_TRUSTED_CONTRACT_RELEASES.length - 1
  ];

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
  supersedes: TrustedContractReleasePin | null;
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

function requireReleasePin(
  value: unknown,
  context: string
): TrustedContractReleasePin {
  const record = requireRecord(value, context);
  return {
    releaseId: requireString(record.releaseId, `${context}.releaseId`),
    releaseVersion: requireInteger(
      record.releaseVersion,
      `${context}.releaseVersion`
    ),
    releaseDigest: requireString(
      record.releaseDigest,
      `${context}.releaseDigest`
    ),
  };
}

function releaseKey(
  pin: Pick<TrustedContractReleasePin, 'releaseId' | 'releaseVersion'>
): string {
  return `${pin.releaseId}@v${pin.releaseVersion}`;
}

export function seasonForSalaryCapYear(salaryCapYear: number): string {
  if (
    !Number.isInteger(salaryCapYear) ||
    salaryCapYear < 2000 ||
    salaryCapYear > 3000
  ) {
    throw new Error('Trusted contract-source Salary Cap Year is invalid.');
  }
  return `${salaryCapYear - 1}-${String(salaryCapYear).slice(-2)}`;
}

export function resolveFreshWorldSeason(
  release: Pick<TrustedContractRelease, 'salaryCapYear'>,
  requestedSeason: string | null
): string {
  const governedSeason = seasonForSalaryCapYear(release.salaryCapYear);
  if (requestedSeason !== null && requestedSeason !== governedSeason) {
    throw new Error(
      `currentSeason must match governed release season ${governedSeason}.`
    );
  }
  return governedSeason;
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
  artifact: Buffer,
  expected: TrustedContractReleaseDescriptor = DEFAULT_TRUSTED_CONTRACT_RELEASE
): TrustedContractRelease {
  const artifactDigest = `sha256:${createHash('sha256')
    .update(artifact)
    .digest('hex')}`;
  if (artifactDigest !== expected.artifactSha256) {
    throw new Error(
      `Trusted contract-source artifact digest mismatch: expected ${expected.artifactSha256}, received ${artifactDigest}.`
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
    releaseId !== expected.releaseId ||
    releaseVersion !== expected.releaseVersion ||
    releaseDigest !== expected.releaseDigest
  ) {
    throw new Error(
      'Trusted contract-source release identity does not match its retained pin.'
    );
  }

  const supersedes =
    parsed.supersedes === null
      ? null
      : requireReleasePin(parsed.supersedes, 'supersedes');
  if (releaseVersion === 1 && supersedes !== null) {
    throw new Error(
      'Trusted contract-source release version one cannot supersede another release.'
    );
  }
  if (
    releaseVersion > 1 &&
    (!supersedes ||
      supersedes.releaseId !== releaseId ||
      supersedes.releaseVersion >= releaseVersion)
  ) {
    throw new Error('Trusted contract-source release supersession is invalid.');
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
  seasonForSalaryCapYear(salaryCapYear);
  const effectiveDate = effectiveAt.slice(0, 10);
  if (
    effectiveDate < `${salaryCapYear - 1}-07-01` ||
    effectiveDate > `${salaryCapYear}-06-30`
  ) {
    throw new Error(
      'Trusted contract-source effectiveAt falls outside its Salary Cap Year.'
    );
  }
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
    supersedes,
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

type TrustedContractReleaseRegistryOptions = {
  releases: readonly TrustedContractReleaseDescriptor[];
  defaultRelease: TrustedContractReleasePin;
  readArtifact: (descriptor: TrustedContractReleaseDescriptor) => Buffer;
};

export class TrustedContractReleaseRegistry {
  private readonly descriptors = new Map<
    string,
    TrustedContractReleaseDescriptor
  >();

  private readonly cache = new Map<string, TrustedContractRelease>();

  private readonly defaultRelease: TrustedContractReleasePin;

  private readonly readArtifact: TrustedContractReleaseRegistryOptions['readArtifact'];

  constructor(options: TrustedContractReleaseRegistryOptions) {
    if (options.releases.length === 0) {
      throw new Error(
        'At least one trusted contract-source release is required.'
      );
    }
    for (const descriptor of options.releases) {
      const key = releaseKey(descriptor);
      if (this.descriptors.has(key)) {
        throw new Error(`Duplicate retained contract-source release ${key}.`);
      }
      this.descriptors.set(key, descriptor);
    }
    const defaultDescriptor = this.descriptors.get(
      releaseKey(options.defaultRelease)
    );
    if (
      !defaultDescriptor ||
      defaultDescriptor.releaseDigest !== options.defaultRelease.releaseDigest
    ) {
      throw new Error(
        'The default contract-source release is not retained with its exact digest.'
      );
    }
    this.defaultRelease = { ...options.defaultRelease };
    this.readArtifact = options.readArtifact;
  }

  loadDefault(): TrustedContractRelease {
    return this.load(this.defaultRelease);
  }

  load(pin: TrustedContractReleasePin): TrustedContractRelease {
    const key = releaseKey(pin);
    const descriptor = this.descriptors.get(key);
    if (!descriptor) {
      throw new Error(
        `Trusted contract-source release ${key} is not retained by this deployment.`
      );
    }
    if (descriptor.releaseDigest !== pin.releaseDigest) {
      throw new Error(
        `Trusted contract-source release ${key} digest does not match the retained artifact.`
      );
    }

    const cached = this.cache.get(key);
    if (cached) return cached;

    const release = parseTrustedContractReleaseArtifact(
      this.readArtifact(descriptor),
      descriptor
    );
    if (release.supersedes) {
      const prior = this.descriptors.get(releaseKey(release.supersedes));
      if (!prior || prior.releaseDigest !== release.supersedes.releaseDigest) {
        throw new Error(
          `Trusted contract-source release ${key} supersedes an unavailable retained release.`
        );
      }
    }
    this.cache.set(key, release);
    return release;
  }
}

const trustedReleaseRegistry = new TrustedContractReleaseRegistry({
  releases: RETAINED_TRUSTED_CONTRACT_RELEASES,
  defaultRelease: DEFAULT_TRUSTED_CONTRACT_RELEASE,
  readArtifact: (descriptor) =>
    readFileSync(join(__dirname, 'assets', descriptor.filename)),
});

export function loadTrustedContractRelease(
  pin?: TrustedContractReleasePin
): TrustedContractRelease {
  return pin
    ? trustedReleaseRegistry.load(pin)
    : trustedReleaseRegistry.loadDefault();
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
  expectedRelease: JsonRecord,
  expectedEvidenceCatalog: JsonRecord
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
    canonicalStringify(document.evidenceCatalog) !==
      canonicalStringify(expectedEvidenceCatalog) ||
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
  expectedEvidenceCatalog: JsonRecord,
  expectedLedgerCount: number
): TrustedContractBaselineDocument[] {
  const contractIds = new Set<string>();
  let ledgerCount = 0;
  const documents = values.map((value) => {
    const source = validatedParentDocument(
      value,
      parentWorldId,
      expectedRelease,
      expectedEvidenceCatalog
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
