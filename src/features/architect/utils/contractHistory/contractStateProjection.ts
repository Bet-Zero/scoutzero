/**
 * FILE: src/features/architect/utils/contractHistory/contractStateProjection.ts
 * PURPOSE: Deterministic as-of projection of contract state from the event ledger.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271. Given a validated ledger, an explicit zoned `asOfDate`, and an
 * explicit Salary Cap Year, this replays a contract's history and reports which
 * contract version existed at that instant, plus the exact ordered events it
 * consumed to get there.
 *
 * The rules it will not break:
 *
 *  - it never reads the runtime clock or derives a current year, so an undated
 *    request fails closed instead of silently meaning "now" (`CBA2-L01.1`);
 *  - it never selects an undated "latest" snapshot; the answer is always the
 *    projection of events effective at the requested instant;
 *  - it includes an event exactly at its effective boundary and excludes it one
 *    millisecond earlier, so a future-effective event cannot leak backwards;
 *  - it holds no opinion about Salary Cap, floor, Tax, or apron values. Replaying
 *    contract history needs none of them. A later legality calculation that does
 *    need them stays responsible for obtaining the complete BZE-270 envelope.
 *
 * WHAT A PROJECTION IS NOT. It is the history layer's answer to "which contract
 * version existed then", not a certification that the version is legal under the
 * CBA. Compensation, eligibility, deadlines, and route-specific rules have no
 * Canon-backed owner on this path and are not computed here.
 */

import {
  isNonEmptyString,
  isSupportedSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  parseZonedDateTime,
  salaryCapYearWindow,
  seasonKeyForSalaryCapYear,
} from '@/features/architect/utils/governedSeason/governedTime';
import type {
  ContractEventKind,
  ContractEventRecord,
} from '@/schemas/contractEventLedger';
import type { GovernedContractState } from '@/schemas/governedContractState';
import {
  effectiveTime,
  eventKey,
  walkChain,
  type LifecycleEventLedger,
} from './contractEventRecords';

export type LifecycleProjectionState =
  /** History replayed; a contract version existed at the requested instant. */
  | 'projected'
  /** History exists, but nothing was effective yet at the requested instant. */
  | 'not-yet-effective'
  /** The request or the history cannot support an answer. */
  | 'unavailable';

/** One event exactly as a projection consumed it. */
export interface LifecycleProjectionEvent {
  readonly eventId: string;
  readonly eventVersion: number;
  readonly eventKind: ContractEventKind;
  readonly executedAt: string;
  readonly effectiveAt: string;
  readonly recordedAt: string;
  readonly predecessorContractVersion: number | null;
  readonly resultingContractVersion: number;
  readonly sourceTransactionId: string | null;
  readonly authoringIdentity: string | null;
  readonly resultingState: GovernedContractState;
}

export interface LifecycleLedgerIdentity {
  readonly ledgerId: string;
  readonly ledgerVersion: number;
}

/**
 * The exact inputs a projection was computed from.
 *
 * The consumed events are kept in chain order with their versions, not just
 * their IDs, because a corrected event keeps its ID and changes only its
 * version. Without the version an earlier projection would appear to have been
 * computed from the corrected history it never saw.
 */
export interface LifecycleProjectionManifest {
  readonly manifestVersion: 2;
  readonly ledger: LifecycleLedgerIdentity;
  readonly worldId: string;
  readonly contractId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly asOfDate: string;
  readonly salaryCapYear: number;
  readonly seasonKey: string;
  readonly consumedEvents: readonly LifecycleProjectionEvent[];
  readonly resultingContractVersion: number | null;
  readonly resultingStateDigest: string;
  readonly sourceRelease: GovernedContractState['source'];
}

export interface LifecycleStateProjection {
  readonly state: LifecycleProjectionState;
  readonly ledger: LifecycleLedgerIdentity;
  readonly worldId: string | null;
  readonly contractId: string | null;
  readonly playerId: string | null;
  readonly teamId: string | null;
  readonly asOfDate: string | null;
  readonly salaryCapYear: number | null;
  /** Contract version in force at `asOfDate`, or `null` when none was. */
  readonly contractVersion: number | null;
  readonly contractState: GovernedContractState | null;
  readonly evidenceStatus: 'complete' | 'needs-input' | null;
  readonly needsInputReasons: readonly string[];
  /** The event that produced `contractVersion`, or `null` when none did. */
  readonly effectiveEvent: LifecycleProjectionEvent | null;
  /** Chain-ordered events effective at or before `asOfDate`. */
  readonly consumedEvents: readonly LifecycleProjectionEvent[];
  /** Chain-ordered events not yet effective at `asOfDate`. */
  readonly futureEvents: readonly LifecycleProjectionEvent[];
  readonly missingInputs: readonly string[];
  readonly unavailableReasons: readonly string[];
  /** Present only on a `projected` result. */
  readonly manifest: LifecycleProjectionManifest | null;
}

