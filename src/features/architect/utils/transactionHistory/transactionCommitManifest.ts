/**
 * Exact commit-manifest verification for immutable completed-trade records.
 *
 * The direct state owners authenticate an expected write-set and return their
 * own versioned state references. This boundary compares those references; it
 * does not calculate, persist, or repair any downstream state. Until every
 * required input is available, the correct state is no current manifest.
 */

import { z } from 'zod';

import {
  ExpectedTransactionWriteSetZ,
  TRANSACTION_RESULT_CATEGORIES,
  TransactionCommitManifestZ,
  type ExpectedTransactionWriteSet,
  type PreCommitLedgerReferences,
  type ResultStateReference,
  type TransactionCommitManifest,
  type TransactionResultCategory,
  type TransactionResultReferences,
  type VersionedLedgerReference,
} from '@/schemas/transactionEventLedger';
import {
  createCompletedTradeLedger,
  type CompletedTradeLedger,
  type CompletedTradeLedgerInput,
} from './completedTradeLedger';

export interface CompletedTradeHistoryInput extends CompletedTradeLedgerInput {
  readonly expectedWriteSets?: readonly ExpectedTransactionWriteSet[];
  readonly manifests?: readonly TransactionCommitManifest[];
}

export interface CompletedTradeHistory extends CompletedTradeLedger {
  readonly expectedWriteSets: readonly ExpectedTransactionWriteSet[];
  readonly manifests: readonly TransactionCommitManifest[];
}

export type TransactionCommitProblemKind =
  | 'invalid-shape'
  | 'unsupported-field'
  | 'duplicate-identity'
  | 'broken-chain'
  | 'missing-transaction'
  | 'missing-write-set'
  | 'missing-manifest'
  | 'competing-current-write-set'
  | 'competing-current-manifest'
  | 'missing-result'
  | 'unexpected-result'
  | 'duplicate-result'
  | 'conflicting-version'
  | 'precommit-mismatch'
  | 'unversioned-result';

export interface TransactionCommitProblem {
  readonly kind: TransactionCommitProblemKind;
  readonly at: string;
  readonly detail: string;
  readonly identities: readonly string[];
}

export class TransactionCommitManifestError extends Error {
  readonly problems: readonly TransactionCommitProblem[];

  constructor(problems: readonly TransactionCommitProblem[]) {
    super(
      `Invalid transaction commit state: ${problems
        .map((entry) => `${entry.kind} at ${entry.at}`)
        .join('; ')}`
    );
    this.name = 'TransactionCommitManifestError';
    this.problems = Object.freeze(
      problems.map((entry) =>
        Object.freeze({
          ...entry,
          identities: Object.freeze([...entry.identities]),
        })
      )
    );
  }
}

function problem(
  kind: TransactionCommitProblemKind,
  at: string,
  detail: string,
  identities: readonly string[] = []
): TransactionCommitProblem {
  return { kind, at, detail, identities };
}

function writeSetKey(
  writeSet: Pick<
    ExpectedTransactionWriteSet,
    'expectedWriteSetId' | 'expectedWriteSetVersion'
  >
): string {
  return `${writeSet.expectedWriteSetId}@v${writeSet.expectedWriteSetVersion}`;
}

function manifestKey(
  manifest: Pick<TransactionCommitManifest, 'manifestId' | 'manifestVersion'>
): string {
  return `${manifest.manifestId}@v${manifest.manifestVersion}`;
}

function transactionVersionKey(
  value: Pick<
    ExpectedTransactionWriteSet | TransactionCommitManifest,
    'transactionId' | 'transactionVersion'
  >
): string {
  return `${value.transactionId}@v${value.transactionVersion}`;
}

