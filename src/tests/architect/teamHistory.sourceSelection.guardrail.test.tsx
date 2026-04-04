// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const buildBaseTeam = (): TeamHistoryCapSheetLike => ({
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
});

describe('TEAM_HISTORY_STEP1 source-selection guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps fixture-marker override authoritative even when the upstream boolean is stale false', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_world_should_not_render',
          eventId: 'evt_world_should_not_render',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-05T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          metadata: {
            summary: 'WORLD_EVENT_SHOULD_NOT_RENDER',
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    const fixtureTeam = injectTeamHistoryFixtures(buildBaseTeam());

    render(
      <TeamHistoryTab
        teamCapSheet={fixtureTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures={false}
      />
    );

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
    expect(
      screen.queryByText('WORLD_EVENT_SHOULD_NOT_RENDER')
    ).not.toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });

  it('keeps world-event mode authoritative over explicit local historyTimeline when no fixture override exists', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_world_wins',
          eventId: 'evt_world_wins',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-05T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          metadata: {
            summary: 'WORLD_EVENTS_WIN',
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          historyTimeline: [
            {
              id: 'local-row',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-03-01T12:00:00.000Z',
              summary: 'LOCAL_TIMELINE_SHOULD_NOT_RENDER',
            },
          ],
        }}
        worldId="world_lal"
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Authoritative world events'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'World events own the timeline'
    );
    expect(screen.getByText('WORLD_EVENTS_WIN')).toBeInTheDocument();
    expect(
      screen.queryByText('LOCAL_TIMELINE_SHOULD_NOT_RENDER')
    ).not.toBeInTheDocument();
    expect(useWorldTeamEventsMock).toHaveBeenCalledTimes(1);
    expect(useWorldTeamEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world_lal',
        teamCode: 'LAL',
        enabled: true,
      })
    );
  });

  it('keeps explicit local historyTimeline authoritative over synthesized fallback outside world mode', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          waivedContracts: [
            {
              id: 'waive-1',
              name: 'Fallback Only',
              waivedOn: '2026-02-01',
              stretched: false,
            },
          ],
          historyTimeline: [
            {
              id: 'local-entry-1',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-03-02T00:00:00.000Z',
              summary: 'LOCAL_TIMELINE_WINS',
            },
          ],
        }}
        worldId={null}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Explicit local timeline'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'direct historyTimeline rows take priority'
    );
    expect(screen.getByTestId('team-history-base-truth-label')).toHaveTextContent(
      'Direct local timeline rows'
    );
    expect(screen.getByTestId('team-history-base-truth-detail')).toHaveTextContent(
      'explicit historyTimeline rows only'
    );
    expect(screen.getByText('LOCAL_TIMELINE_WINS')).toBeInTheDocument();
    expect(screen.queryByText('Fallback Only was waived.')).not.toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });

  it('uses synthesized fallback only when world events are inactive and no explicit local timeline exists', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          waivedContracts: [
            {
              id: 'waive-1',
              name: 'Fallback Forward',
              waivedOn: '2026-02-01',
              stretched: true,
            },
          ],
        }}
        worldId={null}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Section-derived fallback'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'deriving local fallback rows from waived contracts'
    );
    expect(screen.getByTestId('team-history-base-truth-label')).toHaveTextContent(
      'Derived local convenience history'
    );
    expect(screen.getByTestId('team-history-base-truth-detail')).toHaveTextContent(
      'do not carry world-event payloads'
    );
    expect(
      screen.getByText('Waiver record: Fallback Forward was waived and stretched.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'Waived & Stretched Contract Record'
    );
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });
});
