// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

describe('Team History world events integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders world-event timeline in newest-first order and opens detail modal', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'legacy-waive-1',
          eventId: 'legacy-waive-1',
          type: 'waivePlayer',
          timestamp: '2026-02-20T12:00:00.000Z',
          teamsAffected: ['LAL'],
          metadata: {
            playerId: 'player_123',
          },
        },
        {
          id: 'cap-audit-1',
          eventId: 'cap-audit-1',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T09:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          playerIds: ['player_77'],
          operationId: 'op_trade_77',
          beforeTotalsByTeam: {
            LAL: { totalCapAllocations: 150000000 },
          },
          afterTotalsByTeam: {
            LAL: { totalCapAllocations: 149000000 },
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    const firstRow = screen.getByTestId('team-history-row-0');
    const secondRow = screen.getByTestId('team-history-row-1');

    expect(firstRow).toHaveTextContent('Trade Executed vs BOS');
    expect(secondRow).toHaveTextContent('Waived: player_123');

    fireEvent.click(firstRow);

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).toHaveTextContent('player_77');
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('2026-03-01T09:00:00.000Z');
    expect(
      screen.getByTestId('team-history-detail-before-totals')
    ).toHaveTextContent('totalCapAllocations');
    expect(
      screen.getByTestId('team-history-detail-after-totals')
    ).toHaveTextContent('149000000');
  });
});
