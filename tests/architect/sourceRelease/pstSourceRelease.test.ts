import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CalendarDateZ,
  CaptureTimestampZ,
  PstSourceReleaseZ,
  type PstSourcePageCapture,
  type PstSourceRelease,
} from '@/schemas/pstSourceRelease';
import {
  computePstSourceReleaseDigest,
  verifyPstSourceRelease,
  verifyPstSourceReleaseInvariants,
} from '../../../scripts/source-releases/verify-pst-source-release';
import { HISTORICAL_PST_DIGEST, requireAcceptedPstSource } from '../../../scripts/source-releases/pst-lifecycle/acceptedSources';

const CHECKED_IN_RELEASE = path.resolve(
  'docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json'
);
const temporaryRoots: string[] = [];

type SyntheticFixture = {
  root: string;
  evidenceDirectory: string;
  releasePath: string;
  archivePath: string;
  release: PstSourceRelease;
};

/** Computes fixture hashes with the same byte semantics as the verifier. */
const sha256 = (value: Uint8Array | string): string =>
  createHash('sha256').update(value).digest('hex');

/** Recomputes and writes strict release metadata after a fixture mutation. */
async function writeRelease(fixture: SyntheticFixture): Promise<void> {
  fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
    fixture.release
  );
  await writeFile(
    fixture.releasePath,
    `${JSON.stringify(PstSourceReleaseZ.parse(fixture.release), null, 2)}\n`,
    'utf8'
  );
}

/** Builds the manifest inventory entry for one synthetic page artifact. */
function resultFile(
  page: PstSourcePageCapture,
  kind: 'rawHtml' | 'serializedDom' | 'screenshot'
) {
  const artifact =
    kind === 'rawHtml'
      ? page.rawResponse
      : kind === 'serializedDom'
        ? page.serializedDom
        : page.screenshot;
  return {
    targetId: page.sourcePageId,
    repeatOf: page.repeatOf,
    kind,
    relativePath: artifact.relativePath,
    byteSize: artifact.byteSize,
    sha256: artifact.sha256,
    ...(kind === 'screenshot'
      ? { dimensions: { width: 1280, height: 720 } }
      : {}),
  };
}

