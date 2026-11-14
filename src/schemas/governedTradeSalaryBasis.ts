import { z } from 'zod';
import { TradeAggregationFactsZ } from './tradeAggregation';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().nonnegative();

export const GovernedTradeSalaryBasisEvidenceZ = z.strictObject({
  evidenceVersion: z.literal(1),
  /** Exact S01.5 table cells retained with this Contract, when available. */
  minimumSalaryAmounts: z
    .array(
      z.strictObject({
        salaryCapYear: z.number().int(),
        contractStartSalaryCapYear: z.number().int(),
        contractYear: z.number().int().positive(),
        yearsOfService: z.number().int().nonnegative(),
        amount: MoneyZ.positive(),
      })
    )
    .optional(),
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
        'two-way-exclusion',
      ])
      .nullable(),
    currentSalary: MoneyZ.nullable(),
    outgoingSalary: MoneyZ.nullable(),
    incomingSalary: MoneyZ.nullable(),
    poisonPillIncomingSalary: MoneyZ.nullable(),
    twoWayContractEndYear: z.number().int().optional(),
    /** The Contract can be acquired with the Minimum Exception ($0 incoming). */
    minimumExceptionAcquisition: z.boolean().optional(),
    /** Seasons left on the Contract, counting the current Salary Cap Year. */
    contractSeasonsRemaining: z.number().int().min(1).optional(),
    aggregationFacts: TradeAggregationFactsZ.optional(),
    /** Named SIMULATION assumptions this result depends on (for example the trade deadline). */
    assumptionIds: z.array(NonEmptyStringZ).optional(),
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
    if (
      value.method === 'two-way-exclusion' &&
      (value.outgoingSalary !== 0 ||
        value.incomingSalary !== 0 ||
        value.poisonPillIncomingSalary !== null ||
        value.twoWayContractEndYear == null ||
        value.twoWayContractEndYear < value.salaryCapYear ||
        value.twoWayContractEndYear > value.salaryCapYear + 1 ||
        !value.canonLeafIds.includes('CBA2-A02.14'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['method'],
        message:
          'Two-Way exclusion requires zero matching salary and its Canon authority',
      });
    }
  });

export type GovernedTradeSalaryBasisEvidence = z.infer<
  typeof GovernedTradeSalaryBasisEvidenceZ
>;
export type GovernedTradeSalaryBasis = z.infer<
  typeof GovernedTradeSalaryBasisZ
>;
