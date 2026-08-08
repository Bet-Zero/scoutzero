/**
 * FILE: tests/architect/contractHistory/contractEventLedger.test.ts
 * PURPOSE: BZE-271 contract event ledger — kinds, identities, conflicts, immutability.
 */

import { describe, expect, it } from 'vitest';
import {
  appendContractEvents,
  CONTRACT_EVENT_FAMILIES,
  CONTRACT_EVENT_KINDS,
  ContractEventLedgerError,
  createContractEventLedger,
  eventKey,
  isContractEventKind,
  reviseContractEvent,
  validateContractEventLedger,
  type LifecycleEventKind,
  type LifecycleEventRecord,
  type LifecycleLedgerProblemKind,
} from '@/features/architect/utils/contractHistory';
import {
  CONTRACT_ID,
  fullLifecycleEvents,
  LEDGER_ID,
  makeEvent,
  PLAYER_ID,
  signingEvent,
  twoEventChain,
  WORLD_ID,
} from './contractHistoryFixtures';

function build(events: readonly LifecycleEventRecord[]) {
  return createContractEventLedger({
    ledgerId: LEDGER_ID,
    ledgerVersion: 1,
    events,
  });
}

function problemKinds(events: readonly LifecycleEventRecord[]) {
  const validation = validateContractEventLedger({
    ledgerId: LEDGER_ID,
    ledgerVersion: 1,
    events,
  });
  expect(validation.state).toBe('invalid');
  expect(validation.ledger).toBeNull();
  return validation.problems.map((problem) => problem.kind);
}

function expectRejected(
  events: readonly LifecycleEventRecord[],
  kind: LifecycleLedgerProblemKind
) {
  expect(() => build(events)).toThrow(ContractEventLedgerError);
  expect(problemKinds(events)).toContain(kind);
}

