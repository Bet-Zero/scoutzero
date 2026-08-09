/**
 * Validated immutable record layer for BZE-273's team-scoped rights history.
 */

import {
  RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
  RightsEventLedgerPayloadZ,
  RightsEventRecordZ,
  type RightsEventLedgerPayload,
  type RightsEventRecord,
} from '@/schemas/rightsEventLedger';
import {
  isDateOnly,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';

export type RightsLedgerProblemKind =
  | 'invalid-payload'
  | 'invalid-date'
  | 'duplicate-version'
  | 'competing-current-version'
  | 'broken-chain'
  | 'chain-fork'
  | 'identity-mismatch';

export interface RightsLedgerProblem {
  readonly kind: RightsLedgerProblemKind;
  readonly at: string;
  readonly detail: string;
}

export class RightsEventLedgerError extends Error {
  readonly problems: readonly RightsLedgerProblem[];

  constructor(problems: readonly RightsLedgerProblem[]) {
    super(
      `Invalid rights event ledger: ${problems
        .map((entry) => `${entry.kind} at ${entry.at}`)
        .join('; ')}`
    );
    this.name = 'RightsEventLedgerError';
    this.problems = Object.freeze(
      problems.map((entry) => Object.freeze({ ...entry }))
    );
  }
}

function problem(
  kind: RightsLedgerProblemKind,
  at: string,
  detail: string
): RightsLedgerProblem {
  return { kind, at, detail };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function validateSourceDates(
  event: RightsEventRecord,
  index: number,
  problems: RightsLedgerProblem[]
): void {
  if (event.eventKind !== 'rights-established') return;

  const sources = [
    event.priorContract.source,
    ...event.serviceSeasons.map((entry) => entry.source),
    ...event.amountRecords.map((entry) => entry.source),
  ];
  sources.forEach((source, sourceIndex) => {
    if (
      !isDateOnly(source.effectiveFrom) ||
      !isDateOnly(source.effectiveThrough) ||
      source.effectiveFrom > source.effectiveThrough
    ) {
      problems.push(
        problem(
          'invalid-date',
          `events[${index}].sources[${sourceIndex}]`,
          'source effective bounds must be ordered ISO calendar dates'
        )
      );
    }
  });
}

function comparableEventTime(value: string): number {
  if (isDateOnly(value)) return Date.parse(`${value}T00:00:00Z`);
  return parseZonedDateTime(value) ?? Number.NaN;
}

/** Validate and freeze an untrusted payload at the canonical Zod boundary. */
export function createRightsEventLedger(
  input: unknown
): RightsEventLedgerPayload {
  const parsed = RightsEventLedgerPayloadZ.safeParse(input);
  if (!parsed.success) {
    throw new RightsEventLedgerError(
      parsed.error.issues.map((issue) =>
        problem('invalid-payload', issue.path.join('.') || 'payload', issue.message)
      )
    );
  }

  const ledger = parsed.data;
  const problems: RightsLedgerProblem[] = [];
  const versionKeys = new Set<string>();
  const versionsByEvent = new Map<string, RightsEventRecord[]>();
  const currentByEvent = new Map<string, RightsEventRecord>();
  const currentStateVersions = new Set<string>();

  ledger.events.forEach((event, index) => {
    if (event.worldId !== ledger.worldId || event.teamId !== ledger.teamId) {
      problems.push(
        problem(
          'identity-mismatch',
          `events[${index}]`,
          'event world/team identity must match its ledger envelope'
        )
      );
    }
    for (const field of ['executedAt', 'effectiveAt'] as const) {
      if (!isZonedDateTime(event[field]) && !isDateOnly(event[field])) {
        problems.push(
          problem(
            'invalid-date',
            `events[${index}].${field}`,
            'execution/effectiveness must be an ISO calendar date or zoned instant'
          )
        );
      }
    }
    if (!isZonedDateTime(event.recordedAt)) {
      problems.push(
        problem(
          'invalid-date',
          `events[${index}].recordedAt`,
          'recordedAt must be a zoned ISO-8601 instant'
        )
      );
    }
    const executed = comparableEventTime(event.executedAt);
    const effective = comparableEventTime(event.effectiveAt);
    const recorded = comparableEventTime(event.recordedAt);
    if (recorded < executed) {
      problems.push(
        problem(
          'invalid-date',
          `events[${index}].recordedAt`,
          'recordedAt cannot precede execution'
        )
      );
    }
    if (effective < executed) {
      problems.push(
        problem(
          'invalid-date',
          `events[${index}].effectiveAt`,
          'effectiveness cannot precede execution'
        )
      );
    }

    validateSourceDates(event, index, problems);

    const versionKey = `${event.eventId}@${event.eventVersion}`;
    if (versionKeys.has(versionKey)) {
      problems.push(
        problem('duplicate-version', `events[${index}]`, versionKey)
      );
    }
    versionKeys.add(versionKey);
    const eventVersions = versionsByEvent.get(event.eventId) ?? [];
    eventVersions.push(event);
    versionsByEvent.set(event.eventId, eventVersions);

    if (event.recordStatus === 'current') {
      if (currentByEvent.has(event.eventId)) {
        problems.push(
          problem(
            'competing-current-version',
            `events[${index}]`,
            `event ${event.eventId} has more than one current version`
          )
        );
      }
      currentByEvent.set(event.eventId, event);
      const stateVersionKey = `${event.resultingState.stateId}@v${event.resultingState.stateVersion}`;
      if (currentStateVersions.has(stateVersionKey)) {
        problems.push(
          problem(
            'duplicate-version',
            `events[${index}].resultingState`,
            `state ${stateVersionKey} is produced more than once`
          )
        );
      }
      currentStateVersions.add(stateVersionKey);
    }
  });

  for (const [eventId, eventVersions] of versionsByEvent) {
    const ordered = [...eventVersions].sort(
      (left, right) => left.eventVersion - right.eventVersion
    );
    ordered.forEach((event, index) => {
      const expectedVersion = index + 1;
      const expectedSuperseded = index < ordered.length - 1;
      if (
        event.eventVersion !== expectedVersion ||
        event.supersedesEventVersion !==
          (expectedVersion === 1 ? null : expectedVersion - 1) ||
        event.recordStatus !== (expectedSuperseded ? 'superseded' : 'current')
      ) {
        problems.push(
          problem(
            'duplicate-version',
            `${eventId}@v${event.eventVersion}`,
            'event versions must form a contiguous append-only supersession chain with only the highest version current'
          )
        );
      }
    });
  }

  const currentEvents = [...currentByEvent.values()];
  const currentIds = new Set(currentEvents.map((event) => event.eventId));
  const predecessorCounts = new Map<string, number>();
  for (const event of currentEvents) {
    if (event.eventKind === 'rights-established') {
      if (event.predecessorEventId !== null || event.predecessorState !== null) {
        problems.push(
          problem(
            'broken-chain',
            event.eventId,
            'rights-established must be the root of a rights chain'
          )
        );
      }
      continue;
    }
    if (
      !event.predecessorEventId ||
      !currentIds.has(event.predecessorEventId) ||
      !event.predecessorState
    ) {
      problems.push(
        problem(
          'broken-chain',
          event.eventId,
          'a non-root rights event must consume a current predecessor event and state'
        )
      );
      continue;
    }
    const predecessor = currentByEvent.get(event.predecessorEventId);
    if (
      !predecessor ||
      predecessor.playerId !== event.playerId ||
      predecessor.salaryCapYear !== event.salaryCapYear ||
      predecessor.resultingState.stateId !== event.predecessorState.stateId ||
      predecessor.resultingState.stateVersion !==
        event.predecessorState.stateVersion ||
      (event.eventKind === 'early-bird-election' &&
        (event.sourceRightsState.stateId !== event.predecessorState.stateId ||
          event.sourceRightsState.stateVersion !==
            event.predecessorState.stateVersion)) ||
      event.resultingState.stateVersion !==
        event.predecessorState.stateVersion + 1 ||
      comparableEventTime(predecessor.effectiveAt) >
        comparableEventTime(event.effectiveAt)
    ) {
      problems.push(
        problem(
          'broken-chain',
          event.eventId,
          'predecessor state identity/version does not match the consumed event'
        )
      );
    }
    const count = (predecessorCounts.get(event.predecessorEventId) ?? 0) + 1;
    predecessorCounts.set(event.predecessorEventId, count);
    if (count > 1) {
      problems.push(
        problem(
          'chain-fork',
          event.predecessorEventId,
          'one current state cannot have multiple current successors'
        )
      );
    }
  }

  const eventsByChain = new Map<string, RightsEventRecord[]>();
  for (const event of currentEvents) {
    const chainKey = `${event.playerId}|${event.salaryCapYear}`;
    const entries = eventsByChain.get(chainKey) ?? [];
    entries.push(event);
    eventsByChain.set(chainKey, entries);
  }
  for (const [chainKey, chainEvents] of eventsByChain) {
    const roots = chainEvents.filter(
      (event) => event.eventKind === 'rights-established'
    );
    if (roots.length !== 1) {
      problems.push(
        problem(
          'broken-chain',
          chainKey,
          'each player and Salary Cap Year must have exactly one current rights-establishment root'
        )
      );
      continue;
    }
    const successorByEventId = new Map<string, RightsEventRecord>();
    for (const event of chainEvents) {
      if (event.predecessorEventId) {
        successorByEventId.set(event.predecessorEventId, event);
      }
    }
    const reached = new Set<string>();
    let cursor: RightsEventRecord | undefined = roots[0];
    while (cursor && !reached.has(cursor.eventId)) {
      reached.add(cursor.eventId);
      cursor = successorByEventId.get(cursor.eventId);
    }
    if (reached.size !== chainEvents.length) {
      problems.push(
        problem(
          'broken-chain',
          chainKey,
          'every current event must be reachable exactly once from its player/year root'
        )
      );
    }
  }

  if (problems.length > 0) throw new RightsEventLedgerError(problems);
  return deepFreeze(ledger) as RightsEventLedgerPayload;
}

export function createEmptyRightsEventLedger({
  ledgerId,
  worldId,
  teamId,
}: {
  ledgerId: string;
  worldId: string;
  teamId: string;
}): RightsEventLedgerPayload {
  return createRightsEventLedger({
    payloadVersion: RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId,
    ledgerVersion: 1,
    worldId,
    teamId,
    events: [],
  });
}

/** Append one canonical event; the input ledger and all prior records stay frozen. */
export function appendRightsEvent(
  ledgerInput: unknown,
  eventInput: unknown
): RightsEventLedgerPayload {
  const ledger = createRightsEventLedger(ledgerInput);
  const event = RightsEventRecordZ.parse(eventInput);
  return createRightsEventLedger({
    ...ledger,
    ledgerVersion: ledger.ledgerVersion + 1,
    events: [...ledger.events, event],
  });
}

/**
 * Publish a corrected version of one current event without mutating the prior
 * ledger. The replacement must identify the exact version it supersedes; no
 * current-state inference or in-place record rewrite is allowed.
 */
export function reviseRightsEvent(
  ledgerInput: unknown,
  revisionInput: unknown
): RightsEventLedgerPayload {
  const ledger = createRightsEventLedger(ledgerInput);
  const parsedRevision = RightsEventRecordZ.safeParse(revisionInput);
  if (!parsedRevision.success) {
    throw new RightsEventLedgerError(
      parsedRevision.error.issues.map((issue) =>
        problem(
          'invalid-payload',
          `revision.${issue.path.join('.') || 'event'}`,
          issue.message
        )
      )
    );
  }

  const revision = parsedRevision.data;
  const priorCurrent = ledger.events.find(
    (event) =>
      event.eventId === revision.eventId && event.recordStatus === 'current'
  );
  const problems: RightsLedgerProblem[] = [];
  if (!priorCurrent) {
    problems.push(
      problem(
        'broken-chain',
        'revision.eventId',
        `event ${revision.eventId} has no current version to supersede`
      )
    );
  } else {
    if (
      revision.eventVersion <= priorCurrent.eventVersion ||
      revision.supersedesEventVersion !== priorCurrent.eventVersion
    ) {
      problems.push(
        problem(
          'duplicate-version',
          'revision.eventVersion',
          `revision must be newer than and explicitly supersede ${priorCurrent.eventId}@v${priorCurrent.eventVersion}`
        )
      );
    }
    if (
      revision.recordStatus !== 'current' ||
      revision.eventKind !== priorCurrent.eventKind ||
      revision.worldId !== priorCurrent.worldId ||
      revision.teamId !== priorCurrent.teamId ||
      revision.playerId !== priorCurrent.playerId
    ) {
      problems.push(
        problem(
          'identity-mismatch',
          'revision',
          'a revision must preserve the current event kind and world/team/player identity'
        )
      );
    }
  }
  if (problems.length > 0) throw new RightsEventLedgerError(problems);

  return createRightsEventLedger({
    ...ledger,
    ledgerVersion: ledger.ledgerVersion + 1,
    events: [
      ...ledger.events.map((event) =>
        event === priorCurrent
          ? { ...event, recordStatus: 'superseded' as const }
          : event
      ),
      revision,
    ],
  });
}

/** Walk one player's current chain by links, never by a latest-timestamp guess. */
export function walkRightsChain(
  ledger: RightsEventLedgerPayload,
  playerId: string,
  salaryCapYear: number
): readonly RightsEventRecord[] | null {
  const events = ledger.events.filter(
    (event) =>
      event.recordStatus === 'current' &&
      event.playerId === playerId &&
      event.salaryCapYear === salaryCapYear
  );
  if (events.length === 0) return Object.freeze([]);
  const roots = events.filter(
    (event) => event.eventKind === 'rights-established'
  );
  if (roots.length !== 1) return null;
  const byPredecessor = new Map<string, RightsEventRecord>();
  for (const event of events) {
    if (event.predecessorEventId) {
      if (byPredecessor.has(event.predecessorEventId)) return null;
      byPredecessor.set(event.predecessorEventId, event);
    }
  }
  const chain: RightsEventRecord[] = [];
  const seen = new Set<string>();
  let cursor: RightsEventRecord | undefined = roots[0];
  while (cursor) {
    if (seen.has(cursor.eventId)) return null;
    seen.add(cursor.eventId);
    chain.push(cursor);
    cursor = byPredecessor.get(cursor.eventId);
  }
  return chain.length === events.length ? Object.freeze(chain) : null;
}
