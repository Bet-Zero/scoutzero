import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  branchTrustedContractBaselineDocuments,
  buildTrustedContractBaselineDocuments,
  canonicalStringify,
  parseTrustedContractReleaseArtifact,
  resolveFreshWorldSeason,
  TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256,
  TRUSTED_CONTRACT_RELEASE_FILENAME,
  TrustedContractReleaseRegistry,
  trustedContractBaselineMetadata,
  type TrustedContractReleaseDescriptor,
  type TrustedContractReleasePin,
} from './trustedContractBaseline';

const artifactPath = resolve(
  __dirname,
  '../../../public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
);
const functionsRoot = resolve(__dirname, '../..');
const runtimeArtifactPath = resolve(
  functionsRoot,
  'lib/architect/assets',
  TRUSTED_CONTRACT_RELEASE_FILENAME
);

function fixturePin(version: number): TrustedContractReleasePin {
  return {
    releaseId: 'retained-fixture',
    releaseVersion: version,
    releaseDigest: `sha256:${(version === 1 ? 'a' : 'b').repeat(64)}`,
  };
}

function fixtureRelease(version: 1 | 2): {
  artifact: Buffer;
  descriptor: TrustedContractReleaseDescriptor;
} {
  const pin = fixturePin(version);
  const priorPin = version === 1 ? null : fixturePin(1);
  const contractId = `fixture-contract-v${version}`;
  const artifact = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      ...pin,
      supersedes: priorPin,
      effectiveAt:
        version === 1 ? '2026-06-05T12:19:56.526Z' : '2027-06-05T12:19:56.526Z',
      salaryCapYear: version === 1 ? 2026 : 2027,
      source: {
        evidenceCatalog: {
          transformations: [
            { id: `fixture-transform-v${version}`, description: 'Fixture' },
          ],
          limitations: [],
        },
      },
      records: [
        {
          contractId,
          playerId: `fixture-player-v${version}`,
          teamId: 'MIA',
          sourceObservationId: `fixture-observation-v${version}`,
          sourceContractPath: 'contract',
          resultingState: {
            contractId,
            stateDigest: `fnv1a64:${String(version).repeat(16)}`,
            releaseMarker: `version-${version}`,
          },
        },
      ],
      coverage: {
        totalSourceContracts: 1,
        completeRecordIds: [contractId],
        needsInputRecordIds: [],
      },
    }),
    'utf8'
  );
  return {
    artifact,
    descriptor: {
      ...pin,
      filename: `retained-fixture-v${version}.json`,
      artifactSha256: `sha256:${createHash('sha256')
        .update(artifact)
        .digest('hex')}`,
    },
  };
}

function fixtureRegistry(
  releases: readonly ReturnType<typeof fixtureRelease>[],
  defaultRelease: TrustedContractReleasePin
): TrustedContractReleaseRegistry {
  const artifacts = new Map(
    releases.map((release) => [release.descriptor.filename, release.artifact])
  );
  return new TrustedContractReleaseRegistry({
    releases: releases.map((release) => release.descriptor),
    defaultRelease,
    readArtifact: (descriptor) => {
      const artifact = artifacts.get(descriptor.filename);
      if (!artifact) throw new Error(`Missing fixture ${descriptor.filename}`);
      return artifact;
    },
  });
}

