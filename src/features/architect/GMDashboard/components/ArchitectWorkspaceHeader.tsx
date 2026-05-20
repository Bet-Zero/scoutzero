/**
 * FILE: src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx
 * PURPOSE: Read-only Stage 1B/1C persistent workspace header/status strip for GMDashboard.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Surfaces active team, world, date, season, mode, posture, and franchise summary indicators.
 * Consumes the Stage 1A/1C workspace context seam. No mutation authority.
 */
import type {
  ArchitectWorkspaceContext,
  ArchitectWorkspaceExceptionsSummary,
} from '../hooks/useArchitectWorkspaceContext';
import type { ArchitectModePresentationTone } from '../hooks/useArchitectModePresentation';

interface Props {
  context: ArchitectWorkspaceContext;
  onNavigateToCapSheet?: (() => void) | null;
  onNavigateToOffseason?: (() => void) | null;
}

const TONE_CLASS: Record<ArchitectModePresentationTone, string> = {
  success: 'bg-green-500/15 text-green-200 border-green-400/30',
  neutral: 'bg-white/10 text-white/70 border-white/10',
  info: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  warning: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
  danger: 'bg-rose-500/15 text-rose-200 border-rose-300/30',
  muted: 'bg-white/5 text-white/40 border-white/10',
};

const fmt = (v: number) => `$${(Math.abs(v) / 1_000_000).toFixed(1)}M`;

type CapAvailable = Extract<ArchitectWorkspaceContext['cap'], { status: 'available' }>;

const Sep = () => (
  <span className="text-white/20" aria-hidden="true">
    ·
  </span>
);

const CapSummary = ({ cap }: { cap: CapAvailable }) => (
  <>
    <span>
      {cap.seasonLabel}:{' '}
      {cap.isOverCap ? (
        <span className="text-rose-300">{fmt(cap.capSpace)} over cap</span>
      ) : (
        <span className="text-green-300">{fmt(cap.capSpace)} space</span>
      )}
    </span>
    <Sep />
    <span>
      Tax:{' '}
      {cap.isOverTax ? (
        <span className="text-amber-300">{fmt(cap.taxSpace)} over</span>
      ) : (
        <span>{fmt(cap.taxSpace)} space</span>
      )}
    </span>
    {cap.isAtOrAboveFirstApron && (
      <>
        <Sep />
        <span className="text-amber-200">1st Apron</span>
      </>
    )}
    {cap.isAboveSecondApron && (
      <>
        <Sep />
        <span className="text-rose-200">2nd Apron</span>
      </>
    )}
  </>
);

type ExceptionsAvailable = Extract<ArchitectWorkspaceExceptionsSummary, { status: 'available' }>;

const ExceptionLine = ({
  exc,
  seasonMismatch,
}: {
  exc: ExceptionsAvailable;
  seasonMismatch: boolean;
}) => {
  const flags: string[] = [];
  if (exc.hasAvailableMle) flags.push('MLE');
  if (exc.hasAvailableBae) flags.push('BAE');
  if (exc.hasAvailableRoom) flags.push('Room Exc.');
  if (exc.tpeCount > 0) flags.push(`TPE ×${exc.tpeCount}`);

  return (
    <span>
      Exc: {flags.join(' · ')}
      {seasonMismatch && (
        <span className="ml-1 text-white/30">(world season)</span>
      )}
    </span>
  );
};

