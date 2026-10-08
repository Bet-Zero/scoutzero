/** Archival provenance only; none of these records certify an economic right. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ as Id,
  DraftEvidenceHashZ,
} from '@/schemas/draftPickEvidence';

const ids = z
  .array(Id)
  .min(1)
  .refine((v) => new Set(v).size === v.length, 'Duplicate archival reference');
const legacyZ = z
  .object({
    id: Id,
    holderTeam: Id,
    kind: z.enum(['swap_right', 'conveyance_right']),
    seasonYear: z.number().int(),
    round: z.literal(1),
  })
  .passthrough();

/** Shape of the frozen sidecar, kept separate from the retained source index. */
export const DraftArchivalPoolMapZ = z
  .object({
    predecessorArchiveSha256: DraftEvidenceHashZ,
    predecessorMappingSha256: DraftEvidenceHashZ,
    scope: Id,
    rows: z
      .array(
        z
          .object({
            dependencyId: Id,
            legacyId: Id,
            archivalRole: z.literal('generated-projection-provenance-only'),
            legacyMeaningPreserved: legacyZ,
            exactGeneratorPreimage: Id,
            nativePoolFamily: Id,
            nativePoolClauseIds: ids,
            sourceParagraphIds: ids,
            occurrenceIds: ids,
            economicCorrespondence: z.literal('unresolved'),
            transferableRightEstablished: z.literal(false),
            executable: z.literal(false),
            accountingDelta: z.literal(0),
            reviewStatus: z.literal('unreviewed-author-sidecar'),
          })
          .strict()
      )
      .length(12),
    pools: z
      .record(
        Id,
        z
          .object({
            referencedOriginalPicks: ids.refine(
              (v) => v.length === 3,
              'Expected three original picks'
            ),
            legacyProjectionCount: z.literal(6),
            allocationAuthority: Id,
            sourceFactId: Id,
            sharedDependencyId: Id,
          })
          .strict()
      )
      .refine(
        (v) => Object.keys(v).length === 2,
        'Expected two archival pools'
      ),
    allTwelveDependenciesRemainUnresolved: z.literal(true),
  })
  .strict();

// Only existing structured pool fields are inspected. Preserve every other field
// in the original artifact; do not parse text or interpret ranks or recipients.
const selectionZ = z
  .object({
    kind: z.literal('selection'),
    parameters: z
      .object({ contextYear: z.number().int(), members: ids })
      .passthrough(),
  })
  .passthrough();
export const DraftArchivalNativeIndexZ = z
  .object({
    nativeClauses: z.array(z.object({ id: Id }).passthrough()),
    rights: z.array(
      z.object({ legacyId: Id, legacyComparison: legacyZ }).passthrough()
    ),
  })
  .passthrough();
export const DraftArchivalNativePoolClauseZ = z
  .object({
    id: Id,
    years: z.array(z.number().int()).length(1),
    signature: z
      .object({
        round: z.literal(1),
        semantic: z
          .object({ children: z.array(selectionZ).length(1) })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export const DraftArchivalArtifactSelectionZ = z
  .object({
    mapArtifactId: Id,
    nativeIndexArtifactId: Id,
  })
  .strict();
