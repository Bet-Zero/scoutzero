/**
 * Private, local: compile the retained June 5 draft candidate and the base
 * entitlement documents into a SIMULATION draft baseline. Entitlements come
 * from the private read-only source snapshot (`npm run cloud:data:refresh`) or
 * an explicit JSON export. Inputs and output stay outside the repository;
 * nothing here writes Firestore, publishes or activates data.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileSimulationDraftBaseline } from '../../src/features/architect/utils/simulationDraftBaseline';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import { loadSnapshot, DATA_DIR } from '../dev/cloudData';
import { decodeFields } from '../dev/cloudPipeline';

const args = process.argv.slice(2);
const [candidatePath, output] = args.filter((a) => !a.startsWith('--'));
const exportFlag = args.find((a) => a.startsWith('--entitlements='));
if (!candidatePath || !output)
  throw new Error(
    'Usage: npm run architect:simulation-draft -- <private-candidate.json> <private-output.json> [--entitlements=<private-export.json>]'
  );

// The snapshot also holds legacy entitlements; keep only the candidate's
// identities. The compiler still rejects any missing identity.
async function entitlementDocs(
  wanted: Set<string>
): Promise<Record<string, unknown>[]> {
  if (exportFlag) {
    const raw = JSON.parse(await readFile(exportFlag.slice(15), 'utf8'));
    return Array.isArray(raw) ? raw : Object.values(raw);
  }
  const snapshot = await loadSnapshot(DATA_DIR).catch(() => {
    throw new Error(
      'No usable private snapshot; run npm run cloud:data:refresh first.'
    );
  });
  const status = snapshot.collections.architect_baseEntitlements;
  if (status?.status !== 'read' || !status.count)
    throw new Error(
      'The private snapshot has no base entitlements; run npm run cloud:data:refresh first.'
    );
  return snapshot.documents
    .filter((d) => d.name.split('/').at(-2) === 'architect_baseEntitlements')
    .map((d) => ({
      id: d.name.split('/').at(-1),
      ...decodeFields(d.fields ?? {}),
    }));
}

const candidateBytes = await readFile(candidatePath);
const candidate = JSON.parse(candidateBytes.toString('utf8'));
const baseline = compileSimulationDraftBaseline({
  candidate,
  candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
  entitlements: await entitlementDocs(
    new Set(
      (candidate.records ?? []).map(
        (r: { entitlementId: string }) => r.entitlementId
      )
    )
  ),
  seasonId: '2025-26',
  releaseId: 'simulation-june5-draft-v1',
});
const bytes = canonicalStringify(baseline);
await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
// Counts and digest only; no holders or pick details are printed.
console.log(
  JSON.stringify({
    classification: baseline.classification,
    identities: baseline.identities.length,
    tradeable: baseline.records.length,
    unresolved: baseline.unresolved.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    output,
  })
);
