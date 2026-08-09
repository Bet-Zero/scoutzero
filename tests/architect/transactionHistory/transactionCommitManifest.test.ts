import { describe, expect, it } from 'vitest';

import {
  appendVerifiedTransactionCommitManifest,
  createCompletedTradeHistory,
  ExpectedTransactionWriteSetZ,
  selectCurrentTransactionCommitManifest,
  TransactionCommitManifestError,
  TransactionCommitManifestZ,
  verifyTransactionCommitManifest,
} from '@/features/architect/utils/transactionHistory';
import {
  emptyResults,
  LEDGER_ID,
  makeHistory,
  makeManifest,
  makeTransaction,
  makeWriteSet,
  TRANSACTION_ID,
} from './transactionHistoryFixtures';

describe('BZE-272 exact transaction commit manifests', () => {
  it('allows zero current manifests while expected inputs are unavailable', () => {
    const history = makeHistory({ withWriteSet: false, withManifest: false });
    expect(history.manifests).toEqual([]);
    expect(
      selectCurrentTransactionCommitManifest(history, TRANSACTION_ID, 1)
    ).toEqual({
      state: 'unavailable',
      manifest: null,
      reason: 'expected-write-set-unavailable',
    });
  });

  it('allows zero current manifests after the expected write-set arrives', () => {
    const history = makeHistory({ withManifest: false });
    expect(
      selectCurrentTransactionCommitManifest(history, TRANSACTION_ID, 1)
    ).toEqual({
      state: 'unavailable',
      manifest: null,
      reason: 'verified-manifest-unavailable',
    });
  });

  it('accepts exactly matching direct-owner state IDs and versions', () => {
    const history = makeHistory({ withManifest: false });
    const manifest = makeManifest();
    const verification = verifyTransactionCommitManifest(history, manifest);
    expect(verification.state).toBe('complete');
    expect(verification.problems).toEqual([]);

    const committed = appendVerifiedTransactionCommitManifest(
      history,
      manifest
    );
    expect(
      selectCurrentTransactionCommitManifest(committed, TRANSACTION_ID, 1)
    ).toEqual(expect.objectContaining({ state: 'complete', reason: null }));
    expect(Object.isFrozen(committed.manifests[0].resultingStates.pick)).toBe(
      true
    );
  });

  it.each([
    [
      'missing',
      {
        ...makeWriteSet().expectedResults,
        pick: [],
      },
      'missing-result',
    ],
    [
      'unexpected',
      {
        ...makeWriteSet().expectedResults,
        list: [{ stateId: 'list-unexpected', stateVersion: 1 }],
      },
      'unexpected-result',
    ],
    [
      'conflicting',
      {
        ...makeWriteSet().expectedResults,
        cash: [{ stateId: 'cash-BOS-2027', stateVersion: 3 }],
      },
      'conflicting-version',
    ],
  ] as const)('fails closed on a %s result', (_name, resultingStates, kind) => {
    const verification = verifyTransactionCommitManifest(
      makeHistory({ withManifest: false }),
      makeManifest({ resultingStates })
    );
    expect(verification.state).toBe('invalid');
    expect(verification.problems.some((entry) => entry.kind === kind)).toBe(
      true
    );
  });

  it('rejects duplicate supplied state identities', () => {
    const expected = makeWriteSet().expectedResults;
    const verification = verifyTransactionCommitManifest(
      makeHistory({ withManifest: false }),
      makeManifest({
        resultingStates: {
          ...expected,
          pick: [expected.pick[0], expected.pick[0]],
        },
      })
    );
    expect(verification.state).toBe('invalid');
    expect(
      verification.problems.some((entry) => entry.kind === 'duplicate-result')
    ).toBe(true);
  });

  it('rejects unversioned result references', () => {
    const raw = makeManifest() as unknown as Record<string, unknown>;
    const results = raw.resultingStates as Record<string, unknown[]>;
    raw.resultingStates = {
      ...results,
      cash: [{ stateId: 'cash-BOS-2027' }],
    };
    const parsed = TransactionCommitManifestZ.safeParse(raw);
    expect(parsed.success).toBe(false);

    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [makeWriteSet()],
        manifests: [raw as never],
      })
    ).toThrow(TransactionCommitManifestError);
  });

  it('does not treat an omitted result category as explicitly empty', () => {
    const rawWriteSet = makeWriteSet() as unknown as Record<string, unknown>;
    const expected = {
      ...(rawWriteSet.expectedResults as Record<string, unknown>),
    };
    delete expected.rights;
    rawWriteSet.expectedResults = expected;
    expect(ExpectedTransactionWriteSetZ.safeParse(rawWriteSet).success).toBe(
      false
    );

    const rawManifest = makeManifest() as unknown as Record<string, unknown>;
    const resulting = {
      ...(rawManifest.resultingStates as Record<string, unknown>),
    };
    delete resulting.restriction;
    rawManifest.resultingStates = resulting;
    expect(TransactionCommitManifestZ.safeParse(rawManifest).success).toBe(
      false
    );
  });

  it('rejects unknown result categories instead of stripping them', () => {
    const raw = makeManifest() as unknown as Record<string, unknown>;
    raw.resultingStates = {
      ...(raw.resultingStates as Record<string, unknown>),
      roster: [],
    };
    expect(TransactionCommitManifestZ.safeParse(raw).success).toBe(false);
  });

  it('accepts explicitly empty categories when all seven are authenticated', () => {
    const writeSet = makeWriteSet({ expectedResults: emptyResults() });
    const manifest = makeManifest({
      preCommitLedgers: writeSet.preCommitLedgers,
      resultingStates: emptyResults(),
    });
    const history = createCompletedTradeHistory({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction()],
      expectedWriteSets: [writeSet],
      manifests: [manifest],
    });
    expect(history.manifests).toHaveLength(1);
  });

  it('requires exact pre-commit Team/player ledger versions', () => {
    const manifest = makeManifest({
      preCommitLedgers: {
        ...makeManifest().preCommitLedgers,
        teams: [{ ledgerId: 'team-BOS-ledger', ledgerVersion: 9 }],
      },
    });
    const verification = verifyTransactionCommitManifest(
      makeHistory({ withManifest: false }),
      manifest
    );
    expect(verification.state).toBe('invalid');
    expect(
      verification.problems.some((entry) => entry.kind === 'precommit-mismatch')
    ).toBe(true);
  });

  it('requires the manifest to reference the exact expected write-set version', () => {
    const verification = verifyTransactionCommitManifest(
      makeHistory({ withManifest: false }),
      makeManifest({ expectedWriteSetVersion: 2 })
    );
    expect(verification.state).toBe('invalid');
    expect(
      verification.problems.some((entry) => entry.kind === 'missing-write-set')
    ).toBe(true);
  });

  it('permits at most one current manifest for a transaction version', () => {
    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [makeWriteSet()],
        manifests: [
          makeManifest(),
          makeManifest({ manifestId: 'manifest-competing' }),
        ],
      })
    ).toThrow(TransactionCommitManifestError);
  });

  it('validates reachable append-only manifest supersession', () => {
    const first = makeManifest({ recordStatus: 'superseded' });
    const second = makeManifest({
      manifestVersion: 2,
      supersedesManifestVersion: 1,
    });
    const history = createCompletedTradeHistory({
      ledgerId: LEDGER_ID,
      ledgerVersion: 2,
      transactions: [makeTransaction()],
      expectedWriteSets: [makeWriteSet()],
      manifests: [second, first],
    });
    expect(history.manifests.map((entry) => entry.manifestVersion)).toEqual([
      1, 2,
    ]);
    expect(history.manifests.map((entry) => entry.recordStatus)).toEqual([
      'superseded',
      'current',
    ]);
  });

  it('rejects detached manifest and expected-write-set versions', () => {
    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [
          makeWriteSet({
            expectedWriteSetVersion: 2,
            supersedesExpectedWriteSetVersion: 1,
          }),
        ],
        manifests: [],
      })
    ).toThrow(TransactionCommitManifestError);

    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [makeWriteSet()],
        manifests: [
          makeManifest({ manifestVersion: 2, supersedesManifestVersion: 1 }),
        ],
      })
    ).toThrow(TransactionCommitManifestError);
  });

  it('permits at most one current expected write-set per transaction version', () => {
    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [
          makeWriteSet(),
          makeWriteSet({ expectedWriteSetId: 'write-set-competing' }),
        ],
        manifests: [],
      })
    ).toThrow(TransactionCommitManifestError);
  });

  it('rejects a manifest for an unknown transaction version', () => {
    const result = verifyTransactionCommitManifest(
      makeHistory({ withManifest: false }),
      makeManifest({ transactionVersion: 2 })
    );
    expect(result.state).toBe('invalid');
    expect(
      result.problems.some((entry) => entry.kind === 'missing-transaction')
    ).toBe(true);
  });

  it('requires stable provenance on the expected write-set', () => {
    expect(
      ExpectedTransactionWriteSetZ.safeParse(
        makeWriteSet({
          provenance: { sourceOperationId: null, authoringIdentity: null },
        })
      ).success
    ).toBe(false);
    expect(
      ExpectedTransactionWriteSetZ.safeParse({
        ...makeWriteSet(),
        provenance: 'operator said so',
      }).success
    ).toBe(false);
  });
});
