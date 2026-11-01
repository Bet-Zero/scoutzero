import { z } from 'zod';

const id = z.string().min(1);
const team = z.string().regex(/^[A-Z]{3}$/);
const binding = {
  sourceRefs: z.array(id).min(1),
  dependencyIds: z.array(id).min(1),
};

/** Explicit source-linked software terms; never a production rights release. */
export const DraftOverlappingPoolProgramZ = z
  .object({
    kind: z.literal('native-overlapping-pool-v1'),
    year: z.number().int().min(2028).max(2031),
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
      .length(7),
    conveyance: z
      .object({
        ...binding,
        entitlementId: id,
        recipientTeam: team,
        protectedThrough: z.number().int().min(1).max(29),
        priorObligation: z.literal('satisfied'),
        scope: z.literal('first-round-only'),
      })
      .strict(),
    // These are source-native options, not one election per legacy representation.
    claims: z
      .array(
        z
          .object({
            ...binding,
            clauseId: id,
            representationIds: z.array(id),
            holderTeam: team,
            targetTeam: team,
            eligibleReturnIds: z.array(id).min(1),
            election: z.literal('exercise-only'),
          })
          .strict()
      )
      .length(5),
    // Broad inherited navigation links must be explicitly separated from rights.
    unrelatedClaims: z.array(
      z
        .object({
          ...binding,
          representationId: id,
          originalPickIds: z.array(id).min(1),
        })
        .strict()
    ),
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
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    const ids = p.slots.map((s) => s.entitlementId);
    const teams = p.slots.map((s) => s.originalTeam);
    const representations = p.claims
      .flatMap((c) => c.representationIds)
      .concat(p.unrelatedClaims.map((c) => c.representationId));
    if (
      !unique(ids) ||
      !unique(teams) ||
      !unique(representations) ||
      !unique(p.claims.map((c) => c.clauseId)) ||
      !ids.includes(p.conveyance.entitlementId) ||
      !teams.includes(p.conveyance.recipientTeam) ||
      p.slots.some((s) => s.holderTeam !== s.originalTeam) ||
      p.slots.find((s) => s.entitlementId === p.conveyance.entitlementId)
        ?.holderTeam === p.conveyance.recipientTeam
    )
      fail(
        'Distinct original selections, initial holders and native claims are required.'
      );
    for (const c of p.claims) {
      if (
        !teams.includes(c.holderTeam) ||
        !teams.includes(c.targetTeam) ||
        c.holderTeam === c.targetTeam ||
        !unique(c.eligibleReturnIds) ||
        c.eligibleReturnIds.some((id) => !ids.includes(id))
      )
        fail(
          'A native option needs complete eligible originals and distinct participants.'
        );
    }
    for (const c of [p.conveyance, ...p.claims, ...p.unrelatedClaims])
      if (!unique(c.sourceRefs) || !unique(c.dependencyIds))
        fail('Source and dependency bindings must be distinct.');
    for (const c of p.unrelatedClaims)
      if (!unique(c.originalPickIds))
        fail('Unrelated original selections must be distinct.');
    const [first, second, residual, priority, last] = p.claims;
    if (first && second && residual && priority && last) {
      const original = (t: string) =>
        p.slots.find((s) => s.originalTeam === t)?.entitlementId;
      const equal = (a: string[], b: (string | undefined)[]) =>
        JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      const conditional = p.slots.find(
        (s) => s.entitlementId === p.conveyance.entitlementId
      );
      if (
        p.slots.length !== 7 ||
        first.holderTeam !== p.conveyance.recipientTeam ||
        second.holderTeam !== first.holderTeam ||
        residual.targetTeam !== first.targetTeam ||
        last.holderTeam !== residual.holderTeam ||
        last.targetTeam !== priority.targetTeam ||
        new Set([
          first.holderTeam,
          first.targetTeam,
          second.targetTeam,
          residual.holderTeam,
          priority.holderTeam,
          priority.targetTeam,
          conditional?.originalTeam,
        ]).size !== 7 ||
        !equal(first.eligibleReturnIds, [
          original(first.holderTeam),
          conditional?.entitlementId,
        ]) ||
        !equal(second.eligibleReturnIds, [
          original(first.holderTeam),
          original(first.targetTeam),
        ]) ||
        !equal(residual.eligibleReturnIds, [original(residual.holderTeam)]) ||
        !equal(priority.eligibleReturnIds, [original(priority.holderTeam)]) ||
        !equal(last.eligibleReturnIds, [
          original(residual.holderTeam),
          original(first.holderTeam),
          original(first.targetTeam),
          conditional?.entitlementId,
        ])
      )
        fail(
          'The complete protected-conveyance and residual-claim order is required.'
        );
    }
  });
export type DraftOverlappingPoolProgram = z.infer<
  typeof DraftOverlappingPoolProgramZ
>;
