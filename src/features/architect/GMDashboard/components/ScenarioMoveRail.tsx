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
}: ScenarioMoveRailProps) => {
  const { railState, localPendingDeferred } = useScenarioActivityRail({
    worldId,
    teamCode,
  });

  return (
    <div
      className="mb-4 rounded-md border border-white/10 bg-white/[0.015] px-3 py-2 text-xs"
      data-testid="scenario-move-rail"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/40 font-medium">Recent Activity</span>
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-white/25 hover:text-white/50 text-[11px] transition-colors"
          data-testid="scenario-move-rail-open-history"
        >
          Full History →
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
            {railState.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline gap-2 text-white/50"
              >
                <span className="shrink-0 rounded border border-green-500/20 bg-green-500/10 px-1 text-green-400/60 text-[10px] leading-4">
                  World
                </span>
                <span className="shrink-0">{entry.typeLabel}</span>
                <span className="text-white/35 min-w-0 truncate">
                  {entry.summary}
                </span>
                {entry.occurredAt && (
                  <span className="shrink-0 ml-auto pl-2 text-white/20">
                    {formatRailDate(entry.occurredAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {localPendingDeferred && (
            <p className="mt-1.5 text-white/20 text-[10px]">
              Local and pending activity not shown.
            </p>
          )}
        </>
      )}
    </div>
  );
};
