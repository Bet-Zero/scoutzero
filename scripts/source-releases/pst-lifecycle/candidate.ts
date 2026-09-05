/** Reproducible private artifacts from the accepted source release only. */
import { createHash } from 'node:crypto';
import {
  readFile,
  realpath,
  lstat,
  readdir,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PstSourceReleaseZ } from '@/schemas/pstSourceRelease';
import {
  canonicalJson,
  compareCodePoints,
  verifyPstSourceRelease,
} from '../verify-pst-source-release';
import { observePstPage } from './observe';
import { reconstructPst } from './reconstruct';
import { accountPst, validateComparison } from './account';
import { uncapturedHistoryReferences } from './reference-gaps';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const PARSER_VERSION = 'pst-lifecycle-parser-v1';
export const SCHEMA_VERSION = 'pst-lifecycle-candidate-v1';
export const ACCEPTED_RELEASE_DIGEST =
  '44a18a7c339906ab147cc026d0e598d6d7ee655a2427c767fdce1685cd30cb7a';
export const COMPARISON_PATH =
  'docs/reference/sources/releases/pst/pst-exposure-comparison-bze306-v1.json';
const implementationPaths = [
  'src/schemas/pstLifecycle.ts',
  'src/schemas/pstSourceRelease.ts',
  'scripts/source-releases/verify-pst-source-release.ts',
  'scripts/source-releases/pst-lifecycle/observe.ts',
  'scripts/source-releases/pst-lifecycle/terms.ts',
  'scripts/source-releases/pst-lifecycle/reconstruct.ts',
  'scripts/source-releases/pst-lifecycle/branch-links.ts',
  'scripts/source-releases/pst-lifecycle/dependency-links.ts',
  'scripts/source-releases/pst-lifecycle/account.ts',
  'scripts/source-releases/pst-lifecycle/reference-gaps.ts',
  'scripts/source-releases/pst-lifecycle/candidate.ts',
  'scripts/source-releases/pst-lifecycle/cli.ts',
  'team-scrape/draft-picks/scripts/pst/pst_team_slugs.ts',
  'package-lock.json',
];
const hash = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const serialize = (value: unknown) => `${canonicalJson(value)}\n`;
export type CandidateInputs = {
  releasePath: string;
  evidenceDirectory: string;
  archivePath: string;
  legacyPath: string;
  reverseEnumeration?: boolean;
};

async function fingerprintImplementation() {
  const files = [];
  for (const filename of [...implementationPaths].sort(compareCodePoints))
    files.push({
      path: filename,
      sha256: hash(await readFile(path.join(ROOT, filename))),
    });
  return files;
}

