/** Offline build/verify only. Detailed output is restricted to a new private tmp directory. */
import { readFile, mkdir, writeFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, compareCodePoints } from '../verify-pst-source-release';
import { requirePrivateOutput } from '../pst-lifecycle/candidate';
import {
  verifyRetainedV2,
  BASELINE_DIGEST,
  V2_ARCHIVE_SHA256,
  V2_MANIFEST_SHA256,
} from './retained';
import { verifyAuthorAssessment } from './assessment';
import { sha256, VERIFIER_VERSION } from './compare';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const implementationPaths = [
  'compare.ts',
  'qualify.ts',
  'retained.ts',
  'assessment.ts',
  'cli.ts',
]
  .map((name) => `scripts/source-releases/official-nba-html/${name}`)
  .concat([
    'docs/operations/OFFICIAL_NBA_HTML_EVIDENCE.md',
    'package-lock.json',
  ]);
const serialize = (value: unknown) => Buffer.from(`${canonicalJson(value)}\n`);
async function fingerprints() {
  return Promise.all(
    implementationPaths.sort(compareCodePoints).map(async (filename) => ({
      path: filename,
      sha256: sha256(await readFile(path.join(ROOT, filename))),
    }))
  );
}

export async function buildOfficialHtmlSupplement(
  v2: string,
  archive: string,
  assessmentPath: string
) {
  const initial = await fingerprints();
  const inputs = await verifyRetainedV2(v2, archive);
  const assessmentBytes = await readFile(assessmentPath);
  const assessment = verifyAuthorAssessment(
    JSON.parse(assessmentBytes.toString('utf8')),
    inputs
  );
  const files = new Map<string, Buffer>(
    [...inputs.files].map(([name, bytes]) => [`base-v2/${name}`, bytes])
  );
  files.set('assessment-input.json', assessmentBytes);
  files.set('author-assessment.json', serialize(assessment));
  files.set('source-qualification.json', serialize(inputs.qualifications));
  files.set('occurrences.json', serialize(inputs.occurrences));
  const priorSources = JSON.parse(
    inputs.files.get('source-records.json')!.toString('utf8')
  ) as Array<{
    id: string;
    officialPrimary: boolean;
    rawByteIdentical: boolean;
    firstReceiptLimitation: boolean;
  }>;
  const qualifiedBefore = priorSources
    .filter(
      (s) =>
        s.officialPrimary && s.rawByteIdentical && !s.firstReceiptLimitation
    )
    .map((s) => s.id)
    .sort();
  const qualifiedAfter = inputs.qualifications
    .filter((s) => s.eligibleAfterIndependentRecovery)
    .map((s) => s.sourceId)
    .sort();
  const counts: Record<string, number> = {};
  for (const row of inputs.occurrences)
    counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
  const coverage = {
    baselineDigest: BASELINE_DIGEST,
    qualifiedSourcesBefore: qualifiedBefore,
    qualifiedSourcesAfter: qualifiedAfter,
    changedSourceIds: qualifiedAfter.filter(
      (id) => !qualifiedBefore.includes(id)
    ),
    countsBefore: counts,
    countsAfter: counts,
    changedDispositionIds: [],
    allOccurrenceIds: inputs.occurrences
      .map((x) => x.baselineRequirementId)
      .sort(),
    allEntitlementIds: [
      ...new Set(inputs.occurrences.map((x) => x.entitlementId)),
    ].sort(),
    scopedOccurrenceIds: inputs.scopedIds,
    newPartialObservationIds: assessment.observations
      .filter((x) => x.status === 'partial')
      .map((x) => x.id)
      .sort(),
    newQuarantinedObservationIds: assessment.observations
      .filter((x) => x.status === 'quarantined')
      .map((x) => x.id)
      .sort(),
    corroboratedObservationIds: assessment.corroborations
      .map((x) => x.existingObservationId)
      .sort(),
    changedEvidenceMappingIds: [
      ...new Set(
        assessment.observations.flatMap((x) => x.baselineRequirementIds)
      ),
    ].sort(),
    completeRequirementsNewlySatisfied: 0,
    remaining: assessment.remaining,
    conflictingRequirementIds: assessment.conflictingRequirementIds,
    outsidePass: {
      secondApronDeterminations: 60,
      futureLotteryMethodAuthority: 'unchanged missing authority',
      otherOccurrences: 927,
      uncapturedPstPages: 5,
    },
    needsInputNoWrite: true,
    runtimeAuthority: false,
    independentSemanticAccept: false,
  };
  files.set('coverage-delta.json', serialize(coverage));
  files.set(
    'README.md',
    Buffer.from(
      'Private BZE-307 official HTML supplement v3. Read source-qualification.json, author-assessment.json and coverage-delta.json. Source qualification is separate from author claims and complete requirement satisfaction. All base-v2 files are untouched originals. Recover the pinned archive privately, verify its exact manifest inventory and hashes/sizes, then run the frozen CLI verify command from the PR receipt. No acquisition or runtime consumption is authorized. Accepted baseline, v1/v2, Orlando conflict, incomplete 2022 metadata, AP attribution, all out-of-pass gaps and reviewer limitations remain.\n'
    )
  );
  const final = await fingerprints();
  if (canonicalJson(initial) !== canonicalJson(final))
    throw new Error('Verifier changed during generation');
  const artifacts = [...files]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([name, bytes]) => ({
      path: name,
      byteSize: bytes.length,
      sha256: sha256(bytes),
    }));
  files.set(
    'manifest.json',
    serialize({
      version: 'bze307-official-html-supplement-v3',
      verifierVersion: VERIFIER_VERSION,
      implementation: final,
      baselineDigest: BASELINE_DIGEST,
      v2ArchiveSha256: V2_ARCHIVE_SHA256,
      v2ManifestSha256: V2_MANIFEST_SHA256,
      assessmentInputSha256: sha256(assessmentBytes),
      artifacts,
      derivedDigestSha256: sha256(serialize(artifacts)),
      runtimeAuthority: false,
    })
  );
  return { files, coverage };
}

