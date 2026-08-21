/**
 * FILE: src/tests/architect/leagueView.loadingBoundary.behavior.test.tsx
 * PURPOSE: Focused League View shell and loading-boundary behavior coverage.
 * OWNERSHIP: Feature: architect/shared/LeagueView
 *
 * @vitest-environment jsdom
 */

import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LeagueView } from '@/features/architect/shared/LeagueView/LeagueView';
import { LeagueViewTruthPanel } from '@/features/architect/shared/LeagueView/LeagueViewTruthPanel';
import {
  groupLeagueTeamSummaries,
  loadLeagueTeamSummary,
  resolveLeagueViewSeason,
  type LeagueViewTeamSummary,
} from '@/features/architect/shared/LeagueView/leagueViewModel';

const teamListMocks = vi.hoisted(() => ({
  TeamListFull: [
    {
      id: 'hawks',
      code: 'ATL',
      teamName: 'Atlanta Hawks',
      conference: 'East',
    },
    {
      id: 'lakers',
      code: 'LAL',
      teamName: 'Los Angeles Lakers',
      conference: 'West',
    },
  ],
}));

const firebaseTeamPlanHelperMocks = vi.hoisted(() => ({
  loadTeamCapSheet: vi.fn(),
}));

const capTotalsMocks = vi.hoisted(() => ({
  computeTeamCapTotals: vi.fn(),
}));

const seasonFormatMocks = vi.hoisted(() => ({
  getDefaultSeasonEndYear: vi.fn(),
  toSeasonCode: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('@/constants/teamList', () => ({
  TeamListFull: teamListMocks.TeamListFull,
}));

vi.mock('@/features/architect/utils/firebaseTeamPlanHelpers', () => ({
  loadTeamCapSheet: firebaseTeamPlanHelperMocks.loadTeamCapSheet,
}));

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  computeTeamCapTotals: capTotalsMocks.computeTeamCapTotals,
}));

vi.mock('@/features/architect/utils/seasonFormat', () => ({
  getDefaultSeasonEndYear: seasonFormatMocks.getDefaultSeasonEndYear,
  toSeasonCode: seasonFormatMocks.toSeasonCode,
  // toSeasonKey delegates to toSeasonCode in the real module; alias it so the
  // refactored LeagueView import resolves against this mock.
  toSeasonKey: seasonFormatMocks.toSeasonCode,
}));

vi.mock('@/shared/components/TeamLogo', () => {
  const TeamLogo = ({ teamId }: { teamId?: string }) => (
    <div data-testid={`team-logo-${teamId || 'unknown'}`} />
  );
  return { __esModule: true, default: TeamLogo, TeamLogo };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );

  return {
    ...actual,
    useNavigate: () => navigationMocks.navigate,
  };
});

const readSourceFile = (...segments: string[]) =>
  fs.readFileSync(
    path.join(process.cwd(), ...segments),
    'utf8'
  );

const readLeagueViewSource = (fileName: string) =>
  readSourceFile('src/features/architect/shared/LeagueView', fileName);

const readGMDashboardSource = () =>
  readSourceFile('src/features/architect/GMDashboard/GMDashboard.tsx');

const readLeagueViewProductionSources = () => ({
  model: readLeagueViewSource('leagueViewModel.ts'),
  hook: readLeagueViewSource('useLeagueTeamSummaries.ts'),
  truthPanel: readLeagueViewSource('LeagueViewTruthPanel.tsx'),
  table: readLeagueViewSource('LeagueConferenceTable.tsx'),
  shell: readLeagueViewSource('LeagueView.tsx'),
  dashboard: readGMDashboardSource(),
});

const readExportedConstSource = (source: string, exportName: string) => {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing source marker: ${marker}`);
  }

  const nextExport = source.indexOf('\nexport const ', start + marker.length);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
};

const readLocalConstSourceBeforeReturn = (
  source: string,
  constName: string
) => {
  const marker = `const ${constName} =`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing source marker: ${marker}`);
  }

  const nextReturn = source.indexOf('\n  return', start + marker.length);
  return source.slice(start, nextReturn === -1 ? source.length : nextReturn);
};

