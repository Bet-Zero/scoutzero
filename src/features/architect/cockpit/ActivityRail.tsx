/**
 * FILE: src/features/architect/cockpit/ActivityRail.tsx
 * PURPOSE: Right-side persistent rail in the Architect cockpit — the Team
 *          Plan Hub (BZE-208 Decision 1 / BZE-211). A compact active-plan
 *          overview: plan header (team / plan / season / save state), status
 *          strip, active alerts, active work, recent moves, asset counts, and
 *          pinned items. Detail views (full pick stash, full history) live in
 *          expanded panels (AssetsPanel, Team History), never stacked in the
 *          drawer.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Notes:
 *  - No new state engines. Receipt source is the existing
 *    `ArchitectPostActionHandoff` (single current receipt). Recent moves
 *    use the existing `ScenarioMoveRail` unchanged (last 5, View full history).
 *  - Alerts are a thin presentational re-render of workspace-context
 *    warning flags (apron posture, season mismatch) plus unsafe-switch
 *    save warnings. No new rules engine.
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
import { getArchitectTeamPlanUnsafeContextExitWarnings } from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { type HardCapCockpitStatus } from './TeamStatusStrip';
import {
  getAuthorityLabel,
  AUTHORITY_TONE_BADGE_CLASSES,
  type AuthorityLabelInput,
} from './authorityLabel';
import {
  deriveCapPosturePanel,
  deriveReceiptImpactPanel,
  deriveTeamPlanTruthPanel,
  isHardCapActiveForViewingSeason,
  type TrustPanelTone,
} from './teamPlanTrustPanelModel';
import { AssetsPanel } from './AssetsPanel';
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
    }
    // Over-the-cap alone is strip-only (owner decision, BZE-211): being over
    // the cap is normal for NBA teams — it only alerts once tax/apron/hard-cap
    // restrictions actually bind.
  }

  // "No active exceptions" is status, not a warning — it lives in the status
  // strip and Assets panel now (owner direction: alerts show only meaningful
  // warnings).

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
  // BZE-250: the Offseason room is hidden; the season-mismatch nudge now opens
  // the relocated Season Advance flow (World menu) rather than the room.
  offseason: 'Advance season',
};

const TONE_TEXT_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'text-cockpit-safe',
  info: 'text-cockpit-info',
  watch: 'text-cockpit-watch',
  danger: 'text-cockpit-danger',
  muted: 'text-cockpit-text-secondary',
};

/** Compact status-strip save indicator: dot color + short GM phrase. */
const SAVE_DOT_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'bg-cockpit-safe',
  info: 'bg-cockpit-info',
  watch: 'bg-cockpit-watch',
  danger: 'bg-cockpit-danger',
  muted: 'bg-cockpit-text-muted',
};

