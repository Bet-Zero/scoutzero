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

  it('keeps League View on the canonical seasonFormat import boundary', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/features/architect/shared/LeagueView/leagueViewModel.ts'
      ),
      'utf8'
    );

    expect(source).toContain(
      "@/features/architect/utils/seasonFormat"
    );
    expect(source).not.toContain(
      "@/features/architect/utils/seasonUtils"
    );
  });
});
