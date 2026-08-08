/**
 * FILE: tests/architect/contractHistory/contractEventSerialization.test.ts
 * PURPOSE: BZE-271 lossless ledger round-trip and fail-closed payload reading.
 */

import { describe, expect, it } from 'vitest';
import {
  CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
  ContractEventLedgerError,
  ContractEventLedgerPayloadError,
  createContractEventLedger,
  deserializeContractEventLedger,
  projectContractStateAsOf,
  readContractEventLedger,
  serializeContractEventLedger,
  toContractEventLedgerPayload,
  verifyContractProjectionManifest,
  type ContractEventLedger,
  type ContractEventRecord,
} from '@/features/architect/utils/contractHistory';
import {
  AS_OF_LATE,
  CONTRACT_ID,
  fullLifecycleEvents,
  LEDGER_ID,
  makeEvent,
  SALARY_CAP_YEAR,
  signingEvent,
  WORLD_ID,
} from './contractHistoryFixtures';

function build(events: readonly ContractEventRecord[]): ContractEventLedger {
  return createContractEventLedger({
    ledgerId: LEDGER_ID,
    ledgerVersion: 3,
    events,
  });
}

function projectAt(ledger: ContractEventLedger, asOfDate: string) {
  return projectContractStateAsOf({
    ledger,
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    asOfDate,
    salaryCapYear: SALARY_CAP_YEAR,
  });
}

/** History with a revised event, so supersession has to survive the trip too. */
function revisedHistory(): ContractEventRecord[] {
  return [
    ...fullLifecycleEvents().filter((event) => event.eventId !== 'evt-002'),
    makeEvent({
      eventId: 'evt-002',
      eventVersion: 1,
      recordStatus: 'superseded',
      authoringIdentity: 'gm-console',
    }),
    makeEvent({
      eventId: 'evt-002',
      eventVersion: 2,
      recordStatus: 'current',
      supersedesEventVersion: 1,
      executedAt: '2026-08-01T15:00:00Z',
      effectiveAt: '2026-08-01T15:00:00Z',
      recordedAt: '2026-09-01T15:00:00Z',
      sourceTransactionId: null,
      authoringIdentity: 'gm-console',
      canonLeafIds: ['CBA2-L02.1', 'CBA2-L02.2'],
    }),
  ];
}

describe('BZE-271 lossless serialization round-trip', () => {
  it('restores ledger identity and version', () => {
    const ledger = build(fullLifecycleEvents());
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    );

    expect(restored.ledgerId).toBe(LEDGER_ID);
    expect(restored.ledgerVersion).toBe(3);
  });

  it('restores every event field, ordering, and supersession exactly', () => {
    const ledger = build(revisedHistory());
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    );

    expect(restored.events).toEqual(ledger.events);
    expect(restored.events.map((event) => `${event.eventId}@v${event.eventVersion}`)).toEqual(
      ledger.events.map((event) => `${event.eventId}@v${event.eventVersion}`)
    );
    expect(restored.events.map((event) => event.recordStatus)).toEqual(
      ledger.events.map((event) => event.recordStatus)
    );
    expect(restored.events.map((event) => event.supersedesEventVersion)).toEqual(
      ledger.events.map((event) => event.supersedesEventVersion)
    );
  });

  it('restores timestamps, versions, and provenance without normalising them', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-05T14:00:00-04:00',
        effectiveAt: '2026-07-06T18:00:00.500Z',
        recordedAt: '2026-07-06T18:00:00.500Z',
        sourceTransactionId: null,
        authoringIdentity: 'gm-console',
        canonLeafIds: ['CBA2-L02.1', 'CBA2-L02.2'],
      }),
    ]);
    const [restored] = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    ).events;

    expect(restored.executedAt).toBe('2026-07-05T14:00:00-04:00');
    expect(restored.effectiveAt).toBe('2026-07-06T18:00:00.500Z');
    expect(restored.recordedAt).toBe('2026-07-06T18:00:00.500Z');
    expect(restored.sourceTransactionId).toBeNull();
    expect(restored.authoringIdentity).toBe('gm-console');
    expect(restored.canonLeafIds).toEqual(['CBA2-L02.1', 'CBA2-L02.2']);
    expect(restored.predecessorContractVersion).toBeNull();
    expect(restored.predecessorEventId).toBeNull();
  });

  it('serializes to a stable string for the same history', () => {
    const events = revisedHistory();

    expect(serializeContractEventLedger(build([...events].reverse()))).toBe(
      serializeContractEventLedger(build(events))
    );
  });

  it('produces identical projections and manifests after the round-trip', () => {
    const ledger = build(revisedHistory());
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    );

    ['2026-07-10T00:00:00Z', '2026-11-20T00:00:00Z', AS_OF_LATE].forEach(
      (asOfDate) => {
        const before = projectAt(ledger, asOfDate);
        const after = projectAt(restored, asOfDate);

        expect(after.state, asOfDate).toBe(before.state);
        expect(after.contractVersion, asOfDate).toBe(before.contractVersion);
        expect(after.manifest, asOfDate).toEqual(before.manifest);
        expect(after.consumedEvents, asOfDate).toEqual(before.consumedEvents);
        expect(after.futureEvents, asOfDate).toEqual(before.futureEvents);
      }
    );
  });

  it('verifies a manifest taken before the round-trip against the restored ledger', () => {
    const ledger = build(revisedHistory());
    const manifest = projectAt(ledger, AS_OF_LATE).manifest;
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    );

    expect(verifyContractProjectionManifest(manifest, restored)).toEqual({
      state: 'unchanged',
      drift: [],
    });
  });

  it('round-trips a manifest through JSON without loss', () => {
    const manifest = projectAt(build(revisedHistory()), AS_OF_LATE).manifest;

    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('re-freezes a restored ledger to the leaves', () => {
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );

    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored.events)).toBe(true);
    restored.events.forEach((event) => {
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.canonLeafIds)).toBe(true);
    });
  });

  it('round-trips an empty ledger', () => {
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(build([]))
    );

    expect(restored.events).toEqual([]);
  });

  it('exposes the payload shape with its own version', () => {
    const payload = toContractEventLedgerPayload(build(fullLifecycleEvents()));

    expect(payload.payloadVersion).toBe(CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION);
    expect(payload.events).toHaveLength(9);
  });
});

