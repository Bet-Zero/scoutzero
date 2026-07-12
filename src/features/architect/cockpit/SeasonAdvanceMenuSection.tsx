/**
 * FILE: src/features/architect/cockpit/SeasonAdvanceMenuSection.tsx
 * PURPOSE: Compact "Season Advance" section for the World-menu popover (BZE-250).
 *          Season advance was relocated here from the (now V1-hidden) Offseason
 *          room. This is a trigger surface only — it opens the advance wizard
 *          and the draft-positions editor, both of which render at the dashboard
 *          root (SeasonAdvanceModals) so this popover's outside-click close
 *          cannot unmount them.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Design notes:
 *  - Mirrors the popover's other sections (Active World, World Time): an
 *    uppercase label over a bordered inlay. No mutation authority.
 */

interface SeasonAdvanceMenuSectionProps {
  hasActiveWorld: boolean;
  canAdvance: boolean;
  worldSeasonLabel: string | null;
  worldSeasonLoading: boolean;
  disabledReason: string | null;
  onOpenAdvance: () => void;
  onOpenDraftPositions: () => void;
}

export const SeasonAdvanceMenuSection = ({
  hasActiveWorld,
  canAdvance,
  worldSeasonLabel,
  worldSeasonLoading,
  disabledReason,
  onOpenAdvance,
  onOpenDraftPositions,
}: SeasonAdvanceMenuSectionProps) => {
  return (
    <div className="flex flex-col gap-1" data-testid="cockpit-season-advance-section">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
        Season Advance
      </span>
      <div className="flex flex-col gap-2 rounded border border-cockpit-edge bg-cockpit-inlay p-2">
        {hasActiveWorld ? (
          <p className="text-[11px] text-cockpit-text-secondary">
            {worldSeasonLoading
              ? 'Loading world season…'
              : worldSeasonLabel
                ? `Current world season: ${worldSeasonLabel}`
                : 'World season unavailable — advance stays disabled until it loads.'}
          </p>
        ) : (
          <p className="text-[11px] text-cockpit-text-muted">
            {disabledReason ?? 'Select a world to unlock season advance.'}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAdvance}
            disabled={!canAdvance}
            data-testid="cockpit-season-advance-open"
            title={
              canAdvance
                ? 'Advance the active world to the next season'
                : (disabledReason ?? 'Select a world to unlock season advance.')
            }
            className="flex-1 rounded border border-cockpit-info/40 bg-cockpit-info/15 px-2 py-1 text-[11px] font-medium text-cockpit-info transition-colors hover:bg-cockpit-info/25 disabled:cursor-not-allowed disabled:border-cockpit-edge disabled:bg-transparent disabled:text-cockpit-text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            Advance Season
          </button>
          <button
            type="button"
            onClick={onOpenDraftPositions}
            disabled={!hasActiveWorld}
            data-testid="cockpit-season-advance-draft-positions"
            title={
              hasActiveWorld
                ? 'Enter draft positions used by season advance'
                : 'Select a world to enter draft positions.'
            }
            className="rounded border border-cockpit-edge bg-cockpit-slab px-2 py-1 text-[11px] font-medium text-cockpit-text-secondary transition-colors hover:bg-cockpit-raised hover:text-cockpit-text-primary disabled:cursor-not-allowed disabled:text-cockpit-text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            Draft positions
          </button>
        </div>
      </div>
    </div>
  );
};
