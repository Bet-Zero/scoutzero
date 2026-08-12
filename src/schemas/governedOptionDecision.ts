/** Canonical request boundary for a governed Full Cap Table option decision. */

import { z } from 'zod';

export const GovernedOptionNoticeMethodZ = z.enum([
  'personal-delivery',
  'email',
  'certified-mail',
  'registered-mail',
  'facsimile',
]);

export const GovernedOptionNoticeInputZ = z.strictObject({
  deliveredAt: z.string(),
  method: GovernedOptionNoticeMethodZ,
  recipient: z.string().refine((value) => value.trim().length > 0, {
    message: 'notice recipient is required',
  }),
  leagueReceivedAt: z.string(),
  playersAssociationForwardedAt: z.string(),
});

export const GovernedOptionDecisionChoiceZ = z.enum(['exercise', 'decline']);

export type GovernedOptionNoticeMethod = z.infer<
  typeof GovernedOptionNoticeMethodZ
>;
export type GovernedOptionNoticeInput = z.infer<
  typeof GovernedOptionNoticeInputZ
>;
export type GovernedOptionDecisionChoice = z.infer<
  typeof GovernedOptionDecisionChoiceZ
>;
