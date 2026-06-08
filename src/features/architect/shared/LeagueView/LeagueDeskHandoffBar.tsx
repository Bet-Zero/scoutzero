/**
 * FILE: src/features/architect/shared/LeagueView/LeagueDeskHandoffBar.tsx
 * PURPOSE: Light cockpit bar on league entry — shared viewing season + last team.
 * OWNERSHIP: Feature: architect/shared/LeagueView
 */
import { Link } from 'react-router-dom';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import { readLastTeamSlug, readPersistedViewingSeasonEndYear } from '@/features/architect/GMDashboard/hooks/useArchitectDeskNavigation';

interface LeagueDeskHandoffBarProps {
  seasonEndYear: number;
}

export const LeagueDeskHandoffBar = ({
  seasonEndYear,
}: LeagueDeskHandoffBarProps) => {
  const persistedSeason = readPersistedViewingSeasonEndYear();
  const viewingYear = persistedSeason ?? seasonEndYear;
  const lastTeam = readLastTeamSlug();
  const lastTeamHref = lastTeam
    ? `/gm/${lastTeam}?season=${viewingYear}&room=roster`
    : null;

  return (
    <div
      className="mb-6 rounded-lg border border-cockpit-edge bg-cockpit-slab px-4 py-3"
      data-testid="league-desk-handoff-bar"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-cockpit-text-secondary">
        <span>
          <span className="font-semibold uppercase tracking-wide text-cockpit-text-muted">
            Viewing season
          </span>{' '}
          <span className="text-cockpit-text-primary">
            {toSeasonKey(viewingYear)}
          </span>
        </span>
        {lastTeamHref ? (
          <Link
            to={lastTeamHref}
            className="font-medium text-cockpit-info hover:underline"
            data-testid="league-desk-handoff-last-team"
          >
            Return to last team ({lastTeam})
          </Link>
        ) : (
          <span className="text-cockpit-text-muted">
            Pick a team below to open the GM desk.
          </span>
        )}
      </div>
    </div>
  );
};
