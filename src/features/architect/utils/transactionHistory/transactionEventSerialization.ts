/**
 * Deterministic wire form for the completed-trade ledger and commit evidence.
 *
 * This is serialization only, not production persistence. Untrusted JSON is
 * parsed through the same canonical Zod contracts used by in-memory inputs and
 * then through the same relational constructors.
 */

import {
  TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION,
  TransactionEventLedgerPayloadZ,
  type TransactionEventLedgerPayload,
} from '@/schemas/transactionEventLedger';
import {
  CompletedTradeLedgerError,
  transactionProblemsFromPayloadIssues,
} from './completedTradeLedger';
import {
  commitProblemsFromPayloadIssues,
  createCompletedTradeHistory,
  TransactionCommitManifestError,
  type CompletedTradeHistory,
  type TransactionCommitProblem,
} from './transactionCommitManifest';

export class TransactionEventLedgerPayloadError extends Error {
  constructor(detail: string) {
    super(`Unreadable transaction event ledger payload: ${detail}`);
    this.name = 'TransactionEventLedgerPayloadError';
  }
}

export function toTransactionEventLedgerPayload(
  history: CompletedTradeHistory
): TransactionEventLedgerPayload {
  return TransactionEventLedgerPayloadZ.parse({
    payloadVersion: TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId: history.ledgerId,
    ledgerVersion: history.ledgerVersion,
    transactions: history.transactions.map((transaction) => ({
      transactionId: transaction.transactionId,
      transactionVersion: transaction.transactionVersion,
      transactionKind: transaction.transactionKind,
      worldId: transaction.worldId,
      salaryCapYear: transaction.salaryCapYear,
      tradeCallAt: transaction.tradeCallAt,
      committedAt: transaction.committedAt,
      recordedAt: transaction.recordedAt,
      provenance: {
        sourceOperationId: transaction.provenance.sourceOperationId,
        authoringIdentity: transaction.provenance.authoringIdentity,
      },
      recordStatus: transaction.recordStatus,
      supersedesTransactionVersion: transaction.supersedesTransactionVersion,
      canonLeafIds: [...transaction.canonLeafIds],
    })),
    expectedWriteSets: history.expectedWriteSets.map((writeSet) => ({
      expectedWriteSetId: writeSet.expectedWriteSetId,
      expectedWriteSetVersion: writeSet.expectedWriteSetVersion,
      transactionId: writeSet.transactionId,
      transactionVersion: writeSet.transactionVersion,
      preCommitLedgers: {
        teams: writeSet.preCommitLedgers.teams.map((reference) => ({
          ledgerId: reference.ledgerId,
          ledgerVersion: reference.ledgerVersion,
        })),
        players: writeSet.preCommitLedgers.players.map((reference) => ({
          ledgerId: reference.ledgerId,
          ledgerVersion: reference.ledgerVersion,
        })),
      },
      expectedResults: Object.fromEntries(
        Object.entries(writeSet.expectedResults).map(([category, values]) => [
          category,
          values.map((reference) => ({
            stateId: reference.stateId,
            stateVersion: reference.stateVersion,
          })),
        ])
      ),
      provenance: {
        sourceOperationId: writeSet.provenance.sourceOperationId,
        authoringIdentity: writeSet.provenance.authoringIdentity,
      },
      recordStatus: writeSet.recordStatus,
      supersedesExpectedWriteSetVersion:
        writeSet.supersedesExpectedWriteSetVersion,
    })),
    manifests: history.manifests.map((manifest) => ({
      manifestId: manifest.manifestId,
      manifestVersion: manifest.manifestVersion,
      transactionId: manifest.transactionId,
      transactionVersion: manifest.transactionVersion,
      expectedWriteSetId: manifest.expectedWriteSetId,
      expectedWriteSetVersion: manifest.expectedWriteSetVersion,
      preCommitLedgers: {
        teams: manifest.preCommitLedgers.teams.map((reference) => ({
          ledgerId: reference.ledgerId,
          ledgerVersion: reference.ledgerVersion,
        })),
        players: manifest.preCommitLedgers.players.map((reference) => ({
          ledgerId: reference.ledgerId,
          ledgerVersion: reference.ledgerVersion,
        })),
      },
      resultingStates: Object.fromEntries(
        Object.entries(manifest.resultingStates).map(([category, values]) => [
          category,
          values.map((reference) => ({
            stateId: reference.stateId,
            stateVersion: reference.stateVersion,
          })),
        ])
      ),
      verificationStatus: manifest.verificationStatus,
      recordStatus: manifest.recordStatus,
      supersedesManifestVersion: manifest.supersedesManifestVersion,
    })),
  });
}

