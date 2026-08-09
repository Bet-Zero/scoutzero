/**
 * FILE: src/schemas/contractEventLedger.ts
 * PURPOSE: Canonical runtime contract for immutable contract lifecycle events and their wire payload.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271. AGENTS.md makes `src/schemas/` the canonical contract layer, so the
 * shapes that cross a trust boundary — one lifecycle event, and the serialized
 * ledger payload that carries them — are declared here as Zod schemas and used
 * at runtime by every entry point.
 *
 * This exists because a TypeScript type is erased at runtime. Asserting a parsed
 * JSON blob is a record proves nothing, and a field-by-field hand check is only
 * as complete as the checks someone remembered to write. The concrete defect
 * this closes: provenance was validated as "at least one of the two identities
 * is a non-empty string", so a numeric `sourceTransactionId` sitting beside a
 * valid `authoringIdentity` passed and was stored under a `string | null` field.
 * The reverse passed too, and it passed on the in-memory path as well as the
 * deserialization one.
 *
 * SPLIT OF RESPONSIBILITY. This module owns the shape: field presence, runtime
 * types, enum membership, collection element types, provenance nullability, and
 * the rule that at least one provenance identity is present. It deliberately
 * does not own zoned-instant validity, causality, chain structure, ordering, or
 * supersession — those are relational or date rules the history path applies
 * with BZE-270's governed date primitives. Duplicating date validation here
 * would create a second source of truth for what a valid instant is.
 *
 * Timestamps are therefore typed as `string` here (which is what rejects a
 * numeric timestamp) and validated as zoned instants by the history path.
 */

import { z } from 'zod';

/** Bump only for a wire format change that older payloads cannot satisfy. */
export const CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION = 1;

/**
 * A string carrying at least one non-whitespace character. `z.string().min(1)`
 * would accept `'   '`, which is not an identity. Validated rather than trimmed
 * so the stored value is never rewritten — a transform here would make the
 * serialization round-trip lossy.
 */
const NonEmptyStringZ = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: 'must contain at least one non-whitespace character',
  });

/**
 * A provenance identity: a real string, or explicitly absent. `null` is a
 * declaration that this identity does not apply; `undefined`, a number, or a
 * blank string are not.
 */
const ProvenanceIdentityZ = NonEmptyStringZ.nullable();

/** A positive contract or record version. */
const PositiveVersionZ = z.number().int().min(1);

/**
 * The seven lifecycle families of Canon `CBA2-L02.1`, as nine kinds. Option and
 * ETO each split into exercise and decline because they produce different
 * resulting contract versions and are not the same act.
 */
export const ContractEventKindZ = z.enum([
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

export const ContractEventStatusZ = z.enum(['current', 'superseded']);

/**
 * One immutable contract lifecycle event.
 *
 * Strict: an unknown key is rejected rather than silently dropped. A field this
 * contract does not know about is either a typo or data from a newer format,
 * and accepting it while discarding it is exactly the silent loss the payload
 * version guard exists to prevent.
 */
export const ContractEventRecordZ = z
  .strictObject({
    eventId: NonEmptyStringZ,
    eventVersion: PositiveVersionZ,
    eventKind: ContractEventKindZ,
    worldId: NonEmptyStringZ,
    contractId: NonEmptyStringZ,
    playerId: NonEmptyStringZ,
    teamId: NonEmptyStringZ,
    executedAt: z.string(),
    effectiveAt: z.string(),
    recordedAt: z.string(),
    predecessorContractVersion: PositiveVersionZ.nullable(),
    resultingContractVersion: PositiveVersionZ,
    predecessorEventId: NonEmptyStringZ.nullable(),
    sourceTransactionId: ProvenanceIdentityZ,
    authoringIdentity: ProvenanceIdentityZ,
    recordStatus: ContractEventStatusZ,
    supersedesEventVersion: PositiveVersionZ.nullable(),
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
  })
  .superRefine((record, ctx) => {
    // An event with neither identity cannot be traced to anything that produced
    // it. Expressed here rather than as two optional fields because the rule is
    // about the pair, not about either field alone.
    if (
      record.sourceTransactionId === null &&
      record.authoringIdentity === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceTransactionId'],
        message:
          'an event must retain a source transaction identity or an authoring identity',
      });
    }
  });

/** The serialized ledger envelope. Strict for the same reason as the record. */
export const ContractEventLedgerPayloadZ = z.strictObject({
  payloadVersion: z.literal(CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION),
  ledgerId: NonEmptyStringZ,
  ledgerVersion: PositiveVersionZ,
  events: z.array(ContractEventRecordZ),
});

/**
 * Readonly view of a parsed shape. The runtime schema produces mutable objects;
 * the history path stores frozen ones, and the type should say so.
 */
type ReadonlyShape<T> = {
  readonly [K in keyof T]: T[K] extends Array<infer U> ? readonly U[] : T[K];
};

export type ContractEventKind = z.infer<typeof ContractEventKindZ>;
export type ContractEventStatus = z.infer<typeof ContractEventStatusZ>;
export type ContractEventRecord = ReadonlyShape<
  z.infer<typeof ContractEventRecordZ>
>;
export type ContractEventLedgerPayload = ReadonlyShape<
  z.infer<typeof ContractEventLedgerPayloadZ>
>;

/** The supported event kinds, in declaration order. */
export const CONTRACT_EVENT_KINDS: readonly ContractEventKind[] =
  ContractEventKindZ.options;

export function isContractEventKind(
  value: unknown
): value is ContractEventKind {
  return ContractEventKindZ.safeParse(value).success;
}
