/** Public boundary for BZE-272's immutable completed-trade history. */

export {
  CompletedTradeRecordZ,
  ExpectedTransactionWriteSetZ,
  PreCommitLedgerReferencesZ,
  ResultStateReferenceZ,
  TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION,
  TRANSACTION_RESULT_CATEGORIES,
  TransactionCommitManifestZ,
  TransactionEventLedgerPayloadZ,
  TransactionProvenanceZ,
  TransactionRecordStatusZ,
  TransactionResultReferencesZ,
  VersionedLedgerReferenceZ,
} from '@/schemas/transactionEventLedger';
export type {
  CompletedTradeRecord,
  ExpectedTransactionWriteSet,
  PreCommitLedgerReferences,
  ResultStateReference,
  TransactionCommitManifest,
  TransactionEventLedgerPayload,
  TransactionProvenance,
  TransactionRecordStatus,
  TransactionResultCategory,
  TransactionResultReferences,
  VersionedLedgerReference,
} from '@/schemas/transactionEventLedger';

export {
  appendCompletedTradeRecords,
  CompletedTradeLedgerError,
  createCompletedTradeLedger,
  reviseCompletedTradeRecord,
  selectCompletedTradesAsOf,
  selectCompletedTradeVersionAsOf,
  selectCurrentCompletedTradeVersion,
  transactionKey,
  validateCompletedTradeLedger,
} from './completedTradeLedger';
export type {
  CompletedTradeLedger,
  CompletedTradeLedgerInput,
  CompletedTradeLedgerValidation,
  CompletedTradeProblem,
  CompletedTradeProblemKind,
} from './completedTradeLedger';

export {
  appendExpectedTransactionWriteSet,
  appendVerifiedTransactionCommitManifest,
  createCompletedTradeHistory,
  selectCurrentTransactionCommitManifest,
  TransactionCommitManifestError,
  verifyTransactionCommitManifest,
} from './transactionCommitManifest';
export type {
  CommitManifestVerification,
  CompletedTradeHistory,
  CompletedTradeHistoryInput,
  CurrentCommitManifestSelection,
  TransactionCommitProblem,
  TransactionCommitProblemKind,
} from './transactionCommitManifest';

export {
  deserializeTransactionEventLedger,
  readTransactionEventLedger,
  serializeTransactionEventLedger,
  toTransactionEventLedgerPayload,
  TransactionEventLedgerPayloadError,
  TransactionHistoryReadError,
} from './transactionEventSerialization';
export type {
  TransactionHistoryReadProblem,
  TransactionHistoryReadResult,
} from './transactionEventSerialization';
