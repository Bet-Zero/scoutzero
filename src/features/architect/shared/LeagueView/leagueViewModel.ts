import { TeamListFull } from '@/constants/teamList';
import {
  loadTeamCapSheet,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import {
  computeTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getDefaultSeasonEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';

type CapSheetInputLike = Parameters<typeof computeTeamCapTotals>[0];

type LeagueViewTeamSource = {
  id: string;
  code?: string;
  teamName: string;
  conference?: string;
};

export const LEAGUE_VIEW_TOTALS_DISPLAY_LABEL = 'Total Cap Allocations';
const LEAGUE_VIEW_TOTALS_BOUNDARY_LABEL =
  'computeTeamCapTotals totalCapAllocations';
const LEAGUE_VIEW_PRESENTATION_BOUNDARY_LABEL =
  'Conference grouping and alphabetical order only; totals are not recomputed.';
const LEAGUE_VIEW_TEAM_HANDOFF_BOUNDARY_LABEL =
  'Manage Team opens the saved-world launcher for this team; sandbox is local preview only.';

export type LeagueViewSeason = {
  endYear: number;
  asOfDate: string | null;
  seasonCode: string;
  seasonSourceLabel: string;
  sourceBoundaryLabel: string;
  totalsDisplayLabel: string;
  totalsBoundaryLabel: string;
  presentationBoundaryLabel: string;
  teamHandoffBoundaryLabel: string;
};

export type LeagueViewTeamSummary = {
  id: string;
  code?: string;
  teamName: string;
  totalCapAllocations: number | null;
  conference?: string;
  sourceState: 'loaded' | 'unavailable';
  sourceLabel: string;
  failureReason?: string;
};

export type LeagueViewConferenceSummaries = {
  eastTeams: LeagueViewTeamSummary[];
  westTeams: LeagueViewTeamSummary[];
};

const teamsList: readonly LeagueViewTeamSource[] = TeamListFull;

export const LEAGUE_VIEW_TOTAL_TEAMS = teamsList.length;

export const resolveLeagueViewSeason = (): LeagueViewSeason => {
  const endYear = getDefaultSeasonEndYear();

  return {
    endYear,
    asOfDate: null,
    seasonCode: toSeasonCode(endYear),
    seasonSourceLabel: 'Default current season',
    sourceBoundaryLabel: 'Read-only base team snapshots after sign-in',
    totalsDisplayLabel: LEAGUE_VIEW_TOTALS_DISPLAY_LABEL,
    totalsBoundaryLabel: LEAGUE_VIEW_TOTALS_BOUNDARY_LABEL,
    presentationBoundaryLabel: LEAGUE_VIEW_PRESENTATION_BOUNDARY_LABEL,
    teamHandoffBoundaryLabel: LEAGUE_VIEW_TEAM_HANDOFF_BOUNDARY_LABEL,
  };
};

const buildUnavailableTeamSummary = (
  team: LeagueViewTeamSource,
  failureReason: string
): LeagueViewTeamSummary => ({
  id: team.id,
  code: team.code,
  teamName: team.teamName,
  totalCapAllocations: null,
  conference: team.conference,
  sourceState: 'unavailable',
  sourceLabel: 'Unavailable',
  failureReason,
});

export const loadLeagueTeamSummary = async (
  team: LeagueViewTeamSource,
  season: LeagueViewSeason
): Promise<LeagueViewTeamSummary> => {
  try {
    const capSheet = await loadTeamCapSheet(team.code || team.id);

    if (!capSheet) {
      return buildUnavailableTeamSummary(
        team,
        'Read-only base team cap sheet was not returned.'
      );
    }

    const capTotals = computeTeamCapTotals(
      capSheet as CapSheetInputLike,
      season.endYear,
      { asOfDate: season.asOfDate }
    );

    return {
      id: team.id,
      code: team.code,
      teamName: team.teamName,
      totalCapAllocations: capTotals.totalCapAllocations,
      conference: team.conference,
      sourceState: 'loaded',
      sourceLabel: 'Loaded',
    };
  } catch (error) {
    console.warn(`Failed to load team ${team.code || team.id}:`, error);

    return buildUnavailableTeamSummary(
      team,
      error instanceof Error ? error.message : 'Team read failed.'
    );
  }
};

export const loadLeagueTeamSummaries = async (
  season: LeagueViewSeason
): Promise<LeagueViewTeamSummary[]> =>
  Promise.all(
    teamsList.map((team) => loadLeagueTeamSummary(team, season))
  );

export const groupLeagueTeamSummaries = (
  summaries: LeagueViewTeamSummary[]
): LeagueViewConferenceSummaries => {
  const sortByTeamName = (
    a: LeagueViewTeamSummary,
    b: LeagueViewTeamSummary
  ) => a.teamName.localeCompare(b.teamName);
  const buildConferenceRows = (conference: 'East' | 'West') =>
    summaries
      .filter((team) => team.conference === conference)
      .sort(sortByTeamName);

  // Presentation-only transform: preserve shaped summary rows and only split/order them.
  return {
    eastTeams: buildConferenceRows('East'),
    westTeams: buildConferenceRows('West'),
  };
};

export const countLoadedLeagueViewTeams = (
  summaries: LeagueViewTeamSummary[]
) => summaries.filter((team) => team.sourceState === 'loaded').length;

export const countUnavailableLeagueViewTeams = (
  summaries: LeagueViewTeamSummary[]
) => summaries.filter((team) => team.sourceState === 'unavailable').length;
