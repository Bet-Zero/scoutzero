/**
 * FILE: src/features/architect/cockpit/WorldMenu.tsx
 * PURPOSE: TopBar entry point for world selection and world-time controls.
 *          Renders a compact button (read-only world chip) that opens an
 *          anchored popover holding the existing WorldSelector and
 *          WorldTimeControls components.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - World selection is a deliberate decision, not a fluid TopBar control.
 *    The popover is opened on click; closes on outside-click or Escape.
 *  - Wraps the existing WorldSelector / WorldTimeControls components
 *    without modifying them. No mutation authority.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';

interface WorldMenuProps {
  workspace: ArchitectWorkspaceContext;
  worldSelector: ReactNode;
  worldTimeControls?: ReactNode;
}

export const WorldMenu = ({
  workspace,
  worldSelector,
  worldTimeControls,
}: WorldMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickAway = (event: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const worldLabel = workspace.world.label;
  const isSandbox = workspace.world.status === 'sandbox';
  const seasonLabel = workspace.seasons.selectedViewingSeasonLabel ?? '—';
  const worldDate =
    workspace.worldDate.status === 'available' ? workspace.worldDate.value : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="cockpit-world-menu-trigger"
        className="flex items-center gap-2 rounded-md border border-cockpit-edge bg-cockpit-inlay px-2.5 py-1 text-[11px] text-cockpit-text-secondary hover:border-cockpit-text-muted/60 hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${isSandbox ? 'bg-cockpit-text-muted' : 'bg-cockpit-info'}`}
          aria-hidden
        />
        <span className="max-w-[160px] truncate font-medium text-cockpit-text-primary">
          {worldLabel}
        </span>
        <span className="hidden text-cockpit-text-muted lg:inline">·</span>
        <span className="hidden text-cockpit-text-secondary lg:inline">
          {seasonLabel}
          {worldDate ? ` · ${worldDate}` : ''}
        </span>
        <span className="text-cockpit-text-muted" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="World menu"
          data-testid="cockpit-world-menu-popover"
          className="absolute right-0 top-[calc(100%+6px)] z-50 flex w-[360px] flex-col gap-3 rounded-md border border-cockpit-edge bg-cockpit-slab p-3 shadow-cockpit-slab"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              Active World
            </span>
            <div className="flex flex-col gap-2 rounded border border-cockpit-edge bg-cockpit-inlay p-2">
              {worldSelector ?? (
                <p className="text-xs text-cockpit-text-muted">
                  Sign in to manage worlds.
                </p>
              )}
            </div>
          </div>

          {worldTimeControls ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                World Time
              </span>
              <div className="rounded border border-cockpit-edge bg-cockpit-inlay p-2">
                {worldTimeControls}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
