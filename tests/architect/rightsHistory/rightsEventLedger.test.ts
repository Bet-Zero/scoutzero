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
    const root = ledger.events[0];
    if (root.eventKind !== 'rights-established') {
      throw new Error('fixture root must establish rights');
    }
    expect(Object.isFrozen(root.serviceSeasons)).toBe(true);
    expect(Object.isFrozen(root.serviceSeasons[0])).toBe(true);
    expect(Object.isFrozen(root.amountRecords)).toBe(true);
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

  it('rejects provenance with neither a transaction nor an author identity', () => {
    const event = makeRightsEstablishedEvent();
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [
          {
            ...event,
            provenance: {
              sourceTransactionId: null,
              authoringIdentity: null,
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
    ).toThrow(/invalid-date at events\[0\]\.sources\[0\]/);
  });

  it('rejects a service evidence version that skips its embedded history', () => {
    const event = makeRightsEstablishedEvent();
    const first = event.serviceSeasons[0];
    expect(() =>
      createRightsEventLedger({
        ...makeRightsLedger(event),
        events: [
          {
            ...event,
            serviceSeasons: [
              {
                ...first,
                serviceRecordVersion: 3,
                supersedesServiceRecordVersion: 2,
              },
              ...event.serviceSeasons.slice(1),
            ],
          },
        ],
      })
    ).toThrow(/broken-chain/);
  });

  it('accepts a complete nested amount supersession chain', () => {
    const event = makeRightsEstablishedEvent();
    const first = event.amountRecords[0];
    const ledger = createRightsEventLedger({
      ...makeRightsLedger(event),
      events: [
        {
          ...event,
          amountRecords: [
            { ...first, recordStatus: 'superseded' },
            {
              ...first,
              amountRecordVersion: 2,
              amount: first.amount + 1,
              supersedesAmountRecordVersion: 1,
            },
            ...event.amountRecords.slice(1),
          ],
        },
      ],
    });
    expect(ledger.events).toHaveLength(1);
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

  it('rejects a detached successor', () => {
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

  it('rejects two current successors that fork from one predecessor', () => {
    const ledger = makeRightsLedger();
    const root = ledger.events[0];
    const successor = {
      eventId: 'renounce-fork-a',
      eventVersion: 1,
      eventKind: 'rights-renounced' as const,
      worldId: ledger.worldId,
      playerId: root.playerId,
      teamId: ledger.teamId,
      salaryCapYear: root.salaryCapYear,
      executedAt: '2026-07-15',
      effectiveAt: '2026-07-15',
      recordedAt: '2026-07-15T16:00:00Z',
      predecessorEventId: root.eventId,
      predecessorState: root.resultingState,
      resultingState: {
        stateId: root.resultingState.stateId,
        stateVersion: 2,
      },
      provenance: {
        sourceTransactionId: 'operation-fork-a',
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
        events: [
          ...ledger.events,
          successor,
          {
            ...successor,
            eventId: 'renounce-fork-b',
            provenance: {
              ...successor.provenance,
              sourceTransactionId: 'operation-fork-b',
            },
          },
        ],
      })
    ).toThrow(/chain-fork/);
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

  it('normalizes an invalid appended event into the ledger error contract', () => {
    expect(() =>
      appendRightsEvent(makeRightsLedger(), {
        eventKind: 'rights-renounced',
      })
    ).toThrow(RightsEventLedgerError);
  });

  it('rejects a successor that switches the rights-state stream identity', () => {
    const ledger = makeRightsLedger();
    const root = ledger.events[0];
    expect(() =>
      appendRightsEvent(ledger, {
        eventId: 'renounce-wrong-state-stream',
        eventVersion: 1,
        eventKind: 'rights-renounced',
        worldId: ledger.worldId,
        playerId: root.playerId,
        teamId: ledger.teamId,
        salaryCapYear: root.salaryCapYear,
        executedAt: '2026-07-15',
        effectiveAt: '2026-07-15',
        recordedAt: '2026-07-15T16:00:00Z',
        predecessorEventId: root.eventId,
        predecessorState: root.resultingState,
        resultingState: {
          stateId: 'different-rights-state-stream',
          stateVersion: 2,
        },
        provenance: {
          sourceTransactionId: 'operation-wrong-state-stream',
          authoringIdentity: 'fixture-author',
        },
        recordStatus: 'current',
        supersedesEventVersion: null,
        canonLeafIds: ['CBA2-C14.5'],
        renouncedBirdType: 'Full Bird',
        renouncedFreeAgentAmount: 21_850_000,
      })
    ).toThrow(/broken-chain/);
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

  it('rejects a revision that changes the event identity', () => {
    const ledger = makeRightsLedger();
    const root = ledger.events[0];
    expect(() =>
      reviseRightsEvent(ledger, {
        ...root,
        playerId: 'different-player',
        eventVersion: 2,
        supersedesEventVersion: 1,
      })
    ).toThrow(/identity-mismatch/);
  });
});
