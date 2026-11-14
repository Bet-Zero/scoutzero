import { z } from 'zod';
import {
  isDateOnly,
  isZonedDateTime,
} from '@/features/architect/utils/governedSeason/governedTime';

const IdentityZ = z.string().trim().min(1);
const TradeDateZ = z
  .string()
  .refine((v) => isDateOnly(v) || isZonedDateTime(v));

/** Saved transaction facts, separate from the player's original signing method. */
export const TradeAcquisitionZ = z.strictObject({
  transactionId: IdentityZ,
  playerId: IdentityZ,
  teamCode: IdentityZ,
  acquiredAt: TradeDateZ,
  viaException: z.boolean(),
});
export const TradeAcquisitionHistoryZ = z.strictObject({
  version: z.literal(1),
  baseline: z
    .strictObject({
      asOfDate: z.string().refine(isDateOnly),
      playerIds: z.array(IdentityZ),
      assumptionId: z.literal('starting-roster-acquisitions'),
    })
    .nullable(),
  entries: z.array(TradeAcquisitionZ),
});

/** Per-player authority loaded with the governed Contract; never an election. */
export const TradeAggregationFactsZ = z.strictObject({
  acquisition: z.discriminatedUnion('status', [
    z.strictObject({
      status: z.literal('known'),
      acquiredAt: TradeDateZ,
      viaException: z.boolean(),
    }),
    z.strictObject({
      status: z.literal('baseline-assumption'),
      asOfDate: z.string().refine(isDateOnly),
    }),
    z.strictObject({ status: z.literal('unknown') }),
  ]),
  minimumSalaryCapYear: z.number().int(),
  minimumTradedPlayer: z.boolean().nullable(),
});

export type TradeAcquisition = z.infer<typeof TradeAcquisitionZ>;
export type TradeAcquisitionHistory = z.infer<typeof TradeAcquisitionHistoryZ>;
export type TradeAggregationFacts = z.infer<typeof TradeAggregationFactsZ>;