describe('trusted governed contract baseline', () => {
  it('packages the exact retained artifact at the deployed runtime path', () => {
    execFileSync('npm', ['run', 'copy:contract-release'], {
      cwd: functionsRoot,
      stdio: 'pipe',
    });
    const artifact = readFileSync(runtimeArtifactPath);

    expect(
      `sha256:${createHash('sha256').update(artifact).digest('hex')}`
    ).toBe(TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256);
    expect(parseTrustedContractReleaseArtifact(artifact)).toMatchObject({
      releaseId: 'salaryswish-retained-2026-06-05',
      releaseVersion: 1,
    });
  });

  it('pins the complete deployed artifact and builds deterministic shards', () => {
    const release = parseTrustedContractReleaseArtifact(
      readFileSync(artifactPath)
    );
    const first = buildTrustedContractBaselineDocuments(release, 'world-one');
    const second = buildTrustedContractBaselineDocuments(release, 'world-one');

    expect(release.records).toHaveLength(774);
    expect(release.coverage.completeRecordIds).toHaveLength(772);
    expect(release.coverage.needsInputRecordIds).toHaveLength(2);
    expect(first).toHaveLength(33);
    expect(first.flatMap((document) => document.ledgers)).toHaveLength(774);
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(trustedContractBaselineMetadata(release)).toMatchObject({
      contractBaselineVersion: 2,
      contractBaselineCoverage: { total: 774, complete: 772, needsInput: 2 },
    });
  });

  it('rejects any byte change to the deployed source release', () => {
    const artifact = readFileSync(artifactPath);
    const changed = Buffer.from(artifact);
    changed[changed.length - 1] ^= 1;

    expect(() => parseTrustedContractReleaseArtifact(changed)).toThrow(
      'artifact digest mismatch'
    );
  });

  it('branches validated roots without changing their resulting states', () => {
    const release = parseTrustedContractReleaseArtifact(
      readFileSync(artifactPath)
    );
    const parent = buildTrustedContractBaselineDocuments(release, 'parent');
    const metadata = trustedContractBaselineMetadata(release);
    const releasePin = metadata.contractSourceRelease;
    const child = branchTrustedContractBaselineDocuments(
      parent,
      'parent',
      'child',
      releasePin as Record<string, unknown>,
      release.source.evidenceCatalog,
      774
    );

    const parentStates = parent
      .flatMap((document) => document.ledgers)
      .map((ledger) => {
        const events = ledger.events as Record<string, unknown>[];
        return events[0].resultingState;
      });
    const childStates = child
      .flatMap((document) => document.ledgers)
      .map((ledger) => {
        const events = ledger.events as Record<string, unknown>[];
        return events[0].resultingState;
      });

    expect(childStates).toEqual(parentStates);
    expect(
      child
        .flatMap((document) => document.ledgers)
        .every((ledger) => String(ledger.ledgerId).startsWith('child:'))
    ).toBe(true);
  });

  it('retains an older release for reload and byte-equivalent branching after a later default', () => {
    const versionOneFixture = fixtureRelease(1);
    const versionTwoFixture = fixtureRelease(2);
    const versionOneRegistry = fixtureRegistry(
      [versionOneFixture],
      versionOneFixture.descriptor
    );
    const versionOneRelease = versionOneRegistry.loadDefault();
    const versionOneMetadata =
      trustedContractBaselineMetadata(versionOneRelease);
    const versionOneDocuments = buildTrustedContractBaselineDocuments(
      versionOneRelease,
      'version-one-world'
    );
    const persistedVersionOne = canonicalStringify({
      metadata: versionOneMetadata,
      documents: versionOneDocuments,
    });

    const supersededRegistry = fixtureRegistry(
      [versionOneFixture, versionTwoFixture],
      versionTwoFixture.descriptor
    );
    const defaultVersionTwo = supersededRegistry.loadDefault();
    const reloadedVersionOne = supersededRegistry.load(
      versionOneMetadata.contractSourceRelease as TrustedContractReleasePin
    );
    const reloadedVersionOneMetadata =
      trustedContractBaselineMetadata(reloadedVersionOne);
    const childDocuments = branchTrustedContractBaselineDocuments(
      versionOneDocuments,
      'version-one-world',
      'version-one-child',
      reloadedVersionOneMetadata.contractSourceRelease as Record<
        string,
        unknown
      >,
      reloadedVersionOne.source.evidenceCatalog,
      1
    );
    const versionTwoMetadata =
      trustedContractBaselineMetadata(defaultVersionTwo);
    const versionTwoDocuments = buildTrustedContractBaselineDocuments(
      defaultVersionTwo,
      'version-two-world'
    );

    expect(defaultVersionTwo.releaseVersion).toBe(2);
    expect(reloadedVersionOne).toEqual(versionOneRelease);
    expect(reloadedVersionOneMetadata).toEqual(versionOneMetadata);
    expect(
      canonicalStringify({
        metadata: versionOneMetadata,
        documents: versionOneDocuments,
      })
    ).toBe(persistedVersionOne);
    expect(childDocuments[0]).toMatchObject({
      worldId: 'version-one-child',
      release: versionOneMetadata.contractSourceRelease,
      evidenceCatalog: versionOneDocuments[0].evidenceCatalog,
    });
    expect(
      childDocuments
        .flatMap((document) => document.ledgers)
        .map((ledger) => {
          const events = ledger.events as Record<string, unknown>[];
          return events[0].resultingState;
        })
    ).toEqual(
      versionOneDocuments
        .flatMap((document) => document.ledgers)
        .map((ledger) => {
          const events = ledger.events as Record<string, unknown>[];
          return events[0].resultingState;
        })
    );
    expect(childDocuments[0].documentDigest).not.toBe(
      versionOneDocuments[0].documentDigest
    );
    expect(versionTwoMetadata).toMatchObject({
      contractSourceRelease: fixturePin(2),
      contractBaselineEffectiveAt: defaultVersionTwo.effectiveAt,
      contractBaselineSalaryCapYear: 2027,
    });
    expect(versionOneDocuments[0].release).toEqual(fixturePin(1));
    expect(versionTwoDocuments[0].release).toEqual(fixturePin(2));
    expect(supersededRegistry.load(versionOneFixture.descriptor)).toBe(
      reloadedVersionOne
    );
  });

  it('fails closed for unavailable, malformed, and digest-drifted retained releases', () => {
    const versionOneFixture = fixtureRelease(1);
    const registry = fixtureRegistry(
      [versionOneFixture],
      versionOneFixture.descriptor
    );

    expect(() => registry.load(fixturePin(2))).toThrow('not retained');
    expect(() =>
      registry.load({
        ...versionOneFixture.descriptor,
        releaseDigest: `sha256:${'f'.repeat(64)}`,
      })
    ).toThrow('digest does not match');

    const malformedArtifact = Buffer.from('{"releaseId":', 'utf8');
    const malformedDescriptor = {
      ...versionOneFixture.descriptor,
      filename: 'malformed.json',
      artifactSha256: `sha256:${createHash('sha256')
        .update(malformedArtifact)
        .digest('hex')}`,
    };
    const malformedRegistry = new TrustedContractReleaseRegistry({
      releases: [malformedDescriptor],
      defaultRelease: malformedDescriptor,
      readArtifact: () => malformedArtifact,
    });
    expect(() => malformedRegistry.loadDefault()).toThrow();

    const driftedArtifact = Buffer.from(versionOneFixture.artifact);
    driftedArtifact[driftedArtifact.length - 1] ^= 1;
    const driftedRegistry = new TrustedContractReleaseRegistry({
      releases: [versionOneFixture.descriptor],
      defaultRelease: versionOneFixture.descriptor,
      readArtifact: () => driftedArtifact,
    });
    expect(() => driftedRegistry.loadDefault()).toThrow(
      'artifact digest mismatch'
    );

    const versionTwoFixture = fixtureRelease(2);
    const brokenChainRegistry = fixtureRegistry(
      [versionTwoFixture],
      versionTwoFixture.descriptor
    );
    expect(() => brokenChainRegistry.loadDefault()).toThrow(
      'supersedes an unavailable retained release'
    );
  });

  it('derives the governed season and rejects future or past caller mismatches', () => {
    const release = parseTrustedContractReleaseArtifact(
      readFileSync(artifactPath)
    );

    expect(resolveFreshWorldSeason(release, null)).toBe('2025-26');
    expect(resolveFreshWorldSeason(release, '2025-26')).toBe('2025-26');
    expect(() => resolveFreshWorldSeason(release, '2030-31')).toThrow(
      'must match governed release season 2025-26'
    );
    expect(() => resolveFreshWorldSeason(release, '1999-00')).toThrow(
      'must match governed release season 2025-26'
    );
  });

  it('fails closed when one governed ledger cannot fit in a shard', () => {
    const versionOneFixture = fixtureRelease(1);
    const release = fixtureRegistry(
      [versionOneFixture],
      versionOneFixture.descriptor
    ).loadDefault();
    release.records[0].resultingState.oversizedFixture = 'x'.repeat(700_000);

    expect(() =>
      buildTrustedContractBaselineDocuments(release, 'oversized-world')
    ).toThrow('ledger exceeds the 700000-byte shard boundary');
  });
});
