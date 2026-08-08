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

import {
  isNonEmptyString,
  isZonedDateTime,
  parseZonedDateTime,
} from '../governedSeason/governedTime';

/**
 * The seven lifecycle families of `CBA2-L02.1`, expressed as nine event kinds.
 *
 * Option and ETO each split into an exercise and a decline. The Canon names one
 * "option" event, but exercising and declining produce different resulting
 * contract versions and are not the same act; collapsing them into one kind
 * with a boolean would put the distinction in a payload field the history layer
 * does not interpret, which is exactly the inferred-from-flags defect the audit
 * recorded. Both remain in the option family for reporting.
 */
export const CONTRACT_EVENT_KINDS = [
  'signing',
  'amendment',
  'conversion',
  'option-exercise',
  'option-decline',
  'eto-exercise',
  'eto-decline',
  'extension',
  'renegotiation',
] as const;

export type ContractEventKind = (typeof CONTRACT_EVENT_KINDS)[number];

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

export type ContractEventStatus = 'current' | 'superseded';

/** Identity of the world, contract, player, and team an event belongs to. */
export interface ContractEventSubject {
  readonly worldId: string;
  readonly contractId: string;
  readonly playerId: string;
  readonly teamId: string;
}

/**
 * A single immutable contract lifecycle event.
 *
 * Three timestamps are kept apart on purpose:
 *
 *  - `executedAt` — when the lifecycle act was executed;
 *  - `effectiveAt` — when the contract version it produced takes effect;
 *  - `recordedAt` — when this record version was appended to the ledger.
 *
 * Folding `executedAt` into `effectiveAt` is the defect the audit recorded for
 * this leaf: "signing versus effective dates ... are not distinct". `recordedAt`
 * is separate again because a correction is executed at the original act's time
 * but written later; without it, an append-only revision would look like a
 * chronology violation.
 */
export interface ContractEventRecord {
  readonly eventId: string;
  readonly eventVersion: number;
  readonly eventKind: ContractEventKind;
  readonly worldId: string;
  readonly contractId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly executedAt: string;
  readonly effectiveAt: string;
  readonly recordedAt: string;
  /** Contract version consumed. `null` only for the root signing. */
  readonly predecessorContractVersion: number | null;
  /** Contract version produced. Supplied by the author, never derived here. */
  readonly resultingContractVersion: number;
  /** Event this one succeeds in the chain. `null` only for the root signing. */
  readonly predecessorEventId: string | null;
  /** Transaction that produced this event, when one is available. */
  readonly sourceTransactionId: string | null;
  /** Author of record, when no source transaction is available. */
  readonly authoringIdentity: string | null;
  readonly recordStatus: ContractEventStatus;
  /** Prior `eventVersion` this record supersedes. `null` on a first version. */
  readonly supersedesEventVersion: number | null;
  readonly canonLeafIds: readonly string[];
}

export interface ContractEventLedger {
  readonly ledgerId: string;
  readonly ledgerVersion: number;
  readonly events: readonly ContractEventRecord[];
}

export interface ContractEventLedgerInput {
  ledgerId: string;
  ledgerVersion: number;
  events?: readonly ContractEventRecord[];
}

/**
 * Every way a ledger can refuse to validate. These are reported, never
 * resolved: the history layer has no authority to pick a winner between two
 * competing versions or to invent a missing link.
 */
export type ContractLedgerProblemKind =
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
  | 'missing-provenance';

export interface ContractLedgerProblem {
  readonly kind: ContractLedgerProblemKind;
  /** Where the problem was found, e.g. `events[3].effectiveAt`. */
  readonly at: string;
  readonly detail: string;
  /** `eventId@vN` identities involved, ordered as read. */
  readonly eventIds: readonly string[];
}

export class ContractEventLedgerError extends Error {
  readonly problems: readonly ContractLedgerProblem[];

  constructor(problems: readonly ContractLedgerProblem[]) {
    super(
      `Invalid contract event ledger: ${problems
        .map((problem) => `${problem.kind} at ${problem.at}`)
        .join('; ')}`
    );
    this.name = 'ContractEventLedgerError';
    this.problems = problems.map(freezeProblem);
  }
}

