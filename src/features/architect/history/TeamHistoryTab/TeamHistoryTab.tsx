import React, { useMemo, useState } from 'react';
import WaiveStretchTracker from '@/features/architect/offseason/WaiveStretchTracker';
import ExceptionHistoryTracker from '@/features/architect/capSheet/ExceptionHistoryTracker';
import DraftPickTracker from '@/features/architect/offseason/DraftPickTracker';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';
import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';
import {
  normalizeWorldEventsForTeamHistory,
  type TeamHistoryWorldEventRow,
} from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import HistoryDetailModal from './HistoryDetailModal';
import type {
  TeamHistoryCapSheetLike,
  TeamHistoryDisplayEntry,
  TeamHistoryLooseTimelineEntry,
  TeamHistoryTabProps,
} from './types';

type WorldEventsTimelineProps = {
  worldId: string;
  teamCode: string | null;
  onSelectEntry: (entry: TeamHistoryWorldEventRow) => void;
};

const normalizeTimelineFromSections = (
  teamCapSheet: TeamHistoryCapSheetLike = {}
): TeamHistoryLooseTimelineEntry[] => {
  const timeline: TeamHistoryLooseTimelineEntry[] = [];

  const waivedContracts = Array.isArray(teamCapSheet.waivedContracts)
    ? teamCapSheet.waivedContracts
    : [];
  waivedContracts.forEach((entry, idx) => {
    timeline.push({
      id: entry?.id || `waive-${idx}`,
      category: 'cap-transaction',
      type: entry?.stretched ? 'Waive & Stretch' : 'Waive',
      timestamp: entry?.waivedOn || null,
      teamsInvolved: [teamCapSheet.teamCode || 'TEAM'],
      primaryDeltas: 'Dead cap schedule updated',
      capDelta: null,
      summary: `${entry?.name || 'Player'} was waived${entry?.stretched ? ' and stretched' : ''}.`,
    });
  });

  const exceptionHistory = Array.isArray(teamCapSheet.exceptionHistory)
    ? teamCapSheet.exceptionHistory
    : [];
  exceptionHistory.forEach((entry, idx) => {
    timeline.push({
      id: entry?.id || `exception-${idx}`,
      category: 'entitlements',
      type: entry?.type || entry?.action || 'Exception Activity',
      timestamp: entry?.timestamp || entry?.date || null,
      teamsInvolved: [
        entry?.sourceTeamCode || teamCapSheet.teamCode || 'TEAM',
        entry?.targetTeamCode,
      ].filter((value): value is string => typeof value === 'string' && value.length > 0),
      primaryDeltas:
        entry?.primaryDeltas ||
        `Remaining ${entry?.amountRemaining ? `$${Number(entry.amountRemaining).toLocaleString()}` : '—'}`,
      capDelta: null,
      summary:
        entry?.summary ||
        `Exception activity for ${entry?.sourcePlayerName || 'asset'} recorded.`,
    });
  });

  const pickLog = Array.isArray(teamCapSheet.pickLog)
    ? teamCapSheet.pickLog
    : [];
  pickLog.forEach((entry, idx) => {
    timeline.push({
      id: entry?.id || `pick-${idx}`,
      category: 'draft',
      type: entry?.action || 'Pick Activity',
      timestamp: entry?.timestamp || entry?.date || null,
      teamsInvolved: [teamCapSheet.teamCode || 'TEAM', entry?.partner].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      ),
      primaryDeltas: entry?.pick || 'Draft asset updated',
      capDelta: null,
      summary: entry?.notes || 'Draft pick log entry.',
    });
  });

  return timeline;
};

const sortTimelineNewestFirst = (
  entries: TeamHistoryLooseTimelineEntry[] = []
): TeamHistoryLooseTimelineEntry[] => {
  return [...entries].sort((a, b) => {
    const aTs = Date.parse(String(a?.timestamp || a?.occurredAt || 0));
    const bTs = Date.parse(String(b?.timestamp || b?.occurredAt || 0));
    return bTs - aTs;
  });
};

const WorldEventsTimeline = ({
  worldId,
  teamCode,
  onSelectEntry,
}: WorldEventsTimelineProps) => {
  const { events, loading, error, hasMore, loadMore } = useWorldTeamEvents({
    worldId,
    teamCode,
    limit: 50,
    enabled: Boolean(worldId && teamCode),
  });

  const timelineRows = useMemo(
    () => normalizeWorldEventsForTeamHistory(events, teamCode),
    [events, teamCode]
  );

  if (loading && timelineRows.length === 0) {
    return (
      <p data-testid="team-history-world-events-loading">
        Loading history events...
      </p>
    );
  }

  if (error) {
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
        No history events yet for this world/team.
      </p>
    );
  }

  return (
    <div className="space-y-3">
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
          className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          Load more
        </button>
      )}
    </div>
  );
};

