// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import {
  injectTeamHistoryFixtures,
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
} from '@/features/architect/history/devTeamHistoryFixtures';

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
  // BZE-229: the detail modal's raw-identifier and payload-inspection sections
  // are gated behind the existing developer toggle (DEV + fixture flag) so owners
  // never see them. These tests exercise that inspector, so enable the toggle.
  beforeEach(() => {
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('opens detail modal from row click and closes cleanly', async () => {
    render(<TeamHistoryTab teamCapSheet={seededTeam} worldId="world_bos" />);

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-type')).toHaveTextContent(
      'Trade Executed'
    );
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).not.toHaveTextContent('2026-02-10T14:00:00.000Z');
    expect(screen.getByTestId('team-history-detail-teams')).toHaveTextContent(
      'Boston Celtics'
    );
    expect(
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('Synthetic DEV fixture row');
    expect(
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('non-authoritative test data');
    expect(screen.getByTestId('team-history-detail-row-id')).toHaveTextContent(
      'th-fixture-trade-BOS'
    );
    expect(
      screen.getByTestId('team-history-detail-mutation-id')
    ).toHaveTextContent('mutation-trade-BOS-001');
    expect(
      screen.getByTestId('team-history-detail-event-id')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-raw-summary')
    ).toHaveTextContent(
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
              capDelta: 1000000,
              raw: {
                eventId: 'evt_raw_different',
                operationId: 'op_raw_different',
                mutationType: 'waivePlayer',
                type: 'rawFallbackOnly',
                teamCodes: ['LAL'],
                teamsAffected: ['NYK'],
                playerIds: ['player_raw_only'],
                beforeTotalsByTeam: {
                  BOS: { teamSalary: 18000000 },
                },
                afterTotalsByTeam: {
                  BOS: { teamSalary: 19000000 },
                },
              },
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('Explicit local timeline row');
    expect(screen.getByText('Attached Local Payload')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-type')).toHaveTextContent(
      'Manual Entry'
    );
    expect(
      screen.getByTestId('team-history-detail-raw-type')
    ).toHaveTextContent('rawFallbackOnly');
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('—');
    expect(screen.getByTestId('team-history-detail-teams')).toHaveTextContent(
      'Boston Celtics'
    );
    expect(
      screen.getByTestId('team-history-detail-team-codes')
    ).toHaveTextContent('BOS');
    expect(
      screen.getByTestId('team-history-detail-team-codes')
    ).not.toHaveTextContent('LAL');
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).toHaveTextContent('player_normalized');
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).not.toHaveTextContent('player_raw_only');
    expect(
      screen.getByTestId('team-history-detail-event-id')
    ).toHaveTextContent('evt_local_1');
    expect(
      screen.getByTestId('team-history-detail-mutation-id')
    ).toHaveTextContent('mutation_local_1');
    expect(
      screen.getByTestId('team-history-detail-operation-id')
    ).toHaveTextContent('op_local_1');
    expect(
      screen.getByTestId('team-history-detail-before-totals')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-after-totals')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-cap-alignment')
    ).toHaveTextContent(
      'Displayed cap delta has no normalized before/after totals to reconcile against.'
    );
    expect(
      screen.getByTestId('team-history-detail-raw-summary')
    ).toHaveTextContent('Raw event ID: evt_raw_different');
    expect(
      screen.getByTestId('team-history-detail-raw-summary')
    ).toHaveTextContent('Raw playerIds: player_raw_only');
  });

  it('keeps one selected-entry owner driving the modal as explicit local rows change', () => {
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
              id: 'local-row-first',
              category: 'custom',
              type: 'First Local Row',
              timestamp: '2026-03-16T12:00:00.000Z',
              teamsInvolved: ['BOS'],
              summary: 'FIRST_LOCAL_SELECTED_ENTRY',
              capDelta: 1000000,
              eventId: 'evt_local_first',
              operationId: 'op_local_first',
              beforeTotalsByTeam: {
                BOS: { teamSalary: 10000000 },
              },
              afterTotalsByTeam: {
                BOS: { teamSalary: 8000000 },
              },
            },
            {
              id: 'local-row-second',
              category: 'custom',
              timestamp: '2026-03-15T12:00:00.000Z',
              teamsInvolved: ['BOS'],
              summary: 'SECOND_LOCAL_SELECTED_ENTRY',
              capDelta: 1000000,
              operationId: 'op_local_second',
              raw: {
                eventId: 'evt_raw_second',
                mutationType: 'executeTrade',
                type: 'rawOnlyType',
                playerIds: ['player_raw_second'],
                beforeTotalsByTeam: {
                  BOS: { teamSalary: 15000000 },
                },
                afterTotalsByTeam: {
                  BOS: { teamSalary: 16000000 },
                },
              },
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getAllByTestId('team-history-detail-modal')).toHaveLength(1);
    expect(screen.getByTestId('team-history-detail-summary')).toHaveTextContent(
      'FIRST_LOCAL_SELECTED_ENTRY'
    );
    expect(
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('Explicit local timeline row');
    expect(
      screen.getByTestId('team-history-detail-event-id')
    ).toHaveTextContent('evt_local_first');
    expect(
      screen.getByTestId('team-history-detail-cap-alignment')
    ).toHaveTextContent(
      'Displayed cap delta does not match BOS before/after totals.'
    );

    fireEvent.click(screen.getByTestId('team-history-row-1'));

    expect(screen.getAllByTestId('team-history-detail-modal')).toHaveLength(1);
    expect(screen.getByTestId('team-history-detail-summary')).toHaveTextContent(
      'SECOND_LOCAL_SELECTED_ENTRY'
    );
    expect(screen.getByTestId('team-history-detail-row-id')).toHaveTextContent(
      'local-row-second'
    );
    expect(screen.getByTestId('team-history-detail-type')).toHaveTextContent(
      'Custom'
    );
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-event-id')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-operation-id')
    ).toHaveTextContent('op_local_second');
    expect(
      screen.getByTestId('team-history-detail-before-totals')
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('team-history-detail-cap-alignment')
    ).toHaveTextContent(
      'Displayed cap delta has no normalized before/after totals to reconcile against.'
    );
    expect(
      screen.getByTestId('team-history-detail-raw-summary')
    ).toHaveTextContent('Raw event ID: evt_raw_second');
  });
});
