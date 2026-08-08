/**
 * FILE: tests/architect/contractHistory/contractStateProjection.test.ts
 * PURPOSE: BZE-271 dated projection — boundaries, determinism, manifests, fail-closed inputs.
 */

import { describe, expect, it } from 'vitest';
import {
  appendContractEvents,
  createContractEventLedger,
  projectContractStateAsOf,
  reviseContractEvent,
  verifyContractProjectionManifest,
  type LifecycleEventLedger,
  type ContractEventRecord,
} from '@/features/architect/utils/contractHistory';
import {
  AS_OF_BEFORE_SIGNING,
  AS_OF_LATE,
  CONTRACT_ID,
  fullLifecycleEvents,
  LEDGER_ID,
  makeEvent,
  PLAYER_ID,
  SALARY_CAP_YEAR,
  signingEvent,
  TEAM_ID,
  twoEventChain,
  WORLD_ID,
} from './contractHistoryFixtures';

function build(events: readonly ContractEventRecord[]): LifecycleEventLedger {
  return createContractEventLedger({
    ledgerId: LEDGER_ID,
    ledgerVersion: 1,
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

describe('BZE-271 deterministic as-of projection', () => {
  it('projects the contract version in force at the requested instant', () => {
    const ledger = build(fullLifecycleEvents());
    const projection = projectAt(ledger, AS_OF_LATE);

    expect(projection.state).toBe('projected');
    expect(projection.contractVersion).toBe(9);
    expect(projection.effectiveEvent?.eventId).toBe('evt-009');
    expect(projection.playerId).toBe(PLAYER_ID);
    expect(projection.teamId).toBe(TEAM_ID);
  });

  it('walks history forward one event at a time', () => {
    const ledger = build(fullLifecycleEvents());

    expect(projectAt(ledger, '2026-07-06T18:00:00Z').contractVersion).toBe(1);
    expect(projectAt(ledger, '2026-08-15T00:00:00Z').contractVersion).toBe(2);
    expect(projectAt(ledger, '2026-10-01T00:00:00Z').contractVersion).toBe(3);
    expect(projectAt(ledger, '2026-11-01T00:00:00Z').contractVersion).toBe(4);
    expect(projectAt(ledger, '2026-11-20T00:00:00Z').contractVersion).toBe(5);
    expect(projectAt(ledger, '2026-12-15T00:00:00Z').contractVersion).toBe(6);
    expect(projectAt(ledger, '2027-02-01T00:00:00Z').contractVersion).toBe(7);
    expect(projectAt(ledger, '2027-02-18T00:00:00Z').contractVersion).toBe(8);
    expect(projectAt(ledger, '2027-02-25T00:00:00Z').contractVersion).toBe(9);
  });

  it('returns the same answer for the same inputs every time', () => {
    const ledger = build(fullLifecycleEvents());
    const first = projectAt(ledger, '2026-12-15T00:00:00Z');
    const second = projectAt(ledger, '2026-12-15T00:00:00Z');

    expect(second.contractVersion).toBe(first.contractVersion);
    expect(second.manifest).toEqual(first.manifest);
  });

  it('is unaffected by the order events were supplied in', () => {
    const events = fullLifecycleEvents();
    const forward = projectAt(build(events), '2026-12-15T00:00:00Z');
    const reversed = projectAt(build([...events].reverse()), '2026-12-15T00:00:00Z');

    expect(reversed.manifest).toEqual(forward.manifest);
  });
});

describe('BZE-271 effective-time boundaries', () => {
  it('includes an event exactly at its effective instant', () => {
    const ledger = build(twoEventChain());
    const atBoundary = projectAt(ledger, '2026-08-01T15:00:00Z');

    expect(atBoundary.state).toBe('projected');
    expect(atBoundary.contractVersion).toBe(2);
  });

  it('excludes the same event one millisecond earlier', () => {
    const ledger = build(twoEventChain());
    const beforeBoundary = projectAt(ledger, '2026-08-01T14:59:59.999Z');

    expect(beforeBoundary.state).toBe('projected');
    expect(beforeBoundary.contractVersion).toBe(1);
    expect(beforeBoundary.futureEvents.map((event) => event.eventId)).toEqual([
      'evt-002',
    ]);
  });

  it('compares the instant, not the calendar day', () => {
    const ledger = build(twoEventChain());

    expect(projectAt(ledger, '2026-08-01T00:00:00Z').contractVersion).toBe(1);
    expect(projectAt(ledger, '2026-08-01T23:00:00Z').contractVersion).toBe(2);
  });

  it('treats an equivalent offset instant as the same boundary', () => {
    const ledger = build(twoEventChain());
    const asUtc = projectAt(ledger, '2026-08-01T15:00:00Z');
    const asOffset = projectAt(ledger, '2026-08-01T11:00:00-04:00');

    expect(asOffset.contractVersion).toBe(asUtc.contractVersion);
    expect(asOffset.consumedEvents).toEqual(asUtc.consumedEvents);
  });

  it('reports history that has not started yet rather than inventing a version', () => {
    const ledger = build(twoEventChain());
    const projection = projectAt(ledger, AS_OF_BEFORE_SIGNING);

    expect(projection.state).toBe('not-yet-effective');
    expect(projection.contractVersion).toBeNull();
    expect(projection.manifest).toBeNull();
    expect(projection.consumedEvents).toEqual([]);
    expect(projection.futureEvents).toHaveLength(2);
    expect(projection.unavailableReasons[0]).toContain('2026-07-06T18:00:00Z');
  });

  it('never lets a future-effective event alter an earlier projection', () => {
    const ledger = build(fullLifecycleEvents());
    const early = projectAt(ledger, '2026-08-15T00:00:00Z');

    expect(early.contractVersion).toBe(2);
    expect(early.consumedEvents.map((event) => event.eventId)).toEqual([
      'evt-001',
      'evt-002',
    ]);
    expect(early.futureEvents).toHaveLength(7);
    expect(
      early.futureEvents.every(
        (event) => Date.parse(event.effectiveAt) > Date.parse('2026-08-15T00:00:00Z')
      )
    ).toBe(true);
  });
});

describe('BZE-271 executed versus effective in projection', () => {
  it('projects on the effective instant, not the executed one', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-05T18:00:00Z',
        effectiveAt: '2026-09-01T18:00:00Z',
        recordedAt: '2026-07-05T18:00:00Z',
      }),
    ]);

    // Executed before this instant, but not yet effective.
    expect(projectAt(ledger, '2026-08-01T00:00:00Z').state).toBe(
      'not-yet-effective'
    );
    expect(projectAt(ledger, '2026-09-01T18:00:00Z').state).toBe('projected');
  });

  it('retains both instants on every consumed event', () => {
    const ledger = build([
      signingEvent({
        executedAt: '2026-07-05T18:00:00Z',
        effectiveAt: '2026-07-06T18:00:00Z',
      }),
    ]);
    const consumed = projectAt(ledger, AS_OF_LATE).consumedEvents[0];

    expect(consumed.executedAt).toBe('2026-07-05T18:00:00Z');
    expect(consumed.effectiveAt).toBe('2026-07-06T18:00:00Z');
    expect(consumed.recordedAt).toBe('2026-07-06T18:00:00Z');
  });
});

