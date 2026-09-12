/** Versioned adapter boundary for accepted Stage B outputs, not a new extractor. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ as Id,
  DraftEvidenceStatusZ,
  DraftEvidenceInstantZ,
} from '@/schemas/draftPickEvidence';

const ids = z.array(Id);
// Passthrough preserves source annotations and original accounting verbatim.
// Only declared fields participate in the read model. No extra field executes.
export const DraftRetainedDependencyZ = z
  .object({
    id: Id,
    family: Id,
    authorityStatus: DraftEvidenceStatusZ,
    baselineOccurrenceIds: ids,
    entitlementIds: ids,
    controlsAtStart: Id,
    evidenceRefs: ids,
    governingAlternativesComplete: z.boolean(),
    requiredAuthority: ids,
    remainingRouteOrUnblockingEvent: z.string(),
    runtimeAuthority: z.literal(false),
    wholeAssetCertified: z.literal(false),
  })
  .passthrough();

export const DraftRetainedReadinessZ = z
  .object({
    dependencies: z.array(DraftRetainedDependencyZ),
    entitlements: z.array(
      z
        .object({
          entitlementId: Id,
          kind: z.enum(['pick_ownership', 'swap_right', 'conveyance_right']),
          baselineUnderlyingAssetIdsUnchanged: ids,
          dependencyIds: ids,
          occurrenceIds: ids,
          positivePathAuthority: z.literal('unavailable'),
          wholeAssetCertified: z.literal(false),
        })
        .passthrough()
    ),
    occurrences: z.array(
      z
        .object({
          id: Id,
          dependencyIds: ids,
          baseline: z.object({ id: Id, entitlementId: Id }).passthrough(),
        })
        .passthrough()
    ),
    predecessorDependencies: z.array(
      z
        .object({
          id: Id,
          affectedEntitlementIds: ids,
        })
        .passthrough()
    ),
    summary: z.object({ asOf: DraftEvidenceInstantZ }).passthrough(),
  })
  .strict();

export const DraftReadinessOverlayZ = z.array(
  z
    .object({
      id: Id,
      category: z.enum(['A', 'B', 'C', 'D']),
      family: Id,
      authorityStatus: DraftEvidenceStatusZ,
      baselineOccurrenceIds: ids,
      entitlementIds: ids,
      controlsAtStart: Id,
      structuralDependencyOrScope: ids,
    })
    .passthrough()
);

/** Explicit source-clause association; never inferred from legacy-ID overlap. */
export const DraftPoolScopeNoteZ = z
  .object({
    dependencyId: Id,
    pool: ids.min(2),
    sourceNamedMembers: ids.min(2),
    clauseRef: Id,
    relation: z.literal('shared-pool-scope-only'),
  })
  .strict();

export type DraftRetainedReadiness = z.infer<typeof DraftRetainedReadinessZ>;
export type DraftReadinessOverlay = z.infer<typeof DraftReadinessOverlayZ>;