export interface LifecycleProjectionRequest {
  ledger?: LifecycleEventLedger | null;
  worldId?: string | null;
  contractId?: string | null;
  /** ISO-8601 instant with an explicit `Z` or UTC offset. Required. */
  asOfDate?: string | null;
  /** End year of the Salary Cap Year, e.g. 2027 for 2026-27. Required. */
  salaryCapYear?: number | null;
}

const EMPTY_LEDGER_IDENTITY: LifecycleLedgerIdentity = Object.freeze({
  ledgerId: '',
  ledgerVersion: 0,
});

function ledgerIdentity(ledger: LifecycleEventLedger): LifecycleLedgerIdentity {
  return Object.freeze({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion,
  });
}

function projectionEvent(event: ContractEventRecord): LifecycleProjectionEvent {
  return Object.freeze({
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    eventKind: event.eventKind,
    executedAt: event.executedAt,
    effectiveAt: event.effectiveAt,
    recordedAt: event.recordedAt,
    predecessorContractVersion: event.predecessorContractVersion,
    resultingContractVersion: event.resultingContractVersion,
    sourceTransactionId: event.sourceTransactionId,
    authoringIdentity: event.authoringIdentity,
    resultingState: event.resultingState,
  });
}

function unavailable(
  ledger: LifecycleLedgerIdentity,
  request: LifecycleProjectionRequest,
  missingInputs: readonly string[],
  reasons: readonly string[]
): LifecycleStateProjection {
  return Object.freeze({
    state: 'unavailable' as const,
    ledger,
    worldId: isNonEmptyString(request.worldId) ? request.worldId : null,
    contractId: isNonEmptyString(request.contractId)
      ? request.contractId
      : null,
    playerId: null,
    teamId: null,
    asOfDate: isZonedDateTime(request.asOfDate) ? request.asOfDate : null,
    salaryCapYear: isSupportedSalaryCapYear(request.salaryCapYear)
      ? (request.salaryCapYear as number)
      : null,
    contractVersion: null,
    contractState: null,
    evidenceStatus: null,
    needsInputReasons: Object.freeze([]),
    effectiveEvent: null,
    consumedEvents: Object.freeze([]),
    futureEvents: Object.freeze([]),
    missingInputs: Object.freeze([...missingInputs]),
    unavailableReasons: Object.freeze([...reasons]),
    manifest: null,
  });
}

/**
 * Project the contract version in force at an explicit instant.
 *
 * Every input is required and none is inferred. There is no default date, no
 * default Salary Cap Year, and no "most recent event" shortcut: a caller that
 * cannot say when it is asking about gets `unavailable`, because answering
 * would mean inventing a time.
 */
