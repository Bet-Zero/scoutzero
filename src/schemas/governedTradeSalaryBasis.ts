import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().nonnegative();

export const GovernedTradeSalaryBasisEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  earnedBaseCompensation: z.array(
    z.strictObject({
      season: NonEmptyStringZ,
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: MoneyZ,
    })
  ),
  oneYearMinimum: z
    .strictObject({
      qualifies: z.boolean(),
      leagueReimbursedUnearnedPortion: MoneyZ,
    })
    .nullable(),
  poisonPill: z
    .strictObject({
      rookieScaleExtendedUnderVii7b: z.boolean(),
      extensionSignedAt: NonEmptyStringZ,
      firstFollowingSalaryCapYearStartsAt: NonEmptyStringZ,
      originalLastSeason: NonEmptyStringZ,
      extendedTerms: z
        .array(
          z.strictObject({
            season: NonEmptyStringZ,
            salaryBasis: z.enum(['fixed', 'percentage-of-assumed-cap']),
            fixedSalary: MoneyZ.nullable(),
            salaryPercentage: z.number().finite().nonnegative().nullable(),
            unlikelyBonuses: MoneyZ,
            applicableMaximumAnnualSalary: MoneyZ,
          })
        )
        .min(1),
    })
    .nullable(),
});

export const GovernedTradeSalaryBasisProofZ = z.strictObject({
  ledgerId: NonEmptyStringZ,
  ledgerVersion: z.number().int().min(1),
  contractVersion: z.number().int().min(1),
  stateDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
  calendarRecordId: NonEmptyStringZ,
  calendarRecordVersion: z.number().int().min(1),
  calendarSourceRecordId: NonEmptyStringZ,
  calendarSourceRecordVersion: z.number().int().min(1),
});

export const GovernedTradeSalaryBasisZ = z
  .strictObject({
    authorityVersion: z.literal(1),
    status: z.enum(['ready', 'needs-input', 'incompatible']),
    worldId: NonEmptyStringZ,
    teamId: NonEmptyStringZ,
    playerId: NonEmptyStringZ,
    contractId: NonEmptyStringZ.nullable(),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    salaryCapYear: z.number().int(),
    method: z
      .enum([
        'ordinary-protection',
        'january-8-deemed-full',
        'postseason-lesser-of',
      ])
      .nullable(),
    currentSalary: MoneyZ.nullable(),
    outgoingSalary: MoneyZ.nullable(),
    incomingSalary: MoneyZ.nullable(),
    poisonPillIncomingSalary: MoneyZ.nullable(),
    canonLeafIds: z.array(NonEmptyStringZ),
    reasons: z.array(NonEmptyStringZ),
    proof: GovernedTradeSalaryBasisProofZ.nullable(),
  })
  .superRefine((value, context) => {
    if (value.status !== 'ready') return;
    const required: Array<keyof typeof value> = [
      'contractId',
      'method',
      'currentSalary',
      'outgoingSalary',
      'incomingSalary',
      'proof',
    ];
    required.forEach((field) => {
      if (value[field] === null) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'is required when governed salary-basis authority is ready',
        });
      }
    });
    if (value.reasons.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['reasons'],
        message: 'must be empty when governed salary-basis authority is ready',
      });
    }
  });

export type GovernedTradeSalaryBasisEvidence = z.infer<
  typeof GovernedTradeSalaryBasisEvidenceZ
>;
export type GovernedTradeSalaryBasis = z.infer<
  typeof GovernedTradeSalaryBasisZ
>;
