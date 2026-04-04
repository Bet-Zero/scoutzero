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
  timelineTruthLabel?: string | null;
  timelineTruthDetail?: string | null;
  timelineTruthClassName?: string | null;
  usesWorldEvents: boolean;
  timelineEntries: TeamHistoryLooseTimelineEntry[];
};

type ResolvedTimelineTimestamp = {
  value: string | null;
  fieldLabel: string | null;
};

const formatCurrency = (value: unknown): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return `$${value.toLocaleString()}`;
};

const toDisplayToken = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const buildTeamCodes = (...values: Array<string | null | undefined>): string[] => {
  return values.filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
};

const resolveTimelineTimestamp = (
  candidates: Array<{ fieldLabel: string; value: string | null | undefined }>
): ResolvedTimelineTimestamp => {
  const match = candidates.find(
    (candidate) =>
      typeof candidate.value === 'string' && candidate.value.trim().length > 0
  );

  return {
    value: match?.value || null,
    fieldLabel: match?.fieldLabel || null,
  };
};

const parseTimelineTimestamp = (value: unknown): number => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const buildSourceTruthSection = (
  sourceCollection: string,
  timestampField: string | null
) => ({
  title: 'Source Truth',
  lines: [
    `Derived from ${sourceCollection}[]`,
    timestampField
      ? `Timestamp sourced from ${timestampField}`
      : 'No source timestamp was recorded',
  ],
});

const formatDeadCapLines = (
  deadCap: Record<string, number> | null | undefined
): string[] => {
  if (!deadCap || typeof deadCap !== 'object') {
    return [];
  }

  return Object.entries(deadCap)
    .sort(([yearA], [yearB]) => Number(yearA) - Number(yearB))
    .map(([year, amount]) => `${year}: $${amount.toLocaleString()}`);
};

const buildWaivedContractTimelineEntry = (
  teamCapSheet: TeamHistoryCapSheetLike,
  entry: NonNullable<TeamHistoryCapSheetLike['waivedContracts']>[number],
  idx: number
): TeamHistoryLooseTimelineEntry => {
  const teamsInvolved = buildTeamCodes(teamCapSheet.teamCode || 'TEAM');
  const resolvedTimestamp = resolveTimelineTimestamp([
    {
      fieldLabel: 'waivedOn',
      value: entry?.waivedOn || null,
    },
  ]);
  const deadCapLines = formatDeadCapLines(entry?.deadCap);
  const playerName = entry?.name || 'Player';

  return {
    id: entry?.id || `waive-${idx}`,
    category: 'cap-transaction',
    type: entry?.stretched
      ? 'Waived & Stretched Contract Record'
      : 'Waived Contract Record',
    timestamp: resolvedTimestamp.value,
    teamsInvolved,
    teamCodes: teamsInvolved,
    primaryDeltas:
      deadCapLines.length > 0
        ? `Dead cap schedule: ${deadCapLines.join('; ')}`
        : 'Dead cap schedule updated',
    capDelta: null,
    summary: entry?.stretched
      ? `Waiver record: ${playerName} was waived and stretched.`
      : `Waiver record: ${playerName} was waived.`,
    mutationType: 'sectionDerived:waivedContracts',
    detailSections: [
      buildSourceTruthSection(
        'waivedContracts',
        resolvedTimestamp.fieldLabel
      ),
      {
        title: 'Waiver Record',
        lines: [
          `Player: ${playerName}`,
          `Stretch provision: ${entry?.stretched ? 'Yes' : 'No'}`,
          deadCapLines.length > 0
            ? `Dead cap breakdown: ${deadCapLines.join('; ')}`
            : 'No dead cap breakdown was recorded',
        ],
      },
    ],
    raw: {
      derivedTimeline: true,
      sourceCollection: 'waivedContracts',
      timestampField: resolvedTimestamp.fieldLabel,
      sourceEntry: entry,
    },
  };
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  createTradeException: 'Trade Exception Created',
  consumeTradeException: 'Trade Exception Consumed',
  expireTradeException: 'Trade Exception Expired',
  TPE_CREATED: 'Trade Exception Created',
  TPE_CONSUMED: 'Trade Exception Consumed',
  TPE_EXPIRED: 'Trade Exception Expired',
};

