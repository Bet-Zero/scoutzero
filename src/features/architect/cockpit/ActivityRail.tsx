/**
 * FILE: src/features/architect/cockpit/ActivityRail.tsx
 * PURPOSE: Right-side persistent rail in the Architect cockpit. Embeds the
 *          existing post-action receipt + scenario activity stream, and adds
 *          a thin read-only watchlist derived from workspace context.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - No new state engines. Receipt source is the existing
 *    `ArchitectPostActionHandoff` (single current receipt). World events
 *    use the existing `ScenarioMoveRail` unchanged.
 *  - Watchlist is a thin presentational re-render of workspace-context
 *    warning flags (apron posture, exception availability, season
 *    mismatch). No new rules engine.
 *  - Collapse persisted to localStorage.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { ArchitectPostActionHandoff } from '@/features/architect/GMDashboard/components/ArchitectPostActionHandoff';
import { ScenarioMoveRail } from '@/features/architect/GMDashboard/components/ScenarioMoveRail';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { type HardCapCockpitStatus } from './TeamStatusStrip';
import {
  getAuthorityLabel,
  AUTHORITY_TONE_BADGE_CLASSES,
  type AuthorityLabelInput,
} from './authorityLabel';
import {
  deriveReceiptImpactPanel,
  deriveTeamPlanTruthPanel,
  isHardCapActiveForViewingSeason,
  type TrustPanelTone,
} from './teamPlanTrustPanelModel';
import { PlayerActionMenu } from './PlayerActionMenu';
import type { PlayerAction, PlayerActionContext } from './playerActionContext';
import type { TradeObjective } from './tradeOpenRequest';

export interface PinnedPlayer {
  id: string;
  label: string;
  /** FA-target subtype (open-question #1): pinned from Free Agency as a target. */
  isTarget?: boolean;
}

interface ActivityRailProps {
  workspace: ArchitectWorkspaceContext;
  hardCapStatus?: HardCapCockpitStatus;
  receipt: ArchitectPostActionReceipt | null;
  receiptGeneration: number;
  worldId: string | null;
  historyTeamCode: string;
  onNavigateToCapSheet: () => void;
  onNavigateToRoster: () => void;
  onNavigateToOffseason: () => void;
  onOpenHistory: () => void;
  onOpenHistoryEntry: (eventId: string) => void;
  onNavigateReceiptHistory: () => void;
  onDismissReceipt: () => void;
  /** Intentionally pinned players surfaced as a board section. */
  pinnedPlayers?: PinnedPlayer[];
  onUnpinPlayer?: (playerId: string) => void;
  onOpenPinnedPlayer?: (playerId: string) => void;
  onTradePinnedPlayer?: (playerId: string) => void;
  onTradeAllPinned?: () => void;
  /**
   * Unified player-action sink (Slice 2e). When provided, pinned rows route
   * Trade/Unpin and cross-room navigation through it; falls back to the
   * per-pin callbacks above when absent.
   */
  onPlayerAction?: (action: PlayerAction, context: PlayerActionContext) => void;
  /** Resolve a committed-receipt player id to a display label (visual only). */
  resolvePlayerLabel?: (playerId: string) => string;
  tradeDraftActive?: boolean;
  /** Reopen the Trade Machine overlay from the in-progress draft card. */
  onResumeTradeDraft?: () => void;
  onNavigateToCompare?: () => void;
  onNavigateToGuide?: () => void;
  /** Open the Trade Machine with a cap/apron objective from a watchlist warning. */
  onOpenTradeForObjective?: (objective: TradeObjective) => void;
  /** Open the Guide with a cap/apron objective from a watchlist warning. */
  onOpenGuideForObjective?: (objective: TradeObjective) => void;
  /** Open the Trade Machine from a trade-related committed receipt. */
  onOpenTradeFromReceipt?: () => void;
}

export interface ActivityRailHandle {
  expand: () => void;
}

const COLLAPSE_KEY = 'architect.activityRail.collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/** Where a watch entry routes. The rail never mutates — these are navigation
 *  destinations resolved to existing room handlers at render time. */
