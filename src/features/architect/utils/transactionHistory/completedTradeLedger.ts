/**
 * Immutable, versioned completed-trade records and deterministic selection.
 *
 * This is transaction history, not contract history and not a trade engine. It
 * records that an identified trade version passed Trade Call and committed; it
 * does not decide whether the trade was legal or own any resulting state.
 */

import { z } from 'zod';

import {
  CompletedTradeRecordZ,
  type CompletedTradeRecord,
} from '@/schemas/transactionEventLedger';
import {
  isSupportedSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason/governedTime';

export interface CompletedTradeLedger {
  readonly ledgerId: string;
  readonly ledgerVersion: number;
  readonly transactions: readonly CompletedTradeRecord[];
}

export interface CompletedTradeLedgerInput {
  readonly ledgerId: string;
  readonly ledgerVersion: number;
  readonly transactions?: readonly CompletedTradeRecord[];
}

export type CompletedTradeProblemKind =
  | 'missing-identity'
  | 'missing-version'
  | 'invalid-timestamp'
  | 'invalid-chronology'
  | 'invalid-salary-cap-year'
  | 'missing-provenance'
  | 'unsupported-field'
  | 'duplicate-identity'
  | 'competing-current-version'
  | 'broken-chain'
  | 'unreadable-payload';

export interface CompletedTradeProblem {
  readonly kind: CompletedTradeProblemKind;
  readonly at: string;
  readonly detail: string;
  readonly transactionIds: readonly string[];
}

export class CompletedTradeLedgerError extends Error {
  readonly problems: readonly CompletedTradeProblem[];

  constructor(problems: readonly CompletedTradeProblem[]) {
    super(
      `Invalid completed-trade ledger: ${problems
        .map((entry) => `${entry.kind} at ${entry.at}`)
        .join('; ')}`
    );
    this.name = 'CompletedTradeLedgerError';
    this.problems = Object.freeze(problems.map(freezeProblem));
  }
}

function freezeProblem(problem: CompletedTradeProblem): CompletedTradeProblem {
  return Object.freeze({
    ...problem,
    transactionIds: Object.freeze([...problem.transactionIds]),
  });
}

function problem(
  kind: CompletedTradeProblemKind,
  at: string,
  detail: string,
  transactionIds: readonly string[] = []
): CompletedTradeProblem {
  return { kind, at, detail, transactionIds };
}

export function transactionKey(
  transaction: Pick<
    CompletedTradeRecord,
    'transactionId' | 'transactionVersion'
  >
): string {
  return `${transaction.transactionId}@v${transaction.transactionVersion}`;
}

const FIELD_PROBLEM_KINDS: Readonly<Record<string, CompletedTradeProblemKind>> =
  Object.freeze({
    transactionId: 'missing-identity',
    transactionKind: 'missing-identity',
    worldId: 'missing-identity',
    transactionVersion: 'missing-version',
    supersedesTransactionVersion: 'missing-version',
    tradeCallAt: 'invalid-timestamp',
    committedAt: 'invalid-timestamp',
    recordedAt: 'invalid-timestamp',
    salaryCapYear: 'invalid-salary-cap-year',
    provenance: 'missing-provenance',
    canonLeafIds: 'missing-identity',
    recordStatus: 'missing-identity',
  });

function recordProblemFromIssue(
  at: string,
  issue: z.core.$ZodIssue,
  path: readonly PropertyKey[]
): CompletedTradeProblem {
  if (issue.code === 'unrecognized_keys') {
    return problem(
      'unsupported-field',
      at,
      `Unsupported field(s) ${issue.keys.join(', ')}.`
    );
  }

  const field = String(path[0] ?? '');
  return problem(
    FIELD_PROBLEM_KINDS[field] ?? 'missing-identity',
    field ? `${at}.${field}` : at,
    issue.message
  );
}

export function transactionProblemsFromPayloadIssues(
  issues: readonly z.core.$ZodIssue[]
): CompletedTradeProblem[] {
  return issues.flatMap((issue) => {
    const [head, index] = issue.path;
    if (head === 'transactions' && typeof index === 'number') {
      return [
        recordProblemFromIssue(
          `transactions[${index}]`,
          issue,
          issue.path.slice(2)
        ),
      ];
    }
    if (head === 'expectedWriteSets' || head === 'manifests') return [];
    if (issue.code === 'unrecognized_keys') {
      return [
        problem(
          'unsupported-field',
          'payload',
          `Unsupported field(s) ${issue.keys.join(', ')}.`
        ),
      ];
    }
    const field = String(head ?? '');
    return [
      problem(
        field === 'ledgerVersion' ? 'missing-version' : 'unreadable-payload',
        field || 'payload',
        issue.message
      ),
    ];
  });
}

function validateRecordShape(
  record: CompletedTradeRecord,
  index: number,
  problems: CompletedTradeProblem[]
): boolean {
  const at = `transactions[${index}]`;
  const parsed = CompletedTradeRecordZ.safeParse(record);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) =>
      problems.push(recordProblemFromIssue(at, issue, issue.path))
    );
    return false;
  }

  const key = transactionKey(record);
  (['tradeCallAt', 'committedAt', 'recordedAt'] as const).forEach((field) => {
    if (!isZonedDateTime(record[field])) {
      problems.push(
        problem(
          'invalid-timestamp',
          `${at}.${field}`,
          `${field} must be an ISO-8601 instant with an explicit Z or UTC offset.`,
          [key]
        )
      );
    }
  });

  if (!isSupportedSalaryCapYear(record.salaryCapYear)) {
    problems.push(
      problem(
        'invalid-salary-cap-year',
        `${at}.salaryCapYear`,
        'salaryCapYear must be a governed four-digit Salary Cap Year.',
        [key]
      )
    );
  } else {
    (['tradeCallAt', 'committedAt'] as const).forEach((field) => {
      if (
        isZonedDateTime(record[field]) &&
        !isWithinSalaryCapYear(record[field], record.salaryCapYear)
      ) {
        problems.push(
          problem(
            'invalid-salary-cap-year',
            `${at}.${field}`,
            `${field} must fall inside Salary Cap Year ${record.salaryCapYear}.`,
            [key]
          )
        );
      }
    });
  }

  const tradeCallTime = parseZonedDateTime(record.tradeCallAt);
  const committedTime = parseZonedDateTime(record.committedAt);
  const recordedTime = parseZonedDateTime(record.recordedAt);
  if (
    tradeCallTime !== null &&
    committedTime !== null &&
    committedTime < tradeCallTime
  ) {
    problems.push(
      problem(
        'invalid-chronology',
        `${at}.committedAt`,
        'A trade cannot commit before Trade Call.',
        [key]
      )
    );
  }
  if (
    committedTime !== null &&
    recordedTime !== null &&
    recordedTime < committedTime
  ) {
    problems.push(
      problem(
        'invalid-chronology',
        `${at}.recordedAt`,
        'A completed trade cannot be recorded before it committed.',
        [key]
      )
    );
  }

  if (
    record.supersedesTransactionVersion !== null &&
    record.supersedesTransactionVersion >= record.transactionVersion
  ) {
    problems.push(
      problem(
        'missing-version',
        `${at}.supersedesTransactionVersion`,
        'A correction must supersede a lower transaction version.',
        [key]
      )
    );
  }

  return true;
}

