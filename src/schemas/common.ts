import { z } from 'zod';

// Shared scalars and helpers for schema definitions

// Firestore Timestamp surrogate: allow Date or Firestore-like object in parsing layers
export const TimestampZ = z.union([
  z.date(),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }),
]);

// Money in USD (integer cents or whole dollars) — we accept numbers for frontend
export const MoneyZ = z.number().nonnegative();

// Season code like "2025-26"
export const SeasonCodeZ = z.string().regex(/^[0-9]{4}-[0-9]{2}$/);

// Year like 2027
// Use coerce for record keys since JavaScript object keys are always strings
export const YearZ = z.coerce.number().int();

// Abbreviations and IDs
export const TeamCodeZ = z.string().min(2).max(5);
export const PlayerIdZ = z.string().min(2);

// Enums and common literals
export const PositionCodeZ = z.string();
export const FreeAgentTypeZ = z.enum(['UFA', 'RFA', 'SFA', 'TWO_WAY', 'NONE']);
export const OptionTypeZ = z.enum(['PO', 'TO', 'ETO']).nullable();

export type SeasonCode = z.infer<typeof SeasonCodeZ>;
export type PlayerId = z.infer<typeof PlayerIdZ>;
export type TeamCode = z.infer<typeof TeamCodeZ>;
