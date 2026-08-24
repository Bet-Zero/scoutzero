import { z } from 'zod';
import { JsonValueZ, SeasonCodeZ } from './common';
import { SeasonCloseApronMeasurementZ } from './salaryBooks';

const StateDigestZ = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const ZonedInstantZ = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ) && Number.isFinite(Date.parse(value)),
    { message: 'must be an ISO-8601 instant with an explicit UTC offset' }
  );

export const SeasonContractTransitionEventZ = z
  .object({
    eventId: z.string().min(1),
    eventVersion: z.literal(1),
    eventKind: z.enum([
      'contract-activated',
      'contract-rolled',
      'contract-expired',
      'option-exercised',
      'option-declined',
    ]),
    worldId: z.string().min(1),
    teamCode: z.string().min(2).max(5),
    playerId: z.string().min(1),
    contractId: z.string().min(1),
    effectiveAt: ZonedInstantZ,
    beforeContract: JsonValueZ.nullable(),
    afterContract: JsonValueZ.nullable(),
    beforeContractDigest: StateDigestZ,
    afterContractDigest: StateDigestZ,
    sourceContractEvent: z
      .object({
        ledgerId: z.string().min(1),
        ledgerVersion: z.number().int().min(1),
        eventId: z.string().min(1),
        eventVersion: z.number().int().min(1),
        eventKind: z.enum([
          'option-exercise',
          'option-decline',
          'eto-exercise',
          'eto-decline',
        ]),
      })
      .strict()
      .nullable(),
    canonLeafIds: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((event, context) => {
    const isOption = event.eventKind.startsWith('option-');
    if (isOption !== (event.sourceContractEvent !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceContractEvent'],
        message:
          'Option transition events require one immutable governed contract-event reference; non-option rollover events cannot claim one.',
      });
    }
  });

export const SeasonHistoryRecordZ = z
  .object({
    schemaVersion: z.literal('season-history-v1'),
    historyId: z.string().min(1),
    transitionId: z.string().min(1),
    worldId: z.string().min(1),
    teamCode: z.string().min(2).max(5),
    fromSeason: SeasonCodeZ,
    toSeason: SeasonCodeZ,
    seasonCloseDate: z.string().date(),
    transitionEffectiveAt: ZonedInstantZ,
    preAdvanceState: JsonValueZ,
    preAdvanceStateDigest: StateDigestZ,
    finalRoster: z.array(JsonValueZ),
    finalRosterDigest: StateDigestZ,
    seasonCloseApronMeasurement: SeasonCloseApronMeasurementZ,
    beforeTotals: JsonValueZ,
    afterTotals: JsonValueZ,
    contractEvents: z.array(SeasonContractTransitionEventZ),
    entitlementStateDigest: StateDigestZ,
    authorityDigest: StateDigestZ,
  })
  .strict();

const SeasonTransitionTeamRecordZ = z
  .object({
    teamCode: z.string().min(2).max(5),
    historyId: z.string().min(1),
    preAdvanceStateDigest: StateDigestZ,
    committedStateDigest: StateDigestZ,
    finalRosterDigest: StateDigestZ,
    seasonCloseApronMeasurementDigest: StateDigestZ,
    entitlementStateDigest: StateDigestZ,
    contractEventIds: z.array(z.string().min(1)),
    booksStatus: z.literal('complete'),
  })
  .strict();

export const SeasonTransitionManifestZ = z
  .object({
    schemaVersion: z.literal('season-transition-manifest-v1'),
    transitionId: z.string().min(1),
    operationId: z.string().min(1),
    eventId: z.string().min(1),
    worldId: z.string().min(1),
    fromSeason: SeasonCodeZ,
    toSeason: SeasonCodeZ,
    fromSalaryCapYear: z.number().int(),
    toSalaryCapYear: z.number().int(),
    seasonCloseDate: z.string().date(),
    transitionEffectiveAt: ZonedInstantZ,
    committedAt: ZonedInstantZ,
    authority: JsonValueZ,
    authorityDigest: StateDigestZ,
    entitlementBoundary: JsonValueZ,
    preAdvanceMetadataDigest: StateDigestZ,
    teamRecords: z.array(SeasonTransitionTeamRecordZ).length(30),
    reconciliation: z
      .object({
        expectedTeamCount: z.literal(30),
        preparedTeamCount: z.literal(30),
        completeBookCount: z.literal(30),
        historyRecordCount: z.literal(30),
        entitlementPreservationCount: z.literal(30),
      })
      .strict(),
    canonLeafIds: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const teamCodes = manifest.teamRecords.map((record) => record.teamCode);
    if (new Set(teamCodes).size !== 30) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teamRecords'],
        message: 'Season transition manifest must identify 30 unique teams.',
      });
    }
  });

export type SeasonContractTransitionEvent = z.infer<
  typeof SeasonContractTransitionEventZ
>;
export type SeasonHistoryRecord = z.infer<typeof SeasonHistoryRecordZ>;
export type SeasonTransitionManifest = z.infer<
  typeof SeasonTransitionManifestZ
>;