const buildExceptionPrimaryDeltas = (
  entry:
    | NonNullable<TeamHistoryCapSheetLike['exceptionHistory']>[number]
    | undefined
): string => {
  if (typeof entry?.primaryDeltas === 'string' && entry.primaryDeltas.trim()) {
    return entry.primaryDeltas;
  }

  const amountParts = [
    typeof entry?.amountCreated === 'number'
      ? `Created ${formatCurrency(entry.amountCreated)}`
      : null,
    typeof entry?.amountConsumed === 'number'
      ? `Consumed ${formatCurrency(entry.amountConsumed)}`
      : null,
    typeof entry?.amountRemaining === 'number'
      ? `Remaining ${formatCurrency(entry.amountRemaining)}`
      : null,
    typeof entry?.amount === 'number'
      ? `Amount ${formatCurrency(entry.amount)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return amountParts.join('; ') || 'Exception availability updated';
};

const buildExceptionTimelineEntry = (
  teamCapSheet: TeamHistoryCapSheetLike,
  entry: NonNullable<TeamHistoryCapSheetLike['exceptionHistory']>[number],
  idx: number
): TeamHistoryLooseTimelineEntry => {
  const resolvedTimestamp = resolveTimelineTimestamp([
    {
      fieldLabel: 'timestamp',
      value: entry?.timestamp || null,
    },
    {
      fieldLabel: 'date',
      value: entry?.date || null,
    },
  ]);
  const teamsInvolved = buildTeamCodes(
    entry?.sourceTeamCode || teamCapSheet.teamCode || 'TEAM',
    entry?.targetTeamCode || null
  );
  const rawAction = entry?.type || entry?.action || null;
  const displayType =
    (rawAction && EXCEPTION_TYPE_LABELS[rawAction]) ||
    (toDisplayToken(rawAction) ? `${toDisplayToken(rawAction)} Record` : null) ||
    'Exception History Record';
  const summaryPrefix = 'Exception history record';
  const amountSummary = formatCurrency(entry?.amountRemaining || entry?.amount);
  const sourcePlayer = entry?.sourcePlayerName || entry?.source || 'asset';
  const derivedSummary =
    displayType === 'Trade Exception Consumed' && amountSummary
      ? `${summaryPrefix}: ${sourcePlayer} exception reduced to ${amountSummary}.`
      : displayType === 'Trade Exception Created' && amountSummary
        ? `${summaryPrefix}: ${sourcePlayer} exception created at ${amountSummary}.`
        : displayType === 'Trade Exception Expired'
          ? `${summaryPrefix}: ${sourcePlayer} exception expired.`
          : `${summaryPrefix}: ${sourcePlayer} entry updated.`;

  return {
    id: entry?.id || `exception-${idx}`,
    category: 'entitlements',
    type: displayType,
    timestamp: resolvedTimestamp.value,
    teamsInvolved,
    teamCodes: teamsInvolved,
    primaryDeltas: buildExceptionPrimaryDeltas(entry),
    capDelta: null,
    summary:
      typeof entry?.summary === 'string' && entry.summary.trim().length > 0
        ? `${summaryPrefix}: ${entry.summary}`
        : derivedSummary,
    mutationType: 'sectionDerived:exceptionHistory',
    detailSections: [
      buildSourceTruthSection(
        'exceptionHistory',
        resolvedTimestamp.fieldLabel
      ),
      {
        title: 'Exception Record',
        lines: [
          rawAction ? `Action: ${rawAction}` : 'No source action was recorded',
          `Source player: ${sourcePlayer}`,
          entry?.targetTeamCode
            ? `Counterparty: ${entry.targetTeamCode}`
            : 'No counterparty team was recorded',
          buildExceptionPrimaryDeltas(entry),
          entry?.expiresAt || entry?.expires
            ? `Expires: ${entry.expiresAt || entry.expires}`
            : 'No exception expiry was recorded',
        ],
      },
    ],
    raw: {
      derivedTimeline: true,
      sourceCollection: 'exceptionHistory',
      timestampField: resolvedTimestamp.fieldLabel,
      sourceEntry: entry,
    },
  };
};

const buildPickLogType = (
  action: string | null | undefined
): string => {
  const normalized = action?.trim().toLowerCase() || '';

  if (normalized.includes('acquir')) return 'Pick Acquired';
  if (
    normalized.includes('send') ||
    normalized.includes('outgoing') ||
    normalized.includes('trade away')
  ) {
    return 'Pick Sent Out';
  }
  if (normalized.includes('swap')) return 'Pick Swap Recorded';

  return toDisplayToken(action) ? `Pick Log: ${toDisplayToken(action)}` : 'Pick Log Record';
};

const buildPickLogSummary = (
  entry: NonNullable<TeamHistoryCapSheetLike['pickLog']>[number]
): string => {
  const action = toDisplayToken(entry?.action) || 'Updated';
  const pick = entry?.pick || 'draft asset';
  const partner = entry?.partner || null;

  if (partner && action === 'Acquired') {
    return `Pick log record: acquired ${pick} from ${partner}.`;
  }

  if (partner && action === 'Sent Out') {
    return `Pick log record: sent ${pick} to ${partner}.`;
  }

  if (partner) {
    return `Pick log record: ${action.toLowerCase()} ${pick} with ${partner}.`;
  }

  return `Pick log record: ${action.toLowerCase()} ${pick}.`;
};

const buildPickLogTimelineEntry = (
  teamCapSheet: TeamHistoryCapSheetLike,
  entry: NonNullable<TeamHistoryCapSheetLike['pickLog']>[number],
  idx: number
): TeamHistoryLooseTimelineEntry => {
  const resolvedTimestamp = resolveTimelineTimestamp([
    {
      fieldLabel: 'timestamp',
      value: entry?.timestamp || null,
    },
    {
      fieldLabel: 'date',
      value: entry?.date || null,
    },
  ]);
  const teamsInvolved = buildTeamCodes(
    teamCapSheet.teamCode || 'TEAM',
    entry?.partner || null
  );

  return {
    id: entry?.id || `pick-${idx}`,
    category: 'draft',
    type: buildPickLogType(entry?.action || null),
    timestamp: resolvedTimestamp.value,
    teamsInvolved,
    teamCodes: teamsInvolved,
    primaryDeltas: entry?.pick || 'Draft asset updated',
    capDelta: null,
    summary:
      typeof entry?.notes === 'string' && entry.notes.trim().length > 0
        ? `Pick log record: ${entry.notes}`
        : buildPickLogSummary(entry),
    mutationType: 'sectionDerived:pickLog',
    detailSections: [
      buildSourceTruthSection('pickLog', resolvedTimestamp.fieldLabel),
      {
        title: 'Pick Log Record',
        lines: [
          entry?.action
            ? `Action: ${entry.action}`
            : 'No pick-log action was recorded',
          entry?.pick ? `Pick: ${entry.pick}` : 'No pick asset was recorded',
          entry?.partner
            ? `Partner team: ${entry.partner}`
            : 'No partner team was recorded',
          entry?.notes
            ? `Notes: ${entry.notes}`
            : 'No pick-log notes were recorded',
        ],
      },
    ],
    raw: {
      derivedTimeline: true,
      sourceCollection: 'pickLog',
      timestampField: resolvedTimestamp.fieldLabel,
      sourceEntry: entry,
    },
  };
};

const normalizeTimelineFromSections = (
  teamCapSheet: TeamHistoryCapSheetLike = {}
): TeamHistoryLooseTimelineEntry[] => {
  const timeline: TeamHistoryLooseTimelineEntry[] = [];

  const waivedContracts = Array.isArray(teamCapSheet.waivedContracts)
    ? teamCapSheet.waivedContracts
    : [];
  waivedContracts.forEach((entry, idx) => {
    timeline.push(buildWaivedContractTimelineEntry(teamCapSheet, entry, idx));
  });

  const exceptionHistory = Array.isArray(teamCapSheet.exceptionHistory)
    ? teamCapSheet.exceptionHistory
    : [];
  exceptionHistory.forEach((entry, idx) => {
    timeline.push(buildExceptionTimelineEntry(teamCapSheet, entry, idx));
  });

  const pickLog = Array.isArray(teamCapSheet.pickLog)
    ? teamCapSheet.pickLog
    : [];
  pickLog.forEach((entry, idx) => {
    timeline.push(buildPickLogTimelineEntry(teamCapSheet, entry, idx));
  });

  return timeline;
};

const sortTimelineNewestFirst = (
  entries: TeamHistoryLooseTimelineEntry[] = []
): TeamHistoryLooseTimelineEntry[] => {
  return [...entries].sort((a, b) => {
    const aTs = parseTimelineTimestamp(a?.timestamp || a?.occurredAt || null);
    const bTs = parseTimelineTimestamp(b?.timestamp || b?.occurredAt || null);
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
      timelineTruthLabel: null,
      timelineTruthDetail: null,
      timelineTruthClassName: null,
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
      timelineTruthLabel: null,
      timelineTruthDetail: null,
      timelineTruthClassName: null,
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
        'Outside world-event mode, direct historyTimeline rows take priority over any section-derived local fallback.',
      sourceAccentClassName: 'text-amber-200',
      timelineTruthLabel: 'Direct local timeline rows',
      timelineTruthDetail:
        'Rendering explicit historyTimeline rows only. These are already timeline-shaped local entries, not synthesized section summaries.',
      timelineTruthClassName:
        'border-amber-500/20 bg-amber-500/5 text-amber-100/85',
      usesWorldEvents: false,
      timelineEntries: explicitTimeline,
    };
  }

  return {
    key: 'synthesized',
    scopeLabel,
    sourceLabel: 'Section-derived fallback',
    sourceDetail:
      'No explicit historyTimeline rows were found, so Team History is deriving local fallback rows from waived contracts, exception history, and pick log.',
    sourceAccentClassName: 'text-zinc-200',
    timelineTruthLabel: 'Derived local convenience history',
    timelineTruthDetail:
      'These rows are synthesized from local section records. They preserve source labels and timestamps where available, but they do not carry world-event payloads or before/after totals.',
    timelineTruthClassName: 'border-white/10 bg-white/[0.03] text-white/75',
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