describe('BZE-271 no runtime-clock or latest-snapshot fallback', () => {
  it('refuses a request with no as-of date', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: WORLD_ID,
      contractId: CONTRACT_ID,
      salaryCapYear: SALARY_CAP_YEAR,
    });

    expect(projection.state).toBe('unavailable');
    expect(projection.missingInputs).toContain('asOfDate');
    expect(projection.contractVersion).toBeNull();
    expect(projection.unavailableReasons.join(' ')).toContain(
      'no runtime-clock fallback'
    );
  });

  it('refuses a request with no Salary Cap Year', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: WORLD_ID,
      contractId: CONTRACT_ID,
      asOfDate: AS_OF_LATE,
    });

    expect(projection.state).toBe('unavailable');
    expect(projection.missingInputs).toContain('salaryCapYear');
  });

  it('refuses an unzoned or invalid as-of date', () => {
    ['2027-03-01T12:00:00', '2027-03-01', 'today', ''].forEach((asOfDate) => {
      const projection = projectContractStateAsOf({
        ledger: build(twoEventChain()),
        worldId: WORLD_ID,
        contractId: CONTRACT_ID,
        asOfDate,
        salaryCapYear: SALARY_CAP_YEAR,
      });

      expect(projection.state, asOfDate).toBe('unavailable');
      expect(projection.missingInputs).toContain('asOfDate');
    });
  });

  it('refuses an empty request outright', () => {
    const projection = projectContractStateAsOf();

    expect(projection.state).toBe('unavailable');
    expect([...projection.missingInputs].sort()).toEqual([
      'asOfDate',
      'contractId',
      'ledger',
      'salaryCapYear',
      'worldId',
    ]);
  });

  it('refuses a date that does not fall inside the requested Salary Cap Year', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: WORLD_ID,
      contractId: CONTRACT_ID,
      asOfDate: '2027-08-01T12:00:00Z',
      salaryCapYear: SALARY_CAP_YEAR,
    });

    expect(projection.state).toBe('unavailable');
    expect([...projection.missingInputs].sort()).toEqual([
      'asOfDate',
      'salaryCapYear',
    ]);
    expect(projection.unavailableReasons[0]).toContain('does not fall inside');
  });

  it('refuses an unsupported Salary Cap Year', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: WORLD_ID,
      contractId: CONTRACT_ID,
      asOfDate: AS_OF_LATE,
      salaryCapYear: 20.5,
    });

    expect(projection.state).toBe('unavailable');
    expect(projection.missingInputs).toContain('salaryCapYear');
  });
});

