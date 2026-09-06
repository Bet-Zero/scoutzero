/** Verify the frozen v2 inventory before examining any HTML or author accounting. */
import { readFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { sha256 } from './compare';
import { qualifyRetainedPair, REGISTERED_SOURCE_IDS } from './qualify';
import { canonicalJson, compareCodePoints } from '../verify-pst-source-release';

export const V2_ARCHIVE_SHA256 =
  'b8cc8c2c505a31dea10285f944215240d6ad8d51213bc6c48302bbd12fafbf83';
export const V2_MANIFEST_SHA256 =
  '15b1e9e94c7f27ed1c1ba388d5de6eca5bc6f5f795f4a4b0b5b81ec7fe3e10ba';
export const BASELINE_DIGEST =
  '6a4f677ea3b211a9fb9bb54726a732ee8da2aed8403e59deedfd4acc43953d96';
const hashZ = z.string().regex(/^[a-f0-9]{64}$/);
const itemZ = z
  .object({
    path: z.string(),
    byteSize: z.number().int().nonnegative(),
    sha256: hashZ,
  })
  .strict();
const occurrenceZ = z
  .object({
    baselineRequirementId: z.string().min(1),
    entitlementId: z.string().min(1),
    code: z.enum([
      'OFFICIAL_SECOND_APRON_LIFECYCLE',
      'OFFICIAL_OUTCOME_AND_ORDER',
    ]),
    disposition: z.enum([
      'satisfied by retained evidence',
      'proven not applicable',
      'legitimate future outcome pending',
      'unresolved',
      'conflicting',
    ]),
  })
  .passthrough();
export type Occurrence = z.infer<typeof occurrenceZ>;

/** Qualification adds references only: no old field, ID or disposition may change. */
export function assertPreservedLineage(before: unknown, after: unknown): void {
  const a = z.array(occurrenceZ).parse(before);
  const b = z.array(occurrenceZ).parse(after);
  const ids = new Map(a.map((x) => [x.baselineRequirementId, x]));
  if (
    ids.size !== a.length ||
    new Set(b.map((x) => x.baselineRequirementId)).size !== b.length ||
    a.length !== b.length
  )
    throw new Error('Duplicate or lost occurrence lineage');
  for (const row of b) {
    const original = ids.get(row.baselineRequirementId);
    if (!original) throw new Error('Changed occurrence identity');
    const { officialHtmlQualification: annotation, ...unchanged } = row;
    if (canonicalJson(unchanged) !== canonicalJson(original))
      throw new Error('Changed baseline field or false completeness');
    if (annotation !== undefined)
      z.object({
        sourceIds: z.array(z.string()),
        requirementSatisfied: z.literal(false),
        runtimeAuthority: z.literal(false),
      })
        .strict()
        .parse(annotation);
  }
}

async function inventory(root: string, relative = ''): Promise<string[]> {
  if (!(await lstat(path.join(root, relative))).isDirectory())
    throw new Error('Non-directory evidence root');
  const files: string[] = [];
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const child = path.posix.join(relative, name);
    const stat = await lstat(path.join(root, child));
    if (stat.isSymbolicLink()) throw new Error('Evidence symlink');
    if (stat.isDirectory()) files.push(...(await inventory(root, child)));
    else if (stat.isFile()) files.push(child);
    else throw new Error('Nonregular evidence member');
  }
  return files.sort();
}

