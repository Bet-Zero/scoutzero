/**
 * FILE: src/features/architect/utils/contractHistory/contractEventRecords.ts
 * PURPOSE: Immutable, versioned contract lifecycle events and the validated ledger built from them.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271. Canon `CBA2-L02.1` states that signing, amendment, conversion,
 * option, ETO, Extension, and Renegotiation are separate lifecycle events with
 * their own effective dates. The Phase 2 audit records the application as
 * `partial` on that leaf under the `contract-event-ledger-incomplete` cluster:
 * lifecycle state is inferred from overwritten salary rows and flags, so there
 * is no record of which contract version existed at a given date.
 *
 * This module is the record layer for that history. An event is the unit the
 * audit asks for: one lifecycle act, one contract, one player, one team, one
 * world, its own event ID and version, its own executed and effective
 * timestamps, the contract version it consumed, the contract version it
 * produced, and whatever source-transaction or authoring identity is available.
 *
 * Events are immutable. A correction does not edit an event in place; it
 * appends a new `eventVersion` that marks the prior version `superseded`. Two
 * `current` versions of one event, or two events claiming the same contract
 * version, are unresolved conflicts rather than ties to break — the same
 * fail-closed posture BZE-270 established for governed season records.
 *
 * WHAT THIS LAYER DOES NOT DO. It establishes trustworthy history and nothing
 * else. It does not certify that a recorded event is legal under the CBA. It
 * computes no compensation, no eligibility, no deadline, and no route-specific
 * rule result, because none of those has a Canon-backed owner on this path yet.
 * A committed event retains the `resultingContractVersion` its author supplied;
 * the ledger never pretends it independently validated that version.
 */

import { z } from 'zod';

import {
  ContractEventRecordZ,
  type ContractEventKind,
  type ContractEventRecord,
} from '@/schemas/contractEventLedger';
import {
  isNonEmptyString,
  isZonedDateTime,
  parseZonedDateTime,
} from '../governedSeason/governedTime';

/** Lifecycle family each event kind belongs to, as the Canon names them. */
export const CONTRACT_EVENT_FAMILIES: Readonly<
  Record<ContractEventKind, string>
> = Object.freeze({
  signing: 'signing',
  amendment: 'amendment',
  conversion: 'conversion',
  'option-exercise': 'option',
  'option-decline': 'option',
  'eto-exercise': 'eto',
  'eto-decline': 'eto',
  extension: 'extension',
  renegotiation: 'renegotiation',
});

/**
 * Only a signing opens a contract's history. Every other kind transforms a
 * contract version that already exists, so it must name a predecessor.
 */
export const CONTRACT_ROOT_EVENT_KIND: ContractEventKind = 'signing';

/**
 * A validated, frozen ledger. Distinct from the wire payload in
 * `@/schemas/contractEventLedger`: a payload is untrusted data that has a
 * format version, a ledger is the aggregate that survived validation.
 */
export interface LifecycleEventLedger {
  readonly ledgerId: string;
  readonly ledgerVersion: number;
  readonly events: readonly ContractEventRecord[];
}

export interface LifecycleEventLedgerInput {
  ledgerId: string;
  ledgerVersion: number;
  events?: readonly ContractEventRecord[];
}

/**
 * Every way a ledger can refuse to validate. These are reported, never
 * resolved: the history layer has no authority to pick a winner between two
 * competing versions or to invent a missing link.
 */
export type LifecycleLedgerProblemKind =
  | 'missing-identity'
  | 'missing-version'
  | 'unsupported-event-kind'
  | 'invalid-timestamp'
  | 'invalid-chronology'
  | 'duplicate-identity'
  | 'competing-current-version'
  | 'broken-chain'
  | 'chain-fork'
  | 'ambiguous-ordering'
  | 'missing-provenance'
  /** A field the canonical event schema does not declare. */
  | 'unsupported-field'
  /**
   * The stored envelope could not be read at all: not JSON, not an object, a
   * format version this build does not support, or a missing/non-array
   * `events`. Distinct from the event-level kinds because nothing about a
   * *record* is known yet — reporting it as `missing-identity` claimed a
   * specific record defect the reader had not established.
   */
  | 'unreadable-payload';

