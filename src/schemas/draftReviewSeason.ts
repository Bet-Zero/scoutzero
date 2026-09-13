/** Synthetic lifecycle evidence. Neither a live asset nor current trading permission. */
import { z } from 'zod';
import { DraftApronInputZ } from './draftApron';
import { DraftEvidenceIdZ, DraftEvidenceInstantZ } from './draftPickEvidence';
import { SeasonCloseApronMeasurementZ } from './salaryBooks';

export const SyntheticDraftSeasonSourceZ = z
  .object({
    kind: z.literal('synthetic-freeze-season-review-only'),
    version: z.literal(1),
    fromSeason: z.literal('2025-26'),
    toSeason: z.literal('2026-27'),
    closeDate: z.literal('2026-04-12'),
    effectiveAt: z.literal('2026-07-01T00:00:00-04:00'),
    // No current-draft assets, conditional programs, or unlisted claims in this fixture.
    noRequiredDraftResolution: z.literal(true),
    measurements: z.record(z.string(), SeasonCloseApronMeasurementZ),
    freezeInputs: z.array(DraftApronInputZ).length(30),
  })
  .strict();

export const DraftReviewFreezeEventZ = z
  .object({
    scope: z.literal('synthetic-review-only'),
    leaf: z.literal('CBA2-L08.3'),
    verdictOwner: z.literal('CBA2-A12.4'),
    worldId: DraftEvidenceIdZ,
    releaseId: DraftEvidenceIdZ,
    releaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceResultId: DraftEvidenceIdZ,
    triggerSalaryCapYear: z.literal('2025-26'),
    observationTimestamp: DraftEvidenceInstantZ,
    originalPick: DraftApronInputZ.shape.originalPick,
    freezeTriggered: z.boolean(),
    // Historical trigger does not settle subsequent release/penalty/ownership.
    currentRestriction: z.literal('not-evaluated'),
    tradingVerdict: z.literal('not-evaluated'),
  })
  .strict();

export const DraftReviewSeasonReceiptZ = z
  .object({
    scope: z.literal('synthetic-review-only'),
    operationId: DraftEvidenceIdZ,
    worldId: DraftEvidenceIdZ,
    transitionId: z.literal('seasonAdvance__2025-26__2026-27'),
    fromSeason: z.literal('2025-26'),
    toSeason: z.literal('2026-27'),
    effectiveAt: DraftEvidenceInstantZ,
    releaseId: DraftEvidenceIdZ,
    releaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
    entitlementState: z.literal('preserved-exactly'),
    entitlementStateDigests: z.record(
      z.string().regex(/^[A-Z]{3}$/),
      z.string().regex(/^fnv1a64:[0-9a-f]{16}$/)
    ),
    salaryBookHistory: z.record(
      z.string().regex(/^[A-Z]{3}$/),
      z
        .object({
          historyId: DraftEvidenceIdZ,
          beforeTotalsDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
          afterTotalsDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
        })
        .strict()
    ),
    freezeEvents: z.array(DraftReviewFreezeEventZ).length(30),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const teams = receipt.freezeEvents
      .map((event) => event.originalPick.originalTeam)
      .sort();
    if (
      new Set(teams).size !== 30 ||
      JSON.stringify(teams) !==
        JSON.stringify(Object.keys(receipt.entitlementStateDigests).sort()) ||
      JSON.stringify(teams) !==
        JSON.stringify(Object.keys(receipt.salaryBookHistory).sort()) ||
      teams.some(
        (team) =>
          receipt.salaryBookHistory[team]?.historyId !== `2025-26__${team}`
      ) ||
      receipt.freezeEvents.some(
        (event) =>
          event.worldId !== receipt.worldId ||
          event.releaseId !== receipt.releaseId ||
          event.releaseSha256 !== receipt.releaseSha256 ||
          event.originalPick.draftYear !== 2033 ||
          event.originalPick.id !==
            `${event.originalPick.originalTeam}_2033_1st`
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Incomplete or conflicting preserved season receipt.',
      });
  });
export type DraftReviewFreezeEvent = z.infer<typeof DraftReviewFreezeEventZ>;
export type DraftReviewSeasonReceipt = z.infer<
  typeof DraftReviewSeasonReceiptZ
>;