describe('BZE-271 unsupported requested history', () => {
  it('refuses a contract the ledger has no events for', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: WORLD_ID,
      contractId: 'contract-unknown',
      asOfDate: AS_OF_LATE,
      salaryCapYear: SALARY_CAP_YEAR,
    });

    expect(projection.state).toBe('unavailable');
    expect(projection.missingInputs).toContain('contractId');
    expect(projection.unavailableReasons[0]).toContain('no current events');
  });

  it('refuses a world the contract does not live in', () => {
    const projection = projectContractStateAsOf({
      ledger: build(twoEventChain()),
      worldId: 'world-other',
      contractId: CONTRACT_ID,
      asOfDate: AS_OF_LATE,
      salaryCapYear: SALARY_CAP_YEAR,
    });

    expect(projection.state).toBe('unavailable');
    expect(projection.missingInputs).toContain('contractId');
  });

  it('does not read a superseded event version', () => {
    const ledger = build([
      signingEvent(),
      makeEvent({
        eventVersion: 1,
        recordStatus: 'superseded',
        resultingContractVersion: 2,
        effectiveAt: '2026-08-01T15:00:00Z',
      }),
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        resultingContractVersion: 2,
        executedAt: '2026-08-01T15:00:00Z',
        effectiveAt: '2026-08-04T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ]);

    expect(projectAt(ledger, '2026-08-02T00:00:00Z').contractVersion).toBe(1);
    expect(projectAt(ledger, '2026-08-05T00:00:00Z').contractVersion).toBe(2);
    expect(
      projectAt(ledger, AS_OF_LATE).consumedEvents.map(
        (event) => event.eventVersion
      )
    ).toEqual([1, 2]);
  });
});

