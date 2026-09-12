/** Proposed evidence changes never adopt a baseline or produce a trading verdict. */
import {
  canonicalStringify,
  compareCodePoints,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import type { DraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';
import {
  requireLoadedDraftPickRelease,
  type LoadedDraftPickRelease,
} from '@/features/architect/utils/draftPickRelease';

type Row = { [key: string]: unknown };
const equal = (a: unknown, b: unknown) =>
  canonicalStringify(a) === canonicalStringify(b);
const sorted = (ids: string[]) => [...new Set(ids)].sort();
const keyed = <T extends Row>(rows: T[], key: string) =>
  new Map(rows.map((r) => [String(r[key]), r]));
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function changes<T extends Row>(before: T[], after: T[], key = 'id') {
  const a = keyed(before, key),
    b = keyed(after, key);
  return sorted([...a.keys(), ...b.keys()]).flatMap((id) => {
    const old = a.get(id),
      next = b.get(id);
    if (old && next && equal(old, next)) return [];
    const fields = sorted([
      ...Object.keys(old ?? {}),
      ...Object.keys(next ?? {}),
    ]);
    return [
      {
        id,
        kind: !old
          ? ('added' as const)
          : !next
            ? ('removed' as const)
            : ('changed' as const),
        fields: fields.filter(
          (k) =>
            !old ||
            !next ||
            !(k in old) ||
            !(k in next) ||
            !equal(old[k], next[k])
        ),
        before: old ?? null,
        after: next ?? null,
      },
    ];
  });
}

function lineage(f: DraftPickFoundation) {
  return {
    entitlements: f.retained.entitlements
      .map((e) => ({
        id: e.entitlementId,
        kind: e.kind,
        originalPickIds: [...e.baselineUnderlyingAssetIdsUnchanged].sort(),
      }))
      .sort((a, b) => compareCodePoints(a.id, b.id)),
    occurrences: f.retained.occurrences
      .map((o) => ({ id: o.id, baseline: o.baseline }))
      .sort((a, b) => compareCodePoints(a.id, b.id)),
    predecessors: sorted(f.retained.predecessorDependencies.map((p) => p.id)),
  };
}

export function compareDraftPickReleases(
  predecessor: LoadedDraftPickRelease,
  proposed: LoadedDraftPickRelease
) {
  requireLoadedDraftPickRelease(predecessor);
  requireLoadedDraftPickRelease(proposed);
  if (predecessor.use !== 'retained-baseline')
    throw new Error('Comparison requires an accepted retained baseline');
  const a = predecessor.foundation,
    b = proposed.foundation;
  if (
    a.release.id === b.release.id &&
    predecessor.payloadSha256 !== proposed.payloadSha256
  )
    throw new Error('Changed payload requires a new release identity');
  if (!equal(lineage(a), lineage(b)))
    throw new Error(
      'Successor changed the retained legacy/occurrence/predecessor lineage'
    );

  const sections = {
    dependencies: changes(a.retained.dependencies, b.retained.dependencies),
    entitlements: changes(
      a.retained.entitlements,
      b.retained.entitlements,
      'entitlementId'
    ),
    occurrences: changes(a.retained.occurrences, b.retained.occurrences),
    predecessors: changes(
      a.retained.predecessorDependencies,
      b.retained.predecessorDependencies
    ),
    overlay: changes(a.overlay, b.overlay),
    assertions: changes(a.assertions, b.assertions),
    sourceRights: changes(a.sourceRights, b.sourceRights),
    programs: changes(a.programs, b.programs),
    retainedArtifacts: changes(a.retainedArtifacts, b.retainedArtifacts),
  };
  const dependencyIds = new Set(sections.dependencies.map((d) => d.id));
  sections.overlay.forEach((d) => dependencyIds.add(d.id));
  for (const d of sections.programs) {
    for (const row of [d.before, d.after])
      if (row) dependencyIds.add(String(row.dependencyId));
  }
  // These are registered associations only, not inferred clause-level causal links.
  for (const d of [...sections.entitlements, ...sections.occurrences]) {
    for (const row of [d.before, d.after])
      if (row) row.dependencyIds.forEach((id) => dependencyIds.add(id));
  }
  const linked = [
    ...a.retained.dependencies,
    ...b.retained.dependencies,
  ].filter((d) => dependencyIds.has(d.id));
  const additionalChanges = {
    release: !equal(a.release, b.release),
    summary: !equal(a.retained.summary, b.retained.summary),
    branchDetails: !equal(a.retainedBranchDetails, b.retainedBranchDetails),
    poolScopeNotes: !equal(a.poolScopeNotes, b.poolScopeNotes),
  };
  // The existing retained contracts do not bind all these records to an operation.
  // Explicit uncertainty prevents an empty affected-operation list implying no impact.
  const unmappedImpact = [
    ...(
      [
        'assertions',
        'sourceRights',
        'retainedArtifacts',
        'predecessors',
      ] as const
    ).filter((key) => sections[key].length > 0),
    ...Object.entries(additionalChanges)
      .filter(([, changed]) => changed)
      .map(([key]) => key),
  ];
  return freeze({
    predecessor: { id: a.release.id, payloadSha256: predecessor.payloadSha256 },
    proposed: { id: b.release.id, payloadSha256: proposed.payloadSha256 },
    sections,
    additionalChanges,
    changedDependencyIds: sorted([...dependencyIds]),
    associatedEntitlementIds: sorted(linked.flatMap((d) => d.entitlementIds)),
    affectedOperations: sorted(linked.map((d) => d.controlsAtStart)),
    associationScope: 'registered-links-not-proven-causality' as const,
    unmappedImpact,
    unchangedDependencyIds: a.retained.dependencies
      .filter(
        (d) => !sections.dependencies.some((change) => change.id === d.id)
      )
      .map((d) => d.id)
      .sort(),
    adoption: 'not-performed' as const,
    tradingVerdict: 'not-evaluated' as const,
    execution: 'disabled' as const,
  });
}
