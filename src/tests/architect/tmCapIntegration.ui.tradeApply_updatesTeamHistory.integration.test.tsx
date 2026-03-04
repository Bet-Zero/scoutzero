// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

describe('TM_CAP_INTEGRATION_E2 UI: trade apply updates Team History surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executeTrade timeline row and opens detail modal with core fields', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_trade_ui_001',
          eventId: 'evt_trade_ui_001',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-03T12:00:00.000Z',
          timestamp: '2026-03-03T12:00:00.000Z',
          category: 'Trade',
          type: 'Trade',
          teamCodes: ['LAL', 'BOS'],
          teamsAffected: ['LAL', 'BOS'],
          playerIds: ['lal_out_18m', 'bos_out_10m'],
          operationId: 'op_trade_ui_001',
          beforeTotalsByTeam: {
            LAL: { totalCapAllocations: 18000000 },
            BOS: { totalCapAllocations: 10000000 },
          },
          afterTotalsByTeam: {
            LAL: { totalCapAllocations: 10000000 },
            BOS: { totalCapAllocations: 18000000 },
          },
          detailSections: [
            {
              title: 'Players',
              lines: ['LAL sent: lal_out_18m', 'BOS sent: bos_out_10m'],
            },
          ],
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(
      <TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_tm_cap_e2" />
    );

    const firstRow = screen.getByTestId('team-history-event-row-0');
    expect(firstRow).toHaveTextContent('Trade Executed vs BOS');
    expect(firstRow).toHaveTextContent('executeTrade');

    fireEvent.click(firstRow);

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('2026-03-03T12:00:00.000Z');
    expect(screen.getByText('evt_trade_ui_001')).toBeInTheDocument();
    expect(screen.getByText('LAL · BOS')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-player-ids')
    ).toHaveTextContent('lal_out_18m');
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('• LAL sent: lal_out_18m')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-history-detail-close'));
    expect(
      screen.queryByTestId('team-history-detail-modal')
    ).not.toBeInTheDocument();
  });
});
