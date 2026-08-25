import { z } from 'zod';
import { JsonValueZ } from './common';

const NonEmptyStringZ = z.string().trim().min(1);
const TeamCodeZ = z
  .string()
  .trim()
  .min(2)
  .max(5)
  .regex(/^[A-Z0-9]{2,5}$/, 'must be a canonical uppercase Team code');
const StateDigestZ = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const ZonedInstantZ = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ) && Number.isFinite(Date.parse(value)),
    { message: 'must be an ISO-8601 instant with an explicit UTC offset' }
  );
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
  .strict();

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
    transactionAt: ZonedInstantZ,
    recordedAt: ZonedInstantZ,
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
    transactionAt: ZonedInstantZ.nullable(),
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
  });

const CashSnapshotReceiptZ = z
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
    transactionAt: ZonedInstantZ,
    committedAt: ZonedInstantZ,
    teamEvaluations: z.array(GovernedCashEvaluationZ).min(2),
    entries: z.array(GovernedCashLedgerEntryZ).min(2),
    expectedTeamSnapshots: z.array(CashSnapshotReceiptZ).min(2),
    salaryBooks: z
      .array(
        z
          .object({
            teamId: TeamCodeZ,
            before: JsonValueZ,
            after: JsonValueZ,
          })
          .strict()
      )
      .min(2),
    tradeReceipt: JsonValueZ,
    verificationStatus: z.literal('complete'),
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
  })
  .strict();

export type GovernedCashLedger = z.infer<typeof GovernedCashLedgerZ>;
export type GovernedCashProof = z.infer<typeof GovernedCashProofZ>;
export type GovernedCashLedgerEntry = z.infer<typeof GovernedCashLedgerEntryZ>;
export type GovernedCashEvaluation = z.infer<typeof GovernedCashEvaluationZ>;
export type GovernedCashReceipt = z.infer<typeof GovernedCashReceiptZ>;