async function verifyFiles(
  directory: string,
  files: Map<string, Buffer>,
  relative = ''
): Promise<void> {
  const actual: string[] = [];
  async function visit(rel: string): Promise<void> {
    for (const name of await readdir(path.join(directory, rel))) {
      const child = path.posix.join(rel, name);
      const stat = await lstat(path.join(directory, child));
      if (stat.isDirectory()) await visit(child);
      else if (stat.isFile()) actual.push(child);
      else throw new Error('Nonregular candidate member');
    }
  }
  await visit(relative);
  if (canonicalJson(actual.sort()) !== canonicalJson([...files.keys()].sort()))
    throw new Error('Candidate inventory mismatch');
  for (const [name, bytes] of files)
    if (!(await readFile(path.join(directory, name))).equals(bytes))
      throw new Error(`Candidate differs: ${name}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = new Map<string, string>();
  if (!['build', 'verify'].includes(command) || args.length !== 8)
    throw new Error(
      'Use build|verify --v2 DIR --archive FILE --assessment FILE --out DIR'
    );
  for (let i = 0; i < args.length; i += 2) {
    if (
      !['--v2', '--archive', '--assessment', '--out'].includes(args[i]) ||
      options.has(args[i])
    )
      throw new Error('Unknown or duplicate option');
    options.set(args[i], args[i + 1]);
  }
  const output = options.get('--out')!;
  if (command === 'build') await requirePrivateOutput(output);
  const { files, coverage } = await buildOfficialHtmlSupplement(
    options.get('--v2')!,
    options.get('--archive')!,
    options.get('--assessment')!
  );
  if (command === 'build') {
    const privateOutput = await requirePrivateOutput(output);
    await mkdir(privateOutput);
    for (const [name, bytes] of files) {
      const location = path.join(privateOutput, name);
      await mkdir(path.dirname(location), { recursive: true });
      await writeFile(location, bytes, { flag: 'wx', mode: 0o600 });
    }
  } else await verifyFiles(output, files);
  console.log(
    JSON.stringify({
      command,
      status: 'PASS',
      files: files.size,
      qualifiedSources: coverage.qualifiedSourcesAfter.length,
      newPartialObservations: coverage.newPartialObservationIds.length,
      completeRequirementsNewlySatisfied: 0,
    })
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