function validateVersionChains(
  records: readonly CompletedTradeRecord[],
  problems: CompletedTradeProblem[]
): void {
  const seen = new Set<string>();
  const byId = new Map<string, CompletedTradeRecord[]>();

  records.forEach((record, index) => {
    const key = transactionKey(record);
    if (seen.has(key)) {
      problems.push(
        problem(
          'duplicate-identity',
          `transactions[${index}].transactionId`,
          `${key} is declared more than once.`,
          [key]
        )
      );
    }
    seen.add(key);
    const versions = byId.get(record.transactionId) ?? [];
    versions.push(record);
    byId.set(record.transactionId, versions);
  });

  byId.forEach((versions, transactionId) => {
    const ordered = [...versions].sort(
      (a, b) => a.transactionVersion - b.transactionVersion
    );
    const current = ordered.filter((entry) => entry.recordStatus === 'current');
    if (current.length !== 1) {
      problems.push(
        problem(
          'competing-current-version',
          `transactions.${transactionId}.recordStatus`,
          `A retained transaction must have exactly one current version; found ${current.length}.`,
          ordered.map(transactionKey)
        )
      );
    }

    ordered.forEach((record, position) => {
      const prior = ordered[position - 1];
      const expectedVersion = position + 1;
      if (record.transactionVersion !== expectedVersion) {
        problems.push(
          problem(
            'broken-chain',
            `transactions.${transactionId}.transactionVersion`,
            `${transactionKey(record)} is detached; version ${expectedVersion} is required at this chain position.`,
            ordered.map(transactionKey)
          )
        );
      }

      if (!prior) {
        if (record.supersedesTransactionVersion !== null) {
          problems.push(
            problem(
              'broken-chain',
              `transactions.${transactionId}.supersedesTransactionVersion`,
              'Transaction version 1 must not name a superseded version.',
              [transactionKey(record)]
            )
          );
        }
        return;
      }

      if (record.worldId !== prior.worldId) {
        problems.push(
          problem(
            'duplicate-identity',
            `transactions.${transactionId}.worldId`,
            'Every version of a transaction identity must remain in one world.',
            [transactionKey(prior), transactionKey(record)]
          )
        );
      }
      if (record.supersedesTransactionVersion !== prior.transactionVersion) {
        problems.push(
          problem(
            'broken-chain',
            `transactions.${transactionId}.supersedesTransactionVersion`,
            `${transactionKey(record)} must directly supersede ${transactionKey(prior)}.`,
            [transactionKey(prior), transactionKey(record)]
          )
        );
      }
      if (prior.recordStatus !== 'superseded') {
        problems.push(
          problem(
            'competing-current-version',
            `transactions.${transactionId}.recordStatus`,
            `${transactionKey(prior)} must be superseded by the next version.`,
            [transactionKey(prior), transactionKey(record)]
          )
        );
      }
      if (Date.parse(record.recordedAt) < Date.parse(prior.recordedAt)) {
        problems.push(
          problem(
            'invalid-chronology',
            `transactions.${transactionId}.recordedAt`,
            'A later transaction version cannot be recorded before its predecessor.',
            [transactionKey(prior), transactionKey(record)]
          )
        );
      }
    });

    const last = ordered[ordered.length - 1];
    if (last && last.recordStatus !== 'current') {
      problems.push(
        problem(
          'competing-current-version',
          `transactions.${transactionId}.recordStatus`,
          'Only the reachable tip of a transaction version chain may be current.',
          ordered.map(transactionKey)
        )
      );
    }
  });
}

