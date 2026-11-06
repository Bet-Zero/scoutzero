/** Private preparation artifacts. These types grant no source or Apply authority. */
import { z } from 'zod';
import { DraftEvidenceHashZ, DraftEvidenceIdZ } from './draftPickEvidence';
import {
  DraftOriginalFirstZ,
  DraftOriginalOwnershipFactZ,
} from './draftPickOperation';
import { DraftPickRealReviewPackageZ } from './draftPickRealReview';
import { ContractSourceReleasePinZ } from './contractSourceRelease';
import { TeamSalaryBookInputsZ } from './salaryBooks';

export const JUNE5_START = '2026-06-05T12:19:56.526Z' as const;
const refs = z.array(DraftEvidenceIdZ).min(1);
export const StartingEvidenceReferenceZ = z
  .object({
    locator: DraftEvidenceIdZ,
    sha256: DraftEvidenceHashZ,
  })
  .strict();
export const StartingIdentityZ = z
  .object({
    entitlementId: DraftEvidenceIdZ,
    originalPick: DraftOriginalFirstZ.nullable(),
    group: z.enum([
      'original-supported',
      'original-future-pending',
      'original-unresolved',
      'original-frozen',
      'original-outside-window',
      'native-grant-mapping',
      'conditional-native-identity-needs-input',
      'archival-generated-alias',
    ]),
    acceptedHolderState: z
      .enum(['supported', 'future-pending', 'unresolved'])
      .nullable(),
    reportedHolder: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    holderEvidenceRefs: z.array(DraftEvidenceIdZ),
    holderLimitations: z.array(DraftEvidenceIdZ),
    // Complete operation evidence is distinct from a reported-holder disposition.
    ownershipFact: DraftOriginalOwnershipFactZ.omit({
      context: true,
    }).nullable(),
    nativeAssets: z.array(DraftEvidenceIdZ),
    duplicateRepresentationNote: z.string().nullable(),
    retainedAssessment: z.json(),
    retainedTerms: z.array(
      z
        .object({
          dependencyId: DraftEvidenceIdZ,
          sourceRefs: refs,
          content: z.json(),
        })
        .strict()
    ),
    excludedLaterAssertionIds: z.array(DraftEvidenceIdZ),
  })
  .strict();

export const StartingApronHistoryZ = z
  .object({
    dependencyId: DraftEvidenceIdZ,
    team: z.string().regex(/^[A-Z]{3}$/),
    seasonStartYear: z.number().int(),
    state: z.enum(['supported', 'unresolved', 'future-pending']),
    aboveSecondApron: z.boolean().nullable(),
    valueBinding: z.enum([
      'bound',
      'accepted-value-not-yet-bound',
      'not-established',
    ]),
    lifecycleRelevance: z.enum(['retained', 'conditional-non-applicable']),
    restoreIfGateReopened: z.array(DraftEvidenceIdZ),
    sourceRefs: refs,
    limitations: z.array(DraftEvidenceIdZ),
    // Scoped above/not-above determinations must never become fabricated amounts.
    numericSalaryEstablished: z.literal(false),
  })
  .strict();

export const DraftStartingStateCandidateZ = z
  .object({
    version: z.literal(1),
    purpose: z.literal('private-starting-state-preparation'),
    asOf: z.literal(JUNE5_START),
    salaryCapYear: z.literal(2026),
    authority: z.literal('pending-independent-source-admission'),
    apply: z.literal('blocked'),
    inventorySha256: DraftEvidenceHashZ,
    assessmentSha256: DraftEvidenceHashZ,
    catalogueSha256: DraftEvidenceHashZ,
    sourceFiles: z.array(StartingEvidenceReferenceZ).min(1),
    contractRelease: ContractSourceReleasePinZ,
    records: z.array(StartingIdentityZ).length(278),
    unresolved: DraftPickRealReviewPackageZ.shape.unresolved.length(29),
    apronHistory: z.array(StartingApronHistoryZ),
    teamInputs: z
      .array(
        z
          .object({
            team: z.string().regex(/^[A-Z]{3}$/),
            salaryBookInputs: TeamSalaryBookInputsZ,
            missingInputs: z.array(DraftEvidenceIdZ).min(1),
          })
          .strict()
      )
      .length(30),
  })
  .strict();

export type DraftStartingStateCandidate = z.infer<
  typeof DraftStartingStateCandidateZ
>;
export type StartingIdentity = z.infer<typeof StartingIdentityZ>;