describe('BZE-271 projection manifests', () => {
  it('retains the exact ordered event ids and versions it consumed', () => {
    const ledger = build(fullLifecycleEvents());
    const manifest = projectAt(ledger, '2026-11-20T00:00:00Z').manifest;

    expect(manifest?.manifestVersion).toBe(1);
    expect(
      manifest?.consumedEvents.map((event) => `${event.eventId}@v${event.eventVersion}`)
    ).toEqual([
      'evt-001@v1',
      'evt-002@v1',
      'evt-003@v1',
      'evt-004@v1',
      'evt-005@v1',
    ]);
    expect(manifest?.resultingContractVersion).toBe(5);
  });

  it('retains the ledger, subject, date, and season the projection was taken under', () => {
    const ledger = build(twoEventChain());
    const manifest = projectAt(ledger, AS_OF_LATE).manifest;

    expect(manifest?.ledger).toEqual({ ledgerId: LEDGER_ID, ledgerVersion: 1 });
    expect(manifest?.worldId).toBe(WORLD_ID);
    expect(manifest?.contractId).toBe(CONTRACT_ID);
    expect(manifest?.playerId).toBe(PLAYER_ID);
    expect(manifest?.teamId).toBe(TEAM_ID);
    expect(manifest?.asOfDate).toBe(AS_OF_LATE);
    expect(manifest?.salaryCapYear).toBe(SALARY_CAP_YEAR);
    expect(manifest?.seasonKey).toBe('2026-27');
  });

  it('freezes the projection and its manifest to the leaves', () => {
    const projection = projectAt(build(twoEventChain()), AS_OF_LATE);

    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.manifest)).toBe(true);
    expect(Object.isFrozen(projection.consumedEvents)).toBe(true);
    projection.consumedEvents.forEach((event) => {
      expect(Object.isFrozen(event)).toBe(true);
    });
  });

  it('carries no manifest on an unavailable or not-yet-effective result', () => {
    expect(projectContractStateAsOf().manifest).toBeNull();
    expect(
      projectAt(build(twoEventChain()), AS_OF_BEFORE_SIGNING).manifest
    ).toBeNull();
  });
});

