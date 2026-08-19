/** Read and date-test the one-year restrictions created by an Offer Sheet match. */

import {
  GovernedOfferSheetMatchRestrictionZ,
  type GovernedOfferSheetMatchRestriction,
} from '@/schemas/governedOfferSheet';

export type GovernedOfferSheetRestrictionState =
  | { status: 'absent' | 'expired' }
  | { status: 'active'; restriction: GovernedOfferSheetMatchRestriction }
  | { status: 'incompatible' | 'needs-input' };

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function inspectGovernedOfferSheetMatchRestriction(
  value: unknown,
  asOf: string | number | Date | null | undefined
): GovernedOfferSheetRestrictionState {
  if (value == null) return { status: 'absent' };

  const parsed = GovernedOfferSheetMatchRestrictionZ.safeParse(value);
  if (!parsed.success) return { status: 'incompatible' };
  if (asOf == null) return { status: 'needs-input' };

  if (typeof asOf === 'string' && isDateOnly(asOf)) {
    // Date-only Team Plan evaluations keep the restriction active for the
    // entire local calendar date named by restrictedUntil.
    return asOf <= parsed.data.restrictedUntil.slice(0, 10)
      ? { status: 'active', restriction: parsed.data }
      : { status: 'expired' };
  }

  const asOfMilliseconds =
    asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  const restrictionMilliseconds = new Date(
    parsed.data.restrictedUntil
  ).getTime();
  if (
    !Number.isFinite(asOfMilliseconds) ||
    !Number.isFinite(restrictionMilliseconds)
  ) {
    return { status: 'needs-input' };
  }

  // Exact instants expire at restrictedUntil itself; there is no extra
  // end-of-day grace period on timestamped transaction evaluations.
  return asOfMilliseconds < restrictionMilliseconds
    ? { status: 'active', restriction: parsed.data }
    : { status: 'expired' };
}
