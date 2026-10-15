import { z } from 'zod';

/** Immutable revisions in the existing source record; root fields remain legacy. */
export const DraftSourceRevisionZ = z.strictObject({
  schemaVersion: z.literal(1),
  legacyExists: z.boolean(),
  versions: z
    .record(
      z.string().regex(/^[1-9][0-9]*$/),
      z.record(z.string(), z.unknown())
    )
    .refine(
      (versions) => Object.keys(versions).length > 0,
      'At least one revision is required'
    ),
});

export type DraftSourceRevision = z.infer<typeof DraftSourceRevisionZ>;
