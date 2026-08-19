/** Strict authority, proposal, and lifecycle contracts for RFA Offer Sheets. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
// Governed money records use dollars with at most cent precision, including
// Arenas maximums and derived Average Annual Salary amounts.
const MoneyZ = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'must use at most cent precision',
  });
const PositiveVersionZ = z.number().int().min(1);
const ZonedInstantZ = z.string().datetime({ offset: true });
const Sha256Z = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const GovernedOfferSheetSourceZ = z.strictObject({
  provider: NonEmptyStringZ,
  retainedArtifactPath: NonEmptyStringZ,
  artifactSha256: Sha256Z,
  artifactBytes: z.number().int().positive(),
  retrievedAt: ZonedInstantZ,
  recordVersion: PositiveVersionZ,
  recordStatus: z.enum(['current', 'superseded']),
});

export const GovernedQualifyingOfferZ = z.strictObject({
  offerId: NonEmptyStringZ,
  offerVersion: PositiveVersionZ,
  branch: z.enum(['standard', 'maximum', 'two-way']),
  amount: MoneyZ,
  deliveredAt: ZonedInstantZ,
  openThrough: ZonedInstantZ,
  extensionDocumentId: NonEmptyStringZ.nullable(),
  withdrawnAt: ZonedInstantZ.nullable(),
  withdrawalConsentAt: ZonedInstantZ.nullable(),
  withdrawalConsentDocumentId: NonEmptyStringZ.nullable(),
  contractYears: z.number().int().positive(),
  annualRaiseBasisPoints: z.number().int().nonnegative(),
  annualBaseSchedule: z.array(MoneyZ).min(1).max(5),
  fullyProtected: z.boolean(),
  requiredTermsPresent: z.boolean(),
  hasOptionOrEto: z.boolean(),
  requiredOfferSheetGuaranteedSeasons: z.number().int().positive(),
  calculation: z.strictObject({
    basis: z.enum([
      'draft-slot',
      'prior-salary',
      'starter-criteria',
      'two-way',
    ]),
    certifiedAmount: MoneyZ,
    inputSourceIds: z.array(NonEmptyStringZ).min(1),
    calculationYear: z.number().int(),
    draftSlot: z.number().int().positive().nullable(),
    draftSlotAmount: MoneyZ.nullable(),
    priorSalary: MoneyZ.nullable(),
    officialStarts: z.number().int().nonnegative().nullable(),
    officialMinutes: z.number().int().nonnegative().nullable(),
    starterStartsThreshold: z.number().int().nonnegative().nullable(),
    starterMinutesThreshold: z.number().int().nonnegative().nullable(),
    starterCriteriaAmount: MoneyZ.nullable(),
    twoWayQualifyingAmount: MoneyZ.nullable(),
  }),
  recordStatus: z.enum(['current', 'superseded']),
  source: GovernedOfferSheetSourceZ,
});

export const GovernedOfferSheetEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  evidenceId: NonEmptyStringZ,
  evidenceRecordVersion: PositiveVersionZ,
  status: z.enum(['known', 'unknown', 'conflicting']),
  worldId: NonEmptyStringZ,
  homeTeamId: NonEmptyStringZ,
  playerId: NonEmptyStringZ,
  salaryCapYear: z.number().int(),
  observedAt: ZonedInstantZ,
  eligibility: z.strictObject({
    category: z.enum([
      'first-round-year-four',
      'qualifying-two-way',
      'three-or-fewer-yos',
    ]),
    yearsOfService: z.number().int().nonnegative(),
    firstRoundRookieScaleYearFourCompleted: z.boolean(),
    qualifyingTwoWayService: z.boolean(),
    otherPlayerEligible: z.boolean(),
  }),
  qualifyingOffer: GovernedQualifyingOfferZ,
  homeTeamMatchingAuthority: z.strictObject({
    authorityId: NonEmptyStringZ,
    authorityVersion: PositiveVersionZ,
    kind: z.enum(['room', 'exception']),
    amount: MoneyZ,
    effectiveFrom: ZonedInstantZ,
    effectiveThrough: ZonedInstantZ,
    recordStatus: z.enum(['current', 'superseded']),
    source: GovernedOfferSheetSourceZ,
  }),
  league: z.strictObject({
    salaryCap: MoneyZ,
    nonTaxpayerMle: MoneyZ,
    maximumSalary: MoneyZ,
    maximumSalaryBySeason: z
      .array(
        z.strictObject({
          season: NonEmptyStringZ,
          amount: MoneyZ,
        })
      )
      .min(1),
    arenasYearOneMaximum: MoneyZ,
    arenasYearTwoMaximum: MoneyZ,
    source: GovernedOfferSheetSourceZ,
  }),
});

export const GovernedOfferSheetBonusZ = z.strictObject({
  bonusId: NonEmptyStringZ,
  classification: z.enum(['likely', 'unlikely']),
  amount: MoneyZ,
});

export const GovernedOfferSheetSalaryZ = z.strictObject({
  season: NonEmptyStringZ,
  salaryExcludingIncentive: MoneyZ,
  regularSalary: MoneyZ,
  bonuses: z.array(GovernedOfferSheetBonusZ),
  guaranteedForLackOfSkill: z.boolean(),
  guaranteedForInjuryOrIllness: z.boolean(),
  individuallyNegotiatedProtectionConditions: z.boolean(),
  option: z.enum(['PO', 'TO', 'ETO']).nullable(),
});

export const GovernedOfferSheetAveragingElectionZ = z.strictObject({
  statementId: NonEmptyStringZ,
  deliveredToNbaAt: ZonedInstantZ,
  relayedToPlayersAssociationAt: ZonedInstantZ,
});

export const GovernedOfferSheetMatchRestrictionZ = z.strictObject({
  restrictionVersion: z.literal(1),
  lifecycleId: NonEmptyStringZ,
  eventId: NonEmptyStringZ,
  matchedAt: ZonedInstantZ,
  restrictedUntil: ZonedInstantZ,
  offeringTeamId: NonEmptyStringZ,
  playerTradeConsentRequired: z.literal(true),
  offeringTeamTradeBarred: z.literal(true),
  signAndTradeBarred: z.literal(true),
});

export const GovernedOfferSheetProposalZ = z.strictObject({
  proposalVersion: z.literal(1),
  signedAt: ZonedInstantZ,
  receivedAt: ZonedInstantZ,
  principalTermsDocumentId: NonEmptyStringZ,
  noticeDocumentId: NonEmptyStringZ,
  salariesByYear: z.array(GovernedOfferSheetSalaryZ).min(1).max(4),
});

export const GovernedOfferSheetReservationZ = z.strictObject({
  season: NonEmptyStringZ,
  amount: z.number().finite().nonnegative(),
});

export const GovernedOfferSheetTeamSalaryReferenceZ = z.strictObject({
  ledgerKind: z.literal('team-salary'),
  asOfDate: ZonedInstantZ,
  salaryCap: MoneyZ,
  totalBeforeOfferSheet: z.number().finite().nonnegative(),
  teamStateReference: NonEmptyStringZ,
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
});

export const GovernedOfferSheetLifecycleEventZ = z.discriminatedUnion(
  'eventKind',
  [
    z.strictObject({
      eventKind: z.literal('offer-sheet-signed'),
      eventId: NonEmptyStringZ,
      eventVersion: PositiveVersionZ,
      executedAt: ZonedInstantZ,
      recordedAt: ZonedInstantZ,
      qualifyingOfferId: NonEmptyStringZ,
      qualifyingOfferVersion: PositiveVersionZ,
      exerciseNoticeDeadline: ZonedInstantZ,
      proposal: GovernedOfferSheetProposalZ,
    }),
    z.strictObject({
      eventKind: z.literal('offer-sheet-matched'),
      eventId: NonEmptyStringZ,
      eventVersion: PositiveVersionZ,
      executedAt: ZonedInstantZ,
      recordedAt: ZonedInstantZ,
      restrictionsUntil: ZonedInstantZ,
      playerTradeConsentRequired: z.literal(true),
      offeringTeamTradeBarred: z.literal(true),
      signAndTradeBarred: z.literal(true),
      averagingElection: GovernedOfferSheetAveragingElectionZ.nullable(),
      matchingTeamSalaryReference:
        GovernedOfferSheetTeamSalaryReferenceZ.nullable(),
    }),
    z.strictObject({
      eventKind: z.literal('offer-sheet-declined'),
      eventId: NonEmptyStringZ,
      eventVersion: PositiveVersionZ,
      executedAt: ZonedInstantZ,
      recordedAt: ZonedInstantZ,
    }),
  ]
);

export const GovernedOfferSheetLifecycleZ = z
  .strictObject({
    payloadVersion: z.literal(1),
    ledgerId: NonEmptyStringZ,
    ledgerVersion: PositiveVersionZ,
    worldId: NonEmptyStringZ,
    playerId: NonEmptyStringZ,
    homeTeamId: NonEmptyStringZ,
    offeringTeamId: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    status: z.enum(['pending-match', 'matched', 'declined']),
    evidenceReference: z.strictObject({
      evidenceId: NonEmptyStringZ,
      evidenceRecordVersion: PositiveVersionZ,
    }),
    evidenceSnapshot: GovernedOfferSheetEvidenceZ,
    rightsReference: z.strictObject({
      ledgerId: NonEmptyStringZ,
      ledgerVersion: PositiveVersionZ,
      stateId: NonEmptyStringZ,
      stateVersion: PositiveVersionZ,
    }),
    reservations: z.strictObject({
      offeringTeam: z.array(GovernedOfferSheetReservationZ).min(1),
      offeringTeamSalaryReference: GovernedOfferSheetTeamSalaryReferenceZ,
      homeTeamAuthority: z.enum(['room', 'exception']),
      arenasApplies: z.boolean(),
      offeringTeamAccounting: z.enum([
        'stated-schedule',
        'average-annual-salary',
      ]),
      homeTeamAccounting: z.enum(['stated-schedule', 'average-annual-salary']),
    }),
    events: z.array(GovernedOfferSheetLifecycleEventZ).min(1),
  })
  .superRefine((lifecycle, context) => {
    const evidence = lifecycle.evidenceSnapshot;
    if (
      lifecycle.worldId !== evidence.worldId ||
      lifecycle.playerId !== evidence.playerId ||
      lifecycle.homeTeamId !== evidence.homeTeamId ||
      lifecycle.salaryCapYear !== evidence.salaryCapYear ||
      lifecycle.evidenceReference.evidenceId !== evidence.evidenceId ||
      lifecycle.evidenceReference.evidenceRecordVersion !==
        evidence.evidenceRecordVersion
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceSnapshot'],
        message:
          'Lifecycle identity and evidence reference must match the immutable evidence snapshot.',
      });
    }
  });

export type GovernedOfferSheetEvidence = z.infer<
  typeof GovernedOfferSheetEvidenceZ
>;
export type GovernedOfferSheetProposal = z.infer<
  typeof GovernedOfferSheetProposalZ
>;
export type GovernedOfferSheetAveragingElection = z.infer<
  typeof GovernedOfferSheetAveragingElectionZ
>;
export type GovernedOfferSheetMatchRestriction = z.infer<
  typeof GovernedOfferSheetMatchRestrictionZ
>;
export type GovernedOfferSheetTeamSalaryReference = z.infer<
  typeof GovernedOfferSheetTeamSalaryReferenceZ
>;
export type GovernedOfferSheetLifecycle = z.infer<
  typeof GovernedOfferSheetLifecycleZ
>;
