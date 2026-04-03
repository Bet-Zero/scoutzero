// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const baseTeam: TeamHistoryCapSheetLike = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

function WorldSwitchHarness() {
  const [activeWorldId, setActiveWorldId] = React.useState<
    'world-a' | 'world-b'
  >('world-a');

  return (
    <div>
      <button
        type="button"
        data-testid="switch-world-a"
        onClick={() => setActiveWorldId('world-a')}
      >
        World A
      </button>
      <button
        type="button"
        data-testid="switch-world-b"
        onClick={() => setActiveWorldId('world-b')}
      >
        World B
      </button>

      <TeamHistoryTab worldId={activeWorldId} teamCapSheet={baseTeam} />
    </div>
  );
}

describe('Team History world boundary integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('surfaces authoritative world-event ownership and updates entries when world context switches', () => {
    useWorldTeamEventsMock.mockImplementation(
      ({ worldId }: { worldId: string }) => ({
        events: [
          {
            id: `evt-${worldId}`,
            eventId: `evt-${worldId}`,
            mutationType: 'executeTrade',
            occurredAt: '2026-03-01T12:00:00.000Z',
            teamCodes: ['LAL', worldId === 'world-a' ? 'ATL' : 'BOS'],
            metadata: {
              summary: worldId === 'world-a' ? 'WORLD_A_EVENT' : 'WORLD_B_EVENT',
            },
          },
        ],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: null,
      })
    );

    render(<WorldSwitchHarness />);

    expect(screen.getByTestId('team-history-world-banner')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Authoritative world events'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'World events own the timeline'
    );
    expect(screen.getByText('WORLD_A_EVENT')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('switch-world-b'));

    expect(screen.getByText('WORLD_B_EVENT')).toBeInTheDocument();
    expect(screen.queryByText('WORLD_A_EVENT')).not.toBeInTheDocument();
  });

  it('treats injected fixtures as the active override even when world context exists', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt-world-should-not-render',
          eventId: 'evt-world-should-not-render',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-01T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    const fixtureTeam = injectTeamHistoryFixtures({
      ...baseTeam,
      historyTimeline: [],
    });

    render(<TeamHistoryTab teamCapSheet={fixtureTeam} worldId="world-fixture" />);

    expect(screen.getByTestId('team-history-world-banner')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'DEV fixture override'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'suppress world events'
    );
    expect(
      screen.getByText(
        'Acquired two players and one protected pick; outgoing salary offset generated net cap delta.'
      )
    ).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });
});
