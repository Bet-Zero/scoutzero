import { useNavigate } from 'react-router-dom';
import { LeagueConferenceTable } from './LeagueConferenceTable';
import { LeagueViewTruthPanel } from './LeagueViewTruthPanel';
import { LEAGUE_VIEW_TOTAL_TEAMS } from './leagueViewModel';
import { useLeagueTeamSummaries } from './useLeagueTeamSummaries';

export const LeagueView = () => {
  const navigate = useNavigate();
  const {
    season,
    conferences,
    loadState,
    loadedCount,
    unavailableCount,
    loadError,
  } = useLeagueTeamSummaries();

  const goToTeam = (teamSlug: string) => {
    // Team handoff is route identity only; GMDashboard re-owns active season state.
    navigate(`/gm/${teamSlug}`);
  };

  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold -mb-6">
        HoopZero Architect – League View
      </h1>
      <LeagueViewTruthPanel
        season={season}
        loadState={loadState}
        loadedCount={loadedCount}
        totalCount={LEAGUE_VIEW_TOTAL_TEAMS}
        unavailableCount={unavailableCount}
        loadError={loadError}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-12 mb-20">
        <LeagueConferenceTable
          title="Eastern Conference"
          teams={conferences.eastTeams}
          totalsLabel={season.totalsDisplayLabel}
          teamHandoffBoundaryLabel={season.teamHandoffBoundaryLabel}
          onManageTeam={goToTeam}
        />
        <LeagueConferenceTable
          title="Western Conference"
          teams={conferences.westTeams}
          totalsLabel={season.totalsDisplayLabel}
          teamHandoffBoundaryLabel={season.teamHandoffBoundaryLabel}
          onManageTeam={goToTeam}
        />
      </div>
    </div>
  );
};