export function serializeTransactionEventLedger(
  history: CompletedTradeHistory
): string {
  return JSON.stringify(toTransactionEventLedgerPayload(history));
}

function readEnvelope(serialized: string): Record<string, unknown> {
  if (typeof serialized !== 'string' || serialized.trim() === '') {
    throw new TransactionEventLedgerPayloadError('payload is empty');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new TransactionEventLedgerPayloadError('payload is not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TransactionEventLedgerPayloadError('payload is not an object');
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.payloadVersion !== TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION) {
    throw new TransactionEventLedgerPayloadError(
      `payload version ${String(envelope.payloadVersion)} is not supported`
    );
  }
  for (const field of ['transactions', 'expectedWriteSets', 'manifests']) {
    if (!Array.isArray(envelope[field])) {
      throw new TransactionEventLedgerPayloadError(
        `payload has no ${field} array`
      );
    }
  }
  return envelope;
}

function parsePayload(serialized: string): TransactionEventLedgerPayload {
  const envelope = readEnvelope(serialized);
  const parsed = TransactionEventLedgerPayloadZ.safeParse(envelope);
  if (!parsed.success) {
    const transactionProblems = transactionProblemsFromPayloadIssues(
      parsed.error.issues
    );
    const commitProblems = commitProblemsFromPayloadIssues(parsed.error.issues);
    if (transactionProblems.length > 0) {
      throw new CompletedTradeLedgerError(transactionProblems);
    }
    throw new TransactionCommitManifestError(commitProblems);
  }
  return parsed.data;
}

export function deserializeTransactionEventLedger(
  serialized: string
): CompletedTradeHistory {
  const payload = parsePayload(serialized);
  return createCompletedTradeHistory({
    ledgerId: payload.ledgerId,
    ledgerVersion: payload.ledgerVersion,
    transactions: payload.transactions,
    expectedWriteSets: payload.expectedWriteSets,
    manifests: payload.manifests,
  });
}

export type TransactionHistoryReadProblem =
  | { readonly source: 'transaction'; readonly detail: string }
  | { readonly source: 'manifest'; readonly detail: string }
  | { readonly source: 'payload'; readonly detail: string };

export type TransactionHistoryReadResult =
  | {
      readonly state: 'valid';
      readonly history: CompletedTradeHistory;
      readonly problems: readonly [];
    }
  | {
      readonly state: 'invalid';
      readonly history: null;
      readonly problems: readonly TransactionHistoryReadProblem[];
    };

export function readTransactionEventLedger(
  serialized: string
): TransactionHistoryReadResult {
  try {
    return Object.freeze({
      state: 'valid' as const,
      history: deserializeTransactionEventLedger(serialized),
      problems: Object.freeze([]) as readonly [],
    });
  } catch (error) {
    let problems: TransactionHistoryReadProblem[];
    if (error instanceof CompletedTradeLedgerError) {
      problems = error.problems.map((entry) => ({
        source: 'transaction' as const,
        detail: `${entry.kind} at ${entry.at}: ${entry.detail}`,
      }));
    } else if (error instanceof TransactionCommitManifestError) {
      problems = error.problems.map((entry: TransactionCommitProblem) => ({
        source: 'manifest' as const,
        detail: `${entry.kind} at ${entry.at}: ${entry.detail}`,
      }));
    } else {
      problems = [
        {
          source: 'payload' as const,
          detail:
            error instanceof Error ? error.message : 'payload is unreadable',
        },
      ];
    }
    return Object.freeze({
      state: 'invalid' as const,
      history: null,
      problems: Object.freeze(problems),
    });
  }
}
