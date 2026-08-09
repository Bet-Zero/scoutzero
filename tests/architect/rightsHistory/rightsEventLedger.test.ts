import { describe, expect, it } from 'vitest';

import {
  RightsEventLedgerError,
  appendRightsEvent,
  createRightsEventLedger,
  reviseRightsEvent,
} from '@/features/architect/utils/rightsHistory';
import {
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../../fixtures/architect/rightsHistory';

describe('rights event ledger canonical boundary', () => {
  it('freezes the envelope, records, evidence, and arrays', () => {
    const ledger = makeRightsLedger();
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.events)).toBe(true);
    expect(Object.isFrozen(ledger.events[0])).toBe(true);
    expect(
      Object.isFrozen(
        ledger.events[0].eventKind === 'rights-established'
          ? ledger.events[0].serviceSeasons
          : null
      )
    ).toBe(true);
  });

  it('rejects unknown fields rather than silently discarding them', () => {
    const event = makeRightsEstablishedEvent();
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [{ ...event, inventedHistory: true }],
      })
    ).toThrow(RightsEventLedgerError);
  });

  it('rejects a non-string provenance identity beside a valid author', () => {
    const event = makeRightsEstablishedEvent();
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [
          {
            ...event,
            provenance: {
              sourceTransactionId: 73,
              authoringIdentity: 'valid-author',
            },
          },
        ],
      })
    ).toThrow(RightsEventLedgerError);
  });

  it('rejects stale or inverted source effective windows', () => {
    const event = makeRightsEstablishedEvent();
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [
          {
            ...event,
            priorContract: {
              ...event.priorContract,
              source: {
                ...event.priorContract.source,
                effectiveFrom: '2027-06-30',
                effectiveThrough: '2026-07-01',
              },
            },
          },
        ],
      })
    ).toThrow(RightsEventLedgerError);
  });

  it('rejects competing current versions of one event', () => {
    const event = makeRightsEstablishedEvent();
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [event, { ...event, eventVersion: 2 }],
      })
    ).toThrow(/competing-current-version/);
  });

  it('rejects detached successors and chain forks', () => {
    const ledger = makeRightsLedger();
    const renounced = {
      eventId: 'renounce-2',
      eventVersion: 1,
      eventKind: 'rights-renounced' as const,
      worldId: ledger.worldId,
      playerId: ledger.events[0].playerId,
      teamId: ledger.teamId,
      salaryCapYear: 2027,
      executedAt: '2026-07-15',
      effectiveAt: '2026-07-15',
      recordedAt: '2026-07-15T16:00:00Z',
      predecessorEventId: 'missing-event',
      predecessorState: ledger.events[0].resultingState,
      resultingState: {
        stateId: 'rights-ledger:player-bze-273:rights-state',
        stateVersion: 2,
      },
      provenance: {
        sourceTransactionId: 'operation-2',
        authoringIdentity: 'fixture-author',
      },
      recordStatus: 'current' as const,
      supersedesEventVersion: null,
      canonLeafIds: ['CBA2-C14.5'],
      renouncedBirdType: 'Full Bird' as const,
      renouncedFreeAgentAmount: 21_850_000,
    };
    expect(() =>
      createRightsEventLedger({
        ...ledger,
        ledgerVersion: 2,
        events: [...ledger.events, renounced],
      })
    ).toThrow(/broken-chain/);
  });

  it('rejects a second detached root for the same player and Salary Cap Year', () => {
    const ledger = makeRightsLedger();
    const root = ledger.events[0];
    expect(() =>
      createRightsEventLedger({
        ...ledger,
        ledgerVersion: 2,
        events: [
          root,
          {
            ...root,
            eventId: 'detached-root',
            resultingState: {
              stateId: 'detached-state',
              stateVersion: 1,
            },
          },
        ],
      })
    ).toThrow(/broken-chain/);
  });

  it('appends without mutating the accepted prior ledger', () => {
    const ledger = makeRightsLedger();
    const priorJson = JSON.stringify(ledger);
    const root = ledger.events[0];
    const next = appendRightsEvent(ledger, {
      eventId: 'renounce-2',
      eventVersion: 1,
      eventKind: 'rights-renounced',
      worldId: ledger.worldId,
      playerId: root.playerId,
      teamId: ledger.teamId,
      salaryCapYear: 2027,
      executedAt: '2026-07-15',
      effectiveAt: '2026-07-15',
      recordedAt: '2026-07-15T16:00:00Z',
      predecessorEventId: root.eventId,
      predecessorState: root.resultingState,
      resultingState: {
        stateId: 'rights-ledger:player-bze-273:rights-state',
        stateVersion: 2,
      },
      provenance: {
        sourceTransactionId: 'operation-2',
        authoringIdentity: 'fixture-author',
      },
      recordStatus: 'current',
      supersedesEventVersion: null,
      canonLeafIds: ['CBA2-C14.5'],
      renouncedBirdType: 'Full Bird',
      renouncedFreeAgentAmount: 21_850_000,
    });
    expect(JSON.stringify(ledger)).toBe(priorJson);
    expect(next.ledgerVersion).toBe(2);
    expect(next.events).toHaveLength(2);
  });

  it('publishes an explicit superseding version without changing the prior ledger', () => {
    const ledger = makeRightsLedger();
    const priorJson = JSON.stringify(ledger);
    const root = ledger.events[0];
    if (root.eventKind !== 'rights-established') throw new Error('fixture root');
    const revision = {
      ...root,
      eventVersion: 2,
      recordStatus: 'current' as const,
      supersedesEventVersion: 1,
      amountRecords: root.amountRecords.map((record) =>
        record.kind === 'applicable-maximum-salary'
          ? { ...record, amount: 29_000_000 }
          : record
      ),
    };

    const revised = reviseRightsEvent(ledger, revision);
    expect(JSON.stringify(ledger)).toBe(priorJson);
    expect(revised.ledgerVersion).toBe(2);
    expect(revised.events).toHaveLength(2);
    expect(revised.events[0].recordStatus).toBe('superseded');
    expect(revised.events[1]).toMatchObject({
      eventId: root.eventId,
      eventVersion: 2,
      supersedesEventVersion: 1,
      recordStatus: 'current',
    });
  });

  it('rejects a revision that does not name its exact superseded version', () => {
    const ledger = makeRightsLedger();
    const root = ledger.events[0];
    expect(() =>
      reviseRightsEvent(ledger, {
        ...root,
        eventVersion: 2,
        supersedesEventVersion: null,
      })
    ).toThrow(/duplicate-version/);
  });
});
