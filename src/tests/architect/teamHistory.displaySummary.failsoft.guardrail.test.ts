// @vitest-environment jsdom
import React from 'react';
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

describe('TEAM_HISTORY_E4 fail-soft guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(
      screen
        .getByTestId('team-history-event-row-0')
        .textContent?.includes('details unavailable')
    ).toBe(true);
    expect(
      screen
        .getByTestId('team-history-event-row-1')
        .textContent?.includes('setExceptions')
    ).toBe(true);

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-modal')).toBeTruthy();
    expect(
      screen
        .getByTestId('team-history-raw-payload')
        .textContent?.includes('evt_sparse_1')
    ).toBe(true);
  });
});
