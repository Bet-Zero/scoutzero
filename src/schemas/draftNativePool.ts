/** Governed software terms for a source-native closed pool, never a new asset. */
import { z } from 'zod';
const id = z.string().min(1);
const team = z.string().regex(/^[A-Z]{3}$/);
export const DraftNativePoolProgramZ = z
  .object({
    kind: z.literal('native-ranked-pool-v1'),
    year: z.number().int().min(2028).max(2029),
    slots: z
      .array(
        z
          .object({
            entitlementId: id,
            originalTeam: team,
            holderTeam: team,
            protectedThrough: z.literal(0),
          })
          .strict()
      )
      .length(3),
    nativePool: z
      .object({
        clauseIds: z.array(id).min(1),
        sourceRefs: z.array(id).min(1),
        dependencyIds: z.array(id).min(1),
        archivalIds: z.array(id),
        beneficiaryTeam: team,
        residualTeam: team,
        ranks: z.tuple([z.literal(1), z.literal(2)]),
        residualRank: z.literal(3),
        priority: z.literal('ranked-claim-before-residual'),
        conditions: z.literal('all-three-unprotected'),
        election: z.literal('exercise-only'),
      })
      .strict(),
    result: z
      .object({
        positions: z.record(team, z.number().int().min(1).max(30)),
        elections: z.record(id, z.boolean()),
        allocation: z.record(id, team),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    if (
      !unique(p.slots.map((s) => s.entitlementId)) ||
      !unique(p.slots.map((s) => s.originalTeam)) ||
      !unique(p.nativePool.clauseIds) ||
      !unique(p.nativePool.sourceRefs) ||
      !unique(p.nativePool.dependencyIds) ||
      !unique(p.nativePool.archivalIds) ||
      p.nativePool.beneficiaryTeam === p.nativePool.residualTeam ||
      p.nativePool.archivalIds.some((id) =>
        p.slots.some((s) => s.entitlementId === id)
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Distinct originals, claims, evidence and recipients are required.',
      });
  });
export type DraftNativePoolProgram = z.infer<typeof DraftNativePoolProgramZ>;
