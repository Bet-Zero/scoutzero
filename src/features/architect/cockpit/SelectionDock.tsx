/**
 * FILE: src/features/architect/cockpit/SelectionDock.tsx
 * PURPOSE: Sticky cross-room player focus bar below TeamStatusStrip.
 * OWNERSHIP: Feature: architect/cockpit
 */
interface SelectionDockProps {
  playerLabel: string;
  onViewCap: () => void;
  onViewRoster: () => void;
  onOpenTrade: () => void;
  onClear: () => void;
}

export const SelectionDock = ({
  playerLabel,
  onViewCap,
  onViewRoster,
  onOpenTrade,
  onClear,
}: SelectionDockProps) => (
  <div
    className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cockpit-edge bg-cockpit-slab px-4 py-2"
    data-testid="cockpit-selection-dock"
  >
    <span className="text-[10px] font-semibold uppercase tracking-wide text-cockpit-text-muted">
      Focused
    </span>
    <span
      className="truncate text-xs font-medium text-cockpit-text-primary"
      data-testid="cockpit-selection-dock-label"
    >
      {playerLabel}
    </span>
    <div className="ml-auto flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onViewCap}
        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        data-testid="cockpit-selection-dock-cap"
      >
        View Cap
      </button>
      <button
        type="button"
        onClick={onViewRoster}
        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        data-testid="cockpit-selection-dock-roster"
      >
        View Roster
      </button>
      <button
        type="button"
        onClick={onOpenTrade}
        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[10px] font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        data-testid="cockpit-selection-dock-trade"
      >
        Open Trade
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded px-2 py-1 text-[10px] text-cockpit-text-muted hover:text-cockpit-text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        aria-label="Clear focused player"
        data-testid="cockpit-selection-dock-clear"
      >
        Clear
      </button>
    </div>
  </div>
);
