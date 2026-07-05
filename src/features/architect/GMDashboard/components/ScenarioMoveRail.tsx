/**
 * FILE: src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx
 * PURPOSE: Read-only Stage 1D persistent activity rail for GMDashboard.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Shows recent committed world events for the active team and world.
 * In sandbox/no-world mode, shows a conservative placeholder.
 * Local and pending activity are explicitly deferred.
 * No mutation authority.
 */
import { useScenarioActivityRail } from '../hooks/useScenarioActivityRail';

interface ScenarioMoveRailProps {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  onOpenHistory: () => void;
  onOpenHistoryEntry?: (eventId: string) => void;
  /**
   * Stage 2B refresh seam. Increment to trigger a re-read of committed
   * world events after a successful committed mutation. Sandbox/no-world
   * mode is a no-op.
   */
  refreshKey?: number;
  /**
   * Stage 2B handoff highlight. When this matches the `id` of a rail
   * entry, that entry renders as "just committed". Skipped when null.
   */
  highlightEventId?: string | null;
}

const formatRailDate = (iso: string): string => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso.slice(0, 10) || '—';
  }
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const ScenarioMoveRail = ({
  worldId,
  teamCode,
  onOpenHistory,
  onOpenHistoryEntry,
  refreshKey = 0,
  highlightEventId = null,
}: ScenarioMoveRailProps) => {
  const { railState, localPendingDeferred } = useScenarioActivityRail({
    worldId,
    teamCode,
    refreshKey,
  });

  return (
    <div
      className="mb-4 rounded-md border border-white/10 bg-white/[0.015] px-3 py-2 text-xs"
      data-testid="scenario-move-rail"
      aria-label="Recent committed activity"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/40 font-medium">Recent Activity</span>
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-white/25 hover:text-white/50 text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded px-1"
          data-testid="scenario-move-rail-open-history"
        >
          View full history →
        </button>
      </div>

      {railState.status === 'sandbox' && (
        <p
          className="text-white/25 italic"
          data-testid="scenario-move-rail-sandbox"
        >
          Activity rail uses committed world events. Select a world to see
          scenario activity.
        </p>
      )}

      {railState.status === 'loading' && (
        <p
          className="text-white/25 italic"
          data-testid="scenario-move-rail-loading"
        >
          Loading recent activity…
        </p>
      )}

      {railState.status === 'error' && (
        <p
          className="text-rose-300/70"
          title={railState.message}
          data-testid="scenario-move-rail-error"
        >
          Unable to load recent activity.
        </p>
      )}

      {railState.status === 'empty' && (
        <p
          className="text-white/25 italic"
          data-testid="scenario-move-rail-empty"
        >
          No committed activity for this team in the active world.
        </p>
      )}

      {railState.status === 'available' && (
        <>
          <ul
            className="space-y-1.5"
            data-testid="scenario-move-rail-entries"
          >
            {railState.entries.map((entry) => {
              const isJustCommitted = Boolean(
                highlightEventId && entry.id === highlightEventId
              );
              const entryClassName = isJustCommitted
                ? 'flex items-baseline gap-2 text-white/80 rounded bg-green-500/[0.06] -mx-1 px-1'
                : 'flex items-baseline gap-2 text-white/50';
              return (
                <li
                  key={entry.id}
                  data-testid={
                    isJustCommitted
                      ? 'scenario-move-rail-entry-just-committed'
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onOpenHistoryEntry?.(entry.id)}
                    className={`${entryClassName} w-full text-left hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30`}
                    data-testid="scenario-move-rail-entry-button"
                  >
                    <span className="shrink-0 rounded border border-green-500/20 bg-green-500/10 px-1 text-green-400/60 text-[10px] leading-4">
                      {isJustCommitted ? 'Just now' : 'World'}
                    </span>
                    <span className="shrink-0">{entry.typeLabel}</span>
                    <span
                      className={
                        isJustCommitted
                          ? 'text-white/70 min-w-0 truncate'
                          : 'text-white/35 min-w-0 truncate'
                      }
                    >
                      {entry.summary}
                    </span>
                    {entry.occurredAt && (
                      <span className="shrink-0 ml-auto pl-2 text-white/25">
                        {formatRailDate(entry.occurredAt)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {localPendingDeferred && (
            <p className="mt-1.5 text-white/30 text-[10px]">
              Local and pending activity not shown.
            </p>
          )}
        </>
      )}
    </div>
  );
};
