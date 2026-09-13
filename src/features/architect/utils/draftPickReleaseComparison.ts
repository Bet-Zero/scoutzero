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

const equal = (a: unknown, b: unknown) =>
  canonicalStringify(a) === canonicalStringify(b);
const sorted = (ids: string[]) => [...new Set(ids)].sort();
const keyed = <T>(rows: T[], identity: (row: T) => string) =>
  new Map(rows.map((row) => [identity(row), row]));
const identity = (row: { id: string }) => row.id;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function changes<T extends object>(
  before: T[],
  after: T[],
  identify: (row: T) => string
) {
  const a = keyed(before, identify),
    b = keyed(after, identify);
  return sorted([...a.keys(), ...b.keys()]).flatMap((id) => {
    const old = a.get(id),
      next = b.get(id);
    if (old && next && equal(old, next)) return [];
    const oldFields = new Map(Object.entries(old ?? {}));
    const nextFields = new Map(Object.entries(next ?? {}));
    const fields = sorted([...oldFields.keys(), ...nextFields.keys()]);
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
            !oldFields.has(k) ||
            !nextFields.has(k) ||
            !equal(oldFields.get(k), nextFields.get(k))
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

// Notes have no independent identity. Preserve every note, grouped by its
// validated dependency link, rather than collapsing multiple clauses in a Map.
function scopeNotes(notes: DraftPickFoundation['poolScopeNotes']) {
  const grouped = new Map<string, typeof notes>();
  for (const note of notes) {
    const rows = grouped.get(note.dependencyId) ?? [];
    rows.push(note);
    grouped.set(note.dependencyId, rows);
  }
  return [...grouped].map(([dependencyId, notes]) => ({ dependencyId, notes }));
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
    dependencies: changes(
      a.retained.dependencies,
      b.retained.dependencies,
      identity
    ),
    entitlements: changes(
      a.retained.entitlements,
      b.retained.entitlements,
      (row) => row.entitlementId
    ),
    occurrences: changes(
      a.retained.occurrences,
      b.retained.occurrences,
      identity
    ),
    predecessors: changes(
      a.retained.predecessorDependencies,
      b.retained.predecessorDependencies,
      identity
    ),
    poolScopeNotes: changes(
      scopeNotes(a.poolScopeNotes),
      scopeNotes(b.poolScopeNotes),
      (row) => row.dependencyId
    ),
    overlay: changes(a.overlay, b.overlay, identity),
    assertions: changes(a.assertions, b.assertions, identity),
    sourceRights: changes(a.sourceRights, b.sourceRights, identity),
    programs: changes(a.programs, b.programs, identity),
    retainedArtifacts: changes(
      a.retainedArtifacts,
      b.retainedArtifacts,
      identity
    ),
  };
  const dependencyIds = new Set(sections.dependencies.map((d) => d.id));
  sections.overlay.forEach((d) => dependencyIds.add(d.id));
  for (const d of [...sections.programs, ...sections.poolScopeNotes]) {
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
      .filter(([key, changed]) => changed && key !== 'poolScopeNotes')
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
      .filter((d) => !dependencyIds.has(d.id))
      .map((d) => d.id)
      .sort(),
    adoption: 'not-performed' as const,
    tradingVerdict: 'not-evaluated' as const,
    execution: 'disabled' as const,
  });
}
