/**
 * FILE: src/features/architect/cockpit/TopBar.tsx
 * PURPOSE: Persistent cockpit top bar — identity (team/world/season), live
 *          posture (cap meter, roster count), mode + last receipt. Replaces
 *          the legacy ArchitectWorkspaceHeader visually while reusing the
 *          existing world / season controls via the WorldMenu popover and a
 *          dedicated season slot.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - No mutation authority. Pure presentation.
 *  - Preserves the dashboard title heading ("HoopZero Architect – GM
 *    Dashboard") that existing smoke tests assert on.
 *  - World selection is a deliberate, popover-anchored decision, not a
 *    fluid TopBar control. The WorldMenu shows a read-only world chip by
 *    default and only reveals the WorldSelector / WorldTimeControls when
 *    opened. Exit-to-League returns to /gm to switch teams entirely.
 *  - "Last receipt" click expands the ActivityRail — single current
 *    receipt only, no history model.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ModePill } from './ModePill';
import { WorldMenu } from './WorldMenu';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';

interface TopBarProps {
  workspace: ArchitectWorkspaceContext;
  isEmulator: boolean;
  isReviewMode?: boolean;
  receipt: ArchitectPostActionReceipt | null;
  onExpandActivity: () => void;
  worldSelectorSlot?: ReactNode;
  worldTimeControlsSlot?: ReactNode;
  seasonSelectorSlot?: ReactNode;
  seasonAdvanceSlot?: ReactNode;
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  const deltaMs = Date.now() - parsed;
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const TopBar = ({
  workspace,
  isEmulator,
  isReviewMode = false,
  receipt,
  onExpandActivity,
  worldSelectorSlot,
  worldTimeControlsSlot,
  seasonSelectorSlot,
  seasonAdvanceSlot,
}: TopBarProps) => {
  const teamLabel = workspace.team.label;

  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b border-cockpit-edge bg-cockpit-bar px-4"
      style={{ height: 56 }}
      data-testid="cockpit-top-bar"
    >
      {/* Visually-hidden heading preserved for existing smoke tests */}
      <h1 className="sr-only" data-testid="cockpit-dashboard-title">
        HoopZero Architect – GM Dashboard
      </h1>

      {/* Left: Identity */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Link
          to="/gm"
          aria-label="Exit cockpit to league view"
          title="Exit to League"
          data-testid="cockpit-exit-link"
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-base font-semibold tracking-tight text-cockpit-text-primary hover:bg-cockpit-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          <span aria-hidden>🏀</span>
          <span className="hidden sm:inline">Architect</span>
        </Link>
        <span className="hidden h-5 w-px bg-cockpit-edge md:block" />
        <span
          className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-cockpit-text-primary"
          data-testid="cockpit-team-chip"
        >
          {teamLabel}
        </span>
      </div>

      {/* Center: breathing room — cap posture + roster moved to the
          persistent TeamStatusStrip below the TopBar. */}
      <div className="ml-2 flex min-w-0 flex-1 items-center" aria-hidden />

      {/* Right: World menu, season, mode pill, last receipt */}
      <div className="flex shrink-0 items-center gap-2">
        <WorldMenu
          workspace={workspace}
          worldSelector={worldSelectorSlot}
          worldTimeControls={worldTimeControlsSlot}
          seasonAdvance={seasonAdvanceSlot}
        />
        {seasonSelectorSlot}
        <ModePill
          context={workspace}
          isEmulator={isEmulator}
          isReviewMode={isReviewMode}
        />
        {receipt ? (
          <button
            type="button"
            onClick={onExpandActivity}
            data-testid="cockpit-last-receipt"
            className="hidden max-w-[220px] truncate rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-left text-[11px] text-cockpit-text-secondary hover:border-cockpit-safe/40 hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 xl:inline-block"
            title={receipt.headline}
          >
            <span className="text-cockpit-text-muted">Last:</span>{' '}
            <span className="font-medium text-cockpit-text-primary">
              {receipt.headline}
            </span>
            {receipt.occurredAt ? (
              <span className="ml-1 text-cockpit-text-muted">
                · {formatRelative(receipt.occurredAt)}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </header>
  );
};