function shapeProblems(
  at: string,
  issues: readonly z.core.$ZodIssue[]
): TransactionCommitProblem[] {
  return issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return problem(
        'unsupported-field',
        at,
        `Unsupported field(s) ${issue.keys.join(', ')}.`
      );
    }
    const relative = issue.path.map(String).join('.');
    const path = relative ? `${at}.${relative}` : at;
    const kind = issue.path.includes('stateVersion')
      ? 'unversioned-result'
      : issue.path.some((entry) =>
            TRANSACTION_RESULT_CATEGORIES.includes(
              entry as TransactionResultCategory
            )
          )
        ? 'missing-result'
        : 'invalid-shape';
    return problem(kind, path, issue.message);
  });
}

export function commitProblemsFromPayloadIssues(
  issues: readonly z.core.$ZodIssue[]
): TransactionCommitProblem[] {
  return issues.flatMap((issue) => {
    const [head, index] = issue.path;
    if (
      (head === 'expectedWriteSets' || head === 'manifests') &&
      typeof index === 'number'
    ) {
      return shapeProblems(`${String(head)}[${index}]`, [
        { ...issue, path: issue.path.slice(2) } as z.core.$ZodIssue,
      ]);
    }
    if (head === 'transactions') return [];
    return shapeProblems('payload', [issue]);
  });
}

function referenceKey(reference: ResultStateReference): string {
  return `${reference.stateId}@v${reference.stateVersion}`;
}

function ledgerReferenceKey(reference: VersionedLedgerReference): string {
  return `${reference.ledgerId}@v${reference.ledgerVersion}`;
}

function compareString(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareVersionedIdentity(
  firstId: string,
  firstVersion: number,
  secondId: string,
  secondVersion: number
): number {
  const identityOrder = compareString(firstId, secondId);
  return identityOrder === 0 ? firstVersion - secondVersion : identityOrder;
}

function sortedResultReferences(
  references: readonly ResultStateReference[]
): ResultStateReference[] {
  return [...references].sort((a, b) =>
    compareString(referenceKey(a), referenceKey(b))
  );
}

function sortedLedgerReferences(
  references: readonly VersionedLedgerReference[]
): VersionedLedgerReference[] {
  return [...references].sort((a, b) =>
    compareString(ledgerReferenceKey(a), ledgerReferenceKey(b))
  );
}

function duplicateKeys<T>(
  values: readonly T[],
  keyOf: (value: T) => string
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    const key = keyOf(value);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  });
  return [...duplicates].sort();
}

function validateReferenceCollection(
  references: TransactionResultReferences,
  at: string,
  problems: TransactionCommitProblem[]
): void {
  TRANSACTION_RESULT_CATEGORIES.forEach((category) => {
    const duplicateIds = duplicateKeys(
      references[category],
      (reference) => reference.stateId
    );
    if (duplicateIds.length > 0) {
      problems.push(
        problem(
          'duplicate-result',
          `${at}.${category}`,
          `A result identity may appear only once in a category: ${duplicateIds.join(', ')}.`,
          duplicateIds
        )
      );
    }
  });
}

function validatePreCommitReferences(
  references: PreCommitLedgerReferences,
  at: string,
  problems: TransactionCommitProblem[]
): void {
  (['teams', 'players'] as const).forEach((category) => {
    const duplicateIds = duplicateKeys(
      references[category],
      (reference) => reference.ledgerId
    );
    if (duplicateIds.length > 0) {
      problems.push(
        problem(
          'duplicate-identity',
          `${at}.${category}`,
          `A pre-commit ledger identity may appear only once: ${duplicateIds.join(', ')}.`,
          duplicateIds
        )
      );
    }
  });
}

