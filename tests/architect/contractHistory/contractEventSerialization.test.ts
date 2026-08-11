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
  validateContractEventLedger,
  verifyContractProjectionManifest,
  type ContractEventRecord,
  type LifecycleEventLedger,
  type LifecycleLedgerProblem,
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

function build(events: readonly ContractEventRecord[]): LifecycleEventLedger {
  return createContractEventLedger({
    ledgerId: LEDGER_ID,
    ledgerVersion: 3,
    events,
  });
}

function projectAt(ledger: LifecycleEventLedger, asOfDate: string) {
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
    payload.payloadVersion = 1;

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

  it('validates every payload event at runtime, not just at the type level', () => {
    // The payload is untrusted JSON, so each element gets the same total
    // field validation an in-memory event does. Nothing is trusted because
    // TypeScript was told it is a record.
    const garbage: unknown[] = [
      null,
      'a string',
      42,
      [],
      {},
      { eventId: 'evt-x' },
      { ...signingEvent(), eventKind: 'buyout' },
      { ...signingEvent(), effectiveAt: 12345 },
      { ...signingEvent(), canonLeafIds: 'CBA2-L02.1' },
      { ...signingEvent(), eventVersion: '1' },
    ];

    garbage.forEach((event) => {
      const payload = JSON.stringify({
        payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [event],
      });

      expect(
        () => deserializeContractEventLedger(payload),
        JSON.stringify(event)
      ).toThrow(ContractEventLedgerError);

      const read = readContractEventLedger(payload);
      expect(read.state, JSON.stringify(event)).toBe('invalid');
      expect(read.ledger).toBeNull();
      expect(read.problems.length).toBeGreaterThan(0);
    });
  });

  it('drops no field on a round-trip, so a restored event deep-equals the original', () => {
    const ledger = build(revisedHistory());
    const restored = deserializeContractEventLedger(
      serializeContractEventLedger(ledger)
    );

    restored.events.forEach((event, index) => {
      expect(Object.keys(event).sort()).toEqual(
        Object.keys(ledger.events[index]).sort()
      );
    });
  });

  it('reports payload problems as data through the non-throwing reader', () => {
    const valid = readContractEventLedger(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    expect(valid.state).toBe('valid');
    expect(valid.ledger?.events).toHaveLength(9);
    expect(valid.problems).toEqual([]);

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

  it('classifies an unreadable envelope honestly, not as a record defect', () => {
    // Each of these is a failure of the container. Nothing about any individual
    // record has been established, so reporting a record-level kind such as
    // `missing-identity` would name a defect the reader never checked for.
    const envelopeFailures: Record<string, string> = {
      'not json': 'payload is not valid JSON',
      '': 'payload is empty',
      '   ': 'payload is empty',
      '[]': 'payload is not an object',
      null: 'payload is not an object',
      '"a string"': 'payload is not an object',
      [JSON.stringify({
        payloadVersion: 1,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [],
      })]: 'payload version 1 is not the supported version 2',
      [JSON.stringify({
        payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
      })]: 'payload has no events array',
    };

    Object.entries(envelopeFailures).forEach(([serialized, expectedDetail]) => {
      const read = readContractEventLedger(serialized);

      expect(read.state, serialized).toBe('invalid');
      expect(read.ledger).toBeNull();
      expect(read.problems, serialized).toHaveLength(1);
      expect(read.problems[0].kind, serialized).toBe('unreadable-payload');
      expect(read.problems[0].at, serialized).toBe('payload');
      expect(read.problems[0].detail, serialized).toContain(expectedDetail);
    });
  });

  it('reports a bad ledger identity or version distinctly from an unreadable envelope', () => {
    const withLedgerId = (ledgerId: unknown, ledgerVersion: unknown) =>
      readContractEventLedger(
        JSON.stringify({
          payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
          ledgerId,
          ledgerVersion,
          events: [],
        })
      );

    const blankId = withLedgerId('   ', 1);
    expect(blankId.state).toBe('invalid');
    expect(blankId.problems.map((problem) => problem.kind)).toContain(
      'missing-identity'
    );

    const badVersion = withLedgerId(LEDGER_ID, '1');
    expect(badVersion.state).toBe('invalid');
    expect(badVersion.problems.map((problem) => problem.kind)).toContain(
      'missing-version'
    );
  });
});

describe('BZE-271 canonical runtime schema is the one contract', () => {
  /** A payload carrying exactly one event, built from a valid signing. */
  function payloadWith(overrides: Record<string, unknown>): string {
    return JSON.stringify({
      payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      events: [{ ...signingEvent(), ...overrides }],
    });
  }

  it('rejects a numeric sourceTransactionId even when authoringIdentity is valid', () => {
    // The regression this closes: the previous check asked only whether at
    // least ONE provenance field was a non-empty string, so a number in the
    // other one passed and was stored under a `string | null` field.
    const payload = payloadWith({
      sourceTransactionId: 42,
      authoringIdentity: 'gm-console',
    });

    expect(() => deserializeContractEventLedger(payload)).toThrow(
      ContractEventLedgerError
    );
    const read = readContractEventLedger(payload);
    expect(read.state).toBe('invalid');
    expect(read.problems.map((problem) => problem.kind)).toContain(
      'missing-provenance'
    );
  });

  it('rejects a numeric authoringIdentity even when sourceTransactionId is valid', () => {
    const payload = payloadWith({
      sourceTransactionId: 'txn-0001',
      authoringIdentity: 99,
    });

    expect(() => deserializeContractEventLedger(payload)).toThrow(
      ContractEventLedgerError
    );
    expect(
      readContractEventLedger(payload).problems.map((problem) => problem.kind)
    ).toContain('missing-provenance');
  });

  it('rejects the same numeric provenance on the in-memory path', () => {
    // Both entry points run the same canonical schema, so neither is a laxer
    // door into the ledger.
    (
      [
        { sourceTransactionId: 42, authoringIdentity: 'gm-console' },
        { sourceTransactionId: 'txn-0001', authoringIdentity: 99 },
      ] as const
    ).forEach((overrides) => {
      const validation = validateContractEventLedger({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [
          {
            ...signingEvent(),
            ...overrides,
          } as unknown as ContractEventRecord,
        ],
      });

      expect(validation.state, JSON.stringify(overrides)).toBe('invalid');
      expect(validation.problems.map((problem) => problem.kind)).toContain(
        'missing-provenance'
      );
    });
  });

  it('accepts only a valid string or null in each provenance field', () => {
    // Valid: a real string in either slot, or one slot null.
    expect(() =>
      deserializeContractEventLedger(
        payloadWith({ sourceTransactionId: null, authoringIdentity: 'gm' })
      )
    ).not.toThrow();
    expect(() =>
      deserializeContractEventLedger(
        payloadWith({ sourceTransactionId: 'txn-1', authoringIdentity: null })
      )
    ).not.toThrow();

    // Invalid: both absent, a blank string standing in for an identity, or a
    // non-string value of any kind. Every value here survives JSON encoding, so
    // each case really does reach the schema as a wrong-typed value rather than
    // as an absent key.
    (
      [
        { sourceTransactionId: null, authoringIdentity: null },
        { sourceTransactionId: '   ', authoringIdentity: null },
        { sourceTransactionId: null, authoringIdentity: '  ' },
        { sourceTransactionId: true, authoringIdentity: null },
        { sourceTransactionId: null, authoringIdentity: {} },
        { sourceTransactionId: [], authoringIdentity: null },
        { sourceTransactionId: 0, authoringIdentity: 'gm' },
        { sourceTransactionId: 'txn-1', authoringIdentity: 0 },
      ] as Record<string, unknown>[]
    ).forEach((overrides) => {
      const payload = payloadWith(overrides);

      // Guard the test's own premise: the key must actually be present in the
      // encoded payload, or the case would be testing omission by accident.
      const encodedEvent = JSON.parse(payload).events[0];
      expect(
        Object.keys(encodedEvent),
        JSON.stringify(overrides)
      ).toContain('sourceTransactionId');

      expect(
        () => deserializeContractEventLedger(payload),
        JSON.stringify(overrides)
      ).toThrow(ContractEventLedgerError);
    });
  });

  it('rejects an omitted provenance key, distinctly from a wrong-typed one', () => {
    // `JSON.stringify` drops a key whose value is `undefined`, so an omitted
    // key and a wrong-typed one are different inputs and are tested separately.
    (['sourceTransactionId', 'authoringIdentity'] as const).forEach((field) => {
      const event: Record<string, unknown> = { ...signingEvent() };
      delete event[field];

      const payload = JSON.stringify({
        payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [event],
      });

      expect(Object.keys(JSON.parse(payload).events[0]), field).not.toContain(
        field
      );
      expect(() => deserializeContractEventLedger(payload), field).toThrow(
        ContractEventLedgerError
      );
      expect(readContractEventLedger(payload).state, field).toBe('invalid');
    });
  });

  it('rejects an unexpected key on the envelope itself', () => {
    // The decoded envelope reaches the strict payload schema whole, so a
    // top-level key nobody declared is refused rather than quietly dropped.
    const payload = JSON.parse(
      serializeContractEventLedger(build(fullLifecycleEvents()))
    );
    payload.smuggledCapRoom = 12_345_678;

    const serialized = JSON.stringify(payload);
    expect(() => deserializeContractEventLedger(serialized)).toThrow(
      ContractEventLedgerError
    );

    const read = readContractEventLedger(serialized);
    expect(read.state).toBe('invalid');
    expect(read.problems.map((problem) => problem.kind)).toContain(
      'unsupported-field'
    );
    expect(read.problems.map((problem) => problem.at)).toContain('payload');
    expect(
      read.problems.map((problem) => problem.detail).join(' ')
    ).toContain('smuggledCapRoom');
  });

  it('validates payloadVersion through the canonical literal, not only the envelope check', () => {
    // Envelope reading rejects a mismatched version as `unreadable-payload`;
    // the canonical schema's literal is the second, independent guard on the
    // same field, so neither can be bypassed by editing the other.
    const withVersion = (payloadVersion: unknown) =>
      readContractEventLedger(
        JSON.stringify({
          payloadVersion,
          ledgerId: LEDGER_ID,
          ledgerVersion: 1,
          events: [],
        })
      );

    [1, 0, '2', null, 1.5].forEach((version) => {
      const read = withVersion(version);
      expect(read.state, String(version)).toBe('invalid');
      expect(read.ledger).toBeNull();
    });

    expect(withVersion(CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION).state).toBe(
      'valid'
    );
  });

  it('checks the runtime type of every declared field', () => {
    const wrongTypes: Record<string, unknown>[] = [
      { eventId: 7 },
      { eventVersion: '1' },
      { eventVersion: 1.5 },
      { eventVersion: 0 },
      { eventKind: 'buyout' },
      { eventKind: 3 },
      { worldId: null },
      { contractId: {} },
      { playerId: [] },
      { teamId: false },
      { executedAt: 12345 },
      { effectiveAt: null },
      { recordedAt: { at: 'now' } },
      { predecessorContractVersion: 'v1' },
      { resultingContractVersion: '1' },
      { resultingContractVersion: null },
      { predecessorEventId: 12 },
      { recordStatus: 'archived' },
      { recordStatus: null },
      { supersedesEventVersion: '1' },
      { canonLeafIds: 'CBA2-L02.1' },
      { canonLeafIds: [] },
      { canonLeafIds: [7] },
      { canonLeafIds: ['  '] },
      { canonLeafIds: null },
    ];

    wrongTypes.forEach((overrides) => {
      expect(
        () => deserializeContractEventLedger(payloadWith(overrides)),
        JSON.stringify(overrides)
      ).toThrow(ContractEventLedgerError);

      const read = readContractEventLedger(payloadWith(overrides));
      expect(read.state, JSON.stringify(overrides)).toBe('invalid');
      expect(read.ledger).toBeNull();
    });
  });

  it('rejects a field the canonical schema does not declare', () => {
    const payload = payloadWith({ smuggledMoney: 154_647_000 });

    expect(() => deserializeContractEventLedger(payload)).toThrow(
      ContractEventLedgerError
    );
    expect(
      readContractEventLedger(payload).problems.map((problem) => problem.kind)
    ).toContain('unsupported-field');
  });

  it('rejects nulls, primitives, arrays, and partial records as events', () => {
    const notRecords: unknown[] = [
      null,
      42,
      'evt-001',
      true,
      [],
      {},
      { eventId: 'evt-001' },
      [{ ...signingEvent() }],
    ];

    notRecords.forEach((element) => {
      const payload = JSON.stringify({
        payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [element],
      });

      expect(
        () => deserializeContractEventLedger(payload),
        JSON.stringify(element)
      ).toThrow(ContractEventLedgerError);
      expect(
        readContractEventLedger(payload).state,
        JSON.stringify(element)
      ).toBe('invalid');
    });
  });

  it('holds the throwing and non-throwing readers to identical problems', () => {
    const payloads = [
      payloadWith({ sourceTransactionId: 42, authoringIdentity: 'gm' }),
      payloadWith({ effectiveAt: 12345 }),
      payloadWith({ canonLeafIds: [] }),
      payloadWith({ smuggledMoney: 1 }),
      payloadWith({ eventKind: 'buyout' }),
    ];

    payloads.forEach((payload) => {
      let thrown: LifecycleLedgerProblem[] = [];
      try {
        deserializeContractEventLedger(payload);
        throw new Error(`expected a refusal for ${payload}`);
      } catch (error) {
        expect(error, payload).toBeInstanceOf(ContractEventLedgerError);
        thrown = [...(error as ContractEventLedgerError).problems];
      }

      const read = readContractEventLedger(payload);
      expect(read.state).toBe('invalid');
      expect(
        read.problems.map((problem) => `${problem.kind}@${problem.at}`),
        payload
      ).toEqual(thrown.map((problem) => `${problem.kind}@${problem.at}`));
    });
  });

  it('names the offending event index so a large payload is diagnosable', () => {
    const events = fullLifecycleEvents().map((event, index) =>
      index === 4 ? { ...event, effectiveAt: 12345 } : event
    );
    const read = readContractEventLedger(
      JSON.stringify({
        payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events,
      })
    );

    expect(read.state).toBe('invalid');
    expect(read.problems.map((problem) => problem.at)).toContain(
      'events[4].effectiveAt'
    );
  });

  it('never emits a payload its own reader would reject', () => {
    const serialized = serializeContractEventLedger(build(revisedHistory()));

    expect(() => deserializeContractEventLedger(serialized)).not.toThrow();
    expect(readContractEventLedger(serialized).state).toBe('valid');
  });
});
