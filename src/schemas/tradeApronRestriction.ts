import { z } from 'zod';

export const TradeApronRestrictionRowZ = z.enum(['F', 'H']);
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
    ]),
    apronLevel: TradeApronLevelZ,
    ceiling: z.number().finite().positive(),
    triggerTransactionDate: z.string().min(1),
    effectiveAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    transactionId: z.string().min(1),
    tpeIds: z.array(z.string().min(1)),
    canonLeafIds: z.array(z.string().min(1)).min(1),
    proof: TradeHardCapProofZ,
  })
  .strict();

export const TradeHardCapLedgerZ = z.array(TradeHardCapLedgerEntryZ);

export type TradeApronRestrictionRow = z.infer<
  typeof TradeApronRestrictionRowZ
>;
export type TradeApronLevel = z.infer<typeof TradeApronLevelZ>;
export type TradeHardCapProof = z.infer<typeof TradeHardCapProofZ>;
export type TradeHardCapLedgerEntry = z.infer<
  typeof TradeHardCapLedgerEntryZ
>;
