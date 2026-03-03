// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/TeamHistoryTab';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const teamCapSheet = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

describe('TEAM_HISTORY_E3 timeline from world events integration matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required mutation families and opens detail modal with canonical fields', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_trade',
          eventId: 'evt_trade',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T15:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          playerIds: ['player_trade'],
          operationId: 'op_trade',
          beforeTotalsByTeam: { LAL: { totalCapAllocations: 150000000 } },
          afterTotalsByTeam: { LAL: { totalCapAllocations: 149000000 } },
        },
        {
          id: 'evt_sign',
          eventId: 'evt_sign',
          mutationType: 'signFreeAgent',
          occurredAt: '2026-03-01T14:00:00.000Z',
          teamCodes: ['LAL'],
          playerIds: ['player_sign'],
          operationId: 'op_sign',
        },
        {
          id: 'evt_sat',
          eventId: 'evt_sat',
          mutationType: 'signAndTrade',
          occurredAt: '2026-03-01T13:00:00.000Z',
          teamCodes: ['LAL', 'CHI'],
          playerIds: ['player_sat'],
          operationId: 'op_sat',
        },
        {
          id: 'evt_waive',
          eventId: 'evt_waive',
          mutationType: 'waivePlayer',
          occurredAt: '2026-03-01T12:00:00.000Z',
          teamCodes: ['LAL'],
          playerIds: ['player_waive'],
          operationId: 'op_waive',
          metadata: { stretched: true },
        },
        {
          id: 'evt_exc',
          eventId: 'evt_exc',
          mutationType: 'setExceptions',
          occurredAt: '2026-03-01T11:00:00.000Z',
          teamCodes: ['LAL'],
          operationId: 'op_exc',
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-row-0')).toHaveTextContent(
      'Trade Executed'
    );
    expect(screen.getByTestId('team-history-row-1')).toHaveTextContent(
      'Signed Free Agent'
    );
    expect(screen.getByTestId('team-history-row-2')).toHaveTextContent(
      'Sign-and-Trade Executed'
    );
    expect(screen.getByTestId('team-history-row-3')).toHaveTextContent(
      'Waive Player'
    );
    expect(screen.getByTestId('team-history-row-4')).toHaveTextContent(
      'Set Exceptions'
    );

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('2026-03-01T15:00:00.000Z');
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).toHaveTextContent('player_trade');
    expect(screen.getByText('evt_trade')).toBeInTheDocument();
    expect(screen.getByText('LAL · BOS')).toBeInTheDocument();
  });
});
