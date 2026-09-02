// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';

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
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
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
            LAL: {
              totalCapAllocations: 150000000,
              teamSalary: 150000000,
              apronTeamSalary: 152000000,
              taxSalary: 151000000,
            },
          },
          afterTotalsByTeam: {
            LAL: {
              totalCapAllocations: 149000000,
              teamSalary: 149000000,
              apronTeamSalary: 151000000,
              taxSalary: 150000000,
            },
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
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('Authoritative world-event row');
    expect(
      screen.getByText('Underlying World-Event Payload')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-mutation-type').textContent || ''
    ).toContain('executeTrade');
    expect(
      screen.getByTestId('team-history-detail-type').textContent || ''
    ).toContain('Trade Executed');
    expect(
      screen.getByTestId('team-history-detail-player-ids').textContent || ''
    ).toContain('player_77');
    expect(
      screen.getByTestId('team-history-detail-timestamp').textContent || ''
    ).not.toContain('2026-03-01T09:00:00.000Z');
    expect(
      screen.getByTestId('team-history-detail-before-totals').textContent || ''
    ).toContain('totalCapAllocations');
    expect(
      screen.getByTestId('team-history-detail-after-totals').textContent || ''
    ).toContain('149000000');
    expect(screen.getByText('Salary Books')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-row-id')).toHaveTextContent(
      'cap-audit-1'
    );
    expect(
      screen.getByTestId('team-history-detail-event-id')
    ).toHaveTextContent('cap-audit-1');
    expect(
      screen.getByTestId('team-history-detail-operation-id')
    ).toHaveTextContent('op_trade_77');
    expect(
      screen.getByTestId('team-history-detail-cap-alignment').textContent || ''
    ).toContain('Displayed cap delta matches LAL before/after totals.');
    expect(
      screen.getByTestId('team-history-detail-cap-alignment').textContent || ''
    ).toContain('LAL Team Salary: $150,000,000 -> $149,000,000 (-$1,000,000)');
    expect(
      screen.getByTestId('team-history-detail-raw-summary').textContent || ''
    ).toContain('Raw event ID: cap-audit-1');
    expect(
      screen.getByTestId('team-history-detail-raw-summary').textContent || ''
    ).toContain('Raw mutation type: executeTrade');
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

  it('surfaces the mixed-feed compatibility note when canonical and legacy rows are merged together', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'canonical-trade-1',
          eventId: 'canonical-trade-1',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
        },
        {
          id: 'legacy-waive-1',
          eventId: 'legacy-waive-1',
          type: 'waivePlayer',
          timestamp: '2026-02-20T12:00:00.000Z',
          teamsAffected: ['LAL'],
        },
      ],
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'mixed-compatible',
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(
      screen.getByTestId('team-history-world-events-compatibility-note')
        .textContent || ''
    ).toContain(
      'Showing a merged Team History feed with canonical and compatible legacy records for this team.'
    );
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

    expect(
      screen.getByTestId('team-history-row-0').textContent || ''
    ).toContain('Trade Executed');
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