export const ArchitectWorkspaceHeader = ({ context, onNavigateToCapSheet, onNavigateToOffseason }: Props) => {
  const { team, world, seasons, worldDate, mode, status, roster, cap, exceptions, draftAssets, recentActivity } = context;

  return (
    <div
      className="mb-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70"
      data-testid="architect-workspace-header"
    >
      {/* Row 1: Identity · date · season · mode */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-white/90">{team.label}</span>
        <Sep />
        <span>{world.label}</span>

        {worldDate.status === 'available' && (
          <>
            <Sep />
            <span className="text-white/50">As of {worldDate.value}</span>
          </>
        )}
        {worldDate.status === 'loading' && (
          <>
            <Sep />
            <span className="italic text-white/30">Date loading…</span>
          </>
        )}
        {worldDate.status === 'unavailable' && world.status !== 'sandbox' && (
          <>
            <Sep />
            <span className="text-white/30">Date unavailable</span>
          </>
        )}

        <Sep />
        <span>Viewing {seasons.selectedViewingSeasonLabel ?? '—'}</span>

        {seasons.authoritativeWorldSeasonStatus === 'available' &&
          seasons.authoritativeWorldSeasonLabel && (
            <>
              <Sep />
              <span className="text-white/50">
                World {seasons.authoritativeWorldSeasonLabel}
              </span>
            </>
          )}
        {seasons.authoritativeWorldSeasonStatus === 'loading' && (
          <>
            <Sep />
            <span className="italic text-white/30">World season loading…</span>
          </>
        )}

        {seasons.viewingSeasonDiffersFromWorldSeason === true && (
          onNavigateToOffseason ? (
            <button
              type="button"
              onClick={onNavigateToOffseason}
              className="rounded border border-amber-300/30 bg-amber-400/10 px-1.5 py-0.5 text-amber-200 hover:bg-amber-400/20 cursor-pointer"
              data-testid="season-mismatch-nav-offseason"
            >
              ⚠ Viewing {seasons.selectedViewingSeasonLabel ?? '?'} ≠ World{' '}
              {seasons.authoritativeWorldSeasonLabel ?? '?'}
            </button>
          ) : (
            <span className="rounded border border-amber-300/30 bg-amber-400/10 px-1.5 py-0.5 text-amber-200">
              ⚠ Viewing {seasons.selectedViewingSeasonLabel ?? '?'} ≠ World{' '}
              {seasons.authoritativeWorldSeasonLabel ?? '?'}
            </span>
          )
        )}

        <span className="min-w-0 flex-1" />

        {status.hasError && (
          <span
            className="text-rose-300"
            title={status.errorMessage ?? undefined}
          >
            Error
          </span>
        )}
        {status.isSaving && (
          <span className="italic text-white/50">Saving…</span>
        )}
        {(status.isLoading || status.worldMetadataLoading) && !status.hasError && (
          <span className="italic text-white/30">Loading…</span>
        )}

        <span
          className={`rounded border px-2 py-0.5 font-semibold ${TONE_CLASS[mode.tone]}`}
          title={mode.detail}
        >
          {mode.shortLabel}
        </span>
      </div>

      {/* Row 2: Compact roster count · cap posture (cap posture navigates to Cap Sheet) */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-white/40">
        {roster.status === 'available' && (
          <span>Roster: {roster.count}</span>
        )}
        {roster.status === 'loading' && (
          <span className="italic">Roster loading…</span>
        )}
        {cap.status === 'available' && (
          <>
            {(roster.status === 'available' || roster.status === 'loading') && <Sep />}
            {onNavigateToCapSheet ? (
              <button
                type="button"
                onClick={onNavigateToCapSheet}
                className="flex items-center gap-2 hover:text-white/70 cursor-pointer"
                data-testid="cap-posture-nav-cap-sheet"
              >
                <CapSummary cap={cap} />
              </button>
            ) : (
              <CapSummary cap={cap} />
            )}
          </>
        )}
        {cap.status === 'loading' && (
          <>
            {(roster.status === 'available' || roster.status === 'loading') && <Sep />}
            <span className="italic">Cap loading…</span>
          </>
        )}
      </div>

      {/* Row 3: Franchise summary indicators — exceptions, draft assets, activity */}
      <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-white/5 pt-1.5 text-white/30">
        {exceptions.status === 'available' && exceptions.hasAnyActive ? (
          onNavigateToCapSheet ? (
            <button
              type="button"
              onClick={onNavigateToCapSheet}
              className="hover:text-white/60 cursor-pointer"
              data-testid="exceptions-nav-cap-sheet"
            >
              <ExceptionLine
                exc={exceptions}
                seasonMismatch={seasons.viewingSeasonDiffersFromWorldSeason === true}
              />
            </button>
          ) : (
            <ExceptionLine
              exc={exceptions}
              seasonMismatch={seasons.viewingSeasonDiffersFromWorldSeason === true}
            />
          )
        ) : exceptions.status === 'loading' ? (
          <span className="italic">Exceptions loading…</span>
        ) : (
          <span>Exceptions: see Cap Sheet</span>
        )}
        <span>Draft picks: see Trade & History</span>
        <span>Activity: see History</span>
      </div>
    </div>
  );
};
