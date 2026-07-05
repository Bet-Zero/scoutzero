/**
 * FILE: src/features/architect/cockpit/AssetsPanel.tsx
 * PURPOSE: Expanded team-assets panel for the Team Plan Hub. The rail shows
 *          asset counts only; this modal carries the detail — draft-pick
 *          stash by year, exception availability, and roster spots.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Read-only. Layering contract (BZE-211 owner direction): the default drawer
 * is an overview; every "list all of it" view lives in an expanded panel.
 */
import { useEffect } from 'react';
import type {
  ArchitectWorkspaceDraftAssetsSummary,
  ArchitectWorkspaceDraftPickView,
  ArchitectWorkspaceExceptionsSummary,
  ArchitectWorkspaceRosterSummary,
} from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { formatMoney } from './TeamStatusStrip';

interface AssetsPanelProps {
  open: boolean;
  onClose: () => void;
  teamLabel: string;
  planLabel: string;
  draftAssets: ArchitectWorkspaceDraftAssetsSummary;
  exceptions: ArchitectWorkspaceExceptionsSummary;
  roster: ArchitectWorkspaceRosterSummary;
  /** Opens Team History (full pick log lives there); the panel closes itself. */
  onOpenHistory: () => void;
}

/** One draft pick as a plain GM phrase: "Own", "via BOS (Top-10)", "Own · swap". */
export const formatDraftPickPhrase = (
  pick: ArchitectWorkspaceDraftPickView
): string => {
  let phrase = pick.sourceLabel;
  if (pick.protectionLabel) phrase += ` (${pick.protectionLabel})`;
  if (pick.isSwap) phrase += ' · swap';
  return phrase;
};

const formatRoundLine = (picks: ArchitectWorkspaceDraftPickView[]): string =>
  picks.map(formatDraftPickPhrase).join(', ');

const PanelSection = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
      {label}
    </h3>
    {children}
  </section>
);

const DraftPicksSection = ({
  draftAssets,
}: {
  draftAssets: ArchitectWorkspaceDraftAssetsSummary;
}) => (
  <PanelSection label="Draft Picks">
    {draftAssets.status === 'available' ? (
      draftAssets.years.length === 0 ? (
        <p className="text-xs text-cockpit-text-muted">
          No draft picks currently held.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {draftAssets.years.map((group) => (
            <li
              key={group.year}
              className="rounded border border-cockpit-edge bg-cockpit-slab px-3 py-2"
              data-testid={`cockpit-assets-panel-picks-${group.year}`}
            >
              <div className="text-[12px] font-semibold text-cockpit-text-primary">
                {group.year}
              </div>
              <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] leading-4 text-cockpit-text-secondary">
                {group.firstRound.length > 0 ? (
                  <div
                    data-testid={`cockpit-assets-panel-picks-${group.year}-first`}
                  >
                    <span className="text-cockpit-text-muted">1st: </span>
                    {formatRoundLine(group.firstRound)}
                  </div>
                ) : null}
                {group.secondRound.length > 0 ? (
                  <div
                    data-testid={`cockpit-assets-panel-picks-${group.year}-second`}
                  >
                    <span className="text-cockpit-text-muted">2nd: </span>
                    {formatRoundLine(group.secondRound)}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )
    ) : draftAssets.status === 'loading' ? (
      <p className="text-xs text-cockpit-text-muted">
        Draft picks are loading.
      </p>
    ) : (
      <p className="text-xs text-cockpit-text-muted">{draftAssets.reason}</p>
    )}
    {draftAssets.status === 'available' && draftAssets.outgoing.length > 0 ? (
      <div data-testid="cockpit-assets-panel-outgoing">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
          Owed to other teams
        </div>
        <ul className="flex flex-col gap-1 text-[11px] text-cockpit-text-secondary">
          {draftAssets.outgoing.map((pick) => (
            <li
              key={pick.key}
              className="rounded border border-cockpit-edge bg-cockpit-slab px-3 py-1.5"
              data-testid={`cockpit-assets-panel-outgoing-${pick.key}`}
            >
              {pick.year} {pick.round === 1 ? '1st' : '2nd'} —{' '}
              {formatDraftPickPhrase(pick)}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </PanelSection>
);

const ExceptionsSection = ({
  exceptions,
}: {
  exceptions: ArchitectWorkspaceExceptionsSummary;
}) => {
  const exceptionLines: string[] = [];
  if (exceptions.status === 'available') {
    if (exceptions.hasAvailableMle) {
      exceptionLines.push('Mid-Level Exception available');
    }
    if (exceptions.hasAvailableBae) {
      exceptionLines.push('Bi-Annual Exception available');
    }
    if (exceptions.hasAvailableRoom) {
      exceptionLines.push('Room Exception available');
    }
    exceptions.tpeRemainingAmounts.forEach((amount) => {
      exceptionLines.push(`Trade exception — ${formatMoney(amount)} remaining`);
    });
    const unpricedTpes =
      exceptions.tpeCount - exceptions.tpeRemainingAmounts.length;
    if (unpricedTpes > 0) {
      exceptionLines.push(
        `${unpricedTpes} trade exception${unpricedTpes > 1 ? 's' : ''}`
      );
    }
  }

  return (
    <PanelSection label="Exceptions">
      {exceptions.status === 'available' ? (
        exceptionLines.length > 0 ? (
          <ul className="flex flex-col gap-1 text-[11px] text-cockpit-text-secondary">
            {exceptionLines.map((line) => (
              <li
                key={line}
                className="rounded border border-cockpit-edge bg-cockpit-slab px-3 py-1.5"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-cockpit-text-muted">
            No exceptions available right now.
          </p>
        )
      ) : (
        <p className="text-xs text-cockpit-text-muted">
          Exception details live on the Cap Sheet.
        </p>
      )}
    </PanelSection>
  );
};

const RosterSpotsSection = ({
  roster,
}: {
  roster: ArchitectWorkspaceRosterSummary;
}) => (
  <PanelSection label="Roster Spots">
    {roster.status === 'available' && roster.standardCount !== null ? (
      <p className="text-[11px] text-cockpit-text-secondary">
        {roster.standardCount} of 15 standard spots filled
        {roster.twoWayCount !== null
          ? ` · ${roster.twoWayCount} of 3 two-way spots filled`
          : ''}
        .
      </p>
    ) : roster.status === 'available' ? (
      <p className="text-[11px] text-cockpit-text-secondary">
        {roster.count} players on the roster.
      </p>
    ) : (
      <p className="text-xs text-cockpit-text-muted">
        Roster count unavailable.
      </p>
    )}
  </PanelSection>
);

export const AssetsPanel = ({
  open,
  onClose,
  teamLabel,
  planLabel,
  draftAssets,
  exceptions,
  roster,
  onOpenHistory,
}: AssetsPanelProps) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      data-testid="cockpit-assets-panel"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close team assets"
        onClick={onClose}
        data-testid="cockpit-assets-panel-backdrop"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Team assets"
        className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-bar shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-cockpit-edge px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-cockpit-text-primary">
              Team Assets
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-cockpit-text-secondary">
              {teamLabel} · {planLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[11px] text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="cockpit-assets-panel-close"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <DraftPicksSection draftAssets={draftAssets} />
          <ExceptionsSection exceptions={exceptions} />
          <RosterSpotsSection roster={roster} />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-cockpit-edge px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHistory();
            }}
            className="rounded border border-cockpit-edge bg-cockpit-inlay px-3 py-1.5 text-[11px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            data-testid="cockpit-assets-panel-history"
          >
            View pick history
          </button>
        </div>
      </div>
    </div>
  );
};
