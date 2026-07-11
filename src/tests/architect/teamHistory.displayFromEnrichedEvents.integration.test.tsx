// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';
import { buildWorldMutationEventPayload } from '@/features/architect/utils/mutationPipeline';

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

function buildEvent({
  mutationType,
  eventId,
  timestamp,
  teamCodes,
  playerIds,
  metadata,
  beforeCap,
  afterCap,
}: {
  mutationType: string;
  eventId: string;
  timestamp: number;
  teamCodes: string[];
  playerIds?: string[];
  metadata: Record<string, unknown>;
  beforeCap?: number;
  afterCap?: number;
}) {
  const primaryTeam = teamCodes[0] || 'LAL';

  return buildWorldMutationEventPayload({
    mutationType,
    eventId,
    seasonId: '2025-26',
    worldId: 'world_lal',
    timestamp,
    computeResult: {
      metadata,
      teamUpdates: teamCodes.map((teamCode) => ({ teamCode })),
      playerUpdates: (playerIds || []).map((playerId) => ({ playerId })),
    },
    auditContext: {
      operationId: `op_${eventId}`,
      teamCodes,
      beforeTotalsByTeam:
        beforeCap == null
          ? {}
          : { [primaryTeam]: { totalCapAllocations: beforeCap } },
      afterTotalsByTeam:
        afterCap == null
          ? {}
          : { [primaryTeam]: { totalCapAllocations: afterCap } },
    },
  });
}

describe('TEAM_HISTORY_E5 display integration from enriched world events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
  });

  it('renders transaction-log quality summary/details from enriched payload shapes', () => {
    const events = [
      buildEvent({
        mutationType: 'executeTrade',
        eventId: 'evt_trade_e5',
        timestamp: Date.parse('2026-03-03T14:00:00.000Z'),
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['player_trade_a', 'player_trade_b'],
        metadata: {
          playersTraded: ['player_trade_a', 'player_trade_b'],
          entitlementsTraded: {
            LAL: { out: ['2028-LAL-R1'], in: [] },
            BOS: { out: [], in: ['2028-LAL-R1'] },
          },
        },
        beforeCap: 150000000,
        afterCap: 149000000,
      }),
      buildEvent({
        mutationType: 'signFreeAgent',
        eventId: 'evt_sign_e5',
        timestamp: Date.parse('2026-03-03T13:00:00.000Z'),
        teamCodes: ['LAL'],
        playerIds: ['player_sign'],
        metadata: {
          playerId: 'player_sign',
          playerName: 'player_sign',
          signedUsing: 'NTMLE',
          contract: {
            years: 3,
            firstYearSalary: 12000000,
            salariesByYear: [
              { season: '2025-26', salary: 12000000 },
              { season: '2026-27', salary: 13000000 },
            ],
          },
        },
        beforeCap: 140000000,
        afterCap: 152000000,
      }),
      buildEvent({
        mutationType: 'waivePlayer',
        eventId: 'evt_waive_e5',
        timestamp: Date.parse('2026-03-03T12:00:00.000Z'),
        teamCodes: ['LAL'],
        playerIds: ['player_waive'],
        metadata: {
          playerId: 'player_waive',
          playerName: 'player_waive',
          stretched: true,
          buyout: true,
          deadCapAmount: 4500000,
        },
        beforeCap: 152000000,
        afterCap: 156500000,
      }),
      buildEvent({
        mutationType: 'extendPlayer',
        eventId: 'evt_extend_e5',
        timestamp: Date.parse('2026-03-03T11:00:00.000Z'),
        teamCodes: ['LAL'],
        playerIds: ['player_extend'],
        metadata: {
          playerId: 'player_extend',
          playerName: 'player_extend',
          extensionYears: 4,
          extensionTerms: {
            salariesByYear: [
              { season: '2026-27', salary: 22000000 },
              { season: '2027-28', salary: 23500000 },
            ],
          },
        },
      }),
      buildEvent({
        mutationType: 'finalizeDeclinedOfferSheet',
        eventId: 'evt_finalize_declined_offer_sheet_e5',
        timestamp: Date.parse('2026-03-03T10:30:00.000Z'),
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['player_offer_decline'],
        metadata: {
          teamCode: 'LAL',
          playerId: 'player_offer_decline',
          playerName: 'player_offer_decline',
          signedUsing: 'Offer Sheet',
          contract: {
            years: 4,
            firstYearSalary: 16000000,
            salariesByYear: [
              { season: '2025-26', salary: 16000000 },
              { season: '2026-27', salary: 17200000 },
            ],
          },
        },
      }),
      buildEvent({
        mutationType: 'setExceptions',
        eventId: 'evt_set_exceptions_e5',
        timestamp: Date.parse('2026-03-03T10:00:00.000Z'),
        teamCodes: ['LAL'],
        metadata: {
          teamCode: 'LAL',
          exceptionChanges: ['NTMLE remaining reduced'],
        },
      }),
    ];

    useWorldTeamEventsMock.mockReturnValue({
      events,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: null,
    });

    render(<TeamHistoryTab teamCapSheet={teamCapSheet} worldId="world_lal" />);

    expect(screen.getByTestId('team-history-event-row-0')).toHaveTextContent(
      'Trade Executed:'
    );
    expect(screen.getByTestId('team-history-event-row-1')).toHaveTextContent(
      'Signed Free Agent:'
    );
    expect(screen.getByTestId('team-history-event-row-2')).toHaveTextContent(
      'Waive Player:'
    );
    expect(screen.getByTestId('team-history-event-row-3')).toHaveTextContent(
      'Extension Signed:'
    );
    expect(screen.getByTestId('team-history-event-row-4')).toHaveTextContent(
      'Offer Sheet Finalized (Declined):'
    );
    expect(screen.getByTestId('team-history-event-row-5')).toHaveTextContent(
      'Exceptions Updated:'
    );

    expect(screen.queryByText(/details unavailable/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-history-event-row-0'));
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Picks')).toBeInTheDocument();
    expect(screen.getByText('Cap Allocation')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-modal').textContent || ''
    ).toContain('LAL total cap allocations: -$1,000,000');
    expect(screen.getAllByText(/2028-LAL-R1/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-1'));
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText(/Years: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/First year salary:/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights\/exception used:/i)).toBeInTheDocument();
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-2'));
    expect(screen.getByText(/Stretch provision applied/i)).toBeInTheDocument();
    expect(screen.getByText(/Dead cap amount:/i)).toBeInTheDocument();
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-3'));
    expect(screen.getByText(/Extension years: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Seasons: 2026-27/i)).toBeInTheDocument();
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-4'));
    expect(screen.getByText('Offer Sheet')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-type').textContent || ''
    ).toContain('offer-sheet · Offer Sheet Finalized (Declined)');
    expect(
      screen.getByText(/Stage: Offer Sheet Finalized \(Declined\)/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));

    fireEvent.click(screen.getByTestId('team-history-event-row-5'));
    expect(screen.getByText('Exception Changes')).toBeInTheDocument();
    expect(screen.getAllByText(/NTMLE remaining reduced/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('team-history-raw-payload')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-history-detail-close'));
  });
});
