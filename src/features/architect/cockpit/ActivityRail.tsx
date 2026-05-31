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
import { TeamStatusStrip, type HardCapCockpitStatus } from './TeamStatusStrip';

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
  tradeDraftActive?: boolean;
  onNavigateToCompare?: () => void;
  onNavigateToGuide?: () => void;
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

interface WatchEntry {
  id: string;
  tone: 'info' | 'watch' | 'danger';
  text: string;
}

function deriveWatchEntries(workspace: ArchitectWorkspaceContext): WatchEntry[] {
  const entries: WatchEntry[] = [];

  const cap = workspace.cap;
  if (cap.status === 'available') {
    if (cap.isAboveSecondApron) {
      entries.push({
        id: 'apron2',
        tone: 'danger',
        text: 'Above 2nd Apron — hard-cap restrictions active.',
      });
    } else if (cap.isAtOrAboveFirstApron) {
      entries.push({
        id: 'apron1',
        tone: 'danger',
        text: 'At or above 1st Apron — exception use restricted.',
      });
    } else if (cap.isOverTax) {
      entries.push({
        id: 'tax',
        tone: 'watch',
        text: 'Over the luxury tax line.',
      });
    } else if (cap.isOverCap) {
      entries.push({
        id: 'cap',
        tone: 'watch',
        text: 'Over the salary cap.',
      });
    }
  }

  const exc = workspace.exceptions;
  if (exc.status === 'available' && !exc.hasAnyActive) {
    entries.push({
      id: 'exceptions',
      tone: 'info',
      text: 'No active exceptions (MLE / BAE / TPE / Room).',
    });
  }

  const seasons = workspace.seasons;
  if (seasons.viewingSeasonDiffersFromWorldSeason) {
    entries.push({
      id: 'season-mismatch',
      tone: 'info',
      text: `Viewing ${seasons.selectedViewingSeasonLabel ?? '—'} — world is at ${seasons.authoritativeWorldSeasonLabel ?? '—'}.`,
    });
  }

  return entries;
}

const TONE_CLASSES: Record<WatchEntry['tone'], string> = {
  info: 'border-cockpit-info/30 bg-cockpit-info/5 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/5 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/5 text-cockpit-danger',
};

const RailSection = ({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) => (
  <section
    className="flex flex-col border-b border-cockpit-edge px-3 py-3 last:border-b-0"
    data-testid={testId}
  >
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
      {label}
    </h3>
    <div className="flex flex-col gap-2">{children}</div>
  </section>
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
      onOpenHistory,
      onOpenHistoryEntry,
      onNavigateReceiptHistory,
      onDismissReceipt,
      tradeDraftActive = false,
      onNavigateToCompare,
      onNavigateToGuide,
    },
    ref
  ) {
    const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());

    useEffect(() => {
      writeCollapsed(collapsed);
    }, [collapsed]);

    useImperativeHandle(ref, () => ({ expand: () => setCollapsed(false) }), []);

    const watch = deriveWatchEntries(workspace);

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
          {receipt ? (
            <span
              className="mt-3 h-2 w-2 rounded-full bg-cockpit-safe"
              aria-label="New receipt available"
              title="New receipt available"
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
            Activity
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
          <RailSection label="Cap Posture" testId="cockpit-activity-rail-cap-posture">
            <TeamStatusStrip
              workspace={workspace}
              hardCapStatus={hardCapStatus}
              orientation="vertical"
            />
          </RailSection>
          <RailSection label="Current Receipt" testId="cockpit-activity-rail-receipts">
            {receipt ? (
              <>
                <ArchitectPostActionHandoff
                  receipt={receipt}
                  onNavigateToCapSheet={onNavigateToCapSheet}
                  onNavigateToRoster={onNavigateToRoster}
                  onNavigateToHistory={onNavigateReceiptHistory}
                  onDismiss={onDismissReceipt}
                />
                {onNavigateToCompare || onNavigateToGuide ? (
                  <div
                    className="flex flex-wrap gap-1.5"
                    data-testid="cockpit-activity-rail-post-action-links"
                  >
                    {onNavigateToCompare ? (
                      <button
                        type="button"
                        onClick={onNavigateToCompare}
                        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        data-testid="cockpit-activity-rail-compare"
                      >
                        Compare move
                      </button>
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
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-cockpit-text-muted">
                No recent committed actions.
              </p>
            )}
          </RailSection>

          {tradeDraftActive ? (
            <RailSection
              label="In Progress"
              testId="cockpit-activity-rail-in-progress"
            >
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
            </RailSection>
          ) : null}

          <RailSection label="Watchlist" testId="cockpit-activity-rail-watchlist">
            {watch.length === 0 ? (
              <p className="text-xs text-cockpit-text-muted">
                No active warnings.
              </p>
            ) : (
              watch.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded border px-2 py-1.5 text-[11px] ${TONE_CLASSES[entry.tone]}`}
                  data-testid={`cockpit-activity-rail-watch-${entry.id}`}
                >
                  {entry.text}
                </div>
              ))
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