export async function verifyRetainedV2(directory: string, archivePath: string) {
  const archive = await readFile(archivePath);
  if (archive.length !== 1298210 || sha256(archive) !== V2_ARCHIVE_SHA256)
    throw new Error('Wrong retained v2 archive');
  const actual = await inventory(directory);
  const manifestBytes = await readFile(path.join(directory, 'manifest.json'));
  if (sha256(manifestBytes) !== V2_MANIFEST_SHA256)
    throw new Error('Wrong retained v2 manifest');
  const manifest = z
    .object({
      baselineDigest: z.literal(BASELINE_DIGEST),
      files: z.array(itemZ),
    })
    .parse(JSON.parse(manifestBytes.toString('utf8')));
  const names = manifest.files.map((x) => x.path);
  if (
    names.some(
      (n) =>
        n === 'manifest.json' ||
        n.includes('\\') ||
        path.posix.normalize(n) !== n ||
        n.startsWith('../') ||
        path.posix.isAbsolute(n)
    ) ||
    new Set(names).size !== names.length ||
    actual.length !== 108 ||
    canonicalJson(actual) !== canonicalJson([...names, 'manifest.json'].sort())
  )
    throw new Error('Wrong retained file inventory');
  const files = new Map<string, Buffer>([['manifest.json', manifestBytes]]);
  for (const item of manifest.files) {
    const bytes = await readFile(path.join(directory, item.path));
    if (bytes.length !== item.byteSize || sha256(bytes) !== item.sha256)
      throw new Error(`Retained file tampering: ${item.path}`);
    files.set(item.path, bytes);
  }
  const json = (name: string): unknown => {
    const bytes = files.get(name);
    if (!bytes) throw new Error(`Missing retained file: ${name}`);
    return JSON.parse(bytes.toString('utf8'));
  };
  const occurrences = z.array(occurrenceZ).parse(json('occurrences.json'));
  assertPreservedLineage(occurrences, occurrences);
  if (
    occurrences.length !== 556 ||
    new Set(occurrences.map((x) => x.entitlementId)).size !== 278
  )
    throw new Error('Frozen 556/278 universe differs');
  for (const entitlementId of new Set(
    occurrences.map((x) => x.entitlementId)
  )) {
    const codes = occurrences
      .filter((x) => x.entitlementId === entitlementId)
      .map((x) => x.code);
    if (codes.length !== 2 || new Set(codes).size !== 2)
      throw new Error('Missing requirement family');
  }
  const sources = z
    .array(
      z
        .object({
          id: z.string(),
          url: z.string(),
          candidateBaselineRequirementIds: z.array(z.string()),
          captures: z
            .array(
              z.object({ path: z.string(), receipt: z.string() }).passthrough()
            )
            .length(2),
        })
        .passthrough()
    )
    .parse(json('source-records.json'));
  if (
    canonicalJson(sources.map((s) => s.id).sort()) !==
    canonicalJson(REGISTERED_SOURCE_IDS)
  )
    throw new Error('Wrong registered source set');
  const scoped = occurrences.filter(
    (x) =>
      x.code === 'OFFICIAL_OUTCOME_AND_ORDER' &&
      ['unresolved', 'conflicting'].includes(x.disposition)
  );
  if (scoped.length !== 41)
    throw new Error('Frozen reassessment scope differs');
  const scopedIds = new Set(scoped.map((x) => x.baselineRequirementId));
  const qualifications = sources
    .map((source) => {
      if (
        source.candidateBaselineRequirementIds.some((id) => !scopedIds.has(id))
      )
        throw new Error('Source mapping escapes frozen scope');
      const captures = source.captures.map((c) => {
        const bytes = files.get(c.path);
        const receiptBytes = files.get(c.receipt);
        if (!bytes || !receiptBytes)
          throw new Error('Unretained capture or provenance');
        return { bytes, receiptBytes };
      });
      const result = qualifyRetainedPair(source.id, captures);
      if (result.url !== source.url)
        throw new Error('Source record/receipt identity mismatch');
      return { ...result, sourceRecord: source };
    })
    .sort((a, b) => compareCodePoints(a.sourceId, b.sourceId));
  const annotated = occurrences.map((row) =>
    scopedIds.has(row.baselineRequirementId)
      ? {
          ...row,
          officialHtmlQualification: {
            sourceIds: qualifications
              .filter(
                (q) =>
                  q.eligibleAfterIndependentRecovery &&
                  q.sourceRecord.candidateBaselineRequirementIds.includes(
                    row.baselineRequirementId
                  )
              )
              .map((q) => q.sourceId),
            requirementSatisfied: false as const,
            runtimeAuthority: false as const,
          },
        }
      : row
  );
  assertPreservedLineage(occurrences, annotated);
  return {
    files,
    qualifications,
    occurrences: annotated,
    scopedIds: [...scopedIds].sort(),
  };
}
