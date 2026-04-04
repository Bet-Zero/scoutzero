// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
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
      'Trade Executed: LAL ↔ BOS'
    );
    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'executeTrade'
    );

    expect(screen.getByTestId('team-history-event-row-1')).toHaveTextContent(
      'Signed Free Agent: player_sign → LAL'
    );
    expect(screen.getByTestId('team-history-event-row-1')).toHaveTextContent(
      'signFreeAgent'
    );

    expect(screen.getByTestId('team-history-event-row-2')).toHaveTextContent(
      'Waive Player: player_waive'
    );
    expect(screen.getByTestId('team-history-event-row-2')).toHaveTextContent(
      'waivePlayer'
    );

    expect(screen.getByTestId('team-history-event-row-3')).toHaveTextContent(
      'Dead Cap Updated: waived player bucket +$1.2M'
    );
    expect(screen.getByTestId('team-history-event-row-4')).toHaveTextContent(
      'Exceptions Updated: NTMLE remaining reduced'
    );
    expect(screen.getByTestId('team-history-event-row-5')).toHaveTextContent(
      'Sign-and-Trade Executed:'
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
    expect(screen.getByText('Cap Allocation')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-modal').textContent || ''
    ).toContain('LAL total cap allocations: -$1,000,000');
    expect(screen.getAllByText(/2028 1st/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-1'));
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Signing Context')).toBeInTheDocument();
    expect(screen.getByText(/Destination team: LAL/i)).toBeInTheDocument();
    expect(screen.getByText(/First year salary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-2'));
    expect(screen.getByText('Waiver')).toBeInTheDocument();
    expect(screen.getByText(/Stretch provision applied/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-3'));
    expect(screen.getByText('Dead Cap Changes')).toBeInTheDocument();
    expect(screen.getAllByText(/waived player bucket/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-5'));
    expect(screen.getByText('Trade Context')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));
  });
});