function freezeProblem(problem: ContractLedgerProblem): ContractLedgerProblem {
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

export function isContractEventKind(value: unknown): value is ContractEventKind {
  return CONTRACT_EVENT_KINDS.some((kind) => kind === value);
}

function problem(
  kind: ContractLedgerProblemKind,
  at: string,
  detail: string,
  eventIds: readonly string[] = []
): ContractLedgerProblem {
  return { kind, at, detail, eventIds };
}

/**
 * Field-level validation of one event, independent of every other event.
 *
 * Returns `true` when the record is structurally sound enough for the
 * relationship checks to read it. Relationship checks skip unsound records
 * rather than reporting cascading failures against fields they cannot trust.
 */
function validateEventShape(
  event: ContractEventRecord,
  index: number,
  problems: ContractLedgerProblem[]
): boolean {
  const at = `events[${index}]`;
  const before = problems.length;

  if (!isNonEmptyString(event?.eventId)) {
    problems.push(
      problem('missing-identity', `${at}.eventId`, 'Event ID is required.')
    );
  }
  if (!Number.isInteger(event?.eventVersion) || event.eventVersion < 1) {
    problems.push(
      problem(
        'missing-version',
        `${at}.eventVersion`,
        'Event version must be an integer of at least 1.'
      )
    );
  }
  if (!isContractEventKind(event?.eventKind)) {
    problems.push(
      problem(
        'unsupported-event-kind',
        `${at}.eventKind`,
        `Event kind ${String(
          event?.eventKind
        )} is not one of the supported lifecycle kinds: ${CONTRACT_EVENT_KINDS.join(
          ', '
        )}.`
      )
    );
  }

  (['worldId', 'contractId', 'playerId', 'teamId'] as const).forEach((field) => {
    if (!isNonEmptyString(event?.[field])) {
      problems.push(
        problem(
          'missing-identity',
          `${at}.${field}`,
          `${field} is required so every event can be audited to its world, contract, player, and team.`
        )
      );
    }
  });

  (['executedAt', 'effectiveAt', 'recordedAt'] as const).forEach((field) => {
    if (!isZonedDateTime(event?.[field])) {
      problems.push(
        problem(
          'invalid-timestamp',
          `${at}.${field}`,
          `${field} must be an ISO-8601 instant carrying an explicit Z or UTC offset.`
        )
      );
    }
  });

  if (
    !Number.isInteger(event?.resultingContractVersion) ||
    event.resultingContractVersion < 1
  ) {
    problems.push(
      problem(
        'missing-version',
        `${at}.resultingContractVersion`,
        'Resulting contract version must be an integer of at least 1.'
      )
    );
  }

  const isRoot = event?.eventKind === CONTRACT_ROOT_EVENT_KIND;

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
    if (
      !Number.isInteger(event?.predecessorContractVersion) ||
      (event.predecessorContractVersion ?? 0) < 1
    ) {
      problems.push(
        problem(
          'broken-chain',
          `${at}.predecessorContractVersion`,
          'Every non-signing event transforms an existing contract version and must name it.'
        )
      );
    }
    if (!isNonEmptyString(event?.predecessorEventId)) {
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
    event?.recordStatus !== 'current' &&
    event?.recordStatus !== 'superseded'
  ) {
    problems.push(
      problem(
        'missing-identity',
        `${at}.recordStatus`,
        'Record status must be current or superseded.'
      )
    );
  }

  if (
    event?.supersedesEventVersion != null &&
    (!Number.isInteger(event.supersedesEventVersion) ||
      event.supersedesEventVersion < 1 ||
      event.supersedesEventVersion >= event.eventVersion)
  ) {
    problems.push(
      problem(
        'missing-version',
        `${at}.supersedesEventVersion`,
        'A superseding version must supersede a lower, positive event version.'
      )
    );
  }

  // Provenance is what makes an event auditable at all. An event with neither a
  // source transaction nor an author cannot be traced to anything that produced
  // it, so it is rejected rather than admitted as anonymous history.
  if (
    !isNonEmptyString(event?.sourceTransactionId) &&
    !isNonEmptyString(event?.authoringIdentity)
  ) {
    problems.push(
      problem(
        'missing-provenance',
        `${at}.sourceTransactionId`,
        'An event must retain a source transaction identity or an authoring identity.'
      )
    );
  }

  if (
    !Array.isArray(event?.canonLeafIds) ||
    event.canonLeafIds.length === 0 ||
    event.canonLeafIds.some((leafId) => !isNonEmptyString(leafId))
  ) {
    problems.push(
      problem(
        'missing-identity',
        `${at}.canonLeafIds`,
        'Every event must cite at least one Canon leaf it is recorded under.'
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
  problems: ContractLedgerProblem[]
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
  problems: ContractLedgerProblem[]
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
  problems: ContractLedgerProblem[]
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
  input: ContractEventLedgerInput
): ContractEventLedger {
  const problems: ContractLedgerProblem[] = [];

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

export type ContractLedgerValidationState = 'valid' | 'invalid';

export interface ContractLedgerValidation {
  readonly state: ContractLedgerValidationState;
  /** The validated ledger, or `null` when validation failed. */
  readonly ledger: ContractEventLedger | null;
  readonly problems: readonly ContractLedgerProblem[];
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
  input: ContractEventLedgerInput
): ContractLedgerValidation {
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
  ledger: ContractEventLedger,
  events: readonly ContractEventRecord[]
): ContractEventLedger {
  return createContractEventLedger({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion + 1,
    events: [...ledger.events, ...events],
  });
}

/** Epoch milliseconds of an event's effective instant. */
export function effectiveTime(event: ContractEventRecord): number {
  return parseZonedDateTime(event.effectiveAt) ?? Number.NaN;
}
