/** Deterministic verifier for private PST source-release metadata and bytes. */

import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import {
  PstSourceReleaseZ,
  type PstReleaseArtifact,
  type PstSourcePageCapture,
  type PstSourceRelease,
} from '../../src/schemas/pstSourceRelease';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CHALLENGE_TOKEN_PATTERN = /__cf_chl|cf_clearance/i;
const EXPECTED_REPEAT_IDS = ['team-CHI', 'team-HOU', 'year-2026'];
const EXPECTED_REQUIRED_PAGE_IDS = [
  'year-index',
  ...[
    'ATL',
    'BOS',
    'BKN',
    'CHA',
    'CHI',
    'CLE',
    'DAL',
    'DEN',
    'DET',
    'GSW',
    'HOU',
    'IND',
    'LAC',
    'LAL',
    'MEM',
    'MIA',
    'MIL',
    'MIN',
    'NOP',
    'NYK',
    'OKC',
    'ORL',
    'PHI',
    'PHX',
    'POR',
    'SAC',
    'SAS',
    'TOR',
    'UTA',
    'WAS',
  ].map((team) => `team-${team}`),
  ...Array.from({ length: 8 }, (_, index) => `year-${2026 + index}`),
].sort(compareCodePoints);

const CaptureArtifactZ = z
  .object({
    kind: z.enum(['rawHtml', 'serializedDom', 'screenshot']),
    relativePath: z.string().min(1),
    byteSize: z.number().int().nonnegative(),
    sha256: z.string().regex(SHA256_PATTERN),
    dimensions: z
      .object({ width: z.number().int(), height: z.number().int() })
      .optional(),
  })
  .passthrough();

const CaptureInventoryFileZ = CaptureArtifactZ.extend({
  targetId: z.string().min(1),
  repeatOf: z.string().nullable(),
});

const CaptureResultZ = z
  .object({
    sequence: z.number().int(),
    targetId: z.string().min(1),
    targetType: z.enum(['index', 'team', 'year']),
    repeatOf: z.string().nullable(),
    expectedIdentity: z.string().min(1),
    requestedUrl: z.string().url(),
    finalUrl: z.string().url(),
    outcome: z.literal('success'),
    pageTitle: z.string().min(1),
    pstLastUpdated: z.string().nullable(),
    genuinePstContent: z.literal(true),
    semanticSha256: z.string().regex(SHA256_PATTERN),
    files: z.array(CaptureArtifactZ).length(3),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1),
  })
  .passthrough();

const CaptureManifestZ = z
  .object({
    schemaVersion: z.string().min(1),
    generatedAt: z.string().min(1),
    requiredPageCount: z.literal(39),
    repeatPageCount: z.literal(3),
    files: z.array(CaptureInventoryFileZ).length(126),
    results: z.array(CaptureResultZ).length(42),
  })
  .passthrough();

type CaptureManifest = z.infer<typeof CaptureManifestZ>;
type CaptureResult = z.infer<typeof CaptureResultZ>;

export type PstSourceReleaseVerificationInput = {
  releasePath: string;
  evidenceDirectory: string;
  archivePath?: string;
};

export type PstSourceReleaseVerificationReceipt = {
  releaseId: string;
  releaseVersion: number;
  releaseDigestSha256: string;
  archiveSha256: string | null;
  manifestSha256: string;
  canonicalRequiredPages: 39;
  repeatEvidenceCaptures: 3;
  capturedFilesVerified: 126;
  packageFilesVerified: 128;
};

export class PstSourceReleaseVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PstSourceReleaseVerificationError';
  }
}