export function projectContractStateAsOf(
  request: LifecycleProjectionRequest = {}
): LifecycleStateProjection {
  const missingInputs: string[] = [];
  const reasons: string[] = [];

  const ledger = request.ledger ?? null;
  if (!ledger) {
    missingInputs.push('ledger');
    reasons.push('No contract event ledger was supplied.');
  }
  if (!isNonEmptyString(request.worldId)) {
    missingInputs.push('worldId');
    reasons.push('A world identity is required to select a contract history.');
  }
  if (!isNonEmptyString(request.contractId)) {
    missingInputs.push('contractId');
    reasons.push('A contract identity is required.');
  }
  if (!isZonedDateTime(request.asOfDate)) {
    missingInputs.push('asOfDate');
    reasons.push(
      'An explicit ISO-8601 as-of instant carrying a Z or UTC offset is required; there is no runtime-clock fallback.'
    );
  }
  if (!isSupportedSalaryCapYear(request.salaryCapYear)) {
    missingInputs.push('salaryCapYear');
    reasons.push(
      'An explicit Salary Cap Year is required; there is no current-year derivation.'
    );
  }

  const identity = ledger ? ledgerIdentity(ledger) : EMPTY_LEDGER_IDENTITY;

  if (missingInputs.length > 0) {
    return unavailable(identity, request, missingInputs, reasons);
  }

  const asOfDate = request.asOfDate as string;
  const salaryCapYear = request.salaryCapYear as number;
  const worldId = request.worldId as string;
  const contractId = request.contractId as string;

  // The date and the Salary Cap Year are separate inputs, so they can disagree.
  // Projecting a January 2027 instant while labelling it the 2025-26 Salary Cap
  // Year would file the answer under a season it does not belong to.
  if (!isWithinSalaryCapYear(asOfDate, salaryCapYear)) {
    const window = salaryCapYearWindow(salaryCapYear);
    return unavailable(
      identity,
      request,
      ['asOfDate', 'salaryCapYear'],
      [
        `The as-of instant ${asOfDate} does not fall inside Salary Cap Year ${salaryCapYear} (${
          window
            ? `${window.from} to ${window.until}`
            : 'no representable window'
        }).`,
      ]
    );
  }

  const seasonKey = seasonKeyForSalaryCapYear(salaryCapYear);
  if (!seasonKey) {
    return unavailable(
      identity,
      request,
      ['salaryCapYear'],
      [`Salary Cap Year ${salaryCapYear} has no representable season key.`]
    );
  }

  const forContract = (ledger as LifecycleEventLedger).events.filter(
    (event) =>
      event.recordStatus === 'current' &&
      event.worldId === worldId &&
      event.contractId === contractId
  );

  if (forContract.length === 0) {
    return unavailable(
      identity,
      request,
      ['contractId'],
      [
        `The ledger holds no current events for contract ${contractId} in world ${worldId}; this history is not available to project.`,
      ]
    );
  }

  // The chain, not a timestamp sort, is the order. A validated ledger always
  // walks, but the walk still reports rather than assumes: a `null` here means
  // the history could not be replayed as one line, which is unsupported history
  // rather than an answer.
  const chain = walkChain(forContract);
  if (!chain) {
    return unavailable(
      identity,
      request,
      ['contractId'],
      [
        `The history of contract ${contractId} in world ${worldId} could not be replayed as a single chain, so no version can be projected.`,
      ]
    );
  }

  const asOfTime = parseZonedDateTime(asOfDate) as number;
  // Inclusive at the boundary: an event effective exactly at the requested
  // instant has taken effect. Everything later is future and is excluded.
  const consumed = chain.filter((event) => effectiveTime(event) <= asOfTime);
  const future = chain.filter((event) => effectiveTime(event) > asOfTime);

  const subject = chain[0];
  const consumedEvents = Object.freeze(consumed.map(projectionEvent));
  const futureEvents = Object.freeze(future.map(projectionEvent));

  if (consumed.length === 0) {
    return Object.freeze({
      state: 'not-yet-effective' as const,
      ledger: identity,
      worldId,
      contractId,
      playerId: subject.playerId,
      teamId: subject.teamId,
      asOfDate,
      salaryCapYear,
      contractVersion: null,
      contractState: null,
      evidenceStatus: null,
      needsInputReasons: Object.freeze([]),
      effectiveEvent: null,
      consumedEvents,
      futureEvents,
      missingInputs: Object.freeze([]),
      unavailableReasons: Object.freeze([
        `No event of contract ${contractId} was effective at or before ${asOfDate}; the earliest takes effect ${chain[0].effectiveAt}.`,
      ]),
      manifest: null,
    });
  }

  const effective = consumed[consumed.length - 1];

  const manifest: LifecycleProjectionManifest = Object.freeze({
    manifestVersion: 2 as const,
    ledger: identity,
    worldId,
    contractId,
    playerId: subject.playerId,
    teamId: subject.teamId,
    asOfDate,
    salaryCapYear,
    seasonKey,
    consumedEvents,
    resultingContractVersion: effective.resultingContractVersion,
    resultingStateDigest: effective.resultingState.stateDigest,
    sourceRelease: effective.resultingState.source,
  });

  return Object.freeze({
    state: 'projected' as const,
    ledger: identity,
    worldId,
    contractId,
    playerId: subject.playerId,
    teamId: subject.teamId,
    asOfDate,
    salaryCapYear,
    contractVersion: effective.resultingContractVersion,
    contractState: effective.resultingState,
    evidenceStatus: effective.resultingState.completeness.status,
    needsInputReasons: Object.freeze([
      ...effective.resultingState.completeness.reasons,
    ]),
    effectiveEvent: projectionEvent(effective),
    consumedEvents,
    futureEvents,
    missingInputs: Object.freeze([]),
    unavailableReasons: Object.freeze([]),
    manifest,
  });
}

/**
 * Whether a manifest still describes the history the ledger now holds.
 *
 * A later event or a corrected version must not change an earlier projection,
 * so this reports drift instead of rewriting anything: `unchanged` when every
 * consumed event is still present at the same version, `superseded` when one
 * has been revised, `absent` when one is no longer current, and `extended` when
 * the history has grown past what the manifest consumed.
 */
export type LifecycleManifestDriftKind =
  | 'event-absent'
  | 'event-superseded'
  | 'event-content-changed'
  | 'history-extended';

export interface LifecycleManifestDrift {
  readonly kind: LifecycleManifestDriftKind;
  readonly eventId: string;
  readonly eventVersion: number;
  readonly detail: string;
}

export interface LifecycleManifestVerification {
  readonly state: 'unchanged' | 'drifted' | 'not-comparable';
  readonly drift: readonly LifecycleManifestDrift[];
}

