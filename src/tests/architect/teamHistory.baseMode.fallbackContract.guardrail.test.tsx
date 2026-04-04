// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('TEAM_HISTORY_STEP4 fallback-contract guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps fixture and world ownership ahead of the base-mode fallback branch', () => {
    useWorldTeamEventsMock.mockReturnValue({
      events: [
        {
          id: 'evt_world_authoritative',
          eventId: 'evt_world_authoritative',
          mutationType: 'executeTrade',
          occurredAt: '2026-03-05T12:00:00.000Z',
          teamCodes: ['LAL', 'BOS'],
          metadata: {
            summary: 'WORLD_EVENT_STILL_WINS',
          },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    const fixtureTeam = injectTeamHistoryFixtures(buildBaseTeam());
    const { unmount } = render(
      <TeamHistoryTab
        teamCapSheet={fixtureTeam}
        worldId="world_lal"
        hasInjectedTeamHistoryFixtures={false}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'DEV fixture override'
    );
    expect(
      screen.getByText(
        'Acquired two players and one protected pick; outgoing salary offset generated net cap delta.'
      )
    ).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();

    unmount();

    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          historyTimeline: [
            {
              id: 'local-row',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-03-01T00:00:00.000Z',
              summary: 'LOCAL_ROW_SHOULD_NOT_RENDER',
            },
          ],
        }}
        worldId="world_lal"
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Authoritative world events'
    );
    expect(screen.getByText('WORLD_EVENT_STILL_WINS')).toBeInTheDocument();
    expect(screen.queryByText('LOCAL_ROW_SHOULD_NOT_RENDER')).not.toBeInTheDocument();
    expect(useWorldTeamEventsMock).toHaveBeenCalledTimes(1);
    expect(useWorldTeamEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world_lal',
        teamCode: 'LAL',
        enabled: true,
      })
    );
  });

  it('keeps explicit local historyTimeline rows ahead of synthesized fallback and does not invoke world queries in base mode', () => {
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
          exceptionHistory: [
            {
              id: 'exception-1',
              type: 'consumeTradeException',
              timestamp: '2026-02-02T12:00:00.000Z',
              amountRemaining: 2500000,
              sourcePlayerName: 'Fallback Wing',
              sourceTeamCode: 'LAL',
            },
          ],
          historyTimeline: [
            {
              id: 'local-entry-1',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-03-02T00:00:00.000Z',
              summary: 'LOCAL_TIMELINE_STAYS_AUTHORITATIVE',
            },
          ],
        }}
        worldId={null}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Explicit local timeline'
    );
    expect(screen.getByTestId('team-history-base-truth-label')).toHaveTextContent(
      'Direct local timeline rows'
    );
    expect(screen.getByText('LOCAL_TIMELINE_STAYS_AUTHORITATIVE')).toBeInTheDocument();
    expect(
      screen.queryByText('Waiver record: Fallback Only was waived.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Exception history record: Fallback Wing exception reduced to $2,500,000.'
      )
    ).not.toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });

  it('orders synthesized fallback rows newest-first using source-aware timestamp selection and pushes missing timestamps to the bottom', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          waivedContracts: [
            {
              id: 'waive-dated',
              name: 'Older Forward',
              waivedOn: '2026-02-02',
              stretched: false,
            },
            {
              id: 'waive-missing',
              name: 'No Date Big',
              stretched: false,
            },
          ],
          exceptionHistory: [
            {
              id: 'exception-ts',
              type: 'consumeTradeException',
              timestamp: '2026-02-04T12:00:00.000Z',
              date: '2027-01-01',
              amountRemaining: 4500000,
              sourcePlayerName: 'Wing Creator',
              sourceTeamCode: 'LAL',
            },
          ],
          pickLog: [
            {
              id: 'pick-date',
              date: '2026-02-03',
              action: 'Acquired',
              pick: '2030 2nd Round Pick',
              partner: 'SAS',
            },
            {
              id: 'pick-timestamp-preferred',
              timestamp: '2026-02-01T09:00:00.000Z',
              date: '2027-06-01',
              action: 'Acquired',
              pick: '2029 1st Round Pick',
              partner: 'NYK',
            },
          ],
        }}
        worldId={null}
      />
    );

    const row0 = screen.getByTestId('team-history-event-row-0');
    const row1 = screen.getByTestId('team-history-event-row-1');
    const row2 = screen.getByTestId('team-history-event-row-2');
    const row3 = screen.getByTestId('team-history-event-row-3');
    const row4 = screen.getByTestId('team-history-event-row-4');

    expect(row0).toHaveTextContent('2026-02-04T12:00:00.000Z');
    expect(row0).toHaveTextContent(
      'Exception history record: Wing Creator exception reduced to $4,500,000.'
    );
    expect(row1).toHaveTextContent('2026-02-03');
    expect(row1).toHaveTextContent(
      'Pick log record: acquired 2030 2nd Round Pick from SAS.'
    );
    expect(row2).toHaveTextContent('2026-02-02');
    expect(row2).toHaveTextContent('Waiver record: Older Forward was waived.');
    expect(row3).toHaveTextContent('2026-02-01T09:00:00.000Z');
    expect(row3).not.toHaveTextContent('2027-06-01');
    expect(row3).toHaveTextContent(
      'Pick log record: acquired 2029 1st Round Pick from NYK.'
    );
    expect(row4).toHaveTextContent('Waiver record: No Date Big was waived.');
    expect(row4).toHaveTextContent('—');
  });

  it('preserves derived-source metadata and source-specific detail meaning for synthesized rows', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...buildBaseTeam(),
          waivedContracts: [
            {
              id: 'waive-1',
              name: 'Source Truth Big',
              waivedOn: '2026-02-03',
              stretched: true,
              deadCap: {
                2026: 3000000,
                2027: 3000000,
              },
            },
          ],
          exceptionHistory: [
            {
              id: 'exception-1',
              type: 'consumeTradeException',
              timestamp: '2026-02-04T12:00:00.000Z',
              amountCreated: 6250000,
              amountConsumed: 1750000,
              amountRemaining: 4500000,
              sourcePlayerName: 'Source Truth Wing',
              sourceTeamCode: 'LAL',
              targetTeamCode: 'BOS',
              expiresAt: '2027-02-04T12:00:00.000Z',
            },
          ],
          pickLog: [
            {
              id: 'pick-1',
              timestamp: '2026-02-05T09:00:00.000Z',
              action: 'Acquired',
              pick: '2029 2nd Round Pick',
              partner: 'SAS',
              notes: 'Protected pick added from SAS',
            },
          ],
        }}
        worldId={null}
      />
    );

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Section-derived fallback row'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'derived from pickLog[]'
    );
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'not a canonical world-event payload'
    );
    expect(screen.getByText('Derived-Source Metadata')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-detail-mutation-type')).toHaveTextContent(
      'sectionDerived:pickLog'
    );
    expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent('—');
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Derived from pickLog[]'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Timestamp sourced from timestamp'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Partner team: SAS'
    );
    expect(screen.getByTestId('team-history-raw-payload')).toHaveTextContent(
      '"derivedTimeline": true'
    );
    expect(screen.getByTestId('team-history-raw-payload')).toHaveTextContent(
      '"sourceCollection": "pickLog"'
    );
    expect(screen.getByTestId('team-history-detail-raw-summary')).toHaveTextContent(
      'No raw event ID was carried'
    );
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-1'));
    expect(screen.getByTestId('team-history-detail-mutation-type')).toHaveTextContent(
      'sectionDerived:exceptionHistory'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Derived from exceptionHistory[]'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Action: consumeTradeException'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Counterparty: BOS'
    );
    expect(screen.getByTestId('team-history-raw-payload')).toHaveTextContent(
      '"sourceCollection": "exceptionHistory"'
    );
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-2'));
    expect(screen.getByTestId('team-history-detail-mutation-type')).toHaveTextContent(
      'sectionDerived:waivedContracts'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Derived from waivedContracts[]'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Stretch provision: Yes'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Dead cap breakdown: 2026: $3,000,000; 2027: $3,000,000'
    );
    expect(screen.getByTestId('team-history-raw-payload')).toHaveTextContent(
      '"sourceCollection": "waivedContracts"'
    );
  });
});
