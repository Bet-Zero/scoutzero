// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';

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

describe('TEAM_HISTORY_E4 summary/details matrix integration (world mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders token-rich summaries and structured sections for required mutation families', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_trade',
          eventId: 'evt_trade',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T19:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          playerIds: ['player_trade_a', 'player_trade_b'],
          diffSummary: {
            playersMoved: ['player_trade_a', 'player_trade_b'],
            picksMoved: ['2028 1st (BOS)'],
          },
          beforeTotalsByTeam: { LAL: { totalCapAllocations: 150000000 } },
          afterTotalsByTeam: { LAL: { totalCapAllocations: 149000000 } },
        },
        {
          id: 'evt_sign',
          eventId: 'evt_sign',
          mutationType: 'signFreeAgent',
          occurredAt: '2026-03-01T18:00:00.000Z',
          teamCodes: ['LAL'],
          playerIds: ['player_sign'],
          mutationMetadata: {
            playerName: 'player_sign',
            teamCode: 'LAL',
            contract: { years: 3, firstYearSalary: 12000000 },
            signedUsing: 'NTMLE',
          },
          beforeTotalsByTeam: { LAL: { totalCapAllocations: 140000000 } },
          afterTotalsByTeam: { LAL: { totalCapAllocations: 152000000 } },
        },
        {
          id: 'evt_waive',
          eventId: 'evt_waive',
          mutationType: 'waivePlayer',
          occurredAt: '2026-03-01T17:00:00.000Z',
          teamCodes: ['LAL'],
          playerIds: ['player_waive'],
          mutationMetadata: {
            playerName: 'player_waive',
            stretched: true,
            deadCapAmount: 4500000,
          },
        },
        {
          id: 'evt_deadcap',
          eventId: 'evt_deadcap',
          mutationType: 'setDeadCap',
          occurredAt: '2026-03-01T16:00:00.000Z',
          teamCodes: ['LAL'],
          diffSummary: { deadCapChanges: ['waived player bucket +$1.2M'] },
        },
        {
          id: 'evt_exceptions',
          eventId: 'evt_exceptions',
          mutationType: 'setExceptions',
          occurredAt: '2026-03-01T15:00:00.000Z',
          teamCodes: ['LAL'],
          diffSummary: { exceptionChanges: ['NTMLE remaining reduced'] },
        },
        {
          id: 'legacy_sat',
          eventId: 'legacy_sat',
          type: 'signAndTrade',
          timestamp: '2026-03-01T14:00:00.000Z',
          teamsAffected: ['LAL', 'CHI'],
          metadata: {
            playerId: 'player_sat',
            contract: { years: 4, firstYearSalary: 30000000 },
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'executeTrade'
    );
    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'LAL'
    );
    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'player_trade_a'
    );

    expect(screen.getByTestId('team-history-event-row-1')).toHaveTextContent(
      'signFreeAgent'
    );
    expect(screen.getByTestId('team-history-event-row-1')).toHaveTextContent(
      'player_sign'
    );

    expect(screen.getByTestId('team-history-event-row-2')).toHaveTextContent(
      'waivePlayer'
    );
    expect(screen.getByTestId('team-history-event-row-2')).toHaveTextContent(
      'player_waive'
    );

    expect(screen.getByTestId('team-history-event-row-3')).toHaveTextContent(
      'setDeadCap'
    );
    expect(screen.getByTestId('team-history-event-row-4')).toHaveTextContent(
      'setExceptions'
    );
    expect(screen.getByTestId('team-history-event-row-5')).toHaveTextContent(
      'signAndTrade'
    );

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-sections')
    ).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Picks')).toBeInTheDocument();
    expect(screen.getByText('Cap Delta')).toBeInTheDocument();
    expect(screen.getByText(/2028 1st/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-1'));
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Exceptions')).toBeInTheDocument();
    expect(screen.getByText(/First year salary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-2'));
    expect(screen.getByText(/Stretch provision applied/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-3'));
    expect(
      screen.getByText(/Dead cap updated|waived player bucket/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));
  });
});