function freezeRecord(record: CompletedTradeRecord): CompletedTradeRecord {
  return Object.freeze({
    ...record,
    provenance: Object.freeze({ ...record.provenance }),
    canonLeafIds: Object.freeze([...record.canonLeafIds]),
  });
}

export function createCompletedTradeLedger(
  input: CompletedTradeLedgerInput
): CompletedTradeLedger {
  const problems: CompletedTradeProblem[] = [];
  if (typeof input?.ledgerId !== 'string' || input.ledgerId.trim() === '') {
    problems.push(
      problem(
        'missing-identity',
        'ledgerId',
        'A non-empty ledger ID is required.'
      )
    );
  }
  if (!Number.isInteger(input?.ledgerVersion) || input.ledgerVersion < 1) {
    problems.push(
      problem(
        'missing-version',
        'ledgerVersion',
        'Ledger version must be a positive integer.'
      )
    );
  }

  const records = input?.transactions ?? [];
  const sound = records.filter((record, index) =>
    validateRecordShape(record, index, problems)
  );
  validateVersionChains(sound, problems);
  if (problems.length > 0) throw new CompletedTradeLedgerError(problems);

  const ordered = [...records].sort((a, b) => {
    if (a.transactionId !== b.transactionId) {
      return a.transactionId < b.transactionId ? -1 : 1;
    }
    return a.transactionVersion - b.transactionVersion;
  });

  return Object.freeze({
    ledgerId: input.ledgerId,
    ledgerVersion: input.ledgerVersion,
    transactions: Object.freeze(ordered.map(freezeRecord)),
  });
}

