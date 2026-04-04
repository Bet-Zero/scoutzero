// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import {
  DEV_TEAM_HISTORY_FIXTURE_FLAG,
  clearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures,
  injectTeamHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const buildEmptyTeam = (): TeamHistoryCapSheetLike => ({
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
});

const buildSeededTeam = (): TeamHistoryCapSheetLike => ({
  teamCode: 'LAL',
  waivedContracts: [
    {
      id: 'waive-base',
      name: 'Base Veteran',
      waivedOn: '2025-07-01',
      stretched: false,
    },
  ],
  exceptionHistory: [
    {
      id: 'exception-base',
      type: 'createTradeException',
      timestamp: '2025-07-02T00:00:00.000Z',
      amountCreated: 2500000,
      amountRemaining: 2500000,
      sourceTeamCode: 'LAL',
    },
  ],
  mleHistory: [
    {
      id: 'mle-base',
      year: '2025-26',
      total: 10000000,
      used: 2000000,
      notes: 'Base MLE usage',
    },
  ],
  pickLog: [
    {
      id: 'pick-base',
      date: '2025-07-03',
      action: 'Sent Out',
      pick: '2030 2nd Round Pick',
      partner: 'DAL',
      notes: 'Base outgoing pick',
    },
  ],
  currentPicks: {
    2027: {
      first: 'Owed to PHX',
      second: 'Own',
    },
    2028: {
      first: 'Own',
      second: 'Own',
    },
  },
  historyTimeline: [
    {
      id: 'local-base',
      category: 'custom',
      type: 'Manual Entry',
      timestamp: '2025-07-04T00:00:00.000Z',
      summary: 'BASE_LOCAL_TIMELINE',
    },
  ],
});

describe('TEAM_HISTORY_STEP6 fixture safety guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('keeps inject and clear symmetry stable across every live fixture-managed surface', () => {
    const baseTeam = buildSeededTeam();

    const injectedOnce = injectTeamHistoryFixtures(baseTeam);
    const injectedTwice = injectTeamHistoryFixtures(injectedOnce);

    expect(hasInjectedTeamHistoryFixtures(injectedOnce)).toBe(true);
    expect(injectedOnce.waivedContracts).toHaveLength(2);
    expect(injectedOnce.exceptionHistory).toHaveLength(2);
    expect(injectedOnce.mleHistory).toHaveLength(2);
    expect(injectedOnce.pickLog).toHaveLength(2);
    expect(injectedOnce.historyTimeline).toHaveLength(6);
    expect(injectedOnce.currentPicks?.['2027']).toMatchObject({
      first: 'Own',
      second: 'Own',
    });
    expect(injectedOnce.currentPicks?.['2029']).toMatchObject({
      first: 'Own',
      second: 'From SAS (top-55 protected)',
    });
    expect(injectedTwice).toEqual(injectedOnce);

    const clearedOnce = clearTeamHistoryFixtures(injectedTwice);
    const clearedTwice = clearTeamHistoryFixtures(clearedOnce);
    const reinjectedAfterClear = injectTeamHistoryFixtures(clearedOnce);

    expect(hasInjectedTeamHistoryFixtures(clearedOnce)).toBe(false);
    expect(clearedOnce).toEqual(baseTeam);
    expect(clearedTwice).toEqual(baseTeam);
    expect(reinjectedAfterClear).toEqual(injectedOnce);
  });

  it('fails closed from actual team-data fixture markers and returns ownership to world events only after clear', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt-world-returns',
          eventId: 'evt-world-returns',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-05T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          metadata: {
            summary: 'WORLD_EVENTS_RETURN',
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    const emptyTeam = buildEmptyTeam();
    const injectedTeam = injectTeamHistoryFixtures(emptyTeam);
    const currentPicksOnlyFixtureTeam: TeamHistoryCapSheetLike = {
      ...emptyTeam,
      currentPicks: injectedTeam.currentPicks,
    };

    expect(hasInjectedTeamHistoryFixtures(currentPicksOnlyFixtureTeam)).toBe(true);

    const { rerender } = render(
      <TeamHistoryTab
        teamCapSheet={currentPicksOnlyFixtureTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures={false}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'DEV fixture override'
    );
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'suppress authoritative world events until cleared'
    );
    expect(screen.getByText('No timeline entries yet.')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();

    const clearedTeam = clearTeamHistoryFixtures(currentPicksOnlyFixtureTeam);
    expect(hasInjectedTeamHistoryFixtures(clearedTeam)).toBe(false);

    rerender(
      <TeamHistoryTab
        teamCapSheet={clearedTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures={false}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Authoritative world events'
    );
    expect(screen.getByText('WORLD_EVENTS_RETURN')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps fixture truth signaling distinct from explicit local and authoritative world-event modes', () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');

    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt-world-truth',
          eventId: 'evt-world-truth',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-06T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          metadata: {
            summary: 'WORLD_TRUTH_ROW',
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    const fixtureTeam = injectTeamHistoryFixtures(buildEmptyTeam());
    const explicitLocalTeam: TeamHistoryCapSheetLike = {
      ...buildEmptyTeam(),
      historyTimeline: [
        {
          id: 'local-row',
          category: 'custom',
          type: 'Manual Entry',
          timestamp: '2026-03-01T12:00:00.000Z',
          summary: 'LOCAL_TRUTH_ROW',
        },
      ],
    };

    const { rerender } = render(
      <TeamHistoryTab
        teamCapSheet={fixtureTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures={false}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'DEV fixture override'
    );
    expect(screen.getByTestId('team-history-base-truth-label')).toHaveTextContent(
      'Synthetic DEV fixture history'
    );
    expect(
      screen.getByTestId('team-history-fixtures-active-note')
    ).toHaveTextContent(
      'Clear them before trusting world-event or local-history behavior.'
    );

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Synthetic DEV fixture row'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'non-authoritative test data'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).not.toHaveTextContent(
      'Explicit local timeline row'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).not.toHaveTextContent(
      'Authoritative world-event row'
    );
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    rerender(<TeamHistoryTab teamCapSheet={explicitLocalTeam} worldId={null} />);

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Explicit local timeline'
    );
    expect(
      screen.queryByTestId('team-history-fixtures-active-note')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Explicit local timeline row'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).not.toHaveTextContent(
      'Synthetic DEV fixture row'
    );
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    rerender(<TeamHistoryTab teamCapSheet={buildEmptyTeam()} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Authoritative world events'
    );
    expect(
      screen.queryByTestId('team-history-fixtures-active-note')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Authoritative world-event row'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).not.toHaveTextContent(
      'Synthetic DEV fixture row'
    );
  });
});