describe('BZE-271 contract event kinds', () => {
  it('represents each lifecycle family CBA2-L02.1 names as its own kind', () => {
    expect([...CONTRACT_EVENT_KINDS]).toEqual([
      'signing',
      'amendment',
      'conversion',
      'option-exercise',
      'option-decline',
      'eto-exercise',
      'eto-decline',
      'extension',
      'renegotiation',
    ]);

    const families = Array.from(
      new Set(CONTRACT_EVENT_KINDS.map((kind) => CONTRACT_EVENT_FAMILIES[kind]))
    );
    expect(families.sort()).toEqual([
      'amendment',
      'conversion',
      'eto',
      'extension',
      'option',
      'renegotiation',
      'signing',
    ]);
  });

  it('keeps exercise and decline distinct inside the option and ETO families', () => {
    expect(CONTRACT_EVENT_FAMILIES['option-exercise']).toBe('option');
    expect(CONTRACT_EVENT_FAMILIES['option-decline']).toBe('option');
    expect(CONTRACT_EVENT_FAMILIES['eto-exercise']).toBe('eto');
    expect(CONTRACT_EVENT_FAMILIES['eto-decline']).toBe('eto');
    expect('option-exercise').not.toBe('option-decline');
  });

  it('records all nine kinds in one validated history', () => {
    const ledger = build(fullLifecycleEvents());

    expect(ledger.events).toHaveLength(9);
    expect(new Set(ledger.events.map((event) => event.eventKind)).size).toBe(9);
    expect(
      ledger.events.map((event) => event.resultingContractVersion).sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('rejects an unsupported event kind', () => {
    expect(isContractEventKind('signing')).toBe(true);
    expect(isContractEventKind('buyout')).toBe(false);

    const unsupported: LifecycleEventRecord = {
      ...makeEvent(),
      eventKind: 'buyout' as LifecycleEventKind,
    };
    expectRejected([signingEvent(), unsupported], 'unsupported-event-kind');
  });
});

describe('BZE-271 retained identity and context', () => {
  it('retains contract, player, team, world, event, and provenance identity', () => {
    const [event] = build(twoEventChain()).events;

    expect(event.worldId).toBe(WORLD_ID);
    expect(event.contractId).toBe(CONTRACT_ID);
    expect(event.playerId).toBe(PLAYER_ID);
    expect(event.teamId).toBe('team-BOS');
    expect(event.eventId).toBe('evt-001');
    expect(event.eventVersion).toBe(1);
    expect(event.eventKind).toBe('signing');
    expect(event.sourceTransactionId).toBe('txn-0001');
    expect(event.canonLeafIds).toEqual(['CBA2-L02.1']);
    expect(eventKey(event)).toBe('evt-001@v1');
  });

  it('retains predecessor and resulting contract versions', () => {
    const amendment = build(twoEventChain()).events.find(
      (event) => event.eventKind === 'amendment'
    );

    expect(amendment?.predecessorContractVersion).toBe(1);
    expect(amendment?.resultingContractVersion).toBe(2);
    expect(amendment?.predecessorEventId).toBe('evt-001');
  });

  it.each([
    ['worldId'],
    ['contractId'],
    ['playerId'],
    ['teamId'],
    ['eventId'],
  ] as const)('rejects a blank %s', (field) => {
    const broken: LifecycleEventRecord = { ...makeEvent(), [field]: '  ' };
    expectRejected([signingEvent(), broken], 'missing-identity');
  });

  it('rejects a missing or non-positive event version', () => {
    expectRejected([signingEvent(), makeEvent({ eventVersion: 0 })], 'missing-version');
    expectRejected(
      [signingEvent(), makeEvent({ eventVersion: 1.5 })],
      'missing-version'
    );
  });

  it('rejects a missing resulting contract version', () => {
    expectRejected(
      [signingEvent(), makeEvent({ resultingContractVersion: 0 })],
      'missing-version'
    );
  });

  it('accepts an authoring identity when no source transaction exists', () => {
    const ledger = build([
      signingEvent({ sourceTransactionId: null, authoringIdentity: 'gm-console' }),
    ]);

    expect(ledger.events[0].sourceTransactionId).toBeNull();
    expect(ledger.events[0].authoringIdentity).toBe('gm-console');
  });

  it('rejects an event with neither a source transaction nor an author', () => {
    expectRejected(
      [signingEvent({ sourceTransactionId: null, authoringIdentity: null })],
      'missing-provenance'
    );
  });

  it('requires at least one Canon leaf per event', () => {
    expectRejected([signingEvent({ canonLeafIds: [] })], 'missing-identity');
  });
});

describe('BZE-271 executed, effective, and recorded timestamps', () => {
  it('keeps executed and effective instants distinct', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-05T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
      }),
    ]);

    expect(ledger.events[0].executedAt).toBe('2026-07-05T18:00:00Z');
    expect(ledger.events[0].effectiveAt).toBe('2026-07-06T18:00:00Z');
    expect(ledger.events[0].executedAt).not.toBe(ledger.events[0].effectiveAt);
  });

  it('requires an explicit zone on every instant', () => {
    expectRejected(
      [signingEvent({ effectiveAt: '2026-07-06T18:00:00' })],
      'invalid-timestamp'
    );
    expectRejected([signingEvent({ executedAt: '2026-07-05' })], 'invalid-timestamp');
    expectRejected(
      [signingEvent({ recordedAt: 'not-a-date' })],
      'invalid-timestamp'
    );
  });

  it('accepts a numeric UTC offset as well as Z', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-05T14:00:00-04:00',
        effectiveAt: '2026-07-06T14:00:00-04:00',
        recordedAt: '2026-07-06T14:00:00-04:00',
      }),
    ]);

    expect(ledger.events[0].effectiveAt).toBe('2026-07-06T14:00:00-04:00');
  });

  it('rejects an event effective before it was executed', () => {
    expectRejected(
      [
        signingEvent({
          executedAt: '2026-07-06T18:00:00Z',
          effectiveAt: '2026-07-05T18:00:00Z',
        }),
      ],
      'invalid-chronology'
    );
  });

  it('rejects an event recorded before it was executed', () => {
    expectRejected(
      [
        signingEvent({
          executedAt: '2026-07-06T18:00:00Z',
          effectiveAt: '2026-07-06T18:00:00Z',
          recordedAt: '2026-07-01T18:00:00Z',
        }),
      ],
      'invalid-chronology'
    );
  });
});

