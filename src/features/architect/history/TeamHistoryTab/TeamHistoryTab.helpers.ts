/**
 * Pure helper functions and constants for TeamHistoryTab.
 * Extracted to reduce TeamHistoryTab.tsx from 955 lines.
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import type {
  TeamHistoryCapSheetLike,
  TeamHistoryDisplayEntry,
  TeamHistoryLooseTimelineEntry,
  TeamHistoryPlayerMovement,
  TeamHistorySelectedEntry,
  TeamHistoryTimelineSourceKey,
  TeamHistoryWaivedContractEntry,
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

const eventIdentity = (event: Record<string, unknown>): string | null => {
  const value = event.eventId ?? event.id ?? event.operationId;
  return value == null || String(value).trim().length === 0
    ? null
    : String(value).trim();
};

const eventStringList = (
  event: Record<string, unknown>,
  primaryField: string,
  fallbackField?: string
): string[] => {
  const normalize = (candidate: unknown): string[] =>
    Array.isArray(candidate)
      ? Array.from(
          new Set(
            candidate.map((value) => String(value || '').trim()).filter(Boolean)
          )
        )
      : [];
  const primaryValues = normalize(event[primaryField]);
  return primaryValues.length > 0 || !fallbackField
    ? primaryValues
    : normalize(event[fallbackField]);
};

const eventPlayerIds = (event: Record<string, unknown>): string[] => {
  const directPlayerIds = eventStringList(event, 'playerIds');
  if (directPlayerIds.length > 0) return directPlayerIds;

  const metadata = asRecord(event.metadata);
  return metadata
    ? eventStringList(metadata, 'playerIds', 'playersTraded')
    : [];
};

/**
 * Resolves player direction only when retained world truth makes it exact.
 *
 * A two-team executeTrade event proves the two possible endpoints. The current
 * saved-world player override proves which endpoint each player occupies, but
 * only while the selected trade remains that player's latest retained event.
 * Anything missing, multi-team, invalidly dated, or superseded stays neutral
 * instead of guessing from player order or the active team alone.
 */
export const resolveReliableTradePlayerMovements = ({
  selectedEntry,
  committedWorldEvents,
  coveredTeamCodes,
  resolvePlayerTeamCode,
}: {
  selectedEntry: TeamHistorySelectedEntry | null;
  committedWorldEvents: unknown[];
  coveredTeamCodes: string[];
  resolvePlayerTeamCode?: ((playerId: string) => string | null) | null;
}): TeamHistoryPlayerMovement[] => {
  if (
    !selectedEntry ||
    selectedEntry.truthKind !== 'authoritative-world-event' ||
    !resolvePlayerTeamCode
  ) {
    return [];
  }

  const selectedId = eventIdentity(asRecord(selectedEntry.entry) || {});
  if (!selectedId) return [];

  const events = committedWorldEvents
    .map(asRecord)
    .filter((event): event is Record<string, unknown> => Boolean(event));
  const selectedEvent = events.find(
    (event) => eventIdentity(event) === selectedId
  );
  if (!selectedEvent) return [];

  const mutationType = String(
    selectedEvent.mutationType ?? selectedEvent.type ?? ''
  ).trim();
  if (mutationType !== 'executeTrade') return [];

  const activeTeamCode = String(selectedEntry.activeTeamCode || '')
    .trim()
    .toUpperCase();
  const teamCodes = eventStringList(
    selectedEvent,
    'teamCodes',
    'teamsAffected'
  ).map((teamCode) => teamCode.toUpperCase());
  if (
    !activeTeamCode ||
    teamCodes.length !== 2 ||
    !teamCodes.includes(activeTeamCode) ||
    !teamCodes.every((teamCode) =>
      coveredTeamCodes
        .map((coveredTeamCode) => coveredTeamCode.trim().toUpperCase())
        .includes(teamCode)
    )
  ) {
    return [];
  }

  const playerIds = eventPlayerIds(selectedEvent);
  const selectedTime = parseTimelineTimestamp(
    selectedEvent.occurredAt ?? selectedEvent.timestamp
  );
  if (playerIds.length === 0 || selectedTime === Number.NEGATIVE_INFINITY) {
    return [];
  }

  const movements: TeamHistoryPlayerMovement[] = [];
  for (const playerId of playerIds) {
    const hasLaterOrUnorderedEvent = events.some((event) => {
      if (eventIdentity(event) === selectedId) return false;
      if (!eventPlayerIds(event).includes(playerId)) return false;

      const eventTime = parseTimelineTimestamp(
        event.occurredAt ?? event.timestamp
      );
      return (
        eventTime === Number.NEGATIVE_INFINITY || eventTime >= selectedTime
      );
    });
    if (hasLaterOrUnorderedEvent) continue;

    const destinationTeamCode = String(resolvePlayerTeamCode(playerId) || '')
      .trim()
      .toUpperCase();
    if (!teamCodes.includes(destinationTeamCode)) continue;
    const sourceTeamCode = teamCodes.find(
      (teamCode) => teamCode !== destinationTeamCode
    );
    if (!sourceTeamCode) continue;
    movements.push({ playerId, sourceTeamCode, destinationTeamCode });
  }
  return movements;
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

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatWaiveDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(parsed));
};

