// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const seededTeam = injectTeamHistoryFixtures({
  teamCode: 'BOS',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
});

describe('Team History detail view integration', () => {
  it('opens detail modal from row click and closes cleanly', async () => {
    render(<TeamHistoryTab teamCapSheet={seededTeam} worldId="world_bos" />);

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-type')).toHaveTextContent(
      'trade · Trade Executed'
    );
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('2026-02-10T14:00:00.000Z');
    expect(screen.getByTestId('team-history-detail-teams')).toHaveTextContent(
      'BOS'
    );

    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('team-history-detail-modal')
      ).not.toBeInTheDocument();
    });
  });
});