describe('LeagueView loading-boundary behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seasonFormatMocks.getDefaultSeasonEndYear.mockReturnValue(2026);
    seasonFormatMocks.toSeasonCode.mockReturnValue('2025-26');
    firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockImplementation(
      async (teamCode: string) => {
        if (teamCode === 'ATL') {
          return null;
        }

        return {
          teamCode,
          players: [],
          capHolds: [],
          deadCap: [],
        };
      }
    );
    capTotalsMocks.computeTeamCapTotals.mockReturnValue({
      totalCapAllocations: 123_456_789,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps top-level LeagueView ownership as a composition shell', () => {
    const shellSource = readLeagueViewSource('LeagueView.tsx');
    const modelSource = readLeagueViewSource('leagueViewModel.ts');
    const hookSource = readLeagueViewSource('useLeagueTeamSummaries.ts');
    const truthPanelSource = readLeagueViewSource('LeagueViewTruthPanel.tsx');
    const tableSource = readLeagueViewSource('LeagueConferenceTable.tsx');
    const dashboardSource = readGMDashboardSource();

    expect(shellSource).toContain('LeagueViewTruthPanel');
    expect(shellSource).toContain('LeagueConferenceTable');
    expect(shellSource).toContain('useLeagueTeamSummaries');
    expect(shellSource).toContain('loadError={loadError}');
    expect(shellSource).not.toMatch(
      /loadTeamCapSheet|computeTeamCapTotals|getDefaultSeasonEndYear|toSeasonCode|TeamListFull|useEffect|useMemo|useState|<table|<thead|<tbody|TeamLogo|totalSalary|totalCapAllocations|sourceState/
    );
    expect(shellSource).toContain('teamHandoffBoundaryLabel');

    expect(hookSource).toMatch(/useEffect|useMemo|useState/);
    expect(hookSource).toContain('loadLeagueTeamSummaries');
    expect(hookSource).toContain('groupLeagueTeamSummaries');
    expect(hookSource).not.toMatch(
      /loadTeamCapSheet|computeTeamCapTotals|getDefaultSeasonEndYear|toSeasonCode|TeamListFull/
    );

    expect(modelSource).toContain('loadTeamCapSheet');
    expect(modelSource).toContain('computeTeamCapTotals');
    expect(modelSource).toContain("@/features/architect/utils/seasonFormat");
    expect(modelSource).toContain('totalCapAllocations');
    expect(modelSource).not.toMatch(/useEffect|useMemo|useState|<table|TeamLogo/);

    expect(truthPanelSource).toMatch(/Season:|Source:|Totals:/);
    expect(truthPanelSource).toContain('totalsDisplayLabel');
    expect(truthPanelSource).toContain('presentationBoundaryLabel');
    expect(truthPanelSource).toContain('teamHandoffBoundaryLabel');
    expect(truthPanelSource).toContain('League read failed');
    expect(truthPanelSource).not.toMatch(/loadTeamCapSheet|computeTeamCapTotals/);

    expect(tableSource).toContain('Not loaded');
    expect(tableSource).toContain('totalsLabel');
    expect(tableSource).toContain('totalCapAllocations');
    expect(tableSource).toContain('teamHandoffBoundaryLabel');
    expect(tableSource).not.toContain('Total Salary');
    expect(tableSource).toContain('sourceState');
    expect(tableSource).toContain('sourceLabel');
    expect(tableSource).not.toMatch(/loadTeamCapSheet|computeTeamCapTotals/);

    expect(dashboardSource).toContain(
      'League View enters here with team identity only'
    );
  });

  it('resolves season/source/totals labels through the canonical model boundary', () => {
    const season = resolveLeagueViewSeason();

    expect(seasonFormatMocks.getDefaultSeasonEndYear).toHaveBeenCalledTimes(1);
    expect(seasonFormatMocks.toSeasonCode).toHaveBeenCalledWith(2026);
    expect(season).toEqual({
      endYear: 2026,
      asOfDate: null,
      seasonCode: '2025-26',
      seasonSourceLabel: 'Default current season',
      sourceBoundaryLabel: 'Read-only base team snapshots after sign-in',
      totalsDisplayLabel: 'Total Cap Allocations',
      totalsBoundaryLabel: 'computeTeamCapTotals totalCapAllocations',
      presentationBoundaryLabel:
        'Conference grouping and alphabetical order only; totals are not recomputed.',
      teamHandoffBoundaryLabel:
        'Manage Team opens the saved-world launcher for this team; sandbox is local preview only.',
    });
  });

  it('surfaces season, read-only source, and canonical totals boundaries', async () => {
    render(<LeagueView />);

    await waitFor(() => {
      expect(firebaseTeamPlanHelperMocks.loadTeamCapSheet).toHaveBeenCalledTimes(2);
    });

    const truthPanel = screen.getByTestId('league-view-truth-panel');
    await waitFor(() => {
      expect(truthPanel).toHaveTextContent('Season: 2025-26');
      expect(truthPanel).toHaveTextContent('Default current season');
      expect(truthPanel).toHaveTextContent('Read-only base team snapshots after sign-in');
      expect(truthPanel).toHaveTextContent('Total Cap Allocations');
      expect(truthPanel).toHaveTextContent(
        'computeTeamCapTotals totalCapAllocations'
      );
      expect(truthPanel).toHaveTextContent(
        'Conference grouping and alphabetical order only'
      );
      expect(truthPanel).toHaveTextContent(
        'saved-world launcher'
      );
      expect(truthPanel).toHaveTextContent('1 of 2 team snapshots loaded');
    });

    expect(screen.getAllByText('Total Cap Allocations').length).toBeGreaterThan(0);
    expect(screen.queryByText('Total Salary')).not.toBeInTheDocument();

    const lakersRow = screen.getByTestId('league-view-team-row-lakers');
    expect(lakersRow).toHaveTextContent('Los Angeles Lakers');
    expect(lakersRow).toHaveTextContent('$123,456,789');
    expect(lakersRow).toHaveTextContent('Loaded');
    expect(capTotalsMocks.computeTeamCapTotals).toHaveBeenCalledWith(
      expect.objectContaining({ teamCode: 'LAL' }),
      2026,
      { asOfDate: null }
    );
  });

  it('keeps Manage Team as a team-identity handoff while dashboard owns season state', async () => {
    render(<LeagueView />);

    const lakersManageButton = await screen.findByRole('button', {
      name: /Manage Los Angeles Lakers.*saved-world launcher/i,
    });

    expect(lakersManageButton).toHaveAttribute(
      'title',
      'Manage Team opens the saved-world launcher for this team; sandbox is local preview only.'
    );

    fireEvent.click(lakersManageButton);

    expect(navigationMocks.navigate).toHaveBeenCalledTimes(1);
    // Cockpit deep-link: the route PATH carries team identity ('lakers'); the
    // season/room query params are view hints the GM desk reads on load (the
    // dashboard still owns season state). See useArchitectDeskNavigation.
    expect(navigationMocks.navigate.mock.calls[0][0]).toMatch(
      /^\/gm\/lakers\?season=\d{4}&room=roster$/
    );
  });

  it('keeps model summaries honest for loaded, missing, and failed team reads', async () => {
    const season = resolveLeagueViewSeason();
    const team = {
      id: 'hawks',
      code: 'ATL',
      teamName: 'Atlanta Hawks',
      conference: 'East',
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockResolvedValueOnce({
        teamCode: 'ATL',
        players: [],
        capHolds: [],
        deadCap: [],
      });
      capTotalsMocks.computeTeamCapTotals.mockReturnValueOnce({
        totalCapAllocations: 22_000_001,
      });

      await expect(loadLeagueTeamSummary(team, season)).resolves.toEqual(
        expect.objectContaining({
          id: 'hawks',
          totalCapAllocations: 22_000_001,
          sourceState: 'loaded',
          sourceLabel: 'Loaded',
        })
      );

      firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockResolvedValueOnce(null);

      await expect(loadLeagueTeamSummary(team, season)).resolves.toEqual(
        expect.objectContaining({
          id: 'hawks',
          totalCapAllocations: null,
          sourceState: 'unavailable',
          sourceLabel: 'Unavailable',
          failureReason: 'Read-only base team cap sheet was not returned.',
        })
      );

      firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await expect(loadLeagueTeamSummary(team, season)).resolves.toEqual(
        expect.objectContaining({
          id: 'hawks',
          totalCapAllocations: null,
          sourceState: 'unavailable',
          sourceLabel: 'Unavailable',
          failureReason: 'Permission denied',
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('forwards an exact governed date through the League View total boundary', async () => {
    const season = {
      ...resolveLeagueViewSeason(),
      asOfDate: '2026-07-01T12:00:00-04:00',
    };
    const team = {
      id: 'lakers',
      code: 'LAL',
      teamName: 'Los Angeles Lakers',
      conference: 'West',
    };

    await loadLeagueTeamSummary(team, season);

    expect(capTotalsMocks.computeTeamCapTotals).toHaveBeenCalledWith(
      expect.objectContaining({ teamCode: 'LAL' }),
      2026,
      { asOfDate: '2026-07-01T12:00:00-04:00' }
    );
  });

  it('marks failed team reads as unavailable instead of zero-value league truth', async () => {
    render(<LeagueView />);

    const hawksRow = await screen.findByTestId('league-view-team-row-hawks');
    expect(within(hawksRow).getByText('Atlanta Hawks')).toBeInTheDocument();
    expect(hawksRow).toHaveTextContent('Not loaded');
    expect(hawksRow).toHaveTextContent('Unavailable');
    expect(hawksRow).not.toHaveTextContent('$0');

    const truthPanel = screen.getByTestId('league-view-truth-panel');
    await waitFor(() => {
      expect(truthPanel).toHaveTextContent(
        '1 unavailable rows remain marked as unavailable'
      );
    });
  });

  it('preserves loaded and unavailable truth while grouping conference output', () => {
    const summaries: LeagueViewTeamSummary[] = [
      {
        id: 'lakers',
        code: 'LAL',
        teamName: 'Los Angeles Lakers',
        totalCapAllocations: 100,
        conference: 'West',
        sourceState: 'loaded',
        sourceLabel: 'Loaded',
      },
      {
        id: 'celtics',
        code: 'BOS',
        teamName: 'Boston Celtics',
        totalCapAllocations: null,
        conference: 'East',
        sourceState: 'unavailable',
        sourceLabel: 'Unavailable',
      },
      {
        id: 'hawks',
        code: 'ATL',
        teamName: 'Atlanta Hawks',
        totalCapAllocations: 200,
        conference: 'East',
        sourceState: 'loaded',
        sourceLabel: 'Loaded',
      },
    ];

    const grouped = groupLeagueTeamSummaries(summaries);

    expect(grouped.eastTeams).toEqual([
      expect.objectContaining({
        id: 'hawks',
        totalCapAllocations: 200,
        sourceState: 'loaded',
      }),
      expect.objectContaining({
        id: 'celtics',
        totalCapAllocations: null,
        sourceState: 'unavailable',
      }),
    ]);
    expect(grouped.westTeams).toEqual([
      expect.objectContaining({
        id: 'lakers',
        totalCapAllocations: 100,
        sourceState: 'loaded',
      }),
    ]);
  });

  it('keeps top-level load errors visible in the truth panel', () => {
    render(
      <LeagueViewTruthPanel
        season={resolveLeagueViewSeason()}
        loadState="error"
        loadedCount={0}
        totalCount={2}
        unavailableCount={0}
        loadError="League snapshot query failed."
      />
    );

    const truthPanel = screen.getByTestId('league-view-truth-panel');
    expect(truthPanel).toHaveTextContent('Season: 2025-26');
    expect(truthPanel).toHaveTextContent('Read-only base team snapshots after sign-in');
    expect(truthPanel).toHaveTextContent('0 of 2 team snapshots loaded');
    expect(truthPanel).toHaveTextContent(
      'League read failed: League snapshot query failed.'
    );
  });

  it('keeps League View on the canonical seasonFormat import boundary', () => {
    const source = readLeagueViewSource('leagueViewModel.ts');

    expect(source).toContain(
      "@/features/architect/utils/seasonFormat"
    );
    expect(source).not.toContain(
      "@/features/architect/utils/seasonUtils"
    );
  });
});

describe('LeagueView Step 2 closeout guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seasonFormatMocks.getDefaultSeasonEndYear.mockReturnValue(2026);
    seasonFormatMocks.toSeasonCode.mockReturnValue('2025-26');
    firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockImplementation(
      async (teamCode: string) => {
        if (teamCode === 'ATL') {
          return null;
        }

        return {
          teamCode,
          players: [],
          capHolds: [],
          deadCap: [],
        };
      }
    );
    capTotalsMocks.computeTeamCapTotals.mockReturnValue({
      totalCapAllocations: 123_456_789,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('pins the visible totals display contract to canonical cap allocations', async () => {
    const sources = readLeagueViewProductionSources();

    expect(sources.model).toContain(
      "LEAGUE_VIEW_TOTALS_DISPLAY_LABEL = 'Total Cap Allocations'"
    );
    expect(sources.model).toContain(
      'totalCapAllocations: capTotals.totalCapAllocations'
    );
    expect(sources.model).not.toContain('totalSalary');
    expect(sources.table).toContain('formatCapAllocations');
    expect(sources.table).toContain('team.totalCapAllocations');
    expect(sources.table).toContain('<th className="p-2 text-left">{totalsLabel}</th>');
    expect(sources.table).not.toContain('Total Salary');
    expect(sources.truthPanel).toContain('season.totalsDisplayLabel');
    expect(sources.truthPanel).toContain('season.totalsBoundaryLabel');

    render(<LeagueView />);

    const truthPanel = await screen.findByTestId('league-view-truth-panel');
    await waitFor(() => {
      expect(truthPanel).toHaveTextContent(
        'Total Cap Allocations (computeTeamCapTotals totalCapAllocations)'
      );
    });

    const lakersRow = screen.getByTestId('league-view-team-row-lakers');
    expect(within(lakersRow).getByText('$123,456,789')).toBeInTheDocument();
    expect(lakersRow).toHaveTextContent('Loaded');
    expect(capTotalsMocks.computeTeamCapTotals).toHaveBeenCalledWith(
      expect.objectContaining({ teamCode: 'LAL' }),
      2026,
      { asOfDate: null }
    );

    const hawksRow = screen.getByTestId('league-view-team-row-hawks');
    expect(hawksRow).toHaveTextContent('Not loaded');
    expect(hawksRow).toHaveTextContent('Unavailable');
    expect(hawksRow).not.toHaveTextContent('$0');

    expect(screen.getAllByText('Total Cap Allocations').length).toBeGreaterThan(0);
    expect(screen.queryByText('Total Salary')).not.toBeInTheDocument();
  });

  it('pins conference grouping and sorting as presentation-only consumer behavior', () => {
    const sources = readLeagueViewProductionSources();
    const groupSource = readExportedConstSource(
      sources.model,
      'groupLeagueTeamSummaries'
    );

    expect(sources.hook).toContain('groupLeagueTeamSummaries(state.summaries)');
    expect(groupSource).toContain(
      'Presentation-only transform: preserve shaped summary rows and only split/order them.'
    );
    expect(groupSource).toContain(
      ".filter((team) => team.conference === conference)"
    );
    expect(groupSource).toContain('.sort(sortByTeamName)');
    expect(groupSource).toContain('teamName.localeCompare');
    expect(groupSource).not.toMatch(
      /computeTeamCapTotals|loadTeamCapSheet|totalCapAllocations\s*:|sourceState\s*:|\.map\(|\.reduce\(|structuredClone|JSON\.parse|JSON\.stringify/
    );

    const eastLoaded: LeagueViewTeamSummary = {
      id: 'celtics',
      code: 'BOS',
      teamName: 'Boston Celtics',
      totalCapAllocations: 200,
      conference: 'East',
      sourceState: 'loaded',
      sourceLabel: 'Loaded',
    };
    const westLoaded: LeagueViewTeamSummary = {
      id: 'lakers',
      code: 'LAL',
      teamName: 'Los Angeles Lakers',
      totalCapAllocations: 100,
      conference: 'West',
      sourceState: 'loaded',
      sourceLabel: 'Loaded',
    };
    const eastUnavailable: LeagueViewTeamSummary = {
      id: 'hawks',
      code: 'ATL',
      teamName: 'Atlanta Hawks',
      totalCapAllocations: null,
      conference: 'East',
      sourceState: 'unavailable',
      sourceLabel: 'Unavailable',
      failureReason: 'Read failed.',
    };

    const grouped = groupLeagueTeamSummaries([
      eastLoaded,
      westLoaded,
      eastUnavailable,
    ]);

    expect(grouped.eastTeams).toEqual([eastUnavailable, eastLoaded]);
    expect(grouped.westTeams).toEqual([westLoaded]);
    expect(grouped.eastTeams[0]).toBe(eastUnavailable);
    expect(grouped.eastTeams[1]).toBe(eastLoaded);
    expect(grouped.westTeams[0]).toBe(westLoaded);
    expect(grouped.eastTeams[0]).toMatchObject({
      totalCapAllocations: null,
      sourceState: 'unavailable',
      failureReason: 'Read failed.',
    });
    expect(grouped.eastTeams[1]).toMatchObject({
      totalCapAllocations: 200,
      sourceState: 'loaded',
    });
  });

  it('pins Manage Team as route-only team handoff with dashboard-owned season state', async () => {
    const sources = readLeagueViewProductionSources();
    const goToTeamSource = readLocalConstSourceBeforeReturn(
      sources.shell,
      'goToTeam'
    );

    // Cockpit deep-link architecture (useArchitectDeskNavigation documents
    // ?season=/?room=/?player= as shareable entry hints): the route PATH carries
    // team identity while ?season=&room= are view hints the desk reads on entry.
    // The dashboard remains the runtime owner of season state — the URL is an
    // entry hint, not the source of truth.
    expect(goToTeamSource).toContain(
      'navigate(`/gm/${teamSlug}?season=${viewingYear}&room=roster`);'
    );
    expect(goToTeamSource).toContain('readPersistedViewingSeasonEndYear()');
    expect(sources.table).toContain('aria-label={`Manage ${team.teamName}. ${teamHandoffBoundaryLabel}`}');
    expect(sources.table).toContain('title={teamHandoffBoundaryLabel}');
    expect(sources.truthPanel).toContain('season.teamHandoffBoundaryLabel');
    expect(sources.dashboard).toContain(
      'League View enters here with team identity only; this dashboard owns selected season state.'
    );
    expect(sources.dashboard).not.toMatch(
      /useLocation|location\.state|URLSearchParams|leagueViewSeason|fromLeagueView/
    );

    render(<LeagueView />);

    const lakersManageButton = await screen.findByRole('button', {
      name: /Manage Los Angeles Lakers.*saved-world launcher/i,
    });

    fireEvent.click(lakersManageButton);

    expect(navigationMocks.navigate).toHaveBeenCalledTimes(1);
    expect(navigationMocks.navigate.mock.calls[0][0]).toMatch(
      /^\/gm\/lakers\?season=\d{4}&room=roster$/
    );
    expect(navigationMocks.navigate.mock.calls[0][1]).toBeUndefined();
  });
});
