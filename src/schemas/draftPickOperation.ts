/** Supplied operation facts only; parsing does not authenticate their sources. */
import { z } from 'zod';
import {
  DraftEvidenceHashZ,
  DraftEvidenceIdZ,
  DraftEvidenceInstantZ,
  DraftEvidenceSourceZ,
  DraftEvidenceStatusZ,
} from '@/schemas/draftPickEvidence';

const year = z.number().int().min(1946).max(9990);
export const DraftOriginalFirstZ = z
  .object({
    kind: z.literal('authenticated-original-pick'),
    id: DraftEvidenceIdZ,
    originalTeam: z.string().regex(/^[A-Z]{3}$/),
    draftYear: year,
    round: z.literal(1),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.id !== `${p.originalTeam}_${p.draftYear}_1st`)
      ctx.addIssue({
        code: 'custom',
        message: 'Original-pick tuple and ID disagree',
      });
  });

export const DraftOperationContextZ = z
  .object({
    // Caller supplies the current state and a digest of the entire exact proposal.
    proposalSha256: DraftEvidenceHashZ,
    stateVersion: DraftEvidenceIdZ,
    releaseId: DraftEvidenceIdZ,
    asOf: DraftEvidenceInstantZ,
    team: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();

export const DraftOperationRequestZ = z
  .object({
    context: DraftOperationContextZ,
    outgoing: z.array(DraftOriginalFirstZ).min(1),
  })
  .strict();

const evidence = {
  id: DraftEvidenceIdZ,
  context: DraftOperationContextZ,
  status: DraftEvidenceStatusZ,
  effectiveAt: DraftEvidenceInstantZ.nullable(),
  validUntil: DraftEvidenceInstantZ.nullable(),
  sources: z.array(DraftEvidenceSourceZ),
  unresolvedDependencyIds: z.array(DraftEvidenceIdZ),
};

export const DraftOriginalOwnershipFactZ = z
  .object({
    ...evidence,
    scope: z.literal('original-pick-ownership'),
    pick: DraftOriginalFirstZ,
    claimCoverage: z.enum(['complete', 'incomplete']),
    claims: z.array(
      z
        .object({
          id: DraftEvidenceIdZ,
          team: z.string().regex(/^[A-Z]{3}$/),
          status: z.enum([
            'owned-unconditionally',
            'expected-acquisition',
            'conditional-right-unimplemented',
          ]),
        })
        .strict()
    ),
  })
  .strict();

export const DraftStepienFactZ = z
  .object({
    ...evidence,
    scope: z.literal('stepien-post-trade-branches'),
    outgoing: z.array(DraftOriginalFirstZ).min(1),
    // These are governed state facts, not inferred from the Gregorian year.
    firstFutureDraftYear: year,
    firstFutureDraftStartsAt: DraftEvidenceInstantZ,
    previousDraft: z
      .object({ draftYear: year, completedAt: DraftEvidenceInstantZ })
      .strict(),
    throughDraftYear: year,
    laterDrafts: z.enum(['guaranteed-first-every-draft', 'unestablished']),
    branchesComplete: z.boolean(),
    branches: z.array(
      z
        .object({
          id: DraftEvidenceIdZ,
          // Each supplied branch is established as possible under the actual program.
          possible: z.literal(true),
          unresolvedDependencyIds: z.array(DraftEvidenceIdZ),
          drafts: z.array(
            z
              .object({
                draftYear: year,
                retained: z.array(DraftOriginalFirstZ),
                // A positive owned right proves possession even if other rights are unknown.
                inventoryComplete: z.boolean(),
              })
              .strict()
          ),
        })
        .strict()
    ),
  })
  .strict();

export type DraftOriginalFirst = z.infer<typeof DraftOriginalFirstZ>;
export type DraftOperationContext = z.infer<typeof DraftOperationContextZ>;
export type DraftOperationRequest = z.infer<typeof DraftOperationRequestZ>;
export type DraftOriginalOwnershipFact = z.infer<
  typeof DraftOriginalOwnershipFactZ
>;
export type DraftStepienFact = z.infer<typeof DraftStepienFactZ>;
