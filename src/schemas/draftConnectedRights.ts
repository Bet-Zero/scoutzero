/** Source-supplied possession classes for present-day transfers of existing rights.
 * Draft ranking/election outcomes with identical possession are one class. These
 * are input facts, not a new draft resolver or permission to author NBA terms.
 */
import { z } from 'zod';
const id = z.string().min(1);
const original = z.string().regex(/^[A-Z]{3}_\d{4}_(1st|2nd)$/);
export const DraftConnectedProgramZ = z
  .object({
    id,
    sourceRefs: z.array(id).min(1),
    terms: z.string().min(1),
    originals: z.array(original).min(1),
    interests: z
      .array(
        z
          .object({
            entitlementId: id,
            anchorPickId: z
              .string()
              .regex(/^[A-Z]{3}_\d{4}_1st$/)
              .nullable(),
            possibleOriginals: z.array(original).min(1),
            terms: z.string().min(1),
          })
          .strict()
      )
      .min(1),
    // Exhaustive classes supplied by the pinned baseline compiler. Each allocation
    // is a representative, NOT an assertion of an observed draft order or result.
    possessionCases: z
      .array(
        z
          .object({
            id,
            condition: z.string().min(1),
            allocation: z.record(original, id),
          })
          .strict()
      )
      .min(1),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (a: string[]) => new Set(a).size === a.length;
    const ids = p.interests.map((i) => i.entitlementId);
    if (
      !unique(p.originals) ||
      !unique(ids) ||
      !unique(p.possessionCases.map((c) => c.id))
    )
      fail(
        'Connected originals, interests and possession classes must be distinct.'
      );
    for (const interest of p.interests) {
      if (
        !unique(interest.possibleOriginals) ||
        (interest.anchorPickId === null &&
          interest.possibleOriginals.some((o) => o.endsWith('_1st'))) ||
        (interest.anchorPickId !== null &&
          !interest.possibleOriginals.includes(interest.anchorPickId)) ||
        interest.possibleOriginals.some((o) => !p.originals.includes(o))
      )
        fail('An interest must retain its complete original selection scope.');
      if (
        !p.possessionCases.some((c) =>
          Object.values(c.allocation).includes(interest.entitlementId)
        )
      )
        fail('An admitted interest must exist in a possible possession class.');
    }
    for (const c of p.possessionCases) {
      if (
        Object.keys(c.allocation).length !== p.originals.length ||
        p.originals.some((o) => !(o in c.allocation))
      )
        fail(
          'Each possession class must conserve every original including fallback selections.'
        );
      for (const [pick, right] of Object.entries(c.allocation))
        if (
          !p.interests
            .find((i) => i.entitlementId === right)
            ?.possibleOriginals.includes(pick)
        )
          fail('Allocation contradicts the connected interest scope.');
    }
  });
export const DraftConnectedProgramsZ = z
  .array(DraftConnectedProgramZ)
  .superRefine((programs, ctx) => {
    for (const values of [
      programs.map((p) => p.id),
      programs.flatMap((p) => p.originals),
      programs.flatMap((p) => p.interests.map((i) => i.entitlementId)),
    ])
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Overlapping obligations must share one connected program.',
        });
  });
export type DraftConnectedProgram = z.infer<typeof DraftConnectedProgramZ>;