export interface LifecycleLedgerProblem {
  readonly kind: LifecycleLedgerProblemKind;
  /** Where the problem was found, e.g. `events[3].effectiveAt`. */
  readonly at: string;
  readonly detail: string;
  /** `eventId@vN` identities involved, ordered as read. */
  readonly eventIds: readonly string[];
}

export class ContractEventLedgerError extends Error {
  readonly problems: readonly LifecycleLedgerProblem[];

  constructor(problems: readonly LifecycleLedgerProblem[]) {
    super(
      `Invalid contract event ledger: ${problems
        .map((problem) => `${problem.kind} at ${problem.at}`)
        .join('; ')}`
    );
    this.name = 'ContractEventLedgerError';
    this.problems = problems.map(freezeProblem);
  }
}

function freezeProblem(problem: LifecycleLedgerProblem): LifecycleLedgerProblem {
  return Object.freeze({
    ...problem,
    eventIds: Object.freeze([...problem.eventIds]),
  });
}

/** Stable `eventId@vN` label used everywhere an event is named in a report. */
export function eventKey(
  event: Pick<ContractEventRecord, 'eventId' | 'eventVersion'>
): string {
  return `${event.eventId}@v${event.eventVersion}`;
}

function problem(
  kind: LifecycleLedgerProblemKind,
  at: string,
  detail: string,
  eventIds: readonly string[] = []
): LifecycleLedgerProblem {
  return { kind, at, detail, eventIds };
}

/**
 * Which reported problem each canonical-schema field belongs to. The schema
 * speaks in field paths; the ledger reports in defect kinds, and this is the
 * one place the two vocabularies meet.
 *
 * Both provenance fields map to `missing-provenance`: a numeric
 * `sourceTransactionId` is not a different defect from an absent one — in each
 * case the event carries no usable source identity.
 */
const SCHEMA_FIELD_PROBLEM_KINDS: Readonly<
  Record<string, LifecycleLedgerProblemKind>
> = Object.freeze({
  eventId: 'missing-identity',
  worldId: 'missing-identity',
  contractId: 'missing-identity',
  playerId: 'missing-identity',
  teamId: 'missing-identity',
  recordStatus: 'missing-identity',
  canonLeafIds: 'missing-identity',
  eventVersion: 'missing-version',
  resultingContractVersion: 'missing-version',
  supersedesEventVersion: 'missing-version',
  eventKind: 'unsupported-event-kind',
  executedAt: 'invalid-timestamp',
  effectiveAt: 'invalid-timestamp',
  recordedAt: 'invalid-timestamp',
  predecessorContractVersion: 'broken-chain',
  predecessorEventId: 'broken-chain',
  sourceTransactionId: 'missing-provenance',
  authoringIdentity: 'missing-provenance',
});

/**
 * Translate one canonical-schema issue about a record into a ledger problem.
 * `at` locates the record, `fieldPath` is the issue path relative to it.
 */
function eventProblemFromIssue(
  at: string,
  issue: z.core.$ZodIssue,
  fieldPath: readonly PropertyKey[]
): LifecycleLedgerProblem {
  if (issue.code === 'unrecognized_keys') {
    return problem(
      'unsupported-field',
      at,
      `Unsupported field(s) ${issue.keys.join(
        ', '
      )}: a contract event carries only the fields the canonical schema declares.`
    );
  }

  const field = String(fieldPath[0] ?? '');
  return problem(
    SCHEMA_FIELD_PROBLEM_KINDS[field] ?? 'missing-identity',
    field ? `${at}.${field}` : at,
    issue.message
  );
}

function problemsFromSchemaIssues(
  at: string,
  issues: readonly z.core.$ZodIssue[]
): LifecycleLedgerProblem[] {
  return issues.map((issue) => eventProblemFromIssue(at, issue, issue.path));
}