function validateSupersessionChains<T extends { recordStatus: string }>(
  values: readonly T[],
  identityOf: (value: T) => string,
  versionOf: (value: T) => number,
  supersedesOf: (value: T) => number | null,
  keyOf: (value: T) => string,
  at: string,
  problems: TransactionCommitProblem[]
): void {
  const byId = new Map<string, T[]>();
  values.forEach((value) => {
    const grouped = byId.get(identityOf(value)) ?? [];
    grouped.push(value);
    byId.set(identityOf(value), grouped);
  });

  byId.forEach((versions, id) => {
    const ordered = [...versions].sort((a, b) => versionOf(a) - versionOf(b));
    const current = ordered.filter((value) => value.recordStatus === 'current');
    if (current.length !== 1) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.${id}.recordStatus`,
          `A retained identity must have exactly one current version; found ${current.length}.`,
          ordered.map(keyOf)
        )
      );
    }
    ordered.forEach((value, position) => {
      const prior = ordered[position - 1];
      if (versionOf(value) !== position + 1) {
        problems.push(
          problem(
            'broken-chain',
            `${at}.${id}.version`,
            `${keyOf(value)} is detached from a contiguous version chain.`,
            ordered.map(keyOf)
          )
        );
      }
      if (!prior) {
        if (supersedesOf(value) !== null) {
          problems.push(
            problem(
              'broken-chain',
              `${at}.${id}.supersedesVersion`,
              'Version 1 must not name a superseded version.',
              [keyOf(value)]
            )
          );
        }
        return;
      }
      if (supersedesOf(value) !== versionOf(prior)) {
        problems.push(
          problem(
            'broken-chain',
            `${at}.${id}.supersedesVersion`,
            `${keyOf(value)} must directly supersede ${keyOf(prior)}.`,
            [keyOf(prior), keyOf(value)]
          )
        );
      }
      if (prior.recordStatus !== 'superseded') {
        problems.push(
          problem(
            'broken-chain',
            `${at}.${id}.recordStatus`,
            `${keyOf(prior)} must be superseded by the next version.`,
            [keyOf(prior), keyOf(value)]
          )
        );
      }
    });
  });
}

function comparePreCommitLedgers(
  expected: PreCommitLedgerReferences,
  supplied: PreCommitLedgerReferences
): boolean {
  return (['teams', 'players'] as const).every((category) => {
    const expectedKeys = sortedLedgerReferences(expected[category]).map(
      ledgerReferenceKey
    );
    const suppliedKeys = sortedLedgerReferences(supplied[category]).map(
      ledgerReferenceKey
    );
    return JSON.stringify(expectedKeys) === JSON.stringify(suppliedKeys);
  });
}

function compareResults(
  expected: TransactionResultReferences,
  supplied: TransactionResultReferences,
  at: string,
  problems: TransactionCommitProblem[]
): void {
  TRANSACTION_RESULT_CATEGORIES.forEach((category) => {
    const expectedById = new Map(
      expected[category].map((reference) => [reference.stateId, reference])
    );
    const suppliedById = new Map(
      supplied[category].map((reference) => [reference.stateId, reference])
    );

    expectedById.forEach((reference, stateId) => {
      const actual = suppliedById.get(stateId);
      if (!actual) {
        problems.push(
          problem(
            'missing-result',
            `${at}.${category}`,
            `Expected ${referenceKey(reference)} but no result with that identity was supplied.`,
            [stateId]
          )
        );
      } else if (actual.stateVersion !== reference.stateVersion) {
        problems.push(
          problem(
            'conflicting-version',
            `${at}.${category}.${stateId}`,
            `Expected version ${reference.stateVersion}, received version ${actual.stateVersion}.`,
            [stateId]
          )
        );
      }
    });

    suppliedById.forEach((reference, stateId) => {
      if (!expectedById.has(stateId)) {
        problems.push(
          problem(
            'unexpected-result',
            `${at}.${category}`,
            `Unexpected result ${referenceKey(reference)} was supplied.`,
            [stateId]
          )
        );
      }
    });
  });
}

function validateWriteSets(
  ledger: CompletedTradeLedger,
  writeSets: readonly ExpectedTransactionWriteSet[],
  problems: TransactionCommitProblem[]
): ExpectedTransactionWriteSet[] {
  const sound = writeSets.filter((writeSet, index) => {
    const parsed = ExpectedTransactionWriteSetZ.safeParse(writeSet);
    if (!parsed.success) {
      problems.push(
        ...shapeProblems(`expectedWriteSets[${index}]`, parsed.error.issues)
      );
      return false;
    }
    validatePreCommitReferences(
      writeSet.preCommitLedgers,
      `expectedWriteSets[${index}].preCommitLedgers`,
      problems
    );
    validateReferenceCollection(
      writeSet.expectedResults,
      `expectedWriteSets[${index}].expectedResults`,
      problems
    );
    if (
      !ledger.transactions.some(
        (transaction) =>
          transaction.transactionId === writeSet.transactionId &&
          transaction.transactionVersion === writeSet.transactionVersion
      )
    ) {
      problems.push(
        problem(
          'missing-transaction',
          `expectedWriteSets[${index}].transactionId`,
          `${transactionVersionKey(writeSet)} is not present in the transaction ledger.`,
          [transactionVersionKey(writeSet)]
        )
      );
    }
    return true;
  });

  const duplicateIdentities = duplicateKeys(sound, writeSetKey);
  if (duplicateIdentities.length > 0) {
    problems.push(
      problem(
        'duplicate-identity',
        'expectedWriteSets',
        `Expected write-set versions must be unique: ${duplicateIdentities.join(', ')}.`,
        duplicateIdentities
      )
    );
  }

  validateSupersessionChains(
    sound,
    (value) => value.expectedWriteSetId,
    (value) => value.expectedWriteSetVersion,
    (value) => value.supersedesExpectedWriteSetVersion,
    writeSetKey,
    'expectedWriteSets',
    problems
  );

  const versionsByIdentity = new Map<string, ExpectedTransactionWriteSet[]>();
  sound.forEach((value) => {
    const grouped = versionsByIdentity.get(value.expectedWriteSetId) ?? [];
    grouped.push(value);
    versionsByIdentity.set(value.expectedWriteSetId, grouped);
  });
  versionsByIdentity.forEach((values, id) => {
    const transactions = new Set(values.map(transactionVersionKey));
    if (transactions.size > 1) {
      problems.push(
        problem(
          'duplicate-identity',
          `expectedWriteSets.${id}.transactionId`,
          'Every version of an expected write-set identity must belong to one transaction version.',
          values.map(writeSetKey)
        )
      );
    }
  });

  const currentByTransaction = new Map<string, ExpectedTransactionWriteSet[]>();
  sound
    .filter((value) => value.recordStatus === 'current')
    .forEach((value) => {
      const key = transactionVersionKey(value);
      const grouped = currentByTransaction.get(key) ?? [];
      grouped.push(value);
      currentByTransaction.set(key, grouped);
    });
  currentByTransaction.forEach((values, key) => {
    if (values.length > 1) {
      problems.push(
        problem(
          'competing-current-write-set',
          `expectedWriteSets.${key}`,
          `A transaction version may have at most one current expected write-set; found ${values.length}.`,
          values.map(writeSetKey)
        )
      );
    }
  });
  return sound;
}

function validateManifests(
  ledger: CompletedTradeLedger,
  writeSets: readonly ExpectedTransactionWriteSet[],
  manifests: readonly TransactionCommitManifest[],
  problems: TransactionCommitProblem[]
): TransactionCommitManifest[] {
  const sound = manifests.filter((manifest, index) => {
    const parsed = TransactionCommitManifestZ.safeParse(manifest);
    if (!parsed.success) {
      problems.push(
        ...shapeProblems(`manifests[${index}]`, parsed.error.issues)
      );
      return false;
    }
    validatePreCommitReferences(
      manifest.preCommitLedgers,
      `manifests[${index}].preCommitLedgers`,
      problems
    );
    validateReferenceCollection(
      manifest.resultingStates,
      `manifests[${index}].resultingStates`,
      problems
    );

    const transactionExists = ledger.transactions.some(
      (transaction) =>
        transaction.transactionId === manifest.transactionId &&
        transaction.transactionVersion === manifest.transactionVersion
    );
    if (!transactionExists) {
      problems.push(
        problem(
          'missing-transaction',
          `manifests[${index}].transactionId`,
          `${transactionVersionKey(manifest)} is not present in the transaction ledger.`,
          [transactionVersionKey(manifest)]
        )
      );
    }

    const expected = writeSets.find(
      (writeSet) =>
        writeSet.expectedWriteSetId === manifest.expectedWriteSetId &&
        writeSet.expectedWriteSetVersion === manifest.expectedWriteSetVersion
    );
    if (!expected) {
      problems.push(
        problem(
          'missing-write-set',
          `manifests[${index}].expectedWriteSetId`,
          `${manifest.expectedWriteSetId}@v${manifest.expectedWriteSetVersion} is not present.`,
          [manifestKey(manifest)]
        )
      );
      return true;
    }
    if (
      expected.transactionId !== manifest.transactionId ||
      expected.transactionVersion !== manifest.transactionVersion
    ) {
      problems.push(
        problem(
          'missing-write-set',
          `manifests[${index}].transactionId`,
          'The referenced expected write-set belongs to another transaction version.',
          [writeSetKey(expected), manifestKey(manifest)]
        )
      );
    }
    if (
      !comparePreCommitLedgers(
        expected.preCommitLedgers,
        manifest.preCommitLedgers
      )
    ) {
      problems.push(
        problem(
          'precommit-mismatch',
          `manifests[${index}].preCommitLedgers`,
          'The manifest must retain the exact authenticated pre-commit Team/player ledger versions.',
          [writeSetKey(expected), manifestKey(manifest)]
        )
      );
    }
    compareResults(
      expected.expectedResults,
      manifest.resultingStates,
      `manifests[${index}].resultingStates`,
      problems
    );
    if (
      manifest.recordStatus === 'current' &&
      expected.recordStatus !== 'current'
    ) {
      problems.push(
        problem(
          'missing-write-set',
          `manifests[${index}].expectedWriteSetVersion`,
          'A current manifest must reference the current authenticated expected write-set.',
          [writeSetKey(expected), manifestKey(manifest)]
        )
      );
    }
    return true;
  });

  const duplicates = duplicateKeys(sound, manifestKey);
  if (duplicates.length > 0) {
    problems.push(
      problem(
        'duplicate-identity',
        'manifests',
        `Manifest versions must be unique: ${duplicates.join(', ')}.`,
        duplicates
      )
    );
  }
  validateSupersessionChains(
    sound,
    (value) => value.manifestId,
    (value) => value.manifestVersion,
    (value) => value.supersedesManifestVersion,
    manifestKey,
    'manifests',
    problems
  );

  const versionsByIdentity = new Map<string, TransactionCommitManifest[]>();
  sound.forEach((value) => {
    const grouped = versionsByIdentity.get(value.manifestId) ?? [];
    grouped.push(value);
    versionsByIdentity.set(value.manifestId, grouped);
  });
  versionsByIdentity.forEach((values, id) => {
    const transactions = new Set(values.map(transactionVersionKey));
    if (transactions.size > 1) {
      problems.push(
        problem(
          'duplicate-identity',
          `manifests.${id}.transactionId`,
          'Every version of a manifest identity must belong to one transaction version.',
          values.map(manifestKey)
        )
      );
    }
  });

  const currentByTransaction = new Map<string, TransactionCommitManifest[]>();
  sound
    .filter((value) => value.recordStatus === 'current')
    .forEach((value) => {
      const key = transactionVersionKey(value);
      const grouped = currentByTransaction.get(key) ?? [];
      grouped.push(value);
      currentByTransaction.set(key, grouped);
    });
  currentByTransaction.forEach((values, key) => {
    if (values.length > 1) {
      problems.push(
        problem(
          'competing-current-manifest',
          `manifests.${key}`,
          `A transaction version may have at most one current manifest; found ${values.length}.`,
          values.map(manifestKey)
        )
      );
    }
  });
  return sound;
}

function freezeLedgerReferences(
  references: PreCommitLedgerReferences
): PreCommitLedgerReferences {
  const freezeCategory = (values: readonly VersionedLedgerReference[]) =>
    Object.freeze(
      sortedLedgerReferences(values).map((value) => Object.freeze({ ...value }))
    );
  return Object.freeze({
    teams: freezeCategory(references.teams),
    players: freezeCategory(references.players),
  });
}

function freezeResults(
  references: TransactionResultReferences
): TransactionResultReferences {
  return Object.freeze(
    Object.fromEntries(
      TRANSACTION_RESULT_CATEGORIES.map((category) => [
        category,
        Object.freeze(
          sortedResultReferences(references[category]).map((value) =>
            Object.freeze({ ...value })
          )
        ),
      ])
    )
  ) as TransactionResultReferences;
}

function freezeWriteSet(
  writeSet: ExpectedTransactionWriteSet
): ExpectedTransactionWriteSet {
  return Object.freeze({
    ...writeSet,
    preCommitLedgers: freezeLedgerReferences(writeSet.preCommitLedgers),
    expectedResults: freezeResults(writeSet.expectedResults),
    provenance: Object.freeze({ ...writeSet.provenance }),
  });
}

function freezeManifest(
  manifest: TransactionCommitManifest
): TransactionCommitManifest {
  return Object.freeze({
    ...manifest,
    preCommitLedgers: freezeLedgerReferences(manifest.preCommitLedgers),
    resultingStates: freezeResults(manifest.resultingStates),
  });
}

/**
 * Builds and freezes the complete transaction-history aggregate.
 *
 * @throws CompletedTradeLedgerError when the transaction ledger is invalid.
 * @throws TransactionCommitManifestError when write-set or manifest evidence is invalid.
 */
export function createCompletedTradeHistory(
  input: CompletedTradeHistoryInput
): CompletedTradeHistory {
  const ledger = createCompletedTradeLedger(input);
  const problems: TransactionCommitProblem[] = [];
  const writeSets = validateWriteSets(
    ledger,
    input.expectedWriteSets ?? [],
    problems
  );
  const manifests = validateManifests(
    ledger,
    writeSets,
    input.manifests ?? [],
    problems
  );
  if (problems.length > 0) throw new TransactionCommitManifestError(problems);

  return Object.freeze({
    ...ledger,
    expectedWriteSets: Object.freeze(
      [...writeSets]
        .sort((a, b) =>
          compareVersionedIdentity(
            a.expectedWriteSetId,
            a.expectedWriteSetVersion,
            b.expectedWriteSetId,
            b.expectedWriteSetVersion
          )
        )
        .map(freezeWriteSet)
    ),
    manifests: Object.freeze(
      [...manifests]
        .sort((a, b) =>
          compareVersionedIdentity(
            a.manifestId,
            a.manifestVersion,
            b.manifestId,
            b.manifestVersion
          )
        )
        .map(freezeManifest)
    ),
  });
}

export type CommitManifestVerification =
  | {
      readonly state: 'complete';
      readonly manifest: TransactionCommitManifest;
      readonly history: CompletedTradeHistory;
      readonly problems: readonly [];
    }
  | {
      readonly state: 'invalid';
      readonly manifest: null;
      readonly history: null;
      readonly problems: readonly TransactionCommitProblem[];
    };

export function verifyTransactionCommitManifest(
  history: CompletedTradeHistory,
  manifest: TransactionCommitManifest
): CommitManifestVerification {
  const retainedManifests = history.manifests.map((entry) =>
    entry.manifestId === manifest.manifestId &&
    entry.manifestVersion === manifest.supersedesManifestVersion &&
    entry.recordStatus === 'current'
      ? { ...entry, recordStatus: 'superseded' as const }
      : entry
  );
  try {
    const candidate = createCompletedTradeHistory({
      ledgerId: history.ledgerId,
      ledgerVersion: history.ledgerVersion + 1,
      transactions: history.transactions,
      expectedWriteSets: history.expectedWriteSets,
      manifests: [...retainedManifests, manifest],
    });
    const accepted = candidate.manifests.find(
      (entry) =>
        entry.manifestId === manifest.manifestId &&
        entry.manifestVersion === manifest.manifestVersion
    );
    if (!accepted) {
      return Object.freeze({
        state: 'invalid' as const,
        manifest: null,
        history: null,
        problems: Object.freeze([
          problem(
            'missing-manifest',
            'manifests',
            `${manifestKey(manifest)} was not retained by the verified history.`,
            [manifestKey(manifest)]
          ),
        ]),
      });
    }
    return Object.freeze({
      state: 'complete' as const,
      manifest: accepted,
      history: candidate,
      problems: Object.freeze([]) as readonly [],
    });
  } catch (error) {
    if (!(error instanceof TransactionCommitManifestError)) throw error;
    return Object.freeze({
      state: 'invalid' as const,
      manifest: null,
      history: null,
      problems: Object.freeze([...error.problems]),
    });
  }
}

export function appendExpectedTransactionWriteSet(
  history: CompletedTradeHistory,
  writeSet: ExpectedTransactionWriteSet
): CompletedTradeHistory {
  const retainedWriteSets = history.expectedWriteSets.map((entry) =>
    entry.expectedWriteSetId === writeSet.expectedWriteSetId &&
    entry.expectedWriteSetVersion ===
      writeSet.supersedesExpectedWriteSetVersion &&
    entry.recordStatus === 'current'
      ? { ...entry, recordStatus: 'superseded' as const }
      : entry
  );
  return createCompletedTradeHistory({
    ledgerId: history.ledgerId,
    ledgerVersion: history.ledgerVersion + 1,
    transactions: history.transactions,
    expectedWriteSets: [...retainedWriteSets, writeSet],
    manifests: history.manifests,
  });
}

export function appendVerifiedTransactionCommitManifest(
  history: CompletedTradeHistory,
  manifest: TransactionCommitManifest
): CompletedTradeHistory {
  const verification = verifyTransactionCommitManifest(history, manifest);
  if (verification.state !== 'complete') {
    throw new TransactionCommitManifestError(verification.problems);
  }
  return verification.history;
}

export type CurrentCommitManifestSelection =
  | {
      readonly state: 'complete';
      readonly manifest: TransactionCommitManifest;
      readonly reason: null;
    }
  | {
      readonly state: 'unavailable';
      readonly manifest: null;
      readonly reason:
        | 'unknown-transaction-version'
        | 'expected-write-set-unavailable'
        | 'verified-manifest-unavailable';
    };

export function selectCurrentTransactionCommitManifest(
  history: CompletedTradeHistory,
  transactionId: string,
  transactionVersion: number
): CurrentCommitManifestSelection {
  const hasTransaction = history.transactions.some(
    (transaction) =>
      transaction.transactionId === transactionId &&
      transaction.transactionVersion === transactionVersion
  );
  if (!hasTransaction) {
    return Object.freeze({
      state: 'unavailable' as const,
      manifest: null,
      reason: 'unknown-transaction-version' as const,
    });
  }

  const hasExpectedWriteSet = history.expectedWriteSets.some(
    (writeSet) =>
      writeSet.transactionId === transactionId &&
      writeSet.transactionVersion === transactionVersion &&
      writeSet.recordStatus === 'current'
  );
  if (!hasExpectedWriteSet) {
    return Object.freeze({
      state: 'unavailable' as const,
      manifest: null,
      reason: 'expected-write-set-unavailable' as const,
    });
  }

  const manifest = history.manifests.find(
    (entry) =>
      entry.transactionId === transactionId &&
      entry.transactionVersion === transactionVersion &&
      entry.recordStatus === 'current'
  );
  if (!manifest) {
    return Object.freeze({
      state: 'unavailable' as const,
      manifest: null,
      reason: 'verified-manifest-unavailable' as const,
    });
  }
  return Object.freeze({
    state: 'complete' as const,
    manifest,
    reason: null,
  });
}
