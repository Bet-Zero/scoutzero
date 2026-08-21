// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';

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
    cleanup();
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
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'authoritative',
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-row-0').textContent || '').toContain(
      'Trade Executed'
    );
    expect(screen.getByTestId('team-history-row-1').textContent || '').toContain(
      'Signed Free Agent'
    );
    expect(screen.getByTestId('team-history-row-2').textContent || '').toContain(
      'Sign-and-Trade Executed'
    );
    expect(screen.getByTestId('team-history-row-3').textContent || '').toContain(
      'Waive Player'
    );
    expect(screen.getByTestId('team-history-row-4').textContent || '').toContain(
      'Exceptions Updated'
    );

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type').textContent || ''
    ).toContain('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-type').textContent || ''
    ).toContain('trade · Trade Executed');
    expect(
      screen.getByTestId('team-history-detail-timestamp').textContent || ''
    ).toContain('2026-03-01T15:00:00.000Z');
    expect(
      screen.getByTestId('team-history-detail-player-ids').textContent || ''
    ).toContain('player_trade');
    // BZE-229 (owner-approved): the raw event ID (evt_trade) is a developer-only
    // field now, gated behind the developer-detail toggle, so it no longer renders
    // for owners by default. The canonical owner-facing fields asserted here remain.
    expect(screen.getAllByText('LAL · BOS').length).toBeGreaterThan(0);
    expect(screen.getByText('Salary Books')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-modal').textContent || ''
    ).toContain('LAL total cap allocations: -$1,000,000');
  });
});