/**
 * Translate canonical *payload* schema issues into ledger problems.
 *
 * Payload issue paths are rooted at the envelope, so an event defect arrives as
 * `['events', 3, 'effectiveAt']`. Envelope-level defects are reported as
 * `unreadable-payload` because nothing about any individual record has been
 * established when the envelope itself is wrong.
 */
export function ledgerProblemsFromPayloadIssues(
  issues: readonly z.core.$ZodIssue[]
): LifecycleLedgerProblem[] {
  return issues.map((issue) => {
    const [head, index] = issue.path;

    if (head === 'events' && typeof index === 'number') {
      return eventProblemFromIssue(
        `events[${index}]`,
        issue,
        issue.path.slice(2)
      );
    }

    // An unexpected key on the envelope itself, reported at the payload root.
    if (issue.code === 'unrecognized_keys') {
      return problem(
        'unsupported-field',
        'payload',
        `Unsupported field(s) ${issue.keys.join(
          ', '
        )}: a ledger payload carries only the fields the canonical schema declares.`
      );
    }

    const field = String(head ?? '');
    if (field === 'ledgerId') {
      return problem('missing-identity', 'ledgerId', issue.message);
    }
    if (field === 'ledgerVersion') {
      return problem('missing-version', 'ledgerVersion', issue.message);
    }
    return problem('unreadable-payload', field || 'payload', issue.message);
  });
}

/**
 * Validation of one event, independent of every other event.
 *
 * The canonical runtime schema in `@/schemas/contractEventLedger` owns the
 * shape — field presence, runtime types, enum membership, provenance
 * nullability. It runs first and it runs on every entry point, so an in-memory
 * caller and a deserialized payload are held to exactly the same contract. What
 * remains here is what the schema deliberately does not own: zoned-instant
 * validity, which belongs to BZE-270's governed date primitives, and the
 * single-record rules about chain position and causality.
 *
 * Returns `true` when the record is sound enough for the relationship checks to
 * read it. Relationship checks skip unsound records rather than reporting
 * cascading failures against fields they cannot trust.
 */
function validateEventShape(
  event: ContractEventRecord,
  index: number,
  problems: LifecycleLedgerProblem[]
): boolean {
  const at = `events[${index}]`;
  const before = problems.length;

  const parsed = ContractEventRecordZ.safeParse(event);
  if (!parsed.success) {
    problemsFromSchemaIssues(at, parsed.error.issues).forEach((entry) =>
      problems.push(entry)
    );
    return false;
  }

  // Every field below is now known to be the declared runtime type, so these
  // checks are about meaning rather than shape.

  (['executedAt', 'effectiveAt', 'recordedAt'] as const).forEach((field) => {
    if (!isZonedDateTime(event[field])) {
      problems.push(
        problem(
          'invalid-timestamp',
          `${at}.${field}`,
          `${field} must be an ISO-8601 instant carrying an explicit Z or UTC offset.`
        )
      );
    }
  });

  const isRoot = event.eventKind === CONTRACT_ROOT_EVENT_KIND;

  if (isRoot) {
    if (event.predecessorContractVersion != null) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorContractVersion`,
          'A signing opens a contract history and must not name a predecessor contract version.'
        )
      );
    }
    if (event.predecessorEventId != null) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorEventId`,
          'A signing opens a contract history and must not name a predecessor event.'
        )
      );
    }
  } else {
    if (event.predecessorContractVersion == null) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorContractVersion`,
          'Every non-signing event transforms an existing contract version and must name it.'
        )
      );
    }
    if (!isNonEmptyString(event.predecessorEventId)) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorEventId`,
          'Every non-signing event must name the event it succeeds.'
        )
      );
    }
  }

  if (
    event.supersedesEventVersion != null &&
    event.supersedesEventVersion >= event.eventVersion
  ) {
    problems.push(
      problem(
        'missing-version',
        `${at}.supersedesEventVersion`,
        'A superseding version must supersede a lower, positive event version.'
      )
    );
  }

  // Causality, checked only once both instants parsed. An act cannot take
  // effect before it was executed, and a record cannot be written before the
  // act it records. A correction keeps the original `executedAt` and gets a
  // later `recordedAt`, so append-only revision never trips these.
  if (isZonedDateTime(event?.executedAt) && isZonedDateTime(event.effectiveAt)) {
    if (Date.parse(event.executedAt) > Date.parse(event.effectiveAt)) {
      problems.push(
        problem(
          'invalid-chronology',
          `${at}.effectiveAt`,
          'A contract version cannot take effect before the act that produced it was executed.',
          [eventKey(event)]
        )
      );
    }
  }
  if (isZonedDateTime(event?.executedAt) && isZonedDateTime(event.recordedAt)) {
    if (Date.parse(event.recordedAt) < Date.parse(event.executedAt)) {
      problems.push(
        problem(
          'invalid-chronology',
          `${at}.recordedAt`,
          'An event cannot be recorded before the act it records was executed.',
          [eventKey(event)]
        )
      );
    }
  }

  return problems.length === before;
}

