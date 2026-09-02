import React from 'react';
import type {
  HistoryDetailModalProps,
  TeamHistoryDetailSectionLike,
  TeamHistorySelectedEntry,
} from './types';
import { resolveHistoryOutboundLinks } from './historyOutboundLinks';
import { PlayerActionMenu } from '@/features/architect/cockpit/PlayerActionMenu';
import { buildPlayerActionContext } from '@/features/architect/cockpit/playerActionContext';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';
import { TeamListFull } from '@/constants/teamList';

type UnknownRecord = Record<string, unknown>;

type CapAlignmentRow = {
  after: number;
  before: number;
  delta: number;
  teamCode: string;
  book: 'Team Salary' | 'Apron Team Salary' | 'Tax Salary';
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

  return value.map((item) => String(item || '').trim()).filter(Boolean);
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

const replaceCompleteToken = (
  value: string,
  token: string,
  replacement: string
) => {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundedToken = new RegExp(
    `(^|[^A-Za-z0-9_])${escapedToken}(?=$|[^A-Za-z0-9_])`,
    'g'
  );
  return value.replace(
    boundedToken,
    (_match, prefix: string) => `${prefix}${replacement}`
  );
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

const TEAM_NAME_BY_CODE = new Map<string, string>(
  TeamListFull.map((team) => [team.code, team.teamName])
);

const formatTeamName = (teamCode: string) =>
  TEAM_NAME_BY_CODE.get(teamCode.toUpperCase()) || 'Team';

const formatTeams = (teamsInvolved: string[] | null | undefined) => {
  if (!Array.isArray(teamsInvolved) || teamsInvolved.length === 0) {
    return EMPTY_VALUE;
  }

  return teamsInvolved
    .map((team) => TEAM_NAME_BY_CODE.get(team.toUpperCase()) || team)
    .join(' · ');
};

const formatHistoryDate = (value: string | null | undefined) => {
  if (!value) return EMPTY_VALUE;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(parsed));
};

const formatMoveType = (value: string | null | undefined) => {
  if (!value) return 'Team move';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
};

const TECHNICAL_DETAIL_SECTIONS =
  /receipt|salary books|source truth|raw|payload|identity|^teams$/i;

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

const readSalaryBook = (
  totalsByTeam: UnknownRecord | null,
  teamCode: string,
  field: 'teamSalary' | 'apronTeamSalary' | 'taxSalary'
): number | null => {
  const teamTotals = asRecord(totalsByTeam?.[teamCode]);
  const value = Number(teamTotals?.[field]);

  return Number.isFinite(value) ? value : null;
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

  const books = [
    ['teamSalary', 'Team Salary'],
    ['apronTeamSalary', 'Apron Team Salary'],
    ['taxSalary', 'Tax Salary'],
  ] as const;
  return orderedTeamCodes
    .flatMap((teamCode) =>
      books.map(([field, book]) => {
        const before = readSalaryBook(beforeTotalsByTeam, teamCode, field);
        const after = readSalaryBook(afterTotalsByTeam, teamCode, field);

        if (before === null || after === null) {
          return null;
        }

        return {
          after,
          before,
          delta: after - before,
          teamCode,
          book,
        };
      })
    )
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
    rawPayloadTitle: rawEntry
      ? 'Attached Local Payload'
      : 'No Raw Payload Attached',
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
  playerMovements = [],
  onNavigateRoom,
  onOpenTradeWithRequest,
  onPlayerAction,
  resolvePlayerLabel,
}: HistoryDetailModalProps) => {
  if (!selectedEntry) return null;

  const { activeTeamCode, entry } = selectedEntry;
  // Committed world events + explicit local-timeline entries can offer the
  // committed-event trade context; DEV fixtures / fallbacks cannot.
  const isCommittedEvent =
    selectedEntry.truthKind === 'authoritative-world-event' ||
    selectedEntry.truthKind === 'explicit-local-timeline';
  const outboundLinks = resolveHistoryOutboundLinks(entry, {
    isCommitted: isCommittedEvent,
  });
  const eventIdForContext =
    (typeof entry.eventId === 'string' && entry.eventId) ||
    (entry.id != null ? String(entry.id) : null);
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
  const resolvedPlayerMovements =
    playerMovements.length > 0
      ? playerMovements
      : Array.isArray(entry.playerMovements)
        ? entry.playerMovements
        : [];
  const movementByPlayerId = new Map(
    resolvedPlayerMovements.map((movement) => [movement.playerId, movement])
  );
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
      capAlignmentRows.find(
        (row) => row.teamCode === activeTeamCode && row.book === 'Team Salary'
      )) ||
    capAlignmentRows.find((row) => row.book === 'Team Salary') ||
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
  // BZE-229 (owner-approved): the raw-identifier and payload-inspection sections
  // are engineer diagnostics, not GM information. They stay behind the existing
  // developer toggle (the same DEV + fixture flag that reveals the fixtures
  // panel), so owners — in review or production — never see raw IDs or JSON.
  const showDeveloperDetail =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_TEAM_HISTORY_FIXTURE_FLAG) === 'true';
  const presentDetailLine = (line: unknown, resolvePlayers = false) => {
    let presentedLine = String(line ?? '');
    if (resolvePlayers) {
      normalizedPlayerIds.forEach((playerId) => {
        const resolvedLabel = resolvePlayerLabel?.(playerId);
        const safeLabel =
          resolvedLabel && resolvedLabel !== playerId
            ? resolvedLabel
            : 'Player';
        presentedLine = replaceCompleteToken(
          presentedLine,
          playerId,
          safeLabel
        );
      });
    }
    normalizedTeamCodes.forEach((teamCode) => {
      const teamName = TEAM_NAME_BY_CODE.get(teamCode.toUpperCase());
      if (teamName) {
        presentedLine = replaceCompleteToken(presentedLine, teamCode, teamName);
      }
    });
    return presentedLine;
  };
  const presentDraftAssetLine = (line: unknown) => {
    const rawLine = String(line ?? '');
    const transferMatch = rawLine.match(/^([A-Z]{2,3}):\s*(?:out|in)\s+(.+)$/i);
    const prefixedTeamCode = transferMatch?.[1];
    const assetIdentity = transferMatch?.[2] || rawLine;
    const deterministicIdentity = assetIdentity.match(
      /^(?:ent|vacuum):([A-Z]{2,3}):(20\d{2}):([12]):(own|swap|conv):/i
    );
    const teamCode =
      normalizedTeamCodes.find(
        (code) => code.toUpperCase() === prefixedTeamCode?.toUpperCase()
      ) ||
      normalizedTeamCodes.find((code) =>
        new RegExp(`(?:^|\\W)${code}(?:\\W|$)`, 'i').test(rawLine)
      );
    const teamName = teamCode
      ? TEAM_NAME_BY_CODE.get(teamCode.toUpperCase()) || teamCode
      : 'Team';
    const assetTeamCode =
      deterministicIdentity?.[1]?.toUpperCase() ||
      assetIdentity
        .split(/[^A-Z0-9]+/i)
        .map((token) => token.toUpperCase())
        .find((token) => TEAM_NAME_BY_CODE.has(token));
    const year =
      deterministicIdentity?.[2] ||
      rawLine.match(/(?:^|[-_:\s])(20\d{2})(?=$|[-_:\s])/)?.[1];
    const round =
      deterministicIdentity?.[3] ||
      rawLine.match(/\b(first|second|1st|2nd|1|2)[-_:\s]*round\b/i)?.[1] ||
      rawLine.match(/(?:^|[-_:\s])R([12])(?=$|[-_:\s])/i)?.[1] ||
      rawLine.match(/(?:^|[-_:\s])(1st|2nd)(?=$|[-_:\s])/i)?.[1];
    const roundLabel = /^(?:first|1st|1)$/i.test(round || '')
      ? 'first-round'
      : /^(?:second|2nd|2)$/i.test(round || '')
        ? 'second-round'
        : null;

    if (!year || !roundLabel) {
      return `${teamName} draft pick included in this move`;
    }
    const entitlementKind = deterministicIdentity?.[4]?.toLowerCase();
    const assetKindLabel =
      entitlementKind === 'swap'
        ? 'swap right'
        : entitlementKind === 'conv'
          ? 'conveyance right'
          : 'pick';
    const assetTeamQualifier =
      assetTeamCode && assetTeamCode !== teamCode?.toUpperCase()
        ? ` · ${TEAM_NAME_BY_CODE.get(assetTeamCode)}`
        : '';
    const pickLabel = `${year} ${roundLabel} ${assetKindLabel}${assetTeamQualifier}`;
    if (/\bout\b/i.test(rawLine)) {
      return `Sent by ${teamName}: ${pickLabel}`;
    }
    if (/\bin\b/i.test(rawLine)) {
      return `Received by ${teamName}: ${pickLabel}`;
    }
    return `${teamName} ${pickLabel}`;
  };
  const presentDraftAssetLines = (lines: unknown[]) => {
    const presentedLines = lines.map(presentDraftAssetLine);
    const identities = lines.map((line) => {
      const rawLine = String(line ?? '');
      return (
        rawLine.match(/^([A-Z]{2,3}):\s*(?:out|in)\s+(.+)$/i)?.[2] || rawLine
      )
        .trim()
        .toLowerCase();
    });
    const identitiesByPresentation = new Map<string, string[]>();

    // A retained deterministic identity may distinguish otherwise identical
    // rights. Bind a stable option number to that identity without exposing it.
    presentedLines.forEach((presentedLine, index) => {
      const variants = identitiesByPresentation.get(presentedLine) || [];
      if (!variants.includes(identities[index])) {
        variants.push(identities[index]);
      }
      identitiesByPresentation.set(presentedLine, variants);
    });

    return presentedLines.map((presentedLine, index) => {
      const variants = [
        ...(identitiesByPresentation.get(presentedLine) || []),
      ].sort();
      if (variants.length < 2) return presentedLine;

      return `${presentedLine} · option ${
        variants.indexOf(identities[index]) + 1
      } of ${variants.length}`;
    });
  };
  const visibleDetailSections = showDeveloperDetail
    ? detailSections
    : detailSections.flatMap((section) => {
        if (/^players?$/i.test(section.title || '')) {
          return onPlayerAction
            ? []
            : [
                {
                  ...section,
                  lines: (section.lines || []).map((line) =>
                    presentDetailLine(line, true)
                  ),
                },
              ];
        }
        if (/^picks?$/i.test(section.title || '')) {
          return [
            {
              ...section,
              title: 'Draft picks',
              lines: presentDraftAssetLines(section.lines || []),
            },
          ];
        }
        if (/cash consideration receipt/i.test(section.title || '')) {
          const cashLines = (section.lines || [])
            .filter((line) => /\b(?:paid|received)\b/i.test(String(line)))
            .map((line) => presentDetailLine(line));
          return cashLines.length > 0
            ? [{ ...section, title: 'Cash', lines: cashLines }]
            : [];
        }
        if (TECHNICAL_DETAIL_SECTIONS.test(section.title || '')) {
          return [];
        }
        return [
          {
            ...section,
            lines: (section.lines || []).map((line) => presentDetailLine(line)),
          },
        ];
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-cockpit-void/80 p-4">
      <div
        data-testid="team-history-detail-modal"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-cockpit-edge bg-cockpit-slab p-4 text-cockpit-text-primary shadow-cockpit-slab"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Saved Move Details</h3>
            <p
              data-testid="team-history-detail-summary"
              className="text-sm text-cockpit-text-secondary"
            >
              {entry.summary || EMPTY_VALUE}
            </p>
          </div>
          <button
            type="button"
            data-testid="team-history-detail-close"
            onClick={onClose}
            className="rounded-md border border-cockpit-edge px-2 py-1 text-xs hover:bg-cockpit-raised"
          >
            Close
          </button>
        </div>

        {showDeveloperDetail && (
          <div
            data-testid="team-history-detail-truth-note"
            className="mb-4 rounded-md border border-cockpit-info/20 bg-cockpit-info/5 px-3 py-2 text-xs text-cockpit-info"
          >
            <div className="font-semibold uppercase tracking-[0.08em]">
              {truthContract.label}
            </div>
            <div className="mt-1 text-[11px]">{truthContract.description}</div>
          </div>
        )}

        {(onNavigateRoom || onOpenTradeWithRequest) &&
        outboundLinks.length > 0 ? (
          <div
            className="mb-4"
            data-testid="team-history-detail-outbound-links"
          >
            <div className="mb-1 text-[11px] uppercase tracking-wide text-cockpit-text-muted">
              Continue from this saved move
            </div>
            <div className="flex flex-wrap gap-1.5">
              {outboundLinks.map((link) => {
                if (link.kind === 'unavailable') {
                  return (
                    <span
                      key={link.id}
                      className="rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[11px] text-cockpit-text-muted"
                      title={link.unavailableReason}
                      data-testid={`team-history-outbound-${link.id}`}
                    >
                      {link.unavailableReason}
                    </span>
                  );
                }
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => {
                      if (link.kind === 'trade-context' && link.tradeRequest) {
                        onOpenTradeWithRequest?.(link.tradeRequest);
                        onClose();
                        return;
                      }
                      if (link.kind === 'nav' && link.room) {
                        onNavigateRoom?.(link.room);
                        onClose();
                      }
                    }}
                    className="rounded-md border border-cockpit-edge bg-cockpit-raised px-2 py-1 text-[11px] text-cockpit-text-secondary hover:bg-cockpit-edge hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    data-testid={`team-history-outbound-${link.id}`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {onPlayerAction && normalizedPlayerIds.length > 0 ? (
          <div className="mb-4" data-testid="team-history-detail-player-menus">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-cockpit-text-muted">
              Players
            </div>
            <ul className="flex flex-col gap-1">
              {normalizedPlayerIds.map((playerId) => {
                const resolvedLabel = resolvePlayerLabel?.(playerId);
                const hasResolvedLabel = Boolean(
                  resolvedLabel && resolvedLabel !== playerId
                );
                const label = hasResolvedLabel
                  ? resolvedLabel
                  : 'Player details unavailable';
                const movement = movementByPlayerId.get(playerId);
                const context = hasResolvedLabel
                  ? buildPlayerActionContext({
                      player: { id: playerId },
                      playerLabel: label,
                      sourceRoom: 'history',
                      eventId: eventIdForContext,
                    })
                  : null;
                return (
                  <li
                    key={playerId}
                    className="flex items-center gap-1.5 rounded-md border border-cockpit-edge bg-cockpit-inlay px-2 py-1"
                    data-testid={`team-history-player-${playerId}`}
                  >
                    <span className="min-w-0 flex-1 text-xs text-cockpit-text-primary">
                      <span className="block truncate">{label}</span>
                      {movement ? (
                        <span
                          className="mt-0.5 block truncate text-[11px] text-cockpit-text-muted"
                          data-testid={`team-history-player-${playerId}-direction`}
                        >
                          Sent by {formatTeamName(movement.sourceTeamCode)} ·
                          Received by{' '}
                          {formatTeamName(movement.destinationTeamCode)}
                        </span>
                      ) : null}
                    </span>
                    {context ? (
                      <PlayerActionMenu
                        context={context}
                        visibleActions={[]}
                        overflowActions={[
                          'view-on-roster',
                          'view-on-cap',
                          'view-in-full-cap',
                          'compare-impact',
                          'guide-next-move',
                        ]}
                        menuAlign="left"
                        testIdPrefix={`team-history-player-${playerId}-actions`}
                        onAction={(action, ctx) => {
                          onPlayerAction(action, ctx);
                          onClose();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-label="Player actions unavailable until player details can be resolved"
                        title="Player actions unavailable until player details can be resolved"
                        className="flex h-5 w-5 shrink-0 cursor-not-allowed items-center justify-center rounded text-cockpit-text-muted opacity-50"
                        data-testid={`team-history-player-${playerId}-actions-overflow`}
                      >
                        <span aria-hidden className="text-sm leading-none">
                          ⋯
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-cockpit-text-muted">
              Move
            </div>
            <div data-testid="team-history-detail-type" className="font-medium">
              {formatMoveType(entry.type || entry.category)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-cockpit-text-muted">
              {selectedEntry.truthKind === 'authoritative-world-event'
                ? 'Saved on'
                : 'Date'}
            </div>
            <div
              data-testid="team-history-detail-timestamp"
              className="font-medium"
            >
              {formatHistoryDate(entry.timestamp || entry.occurredAt)}
            </div>
          </div>
          {showDeveloperDetail && (
            <div>
              <div className="text-xs uppercase text-cockpit-text-muted">
                Raw Payload Type
              </div>
              <div
                data-testid="team-history-detail-raw-type"
                className="font-medium"
              >
                {getDisplayText(rawEntry?.type)}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase text-cockpit-text-muted">
              Teams
            </div>
            <div
              data-testid="team-history-detail-teams"
              className="font-medium"
            >
              {formatTeams(normalizedTeamsInvolved)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-cockpit-text-muted">
              Cap Delta
            </div>
            <div className="font-medium">
              {formatNumberDelta(entry.capDelta)}
            </div>
          </div>
          {showDeveloperDetail && (
            <div className="md:col-span-2 space-y-3 rounded-md border border-cockpit-edge bg-cockpit-inlay p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
                    Mutation Type
                  </div>
                  <div data-testid="team-history-detail-mutation-type">
                    {getDisplayText(entry.mutationType)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
                    Team Codes
                  </div>
                  <div data-testid="team-history-detail-team-codes">
                    {formatList(normalizedTeamCodes)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
                    Player IDs
                  </div>
                  <div data-testid="team-history-detail-player-ids">
                    {formatList(normalizedPlayerIds)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-cockpit-text-muted">
                  Normalized deltas
                </div>
                <div data-testid="team-history-detail-deltas">
                  {entry.primaryDeltas || EMPTY_VALUE}
                </div>
              </div>
              <div className="text-xs uppercase text-cockpit-text-muted">
                Identity
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
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
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
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
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
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
                  <div className="text-[11px] uppercase text-cockpit-text-muted">
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
              <div className="mt-2 text-[11px] text-cockpit-text-muted">
                Selected row identity is shown exactly as carried on the Team
                History entry. The modal does not coalesce these IDs into one
                fallback identifier.
              </div>
            </div>
          )}
          {visibleDetailSections.length > 0 && (
            <div
              className="md:col-span-2 space-y-3"
              data-testid="team-history-detail-sections"
            >
              {visibleDetailSections.map((section, index) => (
                <div
                  key={`${section.title}-${index}`}
                  className="rounded-md border border-cockpit-edge bg-cockpit-inlay p-2"
                >
                  <div className="text-xs uppercase text-cockpit-text-muted">
                    {section.title}
                  </div>
                  <ul className="mt-1 space-y-1 text-sm text-cockpit-text-primary">
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
          {showDeveloperDetail && (
            <>
              <div
                data-testid="team-history-detail-cap-alignment"
                className="md:col-span-2 rounded-md border border-cockpit-edge bg-cockpit-inlay p-3"
              >
                <div className="text-xs uppercase text-cockpit-text-muted">
                  Cap Delta Alignment
                </div>
                <div className="mt-1 text-sm text-cockpit-text-secondary">
                  {capAlignmentStatus}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-cockpit-text-primary">
                  {capAlignmentRows.map((row) => (
                    <li key={`${row.teamCode}:${row.book}`}>
                      • {row.teamCode} {row.book}: {formatCurrency(row.before)}{' '}
                      -&gt; {formatCurrency(row.after)} (
                      {formatNumberDelta(row.delta)})
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase text-cockpit-text-muted">
                  Before Totals By Team
                </div>
                <pre
                  data-testid="team-history-detail-before-totals"
                  className="mt-1 max-h-40 overflow-auto rounded-md bg-cockpit-void p-2 text-xs text-cockpit-text-secondary"
                >
                  {stringifySafe(beforeTotalsByTeam)}
                </pre>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase text-cockpit-text-muted">
                  After Totals By Team
                </div>
                <pre
                  data-testid="team-history-detail-after-totals"
                  className="mt-1 max-h-40 overflow-auto rounded-md bg-cockpit-void p-2 text-xs text-cockpit-text-secondary"
                >
                  {stringifySafe(afterTotalsByTeam)}
                </pre>
              </div>
              <div className="md:col-span-2 rounded-md border border-cockpit-edge bg-cockpit-inlay p-3">
                <div className="text-xs uppercase text-cockpit-text-muted">
                  {truthContract.rawPayloadTitle}
                </div>
                <div className="mt-1 text-[11px] text-cockpit-text-muted">
                  {truthContract.rawPayloadDescription}
                </div>
                <ul
                  data-testid="team-history-detail-raw-summary"
                  className="mt-2 space-y-1 text-sm text-cockpit-text-primary"
                >
                  {rawPayloadSummaryLines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase text-cockpit-text-muted">
                  Raw Event Payload
                </div>
                <pre
                  data-testid="team-history-raw-payload"
                  className="mt-1 max-h-56 overflow-auto rounded-md bg-cockpit-void p-2 text-xs text-cockpit-text-secondary"
                >
                  {stringifySafe(rawEntry)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
