import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  branchWorld,
  createWorld,
  getWorldMetadata,
} from '@/features/architect/utils/worldManager';
import {
  buildContractSourceRelease,
  canonicalStringify,
  listWorldContractBaselines,
} from '@/features/architect/utils/contractSource';
import { setContractSourceReleaseLoaderForTests } from '@/features/architect/utils/contractSource/contractSourceRelease';
import {
  loadBundledContractSourceRelease,
  resolveContractBaselineWorldCompatibility,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import {
  failMockBatchCommitAfter,
  getAllMockData,
  seedMockData,
  setMockCallable,
} from '../../__mocks__/firebase';
import { makeTestContractSourceRelease } from '../../../tests/fixtures/architect/contractSourceRelease';

const defaultRelease = makeTestContractSourceRelease();

afterEach(() => {
  setContractSourceReleaseLoaderForTests(async () => defaultRelease);
});

function incompleteRelease() {
  const raw = JSON.stringify({
    playerId: 'needs_input_player',
    teamCode: 'FREE',
    contract: {
      contractType: 'VETERAN CONTRACT',
      signingTeam: 'FREE',
      signingDate: null,
      startSeason: '2025-26',
      endSeason: '2025-26',
      contractLength: 0,
      totalValue: 0,
      salariesByYear: [],
    },
    source: { provider: 'SalarySwish', scrapedAt: '2026-06-05T12:00:00Z' },
    version: '1.0',
  });
  return buildContractSourceRelease({
    releaseId: 'needs-input-release',
    releaseVersion: 1,
    releaseDigest: `sha256:${'3'.repeat(64)}`,
    supersedes: null,
    effectiveAt: '2026-06-05T12:00:00Z',
    salaryCapYear: 2026,
    observations: [
      {
        observationId: 'salaryswish:needs_input_player:test',
        artifactPath: 'test/needs_input_player.json',
        artifactSha256: `sha256:${'4'.repeat(64)}`,
        sourceProvider: 'SalarySwish',
        sourceRecordVersion: '1.0',
        observedAt: '2026-06-05T12:00:00Z',
        playerId: 'needs_input_player',
        teamId: 'FREE',
        artifactContent: raw,
      },
    ],
  });
}

describe('BZE-274 fresh-world baseline persistence', () => {
  it('pins and reloads the exact release with deterministic source-establishment roots', async () => {
    const created = await createWorld({
      name: 'Governed contracts',
      userId: 'owner',
      currentSeason: '2026-27',
    });
    const metadata = await getWorldMetadata(created.worldId);
    const documents = await listWorldContractBaselines(created.worldId);

    expect(metadata.contractSourceRelease).toEqual({
      releaseId: defaultRelease.releaseId,
      releaseVersion: defaultRelease.releaseVersion,
      releaseDigest: defaultRelease.releaseDigest,
    });
    expect(metadata.contractBaselineCoverage).toEqual({
      total: 1,
      complete: 1,
      needsInput: 0,
    });
    expect(metadata.asOfDate).toBe('2026-06-05');
    expect(documents).toHaveLength(1);
    expect(documents[0].ledgers[0]).toMatchObject({ payloadVersion: 2 });
    expect(documents[0].ledgers[0].events[0]).toMatchObject({
      eventKind: 'source-establishment',
      worldId: created.worldId,
      predecessorContractVersion: null,
      resultingContractVersion: 1,
    });
  });

  it('preserves byte-equivalent terms, evidence, state digests, and release pins when branching', async () => {
    const parent = await createWorld({ name: 'Parent', userId: 'owner' });
    const parentDocuments = await listWorldContractBaselines(parent.worldId);

    const alternate = {
      ...defaultRelease,
      releaseId: 'a-later-bundled-release',
    };
    setContractSourceReleaseLoaderForTests(async () => alternate);
    const child = await branchWorld(parent.worldId, 'Child', '', 'owner');
    const childDocuments = await listWorldContractBaselines(child.worldId);

    expect(
      (await getWorldMetadata(child.worldId)).contractSourceRelease
    ).toEqual((await getWorldMetadata(parent.worldId)).contractSourceRelease);
    expect(childDocuments[0].ledgers[0].events[0].worldId).toBe(child.worldId);
    expect(
      childDocuments[0].ledgers[0].events[0].resultingState.stateDigest
    ).toBe(parentDocuments[0].ledgers[0].events[0].resultingState.stateDigest);
    expect(
      canonicalStringify(childDocuments[0].ledgers[0].events[0].resultingState)
    ).toBe(
      canonicalStringify(parentDocuments[0].ledgers[0].events[0].resultingState)
    );
  });

  it('allows honest record incompleteness without corrupting the world', async () => {
    const release = incompleteRelease();
    setContractSourceReleaseLoaderForTests(async () => release);
    const created = await createWorld({ name: 'Needs input', userId: 'owner' });
    const metadata = await getWorldMetadata(created.worldId);
    const [document] = await listWorldContractBaselines(created.worldId);

    expect(metadata.contractBaselineCoverage).toEqual({
      total: 1,
      complete: 0,
      needsInput: 1,
    });
    expect(
      document.ledgers[0].events[0].resultingState.completeness
    ).toMatchObject({ status: 'needs-input' });
  });

  it('rejects release-level failure before any world data is persisted', async () => {
    setContractSourceReleaseLoaderForTests(async () => {
      throw new Error('Invalid contract-source release: digest mismatch');
    });
    const before = [...getAllMockData().keys()];
    await expect(
      createWorld({ name: 'Must not exist', userId: 'owner' })
    ).rejects.toThrow('digest mismatch');
    expect([...getAllMockData().keys()]).toEqual(before);
  });

  it('does not cache a rejected bundled-release request', async () => {
    setContractSourceReleaseLoaderForTests(null);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(loadBundledContractSourceRelease()).rejects.toThrow('(503)');
    await expect(loadBundledContractSourceRelease()).rejects.toThrow('(503)');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it('distinguishes legacy worlds from malformed governed metadata', () => {
    expect(
      resolveContractBaselineWorldCompatibility({ worldName: 'Legacy' })
    ).toMatchObject({
      compatible: false,
      message: expect.stringContaining('predates governed baseline contracts'),
    });
    expect(
      resolveContractBaselineWorldCompatibility({ contractBaselineVersion: 2 })
    ).toMatchObject({
      compatible: false,
      message: expect.stringContaining(
        'malformed governed contract baseline metadata'
      ),
    });
  });

  it('fails a corrupt baseline and an incompatible old world without a partial branch', async () => {
    const parent = await createWorld({ name: 'Parent', userId: 'owner' });
    seedMockData(
      `architect_worlds/${parent.worldId}/contractBaselines/LAL-000`,
      {}
    );
    const beforeCorrupt = [...getAllMockData().keys()];
    await expect(
      branchWorld(parent.worldId, 'Broken child', '', 'owner')
    ).rejects.toThrow('Contract baseline is malformed');
    expect([...getAllMockData().keys()]).toEqual(beforeCorrupt);

    seedMockData('architect_worlds/old-world', {
      worldId: 'old-world',
      worldName: 'Old world',
      createdBy: 'owner',
      rightsLedgerVersion: 1,
    });
    await expect(
      branchWorld('old-world', 'No migration', '', 'owner')
    ).rejects.toThrow('predates governed baseline contracts');
    expect(getAllMockData().has('architect_worlds/No migration')).toBe(false);
  });

  it('purges a hidden child when a later branch-copy batch fails', async () => {
    const parent = await createWorld({ name: 'Parent', userId: 'owner' });
    let purgedWorldId: string | null = null;
    setMockCallable('purgeArchitectWorld', (data) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'worldId' in data &&
        typeof data.worldId === 'string'
      ) {
        purgedWorldId = data.worldId;
      }
      return { success: true };
    });
    failMockBatchCommitAfter(1, new Error('copy batch failed'));

    await expect(
      branchWorld(parent.worldId, 'Atomic child', '', 'owner')
    ).rejects.toThrow('copy batch failed');
    expect(purgedWorldId).toMatch(/^world_/);
  });
});
