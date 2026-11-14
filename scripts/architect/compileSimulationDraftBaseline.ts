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
import { simulationPickStatuses } from '../../src/features/architect/utils/simulationPickStatus';
import { SimulationSeasonStepZ } from '../../src/schemas/simulationSeasonStep';
import { readHardCapLabel } from '../../src/features/architect/utils/simulationHardCap';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import { loadSnapshot, DATA_DIR } from '../dev/cloudData';
import { decodeFields } from '../dev/cloudPipeline';

const args = process.argv.slice(2);
const [candidatePath, output] = args.filter((a) => !a.startsWith('--'));
const exportFlag = args.find((a) => a.startsWith('--entitlements='));
// C1: also write the July 1, 2026 season step from a private draft order file.
const stepFlag = args
  .find((a) => a.startsWith('--season-step='))
  ?.slice('--season-step='.length)
  .split(',');
if (!candidatePath || !output)
  throw new Error(
    'Usage: npm run architect:simulation-draft -- <private-candidate.json> <private-output.json> [--entitlements=<private-export.json>] [--season-step=<private-order.json>,<private-step-output.json>]'
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
// Hard-cap labels come from the private snapshot, read only when a row needs
// the fallback. Without a snapshot the row stays undetermined (fails closed).
let labelCache: Map<string, string> | null | undefined;
async function hardCapLabel(team: string): Promise<string | undefined> {
  if (labelCache === undefined) {
    const snapshot = await loadSnapshot(DATA_DIR).catch(() => null);
    labelCache = snapshot
      ? new Map(
          snapshot.documents
            .filter((d) => d.name.split('/').at(-2) === 'architect_baseTeams')
            .map((d) => {
              const doc = decodeFields(d.fields ?? {}) as Record<
                string,
                unknown
              >;
              const totals = (doc.totals ?? {}) as Record<string, unknown>;
              return [
                String(d.name.split('/').at(-1)),
                readHardCapLabel(doc.hardCapLevel ?? totals.hardCapLevel),
              ];
            })
        )
      : null;
  }
  return labelCache?.get(team);
}
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
  const label =
    row.seasonStartYear === 2025 ? await hardCapLabel(row.team) : undefined;
  if (label && label !== 'none') {
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
if (stepFlag) {
  const [orderPath, stepOutput] = stepFlag;
  if (!orderPath || !stepOutput)
    throw new Error('--season-step needs <order.json>,<step-output.json>.');
  const order = JSON.parse(await readFile(orderPath, 'utf8'));
  const year = Number(order.draftYear);
  // The same admission rule, applied to the year the step opens.
  const openedYear = year + 7;
  const opening = compileSimulationDraftBaseline({
    candidate,
    candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
    entitlements,
    seasonId: '2025-26',
    releaseId: 'simulation-june5-draft-v1',
    apronHistory,
    admissionYears: { first: openedYear, last: openedYear },
  });
  const step = SimulationSeasonStepZ.parse({
    version: 1,
    classification: 'simulation',
    fromSeason: '2025-26',
    toSeason: '2026-27',
    asOf: '2026-07-01T04:00:00.000Z',
    draft: {
      year,
      completedAt: '2026-06-25T03:59:59.000Z',
      order: order.order,
      sources: order.sources.map(
        (s: { slots: string; reference: string }) =>
          `${s.slots}: ${s.reference}`
      ),
    },
    nextDraftStartsAt: '2027-06-23T04:00:00.000Z',
    opened: {
      year: openedYear,
      records: opening.records,
      apron: opening.apron,
    },
  });
  const stepBytes = canonicalStringify(step);
  await writeFile(stepOutput, stepBytes, { flag: 'wx', mode: 0o600 });
  console.log(
    JSON.stringify({
      seasonStep: `${step.fromSeason}->${step.toSeason}`,
      openedYear,
      opened: step.opened.records.length,
      sha256: createHash('sha256').update(stepBytes).digest('hex'),
      output: stepOutput,
    })
  );
}
const bytes = canonicalStringify(baseline);
await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
// Counts and digest only; no holders or pick details are printed.
console.log(
  JSON.stringify({
    classification: baseline.classification,
    identities: baseline.identities.length,
    admitted: baseline.records.length,
    currentlyTradeable: Object.values(simulationPickStatuses(baseline)).filter(
      (s) => s.tradeable
    ).length,
    unresolved: baseline.unresolved.length,
    apronHistoryRows: apronHistory.length,
    apronHistoryDerivedFromHardCaps: derived,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    output,
  })
);
