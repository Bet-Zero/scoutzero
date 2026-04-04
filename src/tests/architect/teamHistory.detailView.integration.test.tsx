// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  afterEach(() => {
    cleanup();
  });

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
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Explicit local timeline row'
    );
    expect(screen.getByTestId('team-history-detail-row-id')).toHaveTextContent(
      'th-fixture-trade-BOS'
    );
    expect(screen.getByTestId('team-history-detail-mutation-id')).toHaveTextContent(
      'mutation-trade-BOS-001'
    );
    expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent('—');
    expect(screen.getByTestId('team-history-detail-raw-summary')).toHaveTextContent(
      'No raw payload fields were carried on this selected entry.'
    );

    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('team-history-detail-modal')
      ).not.toBeInTheDocument();
    });
  });

  it('keeps normalized local-entry fields separate from conflicting raw payload fields', () => {
    render(
      <TeamHistoryTab
        worldId={null}
        teamCapSheet={{
          teamCode: 'BOS',
          waivedContracts: [],
          exceptionHistory: [],
          mleHistory: [],
          pickLog: [],
          currentPicks: {},
          historyTimeline: [
            {
              id: 'local-row-1',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-03-15T12:00:00.000Z',
              teamsInvolved: ['BOS'],
              teamCodes: ['BOS'],
              playerIds: ['player_normalized'],
              summary: 'Manual local row',
              primaryDeltas: 'Manual delta',
              mutationId: 'mutation_local_1',
              eventId: 'evt_local_1',
              operationId: 'op_local_1',
              raw: {
                eventId: 'evt_raw_different',
                operationId: 'op_raw_different',
                mutationType: 'waivePlayer',
                type: 'rawFallbackOnly',
                teamCodes: ['LAL'],
                teamsAffected: ['NYK'],
                playerIds: ['player_raw_only'],
              },
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Explicit local timeline row'
    );
    expect(screen.getByTestId('team-history-detail-type')).toHaveTextContent(
      'custom · Manual Entry'
    );
    expect(screen.getByTestId('team-history-detail-teams')).toHaveTextContent(
      'BOS'
    );
    expect(screen.getByTestId('team-history-detail-team-codes')).toHaveTextContent(
      'BOS'
    );
    expect(screen.getByTestId('team-history-detail-team-codes')).not.toHaveTextContent(
      'LAL'
    );
    expect(screen.getByTestId('team-history-detail-player-ids')).toHaveTextContent(
      'player_normalized'
    );
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).not.toHaveTextContent('player_raw_only');
    expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent(
      'evt_local_1'
    );
    expect(screen.getByTestId('team-history-detail-operation-id')).toHaveTextContent(
      'op_local_1'
    );
    expect(screen.getByTestId('team-history-detail-raw-summary')).toHaveTextContent(
      'Raw event ID: evt_raw_different'
    );
    expect(screen.getByTestId('team-history-detail-raw-summary')).toHaveTextContent(
      'Raw playerIds: player_raw_only'
    );
  });
});