export function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    fail('Canonical release metadata cannot contain undefined values.');
  }
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined)
      fail('Release metadata is not JSON-serializable.');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => compareCodePoints(left, right)
  );
  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(',')}}`;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function computePstSourceReleaseDigest(
  release: Omit<PstSourceRelease, 'releaseDigestSha256'> | PstSourceRelease
): string {
  const { releaseDigestSha256: _ignored, ...material } =
    release as PstSourceRelease;
  return sha256(canonicalJson(material));
}

function fail(message: string): never {
  throw new PstSourceReleaseVerificationError(message);
}

function sameStrings(actual: string[], expected: string[]): boolean {
  return (
    JSON.stringify([...actual].sort(compareCodePoints)) ===
    JSON.stringify([...expected].sort(compareCodePoints))
  );
}

function assertNoChallengeToken(value: string, location: string): void {
  if (CHALLENGE_TOKEN_PATTERN.test(value)) {
    fail(`Challenge-token value is forbidden at ${location}.`);
  }
}

function assertSafeRelativePath(value: string, location: string): void {
  if (
    path.isAbsolute(value) ||
    value.startsWith('\\') ||
    value.split(/[\\/]/).includes('..')
  ) {
    fail(`Unsafe relative path is forbidden at ${location}.`);
  }
}

function pageArtifacts(page: PstSourcePageCapture): PstReleaseArtifact[] {
  return [page.rawResponse, page.serializedDom, page.screenshot];
}

export function verifyPstSourceReleaseInvariants(
  release: PstSourceRelease
): void {
  const expectedDigest = computePstSourceReleaseDigest(release);
  if (release.releaseDigestSha256 !== expectedDigest) {
    fail('Release digest does not match the canonical release metadata.');
  }
  const expectedReleaseId = `pst-current-${release.source.captureIssue.toLowerCase()}-${release.sourceCaptureManifest.sha256.slice(0, 16)}`;
  if (release.releaseId !== expectedReleaseId) {
    fail(
      `Release ID must be the immutable content identity ${expectedReleaseId}.`
    );
  }
  if (release.supersedes?.releaseId === release.releaseId) {
    fail('A release cannot supersede itself.');
  }
  if (
    release.source.capturedAt.startedAt >= release.source.capturedAt.completedAt
  ) {
    fail('Release capture window is not increasing.');
  }

  const required = release.pages.filter(
    (page) => page.classification === 'canonical-required'
  );
  const repeats = release.pages.filter(
    (page) => page.classification === 'repeat-evidence'
  );
  if (required.length !== 39 || repeats.length !== 3) {
    fail('Release must contain 39 canonical pages and 3 repeat captures.');
  }
  if (
    !sameStrings(
      required.map((page) => page.sourcePageId),
      EXPECTED_REQUIRED_PAGE_IDS
    )
  ) {
    fail('Canonical source-page set is missing, duplicated, or unexpected.');
  }
  if (
    !sameStrings(
      repeats.map((page) => page.sourcePageId),
      EXPECTED_REPEAT_IDS
    )
  ) {
    fail(
      'Repeat-evidence source-page set is missing, duplicated, or unexpected.'
    );
  }
  const ordered = [...release.pages].sort(
    (left, right) => left.sequence - right.sequence
  );
  ordered.forEach((page, index) => {
    if (page.sequence !== index + 1) {
      fail(
        'Page capture sequences must be unique and contiguous from 1 to 42.'
      );
    }
  });
  const captureIds = release.pages.map((page) => page.captureId);
  if (new Set(captureIds).size !== captureIds.length) {
    fail('Duplicate capture identity detected.');
  }

  for (const page of release.pages) {
    assertNoChallengeToken(page.requestedUrl, `${page.captureId}.requestedUrl`);
    assertNoChallengeToken(page.finalUrl, `${page.captureId}.finalUrl`);
    if (page.requestedUrl !== page.finalUrl) {
      fail(`Requested/final URL drift for ${page.captureId}.`);
    }
    if (page.captureStartedAt >= page.captureCompletedAt) {
      fail(`Capture window is not increasing for ${page.captureId}.`);
    }
    const expectedType =
      page.sourcePageId === 'year-index'
        ? 'index'
        : page.sourcePageId.startsWith('team-')
          ? 'team'
          : 'year';
    if (page.pageType !== expectedType) {
      fail(`Page type does not match source identity for ${page.captureId}.`);
    }
    if (page.classification === 'canonical-required') {
      if (page.repeatOf !== null || page.captureId !== page.sourcePageId) {
        fail(`Canonical page identity is malformed for ${page.captureId}.`);
      }
    } else if (
      page.repeatOf !== page.sourcePageId ||
      page.captureId !== `${page.sourcePageId}:repeat-1`
    ) {
      fail(`Repeat capture identity is malformed for ${page.captureId}.`);
    }
    if (!page.rawResponse.relativePath.startsWith('raw/')) {
      fail(`Raw response path is malformed for ${page.captureId}.`);
    }
    if (!page.serializedDom.relativePath.startsWith('dom/')) {
      fail(`Serialized DOM path is malformed for ${page.captureId}.`);
    }
    if (!page.screenshot.relativePath.startsWith('screenshots/')) {
      fail(`Screenshot path is malformed for ${page.captureId}.`);
    }
  }

  const artifactPaths = release.pages
    .flatMap(pageArtifacts)
    .map((artifact) => artifact.relativePath);
  if (new Set(artifactPaths).size !== 126) {
    fail('Release metadata has a duplicate evidence-file path.');
  }

  for (const repeat of repeats) {
    const original = required.find(
      (page) => page.sourcePageId === repeat.sourcePageId
    );
    if (!original) fail(`Repeat ${repeat.captureId} has no canonical page.`);
    const stable =
      repeat.expectedIdentity === original.expectedIdentity &&
      repeat.requestedUrl === original.requestedUrl &&
      repeat.finalUrl === original.finalUrl &&
      repeat.pageTitle === original.pageTitle &&
      repeat.pstLastUpdated === original.pstLastUpdated &&
      repeat.semanticSha256 === original.semanticSha256 &&
      repeat.rawResponse.byteSize === original.rawResponse.byteSize &&
      repeat.rawResponse.sha256 === original.rawResponse.sha256;
    if (!stable) {
      fail(
        `Repeat page ${repeat.sourcePageId} is unstable in canonical content.`
      );
    }
  }
}

async function parseRelease(releasePath: string): Promise<PstSourceRelease> {
  let raw: string;
  try {
    raw = await readFile(releasePath, 'utf8');
  } catch (error) {
    fail(`Cannot read source-release metadata: ${(error as Error).message}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('Malformed source-release metadata JSON.');
  }
  const parsed = PstSourceReleaseZ.safeParse(value);
  if (!parsed.success) {
    fail(`Malformed source-release metadata: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

async function parseCaptureManifest(
  manifestPath: string
): Promise<{ bytes: Uint8Array; manifest: CaptureManifest }> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(manifestPath);
  } catch (error) {
    fail(`Cannot read capture manifest: ${(error as Error).message}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    fail('Malformed capture manifest JSON.');
  }
  const parsed = CaptureManifestZ.safeParse(value);
  if (!parsed.success) {
    fail(`Malformed capture manifest: ${z.prettifyError(parsed.error)}`);
  }
  return { bytes, manifest: parsed.data };
}

