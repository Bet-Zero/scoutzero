import { describe, expect, it } from 'vitest';

import {
  CompletedTradeLedgerError,
  CompletedTradeRecordZ,
  createCompletedTradeLedger,
  reviseCompletedTradeRecord,
  selectCompletedTradesAsOf,
  selectCompletedTradeVersionAsOf,
  selectCurrentCompletedTradeVersion,
  validateCompletedTradeLedger,
} from '@/features/architect/utils/transactionHistory';
import { ContractEventRecordZ } from '@/features/architect/utils/contractHistory';
import {
  LEDGER_ID,
  makeTransaction,
  TRANSACTION_ID,
} from './transactionHistoryFixtures';
import { makeResultingState } from '../contractHistory/contractHistoryFixtures';

describe('BZE-272 completed-trade ledger', () => {
  it('constructs and freezes a strict immutable versioned record', () => {
    const ledger = createCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction()],
    });

    expect(ledger.transactions).toHaveLength(1);
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.transactions)).toBe(true);
    expect(Object.isFrozen(ledger.transactions[0])).toBe(true);
    expect(Object.isFrozen(ledger.transactions[0].provenance)).toBe(true);
    expect(Object.isFrozen(ledger.transactions[0].canonLeafIds)).toBe(true);
  });

  it.each([
    ['tradeCallAt', '2026-08-01'],
    ['committedAt', '2026-08-01T15:05:00'],
    ['recordedAt', 'not-an-instant'],
  ] as const)('rejects an unzoned %s', (field, value) => {
    expect(() =>
      createCompletedTradeLedger({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        transactions: [makeTransaction({ [field]: value })],
      })
    ).toThrow(CompletedTradeLedgerError);
  });

  it('requires Trade Call, commit, and record timestamps in causal order', () => {
    const result = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction({ committedAt: '2026-08-01T14:59:00Z' })],
    });
    expect(result.state).toBe('invalid');
    expect(
      result.problems.some((entry) => entry.kind === 'invalid-chronology')
    ).toBe(true);

    const recordedEarly = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction({ recordedAt: '2026-08-01T15:04:00Z' })],
    });
    expect(recordedEarly.state).toBe('invalid');
    expect(
      recordedEarly.problems.some(
        (entry) => entry.kind === 'invalid-chronology'
      )
    ).toBe(true);
  });

  it('requires a governed Salary Cap Year containing Trade Call and commit', () => {
    const invalidYear = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction({ salaryCapYear: 10000 })],
    });
    expect(invalidYear.state).toBe('invalid');
    expect(
      invalidYear.problems.some(
        (entry) => entry.kind === 'invalid-salary-cap-year'
      )
    ).toBe(true);

    const wrongWindow = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction({ salaryCapYear: 2026 })],
    });
    expect(wrongWindow.state).toBe('invalid');
    expect(
      wrongWindow.problems.some(
        (entry) => entry.kind === 'invalid-salary-cap-year'
      )
    ).toBe(true);
  });

  it('requires positive identity versions and structured provenance', () => {
    expect(
      CompletedTradeRecordZ.safeParse(
        makeTransaction({ transactionVersion: 0 })
      ).success
    ).toBe(false);
    expect(
      CompletedTradeRecordZ.safeParse(
        makeTransaction({
          provenance: { sourceOperationId: null, authoringIdentity: null },
        })
      ).success
    ).toBe(false);
    expect(
      CompletedTradeRecordZ.safeParse({
        ...makeTransaction(),
        provenanceText: 'some caller',
      }).success
    ).toBe(false);
  });

  it('rejects duplicate, detached, and competing transaction versions', () => {
    const duplicate = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction(), makeTransaction()],
    });
    expect(duplicate.state).toBe('invalid');
    expect(
      duplicate.problems.some((entry) => entry.kind === 'duplicate-identity')
    ).toBe(true);

    const detached = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [
        makeTransaction({
          transactionVersion: 2,
          supersedesTransactionVersion: 1,
        }),
      ],
    });
    expect(detached.state).toBe('invalid');
    expect(
      detached.problems.some((entry) => entry.kind === 'broken-chain')
    ).toBe(true);

    const competing = validateCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [
        makeTransaction(),
        makeTransaction({
          transactionVersion: 2,
          supersedesTransactionVersion: 1,
        }),
      ],
    });
    expect(competing.state).toBe('invalid');
    expect(
      competing.problems.some(
        (entry) => entry.kind === 'competing-current-version'
      )
    ).toBe(true);
  });

  it('revises by append-only supersession without mutating the prior ledger', () => {
    const original = createCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction()],
    });
    const revised = reviseCompletedTradeRecord(
      original,
      makeTransaction({
        transactionVersion: 2,
        recordedAt: '2026-08-02T12:00:00Z',
        recordStatus: 'current',
        supersedesTransactionVersion: 1,
      })
    );

    expect(original.ledgerVersion).toBe(1);
    expect(original.transactions).toHaveLength(1);
    expect(original.transactions[0].recordStatus).toBe('current');
    expect(revised.ledgerVersion).toBe(2);
    expect(revised.transactions.map((entry) => entry.recordStatus)).toEqual([
      'superseded',
      'current',
    ]);
  });

  it('selects deterministic current and recorded-as-of versions', () => {
    const original = createCompletedTradeLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      transactions: [makeTransaction()],
    });
    const revised = reviseCompletedTradeRecord(
      original,
      makeTransaction({
        transactionVersion: 2,
        recordedAt: '2026-08-02T12:00:00Z',
        supersedesTransactionVersion: 1,
      })
    );

    expect(
      selectCurrentCompletedTradeVersion(revised, TRANSACTION_ID)
        ?.transactionVersion
    ).toBe(2);
    expect(
      selectCompletedTradeVersionAsOf(
        revised,
        TRANSACTION_ID,
        '2026-08-01T20:00:00Z'
      )?.transactionVersion
    ).toBe(1);
    expect(
      selectCompletedTradeVersionAsOf(
        revised,
        TRANSACTION_ID,
        '2026-08-03T00:00:00Z'
      )?.transactionVersion
    ).toBe(2);
    expect(selectCompletedTradesAsOf(revised, '2026-08-01T14:00:00Z')).toEqual(
      []
    );
    expect(
      selectCompletedTradeVersionAsOf(revised, TRANSACTION_ID, '2026-08-01')
    ).toBeNull();
  });

  it('interoperates with BZE-271 only through the stable transaction identity', () => {
    const transaction = makeTransaction();
    const contractEvent = {
      eventId: 'contract-event-from-trade',
      eventVersion: 1,
      eventKind: 'amendment',
      worldId: transaction.worldId,
      contractId: 'contract-001',
      playerId: 'player-001',
      teamId: 'team-BOS',
      executedAt: transaction.committedAt,
      effectiveAt: transaction.committedAt,
      recordedAt: transaction.recordedAt,
      predecessorContractVersion: 1,
      resultingContractVersion: 2,
      predecessorEventId: 'contract-event-root',
      sourceTransactionId: transaction.transactionId,
      authoringIdentity: null,
      recordStatus: 'current',
      supersedesEventVersion: null,
      canonLeafIds: ['CBA2-L02.1'],
      resultingState: makeResultingState({
        contractId: 'contract-001',
        contractVersion: 2,
        playerId: 'player-001',
        teamId: 'team-BOS',
      }),
    };
    expect(ContractEventRecordZ.safeParse(contractEvent).success).toBe(true);
  });
});
