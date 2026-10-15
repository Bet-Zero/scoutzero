import { z } from 'zod';

/** Prior draft fields retained on the existing source document, not a world migration. */
const PriorFieldZ = z.union([
  z.strictObject({ present: z.literal(false) }),
  z
    .strictObject({ present: z.literal(true), value: z.unknown() })
    .refine(
      (field) => field.value !== undefined,
      'A present field must have a Firestore value'
    ),
]);

export const DraftSourceBaselineZ = z.strictObject({
  schemaVersion: z.literal(1),
  beforeExists: z.boolean(),
  fields: z.record(z.string(), PriorFieldZ),
});

export type DraftSourceBaseline = z.infer<typeof DraftSourceBaselineZ>;
