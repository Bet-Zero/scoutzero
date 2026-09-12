/** Evidence storage only. Schema validity never certifies a tradable right. */
import { z } from 'zod';
import { PstTermZ } from '@/schemas/pstLifecycle';

export const DraftEvidenceStatusZ = z.enum([
  'supported in stated scope',
  'legitimate future outcome pending',
  'proven non-applicable',
  'unresolved',
  'conflicting',
]);
export const DraftEvidenceIdZ = z.string().min(1);
export const DraftEvidenceHashZ = z.string().regex(/^[a-f0-9]{64}$/);
export const DraftEvidenceInstantZ = z.string().datetime({ offset: true });
export const DraftEvidenceReviewZ = z
  .object({
    status: z.enum([
      'unreviewed',
      'accepted',
      'accepted-with-limitations',
      'rejected',
    ]),
    reference: DraftEvidenceIdZ,
    limitations: z.array(z.string()),
  })
  .strict();

export const DraftEvidenceSourceZ = z
  .object({
    id: DraftEvidenceIdZ,
    artifactSha256: DraftEvidenceHashZ,
    locator: DraftEvidenceIdZ,
    scope: DraftEvidenceIdZ,
    qualification: z.enum([
      'qualified',
      'unqualified',
      'unresolved',
      'conflicting',
    ]),
    publishedAt: DraftEvidenceInstantZ.nullable(),
    capturedAt: DraftEvidenceInstantZ.nullable(),
    review: DraftEvidenceReviewZ,
  })
  .strict();

/** A missing effective date is explicit; a capture date is never its fallback. */
export const DraftEvidenceAssertionZ = z
  .object({
    id: DraftEvidenceIdZ,
    status: DraftEvidenceStatusZ,
    claim: DraftEvidenceIdZ,
    effectiveAt: DraftEvidenceInstantZ.nullable(),
    effectiveDateScope: DraftEvidenceIdZ,
    sources: z.array(DraftEvidenceSourceZ),
    alternatives: z.array(
      z
        .object({
          id: DraftEvidenceIdZ,
          condition: DraftEvidenceIdZ,
          consequence: DraftEvidenceIdZ,
        })
        .strict()
    ),
    governingAlternativesComplete: z.boolean(),
    unresolvedDependencyIds: z.array(DraftEvidenceIdZ),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      record.status === 'legitimate future outcome pending' &&
      (!record.governingAlternativesComplete || record.alternatives.length < 2)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Future alternatives must be explicit and complete',
      });
    }
    if (
      record.status === 'supported in stated scope' &&
      !record.sources.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Supported claims require scoped source references',
      });
    }
  });

/** Retain unfamiliar clauses without pretending the parser is a contract engine. */
export const DraftRetainedProgramZ = z
  .object({
    id: DraftEvidenceIdZ,
    dependencyId: DraftEvidenceIdZ,
    clauses: z.array(
      z
        .object({
          text: DraftEvidenceIdZ,
          sourceRef: DraftEvidenceIdZ,
          parsed: PstTermZ.nullable(),
        })
        .strict()
    ),
    completeness: z.enum([
      'unresolved',
      'conflicting',
      'supported-in-stated-scope',
    ]),
    executable: z.literal(false),
  })
  .strict();

export const DraftSourceRightZ = z
  .object({
    id: DraftEvidenceIdZ,
    sourceName: DraftEvidenceIdZ,
    clauseRefs: z.array(DraftEvidenceIdZ).min(1),
    assertionIds: z.array(DraftEvidenceIdZ),
    effectiveAt: DraftEvidenceInstantZ.nullable(),
    status: DraftEvidenceStatusZ,
    executable: z.literal(false),
  })
  .strict();

/** Named retained output, including dates at their original precision and raw clauses. */
export const DraftRetainedArtifactZ = z
  .object({
    id: DraftEvidenceIdZ,
    sha256: DraftEvidenceHashZ,
    scope: DraftEvidenceIdZ,
    review: DraftEvidenceReviewZ,
    content: z.json(),
  })
  .strict();

export const DraftFoundationReleaseZ = z
  .object({
    id: DraftEvidenceIdZ,
    schemaVersion: z.literal(1),
    evidenceSha256: DraftEvidenceHashZ,
    assessmentSha256: DraftEvidenceHashZ,
    asOf: DraftEvidenceInstantZ,
    review: DraftEvidenceReviewZ,
  })
  .strict();

export type DraftEvidenceStatus = z.infer<typeof DraftEvidenceStatusZ>;
export type DraftEvidenceAssertion = z.infer<typeof DraftEvidenceAssertionZ>;
export type DraftFoundationRelease = z.infer<typeof DraftFoundationReleaseZ>;