type WatchDestination = 'cap-sheet' | 'offseason';

interface WatchEntry {
  id: string;
  tone: 'info' | 'watch' | 'danger';
  text: string;
  /** Destination action (contract: "Do not warn without a useful destination."). */
  destination: WatchDestination;
  /** Optional authority chip (e.g. season mismatch) routed through `authorityLabel`. */
  authority?: AuthorityLabelInput;
  /** Optional Trade Machine objective so a cap/apron warning can open Trade. */
  tradeObjective?: TradeObjective;
}

function deriveWatchEntries(
  workspace: ArchitectWorkspaceContext,
  hardCapStatus?: HardCapCockpitStatus
): WatchEntry[] {
  const entries: WatchEntry[] = [];

  const cap = workspace.cap;
  if (isHardCapActiveForViewingSeason(workspace, hardCapStatus)) {
    entries.push({
      id: 'hard-cap',
      tone: 'danger',
      text: hardCapStatus?.hardCapCeilingLabel
        ? `Hard capped at ${hardCapStatus.hardCapCeilingLabel}${
            hardCapStatus.reason ? ` — ${hardCapStatus.reason}` : ''
          }.`
        : `Hard capped${
            hardCapStatus?.reason ? ` — ${hardCapStatus.reason}` : ''
          }.`,
      destination: 'cap-sheet',
      tradeObjective:
        hardCapStatus?.hardCapCeilingType === 'FIRST_APRON'
          ? 'clear-first-apron'
          : 'clear-second-apron',
    });
  }

  if (cap.status === 'available') {
    if (cap.isAboveSecondApron) {
      entries.push({
        id: 'apron2',
        tone: 'danger',
        text: 'Above 2nd Apron — hard-cap restrictions active.',
        destination: 'cap-sheet',
        tradeObjective: 'clear-second-apron',
      });
    } else if (cap.isAtOrAboveFirstApron) {
      entries.push({
        id: 'apron1',
        tone: 'danger',
        text: 'At or above 1st Apron — exception use restricted.',
        destination: 'cap-sheet',
        tradeObjective: 'clear-first-apron',
      });
    } else if (cap.isOverTax) {
      entries.push({
        id: 'tax',
        tone: 'watch',
        text: 'Over the luxury tax line.',
        destination: 'cap-sheet',
        tradeObjective: 'reduce-tax',
      });
    } else if (cap.isOverCap) {
      entries.push({
        id: 'cap',
        tone: 'watch',
        text: 'Over the salary cap.',
        destination: 'cap-sheet',
        tradeObjective: 'solve-cap',
      });
    }
  }

  const exc = workspace.exceptions;
  if (exc.status === 'available' && !exc.hasAnyActive) {
    entries.push({
      id: 'exceptions',
      tone: 'info',
      text: 'No active exceptions (MLE / BAE / TPE / Room).',
      destination: 'cap-sheet',
    });
  }

  const seasons = workspace.seasons;
  if (seasons.viewingSeasonDiffersFromWorldSeason) {
    entries.push({
      id: 'season-mismatch',
      tone: 'info',
      text: `Viewing ${seasons.selectedViewingSeasonLabel ?? '—'} — world is at ${seasons.authoritativeWorldSeasonLabel ?? '—'}.`,
      destination: 'offseason',
      authority: { seasonMismatch: true },
    });
  }

  return entries;
}

const TONE_CLASSES: Record<WatchEntry['tone'], string> = {
  info: 'border-cockpit-info/30 bg-cockpit-info/5 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/5 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/5 text-cockpit-danger',
};

const TRUST_TONE_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'border-cockpit-safe/30 bg-cockpit-safe/5 text-cockpit-safe',
  info: 'border-cockpit-info/30 bg-cockpit-info/5 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/5 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/5 text-cockpit-danger',
  muted: 'border-cockpit-edge bg-cockpit-inlay text-cockpit-text-muted',
};

