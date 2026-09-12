/** Pure, non-executable read model. No Firestore, world, validator or clock imports. */
import { z } from 'zod';
import {
  DraftEvidenceAssertionZ,
  DraftFoundationReleaseZ,
  DraftRetainedProgramZ,
  DraftSourceRightZ,
  DraftRetainedArtifactZ,
} from '@/schemas/draftPickEvidence';
import {
  DraftPoolScopeNoteZ,
  DraftReadinessOverlayZ,
  DraftRetainedReadinessZ,
} from '@/schemas/draftPickRetained';
import { validateDraftPickLineage } from '@/features/architect/utils/draftPickLineage';

const InputZ = z
  .object({
    release: DraftFoundationReleaseZ,
    retained: DraftRetainedReadinessZ,
    overlay: DraftReadinessOverlayZ,
    assertions: z.array(DraftEvidenceAssertionZ),
    sourceRights: z.array(DraftSourceRightZ),
    programs: z.array(DraftRetainedProgramZ),
    poolScopeNotes: z.array(DraftPoolScopeNoteZ),
    retainedArtifacts: z.array(DraftRetainedArtifactZ),
    retainedBranchDetails: z.array(z.json()),
  })
  .strict();

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** The caller supplies authenticated retained bytes. This function does no qualification. */
export function buildDraftPickFoundation(input: unknown) {
  // Clone before parsing so passthrough annotations cannot alias caller-owned objects.
  const data = InputZ.parse(structuredClone(input));
  validateDraftPickLineage(data.retained, data.overlay);
  if (data.release.asOf !== data.retained.summary.asOf)
    throw new Error('Release as-of mismatch');
  const dependencies = new Map(
    data.retained.dependencies.map((d) => [d.id, d])
  );
  const assertions = new Set(data.assertions.map((a) => a.id));
  for (const rows of [data.assertions, data.sourceRights, data.programs]) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error('Duplicate evidence identity');
  }
  for (const right of data.sourceRights) {
    if (right.assertionIds.some((id) => !assertions.has(id)))
      throw new Error('Unknown right assertion');
  }
  for (const program of data.programs) {
    if (!dependencies.has(program.dependencyId))
      throw new Error('Unknown program dependency');
  }
  for (const note of data.poolScopeNotes) {
    if (
      dependencies.get(note.dependencyId)?.family !==
        'contractual-priority-ties' ||
      note.pool.some((member) => !note.sourceNamedMembers.includes(member))
    ) {
      throw new Error(
        'Pool scope must follow a source-named comparison clause'
      );
    }
  }
  const overlay = new Map(data.overlay.map((d) => [d.id, d]));
  const legacyRecords = data.retained.entitlements.map((row) => ({
    id: row.entitlementId,
    kind: row.kind,
    identity:
      row.kind === 'pick_ownership'
        ? ('original-pick-lineage' as const)
        : ('candidate-correspondence' as const),
    // A correspondence is deliberately not an economic-right foreign key.
    candidateOriginalPickIds: row.baselineUnderlyingAssetIdsUnchanged,
    occurrenceIds: row.occurrenceIds,
    dependencies: row.dependencyIds.map((id) => {
      const d = dependencies.get(id)!;
      return {
        id,
        evidenceState: d.authorityStatus,
        readinessCategory: overlay.get(id)?.category ?? null,
        controls: d.controlsAtStart,
        association: 'inherited-lineage-not-proven-causality' as const,
      };
    }),
    wholeAssetReady: false as const,
    executable: false as const,
  }));
  const originalPicks = [
    ...new Set(
      data.retained.entitlements.flatMap(
        (e) => e.baselineUnderlyingAssetIdsUnchanged
      )
    ),
  ]
    .sort()
    .map((id) => ({
      id,
      role: 'referenced-original-pick' as const,
      holderEvidence: dependencies.get(`ownership-state:${id}`) ?? null,
      // Preserve scoped holder support; this is not a complete ownership verdict.
      ownershipVerdict: 'not-evaluated' as const,
    }));
  return freeze({
    ...data,
    originalPicks,
    legacyRecords,
    execution: 'disabled' as const,
  });
}

export type DraftPickFoundation = ReturnType<typeof buildDraftPickFoundation>;

/** Evidence support and non-applicability are visible without an availability verdict. */
export function inspectDraftDependency(
  foundation: DraftPickFoundation,
  dependencyId: string
) {
  const row = foundation.retained.dependencies.find(
    (d) => d.id === dependencyId
  );
  if (!row)
    return {
      status: 'blocked' as const,
      reason: 'unknown-dependency',
      executable: false as const,
    };
  return {
    status: row.authorityStatus,
    controls: row.controlsAtStart,
    governingAlternativesComplete: row.governingAlternativesComplete,
    evidenceRefs: row.evidenceRefs,
    executable: false as const,
  };
}
