import React, { useMemo, useState } from 'react';
import WaiveStretchTracker from '@/features/architect/offseason/WaiveStretchTracker';
import ExceptionHistoryTracker from '@/features/architect/capSheet/ExceptionHistoryTracker';
import DraftPickTracker from '@/features/architect/offseason/DraftPickTracker';
import {
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
  hasInjectedTeamHistoryFixtures as teamHasInjectedHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
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

type TeamHistoryTimelineSourceKey =
  | 'world-events'
  | 'dev-fixtures'
  | 'local-timeline'
  | 'synthesized';

type TeamHistoryTimelineResolution = {
  key: TeamHistoryTimelineSourceKey;
  scopeLabel: string;
  sourceLabel: string;
  sourceDetail: string;
  sourceAccentClassName: string;
  usesWorldEvents: boolean;
  timelineEntries: TeamHistoryLooseTimelineEntry[];
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

const resolveTeamHistoryTimeline = ({
  teamCapSheet,
  worldId,
  hasInjectedFixtures,
}: {
  teamCapSheet: TeamHistoryCapSheetLike;
  worldId?: string | null;
  hasInjectedFixtures: boolean;
}): TeamHistoryTimelineResolution => {
  const scopeLabel = worldId ? `World ${worldId}` : 'Base context';
  const explicitTimeline = sortTimelineNewestFirst(
    Array.isArray(teamCapSheet?.historyTimeline)
      ? teamCapSheet.historyTimeline
      : []
  );
  const synthesizedTimeline = sortTimelineNewestFirst(
    normalizeTimelineFromSections(teamCapSheet)
  );

  // Contract ownership order:
  // 1. DEV fixtures explicitly override the world path while active.
  // 2. Otherwise, a world-backed tab is owned by authoritative world events.
  // 3. Outside world-event mode, explicit local timeline rows win.
  // 4. Section-derived synthesis is the final fallback.
  if (hasInjectedFixtures) {
    return {
      key: 'dev-fixtures',
      scopeLabel,
      sourceLabel: 'DEV fixture override',
      sourceDetail:
        'Injected DEV fixtures take ownership of the timeline and suppress world events while active.',
      sourceAccentClassName: 'text-emerald-200',
      usesWorldEvents: false,
      timelineEntries:
        explicitTimeline.length > 0 ? explicitTimeline : synthesizedTimeline,
    };
  }

  if (worldId) {
    return {
      key: 'world-events',
      scopeLabel,
      sourceLabel: 'Authoritative world events',
      sourceDetail:
        'World events own the timeline whenever a world is active and no fixture override is present.',
      sourceAccentClassName: 'text-sky-200',
      usesWorldEvents: true,
      timelineEntries: [],
    };
  }

  if (explicitTimeline.length > 0) {
    return {
      key: 'local-timeline',
      scopeLabel,
      sourceLabel: 'Explicit local timeline',
      sourceDetail:
        'Outside world-event mode, explicit historyTimeline rows take priority over synthesized fallback.',
      sourceAccentClassName: 'text-amber-200',
      usesWorldEvents: false,
      timelineEntries: explicitTimeline,
    };
  }

  return {
    key: 'synthesized',
    scopeLabel,
    sourceLabel: 'Section-derived fallback',
    sourceDetail:
      'This fallback is used only when world events are inactive and no explicit historyTimeline rows are present.',
    sourceAccentClassName: 'text-white',
    usesWorldEvents: false,
    timelineEntries: synthesizedTimeline,
  };
};

const WorldEventsTimeline = ({
  worldId,
  teamCode,
  onSelectEntry,
}: WorldEventsTimelineProps) => {
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
      {resolution === 'legacy-compatible' && (
        <p
          data-testid="team-history-world-events-compatibility-note"
          className="text-[11px] text-white/55"
        >
          Showing compatible legacy history records for this team.
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

  const hasActiveFixtureOverride = useMemo(
    () =>
      hasInjectedTeamHistoryFixtures ||
      teamHasInjectedHistoryFixtures(teamCapSheet ?? null),
    [hasInjectedTeamHistoryFixtures, teamCapSheet]
  );

  const timelineResolution = useMemo(
    () =>
      resolveTeamHistoryTimeline({
        teamCapSheet,
        worldId,
        hasInjectedFixtures: hasActiveFixtureOverride,
      }),
    [hasActiveFixtureOverride, teamCapSheet, worldId]
  );

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Team Transaction History</h2>

      <div
        data-testid={
          worldId ? 'team-history-world-banner' : 'team-history-base-banner'
        }
        className="mb-4 rounded border border-white/10 bg-[#121212] px-3 py-2 text-xs text-white/70"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span data-testid="team-history-scope-label">
            Scope: {timelineResolution.scopeLabel}
          </span>
          <span data-testid="team-history-active-source-label">
            Active timeline:{' '}
            <span
              className={`font-semibold ${timelineResolution.sourceAccentClassName}`}
            >
              {timelineResolution.sourceLabel}
            </span>
          </span>
        </div>
        <div
          data-testid="team-history-active-source-detail"
          className="mt-1 text-[11px] text-white/55"
        >
          {timelineResolution.sourceDetail}
        </div>
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
              disabled={!hasActiveFixtureOverride}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                hasActiveFixtureOverride
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
        {timelineResolution.usesWorldEvents ? (
          <WorldEventsTimeline
            worldId={worldId || ''}
            teamCode={teamCapSheet?.teamCode || null}
            onSelectEntry={(entry) => setSelectedEntry(entry)}
          />
        ) : timelineResolution.timelineEntries.length === 0 ? (
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
                {timelineResolution.timelineEntries.map((entry, idx) => (
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