describe('BZE-271 an earlier projection survives later history', () => {
  it('keeps the version and manifest it was computed from after an append', () => {
    const original = build(twoEventChain());
    const earlier = projectAt(original, '2026-08-15T00:00:00Z');

    const extended = appendContractEvents(original, [
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

    expect(earlier.contractVersion).toBe(2);
    expect(earlier.manifest?.consumedEvents).toHaveLength(2);
    expect(earlier.manifest?.ledger.ledgerVersion).toBe(1);
    expect(projectAt(extended, AS_OF_LATE).contractVersion).toBe(3);
    expect(projectAt(extended, '2026-08-15T00:00:00Z').contractVersion).toBe(2);
  });

  it('reports drift instead of rewriting a manifest when an event is revised', () => {
    const original = build(twoEventChain());
    const earlier = projectAt(original, AS_OF_LATE);

    const revised = build([
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
        executedAt: '2026-08-01T15:00:00Z',
        effectiveAt: '2026-08-03T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      }),
    ]);

    expect(verifyContractProjectionManifest(earlier.manifest, original)).toEqual({
      state: 'unchanged',
      drift: [],
    });

    const drifted = verifyContractProjectionManifest(earlier.manifest, revised);
    expect(drifted.state).toBe('drifted');
    expect(drifted.drift.map((entry) => entry.kind).sort()).toEqual([
      'event-superseded',
      'history-extended',
    ]);
    expect(earlier.manifest?.consumedEvents[1].eventVersion).toBe(1);
  });

  it('reports an absent event rather than silently dropping it', () => {
    const original = build(twoEventChain());
    const earlier = projectAt(original, AS_OF_LATE);
    const trimmed = build([signingEvent()]);

    const drifted = verifyContractProjectionManifest(earlier.manifest, trimmed);
    expect(drifted.state).toBe('drifted');
    expect(drifted.drift[0].kind).toBe('event-absent');
    expect(drifted.drift[0].eventId).toBe('evt-002');
  });

  it('reports history that has grown under an existing as-of date', () => {
    const original = build([signingEvent()]);
    const earlier = projectAt(original, AS_OF_LATE);
    const grown = appendContractEvents(original, [makeEvent()]);

    const drifted = verifyContractProjectionManifest(earlier.manifest, grown);
    expect(drifted.state).toBe('drifted');
    expect(drifted.drift.map((entry) => entry.kind)).toEqual(['history-extended']);
    expect(earlier.contractVersion).toBe(1);
  });

  it('survives an append-only revision, keeping the version it consumed', () => {
    const original = build(twoEventChain());
    const earlier = projectAt(original, AS_OF_LATE);

    const revised = reviseContractEvent(
      original,
      makeEvent({
        eventVersion: 2,
        recordStatus: 'current',
        supersedesEventVersion: 1,
        executedAt: '2026-08-01T15:00:00Z',
        effectiveAt: '2026-08-03T15:00:00Z',
        recordedAt: '2026-09-01T15:00:00Z',
      })
    );

    expect(earlier.contractVersion).toBe(2);
    expect(earlier.manifest?.consumedEvents[1].eventVersion).toBe(1);
    expect(earlier.manifest?.consumedEvents[1].effectiveAt).toBe(
      '2026-08-01T15:00:00Z'
    );

    // The revised ledger projects the revised effective instant.
    expect(projectAt(revised, '2026-08-02T00:00:00Z').contractVersion).toBe(1);
    expect(projectAt(revised, '2026-08-04T00:00:00Z').contractVersion).toBe(2);

    const drifted = verifyContractProjectionManifest(earlier.manifest, revised);
    expect(drifted.state).toBe('drifted');
    expect(drifted.drift.map((entry) => entry.kind)).toContain(
      'event-superseded'
    );
  });

  it('reports every retained field that moved under an unchanged identity', () => {
    const original = build(twoEventChain());
    const manifest = projectAt(original, AS_OF_LATE).manifest;

    // Same ledger identity, same event identity, different retained content.
    const forged = createContractEventLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      events: [
        signingEvent(),
        makeEvent({
          eventKind: 'conversion',
          executedAt: '2026-08-05T15:00:00Z',
          effectiveAt: '2026-08-06T15:00:00Z',
          recordedAt: '2026-08-07T15:00:00Z',
          sourceTransactionId: null,
          authoringIdentity: 'gm-console',
        }),
      ],
    });

    const drifted = verifyContractProjectionManifest(manifest, forged);
    expect(drifted.state).toBe('drifted');
    const changed = drifted.drift.find(
      (entry) => entry.kind === 'event-content-changed'
    );
    expect(changed).toBeDefined();
    [
      'eventKind',
      'executedAt',
      'effectiveAt',
      'recordedAt',
      'sourceTransactionId',
      'authoringIdentity',
    ].forEach((field) => {
      expect(changed?.detail, field).toContain(field);
    });
  });

  it('compares every non-identity field a projection event carries', () => {
    // `eventId` and `eventVersion` are the identity the manifest matches on, so
    // they cannot drift without becoming `event-absent`. Every remaining field
    // must be compared, one at a time.
    const alterations: Record<string, Record<string, unknown>> = {
      eventKind: { eventKind: 'conversion' },
      executedAt: { executedAt: '2026-07-20T15:00:00Z' },
      effectiveAt: { effectiveAt: '2026-08-09T15:00:00Z' },
      recordedAt: { recordedAt: '2026-10-01T15:00:00Z' },
      resultingContractVersion: { resultingContractVersion: 3 },
      sourceTransactionId: {
        sourceTransactionId: null,
        authoringIdentity: 'gm-console',
      },
      authoringIdentity: { authoringIdentity: 'gm-console' },
    };

    const manifest = projectAt(build(twoEventChain()), AS_OF_LATE).manifest;

    Object.entries(alterations).forEach(([field, overrides]) => {
      const forged = createContractEventLedger({
        ledgerId: LEDGER_ID,
        ledgerVersion: 1,
        events: [signingEvent(), makeEvent(overrides)],
      });

      const drifted = verifyContractProjectionManifest(manifest, forged);
      expect(drifted.state, field).toBe('drifted');
      const changed = drifted.drift.find(
        (entry) => entry.kind === 'event-content-changed'
      );
      expect(changed?.detail, field).toContain(field);
    });
  });

  it('compares predecessorContractVersion too', () => {
    // Altering the consumed version alone would break the chain, so the whole
    // chain is renumbered; the manifest's consumed event still names version 1.
    const manifest = projectAt(build(twoEventChain()), AS_OF_LATE).manifest;
    const renumbered = createContractEventLedger({
      ledgerId: LEDGER_ID,
      ledgerVersion: 1,
      events: [
        signingEvent({ resultingContractVersion: 5 }),
        makeEvent({ predecessorContractVersion: 5, resultingContractVersion: 6 }),
      ],
    });

    const drifted = verifyContractProjectionManifest(manifest, renumbered);
    expect(drifted.state).toBe('drifted');
    expect(
      drifted.drift
        .filter((entry) => entry.kind === 'event-content-changed')
        .map((entry) => entry.detail)
        .join(' ')
    ).toContain('predecessorContractVersion');
  });

  it('pins the projection-event shape so a new field cannot escape drift checks', () => {
    // If a field is added to a projection event without being added to the
    // drift comparison, this fails and points at the omission.
    const consumed = projectAt(build(twoEventChain()), AS_OF_LATE)
      .consumedEvents[0];

    expect(Object.keys(consumed).sort()).toEqual([
      'authoringIdentity',
      'effectiveAt',
      'eventId',
      'eventKind',
      'eventVersion',
      'executedAt',
      'predecessorContractVersion',
      'recordedAt',
      'resultingContractVersion',
      'sourceTransactionId',
    ]);
  });

  it('is not comparable against a different ledger identity', () => {
    const manifest = projectAt(build(twoEventChain()), AS_OF_LATE).manifest;
    const otherLedger = createContractEventLedger({
      ledgerId: 'ledger-somewhere-else',
      ledgerVersion: 1,
      events: twoEventChain(),
    });

    expect(verifyContractProjectionManifest(manifest, otherLedger)).toEqual({
      state: 'not-comparable',
      drift: [],
    });
  });

  it('is not comparable without both a manifest and a ledger', () => {
    expect(verifyContractProjectionManifest(null, build([]))).toEqual({
      state: 'not-comparable',
      drift: [],
    });
    expect(
      verifyContractProjectionManifest(
        projectAt(build(twoEventChain()), AS_OF_LATE).manifest,
        null
      )
    ).toEqual({ state: 'not-comparable', drift: [] });
  });
});

