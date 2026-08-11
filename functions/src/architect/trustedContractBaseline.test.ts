import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  branchTrustedContractBaselineDocuments,
  buildTrustedContractBaselineDocuments,
  canonicalStringify,
  parseTrustedContractReleaseArtifact,
  trustedContractBaselineMetadata,
} from './trustedContractBaseline';

const artifactPath = resolve(
  __dirname,
  '../../../public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
);

describe('trusted governed contract baseline', () => {
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
});
