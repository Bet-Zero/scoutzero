import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import type { ContractSourceRelease } from '@/schemas/contractSourceRelease';
import {
  RETAINED_AUSTIN_CONTRACT_ID,
  RETAINED_AUSTIN_MISSING_EVIDENCE,
  RETAINED_AUSTIN_PLAYER_ID,
  RETAINED_AUSTIN_TRADE_KICKER_PERCENT,
  RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR,
  RETAINED_CONTRACT_RELEASE_FILENAME,
  RETAINED_CONTRACT_RELEASE_PATH,
  authenticateRetainedAustinTradeBonusArtifact,
  deriveRetainedAustinTradeBonusAuthority,
  retainedArtifactSha256,
} from '../../e2e/fixtures/retainedAustinTradeBonusAuthority';
import {
  TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256,
  TRUSTED_CONTRACT_RELEASE_DIGEST,
  TRUSTED_CONTRACT_RELEASE_FILENAME,
  TRUSTED_CONTRACT_RELEASE_ID,
  TRUSTED_CONTRACT_RELEASE_VERSION,
} from '../../../functions/src/architect/trustedContractBaseline';

const cloneRelease = (release: ContractSourceRelease): ContractSourceRelease =>
  JSON.parse(JSON.stringify(release)) as ContractSourceRelease;

describe('BZE-265 retained Austin trade-bonus proof authority', () => {
  it('authenticates the retained bytes, governed release, and exact Austin record', async () => {
    expect(RETAINED_CONTRACT_RELEASE_FILENAME).toBe(
      TRUSTED_CONTRACT_RELEASE_FILENAME
    );
    expect(RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR).toEqual({
      artifactSha256: TRUSTED_CONTRACT_RELEASE_ARTIFACT_SHA256,
      releaseId: TRUSTED_CONTRACT_RELEASE_ID,
      releaseVersion: TRUSTED_CONTRACT_RELEASE_VERSION,
      releaseDigest: TRUSTED_CONTRACT_RELEASE_DIGEST,
    });
    const authority = await authenticateRetainedAustinTradeBonusArtifact(
      await readFile(RETAINED_CONTRACT_RELEASE_PATH)
    );

    expect(authority.artifactSha256).toBe(
      RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR.artifactSha256
    );
    expect(authority.release).toMatchObject({
      releaseId: RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR.releaseId,
      releaseVersion: RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR.releaseVersion,
      releaseDigest: RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR.releaseDigest,
    });
    expect(authority.contractIdentity).toMatchObject({
      contractId: RETAINED_AUSTIN_CONTRACT_ID,
      playerId: RETAINED_AUSTIN_PLAYER_ID,
      teamId: 'LAL',
      sourceContractPath: 'contract',
    });
    expect(authority.tradeKickerPercent).toBe(
      RETAINED_AUSTIN_TRADE_KICKER_PERCENT
    );
    expect(authority.missingEvidence).toBe(RETAINED_AUSTIN_MISSING_EVIDENCE);
  });

  it('fails closed for missing bytes, a raw-hash mismatch, schema failure, or release-pin mismatch', async () => {
    await expect(
      authenticateRetainedAustinTradeBonusArtifact(new Uint8Array())
    ).rejects.toThrow('artifact digest mismatch');

    const retainedBytes = await readFile(RETAINED_CONTRACT_RELEASE_PATH);
    const corruptedBytes = Buffer.concat([retainedBytes, Buffer.from('\n')]);
    await expect(
      authenticateRetainedAustinTradeBonusArtifact(corruptedBytes)
    ).rejects.toThrow('artifact digest mismatch');

    const malformedBytes = Buffer.from(JSON.stringify({ releaseId: 'broken' }));
    await expect(
      authenticateRetainedAustinTradeBonusArtifact(malformedBytes, {
        ...RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR,
        artifactSha256: retainedArtifactSha256(malformedBytes),
      })
    ).rejects.toThrow('Invalid contract-source release');

    const changedPin = JSON.parse(retainedBytes.toString('utf8')) as Record<
      string,
      unknown
    >;
    changedPin.releaseId = 'changed-release';
    const changedPinBytes = Buffer.from(JSON.stringify(changedPin));
    await expect(
      authenticateRetainedAustinTradeBonusArtifact(changedPinBytes, {
        ...RETAINED_CONTRACT_ARTIFACT_DESCRIPTOR,
        artifactSha256: retainedArtifactSha256(changedPinBytes),
      })
    ).rejects.toThrow(/expected salaryswish-retained-2026-06-05@v1/i);
  });

  it('fails setup for missing or duplicate Austin identity, changed kicker, or missing limitation evidence', async () => {
    const authority = await authenticateRetainedAustinTradeBonusArtifact(
      await readFile(RETAINED_CONTRACT_RELEASE_PATH)
    );

    const missingAustin = cloneRelease(authority.release);
    missingAustin.records = missingAustin.records.filter(
      (record) => record.playerId !== RETAINED_AUSTIN_PLAYER_ID
    );
    expect(() =>
      deriveRetainedAustinTradeBonusAuthority(
        missingAustin,
        authority.artifactSha256
      )
    ).toThrow('found 0');

    const duplicateAustin = cloneRelease(authority.release);
    const retainedRecord = duplicateAustin.records.find(
      (record) => record.playerId === RETAINED_AUSTIN_PLAYER_ID
    );
    expect(retainedRecord).toBeDefined();
    duplicateAustin.records.push(
      cloneRelease({
        ...duplicateAustin,
        records: [retainedRecord!],
      }).records[0]
    );
    expect(() =>
      deriveRetainedAustinTradeBonusAuthority(
        duplicateAustin,
        authority.artifactSha256
      )
    ).toThrow('found 2');

    const changedKicker = cloneRelease(authority.release);
    const changedKickerRecord = changedKicker.records.find(
      (record) => record.playerId === RETAINED_AUSTIN_PLAYER_ID
    );
    expect(changedKickerRecord).toBeDefined();
    changedKickerRecord!.resultingState.terms.bonuses.tradeKickerPercent = 14;
    expect(() =>
      deriveRetainedAustinTradeBonusAuthority(
        changedKicker,
        authority.artifactSha256
      )
    ).toThrow('authenticated 15% kicker');

    const missingLimitation = cloneRelease(authority.release);
    const missingLimitationRecord = missingLimitation.records.find(
      (record) => record.playerId === RETAINED_AUSTIN_PLAYER_ID
    );
    expect(missingLimitationRecord).toBeDefined();
    missingLimitationRecord!.resultingState.evidence =
      missingLimitationRecord!.resultingState.evidence.map((receipt) =>
        receipt.startsWith('terms.bonuses|')
          ? receipt.replace(
              RETAINED_AUSTIN_MISSING_EVIDENCE,
              'missing-bonus-criteria'
            )
          : receipt
      );
    expect(() =>
      deriveRetainedAustinTradeBonusAuthority(
        missingLimitation,
        authority.artifactSha256
      )
    ).toThrow(RETAINED_AUSTIN_MISSING_EVIDENCE);
  });
});
