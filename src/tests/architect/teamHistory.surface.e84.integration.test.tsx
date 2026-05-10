// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const buildTeam = () => ({
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
});

describe('Team History E84 surface integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves base-mode section composition order and modal behavior', async () => {
    const fixtureTeam = injectTeamHistoryFixtures(buildTeam());

    render(
      <TeamHistoryTab
        teamCapSheet={fixtureTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures
      />
    );

    const timeline = screen.getByTestId('team-history-section-timeline');
    const waive = screen.getByTestId('team-history-section-waive');
    const exceptions = screen.getByTestId('team-history-section-exceptions');
    const draft = screen.getByTestId('team-history-section-draft');

    expect(screen.getByTestId('team-history-world-banner')).toBeInTheDocument();
    expect(
      timeline.compareDocumentPosition(waive) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      waive.compareDocumentPosition(exceptions) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      exceptions.compareDocumentPosition(draft) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(screen.getByTestId('team-history-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-waived-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-tpe-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-pick-log-row-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-history-row-0'));

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('History Item Detail')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-summary')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('team-history-detail-modal')
      ).not.toBeInTheDocument();
    });
  });

  it('preserves world-event mode timeline rendering and modal behavior', async () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_trade_ui_e84',
          eventId: 'evt_trade_ui_e84',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-04T12:00:00.000Z',
          timestamp: '2026-03-04T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          teamsAffected: ['LAL', 'BOS'],
          playerIds: ['lal_player', 'bos_player'],
          operationId: 'op_trade_ui_e84',
          beforeTotalsByTeam: {
            LAL: { totalCapAllocations: 18000000 },
          },
          afterTotalsByTeam: {
            LAL: { totalCapAllocations: 10000000 },
          },
          detailSections: [
            {
              title: 'Players',
              lines: ['LAL sent: lal_player', 'BOS sent: bos_player'],
            },
          ],
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={buildTeam()} worldId="world_lal" />);

    const row = screen.getByTestId('team-history-event-row-0');
    const summary = screen.getByTestId('team-history-row-0');
    expect(screen.getByTestId('team-history-world-banner')).toBeInTheDocument();
    expect(summary).toHaveTextContent('Trade Executed: LAL ↔ BOS');
    expect(row).toHaveTextContent('executeTrade');

    fireEvent.click(row);

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-mutation-type')).toHaveTextContent(
      'executeTrade'
    );
    expect(screen.getByTestId('team-history-detail-player-ids')).toHaveTextContent(
      'lal_player'
    );

    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('team-history-detail-modal')
      ).not.toBeInTheDocument();
    });
  });
});
