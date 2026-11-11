/**
 * Private, local: compile the retained June 5 draft candidate and the base
 * entitlement documents into a SIMULATION draft baseline. Entitlements come
 * from the private read-only source snapshot (`npm run cloud:data:refresh`) or
 * an explicit JSON export. Inputs and output stay outside the repository;
 * nothing here writes Firestore, publishes or activates data.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  compileSimulationDraftBaseline,
  SIMULATION_REGULAR_SEASON_FINAL_DAY,
  type SimulationApronHistoryRow,
} from '../../src/features/architect/utils/simulationDraftBaseline';
import { readHardCapLabel } from '../../src/features/architect/utils/simulationHardCap';
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
    return (Array.isArray(raw) ? raw : Object.values(raw)).filter(
      (d: Record<string, unknown>) => wanted.has(String(d.id))
    );
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
    }))
    .filter((d) => wanted.has(String(d.id)));
}

const candidateBytes = await readFile(candidatePath);
const candidate = JSON.parse(candidateBytes.toString('utf8'));
const records: { entitlementId: string; group: string }[] =
  candidate.records ?? [];
const wanted = new Set(records.map((r) => r.entitlementId));
const entitlements = await entitlementDocs(wanted);
const found = new Set(entitlements.map((d) => String(d.id)));
const missing = records.filter((r) => !found.has(r.entitlementId));
if (missing.length) {
  // Counts by candidate group only; no identities or pick details.
  const byGroup: Record<string, number> = {};
  for (const r of missing) byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;
  console.error(
    JSON.stringify({
      candidateIdentities: wanted.size,
      foundInSource: found.size,
      missing: missing.length,
      missingByGroup: byGroup,
    })
  );
}
// Retained above/at-or-below determinations for completed Apron-rule seasons.
// An undetermined 2025-26 row is read from that season's hard cap: a team
// hard-capped at either Apron cannot finish above the Second Apron.
type HistoryRow = {
  team: string;
  seasonStartYear: number;
  state: string;
  aboveSecondApron: boolean | null;
  dependencyId: string;
};
async function hardCapLabels(): Promise<Map<string, string>> {
  const snapshot = await loadSnapshot(DATA_DIR);
  return new Map(
    snapshot.documents
      .filter((d) => d.name.split('/').at(-2) === 'architect_baseTeams')
      .map((d) => {
        const doc = decodeFields(d.fields ?? {}) as Record<string, unknown>;
        const totals = (doc.totals ?? {}) as Record<string, unknown>;
        return [
          String(d.name.split('/').at(-1)),
          readHardCapLabel(doc.hardCapLevel ?? totals.hardCapLevel),
        ];
      })
  );
}
const labels = await hardCapLabels();
const apronHistory: SimulationApronHistoryRow[] = [];
let derived = 0;
for (const row of (candidate.apronHistory ?? []) as HistoryRow[]) {
  if (!SIMULATION_REGULAR_SEASON_FINAL_DAY[row.seasonStartYear]) continue;
  if (row.state === 'supported' && typeof row.aboveSecondApron === 'boolean') {
    apronHistory.push({
      team: row.team,
      seasonStartYear: row.seasonStartYear,
      aboveSecondApron: row.aboveSecondApron,
      sourceResultId: row.dependencyId,
    });
    continue;
  }
  const label = labels.get(row.team);
  if (row.seasonStartYear === 2025 && label && label !== 'none') {
    derived += 1;
    apronHistory.push({
      team: row.team,
      seasonStartYear: 2025,
      aboveSecondApron: false,
      sourceResultId: `simulation:${row.team}:2025-26:hard-capped-${label}`,
    });
  }
}
const baseline = compileSimulationDraftBaseline({
  candidate,
  candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
  entitlements,
  seasonId: '2025-26',
  releaseId: 'simulation-june5-draft-v1',
  apronHistory,
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
    apronHistoryRows: apronHistory.length,
    apronHistoryDerivedFromHardCaps: derived,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    output,
  })
);