/** Verify source integrity before any interpretation and generate only path-free content. */
export async function buildPstCandidate(
  inputs: CandidateInputs
): Promise<Map<string, string | Buffer>> {
  const initialImplementation = await fingerprintImplementation();
  const sourceVerification = await verifyPstSourceRelease(inputs);
  if (sourceVerification.releaseDigestSha256 !== ACCEPTED_RELEASE_DIGEST)
    throw new Error('This parser requires the accepted BZE-304 release');
  const release = PstSourceReleaseZ.parse(
    JSON.parse(await readFile(inputs.releasePath, 'utf8'))
  );
  const comparisonBytes = await readFile(path.join(ROOT, COMPARISON_PATH));
  const comparison = JSON.parse(comparisonBytes.toString('utf8'));
  const assets = validateComparison(comparison.entitlements);
  const legacyBytes = await readFile(inputs.legacyPath);
  if (
    hash(legacyBytes) !== comparison.originalArtifactSha256 ||
    legacyBytes.byteLength !== comparison.originalArtifactBytes
  )
    throw new Error('Legacy comparison artifact drift');
  const legacy = JSON.parse(legacyBytes.toString('utf8'));
  const legacyIds = legacy.assets
    .filter((asset: { round: number }) => asset.round === 1)
    .map((asset: { id: string }) => asset.id)
    .sort(compareCodePoints);
  if (
    canonicalJson(legacyIds) !== canonicalJson(assets.map((asset) => asset.id))
  )
    throw new Error('Pinned comparison IDs disagree with original artifact');
  for (const asset of assets) {
    const original = legacy.assets.find(
      (item: { id: string }) => item.id === asset.id
    );
    for (const [key, value] of Object.entries(asset)) {
      if (canonicalJson(value) !== canonicalJson(original[key]))
        throw new Error(
          `Comparison field differs from pinned original: ${asset.id}/${key}`
        );
    }
  }
  const selected = release.pages.filter(
    (page) => page.classification === 'canonical-required'
  );
  if (inputs.reverseEnumeration) selected.reverse();
  const pages = [];
  for (const page of selected)
    pages.push(
      observePstPage(
        await readFile(
          path.join(inputs.evidenceDirectory, page.rawResponse.relativePath),
          'utf8'
        ),
        page
      )
    );
  pages.sort((a, b) => compareCodePoints(a.id, b.id));
  const reconstruction = reconstructPst(pages);
  if (reconstruction.implementationConcerns.length)
    throw new Error(
      `Unresolved implementation concerns: ${canonicalJson(reconstruction.implementationConcerns)}`
    );
  const accounting = accountPst(assets, pages, reconstruction);
  const uncapturedReferences = uncapturedHistoryReferences(
    pages,
    reconstruction.transactions,
    accounting.register
  );
  const parserFiles = await fingerprintImplementation();
  if (canonicalJson(initialImplementation) !== canonicalJson(parserFiles))
    throw new Error('Implementation changed during candidate generation');
  const provenance = {
    schemaVersion: SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
    parserFiles,
    parserDigestSha256: hash(serialize(parserFiles)),
    sourceVerification,
    comparisonSha256: hash(comparisonBytes),
    positivePathAuthority: 'unavailable',
    runtimeConsumption: false,
  };
  const files = new Map<string, string | Buffer>();
  files.set(
    'observations.json',
    serialize({
      schemaVersion: 'pst-source-observations-v1',
      sourceReleaseDigest: ACCEPTED_RELEASE_DIGEST,
      pages,
    })
  );
  files.set(
    'lifecycles.json',
    serialize({
      schemaVersion: SCHEMA_VERSION,
      ...reconstruction,
      branchReferences: accounting.branchReferences,
      dependencyLinks: accounting.dependencyLinks,
    })
  );
  files.set(
    'register.json',
    serialize({
      provenance,
      counts: accounting.counts,
      byKindYear: accounting.byKindYear,
      register: accounting.register,
    })
  );
  files.set(
    'non-complete.json',
    serialize({
      counts: accounting.counts,
      entitlements: accounting.nonComplete,
    })
  );
  files.set(
    'external-facts.json',
    serialize({
      sourceReleaseDigest: ACCEPTED_RELEASE_DIGEST,
      facts: accounting.externalFacts,
      uncapturedReferences,
    })
  );
  files.set('comparison-input.json', legacyBytes);
  const coverage = {
    ...provenance,
    comparisonCount: assets.length,
    comparisonByKind: comparison.counts,
    counts: accounting.counts,
    byKindYear: accounting.byKindYear,
    observations: {
      canonicalPages: pages.length,
      tables: pages.reduce((count, page) => count + page.tables.length, 0),
      rows: pages.reduce((count, page) => count + page.rows.length, 0),
      cells: pages.reduce(
        (count, page) =>
          count + page.rows.reduce((sum, row) => sum + row.cells.length, 0),
        0
      ),
      transactions: reconstruction.transactions.length,
    },
    reconstruction: {
      assertionGroups: reconstruction.assertions.length,
      assetHistoriesIncludingSupportingAssets: reconstruction.histories.length,
      branchAssetReferences: accounting.branchReferences.length,
      implementationConcerns: reconstruction.implementationConcerns.length,
    },
    externalFacts: accounting.externalFacts.length,
    uncapturedPredecessorYearPages: uncapturedReferences.length,
  };
  files.set('coverage.json', serialize(coverage));
  const artifacts = [...files]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([name, content]) => ({
      name,
      byteSize: Buffer.byteLength(content),
      sha256: hash(content),
    }));
  files.set(
    'manifest.json',
    serialize({
      ...provenance,
      manifestVersion: 'pst-private-derived-manifest-v1',
      artifacts,
      derivedDigestSha256: hash(serialize(artifacts)),
    })
  );
  return files;
}

/** Only a new directory beneath this checkout's ignored tmp can receive source bytes. */
export async function requirePrivateOutput(
  outputDirectory: string
): Promise<string> {
  const privateRoot = await realpath(path.join(ROOT, 'tmp'));
  const output = path.resolve(outputDirectory);
  const relative = path.relative(privateRoot, output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(
      'Private output must be a new directory beneath the checkout tmp/'
    );
  const parent = await realpath(path.dirname(output));
  if (parent !== privateRoot && !parent.startsWith(`${privateRoot}${path.sep}`))
    throw new Error('Output parent escapes private tmp/');
  try {
    await lstat(output);
    throw new Error('Refusing to replace an existing candidate directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return output;
}

export async function writePstCandidate(
  files: Map<string, string | Buffer>,
  outputDirectory: string
): Promise<void> {
  const output = await requirePrivateOutput(outputDirectory);
  await mkdir(output);
  for (const [filename, bytes] of files)
    await writeFile(path.join(output, filename), bytes, {
      flag: 'wx',
      mode: 0o600,
    });
}

/** Independent regeneration must match every byte, including manifest and inventory. */
export async function verifyPstCandidate(
  files: Map<string, string | Buffer>,
  candidateDirectory: string
): Promise<void> {
  const actual = (await readdir(candidateDirectory)).sort(compareCodePoints);
  if (
    canonicalJson(actual) !==
    canonicalJson([...files.keys()].sort(compareCodePoints))
  )
    throw new Error('Candidate file inventory mismatch');
  for (const [filename, content] of files) {
    const location = path.join(candidateDirectory, filename);
    if (!(await lstat(location)).isFile())
      throw new Error(`Candidate is not a regular file: ${filename}`);
    if (!(await readFile(location)).equals(Buffer.from(content)))
      throw new Error(`Candidate bytes differ: ${filename}`);
  }
}
