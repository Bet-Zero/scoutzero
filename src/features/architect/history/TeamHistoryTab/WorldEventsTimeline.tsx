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
      <p data-testid="team-history-world-events-loading">
        Loading history events...
      </p>
    );
  }

  if (error && timelineRows.length === 0) {
    return (
      <p
        data-testid="team-history-world-events-error"
        className="text-rose-300"
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

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead>
            <tr>
              <th className="p-2 text-left">Timestamp</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Summary</th>
            </tr>
          </thead>
          <tbody>
            {timelineRows.map((entry, idx) => (
              <tr
                key={entry.id || idx}
                data-testid={`team-history-event-row-${idx}`}
                className="odd:bg-[#171717] cursor-pointer hover:bg-white/5"
                onClick={() => onSelectEntry(entry)}
              >
                <td className="p-2">
                  {entry.occurredAt || entry.timestamp || '—'}
                </td>
                <td className="p-2">{entry.category || '—'}</td>
                <td className="p-2">{entry.type || '—'}</td>
                <td className="p-2">
                  <div
                    data-testid="team-history-event-summary"
                    className="font-medium"
                  >
                    <span data-testid={`team-history-row-${idx}`}>
                      {entry.summary || '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/60">
                    <span>{entry.occurredAt || entry.timestamp || '—'}</span>
                    <span className="mx-1">•</span>
                    <span>
                      {entry.mutationType || entry.type || 'world-event'}
                    </span>
                    {Array.isArray(entry.teamCodes) &&
                      entry.teamCodes.length > 0 && (
                        <>
                          <span className="mx-1">•</span>
                          <span>{entry.teamCodes.join(' · ')}</span>
                        </>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
