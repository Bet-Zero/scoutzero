// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const buildTeam = () => ({
  teamCode: 'ATL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
});

describe('Team History render sections', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all sections with non-empty deterministic entries after fixture injection', () => {
    const teamCapSheet = injectTeamHistoryFixtures(buildTeam());

    render(
      <TeamHistoryTab
        teamCapSheet={teamCapSheet}
        hasInjectedTeamHistoryFixtures
        worldId="world_atl"
      />
    );

    expect(screen.getByTestId('team-history-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-waived-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-tpe-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-mle-row-0')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-pick-log-row-0')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-current-picks-row-2027')
    ).toBeInTheDocument();
  });

  it('keeps timeline sorted newest-first by timestamp', () => {
    const teamCapSheet = injectTeamHistoryFixtures(buildTeam());

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_atl" />);

    const row0 = screen.getByTestId('team-history-event-row-0');
    const row1 = screen.getByTestId('team-history-event-row-1');

    expect(row0).toHaveTextContent('2026-02-10T14:00:00.000Z');
    expect(row1).toHaveTextContent('2026-02-09T18:30:00.000Z');
  });
});
