// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    cleanup();
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
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'authoritative',
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    const firstRow = screen.getByTestId('team-history-row-0');
    const secondRow = screen.getByTestId('team-history-row-1');

    expect(firstRow.textContent || '').toContain('Trade Executed');
    expect(secondRow.textContent || '').toContain('Waive Player: player_123');
    expect(
      screen.queryByTestId('team-history-world-events-compatibility-note')
    ).not.toBeInTheDocument();

    fireEvent.click(firstRow);

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type').textContent || ''
    ).toContain('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-type').textContent || ''
    ).toContain('trade · Trade Executed');
    expect(
      screen.getByTestId('team-history-detail-player-ids').textContent || ''
    ).toContain('player_77');
    expect(
      screen.getByTestId('team-history-detail-timestamp').textContent || ''
    ).toContain('2026-03-01T09:00:00.000Z');
    expect(
      screen.getByTestId('team-history-detail-before-totals').textContent || ''
    ).toContain('totalCapAllocations');
    expect(
      screen.getByTestId('team-history-detail-after-totals').textContent || ''
    ).toContain('149000000');
    expect(screen.getByText('Cap Allocation')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-modal').textContent || ''
    ).toContain('LAL total cap allocations: -$1,000,000');
  });

  it('surfaces the legacy compatibility note when the hook resolves through the bounded fallback contract', () => {
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
      ],
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'legacy-compatible',
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(
      screen.getByTestId('team-history-world-events-compatibility-note')
        .textContent || ''
    ).toContain('Showing compatible legacy history records for this team.');
  });

  it('uses the tightened empty-state copy for supported-contract misses', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [],
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'empty',
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(
      screen.getByTestId('team-history-world-events-empty').textContent || ''
    ).toContain(
      'No history events matched this team in the supported world-event feed.'
    );
    expect(
      screen.queryByTestId('team-history-world-events-compatibility-note')
    ).not.toBeInTheDocument();
  });

  it('keeps rendered rows visible when load-more fails after initial data has loaded', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_trade',
          eventId: 'evt_trade',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T09:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          playerIds: ['player_77'],
          operationId: 'op_trade_77',
        },
      ],
      loading: false,
      loadingMore: false,
      error: 'canonical Team History contract failed: permission denied',
      hasMore: true,
      resolution: 'authoritative',
      loadMore: vi.fn(),
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-row-0').textContent || '').toContain(
      'Trade Executed'
    );
    expect(
      screen.getByTestId('team-history-world-events-inline-error')
        .textContent || ''
    ).toContain(
      'Unable to load more world history events. canonical Team History contract failed: permission denied'
    );
    expect(
      screen.queryByTestId('team-history-world-events-error')
    ).not.toBeInTheDocument();
  });
});
