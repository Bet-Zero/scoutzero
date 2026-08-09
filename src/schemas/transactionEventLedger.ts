/**
 * Canonical runtime contracts for the immutable completed-trade history path.
 *
 * BZE-272 establishes a transaction record and commit receipt boundary without
 * connecting it to the mutable trade or persistence paths. Every object is
 * strict: an omitted result category is different from an explicitly empty
 * category, and an unknown key is rejected instead of silently discarded.
 */

import { z } from 'zod';

export const TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION = 1;

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const PositiveVersionZ = z.number().int().min(1);
const ProvenanceIdentityZ = NonEmptyStringZ.nullable();

export const TransactionRecordStatusZ = z.enum(['current', 'superseded']);

export const TransactionProvenanceZ = z
  .strictObject({
    sourceOperationId: ProvenanceIdentityZ,
    authoringIdentity: ProvenanceIdentityZ,
  })
  .superRefine((provenance, ctx) => {
    if (
      provenance.sourceOperationId === null &&
      provenance.authoringIdentity === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceOperationId'],
        message:
          'provenance must retain a source operation or authoring identity',
      });
    }
  });

export const CompletedTradeRecordZ = z.strictObject({
  transactionId: NonEmptyStringZ,
  transactionVersion: PositiveVersionZ,
  transactionKind: z.literal('completed-trade'),
  worldId: NonEmptyStringZ,
  salaryCapYear: z.number().int(),
  tradeCallAt: z.string(),
  committedAt: z.string(),
  recordedAt: z.string(),
  provenance: TransactionProvenanceZ,
  recordStatus: TransactionRecordStatusZ,
  supersedesTransactionVersion: PositiveVersionZ.nullable(),
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
});

export const VersionedLedgerReferenceZ = z.strictObject({
  ledgerId: NonEmptyStringZ,
  ledgerVersion: PositiveVersionZ,
});

/**
 * Both keys are required even when one category is explicitly empty. The
 * transaction layer records versions supplied by the direct state owners; it
 * does not inspect or manufacture those ledgers.
 */
export const PreCommitLedgerReferencesZ = z.strictObject({
  teams: z.array(VersionedLedgerReferenceZ),
  players: z.array(VersionedLedgerReferenceZ),
});

export const ResultStateReferenceZ = z.strictObject({
  stateId: NonEmptyStringZ,
  stateVersion: PositiveVersionZ,
});

export const TRANSACTION_RESULT_CATEGORIES = [
  'exception',
  'list',
  'rights',
  'restriction',
  'pick',
  'hardCap',
  'cash',
] as const;

const TransactionResultReferencesShape = Object.fromEntries(
  TRANSACTION_RESULT_CATEGORIES.map((category) => [
    category,
    z.array(ResultStateReferenceZ),
  ])
) as {
  [K in (typeof TRANSACTION_RESULT_CATEGORIES)[number]]: z.ZodArray<
    typeof ResultStateReferenceZ
  >;
};

/**
 * Every category is mandatory. `[]` says the authenticated expected write-set
 * expects no output in that category; absence says the input is incomplete and
 * cannot produce a manifest.
 */
export const TransactionResultReferencesZ = z.strictObject(
  TransactionResultReferencesShape
);

export const ExpectedTransactionWriteSetZ = z.strictObject({
  expectedWriteSetId: NonEmptyStringZ,
  expectedWriteSetVersion: PositiveVersionZ,
  transactionId: NonEmptyStringZ,
  transactionVersion: PositiveVersionZ,
  preCommitLedgers: PreCommitLedgerReferencesZ,
  expectedResults: TransactionResultReferencesZ,
  provenance: TransactionProvenanceZ,
  recordStatus: TransactionRecordStatusZ,
  supersedesExpectedWriteSetVersion: PositiveVersionZ.nullable(),
});

/** A valid manifest is always complete; there is no partial status. */
export const TransactionCommitManifestZ = z.strictObject({
  manifestId: NonEmptyStringZ,
  manifestVersion: PositiveVersionZ,
  transactionId: NonEmptyStringZ,
  transactionVersion: PositiveVersionZ,
  expectedWriteSetId: NonEmptyStringZ,
  expectedWriteSetVersion: PositiveVersionZ,
  preCommitLedgers: PreCommitLedgerReferencesZ,
  resultingStates: TransactionResultReferencesZ,
  verificationStatus: z.literal('complete'),
  recordStatus: TransactionRecordStatusZ,
  supersedesManifestVersion: PositiveVersionZ.nullable(),
});

export const TransactionEventLedgerPayloadZ = z.strictObject({
  payloadVersion: z.literal(TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION),
  ledgerId: NonEmptyStringZ,
  ledgerVersion: PositiveVersionZ,
  transactions: z.array(CompletedTradeRecordZ),
  expectedWriteSets: z.array(ExpectedTransactionWriteSetZ),
  manifests: z.array(TransactionCommitManifestZ),
});

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type TransactionRecordStatus = z.infer<typeof TransactionRecordStatusZ>;
export type TransactionProvenance = DeepReadonly<
  z.infer<typeof TransactionProvenanceZ>
>;
export type CompletedTradeRecord = DeepReadonly<
  z.infer<typeof CompletedTradeRecordZ>
>;
export type VersionedLedgerReference = DeepReadonly<
  z.infer<typeof VersionedLedgerReferenceZ>
>;
export type PreCommitLedgerReferences = DeepReadonly<
  z.infer<typeof PreCommitLedgerReferencesZ>
>;
export type ResultStateReference = DeepReadonly<
  z.infer<typeof ResultStateReferenceZ>
>;
export type TransactionResultReferences = DeepReadonly<
  z.infer<typeof TransactionResultReferencesZ>
>;
export type TransactionResultCategory =
  (typeof TRANSACTION_RESULT_CATEGORIES)[number];
export type ExpectedTransactionWriteSet = DeepReadonly<
  z.infer<typeof ExpectedTransactionWriteSetZ>
>;
export type TransactionCommitManifest = DeepReadonly<
  z.infer<typeof TransactionCommitManifestZ>
>;
export type TransactionEventLedgerPayload = DeepReadonly<
  z.infer<typeof TransactionEventLedgerPayloadZ>
>;
