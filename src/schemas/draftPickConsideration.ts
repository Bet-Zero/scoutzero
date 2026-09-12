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
    recipientTeam: z.string().regex(/^[A-Z]{3}$/),
    // No unlisted outgoing assets or allocation across another exchange.
    onlyListedFirstsOutgoing: z.boolean(),
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
  .strict();

export type DraftPickConsiderationFact = z.infer<
  typeof DraftPickConsiderationFactZ
>;
