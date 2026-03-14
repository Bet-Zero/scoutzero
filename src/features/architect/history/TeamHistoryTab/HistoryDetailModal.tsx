import React from 'react';
import type {
  HistoryDetailModalProps,
  TeamHistoryDetailSectionLike,
} from './types';

const formatNumberDelta = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toLocaleString()}`;
};

const formatTeams = (teamsInvolved: string[] | null | undefined) => {
  if (!Array.isArray(teamsInvolved) || teamsInvolved.length === 0) return '—';
  return teamsInvolved.join(' · ');
};

const formatList = (items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) return '—';
  return items.join(' · ');
};

const getDisplayText = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return '—';
};

const stringifySafe = (value: unknown) => {
  if (!value || typeof value !== 'object') return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '—';
  }
};

const HistoryDetailModal = ({ entry, onClose }: HistoryDetailModalProps) => {
  if (!entry) return null;

  const rawEntry =
    entry.raw && typeof entry.raw === 'object' ? entry.raw : undefined;
  const mutationId =
    ('mutationId' in entry ? entry.mutationId : null) ||
    entry.eventId ||
    entry.id ||
    entry.operationId ||
    '—';
  const rawEventType = getDisplayText(
    entry.mutationType || rawEntry?.mutationType || '—'
  );
  const rawType = getDisplayText(rawEntry?.type || entry.type || '—');
  const operationId = getDisplayText(
    entry.operationId || rawEntry?.operationId || '—'
  );
  const eventId = getDisplayText(rawEntry?.eventId || entry.eventId || entry.id || '—');
  const teamCodes =
    entry.teamCodes ||
    entry.teamsInvolved ||
    rawEntry?.teamCodes ||
    rawEntry?.teamsAffected ||
    [];
  const playerIds = entry.playerIds || rawEntry?.playerIds || [];
  const beforeTotalsByTeam =
    entry.beforeTotalsByTeam || rawEntry?.beforeTotalsByTeam || null;
  const afterTotalsByTeam =
    entry.afterTotalsByTeam || rawEntry?.afterTotalsByTeam || null;
  const detailSections = Array.isArray(entry.detailSections)
    ? (entry.detailSections as TeamHistoryDetailSectionLike[])
    : [];

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
              {entry.summary || '—'}
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

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-white/60">
              Category / Type
            </div>
            <div data-testid="team-history-detail-type" className="font-medium">
              {entry.category || '—'} · {entry.type || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Timestamp</div>
            <div
              data-testid="team-history-detail-timestamp"
              className="font-medium"
            >
              {entry.timestamp || entry.occurredAt || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">
              Raw Event Type
            </div>
            <div
              data-testid="team-history-detail-raw-type"
              className="font-medium"
            >
              {rawType}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Mutation Type</div>
            <div
              data-testid="team-history-detail-mutation-type"
              className="font-medium"
            >
              {rawEventType}
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
              {formatTeams(entry.teamsInvolved)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Team Codes</div>
            <div className="font-medium">{formatList(teamCodes)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-white/60">Player IDs</div>
            <div
              data-testid="team-history-detail-player-ids"
              className="font-medium break-all"
            >
              {formatList(playerIds)}
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
              {entry.primaryDeltas || '—'}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              Mutation/Event ID
            </div>
            <div className="font-medium break-all">{mutationId}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">Operation ID</div>
            <div className="font-medium break-all">{operationId}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">Event ID</div>
            <div className="font-medium break-all">{eventId}</div>
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
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-white/60">
              Raw Event Payload
            </div>
            <pre
              data-testid="team-history-raw-payload"
              className="mt-1 max-h-56 overflow-auto rounded bg-black/30 p-2 text-xs text-white/80"
            >
              {stringifySafe(entry.raw || entry)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailModal;