const toDeadCapYearKey = (season: unknown): string | null => {
  const endYear = toEndYear(season);
  if (endYear != null) {
    return String(endYear);
  }
  if (typeof season === 'string' && season.trim()) {
    return season.trim();
  }
  if (typeof season === 'number' && Number.isFinite(season)) {
    return String(season);
  }
  return null;
};

/**
 * Adapts one canonical team.deadCap[] ledger entry (written by committed
 * waive/buyout mutations) into the waived-contract display shape the
 * WaiveStretchTracker side panel renders.
 */
const toWaivedContractEntryFromDeadCap = (
  item: unknown
): TeamHistoryWaivedContractEntry | null => {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const playerId =
    typeof record.playerId === 'string' && record.playerId.trim()
      ? record.playerId.trim()
      : null;
  const playerName =
    typeof record.playerName === 'string' && record.playerName.trim()
      ? record.playerName.trim()
      : null;

  const deadCapByYear: Record<string, number> = {};
  let stretched = false;

  const amountByYear = record.amountByYear;
  if (Array.isArray(amountByYear)) {
    for (const row of amountByYear) {
      const rowRecord = asRecord(row);
      if (!rowRecord) continue;
      const yearKey = toDeadCapYearKey(rowRecord.season);
      const amount = toFiniteNumber(rowRecord.amount);
      if (yearKey && amount != null) {
        deadCapByYear[yearKey] = (deadCapByYear[yearKey] || 0) + amount;
      }
      if (rowRecord.isStretched === true) {
        stretched = true;
      }
    }
  } else {
    const amountByYearMap = asRecord(amountByYear);
    if (amountByYearMap) {
      for (const [season, rawValue] of Object.entries(amountByYearMap)) {
        const yearKey = toDeadCapYearKey(season);
        const valueRecord = asRecord(rawValue);
        const amount = toFiniteNumber(
          valueRecord ? valueRecord.amount : rawValue
        );
        if (yearKey && amount != null) {
          deadCapByYear[yearKey] = (deadCapByYear[yearKey] || 0) + amount;
        }
        if (valueRecord?.isStretched === true) {
          stretched = true;
        }
      }
    }
  }

  if (!playerId && !playerName && Object.keys(deadCapByYear).length === 0) {
    return null;
  }

  return {
    id: playerId,
    name: playerName || playerId || 'Player',
    waivedOn: formatWaiveDate(record.waiveDate),
    stretched,
    deadCap: deadCapByYear,
  };
};

const WAIVE_EVENT_MUTATION_TYPES = new Set([
  'waivePlayer',
  'waiveAndStretch',
  'buyoutPlayer',
]);

/**
 * Adapts a committed waive-kind world event into the waived-contract display
 * shape. This covers waives that produce no dead money (e.g. non-guaranteed /
 * two-way contracts), which never reach the canonical team.deadCap[] ledger
 * but still must not be contradicted by the side panel (BZE-218).
 */
const toWaivedContractEntryFromWaiveEvent = (
  event: unknown
): TeamHistoryWaivedContractEntry | null => {
  const record = asRecord(event);
  if (!record) {
    return null;
  }
  const mutationType =
    typeof record.mutationType === 'string'
      ? record.mutationType
      : typeof record.type === 'string'
        ? record.type
        : '';
  if (!WAIVE_EVENT_MUTATION_TYPES.has(mutationType)) {
    return null;
  }

  const mutationMetadata = asRecord(record.mutationMetadata) || {};
  const metadata = asRecord(record.metadata) || {};
  const playerId =
    [mutationMetadata.playerId, metadata.playerId]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find(Boolean) ||
    (Array.isArray(record.playerIds) && typeof record.playerIds[0] === 'string'
      ? record.playerIds[0].trim()
      : '');
  const playerName = [mutationMetadata.playerName, metadata.playerName]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (!playerId && !playerName) {
    return null;
  }

  const occurredAt =
    typeof record.occurredAt === 'string'
      ? record.occurredAt
      : typeof record.timestamp === 'string'
        ? record.timestamp
        : null;
  const stretched =
    mutationMetadata.stretched === true || metadata.stretched === true;

  return {
    id: playerId || null,
    name: playerName || playerId || 'Player',
    waivedOn: formatWaiveDate(occurredAt),
    stretched,
    // Dead-money schedules belong to the canonical deadCap ledger; a waive
    // event reaching this adapter has no ledger entry (zero dead money).
    deadCap: {},
  };
};

