/**
 * FILE: src/features/architect/utils/contractHistory/contractEventSerialization.ts
 * PURPOSE: Lossless, canonically validated serialization of the contract event ledger.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271. History that cannot survive being written down and read back is not
 * history. This module gives the ledger a stable wire form and reads it back
 * through the canonical runtime schema in `@/schemas/contractEventLedger`, so a
 * payload that has been edited, truncated, retyped, or reordered fails closed on
 * read rather than becoming a ledger nobody validated.
 *
 * Nothing here is cast into a record type. Untrusted JSON is parsed by the
 * canonical schema, which checks every field's runtime type, and the resulting
 * data then goes through the same ledger constructor the in-memory path uses,
 * which re-applies that schema per event and adds the relational rules. Both the
 * throwing and non-throwing readers take exactly this route, so neither is a
 * laxer door.
 *
 * Deserialization has no repair mode. It does not drop an unreadable event,
 * invent a missing predecessor, or pick between competing versions.
 *
 * BZE-274 uses this wire format for newly established governed world baselines.
 * It still has no repair or migration mode: pre-v2 ledgers and old saved worlds
 * remain outside the compatibility fence.
 */

import {
  CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
  ContractEventLedgerPayloadZ,
  type ContractEventLedgerPayload,
} from '@/schemas/contractEventLedger';
import {
  createContractEventLedger,
  ContractEventLedgerError,
  ledgerProblemsFromPayloadIssues,
  validateContractEventLedger,
  type LifecycleEventLedger,
  type LifecycleLedgerValidation,
} from './contractEventRecords';

export class ContractEventLedgerPayloadError extends Error {
  constructor(detail: string) {
    super(`Unreadable contract event ledger payload: ${detail}`);
    this.name = 'ContractEventLedgerPayloadError';
  }
}

/**
 * The ledger as a plain JSON-safe object.
 *
 * Field order is fixed here rather than left to object-spread order so two
 * ledgers holding the same history serialize to the same string. Event order is
 * already deterministic: the constructor sorts on construction.
 *
 * The result is parsed by the canonical payload schema before it is returned, so
 * this module can never emit a payload its own reader would reject.
 */
export function toContractEventLedgerPayload(
  ledger: LifecycleEventLedger
): ContractEventLedgerPayload {
  return ContractEventLedgerPayloadZ.parse({
    payloadVersion: CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion,
    events: ledger.events.map((event) => ({
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
      sourceTransactionId: event.sourceTransactionId,
      authoringIdentity: event.authoringIdentity,
      recordStatus: event.recordStatus,
      supersedesEventVersion: event.supersedesEventVersion,
      canonLeafIds: [...event.canonLeafIds],
      resultingState: event.resultingState,
    })),
  });
}

export function serializeContractEventLedger(
  ledger: LifecycleEventLedger
): string {
  return JSON.stringify(toContractEventLedgerPayload(ledger));
}

/**
 * Read the envelope: is this a string, is it JSON, is it an object, does it
 * declare the format version this build writes, and does it carry an events
 * array.
 *
 * These are failures of the container rather than of the contract — at this
 * point nothing about any individual record has been established — so they are
 * the ones raised as a payload error and reported as `unreadable-payload`.
 */
function readEnvelope(serialized: string): Record<string, unknown> {
  if (typeof serialized !== 'string' || serialized.trim().length === 0) {
    throw new ContractEventLedgerPayloadError('payload is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new ContractEventLedgerPayloadError('payload is not valid JSON');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ContractEventLedgerPayloadError('payload is not an object');
  }

  const envelope = parsed as Record<string, unknown>;

  // A payload written by a newer format could carry fields this build drops on
  // read, which would be silent loss rather than a round-trip. Refuse instead.
  if (envelope.payloadVersion !== CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION) {
    throw new ContractEventLedgerPayloadError(
      `payload version ${String(
        envelope.payloadVersion
      )} is not the supported version ${CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION}`
    );
  }
  if (!Array.isArray(envelope.events)) {
    throw new ContractEventLedgerPayloadError('payload has no events array');
  }

  return envelope;
}

/**
 * Parse an untrusted payload through the canonical schema.
 *
 * Throws `ContractEventLedgerPayloadError` when the envelope is unreadable, and
 * `ContractEventLedgerError` when the contents do not satisfy the canonical
 * contract — the same error type the in-memory constructor raises, carrying the
 * same problem vocabulary. Nothing is cast into a record type: what this returns
 * has been checked field by field at runtime.
 */
function parsePayload(serialized: string): ContractEventLedgerPayload {
  // The decoded envelope is handed to the schema whole, never rebuilt from the
  // fields this module happens to know about. Reconstructing it would drop any
  // unexpected top-level key before the strict schema could see it, and would
  // bypass the canonical `payloadVersion` literal — the envelope would be
  // trusted for exactly the parts nobody checked.
  const envelope = readEnvelope(serialized);

  const parsed = ContractEventLedgerPayloadZ.safeParse(envelope);
  if (!parsed.success) {
    throw new ContractEventLedgerError(
      ledgerProblemsFromPayloadIssues(parsed.error.issues)
    );
  }

  return parsed.data;
}

/**
 * Rebuild a ledger from its wire form.
 *
 * The canonical schema settles the shape; the ledger constructor settles the
 * relationships — identities, chains, forks, ordering, and supersession.
 */
export function deserializeContractEventLedger(
  serialized: string
): LifecycleEventLedger {
  const payload = parsePayload(serialized);

  return createContractEventLedger({
    ledgerId: payload.ledgerId,
    ledgerVersion: payload.ledgerVersion,
    events: payload.events,
  });
}

/**
 * Non-throwing read. Reports the same problems the throwing reader raises, from
 * the same canonical schema and the same constructor, so a caller can show
 * exactly why a stored history is untrusted without catching.
 */
export function readContractEventLedger(
  serialized: string
): LifecycleLedgerValidation {
  let payload: ContractEventLedgerPayload;

  try {
    payload = parsePayload(serialized);
  } catch (error) {
    if (error instanceof ContractEventLedgerError) {
      return Object.freeze({
        state: 'invalid' as const,
        ledger: null,
        problems: Object.freeze([...error.problems]),
      });
    }

    return Object.freeze({
      state: 'invalid' as const,
      ledger: null,
      problems: Object.freeze([
        Object.freeze({
          // The container could not be decoded, so nothing about any record is
          // known yet. Reporting this as a record defect would name a problem
          // the reader never established.
          kind: 'unreadable-payload' as const,
          at: 'payload',
          detail:
            error instanceof Error ? error.message : 'payload is unreadable',
          eventIds: Object.freeze([]),
        }),
      ]),
    });
  }

  return validateContractEventLedger({
    ledgerId: payload.ledgerId,
    ledgerVersion: payload.ledgerVersion,
    events: payload.events,
  });
}