describe('BZE-271 chain integrity', () => {
  it('rejects a contract history with no signing', () => {
    expectRejected([makeEvent()], 'broken-chain');
  });

  it('rejects a contract history with two signings', () => {
    const events = [
      signingEvent(),
      signingEvent({
        eventId: 'evt-001b',
        effectiveAt: '2026-07-07T18:00:00Z',
        recordedAt: '2026-07-07T18:00:00Z',
        resultingContractVersion: 10,
      }),
    ];
    expectRejected(events, 'chain-fork');
  });

  it('rejects a signing that names a predecessor', () => {
    expectRejected(
      [signingEvent({ predecessorContractVersion: 1 })],
      'broken-chain'
    );
    expectRejected([signingEvent({ predecessorEventId: 'evt-000' })], 'broken-chain');
  });

  it('rejects a non-signing event with no predecessor', () => {
    expectRejected(
      [signingEvent(), makeEvent({ predecessorContractVersion: null })],
      'broken-chain'
    );
    expectRejected(
      [signingEvent(), makeEvent({ predecessorEventId: null })],
      'broken-chain'
    );
  });

  it('rejects a gap where a consumed contract version was never produced', () => {
    const events = [
      signingEvent(),
      makeEvent({
        predecessorContractVersion: 4,
        predecessorEventId: 'evt-004',
        resultingContractVersion: 5,
      }),
    ];
    expectRejected(events, 'broken-chain');
  });

  it('rejects a fork where two events succeed the same contract version', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventId: 'evt-002', resultingContractVersion: 2 }),
      makeEvent({
        eventId: 'evt-003',
        resultingContractVersion: 3,
        effectiveAt: '2026-09-01T15:00:00Z',
        executedAt: '2026-09-01T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'chain-fork');
  });

  it('rejects competing events producing the same contract version', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventId: 'evt-002', resultingContractVersion: 2 }),
      makeEvent({
        eventId: 'evt-003',
        predecessorContractVersion: 2,
        predecessorEventId: 'evt-002',
        resultingContractVersion: 2,
        effectiveAt: '2026-09-01T15:00:00Z',
        executedAt: '2026-09-01T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'competing-current-version');
  });

  it('rejects a predecessor event that produced a different version', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventId: 'evt-002', resultingContractVersion: 2 }),
      makeEvent({
        eventId: 'evt-003',
        predecessorContractVersion: 2,
        predecessorEventId: 'evt-001',
        resultingContractVersion: 3,
        effectiveAt: '2026-09-01T15:00:00Z',
        executedAt: '2026-09-01T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'broken-chain');
  });

  it('rejects an unknown predecessor event id', () => {
    expectRejected(
      [signingEvent(), makeEvent({ predecessorEventId: 'evt-ghost' })],
      'broken-chain'
    );
  });

  it('rejects one contract holding events for two players or two teams', () => {
    expectRejected(
      [signingEvent(), makeEvent({ playerId: 'player-0002' })],
      'duplicate-identity'
    );
    expectRejected(
      [signingEvent(), makeEvent({ teamId: 'team-LAL' })],
      'duplicate-identity'
    );
  });

  it('keeps separate contracts and separate worlds independent', () => {
    const ledger = build([
      ...twoEventChain(),
      signingEvent({ eventId: 'evt-101', contractId: 'contract-0002' }),
      signingEvent({ eventId: 'evt-201', worldId: 'world-other' }),
    ]);

    expect(ledger.events).toHaveLength(4);
  });
});

