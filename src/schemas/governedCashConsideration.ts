import { z } from 'zod';
import { JsonValueZ } from '@/schemas/common';

const NonEmptyStringZ = z.string().trim().min(1);
const TeamCodeZ = z
  .string()
  .trim()
  .min(2)
  .max(5)
  .regex(/^[A-Z0-9]{2,5}$/, 'must be a canonical uppercase Team code');
const StateDigestZ = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const ZonedInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isGovernedCashZonedInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ZonedInstantPattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day >= 1 && daysInMonth !== undefined && day <= daysInMonth;
}

export const GovernedCashZonedInstantZ = z
  .string()
  .refine(isGovernedCashZonedInstant, {
    message: 'must be a calendar-valid ISO-8601 instant with an explicit UTC offset',
  });
const MoneyCentsZ = z.number().int().nonnegative().safe();

export const GovernedCashProofZ = z
  .object({
    canonCandidateCommit: z.literal('6cf8aaf358c158a88e630e8a7336f7e9c3febc17'),
    canonSha256: z.literal(
      '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76'
    ),
    salaryCapCents: MoneyCentsZ,
    annualLimitCents: MoneyCentsZ,
    seasonInputManifest: JsonValueZ,
  })
  .strict()
  .superRefine((proof, context) => {
    if (
      proof.annualLimitCents !==
      Math.floor((proof.salaryCapCents * 515) / 10_000)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['annualLimitCents'],
        message: 'annual cash limit must equal exactly 5.15% of the Salary Cap',
      });
    }
  });

export const GovernedCashLedgerEntryZ = z
  .object({
    entryVersion: z.literal(1),
    entryId: NonEmptyStringZ,
    transactionId: NonEmptyStringZ,
    worldId: NonEmptyStringZ,
    teamId: TeamCodeZ,
    counterpartyTeamId: TeamCodeZ,
    direction: z.enum(['PAID', 'RECEIVED']),
    amountCents: MoneyCentsZ.positive(),
    salaryCapYear: z.number().int().positive(),
    transactionAt: GovernedCashZonedInstantZ,
    recordedAt: GovernedCashZonedInstantZ,
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
    proof: GovernedCashProofZ,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.teamId === entry.counterpartyTeamId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['counterpartyTeamId'],
        message: 'cash consideration must move between distinct Teams',
      });
    }
  });

export const GovernedCashLedgerZ = z
  .object({
    ledgerVersion: z.number().int().nonnegative(),
    ledgerId: NonEmptyStringZ,
    teamId: TeamCodeZ,
    entries: z.array(GovernedCashLedgerEntryZ),
  })
  .strict()
  .superRefine((ledger, context) => {
    if (ledger.ledgerVersion !== ledger.entries.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ledgerVersion'],
        message: 'ledger version must equal the immutable entry count',
      });
    }
    const entryIds = new Set<string>();
    ledger.entries.forEach((entry, index) => {
      if (entry.teamId !== ledger.teamId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'teamId'],
          message: 'ledger entry Team must match its ledger owner',
        });
      }
      if (entryIds.has(entry.entryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'entryId'],
          message: 'cash ledger entry IDs must be unique',
        });
      }
      entryIds.add(entry.entryId);
    });
  });

