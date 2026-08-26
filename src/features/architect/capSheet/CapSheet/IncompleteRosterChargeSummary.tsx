import { useId } from 'react';
import type { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type CanonicalTotals = ReturnType<
  typeof createCanonicalTeamTotalsSnapshot
>;

interface IncompleteRosterChargeSummaryProps {
  canonicalTotals: CanonicalTotals;
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);

export function IncompleteRosterChargeSummary({
  canonicalTotals,
}: IncompleteRosterChargeSummaryProps) {
  const reasonId = useId();
  const resolution = canonicalTotals.incompleteRosterResolution;

  if (resolution?.status === 'needs-input') {
    return (
      <div
        data-testid="incomplete-roster-charge-needs-input"
        aria-describedby={reasonId}
        className="flex min-w-0 items-baseline gap-1.5"
      >
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-cockpit-watch">
          Incomplete Roster
        </p>
        <span className="text-xs font-bold text-cockpit-watch">
          Needs input
        </span>
        <span id={reasonId} className="sr-only">
          {resolution.reason}
        </span>
      </div>
    );
  }

  const amount = canonicalTotals.incompleteChargesTotal;
  if (amount === null || amount <= 0) return null;

  const missingSlots = canonicalTotals._meta?.incompleteRosterCharge?.missingSlots;
  return (
    <div
      data-testid="incomplete-roster-charge-row"
      className="flex min-w-0 items-baseline gap-1.5"
    >
      <p
        className="truncate text-[10px] font-semibold uppercase tracking-wider text-cockpit-watch"
        title={
          missingSlots
            ? `Incomplete Roster Charge — ${missingSlots} open ${
                missingSlots === 1 ? 'slot' : 'slots'
              }`
            : 'Incomplete Roster Charge'
        }
      >
        Incomplete Roster Charge
        {missingSlots ? (
          <span className="sr-only">
            {' '}
            {missingSlots} open {missingSlots === 1 ? 'slot' : 'slots'}
          </span>
        ) : null}
      </p>
      <span className="text-xs font-bold tabular-nums text-cockpit-watch">
        {formatMoney(amount)}
      </span>
    </div>
  );
}