/**
 * Every field a projection retains about an event. Drift compares all of them,
 * not a chosen few: a manifest certifies the whole record it consumed, so any
 * retained field moving under an unchanged identity is drift.
 */
const PROJECTION_EVENT_FIELDS = [
  'eventKind',
  'executedAt',
  'effectiveAt',
  'recordedAt',
  'predecessorContractVersion',
  'resultingContractVersion',
  'sourceTransactionId',
  'authoringIdentity',
  'resultingState',
] as const;

export function verifyContractProjectionManifest(
  manifest: LifecycleProjectionManifest | null,
  ledger: LifecycleEventLedger | null
): LifecycleManifestVerification {
  if (!manifest || !ledger) {
    return Object.freeze({
      state: 'not-comparable' as const,
      drift: Object.freeze([]),
    });
  }

  if (manifest.manifestVersion !== 2) {
    return Object.freeze({
      state: 'not-comparable' as const,
      drift: Object.freeze([]),
    });
  }

  // A manifest can only be verified against the ledger it was taken from.
  // Comparing it to a different ledger would report every event as absent and
  // read as drift, when the truth is that the two are not comparable at all.
  if (manifest.ledger.ledgerId !== ledger.ledgerId) {
    return Object.freeze({
      state: 'not-comparable' as const,
      drift: Object.freeze([]),
    });
  }

  // The manifest arrives from the caller, so its date is read with the governed
  // primitive rather than `Date.parse`. `Date.parse` would silently interpret an
  // unzoned string as local time and produce a plausible but wrong window, and
  // comparing against a `null` would coerce to 0 and report no drift at all.
  // Neither is an answer, so an uninterpretable date is not comparable.
  const manifestAsOfTime = parseZonedDateTime(manifest.asOfDate);
  if (manifestAsOfTime === null) {
    return Object.freeze({
      state: 'not-comparable' as const,
      drift: Object.freeze([]),
    });
  }

  const drift: LifecycleManifestDrift[] = [];

  manifest.consumedEvents.forEach((consumed) => {
    const sameId = ledger.events.filter(
      (event) =>
        event.worldId === manifest.worldId &&
        event.contractId === manifest.contractId &&
        event.eventId === consumed.eventId
    );
    const exact = sameId.find(
      (event) => event.eventVersion === consumed.eventVersion
    );

    if (!exact) {
      drift.push({
        kind: 'event-absent',
        eventId: consumed.eventId,
        eventVersion: consumed.eventVersion,
        detail: `${consumed.eventId}@v${consumed.eventVersion} is no longer present in ledger ${ledger.ledgerId}@v${ledger.ledgerVersion}.`,
      });
      return;
    }

    if (exact.recordStatus === 'superseded') {
      const current = sameId.find((event) => event.recordStatus === 'current');
      drift.push({
        kind: 'event-superseded',
        eventId: consumed.eventId,
        eventVersion: consumed.eventVersion,
        detail: `${eventKey(exact)} has been superseded${
          current ? ` by ${eventKey(current)}` : ''
        }; the earlier projection keeps the version it consumed.`,
      });
      return;
    }

    // Same identity, changed content. Immutability makes this unreachable
    // through the constructor, so reaching it means the ledger was rebuilt from
    // altered input under an identity it already used.
    const changed = PROJECTION_EVENT_FIELDS.filter((field) => {
      if (field === 'resultingState') {
        return (
          exact.resultingState.stateDigest !==
          consumed.resultingState.stateDigest
        );
      }
      return exact[field] !== consumed[field];
    });
    if (changed.length > 0) {
      drift.push({
        kind: 'event-content-changed',
        eventId: consumed.eventId,
        eventVersion: consumed.eventVersion,
        detail: `${eventKey(
          exact
        )} keeps its identity but no longer matches the content the manifest consumed (${changed.join(
          ', '
        )}).`,
      });
    }
  });

  const consumedKeys = new Set(
    manifest.consumedEvents.map(
      (event) => `${event.eventId}@v${event.eventVersion}`
    )
  );
  ledger.events
    .filter(
      (event) =>
        event.recordStatus === 'current' &&
        event.worldId === manifest.worldId &&
        event.contractId === manifest.contractId &&
        !consumedKeys.has(eventKey(event)) &&
        effectiveTime(event) <= manifestAsOfTime
    )
    .forEach((event) => {
      drift.push({
        kind: 'history-extended',
        eventId: event.eventId,
        eventVersion: event.eventVersion,
        detail: `${eventKey(
          event
        )} is now effective at or before ${manifest.asOfDate} but was not consumed by this manifest.`,
      });
    });

  return Object.freeze({
    state: drift.length === 0 ? ('unchanged' as const) : ('drifted' as const),
    drift: Object.freeze(drift.map((entry) => Object.freeze(entry))),
  });
}
