import { describe, expect, it } from 'vitest';

import {
  deserializeTransactionEventLedger,
  readTransactionEventLedger,
  serializeTransactionEventLedger,
  TransactionHistoryReadError,
} from '@/features/architect/utils/transactionHistory';
import {
  LEDGER_ID,
  makeHistory,
  makeManifest,
  makeTransaction,
  makeWriteSet,
} from './transactionHistoryFixtures';
import { createCompletedTradeHistory } from '@/features/architect/utils/transactionHistory';

describe('BZE-272 transaction history serialization', () => {
  it('round-trips the exact frozen history', () => {
    const history = makeHistory();
    const roundTrip = deserializeTransactionEventLedger(
      serializeTransactionEventLedger(history)
    );
    expect(roundTrip).toEqual(history);
    expect(Object.isFrozen(roundTrip)).toBe(true);
    expect(
      Object.isFrozen(roundTrip.expectedWriteSets[0].expectedResults)
    ).toBe(true);
  });

  it('serializes deterministically regardless of input collection order', () => {
    const first = makeHistory();
    const secondTransaction = makeTransaction({
      transactionId: 'trade-bze272-002',
      provenance: {
        sourceOperationId: 'operation-bze272-002',
        authoringIdentity: null,
      },
    });
    const secondWriteSet = makeWriteSet({
      expectedWriteSetId: 'write-set-bze272-002',
      transactionId: secondTransaction.transactionId,
      provenance: secondTransaction.provenance,
    });
    const secondManifest = makeManifest(
      {
        manifestId: 'manifest-bze272-002',
        transactionId: secondTransaction.transactionId,
      },
      secondWriteSet
    );
    const a = createCompletedTradeHistory({
      ledgerId: LEDGER_ID,
      ledgerVersion: 2,
      transactions: [...first.transactions, secondTransaction],
      expectedWriteSets: [...first.expectedWriteSets, secondWriteSet],
      manifests: [...first.manifests, secondManifest],
    });
    const b = createCompletedTradeHistory({
      ledgerId: LEDGER_ID,
      ledgerVersion: 2,
      transactions: [secondTransaction, ...first.transactions],
      expectedWriteSets: [secondWriteSet, ...first.expectedWriteSets],
      manifests: [secondManifest, ...first.manifests],
    });
    expect(serializeTransactionEventLedger(a)).toBe(
      serializeTransactionEventLedger(b)
    );
  });

  it.each(['', 'not-json', '[]', '{}'])(
    'fails closed on unreadable %j',
    (input) => {
      expect(readTransactionEventLedger(input).state).toBe('invalid');
    }
  );

  it('rejects unknown envelope fields', () => {
    const payload = JSON.parse(serializeTransactionEventLedger(makeHistory()));
    payload.futureField = true;
    const result = readTransactionEventLedger(JSON.stringify(payload));
    expect(result.state).toBe('invalid');
  });

  it('rejects unsupported payload versions', () => {
    const payload = JSON.parse(serializeTransactionEventLedger(makeHistory()));
    payload.payloadVersion = 2;
    expect(readTransactionEventLedger(JSON.stringify(payload)).state).toBe(
      'invalid'
    );
  });

  it('reports transaction and manifest failures from the same payload', () => {
    const payload = JSON.parse(serializeTransactionEventLedger(makeHistory()));
    payload.transactions[0].transactionVersion = 0;
    payload.manifests[0].manifestVersion = 0;
    const serialized = JSON.stringify(payload);

    expect(() => deserializeTransactionEventLedger(serialized)).toThrow(
      TransactionHistoryReadError
    );
    const result = readTransactionEventLedger(serialized);
    expect(result.state).toBe('invalid');
    expect(result.problems.map((entry) => entry.source)).toEqual(
      expect.arrayContaining(['transaction', 'manifest'])
    );
  });

  it('applies strict validation equally to in-memory and deserialized inputs', () => {
    const invalid = makeWriteSet() as unknown as Record<string, unknown>;
    invalid.expectedResults = {
      ...(invalid.expectedResults as Record<string, unknown>),
      waiver: [],
    };
    expect(() =>
      createCompletedTradeHistory({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction()],
        expectedWriteSets: [invalid as never],
        manifests: [],
      })
    ).toThrow();

    const payload = JSON.parse(
      serializeTransactionEventLedger(
        makeHistory({ withWriteSet: false, withManifest: false })
      )
    );
    payload.expectedWriteSets = [invalid];
    expect(readTransactionEventLedger(JSON.stringify(payload)).state).toBe(
      'invalid'
    );
  });
});