const SAVE_INDICATOR_LABELS: Record<string, string> = {
  loading: 'Checking save status',
  saved: 'Saved',
  saving: 'Saving…',
  'save-failed': 'Save failed',
  'uncommitted-draft': 'Unsaved changes',
  'local-only': 'Not saved (what-if)',
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

    const [assetsOpen, setAssetsOpen] = useState(false);

    const planTruth = deriveTeamPlanTruthPanel(workspace.saveState);
    // Plan header (Team Plan Hub): current team · active plan · season · save state.
    const planLabel =
      workspace.world.status === 'sandbox'
        ? 'What-if session'
        : workspace.world.label;
    const seasonLabel =
      workspace.seasons.selectedViewingSeasonLabel ??
      workspace.seasons.authoritativeWorldSeasonLabel;
    const identityMetaLine = [
      seasonLabel ? `Season ${seasonLabel}` : null,
      workspace.worldDate.status === 'available'
        ? `through ${workspace.worldDate.label}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const saveIndicatorLabel =
      SAVE_INDICATOR_LABELS[workspace.saveState.status] ??
      workspace.saveState.label;
    const saveIndicatorLine = planTruth.lastSavedLabel
      ? `${saveIndicatorLabel} · ${planTruth.lastSavedLabel}`
      : saveIndicatorLabel;

    // Status strip: canonical cap model (single source — same derivation the
    // permanent posture band uses), roster/two-way counts, pick + exception counts.
    const capPanel = deriveCapPosturePanel(workspace, hardCapStatus);
    const roster = workspace.roster;
    const draftAssets = workspace.draftAssets;
    const exceptions = workspace.exceptions;
    const pickStripValue =
      draftAssets.status === 'available'
        ? `${draftAssets.firstRoundCount} · ${draftAssets.secondRoundCount}`
        : '—';
    const exceptionStripValue =
      exceptions.status === 'available'
        ? [
            exceptions.hasAvailableMle ? 'MLE' : null,
            exceptions.hasAvailableBae ? 'BAE' : null,
            exceptions.hasAvailableRoom ? 'Room' : null,
            exceptions.tpeCount > 0 ? `${exceptions.tpeCount} TPE` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'None'
        : '—';
    const pickSummaryValue =
      draftAssets.status === 'available'
        ? `${draftAssets.firstRoundCount} firsts · ${draftAssets.secondRoundCount} seconds`
        : draftAssets.status === 'loading'
          ? 'Loading'
          : 'Not available yet';
    const rosterSpotsValue =
      roster.status === 'available' && roster.standardCount !== null
        ? `${Math.max(0, 15 - roster.standardCount)} standard · ${
            roster.twoWayCount !== null
              ? Math.max(0, 3 - roster.twoWayCount)
              : '—'
          } two-way open`
        : '—';

    // Active work: pending/unsaved things the GM is in the middle of.
    const draftPositionEditPending =
      workspace.saveState.hasUncommittedDraft &&
      workspace.saveState.draftSources.includes('draft-position-editor');
    const otherUnsavedWork =
      workspace.saveState.hasUncommittedDraft &&
      !draftPositionEditPending &&
      !tradeDraftActive;
    const hasActiveWork =
      tradeDraftActive || draftPositionEditPending || otherUnsavedWork;
    const receiptImpact = deriveReceiptImpactPanel(receipt);
    const receiptHasCommittedEvidence =
      receipt?.authority === 'committed-world';
    const watch = deriveWatchEntries(workspace, hardCapStatus);
    // Alerts show actionable save problems only. The steady "what-if session"
    // notice is status (header indicator), so use the intent that omits it.
    const saveAlerts = getArchitectTeamPlanUnsafeContextExitWarnings(
      workspace.saveState,
      'leave-architect'
    );
    const hasWatchDanger = watch.some((entry) => entry.tone === 'danger');
    const hasPlanTruthDanger = planTruth.tone === 'danger';
    const hasPlanTruthWatch = planTruth.tone === 'watch';

    // Section order is the Team Plan Hub contract (BZE-211 owner direction):
    // Plan header → Status strip → Alerts (only when present) → Active Work →
    // Recent Moves → Assets summary → Pinned (only when present). Header and
    // strip stay fixed; the rest scrolls (overflow-y-auto) rather than
    // dropping sections. Detail views (year-by-year pick stash, full history)
    // live in expanded panels, never stacked in the drawer. Collapsed-state
    // indicator dots below surface danger, unsaved work, receipt, and
    // in-progress separately so a danger is never buried behind a
    // lower-priority dot.

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
              aria-label="Team Plan save state needs review"
              title="Team Plan save state needs review"
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
              aria-label="Trade in progress"
              title="Trade in progress"
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

        <div
          className="shrink-0 border-b border-cockpit-edge bg-cockpit-inlay px-3 py-2.5"
          data-testid="cockpit-activity-rail-identity"
        >
          <div
            className="truncate text-[13px] font-semibold leading-5 text-cockpit-text-primary"
            title={workspace.team.label}
            data-testid="cockpit-activity-rail-identity-team"
          >
            {workspace.team.label}
          </div>
          <div
            className="mt-0.5 truncate text-[11px] leading-4 text-cockpit-text-secondary"
            title={planLabel}
            data-testid="cockpit-activity-rail-identity-plan"
          >
            {planLabel}
          </div>
          {identityMetaLine ? (
            <div
              className="mt-0.5 truncate text-[10px] leading-4 text-cockpit-text-muted"
              data-testid="cockpit-activity-rail-identity-season"
            >
              {identityMetaLine}
            </div>
          ) : null}
          <div
            className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-4 text-cockpit-text-secondary"
            data-testid="cockpit-activity-rail-save-indicator"
            data-save-status={workspace.saveState.status}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${SAVE_DOT_CLASSES[planTruth.tone]}`}
            />
            <span className="truncate" title={planTruth.detail}>
              {saveIndicatorLine}
            </span>
          </div>
        </div>

        <div
          className="grid shrink-0 grid-cols-3 gap-px border-b border-cockpit-edge bg-cockpit-edge"
          data-testid="cockpit-activity-rail-strip"
        >
          <div
            className="col-span-3 bg-cockpit-bar px-3 py-1.5"
            data-testid="cockpit-activity-rail-strip-cap"
            data-tone={capPanel.tone}
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              Cap Status
            </div>
            <div
              className={`truncate text-[11px] font-semibold ${TONE_TEXT_CLASSES[capPanel.tone]}`}
              title={capPanel.detail}
            >
              {capPanel.statusLabel}
            </div>
          </div>
          <div
            className="bg-cockpit-bar px-3 py-1.5"
            data-testid="cockpit-activity-rail-strip-roster"
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              Roster
            </div>
            <div className="text-[11px] font-semibold text-cockpit-text-primary">
              {roster.status === 'available'
                ? `${roster.standardCount ?? roster.count} / 15`
                : '—'}
            </div>
          </div>
          <div
            className="bg-cockpit-bar px-3 py-1.5"
            data-testid="cockpit-activity-rail-strip-two-way"
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              Two-Way
            </div>
            <div className="text-[11px] font-semibold text-cockpit-text-primary">
              {roster.status === 'available' && roster.twoWayCount !== null
                ? `${roster.twoWayCount} / 3`
                : '—'}
            </div>
          </div>
          <div
            className="bg-cockpit-bar px-3 py-1.5"
            data-testid="cockpit-activity-rail-strip-picks"
            title="First-round picks · second-round picks held"
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              1sts · 2nds
            </div>
            <div className="text-[11px] font-semibold text-cockpit-text-primary">
              {pickStripValue}
            </div>
          </div>
          <div
            className="col-span-3 bg-cockpit-bar px-3 py-1.5"
            data-testid="cockpit-activity-rail-strip-exceptions"
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              Exceptions
            </div>
            <div className="truncate text-[11px] font-semibold text-cockpit-text-primary">
              {exceptionStripValue}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Active alerts: only meaningful warnings, only when they exist.
              Save state lives in the header indicator; cap posture lives in
              the permanent TeamPosturePanel band. */}
          {watch.length > 0 || saveAlerts.length > 0 ? (
            <RailSection label="Alerts" testId="cockpit-activity-rail-alerts">
              {watch.map((entry) => {
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onNavigate}
                        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
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
                          className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
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
                          className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                          data-testid={`cockpit-activity-rail-watch-${entry.id}-guide`}
                        >
                          Guide
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {saveAlerts.map((warning) => (
                <div
                  key={warning}
                  className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-[11px] leading-4 text-cockpit-watch"
                  data-testid="cockpit-activity-rail-alert-save"
                >
                  {warning}
                </div>
              ))}
            </RailSection>
          ) : null}

          <RailSection
            label="Active Work"
            testId="cockpit-activity-rail-work"
          >
            {hasActiveWork ? (
              <>
                {tradeDraftActive ? (
                  <div
                    className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-[11px] text-cockpit-watch"
                    data-testid="cockpit-activity-rail-trade-draft"
                  >
                    <div className="font-medium">Trade in progress</div>
                    <div className="mt-0.5 text-[10px] text-cockpit-text-secondary">
                      Not applied to plan yet.
                    </div>
                    {onResumeTradeDraft ? (
                      <button
                        type="button"
                        onClick={onResumeTradeDraft}
                        className="mt-1.5 rounded border border-cockpit-watch/40 bg-cockpit-watch/10 px-2 py-0.5 text-[10px] font-medium text-cockpit-watch hover:bg-cockpit-watch/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-cockpit-watch/50"
                        data-testid="cockpit-activity-rail-trade-draft-resume"
                      >
                        Resume trade
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {draftPositionEditPending ? (
                  <div
                    className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-[11px] text-cockpit-watch"
                    data-testid="cockpit-activity-rail-work-draft-position"
                  >
                    <div className="font-medium">Draft position edit</div>
                    <div className="mt-0.5 text-[10px] text-cockpit-text-secondary">
                      Not saved yet.
                    </div>
                  </div>
                ) : null}
                {otherUnsavedWork ? (
                  <div
                    className="rounded border border-cockpit-watch/30 bg-cockpit-watch/5 px-2 py-1.5 text-[11px] text-cockpit-watch"
                    data-testid="cockpit-activity-rail-work-unsaved"
                  >
                    <div className="font-medium">Unsaved changes</div>
                    <div className="mt-0.5 text-[10px] text-cockpit-text-secondary">
                      {workspace.saveState.detail}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p
                className="text-xs text-cockpit-text-muted"
                data-testid="cockpit-activity-rail-work-empty"
              >
                Nothing in progress.
              </p>
            )}
          </RailSection>

          <RailSection
            label="Recent Moves"
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
                ) : null}
              </>
            ) : null}
            {/* Last committed moves (capped at 5) with View full history — the
                receipt above only renders when there is a fresh move. */}
            <ScenarioMoveRail
              worldId={worldId}
              teamCode={historyTeamCode}
              onOpenHistory={onOpenHistory}
              onOpenHistoryEntry={onOpenHistoryEntry}
              refreshKey={receiptGeneration}
              highlightEventId={receipt?.eventId ?? null}
            />
          </RailSection>

          <RailSection
            label="Assets"
            testId="cockpit-activity-rail-assets"
            action={
              <button
                type="button"
                onClick={() => setAssetsOpen(true)}
                className="rounded border border-cockpit-edge bg-cockpit-inlay px-1.5 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                data-testid="cockpit-activity-rail-assets-open"
              >
                View all assets
              </button>
            }
          >
            {/* Counts only — the year-by-year pick detail lives in the
                expanded AssetsPanel (layering contract). */}
            <dl className="flex flex-col gap-1 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-cockpit-text-muted">Draft picks</dt>
                <dd
                  className="m-0 truncate text-right text-cockpit-text-primary"
                  data-testid="cockpit-activity-rail-assets-picks"
                >
                  {pickSummaryValue}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-cockpit-text-muted">Exceptions</dt>
                <dd
                  className="m-0 truncate text-right text-cockpit-text-primary"
                  data-testid="cockpit-activity-rail-assets-exceptions"
                >
                  {exceptionStripValue}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-cockpit-text-muted">Roster spots</dt>
                <dd
                  className="m-0 truncate text-right text-cockpit-text-primary"
                  data-testid="cockpit-activity-rail-assets-roster"
                >
                  {rosterSpotsValue}
                </dd>
              </div>
            </dl>
          </RailSection>

          {pinnedPlayers.length > 0 ? (
            <RailSection
              label="Pinned"
              testId="cockpit-activity-rail-pinned"
              action={
                pinnedPlayers.length > 1 && onTradeAllPinned ? (
                  <button
                    type="button"
                    onClick={onTradeAllPinned}
                    className="rounded border border-cockpit-edge bg-cockpit-inlay px-1.5 py-0.5 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    data-testid="cockpit-activity-rail-pinned-trade-all"
                  >
                    Open Trade all
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
        </div>

        <AssetsPanel
          open={assetsOpen}
          onClose={() => setAssetsOpen(false)}
          teamLabel={workspace.team.label}
          planLabel={planLabel}
          draftAssets={draftAssets}
          exceptions={exceptions}
          roster={roster}
          onOpenHistory={onOpenHistory}
        />
      </aside>
    );
  }
);