/** Creates an isolated complete release package for success and failure tests. */
async function makeSyntheticFixture(): Promise<SyntheticFixture> {
  const root = await mkdtemp(path.join(tmpdir(), 'bze305-pst-release-'));
  temporaryRoots.push(root);
  const evidenceDirectory = path.join(root, 'evidence');
  await mkdir(evidenceDirectory, { recursive: true });
  const release = PstSourceReleaseZ.parse(
    JSON.parse(await readFile(CHECKED_IN_RELEASE, 'utf8'))
  );

  for (const page of release.pages) {
    for (const kind of ['rawHtml', 'serializedDom', 'screenshot'] as const) {
      const artifact =
        kind === 'rawHtml'
          ? page.rawResponse
          : kind === 'serializedDom'
            ? page.serializedDom
            : page.screenshot;
      const contentIdentity =
        kind === 'rawHtml' ? page.sourcePageId : page.captureId;
      const bytes = Buffer.from(`synthetic:${contentIdentity}:${kind}\n`);
      const absolute = path.join(evidenceDirectory, artifact.relativePath);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, bytes);
      artifact.byteSize = bytes.byteLength;
      artifact.sha256 = sha256(bytes);
    }
  }

  const results = release.pages.map((page) => ({
    sequence: page.sequence,
    targetId: page.sourcePageId,
    targetType: page.pageType,
    repeatOf: page.repeatOf,
    expectedIdentity: page.expectedIdentity,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    outcome: 'success',
    pageTitle: page.pageTitle,
    pstLastUpdated: page.pstLastUpdated,
    genuinePstContent: true,
    semanticSha256: page.semanticSha256,
    files: [
      resultFile(page, 'rawHtml'),
      resultFile(page, 'serializedDom'),
      resultFile(page, 'screenshot'),
    ],
    startedAt: page.captureStartedAt,
    completedAt: page.captureCompletedAt,
  }));
  const manifest = {
    schemaVersion: release.sourceCaptureManifest.schemaVersion,
    generatedAt: release.source.capturedAt.completedAt,
    requiredPageCount: 39,
    repeatPageCount: 3,
    files: results.flatMap((result) => result.files),
    results,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(evidenceDirectory, 'manifest.json'), manifestBytes);
  release.sourceCaptureManifest.sha256 = sha256(manifestBytes);
  await writeFile(
    path.join(evidenceDirectory, 'manifest.sha256'),
    `${release.sourceCaptureManifest.sha256}  manifest.json\n`,
    'utf8'
  );
  release.releaseId = `pst-current-${release.source.captureIssue.toLowerCase()}-${release.sourceCaptureManifest.sha256.slice(0, 16)}`;

  const archivePath = path.join(root, release.package.archiveName);
  const archiveBytes = Buffer.from('synthetic archive bytes\n');
  await writeFile(archivePath, archiveBytes);
  release.package.byteSize = archiveBytes.byteLength;
  release.package.sha256 = sha256(archiveBytes);
  const releasePath = path.join(root, 'release.json');
  const fixture = {
    root,
    evidenceDirectory,
    releasePath,
    archivePath,
    release,
  };
  await writeRelease(fixture);
  return fixture;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('BZE-305 governed PST source release', () => {
  it('verifies declared successor coverage without accepting an unknown release or changing the historical pin', async () => {
    const fixture = await makeSyntheticFixture();
    const previous = fixture.release;
    const successor = { ...previous, schemaVersion: 'scoutzero-pst-source-release/v2' as const, releaseVersion: 2,
      source: { ...previous.source, captureIssue: 'BZE-324' },
      supersedes: { releaseId: previous.releaseId, releaseVersion: previous.releaseVersion, releaseDigestSha256: previous.releaseDigestSha256 },
      coverage: { requiredPageIds: previous.pages.filter(p => p.classification === 'canonical-required').map(p => p.sourcePageId),
        repeatPageIds: previous.pages.filter(p => p.classification === 'repeat-evidence').map(p => p.sourcePageId) },
    };
    successor.releaseId = `pst-current-bze-324-${successor.sourceCaptureManifest.sha256.slice(0, 16)}`;
    fixture.release = PstSourceReleaseZ.parse(successor);
    await writeRelease(fixture);
    await expect(verifyPstSourceRelease(fixture)).resolves.toMatchObject({ canonicalRequiredPages: 39, packageFilesVerified: 128 });
    expect(() => requireAcceptedPstSource(fixture.release.releaseDigestSha256, previous.releaseDigestSha256)).toThrow(/Unknown or unaccepted/);
    expect(requireAcceptedPstSource(HISTORICAL_PST_DIGEST, null)).toBeTruthy();
    expect(() => requireAcceptedPstSource(HISTORICAL_PST_DIGEST, '0'.repeat(64))).toThrow(/Unknown or unaccepted/);
    if (fixture.release.schemaVersion !== 'scoutzero-pst-source-release/v2') throw new Error('Wrong test envelope');
    fixture.release.coverage.requiredPageIds.pop();
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(fixture.release);
    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(/coverage/);
  });

  it('uses exact successor membership for a smaller capture rather than fixed historical counts', async () => {
    const fixture = await makeSyntheticFixture();
    const predecessor = fixture.release;
    const selected = predecessor.pages.filter(p => p.sourcePageId === 'team-CHI' || (p.sourcePageId === 'team-HOU' && p.classification === 'canonical-required'));
    const manifestPath = path.join(fixture.evidenceDirectory, 'manifest.json');
    const manifest: { results: { sequence: number }[]; files: { relativePath: string }[]; requiredPageCount: number; repeatPageCount: number } = JSON.parse(await readFile(manifestPath, 'utf8'));
    const sequences = selected.map(p => p.sequence);
    manifest.results = manifest.results.filter((r) => sequences.includes(r.sequence));
    const keep = new Set(selected.flatMap(p => [p.rawResponse.relativePath, p.serializedDom.relativePath, p.screenshot.relativePath]));
    for (const file of manifest.files) if (!keep.has(file.relativePath)) await unlink(path.join(fixture.evidenceDirectory, file.relativePath));
    manifest.files = manifest.files.filter((f) => keep.has(f.relativePath));
    manifest.results.forEach((r, i) => { r.sequence = i + 1; });
    selected.forEach((p, i) => { p.sequence = i + 1; });
    manifest.requiredPageCount = 2; manifest.repeatPageCount = 1;
    const manifestBytes = JSON.stringify(manifest);
    await writeFile(manifestPath, manifestBytes);
    await writeFile(path.join(fixture.evidenceDirectory, 'manifest.sha256'), `${sha256(manifestBytes)}  manifest.json\n`);
    fixture.release = PstSourceReleaseZ.parse({ ...predecessor, schemaVersion: 'scoutzero-pst-source-release/v2', releaseVersion: 2,
      source: { ...predecessor.source, captureIssue: 'BZE-324' },
      sourceCaptureManifest: { ...predecessor.sourceCaptureManifest, sha256: sha256(manifestBytes) },
      releaseId: `pst-current-bze-324-${sha256(manifestBytes).slice(0, 16)}`,
      supersedes: { releaseId: predecessor.releaseId, releaseVersion: 1, releaseDigestSha256: predecessor.releaseDigestSha256 },
      canonicalPolicy: { ...predecessor.canonicalPolicy, requiredPageCount: 2, repeatCaptureCount: 1 },
      counts: { pageCaptures: 3, canonicalRequiredPages: 2, repeatEvidenceCaptures: 1, rawHtmlFiles: 3, serializedDomFiles: 3, screenshotFiles: 3 },
      package: { ...predecessor.package, capturedFileCount: 9, packageFileCount: 11 }, pages: selected,
      coverage: { requiredPageIds: ['team-CHI', 'team-HOU'], repeatPageIds: ['team-CHI'] },
    });
    await writeRelease(fixture);
    await expect(verifyPstSourceRelease(fixture)).resolves.toMatchObject({ canonicalRequiredPages: 2, repeatEvidenceCaptures: 1, capturedFilesVerified: 9, packageFilesVerified: 11 });
    await writeFile(path.join(fixture.evidenceDirectory, 'extra.html'), 'unexpected');
    await expect(verifyPstSourceRelease(fixture)).rejects.toThrow(/inventory/);
  });

  it('verifies a complete 39-page source set plus three stable repeats', async () => {
    const fixture = await makeSyntheticFixture();

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
        archivePath: fixture.archivePath,
      })
    ).resolves.toMatchObject({
      releaseId: fixture.release.releaseId,
      canonicalRequiredPages: 39,
      repeatEvidenceCaptures: 3,
      capturedFilesVerified: 126,
      packageFilesVerified: 128,
    });
  });

  it('fails closed when a retained source file is corrupted', async () => {
    const fixture = await makeSyntheticFixture();
    const rawPath = path.join(
      fixture.evidenceDirectory,
      fixture.release.pages[0].rawResponse.relativePath
    );
    const bytes = await readFile(rawPath);
    bytes[0] ^= 1;
    await writeFile(rawPath, bytes);

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
      })
    ).rejects.toThrow(/Evidence SHA-256 mismatch/);
  });

  it('fails closed when a retained package file is missing', async () => {
    const fixture = await makeSyntheticFixture();
    await unlink(
      path.join(
        fixture.evidenceDirectory,
        fixture.release.pages[0].rawResponse.relativePath
      )
    );

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
      })
    ).rejects.toThrow(/inventory is missing files/);
  });

  it('fails closed when a canonical page is missing', async () => {
    const fixture = await makeSyntheticFixture();
    fixture.release.pages = fixture.release.pages.filter(
      (page) => page.sourcePageId !== 'year-2033'
    );
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /39 canonical pages/
    );
  });

  it('fails closed on a duplicate canonical page identity', async () => {
    const fixture = await makeSyntheticFixture();
    const duplicate = fixture.release.pages.find(
      (page) => page.sourcePageId === 'team-BOS'
    );
    if (!duplicate) throw new Error('Synthetic fixture is missing team-BOS.');
    duplicate.sourcePageId = 'team-ATL';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /missing, duplicated, or unexpected/
    );
  });

  it('fails closed when release metadata declares a wrong file hash', async () => {
    const fixture = await makeSyntheticFixture();
    fixture.release.pages[0].rawResponse.sha256 = '0'.repeat(64);
    await writeRelease(fixture);

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
      })
    ).rejects.toThrow(/Release artifact metadata differs/);
  });

  it('fails closed when the retained archive hash is wrong', async () => {
    const fixture = await makeSyntheticFixture();
    const bytes = await readFile(fixture.archivePath);
    bytes[0] ^= 1;
    await writeFile(fixture.archivePath, bytes);

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
        archivePath: fixture.archivePath,
      })
    ).rejects.toThrow(/Archive SHA-256/);
  });

  it('fails closed on a malformed capture manifest', async () => {
    const fixture = await makeSyntheticFixture();
    await writeFile(
      path.join(fixture.evidenceDirectory, 'manifest.json'),
      '{not-json',
      'utf8'
    );

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
      })
    ).rejects.toThrow(/Malformed capture manifest JSON/);
  });

  it('enforces the strict release schema', async () => {
    const fixture = await makeSyntheticFixture();
    const malformed = {
      ...fixture.release,
      unexpectedMutableField: true,
    };
    await writeFile(
      fixture.releasePath,
      `${JSON.stringify(malformed)}\n`,
      'utf8'
    );

    await expect(
      verifyPstSourceRelease({
        releasePath: fixture.releasePath,
        evidenceDirectory: fixture.evidenceDirectory,
      })
    ).rejects.toThrow(/Malformed source-release metadata/);
  });

  it('rejects capture-session challenge tokens in page URLs', async () => {
    const fixture = await makeSyntheticFixture();
    fixture.release.pages[0].requestedUrl += '?__cf_chl_rt_tk=secret';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /Challenge-token value is forbidden/
    );
  });

  it('compares capture windows as instants when milliseconds are optional', async () => {
    const fixture = await makeSyntheticFixture();
    fixture.release.source.capturedAt.startedAt = '2026-09-04T06:45:33Z';
    fixture.release.pages[0].captureStartedAt = '2026-09-04T06:45:33Z';
    fixture.release.pages[0].captureCompletedAt = '2026-09-04T06:45:33.001Z';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() =>
      verifyPstSourceReleaseInvariants(fixture.release)
    ).not.toThrow();

    fixture.release.pages[0].captureStartedAt = '2026-09-04T06:45:33.001Z';
    fixture.release.pages[0].captureCompletedAt = '2026-09-04T06:45:33Z';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /Capture window is not increasing/
    );

    fixture.release.source.capturedAt.startedAt = '2026-09-04T06:50:35.001Z';
    fixture.release.source.capturedAt.completedAt = '2026-09-04T06:50:35Z';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /Release capture window is not increasing/
    );
  });

  it('rejects a page capture outside the release window', async () => {
    const fixture = await makeSyntheticFixture();
    fixture.release.pages[0].captureStartedAt = '2026-09-04T06:45:33.362Z';
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /Capture window falls outside the release/
    );
  });

  it('rejects impossible calendar dates and UTC timestamps', () => {
    expect(CalendarDateZ.safeParse('2028-02-29').success).toBe(true);
    expect(CalendarDateZ.safeParse('2026-02-29').success).toBe(false);
    expect(CalendarDateZ.safeParse('2026-13-01').success).toBe(false);
    expect(CaptureTimestampZ.safeParse('2026-09-04T23:59:59Z').success).toBe(
      true
    );
    expect(CaptureTimestampZ.safeParse('2026-09-04T24:00:00Z').success).toBe(
      false
    );
    expect(CaptureTimestampZ.safeParse('2026-09-04T23:60:00Z').success).toBe(
      false
    );
  });

  it('rejects a repeat whose canonical source bytes are unstable', async () => {
    const fixture = await makeSyntheticFixture();
    const repeat = fixture.release.pages.find(
      (page) => page.captureId === 'team-CHI:repeat-1'
    );
    if (!repeat)
      throw new Error('Synthetic fixture is missing the CHI repeat.');
    repeat.semanticSha256 = '0'.repeat(64);
    fixture.release.releaseDigestSha256 = computePstSourceReleaseDigest(
      fixture.release
    );

    expect(() => verifyPstSourceReleaseInvariants(fixture.release)).toThrow(
      /unstable in canonical content/
    );
  });
});
