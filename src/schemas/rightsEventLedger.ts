/**
 * Canonical runtime contract for dated free-agent rights state.
 *
 * BZE-273 deliberately owns only Bird-right classification, free-agent amount
 * inputs, right-of-first-refusal status, and renunciation. It is not a generic
 * event store and it does not own signing, qualifying offers, offer sheets, or
 * exception use.
 */

import { z } from 'zod';

export const RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION = 1;
export const RIGHTS_LEDGER_WORLD_VERSION = 1;

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const PositiveVersionZ = z.number().int().min(1);
const NonNegativeMoneyZ = z.number().int().nonnegative();

export const RightsRecordStatusZ = z.enum(['current', 'superseded']);
export const BirdRightsTypeZ = z.enum([
  'Full Bird',
  'Early Bird',
  'Non-Bird',
]);
export const FreeAgentStatusZ = z.enum(['UFA', 'RFA']);
export const RightOfFirstRefusalStatusZ = z.enum([
  'active',
  'inactive',
  'not-applicable',
]);

export const RightsSourceReferenceZ = z.strictObject({
  sourceId: NonEmptyStringZ,
  sourceVersion: PositiveVersionZ,
  authority: z.enum(['official', 'projected']),
  artifact: NonEmptyStringZ,
  field: NonEmptyStringZ,
  effectiveFrom: z.string(),
  effectiveThrough: z.string(),
  recordStatus: RightsRecordStatusZ,
  supersedesSourceVersion: PositiveVersionZ.nullable(),
});

export const RightsServiceSeasonZ = z.strictObject({
  serviceRecordId: NonEmptyStringZ,
  serviceRecordVersion: PositiveVersionZ,
  salaryCapYear: z.number().int(),
  serviceStatus: z.enum(['credited', 'not-credited']),
  creditedTeamId: NonEmptyStringZ.nullable(),
  rightsTeamId: NonEmptyStringZ,
  continuityRoute: z.enum([
    'same-team',
    'trade-assignment',
    'first-season-waiver-claim',
    'first-season-free-agent-signing',
    'not-applicable',
  ]),
  continuityEventId: NonEmptyStringZ.nullable(),
  source: RightsSourceReferenceZ,
  recordStatus: RightsRecordStatusZ,
  supersedesServiceRecordVersion: PositiveVersionZ.nullable(),
});

export const FreeAgentAmountKindZ = z.enum([
  'prior-regular-salary',
  'prior-signing-bonus-allocation',
  'earned-performance-bonuses',
  'applicable-minimum-salary',
  'two-years-service-minimum-salary',
  'applicable-maximum-salary',
  'estimated-average-player-salary',
]);

export const FreeAgentAmountRecordZ = z.strictObject({
  amountRecordId: NonEmptyStringZ,
  amountRecordVersion: PositiveVersionZ,
  kind: FreeAgentAmountKindZ,
  salaryCapYear: z.number().int(),
  amount: NonNegativeMoneyZ,
  source: RightsSourceReferenceZ,
  recordStatus: RightsRecordStatusZ,
  supersedesAmountRecordVersion: PositiveVersionZ.nullable(),
});

export const PriorContractRightsEvidenceZ = z.strictObject({
  contractId: NonEmptyStringZ,
  contractVersion: PositiveVersionZ,
  finalSalaryCapYear: z.number().int(),
  wasOneSeasonMinimumContract: z.boolean(),
  wasRookieScaleFourthYear: z.boolean(),
  source: RightsSourceReferenceZ,
});

export const RightsStateReferenceZ = z.strictObject({
  stateId: NonEmptyStringZ,
  stateVersion: PositiveVersionZ,
});

export const RightsProvenanceZ = z
  .strictObject({
    sourceTransactionId: NonEmptyStringZ.nullable(),
    authoringIdentity: NonEmptyStringZ.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceTransactionId === null && value.authoringIdentity === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceTransactionId'],
        message:
          'rights history must retain a transaction or authoring identity',
      });
    }
  });