const entryDedupeKeys = (
  entry: TeamHistoryWaivedContractEntry
): string[] =>
  [entry.id, entry.name]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

/**
 * Resolves the waived-contract entries the Team History side panel displays.
 *
 * Committed world waives write to the canonical team.deadCap[] ledger, while
 * older data uses the legacy waivedContracts[] list, and zero-dead-money
 * waives (non-guaranteed / two-way deals) only exist as committed world
 * events. The side panel merges all three so it never contradicts a
 * committed waive on the timeline (BZE-218). Canonical ledger entries win
 * when multiple sources describe the same player.
 */
export const resolveWaivedContractDisplayEntries = (
  teamCapSheet: TeamHistoryCapSheetLike = {},
  committedWorldEvents: unknown[] = []
): TeamHistoryWaivedContractEntry[] => {
  const canonicalEntries = (
    Array.isArray(teamCapSheet.deadCap) ? teamCapSheet.deadCap : []
  )
    .map(toWaivedContractEntryFromDeadCap)
    .filter((entry): entry is TeamHistoryWaivedContractEntry =>
      Boolean(entry)
    );

  const seenKeys = new Set(canonicalEntries.flatMap(entryDedupeKeys));

  const eventEntries: TeamHistoryWaivedContractEntry[] = [];
  for (const event of Array.isArray(committedWorldEvents)
    ? committedWorldEvents
    : []) {
    const entry = toWaivedContractEntryFromWaiveEvent(event);
    if (!entry) continue;
    const keys = entryDedupeKeys(entry);
    if (keys.some((key) => seenKeys.has(key))) continue;
    keys.forEach((key) => seenKeys.add(key));
    eventEntries.push(entry);
  }

  const legacyEntries = (
    Array.isArray(teamCapSheet.waivedContracts)
      ? teamCapSheet.waivedContracts
      : []
  ).filter((entry) => {
    const legacyKeys = [entry?.id, entry?.name]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());
    return !legacyKeys.some((key) => seenKeys.has(key));
  });

  return [...canonicalEntries, ...eventEntries, ...legacyEntries];
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

  const waivedContracts = resolveWaivedContractDisplayEntries(teamCapSheet);
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
  // Owner-facing scope: never print the raw world id (BZE-209). The id stays
  // available to tests via data attributes on the banner.
  const scopeLabel = worldId ? 'This saved season' : 'Unsaved session';
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
      sourceAccentClassName: 'text-cockpit-safe',
      timelineTruthLabel: 'Synthetic DEV fixture history',
      timelineTruthDetail:
        'These timeline rows and Team History section values are injected DEV-only test data. They are useful for coverage, but they are not authoritative Team History truth.',
      timelineTruthClassName:
        'border-cockpit-safe/20 bg-cockpit-safe/5 text-cockpit-safe',
      usesWorldEvents: false,
      timelineEntries:
        explicitTimeline.length > 0 ? explicitTimeline : synthesizedTimeline,
    };
  }

  if (worldId) {
    return {
      key: 'world-events',
      scopeLabel,
      sourceLabel: 'Saved season history',
      sourceDetail:
        'Everything below happened in this saved season.',
      sourceAccentClassName: 'text-cockpit-info',
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
      sourceLabel: 'This session',
      sourceDetail:
        'Showing moves recorded in this session.',
      sourceAccentClassName: 'text-cockpit-watch',
      timelineTruthLabel: 'Session history',
      timelineTruthDetail:
        'These entries were recorded directly in this session.',
      timelineTruthClassName:
        'border-cockpit-watch/20 bg-cockpit-watch/5 text-cockpit-watch',
      usesWorldEvents: false,
      timelineEntries: explicitTimeline,
    };
  }

  return {
    key: 'synthesized',
    scopeLabel,
    sourceLabel: 'Recent team records',
    sourceDetail:
      'Showing recent signings, waives, exceptions, and pick moves recorded for this team.',
    sourceAccentClassName: 'text-cockpit-text-secondary',
    timelineTruthLabel: 'Reconstructed history',
    timelineTruthDetail:
      'These entries were reconstructed from team records. Amounts and dates are shown where available.',
    timelineTruthClassName: 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-secondary',
    usesWorldEvents: false,
    timelineEntries: synthesizedTimeline,
  };
};
