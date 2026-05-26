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
}

export const RoomFrame = ({
  title,
  subtitle,
  meta,
  primaryAction,
  children,
}: RoomFrameProps) => (
  <section
    className="flex h-full min-h-0 flex-col bg-cockpit-void"
    data-testid="cockpit-room-frame"
    aria-label={title}
  >
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

    <div
      className="flex-1 min-h-0 overflow-auto px-5 py-4"
      data-testid="cockpit-room-frame-body"
    >
      {children}
    </div>
  </section>
);
