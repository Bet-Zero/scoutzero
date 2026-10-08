/** Disconnected archival read view. No trade, allocation, world or lifecycle consumer. */
import {
  DraftArchivalArtifactSelectionZ,
  DraftArchivalNativeIndexZ,
  DraftArchivalNativePoolClauseZ,
  DraftArchivalPoolMapZ,
} from '@/schemas/draftPickArchival';
import { buildDraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';

function sameIds(a: string[], b: string[]) {
  return (
    canonicalStringify([...a].sort()) === canonicalStringify([...b].sort())
  );
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length)
    throw new Error('Duplicate archival identity');
}

/**
 * The caller authenticates the retained artifacts, including the exact sidecar.
 * This validates their structural links only, never source sufficiency or the
 * sidecar's pending economic judgments. Rebuild from retained artifacts on load;
 * do not serialize this derived view as evidence or feed it into draft reviews.
 */
export function buildDraftPickArchivalPoolView(
  input: unknown,
  selection: unknown
) {
  const foundation = buildDraftPickFoundation(input);
  const selected = DraftArchivalArtifactSelectionZ.parse(selection);
  unique(foundation.retainedArtifacts.map((a) => a.id));
  const artifacts = new Map(foundation.retainedArtifacts.map((a) => [a.id, a]));
  const mapArtifact = artifacts.get(selected.mapArtifactId);
  const nativeArtifact = artifacts.get(selected.nativeIndexArtifactId);
  if (!mapArtifact || !nativeArtifact || mapArtifact.id === nativeArtifact.id)
    throw new Error('Missing distinct retained archival artifacts');
  const map = DraftArchivalPoolMapZ.parse(mapArtifact.content);
  const native = DraftArchivalNativeIndexZ.parse(nativeArtifact.content);
  unique(map.rows.map((r) => r.legacyId));
  unique(map.rows.map((r) => r.dependencyId));
  unique(native.nativeClauses.map((c) => c.id));
  unique(native.rights.map((r) => r.legacyId));
  const clauses = new Map(native.nativeClauses.map((c) => [c.id, c]));
  const legacy = new Map(native.rights.map((r) => [r.legacyId, r]));
  const deps = new Map(foundation.retained.dependencies.map((d) => [d.id, d]));
  const entitlements = new Map(
    foundation.retained.entitlements.map((e) => [e.entitlementId, e])
  );
  const occurrences = new Map(
    foundation.retained.occurrences.map((o) => [o.id, o])
  );
  const originalPickIds = new Set(foundation.originalPicks.map((p) => p.id));

  for (const [family, pool] of Object.entries(map.pools)) {
    if (
      map.rows.filter((r) => r.nativePoolFamily === family).length !==
      pool.legacyProjectionCount
    )
      throw new Error('Archival pool membership mismatch');
  }
  const bindings = map.rows.map((row) => {
    const pool = map.pools[row.nativePoolFamily];
    const raw = legacy.get(row.legacyId)?.legacyComparison;
    const entitlement = entitlements.get(row.legacyId);
    const dependency = deps.get(row.dependencyId);
    if (!pool || !raw || !entitlement || !dependency)
      throw new Error('Unknown archival pool, legacy record or dependency');
    if (
      row.legacyMeaningPreserved.id !== row.legacyId ||
      raw.id !== row.legacyId ||
      canonicalStringify(raw) !==
        canonicalStringify(row.legacyMeaningPreserved) ||
      entitlement.kind !== raw.kind
    )
      throw new Error('Archival raw fields changed');
    if (
      dependency.family !== 'derivative-right-correspondence' ||
      dependency.authorityStatus !== 'unresolved' ||
      !sameIds(dependency.entitlementIds, [row.legacyId]) ||
      !sameIds(dependency.baselineOccurrenceIds, row.occurrenceIds) ||
      row.occurrenceIds.some(
        (id) => occurrences.get(id)?.baseline.entitlementId !== row.legacyId
      )
    )
      throw new Error('Archival correspondence or occurrence lineage changed');
    const picks = pool.referencedOriginalPicks.map((id) => {
      const match = /^([A-Z]{3})_(\d{4})_1st$/.exec(id);
      if (!match || Number(match[2]) !== raw.seasonYear)
        throw new Error('Archival original-pick year mismatch');
      return match[1];
    });
    if (
      `${[...picks].sort().join('/')}:${raw.seasonYear}` !==
      row.nativePoolFamily
    )
      throw new Error('Archival pool family mismatch');
    if (pool.referencedOriginalPicks.some((id) => !originalPickIds.has(id)))
      throw new Error('Archival original pick absent from foundation');
    const nativeClauses = row.nativePoolClauseIds.map((id) => {
      const clause = DraftArchivalNativePoolClauseZ.parse(clauses.get(id));
      const selection = clause.signature.semantic.children[0].parameters;
      if (
        clause.years[0] !== raw.seasonYear ||
        selection.contextYear !== raw.seasonYear ||
        !sameIds(selection.members, picks)
      )
        throw new Error('Native clause pool or year mismatch');
      return { artifactId: nativeArtifact.id, clauseId: id };
    });
    return {
      legacyId: row.legacyId,
      dependencyId: row.dependencyId,
      relation: 'archival-to-native-pool-only' as const,
      rawArchivalRecord: row.legacyMeaningPreserved,
      occurrenceIds: row.occurrenceIds,
      nativePoolFamily: row.nativePoolFamily,
      referencedOriginalPicks: pool.referencedOriginalPicks,
      nativeClauses,
      sidecarArtifactId: mapArtifact.id,
      economicCorrespondence: 'unresolved' as const,
      transferableRightEstablished: false as const,
      executable: false as const,
      accountingDelta: 0 as const,
    };
  });
  return freeze({
    foundation,
    bindings,
    execution: 'disabled' as const,
    accountingDelta: 0 as const,
  });
}