export const GovernedCashEvaluationZ = z
  .object({
    evaluationVersion: z.literal(1),
    status: z.enum(['PASS', 'FAIL', 'NEEDS_INPUT', 'NOT_APPLICABLE']),
    passed: z.boolean(),
    teamId: TeamCodeZ,
    salaryCapYear: z.number().int().positive().nullable(),
    transactionAt: GovernedCashZonedInstantZ.nullable(),
    cashSentCents: MoneyCentsZ.nullable(),
    cashReceivedCents: MoneyCentsZ.nullable(),
    priorPaidCents: MoneyCentsZ.nullable(),
    priorReceivedCents: MoneyCentsZ.nullable(),
    projectedPaidCents: MoneyCentsZ.nullable(),
    projectedReceivedCents: MoneyCentsZ.nullable(),
    annualLimitCents: MoneyCentsZ.nullable(),
    regularSeasonClosing: z.string().date().nullable(),
    ledgerVersion: z.number().int().nonnegative().nullable(),
    canonLeafIds: z.array(NonEmptyStringZ),
    missingInputs: z.array(NonEmptyStringZ),
    violations: z.array(NonEmptyStringZ),
    proof: GovernedCashProofZ.nullable(),
  })
  .strict()
  .superRefine((evaluation, context) => {
    const shouldPass =
      evaluation.status === 'PASS' || evaluation.status === 'NOT_APPLICABLE';
    if (evaluation.passed !== shouldPass) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passed'],
        message: 'passed must agree with the evaluation status',
      });
    }
    if (evaluation.status !== 'PASS') return;

    const requiredAuthorityFields = [
      'salaryCapYear',
      'transactionAt',
      'cashSentCents',
      'cashReceivedCents',
      'priorPaidCents',
      'priorReceivedCents',
      'projectedPaidCents',
      'projectedReceivedCents',
      'annualLimitCents',
      'regularSeasonClosing',
      'ledgerVersion',
      'proof',
    ] as const;
    requiredAuthorityFields.forEach((field) => {
      if (evaluation[field] === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `PASS requires ${field}`,
        });
      }
    });
    if (
      evaluation.canonLeafIds.length === 0 ||
      evaluation.missingInputs.length > 0 ||
      evaluation.violations.length > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASS requires complete Canon authority without missing inputs or violations',
      });
    }

    const {
      cashSentCents,
      cashReceivedCents,
      priorPaidCents,
      priorReceivedCents,
      projectedPaidCents,
      projectedReceivedCents,
      annualLimitCents,
      proof,
    } = evaluation;
    if (
      cashSentCents === null ||
      cashReceivedCents === null ||
      priorPaidCents === null ||
      priorReceivedCents === null ||
      projectedPaidCents === null ||
      projectedReceivedCents === null ||
      annualLimitCents === null ||
      proof === null
    ) {
      return;
    }

    if (
      !Number.isSafeInteger(priorPaidCents + cashSentCents) ||
      projectedPaidCents !== priorPaidCents + cashSentCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectedPaidCents'],
        message: 'projected paid cash must equal prior paid cash plus current cash sent',
      });
    }
    if (
      !Number.isSafeInteger(priorReceivedCents + cashReceivedCents) ||
      projectedReceivedCents !== priorReceivedCents + cashReceivedCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectedReceivedCents'],
        message:
          'projected received cash must equal prior received cash plus current cash received',
      });
    }
    if (proof.annualLimitCents !== annualLimitCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['annualLimitCents'],
        message: 'evaluation annual limit must match its governed proof',
      });
    }
    if (
      projectedPaidCents > annualLimitCents ||
      projectedReceivedCents > annualLimitCents
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASS projected cash totals cannot exceed the annual limit',
      });
    }
  });

export const GovernedCashSnapshotReceiptZ = z
  .object({
    teamId: TeamCodeZ,
    exists: z.boolean(),
    digest: StateDigestZ.nullable(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.exists !== (snapshot.digest !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['digest'],
        message: 'snapshot existence and digest must agree',
      });
    }
  });