/** Reject two records sharing one `eventId@version`. */
function validateUniqueIdentities(
  events: readonly ContractEventRecord[],
  problems: LifecycleLedgerProblem[]
): void {
  const seen = new Map<string, number>();

  events.forEach((event, index) => {
    const key = eventKey(event);
    const firstIndex = seen.get(key);
    if (firstIndex === undefined) {
      seen.set(key, index);
      return;
    }
    problems.push(
      problem(
        'duplicate-identity',
        `events[${index}].eventId`,
        `${key} is already declared at events[${firstIndex}]; one event ID and version must identify exactly one record.`,
        [key]
      )
    );
  });
}

/**
 * Revision rules for the versions of a single event ID: exactly one `current`
 * version, and each later version recorded no earlier than the one before it.
 */
function validateSupersession(
  events: readonly ContractEventRecord[],
  problems: LifecycleLedgerProblem[]
): void {
  const byEventId = new Map<string, ContractEventRecord[]>();
  events.forEach((event) => {
    const versions = byEventId.get(event.eventId) ?? [];
    versions.push(event);
    byEventId.set(event.eventId, versions);
  });

  byEventId.forEach((versions, eventId) => {
    const current = versions.filter(
      (event) => event.recordStatus === 'current'
    );

    if (current.length > 1) {
      problems.push(
        problem(
          'competing-current-version',
          `events.${eventId}.recordStatus`,
          `Event ${eventId} has ${current.length} current versions; a revision must supersede the version it replaces rather than stand beside it.`,
          current.map(eventKey)
        )
      );
    }
    if (current.length === 0) {
      problems.push(
        problem(
          'competing-current-version',
          `events.${eventId}.recordStatus`,
          `Event ${eventId} has no current version; every retained event must have exactly one.`,
          versions.map(eventKey)
        )
      );
    }

    const ordered = [...versions].sort((a, b) => a.eventVersion - b.eventVersion);
    ordered.forEach((event, position) => {
      const prior = ordered[position - 1];
      if (!prior) return;

      if (Date.parse(event.recordedAt) < Date.parse(prior.recordedAt)) {
        problems.push(
          problem(
            'invalid-chronology',
            `events.${eventId}.recordedAt`,
            `${eventKey(event)} was recorded before ${eventKey(
              prior
            )}; history is append-only, so a later version cannot predate the version it replaces.`,
            [eventKey(prior), eventKey(event)]
          )
        );
      }

      // A later version that is still `current` while an earlier one is too is
      // caught above; here we only require that a superseded version was in
      // fact superseded by a declared version.
      if (
        prior.recordStatus === 'superseded' &&
        event.supersedesEventVersion == null &&
        event.eventVersion > prior.eventVersion
      ) {
        problems.push(
          problem(
            'missing-version',
            `events.${eventId}.supersedesEventVersion`,
            `${eventKey(event)} follows superseded ${eventKey(
              prior
            )} without declaring which version it supersedes.`,
            [eventKey(prior), eventKey(event)]
          )
        );
      }
    });

    ordered.forEach((event) => {
      if (event.supersedesEventVersion == null) return;
      const superseded = ordered.find(
        (candidate) => candidate.eventVersion === event.supersedesEventVersion
      );
      if (!superseded) {
        problems.push(
          problem(
            'broken-chain',
            `events.${eventId}.supersedesEventVersion`,
            `${eventKey(event)} supersedes version ${
              event.supersedesEventVersion
            }, which is not present in the ledger.`,
            [eventKey(event)]
          )
        );
        return;
      }
      if (superseded.recordStatus !== 'superseded') {
        problems.push(
          problem(
            'competing-current-version',
            `events.${eventId}.recordStatus`,
            `${eventKey(superseded)} is still current although ${eventKey(
              event
            )} supersedes it.`,
            [eventKey(superseded), eventKey(event)]
          )
        );
      }
    });
  });
}