const TRUST_BADGE_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'border-cockpit-safe/30 bg-cockpit-safe/10 text-cockpit-safe',
  info: 'border-cockpit-info/30 bg-cockpit-info/10 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/10 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/10 text-cockpit-danger',
  muted: 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-muted',
};

const WATCH_DESTINATION_LABELS: Record<WatchDestination, string> = {
  'cap-sheet': 'View Cap Sheet',
  offseason: 'Go to Offseason',
};

/**
 * Small authority/mode badge. The single rail-level renderer for the
 * shared `authorityLabel` vocabulary so labels/tones never get re-spelled
 * inline (master spec §4.1).
 */
const AuthorityChip = ({
  authority,
  testId,
}: {
  authority: AuthorityLabelInput;
  testId?: string;
}) => {
  const { label, tone } = getAuthorityLabel(authority);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1 text-[9px] font-semibold uppercase tracking-wide leading-4 ${AUTHORITY_TONE_BADGE_CLASSES[tone]}`}
      data-testid={testId}
      data-authority-tone={tone}
    >
      {label}
    </span>
  );
};

const RailSection = ({
  label,
  children,
  testId,
  action,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  action?: ReactNode;
}) => (
  <section
    className="flex flex-col border-b border-cockpit-edge px-3 py-3 last:border-b-0"
    data-testid={testId}
  >
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
        {label}
      </h3>
      {action}
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </section>
);

const TrustBadge = ({
  tone,
  children,
  testId,
}: {
  tone: TrustPanelTone;
  children: ReactNode;
  testId?: string;
}) => (
  <span
    className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide leading-4 ${TRUST_BADGE_CLASSES[tone]}`}
    data-testid={testId}
  >
    {children}
  </span>
);