describe('BZE-271 ordering and chronology along the chain', () => {
  it('rejects a successor effective before its predecessor', () => {
    const events = [
      signingEvent(),
      makeEvent({
        executedAt: '2026-07-01T15:00:00Z',
        effectiveAt: '2026-07-02T15:00:00Z',
        recordedAt: '2026-08-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'invalid-chronology');
  });

  it('reports ambiguous ordering when two chained events share an instant', () => {
    const events = [
      signingEvent({
        executedAt: '2026-07-06T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
      }),
      makeEvent({
        executedAt: '2026-07-06T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
        recordedAt: '2026-07-06T18:00:00Z',
      }),
    ];
    expectRejected(events, 'ambiguous-ordering');
  });

  it('names both events involved in an ambiguous ordering', () => {
    const events = [
      signingEvent({
        executedAt: '2026-07-06T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
      }),
      makeEvent({
        executedAt: '2026-07-06T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
        recordedAt: '2026-07-06T18:00:00Z',
      }),
    ];
    const ambiguous = validateContractEventLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      events,
    }).problems.find((problem) => problem.kind === 'ambiguous-ordering');

    expect(ambiguous?.eventIds).toEqual(['evt-001@v1', 'evt-002@v1']);
  });

  it('accepts a chain one millisecond apart', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-06T18:00:00.000Z',
        effectiveAt: '2026-07-06T18:00:00.000Z',
      }),
      makeEvent({
        executedAt: '2026-07-06T18:00:00.001Z',
        effectiveAt: '2026-07-06T18:00:00.001Z',
        recordedAt: '2026-07-06T18:00:00.001Z',
      }),
    ]);

    expect(ledger.events).toHaveLength(2);
  });
});

