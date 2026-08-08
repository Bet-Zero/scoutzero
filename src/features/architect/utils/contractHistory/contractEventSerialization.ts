/**
 * FILE: src/features/architect/utils/contractHistory/contractEventSerialization.ts
 * PURPOSE: Lossless, validated serialization of the contract event ledger.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271. History that cannot survive being written down and read back is not
 * history. This module gives the ledger a stable wire form and rebuilds it
 * through the same validated constructor the in-memory path uses, so a payload
 * that has been edited, truncated, or reordered fails closed on read rather
 * than becoming a ledger nobody validated.
 *
 * Deserialization deliberately has no repair mode. It does not drop an
 * unreadable event, invent a missing predecessor, or pick between competing
 * versions — the same refusal the ledger itself makes.
 *
 * This is a wire format, not production persistence. BZE-271 migrates no saved
 * data and no Firestore document; see the compatibility fence.
 */

import {
  createContractEventLedger,
  validateContractEventLedger,
  type LifecycleEventLedger,
  type LifecycleEventRecord,
  type LifecycleLedgerValidation,
} from './contractEventRecords';

/** Bump only for a format change that older payloads cannot satisfy. */
export const CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION = 1;

export interface LifecycleEventLedgerPayload {
  readonly payloadVersion: number;
  readonly ledgerId: string;
  readonly ledgerVersion: number;
  readonly events: readonly LifecycleEventRecord[];
}

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
 */
export function toContractEventLedgerPayload(
  ledger: LifecycleEventLedger
): LifecycleEventLedgerPayload {
  return {
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
    })),
  };
}

export function serializeContractEventLedger(
  ledger: LifecycleEventLedger
): string {
  return JSON.stringify(toContractEventLedgerPayload(ledger));
}

function readPayload(serialized: string): LifecycleEventLedgerPayload {
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

  const payload = parsed as Partial<LifecycleEventLedgerPayload>;

  // A payload written by a newer format could carry fields this build drops on
  // read, which would be silent loss rather than a round-trip. Refuse instead.
  if (payload.payloadVersion !== CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION) {
    throw new ContractEventLedgerPayloadError(
      `payload version ${String(
        payload.payloadVersion
      )} is not the supported version ${CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION}`
    );
  }
  if (!Array.isArray(payload.events)) {
    throw new ContractEventLedgerPayloadError('payload has no events array');
  }

  return payload as LifecycleEventLedgerPayload;
}

/**
 * Rebuild a ledger from its wire form.
 *
 * Throws `ContractEventLedgerPayloadError` when the envelope itself is
 * unreadable, and `ContractEventLedgerError` when the events it carries do not
 * validate — the same error the in-memory constructor raises, because it is the
 * same constructor.
 */
export function deserializeContractEventLedger(
  serialized: string
): LifecycleEventLedger {
  const payload = readPayload(serialized);

  return createContractEventLedger({
    ledgerId: payload.ledgerId,
    ledgerVersion: payload.ledgerVersion,
    events: payload.events,
  });
}

/**
 * Non-throwing read. Returns the same problem list the ledger validator
 * produces so a caller can report exactly why a stored history is untrusted.
 */
export function readContractEventLedger(
  serialized: string
): LifecycleLedgerValidation {
  let payload: LifecycleEventLedgerPayload;
  try {
    payload = readPayload(serialized);
  } catch (error) {
    return Object.freeze({
      state: 'invalid' as const,
      ledger: null,
      problems: Object.freeze([
        Object.freeze({
          kind: 'missing-identity' as const,
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