describe('BZE-271 projection needs no cap, floor, tax, or apron value', () => {
  it('projects from a ledger alone, with no governed money envelope supplied', () => {
    const projection = projectAt(build(fullLifecycleEvents()), AS_OF_LATE);

    expect(projection.state).toBe('projected');

    // Content, not insertion order: the manifest carries exactly the identity,
    // dating, and provenance a replay needs.
    const manifestKeys = Object.keys(projection.manifest ?? {}).sort();
    expect(manifestKeys).toEqual([
      'asOfDate',
      'consumedEvents',
      'contractId',
      'ledger',
      'manifestVersion',
      'playerId',
      'resultingContractVersion',
      'salaryCapYear',
      'seasonKey',
      'teamId',
      'worldId',
    ]);
  });

  it('admits no Salary Cap, floor, Tax, or apron value anywhere in the result', () => {
    const projection = projectAt(build(fullLifecycleEvents()), AS_OF_LATE);

    // `salaryCapYear` is a year label, not a money value, and is the only key
    // allowed to contain the word "cap". Everything else is money and is absent.
    const MONEY_KEYS = [
      'salaryCap',
      'salaryCapAmount',
      'minimumTeamSalary',
      'floor',
      'taxLevel',
      'tax',
      'firstApron',
      'secondApron',
      'apron',
      'teamSalary',
      'capRoom',
    ];

    const surfaces: Record<string, unknown>[] = [
      projection as unknown as Record<string, unknown>,
      (projection.manifest ?? {}) as Record<string, unknown>,
      ...projection.consumedEvents.map(
        (event) => event as unknown as Record<string, unknown>
      ),
    ];

    surfaces.forEach((surface, index) => {
      MONEY_KEYS.forEach((key) => {
        expect(Object.keys(surface), `${key} at surface ${index}`).not.toContain(
          key
        );
      });
    });

    // And nothing anywhere in the serialized result names a money input.
    const serialized = JSON.stringify(projection);
    MONEY_KEYS.filter((key) => key !== 'tax' && key !== 'apron').forEach(
      (key) => {
        expect(serialized, key).not.toContain(`"${key}"`);
      }
    );
  });
});
