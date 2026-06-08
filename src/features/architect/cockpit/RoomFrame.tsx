/**
 * FILE: src/features/architect/cockpit/RoomFrame.tsx
 * PURPOSE: Minimal section wrapper used inside the cockpit Workbench. Provides
 *          a consistent 48px header (title + subtitle + optional meta/primary
 *          action slots) and a single scrollable body region.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 design notes:
 *  - Composed by Workbench, NOT imported into section files.
 *  - Body is the ONLY scroll boundary inside the central workspace.
 *  - primaryAction is optional and intentionally unused by Phase 1 — existing
 *    in-section primary buttons stay in place. Phase 2 will lift them.
 */
import type { ReactNode } from 'react';

interface RoomFrameProps {
  title: string;
  subtitle?: string | null;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  children: ReactNode;
  /**
   * Full-bleed body: drops the default body padding so a room can own the
   * entire workspace area edge-to-edge (e.g. the Full Cap Table fills the
   * viewport). Opt-in so other rooms keep their comfortable padding.
   */
  bleed?: boolean;
  /**
   * Suppress the 48px room header for rooms whose own interior already provides
   * a title/toolbar (e.g. the Full Cap Table). The NavRail still names the room,
   * so this only removes a redundant band and hands its height to the body.
   */
  hideHeader?: boolean;
}

export const RoomFrame = ({
  title,
  subtitle,
  meta,
  primaryAction,
  children,
  bleed = false,
  hideHeader = false,
}: RoomFrameProps) => (
  <section
    className="flex h-full min-h-0 flex-col bg-cockpit-void"
    data-testid="cockpit-room-frame"
    aria-label={title}
  >
    {hideHeader ? null : (
    <header
      className="flex shrink-0 items-center gap-4 border-b border-cockpit-edge bg-cockpit-bar px-5 h-12"
      data-testid="cockpit-room-frame-header"
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h2
          className="truncate text-sm font-semibold uppercase tracking-wide text-cockpit-text-primary"
          data-testid="cockpit-room-frame-title"
        >
          {title}
        </h2>
        {subtitle ? (
          <span className="truncate text-xs text-cockpit-text-secondary">
            {subtitle}
          </span>
        ) : null}
      </div>

      {meta ? (
        <div className="ml-2 hidden min-w-0 flex-1 items-center gap-3 md:flex">
          {meta}
        </div>
      ) : (
        <div className="ml-auto" />
      )}

      {primaryAction ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {primaryAction}
        </div>
      ) : null}
    </header>
    )}

    <div
      className={`flex-1 min-h-0 overflow-auto ${bleed ? '' : 'px-5 py-4'}`}
      data-testid="cockpit-room-frame-body"
    >
      {children}
    </div>
  </section>
);
