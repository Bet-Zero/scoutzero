import type {
  DraftReadinessOverlay,
  DraftRetainedReadiness,
} from '@/schemas/draftPickRetained';

const same = (a: string[], b: string[]) => {
  const sorted = [...b].sort();
  return (
    a.length === b.length && [...a].sort().every((v, i) => v === sorted[i])
  );
};

/** Check exact bidirectional edges, not just the denominators. */
export function validateDraftPickLineage(
  data: DraftRetainedReadiness,
  overlay: DraftReadinessOverlay
) {
  const unique = (ids: string[]) => {
    if (ids.length !== new Set(ids).size)
      throw new Error('Duplicate lineage identity or edge');
  };
  const deps = new Map(data.dependencies.map((d) => [d.id, d]));
  const entitlements = new Map(
    data.entitlements.map((e) => [e.entitlementId, e])
  );
  const occurrences = new Map(data.occurrences.map((o) => [o.id, o]));
  for (const ids of [
    data.dependencies.map((d) => d.id),
    data.entitlements.map((e) => e.entitlementId),
    data.occurrences.map((o) => o.id),
    data.predecessorDependencies.map((p) => p.id),
    overlay.map((d) => d.id),
  ])
    unique(ids);
  for (const e of data.entitlements) {
    unique(e.dependencyIds);
    unique(e.occurrenceIds);
    if (
      !same(
        e.occurrenceIds,
        data.occurrences
          .filter((o) => o.baseline.entitlementId === e.entitlementId)
          .map((o) => o.id)
      )
    ) {
      throw new Error('Entitlement occurrence membership mismatch');
    }
    for (const id of e.dependencyIds)
      if (!deps.get(id)?.entitlementIds.includes(e.entitlementId))
        throw new Error('Missing reverse entitlement edge');
  }
  for (const o of data.occurrences) {
    unique(o.dependencyIds);
    if (o.id !== o.baseline.id || !entitlements.has(o.baseline.entitlementId))
      throw new Error('Occurrence baseline mismatch');
    for (const id of o.dependencyIds)
      if (!deps.get(id)?.baselineOccurrenceIds.includes(o.id))
        throw new Error('Missing reverse occurrence edge');
  }
  for (const d of data.dependencies) {
    unique(d.entitlementIds);
    unique(d.baselineOccurrenceIds);
    for (const id of d.entitlementIds)
      if (!entitlements.get(id)?.dependencyIds.includes(d.id))
        throw new Error('Missing forward entitlement edge');
    for (const id of d.baselineOccurrenceIds)
      if (!occurrences.get(id)?.dependencyIds.includes(d.id))
        throw new Error('Missing forward occurrence edge');
  }
  for (const p of data.predecessorDependencies) {
    unique(p.affectedEntitlementIds);
    if (p.affectedEntitlementIds.some((id) => !entitlements.has(id)))
      throw new Error('Unknown predecessor entitlement');
  }
  for (const row of overlay) {
    const d = deps.get(row.id);
    if (
      !d ||
      d.authorityStatus !== row.authorityStatus ||
      d.family !== row.family ||
      !same(d.entitlementIds, row.entitlementIds) ||
      !same(d.baselineOccurrenceIds, row.baselineOccurrenceIds)
    ) {
      throw new Error('Readiness overlay changed retained evidence or lineage');
    }
  }
}