describe('BZE-271 duplicate identities and supersession', () => {
  it('rejects two records sharing one event id and version', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventId: 'evt-002', eventVersion: 1 }),
      makeEvent({
        eventId: 'evt-002',
        eventVersion: 1,
        resultingContractVersion: 3,
      }),
    ];
    expectRejected(events, 'duplicate-identity');
  });

  it('accepts a corrected event as a new version that supersedes the prior one', () => {
    const ledger = build([
      signingEvent(),
      makeEvent({
        eventVersion: 1,
        recordStatus: 'superseded',
        effectiveAt: '2026-08-01T15:00:00Z',
      }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        effectiveAt: '2026-08-02T15:00:00Z',
        executedAt: '2026-08-01T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ]);

    const versions = ledger.events
      .filter((event) => event.eventId === 'evt-002')
      .map((event) => [event.eventVersion, event.recordStatus]);

    expect(versions).toEqual([
      [1, 'superseded'],
      [2, 'current'],
    ]);
  });

  it('rejects two current versions of one event', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventVersion: 1, recordStatus: 'current' }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        effectiveAt: '2026-08-02T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
        executedAt: '2026-08-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'competing-current-version');
  });

  it('rejects an event whose every version is superseded', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventVersion: 1, recordStatus: 'superseded' }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'superseded',
        supersedesEventVersion: 1,
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'competing-current-version');
  });

  it('rejects a revision that supersedes a version the ledger does not hold', () => {
    const events = [
      signingEvent(),
      makeEvent({
        eventVersion: 3,
        recordStatus: 'current',
        supersedesEventVersion: 2,
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'broken-chain');
  });

  it('rejects a revision recorded before the version it replaces', () => {
    const events = [
      signingEvent(),
      makeEvent({
        eventVersion: 1,
        recordStatus: 'superseded',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        recordedAt: '2026-08-15T15:00:00Z',
      }),
    ];
    expectRejected(events, 'invalid-chronology');
  });

  it('rejects a version that follows a superseded one without declaring it', () => {
    const events = [
      signingEvent(),
      makeEvent({ eventVersion: 1, recordStatus: 'superseded' }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: null,
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ];
    expectRejected(events, 'missing-version');
  });

  it('rejects a superseding version that is not lower than its own', () => {
    expectRejected(
      [signingEvent(), makeEvent({ eventVersion: 2, supersedesEventVersion: 2 })],
      'missing-version'
    );
  });
});

describe('BZE-271 append-only history', () => {
  it('appends to a new ledger version and leaves the earlier ledger untouched', () => {
    const first = build(twoEventChain());
    const second = appendContractEvents(first, [
      makeEvent({
        eventId: 'evt-003',
        eventKind: 'extension',
        predecessorContractVersion: 2,
        predecessorEventId: 'evt-002',
        resultingContractVersion: 3,
        executedAt: '2026-10-01T15:00:00Z',
        effectiveAt: '2026-10-01T15:00:00Z',
        recordedAt: '2026-10-01T15:00:00Z',
      }),
    ]);

    expect(first.events).toHaveLength(2);
    expect(first.ledgerVersion).toBe(1);
    expect(second.events).toHaveLength(3);
    expect(second.ledgerVersion).toBe(2);
    expect(second).not.toBe(first);
  });

  it('re-validates the whole history on append, so a bad append is refused', () => {
    const first = build(twoEventChain());

    expect(() =>
      appendContractEvents(first, [
        makeEvent({ eventId: 'evt-002', eventVersion: 1 }),
      ])
    ).toThrow(ContractEventLedgerError);
    expect(first.events).toHaveLength(2);
  });
});

describe('BZE-271 append-only revision', () => {
  it('supersedes the prior version and leaves the earlier ledger untouched', () => {
    const first = build(twoEventChain());
    const revised = reviseContractEvent(
      first,
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        executedAt: '2026-08-01T15:00:00Z',
        effectiveAt: '2026-08-03T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      })
    );

    // The earlier ledger still holds v1 as current.
    expect(first.ledgerVersion).toBe(1);
    expect(first.events).toHaveLength(2);
    expect(
      first.events.find((event) => event.eventId === 'evt-002')?.recordStatus
    ).toBe('current');

    // The new ledger holds v1 superseded and v2 current.
    expect(revised.ledgerVersion).toBe(2);
    expect(
      revised.events
        .filter((event) => event.eventId === 'evt-002')
        .map((event) => [event.eventVersion, event.recordStatus])
    ).toEqual([
      [1, 'superseded'],
      [2, 'current'],
    ]);
  });

  it('preserves the superseded version content rather than editing it', () => {
    const first = build(twoEventChain());
    const original = first.events.find((event) => event.eventId === 'evt-002');
    const revised = reviseContractEvent(
      first,
      makeEvent({
        eventVersion: 2,
        supersedesEventVersion: 1,
        executedAt: '2026-08-01T15:00:00Z',
        effectiveAt: '2026-08-03T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      })
    );
    const superseded = revised.events.find(
      (event) => event.eventId === 'evt-002' && event.eventVersion === 1
    );

    expect(superseded?.effectiveAt).toBe(original?.effectiveAt);
    expect(superseded?.executedAt).toBe(original?.executedAt);
    expect(superseded?.resultingContractVersion).toBe(
      original?.resultingContractVersion
    );
    expect(superseded).not.toBe(original);
    expect(Object.isFrozen(superseded)).toBe(true);
  });

  it('refuses to revise an event with no current version', () => {
    const first = build(twoEventChain());

    expect(() =>
      reviseContractEvent(
        first,
        makeEvent({ eventId: 'evt-ghost', eventVersion: 2, supersedesEventVersion: 1 })
      )
    ).toThrow(ContractEventLedgerError);
  });

  it('refuses a revision that does not raise the event version', () => {
    const first = build(twoEventChain());

    expect(() =>
      reviseContractEvent(
        first,
        makeEvent({ eventVersion: 1, supersedesEventVersion: 1 })
      )
    ).toThrow(ContractEventLedgerError);
  });

  it('refuses a revision that does not declare what it supersedes', () => {
    const first = build(twoEventChain());

    expect(() =>
      reviseContractEvent(
        first,
        makeEvent({ eventVersion: 2, supersedesEventVersion: null })
      )
    ).toThrow(ContractEventLedgerError);
  });

  it('refuses a revision recorded as already superseded', () => {
    const first = build(twoEventChain());

    expect(() =>
      reviseContractEvent(
        first,
        makeEvent({
          eventVersion: 2,
          supersedesEventVersion: 1,
          recordStatus: 'superseded',
          recordedAt: '2026-09-01T15:00:00Z',
        })
      )
    ).toThrow(ContractEventLedgerError);
  });

  it('re-validates the whole history, so an invalid revision is refused', () => {
    const first = build(twoEventChain());

    expect(() =>
      reviseContractEvent(
        first,
        makeEvent({
          eventVersion: 2,
          supersedesEventVersion: 1,
          effectiveAt: '2026-07-01T15:00:00Z',
          executedAt: '2026-07-01T15:00:00Z',
          recordedAt: '2026-09-01T15:00:00Z',
        })
      )
    ).toThrow(ContractEventLedgerError);
    expect(first.events).toHaveLength(2);
  });
});

describe('BZE-271 deep immutability', () => {
  it('freezes the ledger, its event array, every event, and every leaf list', () => {
    const ledger = build(twoEventChain());

    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.events)).toBe(true);
    ledger.events.forEach((event) => {
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.canonLeafIds)).toBe(true);
    });
  });

  it('ignores mutation of a caller reference retained after construction', () => {
    const leafIds = ['CBA2-L02.1'];
    const mutable: {
      -readonly [K in keyof LifecycleEventRecord]: LifecycleEventRecord[K];
    } = { ...signingEvent(), canonLeafIds: leafIds };
    const ledger = build([mutable]);

    mutable.effectiveAt = '2099-01-01T00:00:00Z';
    mutable.resultingContractVersion = 99;
    leafIds.push('CBA2-L99.9');

    expect(ledger.events[0].effectiveAt).toBe('2026-07-06T18:00:00Z');
    expect(ledger.events[0].resultingContractVersion).toBe(1);
    expect(ledger.events[0].canonLeafIds).toEqual(['CBA2-L02.1']);
  });

  it('ignores mutation of the caller array of events', () => {
    const events = twoEventChain();
    const ledger = build(events);

    events.push(
      makeEvent({ eventId: 'evt-999', resultingContractVersion: 999 })
    );

    expect(ledger.events).toHaveLength(2);
  });
});

