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

export type LeagueViewSeason = {
  endYear: number;
  seasonCode: string;
  seasonSourceLabel: string;
  sourceBoundaryLabel: string;
  totalsBoundaryLabel: string;
};

export type LeagueViewTeamSummary = {
  id: string;
  code?: string;
  teamName: string;
  totalSalary: number | null;
  conference?: string;
  sourceState: 'loaded' | 'unavailable';
  sourceLabel: string;
  failureReason?: string;
};

export type LeagueViewConferenceSummaries = {
  eastTeams: LeagueViewTeamSummary[];
  westTeams: LeagueViewTeamSummary[];
};

const teamsList = TeamListFull as LeagueViewTeamSource[];

export const LEAGUE_VIEW_TOTAL_TEAMS = teamsList.length;

export const resolveLeagueViewSeason = (): LeagueViewSeason => {
  const endYear = getDefaultSeasonEndYear();

  return {
    endYear,
    seasonCode: toSeasonCode(endYear),
    seasonSourceLabel: 'Default current season',
    sourceBoundaryLabel: 'Read-only base team snapshots',
    totalsBoundaryLabel: 'computeTeamCapTotals totalCapAllocations',
  };
};

const buildUnavailableTeamSummary = (
  team: LeagueViewTeamSource,
  failureReason: string
): LeagueViewTeamSummary => ({
  id: team.id,
  code: team.code,
  teamName: team.teamName,
  totalSalary: null,
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
      season.endYear
    );

    return {
      id: team.id,
      code: team.code,
      teamName: team.teamName,
      totalSalary: capTotals.totalCapAllocations,
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

  return {
    eastTeams: summaries
      .filter((team) => team.conference === 'East')
      .sort(sortByTeamName),
    westTeams: summaries
      .filter((team) => team.conference === 'West')
      .sort(sortByTeamName),
  };
};

export const countLoadedLeagueViewTeams = (
  summaries: LeagueViewTeamSummary[]
) => summaries.filter((team) => team.sourceState === 'loaded').length;

export const countUnavailableLeagueViewTeams = (
  summaries: LeagueViewTeamSummary[]
) => summaries.filter((team) => team.sourceState === 'unavailable').length;
