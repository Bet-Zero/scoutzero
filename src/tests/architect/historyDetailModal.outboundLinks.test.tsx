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
    expect(screen.getByTestId('team-history-outbound-roster')).toBeInTheDocument();
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
      'Received by Boston Celtics: 2027 second-round pick'
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