/** Events of one contract inside one world, current versions only. */
function currentEventsByContract(
  events: readonly ContractEventRecord[]
): Map<string, ContractEventRecord[]> {
  const byContract = new Map<string, ContractEventRecord[]>();

  events
    .filter((event) => event.recordStatus === 'current')
    .forEach((event) => {
      const key = `${event.worldId}::${event.contractId}`;
      const forContract = byContract.get(key) ?? [];
      forContract.push(event);
      byContract.set(key, forContract);
    });

  return byContract;
}

/**
 * Chain rules for one contract's current events: one root, no two events
 * producing or consuming the same contract version, no missing predecessor,
 * and a strictly increasing effective instant along the chain.
 */
function validateContractChain(
  contractKey: string,
  events: readonly ContractEventRecord[],
  problems: LifecycleLedgerProblem[]
): void {
  const at = `events.${contractKey}`;

  // One contract's events must agree on the player and team they belong to;
  // otherwise "the contract" names two different things and every projection
  // built from it would silently mix them.
  const players = new Set(events.map((event) => event.playerId));
  const teams = new Set(events.map((event) => event.teamId));
  if (players.size > 1) {
    problems.push(
      problem(
        'duplicate-identity',
        `${at}.playerId`,
        `Contract ${contractKey} has events for ${players.size} players (${[
          ...players,
        ].join(', ')}); one contract identifies one player.`,
        events.map(eventKey)
      )
    );
  }
  if (teams.size > 1) {
    problems.push(
      problem(
        'duplicate-identity',
        `${at}.teamId`,
        `Contract ${contractKey} has events for ${teams.size} teams (${[
          ...teams,
        ].join(', ')}); one contract identifies one team.`,
        events.map(eventKey)
      )
    );
  }

  const roots = events.filter(
    (event) => event.eventKind === CONTRACT_ROOT_EVENT_KIND
  );
  if (roots.length === 0) {
    problems.push(
      problem(
        'broken-chain',
        `${at}.eventKind`,
        `Contract ${contractKey} has no signing event, so its history has no origin.`,
        events.map(eventKey)
      )
    );
  }
  if (roots.length > 1) {
    problems.push(
      problem(
        'chain-fork',
        `${at}.eventKind`,
        `Contract ${contractKey} has ${roots.length} signing events; a contract history has exactly one origin.`,
        roots.map(eventKey)
      )
    );
  }

  const producers = new Map<number, ContractEventRecord[]>();
  events.forEach((event) => {
    const sharing = producers.get(event.resultingContractVersion) ?? [];
    sharing.push(event);
    producers.set(event.resultingContractVersion, sharing);
  });
  producers.forEach((sharing, version) => {
    if (sharing.length > 1) {
      problems.push(
        problem(
          'competing-current-version',
          `${at}.resultingContractVersion`,
          `Contract version ${version} of ${contractKey} is produced by ${sharing.length} current events; the competing versions must be reconciled at the source.`,
          sharing.map(eventKey)
        )
      );
    }
  });

  const consumers = new Map<number, ContractEventRecord[]>();
  events.forEach((event) => {
    if (event.predecessorContractVersion == null) return;
    const sharing = consumers.get(event.predecessorContractVersion) ?? [];
    sharing.push(event);
    consumers.set(event.predecessorContractVersion, sharing);
  });
  consumers.forEach((sharing, version) => {
    if (sharing.length > 1) {
      problems.push(
        problem(
          'chain-fork',
          `${at}.predecessorContractVersion`,
          `Contract version ${version} of ${contractKey} is succeeded by ${sharing.length} current events; history forks and cannot be replayed as one line.`,
          sharing.map(eventKey)
        )
      );
    }
    const predecessor = producers.get(version);
    if (!predecessor || predecessor.length === 0) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorContractVersion`,
          `Contract version ${version} of ${contractKey} is consumed but never produced; the chain has a gap.`,
          sharing.map(eventKey)
        )
      );
    }
  });

  // Predecessor event identity must agree with predecessor contract version.
  events.forEach((event) => {
    if (event.predecessorEventId == null) return;
    const named = events.find(
      (candidate) => candidate.eventId === event.predecessorEventId
    );
    if (!named) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorEventId`,
          `${eventKey(event)} names predecessor event ${
            event.predecessorEventId
          }, which has no current version in this contract's history.`,
          [eventKey(event)]
        )
      );
      return;
    }
    if (named.resultingContractVersion !== event.predecessorContractVersion) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorEventId`,
          `${eventKey(event)} consumes contract version ${
            event.predecessorContractVersion
          } but names predecessor ${eventKey(
            named
          )}, which produced version ${named.resultingContractVersion}.`,
          [eventKey(named), eventKey(event)]
        )
      );
    }
  });

  // Ordering along the chain. Walking the chain rather than sorting by
  // timestamp is what makes the order deterministic; the timestamp check then
  // proves the chain order and the effective order agree.
  const chain = walkChain(events);
  if (!chain) return;

  chain.forEach((event, position) => {
    const prior = chain[position - 1];
    if (!prior) return;

    const priorEffective = Date.parse(prior.effectiveAt);
    const effective = Date.parse(event.effectiveAt);

    if (effective < priorEffective) {
      problems.push(
        problem(
          'invalid-chronology',
          `${at}.effectiveAt`,
          `${eventKey(event)} takes effect before its predecessor ${eventKey(
            prior
          )}; a later contract version cannot become effective earlier than the version it replaces.`,
          [eventKey(prior), eventKey(event)]
        )
      );
      return;
    }
    if (effective === priorEffective) {
      problems.push(
        problem(
          'ambiguous-ordering',
          `${at}.effectiveAt`,
          `${eventKey(event)} and ${eventKey(
            prior
          )} take effect at the same instant, so no single contract version can be projected at that instant.`,
          [eventKey(prior), eventKey(event)]
        )
      );
    }
  });
}

/**
 * The chain of one contract's current events, root first. Returns `null` when
 * the chain cannot be walked — those shapes are already reported by the
 * structural checks above, and re-reporting them here would double-count.
 */
export function walkChain(
  events: readonly ContractEventRecord[]
): ContractEventRecord[] | null {
  const roots = events.filter(
    (event) => event.eventKind === CONTRACT_ROOT_EVENT_KIND
  );
  if (roots.length !== 1) return null;

  const bySuccessor = new Map<number, ContractEventRecord>();
  events.forEach((event) => {
    if (event.predecessorContractVersion == null) return;
    if (bySuccessor.has(event.predecessorContractVersion)) return;
    bySuccessor.set(event.predecessorContractVersion, event);
  });

  const chain: ContractEventRecord[] = [roots[0]];
  const visited = new Set<string>([eventKey(roots[0])]);

  for (;;) {
    const last = chain[chain.length - 1];
    const next = bySuccessor.get(last.resultingContractVersion);
    if (!next) break;
    // A cycle would otherwise loop forever. Cycles are impossible once the
    // effective-instant check passes, but the walk must terminate before that
    // check can run, so it guards itself.
    if (visited.has(eventKey(next))) return null;
    visited.add(eventKey(next));
    chain.push(next);
  }

  // Every current event must be reachable from the root. An unreachable event
  // means a gap or fork the caller must fix, already reported above.
  return chain.length === events.length ? chain : null;
}

/**
 * Clone-and-freeze. `Object.freeze` is shallow and spreading an array copies
 * element references, so freezing only the ledger's array would leave every
 * event — and every `canonLeafIds` list inside it — writable through the object
 * the caller still holds. A caller that mutated a retained reference afterwards
 * would change a validated ledger and every projection already taken from it,
 * while the ledger version and event versions stayed put.
 */
function freezeEvent(event: ContractEventRecord): ContractEventRecord {
  return Object.freeze({
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    eventKind: event.eventKind,
    worldId: event.worldId,
    contractId: event.contractId,
    playerId: event.playerId,
    teamId: event.teamId,
    executedAt: event.executedAt,
    effectiveAt: event.effectiveAt,
    recordedAt: event.recordedAt,
    predecessorContractVersion: event.predecessorContractVersion,
    resultingContractVersion: event.resultingContractVersion,
    predecessorEventId: event.predecessorEventId,
    sourceTransactionId: event.sourceTransactionId ?? null,
    authoringIdentity: event.authoringIdentity ?? null,
    recordStatus: event.recordStatus,
    supersedesEventVersion: event.supersedesEventVersion,
    canonLeafIds: Object.freeze([...event.canonLeafIds]),
  });
}

/**
 * Build a validated, immutable contract event ledger.
 *
 * Construction is the only door into the history path, so validation is total
 * rather than best-effort. Anything that would make a later projection guess —
 * a missing identity, a duplicate, a gap, a fork, competing versions, or an
 * ordering no chain can settle — is rejected here instead of being resolved by
 * a rule the history layer has no authority to apply.
 */
export function createContractEventLedger(
  input: LifecycleEventLedgerInput
): LifecycleEventLedger {
  const problems: LifecycleLedgerProblem[] = [];

  if (!isNonEmptyString(input?.ledgerId)) {
    problems.push(
      problem('missing-identity', 'ledgerId', 'Ledger ID is required.')
    );
  }
  if (!Number.isInteger(input?.ledgerVersion) || input.ledgerVersion < 1) {
    problems.push(
      problem(
        'missing-version',
        'ledgerVersion',
        'Ledger version must be an integer of at least 1.'
      )
    );
  }

  const events = input?.events ?? [];
  const sound = events.filter((event, index) =>
    validateEventShape(event, index, problems)
  );

  validateUniqueIdentities(sound, problems);
  validateSupersession(sound, problems);
  currentEventsByContract(sound).forEach((forContract, contractKey) => {
    validateContractChain(contractKey, forContract, problems);
  });

  if (problems.length > 0) throw new ContractEventLedgerError(problems);

  // Stored in a deterministic order so two ledgers holding the same events
  // serialize identically regardless of the order the caller supplied them in.
  const ordered = [...events].sort((a, b) => {
    if (a.worldId !== b.worldId) return a.worldId < b.worldId ? -1 : 1;
    if (a.contractId !== b.contractId) {
      return a.contractId < b.contractId ? -1 : 1;
    }
    if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1;
    return a.eventVersion - b.eventVersion;
  });

  return Object.freeze({
    ledgerId: input.ledgerId,
    ledgerVersion: input.ledgerVersion,
    events: Object.freeze(ordered.map(freezeEvent)),
  });
}

export type LifecycleLedgerValidationState = 'valid' | 'invalid';

export interface LifecycleLedgerValidation {
  readonly state: LifecycleLedgerValidationState;
  /** The validated ledger, or `null` when validation failed. */
  readonly ledger: LifecycleEventLedger | null;
  readonly problems: readonly LifecycleLedgerProblem[];
}

/**
 * Non-throwing form of {@link createContractEventLedger}.
 *
 * A caller inspecting why a history is untrustworthy — duplicate identities, a
 * chain gap, a fork, competing current versions, ambiguous ordering, invalid
 * chronology, an unsupported event kind — gets every problem as data rather
 * than having to catch an error to read them. Both forms run exactly the same
 * validation, so neither is a laxer door into the ledger.
 */
export function validateContractEventLedger(
  input: LifecycleEventLedgerInput
): LifecycleLedgerValidation {
  try {
    return Object.freeze({
      state: 'valid' as const,
      ledger: createContractEventLedger(input),
      problems: Object.freeze([]),
    });
  } catch (error) {
    if (error instanceof ContractEventLedgerError) {
      return Object.freeze({
        state: 'invalid' as const,
        ledger: null,
        problems: Object.freeze([...error.problems]),
      });
    }
    throw error;
  }
}

/**
 * Append events to a ledger without touching the one passed in.
 *
 * A ledger is immutable, so appending produces a new ledger at the next version
 * and re-validates the whole history. The original object is untouched, which
 * is what makes an earlier projection taken from it still true.
 */
export function appendContractEvents(
  ledger: LifecycleEventLedger,
  events: readonly ContractEventRecord[]
): LifecycleEventLedger {
  return createContractEventLedger({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion + 1,
    events: [...ledger.events, ...events],
  });
}

/**
 * Record a corrected version of an event that is already in the ledger.
 *
 * Supersession needs two things to happen together: the new version arrives and
 * the version it replaces stops being current. `appendContractEvents` cannot
 * express that on its own — appending a `current` v2 beside a `current` v1 is
 * exactly the competing-current-version conflict the ledger rejects — so
 * revision has its own door.
 *
 * Nothing is mutated. The prior version is re-emitted as a new frozen record
 * carrying `superseded`, inside a new ledger at the next version. The ledger
 * passed in keeps its records exactly as they were, so a projection or manifest
 * already taken from it stays true and still reports the version it consumed.
 *
 * The revision must name an event that has a current version, must carry a
 * higher `eventVersion`, and must declare that version in
 * `supersedesEventVersion`. Anything else is refused rather than guessed at.
 */
export function reviseContractEvent(
  ledger: LifecycleEventLedger,
  revision: ContractEventRecord
): LifecycleEventLedger {
  const problems: LifecycleLedgerProblem[] = [];

  if (!isNonEmptyString(revision?.eventId)) {
    problems.push(
      problem(
        'missing-identity',
        'revision.eventId',
        'A revision must name the event it revises.'
      )
    );
  }

  const priorCurrent = ledger.events.find(
    (event) =>
      event.eventId === revision?.eventId && event.recordStatus === 'current'
  );

  if (!priorCurrent) {
    problems.push(
      problem(
        'broken-chain',
        'revision.eventId',
        `Event ${String(
          revision?.eventId
        )} has no current version in ledger ${ledger.ledgerId}@v${
          ledger.ledgerVersion
        }; there is nothing to revise.`
      )
    );
  } else {
    if (
      !Number.isInteger(revision.eventVersion) ||
      revision.eventVersion <= priorCurrent.eventVersion
    ) {
      problems.push(
        problem(
          'missing-version',
          'revision.eventVersion',
          `A revision of ${eventKey(
            priorCurrent
          )} must carry a higher event version.`,
          [eventKey(priorCurrent)]
        )
      );
    }
    if (revision.supersedesEventVersion !== priorCurrent.eventVersion) {
      problems.push(
        problem(
          'missing-version',
          'revision.supersedesEventVersion',
          `A revision must declare that it supersedes version ${priorCurrent.eventVersion}.`,
          [eventKey(priorCurrent)]
        )
      );
    }
    if (revision.recordStatus !== 'current') {
      problems.push(
        problem(
          'competing-current-version',
          'revision.recordStatus',
          'A revision becomes the current version and must be recorded as current.'
        )
      );
    }
  }

  if (problems.length > 0) throw new ContractEventLedgerError(problems);

  return createContractEventLedger({
    ledgerId: ledger.ledgerId,
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

/** Epoch milliseconds of an event's effective instant. */
export function effectiveTime(event: ContractEventRecord): number {
  return parseZonedDateTime(event.effectiveAt) ?? Number.NaN;
}
