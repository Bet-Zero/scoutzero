import { z } from 'zod';

const Sha256Z = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const RecordIdZ = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
export const TransitionProvenanceHeadZ = z
  .object({
    schemaVersion: z.literal(1),
    worldId: RecordIdZ,
    recordId: RecordIdZ,
    recordSha256: Sha256Z,
  })
  .strict();

/** Server-owned authorization receipts, never client claims on history rows. */
export const TransitionProvenanceRecordZ = z
  .object({
    schemaVersion: z.literal(1),
    worldId: RecordIdZ,
    recordId: RecordIdZ,
    kind: z.enum(['baseline', 'seasonAdvance']),
    scope: z.literal('synthetic-review-only'),
    releaseId: z.string().min(1),
    releaseSha256: z.string().regex(/^[0-9a-f]{64}$/),
    predecessor: z
      .object({ recordId: RecordIdZ, recordSha256: Sha256Z })
      .strict()
      .nullable(),
    stateHashes: z.record(z.string(), Sha256Z),
    publishedHashes: z.record(z.string(), Sha256Z),
    createdAt: z.string().datetime(),
  })
  .strict();
export type TransitionProvenanceRecord = z.infer<
  typeof TransitionProvenanceRecordZ
>;
