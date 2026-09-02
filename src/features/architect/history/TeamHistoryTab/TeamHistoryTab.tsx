import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { WaiveStretchTracker } from '@/features/architect/offseason/WaiveStretchTracker';
import { ExceptionHistoryTracker } from '@/features/architect/capSheet/ExceptionHistoryTracker';
import { DraftPickTracker } from '@/features/architect/offseason/DraftPickTracker';
import {
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
  hasInjectedTeamHistoryFixtures as teamHasInjectedHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
import { HistoryDetailModal } from './HistoryDetailModal';
import type {
  TeamHistoryCapSheetLike,
  TeamHistoryLooseTimelineEntry,
  TeamHistorySelectedEntry,
  TeamHistoryTabProps,
} from './types';
import {
  resolveTeamHistoryTimeline,
  buildSelectedHistoryEntry,
  resolveWaivedContractDisplayEntries,
} from './TeamHistoryTab.helpers';
import {
  createSharedWorldEventsStore,
  type SharedWorldEventsStore,
} from './worldEventsShare';
import { WorldEventsTimeline } from './WorldEventsTimeline';
import { TeamListFull } from '@/constants/teamList';

const TEAM_NAME_LOOKUP = Object.fromEntries(
  TeamListFull.map((team) => [team.code, team.teamName])
);

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

const getEntryTeams = (entry: TeamHistoryLooseTimelineEntry) => {
  const teams = Array.isArray(entry.teamsInvolved)
    ? entry.teamsInvolved
    : Array.isArray(entry.teamCodes)
      ? entry.teamCodes
      : [];
  return teams.length > 0
    ? teams.map((team) => TEAM_NAME_LOOKUP[team] || team).join(' · ')
    : 'Team plan';
};

const TimelineEntryCards = ({
  entries,
  onSelectEntry,
}: {
  entries: TeamHistoryLooseTimelineEntry[];
  onSelectEntry: (entry: TeamHistoryLooseTimelineEntry) => void;
}) => (
  <div className="space-y-2">
    {entries.map((entry, idx) => {
      const rawTimestamp = entry.timestamp || entry.occurredAt || '';
      return (
        <button
          key={entry.id || idx}
          type="button"
          data-testid={`team-history-event-row-${idx}`}
          onClick={() => onSelectEntry(entry)}
          className="group w-full rounded-lg border border-cockpit-edge bg-cockpit-slab p-3 text-left shadow-cockpit-slab transition-colors hover:border-cockpit-text-muted hover:bg-cockpit-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div data-testid="team-history-event-summary" className="min-w-0">
              <span
                data-testid={`team-history-row-${idx}`}
                className="block truncate text-sm font-bold text-cockpit-text-primary"
              >
                {entry.summary || 'History entry'}
              </span>
              <span className="mt-1 block text-[11px] text-cockpit-text-muted">
                {formatHistoryTimestamp(rawTimestamp)}
                {rawTimestamp ? (
                  <span className="sr-only"> {rawTimestamp}</span>
                ) : null}
              </span>
            </div>
            <span className="rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cockpit-text-muted">
              {entry.category || 'Move'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-cockpit-text-muted">
            <span className="rounded-md border border-cockpit-edge bg-cockpit-raised px-2 py-0.5">
              {entry.type || 'Team move'}
            </span>
            <span>{getEntryTeams(entry)}</span>
          </div>
          {entry.primaryDeltas && entry.primaryDeltas !== entry.summary ? (
            <p className="mt-2 line-clamp-2 text-xs text-cockpit-text-secondary">
              {entry.primaryDeltas}
            </p>
          ) : null}
        </button>
      );
    })}
  </div>
);

/**
 * World-mode waived-contracts panel: subscribes to the shared world-events
 * store fed by WorldEventsTimeline so committed waives (including zero-dead-
 * money ones) always appear, without a second world-events query (BZE-218).
 */
const WorldReconciledWaivePanel = ({
  teamCapSheet,
  store,
}: {
  teamCapSheet: TeamHistoryCapSheetLike;
  store: SharedWorldEventsStore;
}) => {
  const committedWorldEvents = useSyncExternalStore(
    store.subscribe,
    store.get,
    store.get
  );
  const entries = useMemo(
    () =>
      resolveWaivedContractDisplayEntries(teamCapSheet, committedWorldEvents),
    [teamCapSheet, committedWorldEvents]
  );
  return <WaiveStretchTracker waivedContracts={entries} />;
};

export const TeamHistoryTab = ({
  teamCapSheet,
  worldId,
  resolvePlayerTeamCode = null,
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

  // Committed world events back-fill zero-dead-money waives (two-way /
  // non-guaranteed deals) into the side panel, so it can never contradict
  // the world-events timeline (BZE-218). The events flow from the
  // WorldEventsTimeline's single query through this store — this component
  // never issues a world-events query of its own (base-mode guardrail), and
  // only the panel re-renders when events arrive.
  const worldEventsStoreRef = useRef<SharedWorldEventsStore | null>(null);
  if (!worldEventsStoreRef.current) {
    worldEventsStoreRef.current = createSharedWorldEventsStore();
  }
  const worldEventsStore = worldEventsStoreRef.current;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2.5 text-cockpit-text-primary">
      {/* Single title strip: the room is named once here, then the timeline
          starts. Scope/source chips replace the old stacked banner headings
          (BZE-216 viewport-fit correction). */}
      <section
        data-testid={
          worldId ? 'team-history-world-banner' : 'team-history-base-banner'
        }
        data-history-world-id={worldId ?? ''}
        data-history-source-key={timelineResolution.key}
        className="relative shrink-0 overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-slab shadow-cockpit-slab"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 bg-[var(--team-primary,#4F46E5)]"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <h2 className="whitespace-nowrap text-sm font-extrabold uppercase tracking-wide text-cockpit-text-primary">
            Team Transaction History
          </h2>
          <p
            data-testid="team-history-active-source-detail"
            className="min-w-0 flex-1 truncate text-[11px] text-cockpit-text-muted"
            title={timelineResolution.sourceDetail}
          >
            {timelineResolution.sourceDetail}
          </p>
          <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
            <span
              data-testid="team-history-scope-label"
              className="rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-bold text-cockpit-text-secondary"
            >
              {timelineResolution.scopeLabel}
            </span>
            <span
              data-testid="team-history-active-source-label"
              className={`rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-bold ${timelineResolution.sourceAccentClassName}`}
            >
              {timelineResolution.sourceLabel}
            </span>
          </span>
        </div>
      </section>

      {showDevFixturePanel && (
        <section
          data-testid="team-history-fixtures-panel"
          className="mt-3 shrink-0 space-y-3 rounded-md border border-cockpit-safe/30 bg-cockpit-safe/5 p-3 text-xs text-cockpit-safe"
        >
          <div className="font-semibold text-cockpit-safe">
            Team History Fixtures (DEV)
          </div>
          <div className="text-cockpit-text-muted">
            Injects deterministic in-memory history entries only (no Firestore
            writes).
          </div>
          {hasActiveFixtureOverride && (
            <div
              data-testid="team-history-fixtures-active-note"
              className="rounded-md border border-cockpit-safe/25 bg-cockpit-safe/10 px-3 py-2 text-[11px] text-cockpit-safe"
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
              className="rounded-md bg-cockpit-safe/20 hover:bg-cockpit-safe/30 px-3 py-1.5 text-xs font-medium text-cockpit-safe"
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
                  ? 'bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-primary'
                  : 'bg-cockpit-slab text-cockpit-text-muted cursor-not-allowed'
              }`}
            >
              Clear Injected Fixtures
            </button>
          </div>
        </section>
      )}

      <div className="mt-2 grid min-h-0 flex-1 gap-2 overflow-hidden xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <section
          data-testid="team-history-section-timeline"
          className="flex min-h-0 flex-col rounded-lg border border-cockpit-edge bg-cockpit-void shadow-cockpit-slab"
        >
          <div className="shrink-0 border-b border-cockpit-edge px-3 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-cockpit-text-secondary">
                Saved Moves
              </h3>
              {!timelineResolution.usesWorldEvents ? (
                <span className="rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cockpit-text-secondary">
                  {timelineResolution.timelineEntries.length}{' '}
                  {timelineResolution.timelineEntries.length === 1
                    ? 'entry'
                    : 'entries'}
                </span>
              ) : null}
            </div>
            {timelineResolution.timelineTruthLabel &&
              timelineResolution.timelineTruthDetail &&
              timelineResolution.timelineEntries.length > 0 && (
                <div
                  data-testid="team-history-base-truth-note"
                  className={`mt-1.5 rounded border px-2.5 py-1 text-xs ${timelineResolution.timelineTruthClassName || 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-secondary'}`}
                >
                  <span
                    data-testid="team-history-base-truth-label"
                    className="font-semibold uppercase tracking-[0.08em]"
                  >
                    {timelineResolution.timelineTruthLabel}
                  </span>{' '}
                  <span
                    data-testid="team-history-base-truth-detail"
                    className="text-[11px]"
                  >
                    {timelineResolution.timelineTruthDetail}
                  </span>
                </div>
              )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2.5">
            {timelineResolution.usesWorldEvents ? (
              <WorldEventsTimeline
                worldId={worldId || ''}
                teamCode={teamCapSheet?.teamCode || null}
                resolvePlayerTeamCode={resolvePlayerTeamCode}
                resolvePlayerLabel={resolvePlayerLabel}
                onEventsLoaded={worldEventsStore.set}
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
              <p className="rounded-lg border border-cockpit-edge bg-cockpit-slab p-4 text-sm text-cockpit-text-secondary">
                No timeline entries yet.
              </p>
            ) : (
              <TimelineEntryCards
                entries={timelineResolution.timelineEntries}
                onSelectEntry={(entry) =>
                  setSelectedEntry(
                    buildSelectedHistoryEntry({
                      activeTeamCode: teamCapSheet?.teamCode || null,
                      entry,
                      timelineSourceKey: timelineResolution.key,
                    })
                  )
                }
              />
            )}
          </div>
        </section>

        <aside className="min-h-0 space-y-2 overflow-auto">
          <section
            data-testid="team-history-section-waive"
            className="rounded-lg border border-cockpit-edge bg-cockpit-slab p-3"
          >
            {timelineResolution.usesWorldEvents ? (
              <WorldReconciledWaivePanel
                teamCapSheet={teamCapSheet}
                store={worldEventsStore}
              />
            ) : (
              <WaiveStretchTracker
                waivedContracts={resolveWaivedContractDisplayEntries(
                  teamCapSheet
                )}
              />
            )}
          </section>

          <section
            data-testid="team-history-section-exceptions"
            className="rounded-lg border border-cockpit-edge bg-cockpit-slab p-3"
          >
            <ExceptionHistoryTracker
              exceptionHistory={teamCapSheet.exceptionHistory || []}
              mleHistory={teamCapSheet.mleHistory || []}
            />
          </section>

          <section
            data-testid="team-history-section-draft"
            className="rounded-lg border border-cockpit-edge bg-cockpit-slab p-3"
          >
            <DraftPickTracker
              pickLog={teamCapSheet.pickLog || []}
              currentPicks={teamCapSheet.currentPicks || {}}
            />
          </section>
        </aside>
      </div>

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
