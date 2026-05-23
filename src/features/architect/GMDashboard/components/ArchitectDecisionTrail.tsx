import { ArrowRight, X } from 'lucide-react';
import { useScenarioActivityRail } from '../hooks/useScenarioActivityRail';
import type { ArchitectPostActionReceipt } from '../postActionHandoff/types';

interface ArchitectDecisionTrailProps {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  receipt: ArchitectPostActionReceipt | null;
  refreshKey: number;
  onOpenCapOffice: () => void;
  onOpenRosterRoom: () => void;
  onOpenLeagueLog: () => void;
  onOpenHistoryEntry: (eventId: string) => void;
  onDismissReceipt: () => void;
}

const formatDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso.slice(0, 10) || null;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const ArchitectDecisionTrail = ({
  worldId,
  teamCode,
  receipt,
  refreshKey,
  onOpenCapOffice,
  onOpenRosterRoom,
  onOpenLeagueLog,
  onOpenHistoryEntry,
  onDismissReceipt,
}: ArchitectDecisionTrailProps) => {
  const { railState, localPendingDeferred } = useScenarioActivityRail({
    worldId,
    teamCode,
    refreshKey,
  });

  return (
    <section className="border border-white/10 bg-[#0b0f15]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Decision Trail
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Recent Activity
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenLeagueLog}
          className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
        >
          League Log
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        {receipt && (
          <div className="border border-emerald-300/25 bg-emerald-400/10 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/70">
                  Just committed
                </p>
                <p className="mt-1 font-semibold text-white">{receipt.headline}</p>
                <p className="mt-1 text-xs text-white/45">
                  {receipt.changedTeamCodes.length
                    ? receipt.changedTeamCodes.join(', ')
                    : 'Committed world action'}
                  {formatDate(receipt.occurredAt)
                    ? ` - ${formatDate(receipt.occurredAt)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismissReceipt}
                className="shrink-0 border border-white/10 p-1 text-white/45 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss latest committed action"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenCapOffice}
                className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
              >
                Cap Office
              </button>
              <button
                type="button"
                onClick={onOpenRosterRoom}
                className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
              >
                Roster Room
              </button>
              <button
                type="button"
                onClick={() => {
                  if (receipt.eventId) {
                    onOpenHistoryEntry(receipt.eventId);
                    return;
                  }
                  onOpenLeagueLog();
                }}
                className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
              >
                League Log
              </button>
            </div>
          </div>
        )}

        {railState.status === 'sandbox' && (
          <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/40">
            Select a committed world to see scenario activity.
          </p>
        )}
        {railState.status === 'loading' && (
          <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/40">
            Loading committed activity...
          </p>
        )}
        {railState.status === 'error' && (
          <p className="border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
            Unable to load recent activity.
          </p>
        )}
        {railState.status === 'empty' && (
          <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/40">
            No committed activity for this team in the active world.
          </p>
        )}
        {railState.status === 'available' && (
          <div className="space-y-2">
            {railState.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenHistoryEntry(entry.id)}
                className="grid w-full grid-cols-[72px_minmax(0,1fr)_auto] gap-3 border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-white/65 hover:bg-white/[0.06] hover:text-white"
              >
                <span className="text-xs text-emerald-200/65">
                  {entry.typeLabel}
                </span>
                <span className="min-w-0 truncate">{entry.summary}</span>
                <span className="text-xs text-white/35">
                  {formatDate(entry.occurredAt) ?? 'World'}
                </span>
              </button>
            ))}
            {localPendingDeferred && (
              <p className="text-xs text-white/30">
                Local and pending activity are not shown here.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
