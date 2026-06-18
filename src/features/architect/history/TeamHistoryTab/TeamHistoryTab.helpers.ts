/**
 * Pure helper functions and constants for TeamHistoryTab.
 * Extracted to reduce TeamHistoryTab.tsx from 955 lines.
 */

import type {
  TeamHistoryCapSheetLike,
  TeamHistoryDisplayEntry,
  TeamHistoryLooseTimelineEntry,
  TeamHistorySelectedEntry,
  TeamHistoryTimelineSourceKey,
} from './types';

export type TeamHistoryTimelineResolution = {
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

export const buildSelectedHistoryEntry = ({
  activeTeamCode,
  entry,
  timelineSourceKey,
}: {
  activeTeamCode: string | null;
  entry: TeamHistoryDisplayEntry;
  timelineSourceKey: TeamHistoryTimelineSourceKey;
}): TeamHistorySelectedEntry => {
  const rawEntry = asRecord(entry?.raw);
  const truthKind =
    timelineSourceKey === 'dev-fixtures'
      ? 'synthetic-dev-fixture'
      : rawEntry?.derivedTimeline === true || timelineSourceKey === 'synthesized'
        ? 'section-derived-fallback'
        : timelineSourceKey === 'world-events'
          ? 'authoritative-world-event'
          : 'explicit-local-timeline';

  return {
    activeTeamCode,
    entry,
    timelineSourceKey,
    truthKind,
  };
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

export const resolveTeamHistoryTimeline = ({
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

  if (hasInjectedFixtures) {
    return {
      key: 'dev-fixtures',
      scopeLabel,
      sourceLabel: 'DEV fixture override',
      sourceDetail:
        'Injected synthetic DEV Team History fixtures temporarily take ownership of the local history view and suppress authoritative world events until cleared.',
      sourceAccentClassName: 'text-emerald-200',
      timelineTruthLabel: 'Synthetic DEV fixture history',
      timelineTruthDetail:
        'These timeline rows and Team History section values are injected DEV-only test data. They are useful for coverage, but they are not authoritative Team History truth.',
      timelineTruthClassName:
        'border-emerald-500/20 bg-emerald-500/5 text-emerald-100/85',
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
        'World events own the timeline whenever an active world is selected.',
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
