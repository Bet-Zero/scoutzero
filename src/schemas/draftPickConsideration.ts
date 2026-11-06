/** Established consideration facts; does not classify economic cash equivalence. */
import { z } from 'zod';
import {
  DraftOriginalFirstZ,
  DraftOriginalOwnershipFactZ,
} from '@/schemas/draftPickOperation';

export const DraftPickConsiderationFactZ = DraftOriginalOwnershipFactZ.omit({
  scope: true,
  pick: true,
  claimCoverage: true,
  claims: true,
})
  .extend({
    scope: z.literal('first-round-consideration'),
    outgoing: z.array(DraftOriginalFirstZ).min(1),
    // Historical facts retain their single recipient. New facts route each first.
    recipientTeam: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    outgoingDestinations: z
      .array(
        z
          .object({
            pickId: z.string().min(1),
            toTeam: z.string().regex(/^[A-Z]{3}$/),
          })
          .strict()
      )
      .min(1)
      .optional(),
    // No unlisted outgoing assets or allocation across another exchange.
    onlyListedFirstsOutgoing: z.boolean(),
    // A complete noncash bundle may also assign these Contracts.
    // Their ownership and ordinary salary authority are established upstream.
    outgoingPlayerContracts: z
      .array(
        z
          .object({
            playerId: z.string().min(1),
            contractId: z.string().min(1),
          })
          .strict()
      )
      .min(1)
      .optional(),
    allReturnConsiderationListed: z.boolean(),
    unconditionalDirectExchange: z.boolean(),
    consideration: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum([
            'cash',
            'cash-equivalent',
            'established-noncash',
            'unclassified',
          ]),
          amountCents: z.number().int().nonnegative().safe().nullable(),
        })
        .strict()
    ),
  })
  .strict()
  .superRefine((fact, ctx) => {
    const routes = fact.outgoingDestinations;
    if (
      (fact.recipientTeam === undefined) === (routes === undefined) ||
      (routes &&
        (routes.length !== fact.outgoing.length ||
          new Set(routes.map((r) => r.pickId)).size !== routes.length ||
          routes.some(
            (r) =>
              r.toTeam === fact.context.team ||
              !fact.outgoing.some((p) => p.id === r.pickId)
          )))
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Exactly one complete explicit outgoing destination representation is required.',
      });
  });

export type DraftPickConsiderationFact = z.infer<
  typeof DraftPickConsiderationFactZ
>;