describe('BZE-271 payload reading fails closed', () => {
  it('rejects a payload that is not JSON, not an object, or empty', () => {
    ['', '   ', 'not json', '[]', 'null', '"a string"'].forEach((payload) => {
      expect(() => deserializeContractEventLedger(payload), payload).toThrow(
        ContractEventLedgerPayloadError
      );
    });
  });

  it('rejects a payload written for a different format version', () => {
    const payload = JSON.parse(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    payload.payloadVersion = 2;

    expect(() =>
      deserializeContractEventLedger(JSON.stringify(payload))
    ).toThrow(ContractEventLedgerPayloadError);
  });

  it('rejects a payload with no events array', () => {
    expect(() =>
      deserializeContractEventLedger(
        JSON.stringify({
          payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
          ledgerId: LEDGER_ID,
          ledgerVersion: 1,
        })
      )
    ).toThrow(ContractEventLedgerPayloadError);
  });

  it('re-validates events on read, so a tampered chain is refused', () => {
    const payload = JSON.parse(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    payload.events = payload.events.filter(
      (event: ContractEventRecord) => event.eventId !== 'evt-005'
    );

    expect(() =>
      deserializeContractEventLedger(JSON.stringify(payload))
    ).toThrow(ContractEventLedgerError);
  });

  it('refuses a payload whose timestamps were edited into an invalid chronology', () => {
    const payload = JSON.parse(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    payload.events[0].effectiveAt = '2020-01-01T00:00:00Z';

    expect(() =>
      deserializeContractEventLedger(JSON.stringify(payload))
    ).toThrow(ContractEventLedgerError);
  });

  it('reports payload problems as data through the non-throwing reader', () => {
    const valid = readContractEventLedger(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    expect(valid.state).toBe('valid');
    expect(valid.ledger?.events).toHaveLength(9);
    expect(valid.problems).toEqual([]);

    const unreadable = readContractEventLedger('not json');
    expect(unreadable.state).toBe('invalid');
    expect(unreadable.ledger).toBeNull();
    expect(unreadable.problems[0].at).toBe('payload');

    const payload = JSON.parse(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    payload.events[1].predecessorContractVersion = 42;
    const broken = readContractEventLedger(JSON.stringify(payload));
    expect(broken.state).toBe('invalid');
    expect(broken.problems.map((problem) => problem.kind)).toContain(
      'broken-chain'
    );
  });
});