export interface CompletedTradeLedgerValidation {
  readonly state: 'valid' | 'invalid';
  readonly ledger: CompletedTradeLedger | null;
  readonly problems: readonly CompletedTradeProblem[];
}

export function validateCompletedTradeLedger(
  input: CompletedTradeLedgerInput
): CompletedTradeLedgerValidation {
  try {
    return Object.freeze({
      state: 'valid' as const,
      ledger: createCompletedTradeLedger(input),
      problems: Object.freeze([]),
    });
  } catch (error) {
    if (!(error instanceof CompletedTradeLedgerError)) throw error;
    return Object.freeze({
      state: 'invalid' as const,
      ledger: null,
      problems: Object.freeze([...error.problems]),
    });
  }
}

export function appendCompletedTradeRecords(
  ledger: CompletedTradeLedger,
  records: readonly CompletedTradeRecord[]
): CompletedTradeLedger {
  return createCompletedTradeLedger({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion + 1,
    transactions: [...ledger.transactions, ...records],
  });
}

export function reviseCompletedTradeRecord(
  ledger: CompletedTradeLedger,
  revision: CompletedTradeRecord
): CompletedTradeLedger {
  const prior = ledger.transactions.find(
    (record) =>
      record.transactionId === revision?.transactionId &&
      record.recordStatus === 'current'
  );
  if (
    !prior ||
    revision.transactionVersion !== prior.transactionVersion + 1 ||
    revision.supersedesTransactionVersion !== prior.transactionVersion ||
    revision.recordStatus !== 'current'
  ) {
    throw new CompletedTradeLedgerError([
      problem(
        'broken-chain',
        'revision',
        'A correction must be the next current version and directly supersede the existing current version.',
        prior ? [transactionKey(prior)] : []
      ),
    ]);
  }

  return createCompletedTradeLedger({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion + 1,
    transactions: [
      ...ledger.transactions.map((record) =>
        record === prior
          ? { ...record, recordStatus: 'superseded' as const }
          : record
      ),
      revision,
    ],
  });
}

export function selectCurrentCompletedTradeVersion(
  ledger: CompletedTradeLedger,
  transactionId: string
): CompletedTradeRecord | null {
  return (
    ledger.transactions.find(
      (record) =>
        record.transactionId === transactionId &&
        record.recordStatus === 'current'
    ) ?? null
  );
}

export function selectCompletedTradeVersionAsOf(
  ledger: CompletedTradeLedger,
  transactionId: string,
  asOfDate: string
): CompletedTradeRecord | null {
  const asOfTime = parseZonedDateTime(asOfDate);
  if (asOfTime === null) return null;

  return (
    [...ledger.transactions]
      .filter(
        (record) =>
          record.transactionId === transactionId &&
          Date.parse(record.recordedAt) <= asOfTime
      )
      .sort((a, b) => b.transactionVersion - a.transactionVersion)[0] ?? null
  );
}

export function selectCompletedTradesAsOf(
  ledger: CompletedTradeLedger,
  asOfDate: string
): readonly CompletedTradeRecord[] {
  if (!isZonedDateTime(asOfDate)) return Object.freeze([]);
  const transactionIds = [
    ...new Set(ledger.transactions.map((r) => r.transactionId)),
  ].sort();
  return Object.freeze(
    transactionIds
      .map((id) => selectCompletedTradeVersionAsOf(ledger, id, asOfDate))
      .filter((record): record is CompletedTradeRecord => record !== null)
  );
}
