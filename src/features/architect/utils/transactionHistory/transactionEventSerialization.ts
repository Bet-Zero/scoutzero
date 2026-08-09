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

export type TransactionHistoryReadProblem =
  | { readonly source: 'transaction'; readonly detail: string }
  | { readonly source: 'manifest'; readonly detail: string }
  | { readonly source: 'payload'; readonly detail: string };

export class TransactionHistoryReadError extends Error {
  readonly problems: readonly TransactionHistoryReadProblem[];

  constructor(problems: readonly TransactionHistoryReadProblem[]) {
    super('Transaction event ledger payload has multiple validation failures.');
    this.name = 'TransactionHistoryReadError';
    this.problems = Object.freeze(
      problems.map((entry) => Object.freeze(entry))
    );
  }
}

function copyJsonCollection<T>(values: readonly T[]): T[] {
  // Ledger contracts are JSON-only. This copy retains their established key
  // order while allowing the canonical schema to validate every current field.
  return JSON.parse(JSON.stringify(values)) as T[];
}

export function toTransactionEventLedgerPayload(
  history: CompletedTradeHistory
): TransactionEventLedgerPayload {
  return TransactionEventLedgerPayloadZ.parse({
    payloadVersion: TRANSACTION_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId: history.ledgerId,
    ledgerVersion: history.ledgerVersion,
    transactions: copyJsonCollection(history.transactions),
    expectedWriteSets: copyJsonCollection(history.expectedWriteSets),
    manifests: copyJsonCollection(history.manifests),
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
    if (transactionProblems.length > 0 && commitProblems.length > 0) {
      throw new TransactionHistoryReadError([
        ...transactionProblems.map((entry) => ({
          source: 'transaction' as const,
          detail: `${entry.kind} at ${entry.at}: ${entry.detail}`,
        })),
        ...commitProblems.map((entry) => ({
          source: 'manifest' as const,
          detail: `${entry.kind} at ${entry.at}: ${entry.detail}`,
        })),
      ]);
    }
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
    if (error instanceof TransactionHistoryReadError) {
      problems = [...error.problems];
    } else if (error instanceof CompletedTradeLedgerError) {
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
