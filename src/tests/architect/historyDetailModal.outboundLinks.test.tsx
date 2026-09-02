/**
 * FILE: src/tests/architect/historyDetailModal.outboundLinks.test.tsx
 * PURPOSE: Cover the History detail modal's outbound links + player-name menus
 *          (interconnectivity Slice 4b): event-type-aware nav, no-clone trade
 *          context, player PlayerActionMenu with eventId, and the deferred
 *          unavailable message for draft/asset events.
 * OWNERSHIP: Feature: architect/history
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HistoryDetailModal } from '@/features/architect/history/TeamHistoryTab/HistoryDetailModal';
import type { TeamHistorySelectedEntry } from '@/features/architect/history/TeamHistoryTab/types';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

const tradeEntry: TeamHistorySelectedEntry = {
  activeTeamCode: 'LAL',
  timelineSourceKey: 'world-events',
  truthKind: 'authoritative-world-event',
  entry: {
    id: 'row_1',
    eventId: 'evt_1',
    mutationType: 'executeTrade',
    type: 'Trade',
    category: 'Transactions',
    summary: 'Trade applied',
    playerIds: ['p1'],
    teamsInvolved: ['LAL', 'BOS'],
  },
};

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(DEV_TEAM_HISTORY_FIXTURE_FLAG);
});

describe('HistoryDetailModal — outbound links + player menus (Slice 4b)', () => {
  it('routes a trade event to rooms and opens a no-clone trade context', () => {
    const onNavigateRoom = vi.fn();
    const onOpenTradeWithRequest = vi.fn();
    const onClose = vi.fn();
    render(
      <HistoryDetailModal
        selectedEntry={tradeEntry}
        onClose={onClose}
        onNavigateRoom={onNavigateRoom}
        onOpenTradeWithRequest={onOpenTradeWithRequest}
      />
    );

    fireEvent.click(screen.getByTestId('team-history-outbound-roster'));
    expect(onNavigateRoom).toHaveBeenCalledWith('roster');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('team-history-outbound-trade-context'));
    expect(onOpenTradeWithRequest).toHaveBeenCalledTimes(1);
    const req = onOpenTradeWithRequest.mock.calls[0][0];
    expect(req.source).toBe('history');
    expect(req.relatedEventId).toBe('evt_1');
    expect(req.playerIds).toBeUndefined(); // no clone
  });

  it('opens a player PlayerActionMenu carrying history eventId context', () => {
    const onPlayerAction = vi.fn();
    render(
      <HistoryDetailModal
        selectedEntry={tradeEntry}
        onClose={vi.fn()}
        onPlayerAction={onPlayerAction}
        resolvePlayerLabel={(id) => (id === 'p1' ? 'LeBron James' : id)}
      />
    );

    expect(screen.getByTestId('team-history-player-p1')).toHaveTextContent(
      'LeBron James'
    );
    fireEvent.click(
      screen.getByTestId('team-history-player-p1-actions-overflow')
    );
    fireEvent.click(
      screen.getByTestId('team-history-player-p1-actions-overflow-view-on-cap')
    );
    expect(onPlayerAction).toHaveBeenCalledWith(
      'view-on-cap',
      expect.objectContaining({
        playerId: 'p1',
        sourceRoom: 'history',
        eventId: 'evt_1',
      })
    );
  });

  it('keeps unresolved historical player actions disabled without exposing IDs', () => {
    const onPlayerAction = vi.fn();
    const unresolvedEntry: TeamHistorySelectedEntry = {
      ...tradeEntry,
      entry: {
        ...tradeEntry.entry,
        playerIds: ['historical_player_1', 'custom_player_2'],
      },
    };

    render(
      <HistoryDetailModal
        selectedEntry={unresolvedEntry}
        onClose={vi.fn()}
        onPlayerAction={onPlayerAction}
        resolvePlayerLabel={(id) => id}
      />
    );

    expect(screen.getAllByText('Player details unavailable')).toHaveLength(2);
    expect(screen.queryByText('historical_player_1')).not.toBeInTheDocument();
    expect(screen.queryByText('custom_player_2')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(
        'team-history-player-historical_player_1-actions-overflow'
      )
    ).toBeDisabled();
    expect(
      screen.getByTestId('team-history-player-custom_player_2-actions-overflow')
    ).toBeDisabled();
    expect(onPlayerAction).not.toHaveBeenCalled();
  });

  it('preserves safe literal compatibility names without enabling ID actions', () => {
    const onPlayerAction = vi.fn();
    const compatibilityEntry: TeamHistorySelectedEntry = {
      ...tradeEntry,
      entry: {
        ...tradeEntry.entry,
        playerIds: ['Historical Player'],
        raw: {
          metadata: { playersTraded: ['Historical Player'] },
        },
      },
    };

    render(
      <HistoryDetailModal
        selectedEntry={compatibilityEntry}
        onClose={vi.fn()}
        onPlayerAction={onPlayerAction}
        resolvePlayerLabel={(playerId) => playerId}
      />
    );

    expect(screen.getByText('Historical Player')).toBeInTheDocument();
    expect(
      screen.queryByText('Player details unavailable')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(
        'team-history-player-Historical Player-actions-overflow'
      )
    ).toBeDisabled();
    expect(onPlayerAction).not.toHaveBeenCalled();
  });

  it('does not treat canonical IDs duplicated into compatibility metadata as names', () => {
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            playerIds: ['HistoricalPlayer'],
            raw: {
              playerIds: ['HistoricalPlayer'],
              metadata: { playersTraded: ['HistoricalPlayer'] },
            },
          },
        }}
        onClose={vi.fn()}
        onPlayerAction={vi.fn()}
        resolvePlayerLabel={(playerId) => playerId}
      />
    );

    expect(screen.getByText('Player details unavailable')).toBeInTheDocument();
    expect(screen.queryByText('HistoricalPlayer')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(
        'team-history-player-HistoricalPlayer-actions-overflow'
      )
    ).toBeDisabled();
  });

  it('preserves a name-only player section when no action row can replace it', () => {
    const nameOnlyEntry = toTeamHistoryEventDisplay({
      mutationType: 'waivePlayer',
      occurredAt: '2026-03-05T02:58:00.000Z',
      metadata: { playerName: 'Austin Reaves' },
    });

    expect(nameOnlyEntry.playerIds).toEqual([]);
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: nameOnlyEntry,
        }}
        onClose={vi.fn()}
        onPlayerAction={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('team-history-detail-sections')
    ).toHaveTextContent('Austin Reaves');
    expect(
      screen.queryByTestId('team-history-detail-player-menus')
    ).not.toBeInTheDocument();
  });

  it('resolves IDs only in player detail fields without rewriting ordinary prose', () => {
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            playerIds: ['cap'],
            detailSections: [
              { title: 'Player', lines: ['cap', 'dead_cap'] },
              { title: 'Waiver', lines: ['Dead cap amount: $1,000'] },
            ],
          },
        }}
        onClose={vi.fn()}
        resolvePlayerLabel={(id) => (id === 'cap' ? 'Cap Player' : id)}
      />
    );

    const modal = screen.getByTestId('team-history-detail-modal');
    expect(modal).toHaveTextContent('Cap Player');
    expect(modal).toHaveTextContent('dead_cap');
    expect(modal).not.toHaveTextContent('dead_Cap Player');
    expect(modal).toHaveTextContent('Dead cap amount: $1,000');
    expect(modal).not.toHaveTextContent('Dead Cap Player amount: $1,000');
  });

  it('shows a deferred unavailable message for draft/asset events (no fake link)', () => {
    const draftEntry: TeamHistorySelectedEntry = {
      ...tradeEntry,
      entry: { id: 'row_2', mutationType: 'draftPick', type: 'Draft' },
    };
    render(
      <HistoryDetailModal
        selectedEntry={draftEntry}
        onClose={vi.fn()}
        onNavigateRoom={vi.fn()}
      />
    );
    expect(
      screen.getByTestId('team-history-outbound-asset-unavailable')
    ).toHaveTextContent(/not available yet/i);
  });

  it('suppresses the committed trade context for DEV-fixture entries', () => {
    const devEntry: TeamHistorySelectedEntry = {
      ...tradeEntry,
      truthKind: 'synthetic-dev-fixture',
      timelineSourceKey: 'dev-fixtures',
    };
    render(
      <HistoryDetailModal
        selectedEntry={devEntry}
        onClose={vi.fn()}
        onNavigateRoom={vi.fn()}
        onOpenTradeWithRequest={vi.fn()}
      />
    );
    expect(
      screen.queryByTestId('team-history-outbound-trade-context')
    ).toBeNull();
    // Non-committed entries still navigate to current-result rooms.
    expect(
      screen.getByTestId('team-history-outbound-roster')
    ).toBeInTheDocument();
  });

  it('shows ordinary saved-move language and resolved names in normal mode', () => {
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            timestamp: '2026-09-02T14:30:00.000Z',
            detailSections: [
              { title: 'Players', lines: ['Austin Reaves'] },
              {
                title: 'Picks',
                lines: [
                  'LAL: out proof-entitlement-LAL-2027-second-round',
                  'BOS: in proof-entitlement-LAL-2027-second-round',
                ],
              },
              { title: 'Trade Receipt', lines: ['Receipt: GOV-raw'] },
              {
                title: 'Cash Consideration Receipt',
                lines: [
                  'Receipt: GOV-cash-raw',
                  'LAL paid $1.00 to BOS',
                  'Persistence verification: Complete',
                ],
              },
            ],
            raw: { eventId: 'GOV-event', playerIds: ['austin_reaves'] },
          },
        }}
        onClose={vi.fn()}
        onPlayerAction={vi.fn()}
        playerMovements={[
          {
            playerId: 'p1',
            sourceTeamCode: 'LAL',
            destinationTeamCode: 'BOS',
          },
        ]}
        resolvePlayerLabel={(id) => (id === 'p1' ? 'Austin Reaves' : id)}
      />
    );

    const modal = screen.getByTestId('team-history-detail-modal');
    expect(modal).toHaveTextContent('Saved Move Details');
    expect(modal).toHaveTextContent('Los Angeles Lakers');
    expect(modal).toHaveTextContent('Boston Celtics');
    expect(modal).toHaveTextContent('Austin Reaves');
    expect(
      screen.getByTestId('team-history-player-p1-direction')
    ).toHaveTextContent(
      'Sent by Los Angeles Lakers · Received by Boston Celtics'
    );
    expect(screen.getByText('Saved on')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-player-p1-actions-overflow')
    ).toBeInTheDocument();
    expect(modal).toHaveTextContent(
      'Sent by Los Angeles Lakers: 2027 second-round pick'
    );
    expect(modal).toHaveTextContent(
      'Received by Boston Celtics: 2027 second-round pick · Los Angeles Lakers'
    );
    expect(modal).toHaveTextContent(
      'Los Angeles Lakers paid $1.00 to Boston Celtics'
    );
    expect(modal).not.toHaveTextContent('Authoritative world-event row');
    expect(modal).not.toHaveTextContent('Mutation Type');
    expect(modal).not.toHaveTextContent('GOV-event');
    expect(modal).not.toHaveTextContent('austin_reaves');
    expect(modal).not.toHaveTextContent('proof-entitlement');
    expect(modal).not.toHaveTextContent('Trade Receipt');
    expect(modal).not.toHaveTextContent('GOV-cash-raw');
    expect(modal).not.toHaveTextContent('Persistence verification');
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).not.toHaveTextContent('2026-09-02T14:30:00.000Z');
  });

  it('preserves the calendar day for a date-only saved value', () => {
    const dateOnlyEntry = toTeamHistoryEventDisplay({
      mutationType: 'executeTrade',
      timestamp: '2025-07-01',
      teamCodes: ['LAL', 'BOS'],
    });

    expect(dateOnlyEntry.timestamp).toBe('2025-07-01');
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: dateOnlyEntry,
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Saved on')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('Jul 1, 2025');
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).not.toHaveTextContent('Jun 30');
  });

  it('preserves year and round for canonical retained pick identifiers', () => {
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            detailSections: [
              {
                title: 'Picks',
                lines: [
                  'LAL: out 2028-LAL-R1',
                  'LAL: out 2028-NYK-R1',
                  'LAL: out ent:UNK:2032:1:own:abc12345',
                  'BOS: in 2030-BOS-R1',
                  'BOS: in ent:MIA:2031:2:swap:abc12345',
                ],
              },
            ],
          },
        }}
        onClose={vi.fn()}
      />
    );

    const modal = screen.getByTestId('team-history-detail-modal');
    expect(modal).toHaveTextContent(
      'Sent by Los Angeles Lakers: 2028 first-round pick'
    );
    expect(modal).toHaveTextContent(
      'Sent by Los Angeles Lakers: 2028 first-round pick · New York Knicks'
    );
    expect(modal).toHaveTextContent(
      'Sent by Los Angeles Lakers: 2032 first-round pick'
    );
    expect(modal).toHaveTextContent(
      'Received by Boston Celtics: 2030 first-round pick'
    );
    expect(modal).toHaveTextContent(
      'Received by Boston Celtics: 2031 second-round swap right · Miami Heat'
    );
    expect(modal).not.toHaveTextContent('draft pick included in this move');
    expect(modal).not.toHaveTextContent('undefined');
    expect(modal).not.toHaveTextContent('UNK');
  });

  it('keeps distinct deterministic rights distinguishable without raw IDs', () => {
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            detailSections: [
              {
                title: 'Picks',
                lines: [
                  'BOS: in ent:BOS:2027:1:swap:bbbbbbbb',
                  'BOS: in ent:BOS:2027:1:swap:aaaaaaaa',
                ],
              },
            ],
          },
        }}
        onClose={vi.fn()}
      />
    );

    const modal = screen.getByTestId('team-history-detail-modal');
    expect(modal).toHaveTextContent(
      'Received by Boston Celtics: 2027 first-round swap right · option 1 of 2'
    );
    expect(modal).toHaveTextContent(
      'Received by Boston Celtics: 2027 first-round swap right · option 2 of 2'
    );
    expect(modal).not.toHaveTextContent('aaaaaaaa');
    expect(modal).not.toHaveTextContent('bbbbbbbb');
  });

  it('reveals diagnostics only after the deliberate developer flag is enabled', () => {
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
    render(
      <HistoryDetailModal
        selectedEntry={{
          ...tradeEntry,
          entry: {
            ...tradeEntry.entry,
            raw: { eventId: 'GOV-event', playerIds: ['austin_reaves'] },
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('team-history-detail-truth-note')
    ).toHaveTextContent('Authoritative world-event row');
    expect(
      screen.getByTestId('team-history-detail-mutation-type')
    ).toHaveTextContent('executeTrade');
    expect(screen.getByTestId('team-history-raw-payload')).toHaveTextContent(
      'GOV-event'
    );
  });
});
