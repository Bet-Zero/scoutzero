import type { LeagueViewSeason } from './leagueViewModel';

type LeagueViewTruthPanelProps = {
  season: LeagueViewSeason;
  loadState: 'loading' | 'ready' | 'error';
  loadedCount: number;
  totalCount: number;
  unavailableCount: number;
  loadError: string | null;
};

export const LeagueViewTruthPanel = ({
  season,
  loadState,
  loadedCount,
  totalCount,
  unavailableCount,
  loadError,
}: LeagueViewTruthPanelProps) => {
  const sourceSummary =
    loadState === 'loading'
      ? 'Loading read-only team snapshots.'
      : `${loadedCount} of ${totalCount} team snapshots loaded.`;
  const unavailableSummary =
    unavailableCount > 0
      ? `${unavailableCount} unavailable rows remain marked as unavailable.`
      : 'No degraded rows.';

  return (
    <section
      data-testid="league-view-truth-panel"
      className="mt-6 rounded border border-white/10 bg-[#151515] px-3 py-2 text-sm text-neutral-200"
      aria-live="polite"
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <p>
          <span className="font-semibold text-white">Season:</span>{' '}
          {season.seasonCode} ({season.seasonSourceLabel})
        </p>
        <p>
          <span className="font-semibold text-white">Source:</span>{' '}
          {season.sourceBoundaryLabel}
        </p>
        <p>
          <span className="font-semibold text-white">Totals:</span>{' '}
          {season.totalsBoundaryLabel}
        </p>
      </div>
      <p className="mt-2 text-neutral-300">
        {sourceSummary} {unavailableSummary}
      </p>
      {loadError ? (
        <p className="mt-2 text-amber-200">League read failed: {loadError}</p>
      ) : null}
    </section>
  );
};
