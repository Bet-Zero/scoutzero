/**
 * FILE: src/tests/architect/leagueView.loadingBoundary.behavior.test.tsx
 * PURPOSE: Focused League View shell and loading-boundary behavior coverage.
 * OWNERSHIP: Feature: architect/shared/LeagueView
 *
 * @vitest-environment jsdom
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import LeagueView from '@/features/architect/shared/LeagueView/LeagueView';
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
}));

vi.mock('@/shared/components/TeamLogo', () => ({
  __esModule: true,
  default: ({ teamId }: { teamId?: string }) => (
    <div data-testid={`team-logo-${teamId || 'unknown'}`} />
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );

  return {
    ...actual,
    useNavigate: () => navigationMocks.navigate,
  };
});

const readLeagueViewSource = (fileName: string) =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      'src/features/architect/shared/LeagueView',
      fileName
    ),
    'utf8'
  );

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

    expect(shellSource).toContain('LeagueViewTruthPanel');
    expect(shellSource).toContain('LeagueConferenceTable');
    expect(shellSource).toContain('useLeagueTeamSummaries');
    expect(shellSource).toContain('loadError={loadError}');
    expect(shellSource).not.toMatch(
      /loadTeamCapSheet|computeTeamCapTotals|getDefaultSeasonEndYear|toSeasonCode|TeamListFull|useEffect|useMemo|useState|<table|<thead|<tbody|TeamLogo|totalSalary|sourceState/
    );

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
    expect(truthPanelSource).toContain('League read failed');
    expect(truthPanelSource).not.toMatch(/loadTeamCapSheet|computeTeamCapTotals/);

    expect(tableSource).toContain('Not loaded');
    expect(tableSource).toContain('sourceState');
    expect(tableSource).toContain('sourceLabel');
    expect(tableSource).not.toMatch(/loadTeamCapSheet|computeTeamCapTotals/);
  });

  it('resolves season/source/totals labels through the canonical model boundary', () => {
    const season = resolveLeagueViewSeason();

    expect(seasonFormatMocks.getDefaultSeasonEndYear).toHaveBeenCalledTimes(1);
    expect(seasonFormatMocks.toSeasonCode).toHaveBeenCalledWith(2026);
    expect(season).toEqual({
      endYear: 2026,
      seasonCode: '2025-26',
      seasonSourceLabel: 'Default current season',
      sourceBoundaryLabel: 'Read-only base team snapshots',
      totalsBoundaryLabel: 'computeTeamCapTotals totalCapAllocations',
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
      expect(truthPanel).toHaveTextContent('Read-only base team snapshots');
      expect(truthPanel).toHaveTextContent(
        'computeTeamCapTotals totalCapAllocations'
      );
      expect(truthPanel).toHaveTextContent('1 of 2 team snapshots loaded');
    });

    const lakersRow = screen.getByTestId('league-view-team-row-lakers');
    expect(lakersRow).toHaveTextContent('Los Angeles Lakers');
    expect(lakersRow).toHaveTextContent('$123,456,789');
    expect(lakersRow).toHaveTextContent('Loaded');
    expect(capTotalsMocks.computeTeamCapTotals).toHaveBeenCalledWith(
      expect.objectContaining({ teamCode: 'LAL' }),
      2026
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
          totalSalary: 22_000_001,
          sourceState: 'loaded',
          sourceLabel: 'Loaded',
        })
      );

      firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockResolvedValueOnce(null);

      await expect(loadLeagueTeamSummary(team, season)).resolves.toEqual(
        expect.objectContaining({
          id: 'hawks',
          totalSalary: null,
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
          totalSalary: null,
          sourceState: 'unavailable',
          sourceLabel: 'Unavailable',
          failureReason: 'Permission denied',
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
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
        totalSalary: 100,
        conference: 'West',
        sourceState: 'loaded',
        sourceLabel: 'Loaded',
      },
      {
        id: 'celtics',
        code: 'BOS',
        teamName: 'Boston Celtics',
        totalSalary: null,
        conference: 'East',
        sourceState: 'unavailable',
        sourceLabel: 'Unavailable',
      },
      {
        id: 'hawks',
        code: 'ATL',
        teamName: 'Atlanta Hawks',
        totalSalary: 200,
        conference: 'East',
        sourceState: 'loaded',
        sourceLabel: 'Loaded',
      },
    ];

    const grouped = groupLeagueTeamSummaries(summaries);

    expect(grouped.eastTeams).toEqual([
      expect.objectContaining({
        id: 'hawks',
        totalSalary: 200,
        sourceState: 'loaded',
      }),
      expect.objectContaining({
        id: 'celtics',
        totalSalary: null,
        sourceState: 'unavailable',
      }),
    ]);
    expect(grouped.westTeams).toEqual([
      expect.objectContaining({
        id: 'lakers',
        totalSalary: 100,
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
    expect(truthPanel).toHaveTextContent('Read-only base team snapshots');
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