export const GovernedCashReceiptZ = z
  .object({
    receiptVersion: z.literal(1),
    receiptId: NonEmptyStringZ,
    transactionId: NonEmptyStringZ,
    worldId: NonEmptyStringZ,
    salaryCapYear: z.number().int().positive(),
    transactionAt: GovernedCashZonedInstantZ,
    committedAt: GovernedCashZonedInstantZ,
    teamEvaluations: z.array(GovernedCashEvaluationZ).min(2),
    entries: z.array(GovernedCashLedgerEntryZ).min(2),
    expectedTeamSnapshots: z.array(GovernedCashSnapshotReceiptZ).min(2),
    salaryBookCashDeltas: z
      .array(
        z
          .object({
            teamId: TeamCodeZ,
            teamSalary: z.literal(0),
            apronTeamSalary: z.literal(0),
            taxSalary: z.literal(0),
          })
          .strict()
      )
      .min(2),
    tradeReceipt: JsonValueZ,
    verificationStatus: z.literal('complete'),
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
  })
  .strict()
  .superRefine((receipt, context) => {
    const addUniqueTeamIssues = (
      values: ReadonlyArray<{ teamId: string }>,
      path: 'teamEvaluations' | 'expectedTeamSnapshots' | 'salaryBookCashDeltas'
    ) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value.teamId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [path, index, 'teamId'],
            message: `${path} must contain each Team once`,
          });
        }
        seen.add(value.teamId);
      });
      return seen;
    };

    const evaluationTeams = addUniqueTeamIssues(
      receipt.teamEvaluations,
      'teamEvaluations'
    );
    const snapshotTeams = addUniqueTeamIssues(
      receipt.expectedTeamSnapshots,
      'expectedTeamSnapshots'
    );
    const salaryDeltaTeams = addUniqueTeamIssues(
      receipt.salaryBookCashDeltas,
      'salaryBookCashDeltas'
    );
    const entryIds = new Set<string>();
    const entryKeys = new Map<string, number>();
    const entryTeams = new Set<string>();
    const paidByTeam = new Map<string, number>();
    const receivedByTeam = new Map<string, number>();

    receipt.teamEvaluations.forEach((evaluation, index) => {
      if (
        evaluation.status !== 'PASS' ||
        !evaluation.passed ||
        evaluation.proof === null ||
        evaluation.salaryCapYear !== receipt.salaryCapYear ||
        evaluation.transactionAt !== receipt.transactionAt
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['teamEvaluations', index],
          message: 'receipt evaluations must be complete passing authority',
        });
      }
    });

    receipt.expectedTeamSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists || snapshot.digest === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedTeamSnapshots', index],
          message: 'governed cash requires an existing saved Team snapshot',
        });
      }
    });

    receipt.entries.forEach((entry, index) => {
      if (entryIds.has(entry.entryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'entryId'],
          message: 'receipt entry IDs must be unique',
        });
      }
      entryIds.add(entry.entryId);
      entryTeams.add(entry.teamId);
      const directionTotals =
        entry.direction === 'PAID' ? paidByTeam : receivedByTeam;
      directionTotals.set(
        entry.teamId,
        (directionTotals.get(entry.teamId) || 0) + entry.amountCents
      );
      const entryKey = [
        entry.teamId,
        entry.counterpartyTeamId,
        entry.direction,
        entry.amountCents,
        entry.salaryCapYear,
        entry.transactionAt,
      ].join('|');
      entryKeys.set(entryKey, (entryKeys.get(entryKey) || 0) + 1);
      if (
        entry.transactionId !== receipt.transactionId ||
        entry.worldId !== receipt.worldId ||
        entry.salaryCapYear !== receipt.salaryCapYear ||
        entry.transactionAt !== receipt.transactionAt
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index],
          message: 'receipt entries must belong to the receipt transaction',
        });
      }
      if (
        !evaluationTeams.has(entry.teamId) ||
        !snapshotTeams.has(entry.teamId) ||
        !salaryDeltaTeams.has(entry.teamId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'teamId'],
          message: 'every cash entry Team must have receipt authority',
        });
      }
    });

    receipt.entries.forEach((entry, index) => {
      const pairedDirection = entry.direction === 'PAID' ? 'RECEIVED' : 'PAID';
      const pairedKey = [
        entry.counterpartyTeamId,
        entry.teamId,
        pairedDirection,
        entry.amountCents,
        entry.salaryCapYear,
        entry.transactionAt,
      ].join('|');
      const entryKey = [
        entry.teamId,
        entry.counterpartyTeamId,
        entry.direction,
        entry.amountCents,
        entry.salaryCapYear,
        entry.transactionAt,
      ].join('|');
      if (entryKeys.get(pairedKey) !== entryKeys.get(entryKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index],
          message:
            'every paid cash entry must have one matching received entry',
        });
      }
    });

    receipt.teamEvaluations.forEach((evaluation, index) => {
      if (
        !entryTeams.has(evaluation.teamId) ||
        evaluation.cashSentCents !== (paidByTeam.get(evaluation.teamId) || 0) ||
        evaluation.cashReceivedCents !==
          (receivedByTeam.get(evaluation.teamId) || 0)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['teamEvaluations', index],
          message: 'receipt evaluation totals must equal its cash entries',
        });
      }
    });

    if (
      evaluationTeams.size !== entryTeams.size ||
      [...evaluationTeams].some((teamId) => !entryTeams.has(teamId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teamEvaluations'],
        message: 'receipt evaluations must cover exactly the cash-entry Teams',
      });
    }

    if (
      evaluationTeams.size !== salaryDeltaTeams.size ||
      [...evaluationTeams].some((teamId) => !salaryDeltaTeams.has(teamId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salaryBookCashDeltas'],
        message: 'salary-book cash deltas must cover every evaluated Team',
      });
    }
  });

export type GovernedCashLedger = z.infer<typeof GovernedCashLedgerZ>;
export type GovernedCashProof = z.infer<typeof GovernedCashProofZ>;
export type GovernedCashLedgerEntry = z.infer<typeof GovernedCashLedgerEntryZ>;
export type GovernedCashEvaluation = z.infer<typeof GovernedCashEvaluationZ>;
export type GovernedCashReceipt = z.infer<typeof GovernedCashReceiptZ>;
export type GovernedCashSnapshotReceipt = z.infer<
  typeof GovernedCashSnapshotReceiptZ
>;
