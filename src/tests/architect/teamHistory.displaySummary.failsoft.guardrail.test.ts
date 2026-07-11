// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('TEAM_HISTORY_E4 fail-soft guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
  });

  it('renders safe fallback summaries and raw payload when metadata is sparse', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_sparse_1',
          eventId: 'evt_sparse_1',
          mutationType: 'waivePlayer',
          occurredAt: '2026-03-01T10:00:00.000Z',
          teamCodes: [],
          playerIds: [],
        },
        {
          id: 'evt_sparse_2',
          eventId: 'evt_sparse_2',
          type: 'setException',
          timestamp: '2026-03-01T09:00:00.000Z',
        },
        {
          id: 'evt_sparse_3',
          eventId: 'evt_sparse_3',
          mutationType: 'mysteryMutation',
          occurredAt: '2026-03-01T08:00:00.000Z',
          teamCodes: ['LAL'],
          playerIds: ['player_unknown'],
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(
      React.createElement(TeamHistoryTab, {
        teamCapSheet,
        worldId: 'world_lal',
      })
    );

    expect(screen.getByTestId('team-history-event-row-0')).toBeTruthy();
    expect(screen.getByTestId('team-history-event-row-1')).toBeTruthy();
    expect(screen.getByTestId('team-history-event-row-2')).toBeTruthy();

    expect(
      screen
        .getByTestId('team-history-event-row-0')
        .textContent?.includes('details unavailable')
    ).toBe(true);
    expect(
      screen
        .getByTestId('team-history-event-row-1')
        .textContent?.includes('detail limited')
    ).toBe(true);
    expect(
      screen
        .getByTestId('team-history-event-row-2')
        .textContent?.includes('Mystery Mutation: player_unknown')
    ).toBe(true);

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-modal')).toBeTruthy();
    expect(
      screen
        .getByTestId('team-history-raw-payload')
        .textContent?.includes('evt_sparse_1')
    ).toBe(true);
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-1'));
    expect(screen.getByText('Exception Changes')).toBeTruthy();
    expect(
      screen.getByText(/No exception change detail was included/i)
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-2'));
    expect(screen.getByText('Event Detail')).toBeTruthy();
    expect(
      screen.getByText(/No event-specific Team History detail mapping exists for mysteryMutation/i)
    ).toBeTruthy();
  });
});