const RightsEventBaseShape = {
  eventId: NonEmptyStringZ,
  eventVersion: PositiveVersionZ,
  worldId: NonEmptyStringZ,
  playerId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  salaryCapYear: z.number().int(),
  executedAt: z.string(),
  effectiveAt: z.string(),
  recordedAt: z.string(),
  predecessorEventId: NonEmptyStringZ.nullable(),
  predecessorState: RightsStateReferenceZ.nullable(),
  resultingState: RightsStateReferenceZ,
  provenance: RightsProvenanceZ,
  recordStatus: RightsRecordStatusZ,
  supersedesEventVersion: PositiveVersionZ.nullable(),
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
} as const;

export const RightsEstablishedEventZ = z.strictObject({
  ...RightsEventBaseShape,
  eventKind: z.literal('rights-established'),
  freeAgentStatus: FreeAgentStatusZ,
  rightOfFirstRefusal: RightOfFirstRefusalStatusZ,
  serviceHistoryCompleteFromSalaryCapYear: z.number().int(),
  serviceSeasons: z.array(RightsServiceSeasonZ),
  priorContract: PriorContractRightsEvidenceZ,
  amountRecords: z.array(FreeAgentAmountRecordZ),
});

export const EarlyBirdElectionEventZ = z.strictObject({
  ...RightsEventBaseShape,
  eventKind: z.literal('early-bird-election'),
  electedContractId: NonEmptyStringZ,
  sourceRightsState: RightsStateReferenceZ,
});

export const RightsRenunciationEventZ = z.strictObject({
  ...RightsEventBaseShape,
  eventKind: z.literal('rights-renounced'),
  renouncedBirdType: BirdRightsTypeZ,
  renouncedFreeAgentAmount: NonNegativeMoneyZ,
});

export const RightsEventRecordZ = z.discriminatedUnion('eventKind', [
  RightsEstablishedEventZ,
  EarlyBirdElectionEventZ,
  RightsRenunciationEventZ,
]);

export const RightsEventLedgerPayloadZ = z.strictObject({
  payloadVersion: z.literal(RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION),
  ledgerId: NonEmptyStringZ,
  ledgerVersion: PositiveVersionZ,
  worldId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  events: z.array(RightsEventRecordZ),
});

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type BirdRightsType = z.infer<typeof BirdRightsTypeZ>;
export type FreeAgentStatus = z.infer<typeof FreeAgentStatusZ>;
export type RightOfFirstRefusalStatus = z.infer<
  typeof RightOfFirstRefusalStatusZ
>;
export type RightsSourceReference = DeepReadonly<
  z.infer<typeof RightsSourceReferenceZ>
>;
export type RightsServiceSeason = DeepReadonly<
  z.infer<typeof RightsServiceSeasonZ>
>;
export type FreeAgentAmountKind = z.infer<typeof FreeAgentAmountKindZ>;
export type FreeAgentAmountRecord = DeepReadonly<
  z.infer<typeof FreeAgentAmountRecordZ>
>;
export type PriorContractRightsEvidence = DeepReadonly<
  z.infer<typeof PriorContractRightsEvidenceZ>
>;
export type RightsStateReference = DeepReadonly<
  z.infer<typeof RightsStateReferenceZ>
>;
export type RightsEventRecord = DeepReadonly<
  z.infer<typeof RightsEventRecordZ>
>;
export type RightsEstablishedEvent = DeepReadonly<
  z.infer<typeof RightsEstablishedEventZ>
>;
export type EarlyBirdElectionEvent = DeepReadonly<
  z.infer<typeof EarlyBirdElectionEventZ>
>;
export type RightsRenunciationEvent = DeepReadonly<
  z.infer<typeof RightsRenunciationEventZ>
>;
export type RightsEventLedgerPayload = DeepReadonly<
  z.infer<typeof RightsEventLedgerPayloadZ>
>;