const TeamHistoryTab = ({
  teamCapSheet,
  worldId,
  onInjectTeamHistoryFixtures = null,
  onClearTeamHistoryFixtures = null,
  hasInjectedTeamHistoryFixtures = false,
}: TeamHistoryTabProps) => {
  const [selectedEntry, setSelectedEntry] =
    useState<TeamHistoryDisplayEntry | null>(null);

  const showDevFixturePanel =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_TEAM_HISTORY_FIXTURE_FLAG) === 'true';

  const shouldUseWorldEventTimeline =
    Boolean(worldId) && !hasInjectedTeamHistoryFixtures;

  const sortedTimeline = useMemo(() => {
    const explicitTimeline = Array.isArray(teamCapSheet?.historyTimeline)
      ? teamCapSheet.historyTimeline
      : [];
    const source =
      explicitTimeline.length > 0
        ? explicitTimeline
        : normalizeTimelineFromSections(teamCapSheet);
    return sortTimelineNewestFirst(source);
  }, [teamCapSheet]);

  const worldScopeLabel = worldId ? `World mode: ${worldId}` : 'Base mode';

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Team Transaction History</h2>

      <div
        data-testid={
          worldId ? 'team-history-world-banner' : 'team-history-base-banner'
        }
        className="mb-4 rounded border border-white/10 bg-[#121212] px-3 py-2 text-xs text-white/70"
      >
        Scope: {worldScopeLabel}
      </div>

      {showDevFixturePanel && (
        <section
          data-testid="team-history-fixtures-panel"
          className="mb-6 rounded border border-emerald-500/30 bg-[#08120c] p-3 text-xs text-emerald-100/80 space-y-3"
        >
          <div className="font-semibold text-emerald-200">
            Team History Fixtures (DEV)
          </div>
          <div className="text-emerald-200/70">
            Injects deterministic in-memory history entries only (no Firestore
            writes).
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="team-history-inject-fixtures-button"
              onClick={() => onInjectTeamHistoryFixtures?.()}
              className="rounded bg-emerald-700/70 hover:bg-emerald-600/70 px-3 py-1.5 text-xs font-medium text-emerald-100"
            >
              Inject Team History Fixtures
            </button>
            <button
              type="button"
              data-testid="team-history-clear-fixtures-button"
              onClick={() => onClearTeamHistoryFixtures?.()}
              disabled={!hasInjectedTeamHistoryFixtures}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                hasInjectedTeamHistoryFixtures
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-white'
                  : 'bg-neutral-800 text-white/40 cursor-not-allowed'
              }`}
            >
              Clear Injected Fixtures
            </button>
          </div>
        </section>
      )}

      <section data-testid="team-history-section-timeline" className="mb-10">
        <h3 className="text-lg font-semibold mb-2">Recent History Timeline</h3>
        {shouldUseWorldEventTimeline ? (
            <WorldEventsTimeline
            worldId={worldId || ''}
            teamCode={teamCapSheet?.teamCode || null}
            onSelectEntry={(entry) => setSelectedEntry(entry)}
          />
        ) : sortedTimeline.length === 0 ? (
          <p>No timeline entries yet.</p>
        ) : (
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
                {sortedTimeline.map((entry, idx) => (
                  <tr
                    key={entry.id || idx}
                    data-testid={`team-history-event-row-${idx}`}
                    className="odd:bg-[#171717] cursor-pointer hover:bg-white/5"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <td className="p-2">
                      {entry.timestamp || entry.occurredAt || '—'}
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
                        <span>
                          {entry.timestamp || entry.occurredAt || '—'}
                        </span>
                        {entry.type && (
                          <>
                            <span className="mx-1">•</span>
                            <span>{entry.type}</span>
                          </>
                        )}
                        {Array.isArray(entry.teamsInvolved) &&
                          entry.teamsInvolved.length > 0 && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{entry.teamsInvolved.join(' · ')}</span>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section data-testid="team-history-section-waive" className="mb-10">
        <WaiveStretchTracker
          waivedContracts={teamCapSheet.waivedContracts || []}
        />
      </section>

      <section data-testid="team-history-section-exceptions" className="mb-10">
        <ExceptionHistoryTracker
          exceptionHistory={teamCapSheet.exceptionHistory || []}
          mleHistory={teamCapSheet.mleHistory || []}
        />
      </section>

      <section data-testid="team-history-section-draft">
        <DraftPickTracker
          pickLog={teamCapSheet.pickLog || []}
          currentPicks={teamCapSheet.currentPicks || {}}
        />
      </section>

      <HistoryDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
};

export default TeamHistoryTab;