export const ActivityRail = forwardRef<ActivityRailHandle, ActivityRailProps>(
  function ActivityRail(
    {
      workspace,
      hardCapStatus = null,
      receipt,
      receiptGeneration,
      worldId,
      historyTeamCode,
      onNavigateToCapSheet,
      onNavigateToRoster,
      onNavigateToOffseason,
      onOpenHistory,
      onOpenHistoryEntry,
      onNavigateReceiptHistory,
      onDismissReceipt,
      pinnedPlayers = [],
      onUnpinPlayer,
      onOpenPinnedPlayer,
      onTradePinnedPlayer,
      onTradeAllPinned,
      onPlayerAction,
      resolvePlayerLabel,
      tradeDraftActive = false,
      onResumeTradeDraft,
      onNavigateToCompare,
      onNavigateToGuide,
      onOpenTradeForObjective,
      onOpenGuideForObjective,
      onOpenTradeFromReceipt,
    },
    ref
  ) {
    const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());

    useEffect(() => {
      writeCollapsed(collapsed);
    }, [collapsed]);

    useImperativeHandle(ref, () => ({ expand: () => setCollapsed(false) }), []);

    const planTruth = deriveTeamPlanTruthPanel(workspace.saveState);
    const receiptImpact = deriveReceiptImpactPanel(receipt);
    const receiptHasCommittedEvidence =
      receipt?.authority === 'committed-world';
    const watch = deriveWatchEntries(workspace, hardCapStatus);
    const hasWatchDanger = watch.some((entry) => entry.tone === 'danger');
    const hasPlanTruthDanger = planTruth.tone === 'danger';
    const hasPlanTruthWatch = planTruth.tone === 'watch';

    // Section order is the contract's canonical order (Cap Posture → Current
    // Receipt → Pinned → In Progress → Watchlist → Scenario Activity). The
    // expanded rail scrolls (overflow-y-auto) rather than dropping sections, so
    // no section is ever permanently hidden under height pressure. The contract's
    // Section Priority Rules (critical/pending → Receipt → In Progress →
    // Watchlist danger → Pinned → Cap Posture → Scenario Activity → Next Steps)
    // are honored in collapsed state: the indicator dots below surface receipt,
    // watchlist-danger, and in-progress so a danger/critical state is never
    // buried behind a lower-priority dot.
    //
    // "Next Steps" is intentionally folded (open-question #5): the Current
    // Receipt carries Compare/Guide buttons and Watchlist entries carry their
    // own destination actions. No standalone Next Steps section in v1.

    if (collapsed) {
      return (
        <aside
          className="flex h-full w-12 shrink-0 flex-col items-center border-l border-cockpit-edge bg-cockpit-bar py-2"
          aria-label="Architect activity rail (collapsed)"
          data-testid="cockpit-activity-rail"
          data-collapsed="true"
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand activity rail"
            title="Expand activity rail"
            className="rounded p-1 text-cockpit-text-muted hover:bg-cockpit-raised hover:text-cockpit-text-primary"
            data-testid="cockpit-activity-rail-expand"
          >
            <span aria-hidden>«</span>
          </button>
          {/* Collapsed indicators: each severe state gets its own dot so a
              danger is never hidden behind a lower-priority dot (contract:
              "Do not make collapsed indicators ambiguous if multiple severe
              states exist"). */}
          {hasWatchDanger || hasPlanTruthDanger ? (
            <span
              className="mt-3 h-2 w-2 rounded-full bg-cockpit-danger"
              aria-label="Attention needed"
              title="Attention needed"
              data-testid="cockpit-activity-rail-dot-danger"
            />
          ) : null}
          {hasPlanTruthWatch ? (
            <span
              className="mt-3 h-2 w-2 rounded-full bg-cockpit-watch"
              aria-label="Team Plan save or draft state needs review"
              title="Team Plan save or draft state needs review"
              data-testid="cockpit-activity-rail-dot-plan-truth"
            />
          ) : null}
          {receipt ? (
            <span
              className="mt-3 h-2 w-2 rounded-full bg-cockpit-safe"
              aria-label="New receipt available"
              title="New receipt available"
              data-testid="cockpit-activity-rail-dot-receipt"
            />
          ) : null}
          {tradeDraftActive ? (
            <span
              className="mt-3 h-2 w-2 rounded-full bg-cockpit-watch"
              aria-label="Trade draft in progress"
              title="Trade draft in progress"
              data-testid="cockpit-activity-rail-dot-in-progress"
            />
          ) : null}
        </aside>
      );
    }

    return (
      <aside
        className="flex h-full w-[280px] shrink-0 flex-col border-l border-cockpit-edge bg-cockpit-bar"
        aria-label="Architect activity rail"
        data-testid="cockpit-activity-rail"
        data-collapsed="false"
      >
        <div
          className="flex shrink-0 items-center justify-between border-b border-cockpit-edge px-3"
          style={{ height: 56 }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
            Team Plan
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse activity rail"
            title="Collapse activity rail"
            className="rounded p-1 text-cockpit-text-muted hover:bg-cockpit-raised hover:text-cockpit-text-primary"
            data-testid="cockpit-activity-rail-collapse"
          >
            <span aria-hidden>»</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <RailSection
            label="Plan Truth"
            testId="cockpit-activity-rail-plan-truth"
          >
            <div
              className={`rounded border px-2 py-2 text-[11px] ${TRUST_TONE_CLASSES[planTruth.tone]}`}
              data-testid="cockpit-activity-rail-plan-truth-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="font-semibold text-cockpit-text-primary"
                    data-testid="cockpit-activity-rail-plan-truth-status"
                  >
                    {planTruth.statusLabel}
                  </div>
                  <div
                    className="mt-0.5 text-cockpit-text-secondary"
                    data-testid="cockpit-activity-rail-plan-truth-detail"
                  >
                    {planTruth.detail}
                  </div>
                </div>
                <TrustBadge tone={planTruth.tone}>
                  {workspace.saveState.label}
                </TrustBadge>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] text-cockpit-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cockpit-text-muted">Mode</span>
                  <span
                    className="truncate text-right"
                    data-testid="cockpit-activity-rail-plan-truth-mode"
                  >
                    {planTruth.modeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cockpit-text-muted">Switching</span>
                  <span
                    className="truncate text-right"
                    data-testid="cockpit-activity-rail-plan-truth-switching"
                  >
                    {planTruth.switchSafetyLabel}
                  </span>
                </div>
                {planTruth.lastSavedLabel ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-cockpit-text-muted">Last saved</span>
                    <span
                      className="truncate text-right"
                      data-testid="cockpit-activity-rail-plan-truth-last-saved"
                    >
                      {planTruth.lastSavedLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            {planTruth.warnings.length > 0 ? (
              <ul
                className="flex flex-col gap-1"
                data-testid="cockpit-activity-rail-plan-truth-warnings"
              >
                {planTruth.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1 text-[10px] leading-4 text-cockpit-watch"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] leading-4 text-cockpit-text-muted">
                No staged, failed, or saving work flagged by the Team Plan guard.
              </p>
            )}
          </RailSection>

          {/* Cap posture moved OUT of the activity rail into the permanent,
              always-on TeamPosturePanel (cockpit shell). The rail is for
              on-demand records/moves only — never staple, must-see info. */}
          <RailSection
            label="Recent Move Impact"
            testId="cockpit-activity-rail-receipts"
          >
            {receipt ? (
              <>
                <ArchitectPostActionHandoff
                  receipt={receipt}
                  onNavigateToCapSheet={onNavigateToCapSheet}
                  onNavigateToRoster={onNavigateToRoster}
                  onNavigateToHistory={onNavigateReceiptHistory}
                  onDismiss={onDismissReceipt}
                />
                {onNavigateToCompare ||
                onNavigateToGuide ||
                (onOpenTradeFromReceipt && receipt.kind === 'trade') ? (
                  <div
                    className="flex flex-wrap gap-1.5"
                    data-testid="cockpit-activity-rail-post-action-links"
                  >
                    {onNavigateToCompare && receiptHasCommittedEvidence ? (
                      <button
                        type="button"
                        onClick={onNavigateToCompare}
                        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        data-testid="cockpit-activity-rail-compare"
                      >
                        Compare move
                      </button>
                    ) : onNavigateToCompare ? (
                      <span
                        className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1 text-[10px] text-cockpit-watch"
                        data-testid="cockpit-activity-rail-compare-unavailable"
                        title="Compare is available after a saved Team Plan action."
                      >
                        Compare unavailable for local receipt
                      </span>
                    ) : null}
                    {onNavigateToGuide ? (
                      <button
                        type="button"
                        onClick={onNavigateToGuide}
                        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        data-testid="cockpit-activity-rail-guide"
                      >
                        Guide next steps
                      </button>
                    ) : null}
                    {onOpenTradeFromReceipt && receipt.kind === 'trade' ? (
                      <button
                        type="button"
                        onClick={onOpenTradeFromReceipt}
                        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        data-testid="cockpit-activity-rail-receipt-open-trade"
                      >
                        Open Trade Machine
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onPlayerAction && receipt.primaryPlayerIds.length > 0 ? (
                  <ul
                    className="flex flex-col gap-1"
                    data-testid="cockpit-activity-rail-receipt-players"
                  >
                    {receipt.primaryPlayerIds.map((playerId) => {
                      const label = resolvePlayerLabel?.(playerId) ?? playerId;
                      // Receipt rows route to inspection surfaces only — never
                      // auto-pin (contract). History/compare actions are only
                      // offered when the receipt represents a saved Team Plan
                      // action; local receipts are current-state only.
                      const receiptContext: PlayerActionContext = {
                        playerId,
                        playerLabel: label,
                        sourceRoom: 'receipt',
                        eventId: receipt.eventId,
                      };
                      return (
                        <li
                          key={playerId}
                          className="flex items-center gap-1.5 rounded border border-cockpit-edge bg-cockpit-slab px-2 py-1"
                          data-testid={`cockpit-activity-rail-receipt-player-${playerId}`}
                        >
                          <span
                            className="min-w-0 flex-1 truncate text-[11px] font-medium text-cockpit-text-primary"
                            title={label}
                          >
                            {label}
                          </span>
                          <PlayerActionMenu
                            context={receiptContext}
                            visibleActions={[]}
                            overflowActions={
                              receiptHasCommittedEvidence
                                ? [
                                    'view-on-roster',
                                    'view-on-cap',
                                    'find-in-history',
                                    'compare-impact',
                                    'guide-next-move',
                                  ]
                                : [
                                    'view-on-roster',
                                    'view-on-cap',
                                    'guide-next-move',
                                  ]
                            }
                            testIdPrefix={`cockpit-activity-rail-receipt-player-${playerId}-actions`}
                            onAction={onPlayerAction}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {receiptImpact.rows.length > 0 ? (
                  <div
                    className="flex flex-col gap-1"
                    data-testid="cockpit-activity-rail-move-impact"
                  >
                    {receiptImpact.rows.map((row) => (
                      <div
                        key={row.id}
                        className={`rounded border px-2 py-1.5 text-[11px] ${TRUST_TONE_CLASSES[row.tone]}`}
                        data-testid={`cockpit-activity-rail-move-impact-${row.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-cockpit-text-primary">
                            {row.label}
                          </span>
                          <TrustBadge tone={row.tone}>
                            {row.statusLabel}
                          </TrustBadge>
                        </div>
                        <p className="mt-0.5 leading-4 text-cockpit-text-secondary">
                          {row.summary}
                        </p>
                        {row.deltas.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-0.5 text-[10px] text-cockpit-text-muted">
                            {row.deltas.map((delta) => (
                              <li key={delta}>{delta}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[10px] leading-4 text-cockpit-text-muted">
                            Exact before/after delta is not available from this
                            receipt.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : receiptImpact.emptyMessage ? (
                  <p className="text-[10px] leading-4 text-cockpit-text-muted">
                    {receiptImpact.emptyMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-cockpit-text-muted">
                {receiptImpact.emptyMessage}
              </p>
            )}
          </RailSection>

          {pinnedPlayers.length > 0 ? (
            <RailSection
              label="Pinned Players"
              testId="cockpit-activity-rail-pinned"
              action={
                pinnedPlayers.length > 1 && onTradeAllPinned ? (
                  <button
                    type="button"
                    onClick={onTradeAllPinned}
                    className="rounded border border-cockpit-edge bg-cockpit-inlay px-1.5 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    data-testid="cockpit-activity-rail-pinned-trade-all"
                  >
                    Trade all
                  </button>
                ) : null
              }
            >
              <ul className="flex flex-col gap-1">
                {pinnedPlayers.map((player) => {
                  const pinnedContext: PlayerActionContext = {
                    playerId: player.id,
                    playerLabel: player.label,
                    sourceRoom: 'rail',
                    ...(player.isTarget ? { isFreeAgentTarget: true } : {}),
                  };
                  return (
                    <li
                      key={player.id}
                      className="flex items-center gap-1.5 rounded border border-cockpit-edge bg-cockpit-slab px-2 py-1"
                      data-testid={`cockpit-activity-rail-pinned-${player.id}`}
                    >
                      {player.isTarget ? (
                        <span
                          className="shrink-0 rounded border border-cockpit-info/40 bg-cockpit-info/10 px-1 text-[9px] font-semibold uppercase tracking-wide leading-4 text-cockpit-info"
                          title="Free-agent target"
                          data-testid={`cockpit-activity-rail-pinned-target-${player.id}`}
                        >
                          Target
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenPinnedPlayer?.(player.id)}
                        className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-cockpit-text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        title={`Open ${player.label}`}
                        data-testid={`cockpit-activity-rail-pinned-open-${player.id}`}
                      >
                        {player.label}
                      </button>
                      <PlayerActionMenu
                        context={pinnedContext}
                        visibleActions={['trade', 'unpin']}
                        overflowActions={['view-on-roster', 'view-on-cap']}
                        testIdPrefix={`cockpit-activity-rail-pinned-${player.id}-actions`}
                        onAction={(action, ctx) => {
                          if (action === 'trade') {
                            onPlayerAction
                              ? onPlayerAction('trade', ctx)
                              : onTradePinnedPlayer?.(player.id);
                            return;
                          }
                          if (action === 'unpin') {
                            onPlayerAction
                              ? onPlayerAction('unpin', ctx)
                              : onUnpinPlayer?.(player.id);
                            return;
                          }
                          onPlayerAction?.(action, ctx);
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </RailSection>
          ) : null}

          {tradeDraftActive ? (
            <RailSection
              label="In Progress"
              testId="cockpit-activity-rail-in-progress"
              action={
                <AuthorityChip
                  authority={{ kind: 'local-only-preview' }}
                  testId="cockpit-activity-rail-in-progress-authority"
                />
              }
            >
              {onResumeTradeDraft ? (
                <button
                  type="button"
                  onClick={onResumeTradeDraft}
                  className="w-full rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-left text-[11px] text-cockpit-watch transition-colors hover:bg-cockpit-watch/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-cockpit-watch/50"
                  data-testid="cockpit-activity-rail-trade-draft"
                  title="Resume trade draft"
                >
                  <span className="font-medium">Trade draft</span>
                  <span className="text-cockpit-text-muted"> · </span>
                  <span className="text-cockpit-text-secondary">
                    Local until applied. Click to resume.
                  </span>
                </button>
              ) : (
                <div
                  className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-[11px] text-cockpit-watch"
                  data-testid="cockpit-activity-rail-trade-draft"
                >
                  <span className="font-medium">Trade draft</span>
                  <span className="text-cockpit-text-muted"> · </span>
                  <span className="text-cockpit-text-secondary">
                    Local until applied — not committed world truth.
                  </span>
                </div>
              )}
            </RailSection>
          ) : null}

          <RailSection
            label="Warnings & Validation"
            testId="cockpit-activity-rail-watchlist"
          >
            {watch.length === 0 ? (
              <p className="text-xs text-cockpit-text-muted">
                No active watch items.
              </p>
            ) : (
              watch.map((entry) => {
                const onNavigate =
                  entry.destination === 'offseason'
                    ? onNavigateToOffseason
                    : onNavigateToCapSheet;
                return (
                  <div
                    key={entry.id}
                    className={`rounded border px-2 py-1.5 text-[11px] ${TONE_CLASSES[entry.tone]}`}
                    data-testid={`cockpit-activity-rail-watch-${entry.id}`}
                  >
                    <div className="flex items-start gap-1.5">
                      {entry.authority ? (
                        <AuthorityChip
                          authority={entry.authority}
                          testId={`cockpit-activity-rail-watch-${entry.id}-authority`}
                        />
                      ) : null}
                      <span className="min-w-0 flex-1">{entry.text}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={onNavigate}
                        className="text-[10px] font-medium underline decoration-dotted underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        data-testid={`cockpit-activity-rail-watch-${entry.id}-action`}
                      >
                        {WATCH_DESTINATION_LABELS[entry.destination]}
                      </button>
                      {entry.tradeObjective && onOpenTradeForObjective ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenTradeForObjective(entry.tradeObjective!)
                          }
                          className="text-[10px] font-medium underline decoration-dotted underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                          data-testid={`cockpit-activity-rail-watch-${entry.id}-trade`}
                        >
                          Open Trade
                        </button>
                      ) : null}
                      {entry.tradeObjective && onOpenGuideForObjective ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenGuideForObjective(entry.tradeObjective!)
                          }
                          className="text-[10px] font-medium underline decoration-dotted underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                          data-testid={`cockpit-activity-rail-watch-${entry.id}-guide`}
                        >
                          Guide
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </RailSection>

          <RailSection label="World Events" testId="cockpit-activity-rail-events">
            <ScenarioMoveRail
              worldId={worldId}
              teamCode={historyTeamCode}
              onOpenHistory={onOpenHistory}
              onOpenHistoryEntry={onOpenHistoryEntry}
              refreshKey={receiptGeneration}
              highlightEventId={receipt?.eventId ?? null}
            />
          </RailSection>
        </div>
      </aside>
    );
  }
);