async function regularFileInventory(
  root: string,
  directory = root
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await regularFileInventory(root, absolute)));
    } else if (entry.isFile()) {
      paths.push(path.relative(root, absolute).split(path.sep).join('/'));
    } else {
      fail(`Evidence package contains a non-regular entry: ${absolute}`);
    }
  }
  return paths.sort(compareCodePoints);
}

function releaseArtifactFor(
  page: PstSourcePageCapture,
  kind: z.infer<typeof CaptureArtifactZ>['kind']
): PstReleaseArtifact {
  if (kind === 'rawHtml') return page.rawResponse;
  if (kind === 'serializedDom') return page.serializedDom;
  return page.screenshot;
}

function assertCaptureResultMatchesRelease(
  result: CaptureResult,
  page: PstSourcePageCapture
): void {
  const expectedCaptureId = result.repeatOf
    ? `${result.targetId}:repeat-1`
    : result.targetId;
  const scalarMatches =
    page.captureId === expectedCaptureId &&
    page.sourcePageId === result.targetId &&
    page.sequence === result.sequence &&
    page.pageType === result.targetType &&
    page.repeatOf === result.repeatOf &&
    page.expectedIdentity === result.expectedIdentity &&
    page.requestedUrl === result.requestedUrl &&
    page.finalUrl === result.finalUrl &&
    page.pageTitle === result.pageTitle &&
    page.captureStartedAt === result.startedAt &&
    page.captureCompletedAt === result.completedAt &&
    page.pstLastUpdated === result.pstLastUpdated &&
    page.semanticSha256 === result.semanticSha256;
  if (!scalarMatches) {
    fail(
      `Release page metadata differs from capture manifest for ${page.captureId}.`
    );
  }
  for (const file of result.files) {
    const releaseArtifact = releaseArtifactFor(page, file.kind);
    if (
      releaseArtifact.relativePath !== file.relativePath ||
      releaseArtifact.byteSize !== file.byteSize ||
      releaseArtifact.sha256 !== file.sha256
    ) {
      fail(
        `Release artifact metadata differs for ${page.captureId}/${file.kind}.`
      );
    }
    if (
      file.kind === 'screenshot' &&
      (file.dimensions?.width !== page.screenshot.width ||
        file.dimensions.height !== page.screenshot.height)
    ) {
      fail(`Screenshot dimensions differ for ${page.captureId}.`);
    }
  }
}