describe('BZE-271 ledger identity and reporting', () => {
  it('requires a ledger id and version', () => {
    expect(() =>
      createContractEventLedger({ ledgerId: ' ', ledgerVersion: 1, events: [] })
    ).toThrow(ContractEventLedgerError);
    expect(() =>
      createContractEventLedger({
        ledgerId: LEDGER_ID,
        ledgerVersion: 0,
        events: [],
      })
    ).toThrow(ContractEventLedgerError);
  });

  it('accepts an empty ledger', () => {
    const ledger = build([]);

    expect(ledger.events).toEqual([]);
    expect(ledger.ledgerId).toBe(LEDGER_ID);
  });

  it('reports every problem as data rather than only as a thrown message', () => {
    const validation = validateContractEventLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      events: [makeEvent({ eventKind: 'amendment' })],
    });

    expect(validation.state).toBe('invalid');
    expect(validation.problems.length).toBeGreaterThan(0);
    validation.problems.forEach((problem) => {
      expect(problem.at).toMatch(/^(events|ledger)/);
      expect(problem.detail.length).toBeGreaterThan(0);
      expect(Object.isFrozen(problem)).toBe(true);
    });
  });

  it('stores events in a deterministic order regardless of input order', () => {
    const events = fullLifecycleEvents();
    const forward = build(events);
    const reversed = build([...events].reverse());

    expect(reversed.events.map(eventKey)).toEqual(forward.events.map(eventKey));
  });
});
