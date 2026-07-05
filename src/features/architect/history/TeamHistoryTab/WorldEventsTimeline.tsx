import React, { useEffect, useMemo, useRef } from 'react';
import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';
import {
  normalizeWorldEventsForTeamHistory,
  type TeamHistoryWorldEventRow,
} from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import type { RequestedHistoryEventDetail } from './types';

type WorldEventsTimelineProps = {
  worldId: string;
  teamCode: string | null;
  onSelectEntry: (entry: TeamHistoryWorldEventRow) => void;
  requestedHistoryEventDetail?: RequestedHistoryEventDetail | null;
  onRequestedHistoryEventDetailHandled?: ((requestKey: number) => void) | null;
};

const formatHistoryTimestamp = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(parsed));
};

const getEntryTeams = (entry: TeamHistoryWorldEventRow) => {
  const teams = Array.isArray(entry.teamCodes) ? entry.teamCodes : [];
  return teams.length > 0 ? teams.join(' · ') : 'Team plan';
};

export const WorldEventsTimeline = ({
  worldId,
  teamCode,
  onSelectEntry,
  requestedHistoryEventDetail = null,
  onRequestedHistoryEventDetailHandled = null,
}: WorldEventsTimelineProps) => {
  const handledRequestKeyRef = useRef<number | null>(null);
  const {
    events,
    loading,
    loadingMore,
    error,
    hasMore,
    resolution,
    loadMore,
  } = useWorldTeamEvents({
    worldId,
    teamCode,
    limit: 50,
    enabled: Boolean(worldId && teamCode),
  });

  const timelineRows = useMemo(
    () => normalizeWorldEventsForTeamHistory(events, teamCode),
    [events, teamCode]
  );

  useEffect(() => {
    if (!requestedHistoryEventDetail) {
      return;
    }
    if (
      handledRequestKeyRef.current === requestedHistoryEventDetail.requestKey
    ) {
      return;
    }
    if (
      requestedHistoryEventDetail.worldId !== worldId ||
      requestedHistoryEventDetail.teamCode !== teamCode
    ) {
      return;
    }
    if (loading) {
      return;
    }

    const requestedId = requestedHistoryEventDetail.requestedSelectedEntryId;
    const matchedEntry = timelineRows.find(
      (entry) => entry.eventId === requestedId || entry.id === requestedId
    );

    handledRequestKeyRef.current = requestedHistoryEventDetail.requestKey;
    if (matchedEntry) {
      onSelectEntry(matchedEntry);
    }
    onRequestedHistoryEventDetailHandled?.(
      requestedHistoryEventDetail.requestKey
    );
  }, [
    requestedHistoryEventDetail,
    worldId,
    teamCode,
    loading,
    timelineRows,
    onSelectEntry,
    onRequestedHistoryEventDetailHandled,
  ]);

  if (loading && timelineRows.length === 0) {
    return (
      <p
        data-testid="team-history-world-events-loading"
        className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60"
      >
        Loading history events...
      </p>
    );
  }

  if (error && timelineRows.length === 0) {
    return (
      <p
        data-testid="team-history-world-events-error"
        className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"
      >
        Unable to load world history events. {error}
      </p>
    );
  }

  if (timelineRows.length === 0) {
    return (
      <p data-testid="team-history-world-events-empty">
        No history events matched this team in the supported world-event feed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {(resolution === 'legacy-compatible' ||
        resolution === 'mixed-compatible') && (
        <p
          data-testid="team-history-world-events-compatibility-note"
          className="text-[11px] text-white/55"
        >
          {resolution === 'mixed-compatible'
            ? 'Showing a merged Team History feed with canonical and compatible legacy records for this team.'
            : 'Showing compatible legacy history records for this team.'}
        </p>
      )}

      {error && (
        <p
          data-testid="team-history-world-events-inline-error"
          className="text-xs text-rose-300"
        >
          Unable to load more world history events. {error}
        </p>
      )}

      <div className="space-y-2">
        {timelineRows.map((entry, idx) => {
          const rawTimestamp = entry.occurredAt || entry.timestamp || '';
          return (
            <button
              key={entry.id || idx}
              type="button"
              data-testid={`team-history-event-row-${idx}`}
              onClick={() => onSelectEntry(entry)}
              className="group w-full rounded-lg border border-white/10 bg-[#10141B] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div
                  data-testid="team-history-event-summary"
                  className="min-w-0"
                >
                  <span
                    data-testid={`team-history-row-${idx}`}
                    className="block truncate text-sm font-bold text-white"
                  >
                    {entry.summary || 'History entry'}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/45">
                    {formatHistoryTimestamp(rawTimestamp)}
                    {rawTimestamp ? (
                      <span className="sr-only"> {rawTimestamp}</span>
                    ) : null}
                  </span>
                </div>
                <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
                  {entry.category || 'Move'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/55">
                <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5">
                  {entry.mutationType || entry.type || 'Team plan move'}
                </span>
                <span>{getEntryTeams(entry)}</span>
              </div>
              {entry.primaryDeltas && entry.primaryDeltas !== entry.summary ? (
                <p className="mt-2 line-clamp-2 text-[12px] text-white/65">
                  {entry.primaryDeltas}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      {hasMore && typeof loadMore === 'function' && (
        <button
          type="button"
          data-testid="team-history-world-events-load-more"
          onClick={() => loadMore()}
          disabled={loadingMore}
          className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          {loadingMore ? 'Loading more...' : 'Load more'}
        </button>
      )}
    </div>
  );
};