export async function verifyPstSourceRelease(
  input: PstSourceReleaseVerificationInput
): Promise<PstSourceReleaseVerificationReceipt> {
  const release = await parseRelease(input.releasePath);
  verifyPstSourceReleaseInvariants(release);

  const evidenceRoot = path.resolve(input.evidenceDirectory);
  const manifestPath = path.join(
    evidenceRoot,
    release.sourceCaptureManifest.relativePath
  );
  const { bytes: manifestBytes, manifest } =
    await parseCaptureManifest(manifestPath);
  const manifestSha256 = sha256(manifestBytes);
  if (manifestSha256 !== release.sourceCaptureManifest.sha256) {
    fail('Capture manifest SHA-256 does not match release metadata.');
  }
  if (manifest.schemaVersion !== release.sourceCaptureManifest.schemaVersion) {
    fail('Capture manifest schema version does not match release metadata.');
  }
  assertNoChallengeToken(
    Buffer.from(manifestBytes).toString('utf8'),
    'capture manifest'
  );

  const sidecarPath = path.join(
    evidenceRoot,
    release.sourceCaptureManifest.sidecarRelativePath
  );
  const expectedSidecar = `${manifestSha256}  ${release.sourceCaptureManifest.relativePath}\n`;
  let sidecar: string;
  try {
    sidecar = await readFile(sidecarPath, 'utf8');
  } catch (error) {
    fail(`Cannot read capture-manifest sidecar: ${(error as Error).message}`);
  }
  if (sidecar !== expectedSidecar) {
    fail('Capture-manifest sidecar does not match the retained manifest.');
  }

  const manifestPaths = manifest.files.map((file) => file.relativePath);
  if (new Set(manifestPaths).size !== 126) {
    fail('Capture manifest has a duplicate evidence-file path.');
  }
  manifest.files.forEach((file) =>
    assertSafeRelativePath(
      file.relativePath,
      `capture manifest ${file.relativePath}`
    )
  );
  const resultSequences = manifest.results.map((result) => result.sequence);
  if (
    new Set(resultSequences).size !== 42 ||
    !sameStrings(
      resultSequences.map(String),
      Array.from({ length: 42 }, (_, index) => String(index + 1))
    )
  ) {
    fail('Capture manifest result sequences are missing or duplicated.');
  }
  const inventoryByPath = new Map(
    manifest.files.map((file) => [file.relativePath, file])
  );
  for (const result of manifest.results) {
    const kinds = result.files.map((file) => file.kind);
    if (!sameStrings(kinds, ['rawHtml', 'serializedDom', 'screenshot'])) {
      fail(
        `Capture result ${result.sequence} has missing or duplicate evidence kinds.`
      );
    }
    for (const file of result.files) {
      assertSafeRelativePath(
        file.relativePath,
        `capture result ${result.sequence}/${file.kind}`
      );
      const inventoryFile = inventoryByPath.get(file.relativePath);
      if (
        !inventoryFile ||
        inventoryFile.targetId !== result.targetId ||
        inventoryFile.repeatOf !== result.repeatOf ||
        inventoryFile.kind !== file.kind ||
        inventoryFile.byteSize !== file.byteSize ||
        inventoryFile.sha256 !== file.sha256
      ) {
        fail(
          `Capture manifest inventories disagree for result ${result.sequence}/${file.kind}.`
        );
      }
    }
  }
  const actualPaths = await regularFileInventory(evidenceRoot);
  const expectedPaths = [
    ...manifestPaths,
    release.sourceCaptureManifest.relativePath,
    release.sourceCaptureManifest.sidecarRelativePath,
  ];
  if (!sameStrings(actualPaths, expectedPaths)) {
    fail('Recovered evidence inventory is missing files or contains extras.');
  }

  for (const file of manifest.files) {
    const absolute = path.join(evidenceRoot, file.relativePath);
    const fileStat = await lstat(absolute);
    if (!fileStat.isFile())
      fail(`Evidence entry is not a file: ${file.relativePath}`);
    const bytes = await readFile(absolute);
    if (bytes.byteLength !== file.byteSize) {
      fail(`Evidence byte-size mismatch: ${file.relativePath}`);
    }
    if (sha256(bytes) !== file.sha256) {
      fail(`Evidence SHA-256 mismatch: ${file.relativePath}`);
    }
  }

  const pagesBySequence = new Map(
    release.pages.map((page) => [page.sequence, page])
  );
  for (const result of manifest.results) {
    const page = pagesBySequence.get(result.sequence);
    if (!page)
      fail(`Capture result ${result.sequence} is missing from the release.`);
    assertNoChallengeToken(
      result.requestedUrl,
      `capture result ${result.sequence}`
    );
    assertNoChallengeToken(
      result.finalUrl,
      `capture result ${result.sequence}`
    );
    assertCaptureResultMatchesRelease(result, page);
  }

  let archiveSha256: string | null = null;
  if (input.archivePath) {
    if (path.basename(input.archivePath) !== release.package.archiveName) {
      fail('Archive filename does not match release metadata.');
    }
    const archiveStat = await stat(input.archivePath);
    if (
      !archiveStat.isFile() ||
      archiveStat.size !== release.package.byteSize
    ) {
      fail('Archive byte size does not match release metadata.');
    }
    archiveSha256 = sha256(await readFile(input.archivePath));
    if (archiveSha256 !== release.package.sha256) {
      fail('Archive SHA-256 does not match release metadata.');
    }
  }

  return {
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseDigestSha256: release.releaseDigestSha256,
    archiveSha256,
    manifestSha256,
    canonicalRequiredPages: 39,
    repeatEvidenceCaptures: 3,
    capturedFilesVerified: 126,
    packageFilesVerified: 128,
  };
}

function parseCliArgs(argv: string[]): PstSourceReleaseVerificationInput {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--release', '--evidence', '--archive'].includes(key) || !value) {
      fail(
        'Usage: --release <json> --evidence <directory> [--archive <tar.gz>]'
      );
    }
    values.set(key, value);
  }
  const releasePath = values.get('--release');
  const evidenceDirectory = values.get('--evidence');
  if (!releasePath || !evidenceDirectory) {
    fail('Usage: --release <json> --evidence <directory> [--archive <tar.gz>]');
  }
  return {
    releasePath,
    evidenceDirectory,
    archivePath: values.get('--archive'),
  };
}

async function main(): Promise<void> {
  const receipt = await verifyPstSourceRelease(
    parseCliArgs(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
