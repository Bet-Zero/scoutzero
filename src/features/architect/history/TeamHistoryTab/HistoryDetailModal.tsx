import React from 'react';
import type {
  HistoryDetailModalProps,
  TeamHistoryDetailSectionLike,
  TeamHistorySelectedEntry,
} from './types';

type UnknownRecord = Record<string, unknown>;

type CapAlignmentRow = {
  after: number;
  before: number;
  delta: number;
  teamCode: string;
};

const EMPTY_VALUE = '—';

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (!value || seen.has(value)) {
      return;
    }

    seen.add(value);
    result.push(value);
  });

  return result;
};

const getDisplayText = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || EMPTY_VALUE;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return String(value);
  }

  return EMPTY_VALUE;
};

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

const formatNumberDelta = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return EMPTY_VALUE;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString()}`;
};

const formatTeams = (teamsInvolved: string[] | null | undefined) => {
  if (!Array.isArray(teamsInvolved) || teamsInvolved.length === 0) {
    return EMPTY_VALUE;
  }

  return teamsInvolved.join(' · ');
};

const formatList = (items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) {
    return EMPTY_VALUE;
  }

  return items.join(' · ');
};

const stringifySafe = (value: unknown) => {
  if (!value || typeof value !== 'object') return EMPTY_VALUE;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return EMPTY_VALUE;
  }
};

const readCapAllocationTotal = (
  totalsByTeam: UnknownRecord | null,
  teamCode: string
): number | null => {
  const teamTotals = asRecord(totalsByTeam?.[teamCode]);
  const totalCapAllocations = Number(teamTotals?.totalCapAllocations);

  return Number.isFinite(totalCapAllocations) ? totalCapAllocations : null;
};

const buildCapAlignmentRows = ({
  activeTeamCode,
  afterTotalsByTeam,
  beforeTotalsByTeam,
}: {
  activeTeamCode: string | null;
  afterTotalsByTeam: UnknownRecord | null;
  beforeTotalsByTeam: UnknownRecord | null;
}): CapAlignmentRow[] => {
  const orderedTeamCodes = uniqueStrings([
    activeTeamCode || '',
    ...Object.keys(beforeTotalsByTeam || {}),
    ...Object.keys(afterTotalsByTeam || {}),
  ]);

  return orderedTeamCodes
    .map((teamCode) => {
      const before = readCapAllocationTotal(beforeTotalsByTeam, teamCode);
      const after = readCapAllocationTotal(afterTotalsByTeam, teamCode);

      if (before === null || after === null) {
        return null;
      }

      return {
        after,
        before,
        delta: after - before,
        teamCode,
      };
    })
    .filter((row): row is CapAlignmentRow => Boolean(row));
};

const resolveTruthContract = (
  selectedEntry: TeamHistorySelectedEntry,
  rawEntry: UnknownRecord | null
) => {
  const sourceCollection =
    typeof rawEntry?.sourceCollection === 'string'
      ? rawEntry.sourceCollection
      : null;

  if (selectedEntry.truthKind === 'authoritative-world-event') {
    return {
      label: 'Authoritative world-event row',
      description:
        'Display fields below come from the normalized Team History event row. Raw payload is inspection-only and does not backfill missing normalized fields.',
      rawPayloadTitle: 'Underlying World-Event Payload',
      rawPayloadDescription: rawEntry
        ? 'Inspect the source event here when you need to verify the normalized Team History row.'
        : 'This selected world-event row did not carry a raw payload object.',
    };
  }

  if (selectedEntry.truthKind === 'synthetic-dev-fixture') {
    return {
      label: 'Synthetic DEV fixture row',
      description:
        'Display fields below come from injected DEV Team History fixtures. These rows are non-authoritative test data and temporarily suppress world-event history until cleared.',
      rawPayloadTitle: rawEntry
        ? 'Attached Fixture Payload'
        : 'No Raw Payload Attached',
      rawPayloadDescription: rawEntry
        ? 'Inspect this synthetic payload separately from the rendered Team History fields above.'
        : 'This selected synthetic fixture row does not carry a raw payload object.',
    };
  }

  if (selectedEntry.truthKind === 'section-derived-fallback') {
    return {
      label: 'Section-derived fallback row',
      description: sourceCollection
        ? `Display fields below come from synthesized Team History output derived from ${sourceCollection}[]. Raw payload below is derived-source metadata, not a canonical world-event payload.`
        : 'Display fields below come from synthesized Team History output. Raw payload below is derived-source metadata, not a canonical world-event payload.',
      rawPayloadTitle: 'Derived-Source Metadata',
      rawPayloadDescription:
        'Use the raw payload below to inspect the source collection and original local entry that produced this synthesized row.',
    };
  }

  return {
    label: 'Explicit local timeline row',
    description:
      'Display fields below come directly from the selected local Team History entry. Any raw payload attached to the row is shown separately and does not replace missing normalized fields.',
    rawPayloadTitle: rawEntry ? 'Attached Local Payload' : 'No Raw Payload Attached',
    rawPayloadDescription: rawEntry
      ? 'Inspect this attached local payload separately from the normalized Team History fields above.'
      : 'This selected local row does not carry a raw payload object.',
  };
};

const buildRawPayloadSummaryLines = (
  rawEntry: UnknownRecord | null
): string[] => {
  if (!rawEntry) {
    return ['No raw payload fields were carried on this selected entry.'];
  }

  const rawTeamCodes = asStringArray(rawEntry.teamCodes);
  const rawTeamsAffected = asStringArray(rawEntry.teamsAffected);
  const rawPlayerIds = asStringArray(rawEntry.playerIds);

  return [
    rawEntry.eventId
      ? `Raw event ID: ${rawEntry.eventId}`
      : 'No raw event ID was carried on this payload.',
    rawEntry.operationId
      ? `Raw operation ID: ${rawEntry.operationId}`
      : 'No raw operation ID was carried on this payload.',
    rawEntry.mutationType
      ? `Raw mutation type: ${rawEntry.mutationType}`
      : null,
    rawEntry.type ? `Raw payload type: ${rawEntry.type}` : null,
    rawTeamCodes.length > 0
      ? `Raw teamCodes: ${rawTeamCodes.join(' · ')}`
      : null,
    rawTeamsAffected.length > 0
      ? `Raw teamsAffected: ${rawTeamsAffected.join(' · ')}`
      : null,
    rawPlayerIds.length > 0
      ? `Raw playerIds: ${rawPlayerIds.join(' · ')}`
      : null,
  ].filter((line): line is string => Boolean(line));
};

export const HistoryDetailModal = ({
  selectedEntry,
  onClose,
}: HistoryDetailModalProps) => {
  if (!selectedEntry) return null;

  const { activeTeamCode, entry } = selectedEntry;
  const rawEntry = asRecord(entry.raw);
  const truthContract = resolveTruthContract(selectedEntry, rawEntry);
  const normalizedTeamsInvolved = uniqueStrings([
    ...asStringArray(entry.teamsInvolved),
    ...asStringArray(entry.teamCodes),
  ]);
  const normalizedTeamCodes = uniqueStrings([
    ...asStringArray(entry.teamCodes),
    ...asStringArray(entry.teamsInvolved),
  ]);
  const normalizedPlayerIds = asStringArray(entry.playerIds);
  const beforeTotalsByTeam = asRecord(entry.beforeTotalsByTeam);
  const afterTotalsByTeam = asRecord(entry.afterTotalsByTeam);
  const detailSections = Array.isArray(entry.detailSections)
    ? (entry.detailSections as TeamHistoryDetailSectionLike[])
    : [];
  const mutationId =
    'mutationId' in entry ? getDisplayText(entry.mutationId) : EMPTY_VALUE;
  const capAlignmentRows = buildCapAlignmentRows({
    activeTeamCode,
    afterTotalsByTeam,
    beforeTotalsByTeam,
  });
  const referenceCapRow =
    (activeTeamCode &&
      capAlignmentRows.find((row) => row.teamCode === activeTeamCode)) ||
    capAlignmentRows[0] ||
    null;
  const capAlignmentStatus =
    typeof entry.capDelta === 'number' && referenceCapRow
      ? entry.capDelta === referenceCapRow.delta
        ? `Displayed cap delta matches ${referenceCapRow.teamCode} before/after totals.`
        : `Displayed cap delta does not match ${referenceCapRow.teamCode} before/after totals.`
      : typeof entry.capDelta === 'number'
        ? 'Displayed cap delta has no normalized before/after totals to reconcile against.'
        : referenceCapRow
          ? `Before/after totals are present for ${referenceCapRow.teamCode}, but no normalized cap delta was provided.`
          : 'No normalized before/after totals were carried on this entry.';
  const rawPayloadSummaryLines = buildRawPayloadSummaryLines(rawEntry);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div
        data-testid="team-history-detail-modal"
        className="w-full max-w-2xl rounded border border-white/10 bg-[#151515] p-4 text-white shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">History Item Detail</h3>
            <p
              data-testid="team-history-detail-summary"
              className="text-sm text-white/70"
            >
              {entry.summary || EMPTY_VALUE}
            </p>
          </div>
          <button
            type="button"
            data-testid="team-history-detail-close"
            onClick={onClose}
            className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div
          data-testid="team-history-detail-truth-note"
          className="mb-4 rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-100/85"
        >
          <div className="font-semibold uppercase tracking-[0.08em]">
            {truthContract.label}
          </div>
          <div className="mt-1 text-[11px]">{truthContract.description}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-white/60">
              Category / Type
            </div>
            <div data-testid="team-history-detail-type" className="font-medium">
              {entry.category || EMPTY_VALUE} · {entry.type || EMPTY_VALUE}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Timestamp</div>
            <div
              data-testid="team-history-detail-timestamp"
              className="font-medium"
            >
              {entry.timestamp || entry.occurredAt || EMPTY_VALUE}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">
              Raw Payload Type
            </div>
            <div
              data-testid="team-history-detail-raw-type"
              className="font-medium"
            >
              {getDisplayText(rawEntry?.type)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Mutation Type</div>
            <div
              data-testid="team-history-detail-mutation-type"
              className="font-medium"
            >
              {getDisplayText(entry.mutationType)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">
              Teams Involved
            </div>
            <div
              data-testid="team-history-detail-teams"
              className="font-medium"
            >
              {formatTeams(normalizedTeamsInvolved)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Team Codes</div>
            <div
              data-testid="team-history-detail-team-codes"
              className="font-medium"
            >
              {formatList(normalizedTeamCodes)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Player IDs</div>
            <div
              data-testid="team-history-detail-player-ids"
              className="font-medium break-all"
            >
              {formatList(normalizedPlayerIds)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Cap Delta</div>
            <div className="font-medium">
              {formatNumberDelta(entry.capDelta)}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              Primary Deltas
            </div>
            <div
              data-testid="team-history-detail-deltas"
              className="font-medium"
            >
              {entry.primaryDeltas || EMPTY_VALUE}
            </div>
          </div>
          <div className="md:col-span-2 rounded border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase text-white/60">Identity</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase text-white/45">
                  Selected Row ID
                </div>
                <div
                  data-testid="team-history-detail-row-id"
                  className="font-medium break-all"
                >
                  {getDisplayText(entry.id)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-white/45">
                  Mutation ID
                </div>
                <div
                  data-testid="team-history-detail-mutation-id"
                  className="font-medium break-all"
                >
                  {mutationId}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-white/45">
                  Event ID
                </div>
                <div
                  data-testid="team-history-detail-event-id"
                  className="font-medium break-all"
                >
                  {getDisplayText(entry.eventId)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-white/45">
                  Operation ID
                </div>
                <div
                  data-testid="team-history-detail-operation-id"
                  className="font-medium break-all"
                >
                  {getDisplayText(entry.operationId)}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/55">
              Selected row identity is shown exactly as carried on the Team
              History entry. The modal does not coalesce these IDs into one
              fallback identifier.
            </div>
          </div>
          {detailSections.length > 0 && (
            <div
              className="md:col-span-2 space-y-3"
              data-testid="team-history-detail-sections"
            >
              {detailSections.map((section, index) => (
                <div
                  key={`${section.title}-${index}`}
                  className="rounded border border-white/10 bg-black/20 p-2"
                >
                  <div className="text-xs uppercase text-white/60">
                    {section.title}
                  </div>
                  <ul className="mt-1 space-y-1 text-sm text-white/90">
                    {(Array.isArray(section.lines) ? section.lines : [])
                      .filter(Boolean)
                      .map((line, lineIdx) => (
                        <li key={`${section.title}-${lineIdx}`}>• {line}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <div
            data-testid="team-history-detail-cap-alignment"
            className="md:col-span-2 rounded border border-white/10 bg-black/20 p-3"
          >
            <div className="text-xs uppercase text-white/60">
              Cap Delta Alignment
            </div>
            <div className="mt-1 text-sm text-white/85">{capAlignmentStatus}</div>
            <ul className="mt-2 space-y-1 text-sm text-white/90">
              {capAlignmentRows.map((row) => (
                <li key={row.teamCode}>
                  • {row.teamCode} total cap allocations: {formatCurrency(row.before)}{' '}
                  -&gt; {formatCurrency(row.after)} ({formatNumberDelta(row.delta)})
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              Before Totals By Team
            </div>
            <pre
              data-testid="team-history-detail-before-totals"
              className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 text-xs text-white/80"
            >
              {stringifySafe(beforeTotalsByTeam)}
            </pre>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              After Totals By Team
            </div>
            <pre
              data-testid="team-history-detail-after-totals"
              className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 text-xs text-white/80"
            >
              {stringifySafe(afterTotalsByTeam)}
            </pre>
          </div>
          <div className="md:col-span-2 rounded border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase text-white/60">
              {truthContract.rawPayloadTitle}
            </div>
            <div className="mt-1 text-[11px] text-white/55">
              {truthContract.rawPayloadDescription}
            </div>
            <ul
              data-testid="team-history-detail-raw-summary"
              className="mt-2 space-y-1 text-sm text-white/90"
            >
              {rawPayloadSummaryLines.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              Raw Event Payload
            </div>
            <pre
              data-testid="team-history-raw-payload"
              className="mt-1 max-h-56 overflow-auto rounded bg-black/30 p-2 text-xs text-white/80"
            >
              {stringifySafe(rawEntry)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

