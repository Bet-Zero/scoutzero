/** Shared BZE-272 fixtures. All instants fall inside Salary Cap Year 2027. */

import type {
  CompletedTradeHistory,
  CompletedTradeRecord,
  ExpectedTransactionWriteSet,
  TransactionCommitManifest,
  TransactionResultReferences,
} from '@/features/architect/utils/transactionHistory';
import { createCompletedTradeHistory } from '@/features/architect/utils/transactionHistory';

export const TRANSACTION_ID = 'trade-bze272-001';
export const WORLD_ID = 'world-bze272';
export const LEDGER_ID = 'transaction-ledger-bze272';

export function emptyResults(): TransactionResultReferences {
  return {
    exception: [],
    list: [],
    rights: [],
    restriction: [],
    pick: [],
    hardCap: [],
    cash: [],
  };
}

type TransactionOverrides = Partial<CompletedTradeRecord>;

export function makeTransaction(
  overrides: TransactionOverrides = {}
): CompletedTradeRecord {
  return {
    transactionId: TRANSACTION_ID,
    transactionVersion: 1,
    transactionKind: 'completed-trade',
    worldId: WORLD_ID,
    salaryCapYear: 2027,
    tradeCallAt: '2026-08-01T15:00:00Z',
    committedAt: '2026-08-01T15:05:00Z',
    recordedAt: '2026-08-01T15:06:00Z',
    provenance: {
      sourceOperationId: 'operation-bze272-001',
      authoringIdentity: null,
    },
    recordStatus: 'current',
    supersedesTransactionVersion: null,
    canonLeafIds: ['CBA2-L06.2'],
    ...overrides,
  };
}

type WriteSetOverrides = Partial<ExpectedTransactionWriteSet>;

export function makeWriteSet(
  overrides: WriteSetOverrides = {}
): ExpectedTransactionWriteSet {
  return {
    expectedWriteSetId: 'write-set-bze272-001',
    expectedWriteSetVersion: 1,
    transactionId: TRANSACTION_ID,
    transactionVersion: 1,
    preCommitLedgers: {
      teams: [
        { ledgerId: 'team-BOS-ledger', ledgerVersion: 8 },
        { ledgerId: 'team-NYK-ledger', ledgerVersion: 11 },
      ],
      players: [{ ledgerId: 'player-001-ledger', ledgerVersion: 4 }],
    },
    expectedResults: {
      ...emptyResults(),
      exception: [{ stateId: 'exception-BOS', stateVersion: 3 }],
      pick: [{ stateId: 'pick-2028-NYK-1', stateVersion: 6 }],
      cash: [{ stateId: 'cash-BOS-2027', stateVersion: 2 }],
    },
    provenance: {
      sourceOperationId: 'operation-bze272-001',
      authoringIdentity: null,
    },
    recordStatus: 'current',
    supersedesExpectedWriteSetVersion: null,
    ...overrides,
  };
}

type ManifestOverrides = Partial<TransactionCommitManifest>;

export function makeManifest(
  overrides: ManifestOverrides = {}
): TransactionCommitManifest {
  const writeSet = makeWriteSet();
  return {
    manifestId: 'manifest-bze272-001',
    manifestVersion: 1,
    transactionId: TRANSACTION_ID,
    transactionVersion: 1,
    expectedWriteSetId: writeSet.expectedWriteSetId,
    expectedWriteSetVersion: writeSet.expectedWriteSetVersion,
    preCommitLedgers: writeSet.preCommitLedgers,
    resultingStates: writeSet.expectedResults,
    verificationStatus: 'complete',
    recordStatus: 'current',
    supersedesManifestVersion: null,
    ...overrides,
  };
}

export function makeHistory(options?: {
  readonly withWriteSet?: boolean;
  readonly withManifest?: boolean;
}): CompletedTradeHistory {
  const withWriteSet = options?.withWriteSet ?? true;
  const withManifest = options?.withManifest ?? true;
  return createCompletedTradeHistory({
    ledgerId: LEDGER_ID,
    ledgerVersion: 1,
    transactions: [makeTransaction()],
    expectedWriteSets: withWriteSet ? [makeWriteSet()] : [],
    manifests: withManifest ? [makeManifest()] : [],
  });
}
