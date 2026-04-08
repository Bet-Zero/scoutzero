import { useEffect, useMemo, useState } from 'react';
import {
  countLoadedLeagueViewTeams,
  countUnavailableLeagueViewTeams,
  groupLeagueTeamSummaries,
  loadLeagueTeamSummaries,
  resolveLeagueViewSeason,
  type LeagueViewConferenceSummaries,
  type LeagueViewSeason,
  type LeagueViewTeamSummary,
} from './leagueViewModel';

type LeagueViewLoadState = 'loading' | 'ready' | 'error';

type LeagueTeamSummaryState = {
  loadState: LeagueViewLoadState;
  summaries: LeagueViewTeamSummary[];
  loadError: string | null;
};

export type LeagueTeamSummaryResult = LeagueTeamSummaryState & {
  season: LeagueViewSeason;
  conferences: LeagueViewConferenceSummaries;
  loadedCount: number;
  unavailableCount: number;
};

export const useLeagueTeamSummaries = (): LeagueTeamSummaryResult => {
  const season = useMemo(() => resolveLeagueViewSeason(), []);
  const [state, setState] = useState<LeagueTeamSummaryState>({
    loadState: 'loading',
    summaries: [],
    loadError: null,
  });

  useEffect(() => {
    let isMounted = true;

    setState({
      loadState: 'loading',
      summaries: [],
      loadError: null,
    });

    loadLeagueTeamSummaries(season)
      .then((summaries) => {
        if (!isMounted) return;

        setState({
          loadState: 'ready',
          summaries,
          loadError: null,
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setState({
          loadState: 'error',
          summaries: [],
          loadError:
            error instanceof Error
              ? error.message
              : 'League team read failed.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [season]);

  const conferences = useMemo(
    () => groupLeagueTeamSummaries(state.summaries),
    [state.summaries]
  );
  const loadedCount = useMemo(
    () => countLoadedLeagueViewTeams(state.summaries),
    [state.summaries]
  );
  const unavailableCount = useMemo(
    () => countUnavailableLeagueViewTeams(state.summaries),
    [state.summaries]
  );

  return {
    ...state,
    season,
    conferences,
    loadedCount,
    unavailableCount,
  };
};
