/**
 * FILE: src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx
 * PURPOSE: Stage 2B post-action handoff strip — compact "what just committed" summary.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Renders the active session-scoped post-action receipt with deep links to
 * Cap Sheet, Roster, and History. Navigation only — no mutation callbacks,
 * no Firestore writes, no validation or delta claims.
 *
 * Truth authority: the receipt itself is a derived view of a successful
 * committed mutation result. This component does not produce new truth.
 */
import type { ArchitectPostActionReceipt } from '../postActionHandoff/types';

interface Props {
  receipt: ArchitectPostActionReceipt | null;
  onNavigateToCapSheet: () => void;
  onNavigateToRoster: () => void;
  onNavigateToHistory: () => void;
  onDismiss: () => void;
}

const MAX_TEAM_CHIPS = 3;

const formatHandoffDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso.slice(0, 10) || null;
  }
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const ArchitectPostActionHandoff = ({
  receipt,
  onNavigateToCapSheet,
  onNavigateToRoster,
  onNavigateToHistory,
  onDismiss,
}: Props) => {
  if (!receipt) {
    return null;
  }

  const visibleTeams = receipt.changedTeamCodes.slice(0, MAX_TEAM_CHIPS);
  const overflow = Math.max(
    0,
    receipt.changedTeamCodes.length - visibleTeams.length
  );
  const formattedDate = formatHandoffDate(receipt.occurredAt);

  return (
    <div
      className="mb-4 rounded-md border border-green-400/30 bg-green-500/[0.07] px-3 py-2 text-xs text-white/80"
      data-testid="architect-post-action-handoff"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded border border-green-400/40 bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-200"
          data-testid="post-action-handoff-status-chip"
        >
          {receipt.persistence?.label ?? 'Committed world'}
        </span>
        <span
          className="font-semibold text-white/90"
          data-testid="post-action-handoff-headline"
        >
          {receipt.headline}
        </span>

        {visibleTeams.length > 0 && (
          <span
            className="flex flex-wrap items-center gap-1"
            data-testid="post-action-handoff-team-chips"
          >
            {visibleTeams.map((teamCode) => (
              <span
                key={teamCode}
                className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/70"
                data-testid={`post-action-handoff-team-chip-${teamCode}`}
              >
                {teamCode}
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/50"
                data-testid="post-action-handoff-team-chips-overflow"
              >
                +{overflow}
              </span>
            )}
          </span>
        )}

        {formattedDate && (
          <span className="text-white/40" data-testid="post-action-handoff-date">
            {formattedDate}
          </span>
        )}

        <span className="min-w-0 flex-1" />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNavigateToCapSheet}
            className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10 hover:text-white/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="post-action-handoff-nav-cap"
          >
            View Cap Sheet
          </button>
          <button
            type="button"
            onClick={onNavigateToRoster}
            className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10 hover:text-white/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="post-action-handoff-nav-roster"
          >
            View Roster
          </button>
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10 hover:text-white/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="post-action-handoff-nav-history"
          >
            View History
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/40 hover:bg-white/10 hover:text-white/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="post-action-handoff-dismiss"
            aria-label="Dismiss post-action handoff"
          >
            ×
          </button>
        </div>
      </div>
      {receipt.message ? (
        <p
          className="mt-1 text-[11px] leading-4 text-white/60"
          data-testid="post-action-handoff-message"
        >
          {receipt.message}
        </p>
      ) : null}
    </div>
  );
};
