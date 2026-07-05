import React, { useMemo, useState } from 'react';
import { WaiveStretchTracker } from '@/features/architect/offseason/WaiveStretchTracker';
import { ExceptionHistoryTracker } from '@/features/architect/capSheet/ExceptionHistoryTracker';
import { DraftPickTracker } from '@/features/architect/offseason/DraftPickTracker';
import {
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
  hasInjectedTeamHistoryFixtures as teamHasInjectedHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
import { HistoryDetailModal } from './HistoryDetailModal';
import type {
  TeamHistorySelectedEntry,
  TeamHistoryTabProps,
  TeamHistoryTimelineSourceKey,
} from './types';
import {
  resolveTeamHistoryTimeline,
  buildSelectedHistoryEntry,
} from './TeamHistoryTab.helpers';
import { WorldEventsTimeline } from './WorldEventsTimeline';

export const TeamHistoryTab = ({
  teamCapSheet,
  worldId,
  requestedHistoryEventDetail = null,
  onRequestedHistoryEventDetailHandled = null,
  onInjectTeamHistoryFixtures = null,
  onClearTeamHistoryFixtures = null,
  hasInjectedTeamHistoryFixtures = false,
  onNavigateRoom,
  onOpenTradeWithRequest,
  onPlayerAction,
  resolvePlayerLabel,
}: TeamHistoryTabProps) => {
  const [selectedEntry, setSelectedEntry] =
    useState<TeamHistorySelectedEntry | null>(null);

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
        data-history-world-id={worldId ?? ''}
        data-history-source-key={timelineResolution.key}
        className="mb-4 rounded border border-white/10 bg-[#121212] px-3 py-2 text-xs text-white/70"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span data-testid="team-history-scope-label">
            {timelineResolution.scopeLabel}
          </span>
          <span data-testid="team-history-active-source-label">
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
          {hasActiveFixtureOverride && (
            <div
              data-testid="team-history-fixtures-active-note"
              className="rounded border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/85"
            >
              Synthetic Team History fixtures are active. Clear them before
              trusting world-event or local-history behavior.
            </div>
          )}
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
        {timelineResolution.timelineTruthLabel &&
          timelineResolution.timelineTruthDetail &&
          timelineResolution.timelineEntries.length > 0 && (
            <div
              data-testid="team-history-base-truth-note"
              className={`mb-3 rounded border px-3 py-2 text-xs ${timelineResolution.timelineTruthClassName || 'border-white/10 bg-white/[0.03] text-white/75'}`}
            >
              <div
                data-testid="team-history-base-truth-label"
                className="font-semibold uppercase tracking-[0.08em]"
              >
                {timelineResolution.timelineTruthLabel}
              </div>
              <div
                data-testid="team-history-base-truth-detail"
                className="mt-1 text-[11px]"
              >
                {timelineResolution.timelineTruthDetail}
              </div>
            </div>
          )}
        {timelineResolution.usesWorldEvents ? (
          <WorldEventsTimeline
            worldId={worldId || ''}
            teamCode={teamCapSheet?.teamCode || null}
            requestedHistoryEventDetail={requestedHistoryEventDetail}
            onRequestedHistoryEventDetailHandled={
              onRequestedHistoryEventDetailHandled
            }
            onSelectEntry={(entry) =>
              setSelectedEntry(
                buildSelectedHistoryEntry({
                  activeTeamCode: teamCapSheet?.teamCode || null,
                  entry,
                  timelineSourceKey: 'world-events',
                })
              )
            }
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
                    onClick={() =>
                      setSelectedEntry(
                        buildSelectedHistoryEntry({
                          activeTeamCode: teamCapSheet?.teamCode || null,
                          entry,
                          timelineSourceKey: timelineResolution.key,
                        })
                      )
                    }
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
        selectedEntry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onNavigateRoom={onNavigateRoom}
        onOpenTradeWithRequest={onOpenTradeWithRequest}
        onPlayerAction={onPlayerAction}
        resolvePlayerLabel={resolvePlayerLabel}
      />
    </div>
  );
};
