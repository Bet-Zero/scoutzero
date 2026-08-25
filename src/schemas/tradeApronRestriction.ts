import { z } from 'zod';

export const TradeApronRestrictionRowZ = z.enum(['C', 'F', 'H', 'I']);
export const TradeApronLevelZ = z.enum(['FIRST_APRON', 'SECOND_APRON']);

export const TradeHardCapProofZ = z
  .object({
    registryId: z.string().min(1),
    registryVersion: z.number().int().positive(),
    canonCandidateCommit: z.string().min(1),
    canonSha256: z.string().min(1),
    calendarRecordId: z.string().min(1),
    calendarRecordVersion: z.number().int().positive(),
    apronRecordId: z.string().min(1),
    apronRecordVersion: z.number().int().positive(),
  })
  .strict();

export const TradeApronRestrictionTriggerZ = z
  .object({
    restrictionRow: TradeApronRestrictionRowZ,
    componentId: z.string().min(1),
    componentKind: z.enum([
      'SIGN_AND_TRADE',
      'ELECTED_PATH',
      'HELD_STANDARD_TPE',
      'CASH',
    ]),
    salaryMatchingPath: z.enum([
      'STANDARD_TPE',
      'AGGREGATED_STANDARD_TPE',
      'ROOM',
    ]),
    apronLevel: TradeApronLevelZ,
    ceiling: z.number().finite().positive(),
    incomingPlayers: z.array(
      z
        .object({
          playerId: z.string().min(1),
          playerName: z.string(),
          salary: z.number().finite().nonnegative(),
        })
        .strict()
    ),
    cashAmountCents: z.number().int().positive().safe().nullable(),
    tpeTiming: z
      .object({
        tpeId: z.string().min(1),
        createdOn: z.string().min(1),
        expiresOn: z.string().min(1),
      })
      .strict()
      .nullable(),
    regularSeasonClosing: z.string().min(1).nullable(),
    canonLeafIds: z.array(z.string().min(1)).min(1),
    proof: TradeHardCapProofZ,
  })
  .strict()
  .superRefine((trigger, context) => {
    if (trigger.restrictionRow === 'C') {
      if (
        trigger.componentKind !== 'SIGN_AND_TRADE' ||
        trigger.apronLevel !== 'FIRST_APRON' ||
        trigger.tpeTiming !== null ||
        trigger.regularSeasonClosing !== null ||
        trigger.cashAmountCents !== null ||
        trigger.incomingPlayers.length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Row C requires one receiving sign-and-trade component and the First Apron.',
        });
      }
    } else if (trigger.restrictionRow === 'F') {
      if (
        trigger.componentKind !== 'HELD_STANDARD_TPE' ||
        trigger.salaryMatchingPath !== 'STANDARD_TPE' ||
        trigger.apronLevel !== 'FIRST_APRON' ||
        !trigger.tpeTiming ||
        trigger.tpeTiming.tpeId !== trigger.componentId ||
        !trigger.regularSeasonClosing ||
        trigger.cashAmountCents !== null ||
        trigger.incomingPlayers.length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Row F requires one attributable held Standard TPE, its timing, creation-season closing, and the First Apron.',
        });
      }
    } else if (trigger.restrictionRow === 'H') {
      if (
        trigger.componentKind !== 'ELECTED_PATH' ||
        trigger.salaryMatchingPath !== 'AGGREGATED_STANDARD_TPE' ||
        trigger.apronLevel !== 'SECOND_APRON' ||
        trigger.tpeTiming !== null ||
        trigger.cashAmountCents !== null ||
        trigger.incomingPlayers.length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Row H requires an attributable Aggregated Standard TPE component and the Second Apron.',
        });
      }
    } else if (
      trigger.componentKind !== 'CASH' ||
      trigger.apronLevel !== 'SECOND_APRON' ||
      trigger.tpeTiming !== null ||
      trigger.regularSeasonClosing !== null ||
      trigger.cashAmountCents === null ||
      trigger.incomingPlayers.length !== 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Row I requires a positive cash-payment component and the Second Apron.',
      });
    }
  });

export const TradeHardCapLedgerEntryZ = z
  .object({
    version: z.literal(1),
    entryId: z.string().min(1),
    teamCode: z.string().min(1),
    salaryCapYear: z.number().int().positive(),
    restrictionRow: TradeApronRestrictionRowZ,
    salaryMatchingPath: z.enum([
      'STANDARD_TPE',
      'AGGREGATED_STANDARD_TPE',
      'ROOM',
    ]),
    apronLevel: TradeApronLevelZ,
    ceiling: z.number().finite().positive(),
    triggerTransactionDate: z.string().min(1),
    effectiveAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    transactionId: z.string().min(1),
    tpeIds: z.array(z.string().min(1)),
    tpeTimings: z.array(
      z
        .object({
          tpeId: z.string().min(1),
          createdOn: z.string().min(1),
          expiresOn: z.string().min(1),
        })
        .strict()
    ),
    canonLeafIds: z.array(z.string().min(1)).min(1),
    proof: TradeHardCapProofZ,
    triggers: z.array(TradeApronRestrictionTriggerZ).min(1),
  })
  .strict()
  .superRefine((entry, context) => {
    const controllingCeiling = Math.min(
      ...entry.triggers.map((trigger) => trigger.ceiling)
    );
    const controllingTriggers = entry.triggers.filter(
      (trigger) => trigger.ceiling === controllingCeiling
    );
    if (
      entry.ceiling !== controllingCeiling ||
      !controllingTriggers.some(
        (trigger) =>
          trigger.restrictionRow === entry.restrictionRow &&
          trigger.apronLevel === entry.apronLevel
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'The durable hard-cap entry must retain the strictest attached restriction as its controlling ceiling.',
      });
    }

    const componentIds = new Set<string>();
    const playerIds = new Set<string>();
    entry.triggers.forEach((trigger) => {
      if (componentIds.has(trigger.componentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conflicting hard-cap component attribution: ${trigger.componentId}.`,
        });
      }
      componentIds.add(trigger.componentId);
      trigger.incomingPlayers.forEach((player) => {
        if (playerIds.has(player.playerId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Conflicting hard-cap player attribution: ${player.playerId}.`,
          });
        }
        playerIds.add(player.playerId);
      });
    });
  });

export const TradeHardCapLedgerZ = z.array(TradeHardCapLedgerEntryZ);

export type TradeApronRestrictionRow = z.infer<
  typeof TradeApronRestrictionRowZ
>;
export type TradeApronLevel = z.infer<typeof TradeApronLevelZ>;
export type TradeHardCapProof = z.infer<typeof TradeHardCapProofZ>;
export type TradeApronRestrictionTrigger = z.infer<
  typeof TradeApronRestrictionTriggerZ
>;
export type TradeHardCapLedgerEntry = z.infer<typeof TradeHardCapLedgerEntryZ>;
