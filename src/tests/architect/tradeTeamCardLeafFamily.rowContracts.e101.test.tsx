/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OutgoingPlayersList } from '@/features/architect/tradeMachine/OutgoingPlayersList';
import { TradePlayerRow } from '@/features/architect/tradeMachine/TradePlayerRow';
import { EntitlementPicksList } from '@/features/architect/tradeMachine/EntitlementPicksList';
import { EntitlementPickRow } from '@/features/architect/tradeMachine/EntitlementPickRow';

const {
  mockGetPlayerPositionLabel,
  mockGetSalaryWithFallback,
  mockGetYearsRemainingDisplay,
  mockGetPlayerProfileUrl,
  mockIsSignAndTradeEligible,
  mockFormatEntitlementLabel,
  mockGetEntitlementKindTag,
  mockProjectEntitlementToPickRow,
  mockGetPickRowDisplayLabel,
  mockGetPickRowSecondaryText,
} = vi.hoisted(() => ({
  mockGetPlayerPositionLabel: vi.fn(),
  mockGetSalaryWithFallback: vi.fn(),
  mockGetYearsRemainingDisplay: vi.fn(),
  mockGetPlayerProfileUrl: vi.fn(),
  mockIsSignAndTradeEligible: vi.fn(),
  mockFormatEntitlementLabel: vi.fn(),
  mockGetEntitlementKindTag: vi.fn(),
  mockProjectEntitlementToPickRow: vi.fn(),
  mockGetPickRowDisplayLabel: vi.fn(),
  mockGetPickRowSecondaryText: vi.fn(),
}));

vi.mock('@/features/table/PlayerTable/PlayerRow/PlayerNameMini', () => ({
  __esModule: true,
  PlayerNameMini: ({ name }: { name?: string }) => <span>{name}</span>,
}));

vi.mock('@/shared/components/TeamLogo', () => ({
  __esModule: true,
  TeamLogo: ({
    teamId,
    teamAbbr,
    className,
  }: {
    teamId?: string;
    teamAbbr?: string;
    className?: string;
  }) => (
    <div
      data-testid="team-logo"
      data-team-id={teamId || teamAbbr}
      className={className}
    />
  ),
}));

vi.mock('@/shared/utils/roles', () => ({
  getPlayerPositionLabel: mockGetPlayerPositionLabel,
}));

vi.mock('@/features/architect/utils/contractSalaryUtils', () => ({
  getSalaryWithFallback: mockGetSalaryWithFallback,
}));

vi.mock('@/features/architect/utils/contractUtils', () => ({
  getYearsRemainingDisplay: mockGetYearsRemainingDisplay,
}));

vi.mock('@/shared/utils/routing/playerRouteUtils', () => ({
  getPlayerProfileUrl: mockGetPlayerProfileUrl,
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility',
  () => ({
    isSignAndTradeEligible: mockIsSignAndTradeEligible,
  })
);

vi.mock('@/features/architect/utils/entitlements/formatEntitlement', () => ({
  formatEntitlementLabel: mockFormatEntitlementLabel,
  getEntitlementKindTag: mockGetEntitlementKindTag,
  getKindSortPriority: (kind?: string) => {
    if (kind === 'pick_ownership') return 1;
    if (kind === 'conveyance_right') return 2;
    if (kind === 'swap_right') return 3;
    return 99;
  },
}));

vi.mock(
  '@/features/architect/utils/entitlements/entitlementPickRowProjection',
  () => ({
    projectEntitlementToPickRow: mockProjectEntitlementToPickRow,
    getPickRowDisplayLabel: mockGetPickRowDisplayLabel,
    getPickRowSecondaryText: mockGetPickRowSecondaryText,
  })
);

vi.mock('@/features/architect/admin/EntitlementEditorCreateButton', () => ({
  EntitlementEditorCreateButton: ({
    onClick,
  }: {
    onClick?: () => void;
  }) => <button onClick={onClick}>Create entitlement</button>,
}));

const OTHER_TEAMS = [
  { id: 'BOS', teamName: 'Boston Celtics', teamCode: 'BOS' },
  { id: 'CHI', teamName: 'Chicago Bulls', teamCode: 'CHI' },
];

const BASE_PLAYER = {
  id: 'alpha',
  player_id: 'alpha',
  name: 'Alpha Player',
  bio: {
    displayName: 'Alpha Player',
    playerId: 'alpha',
    position: 'Guard',
    height: '6-4',
    weight: '200',
  },
  teamCode: 'LAL',
  mockSalary: 5_000_000,
};

const BASE_ENTITLEMENT = {
  id: 'ent-lal-2027-1',
  entitlementId: 'ent-lal-2027-1',
  holderTeam: 'LAL',
  seasonYear: 2027,
  round: 1,
  kind: 'pick_ownership',
  identityKey: 'entitlement:lAL:2027:1:own',
};

describe('E101 Trade Team Card leaf-family row and list contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    mockGetPlayerPositionLabel.mockReturnValue('PG');
    mockGetSalaryWithFallback.mockImplementation(
      (player: { mockSalary?: number }) => player.mockSalary || 0
    );
    mockGetYearsRemainingDisplay.mockReturnValue(2);
    mockGetPlayerProfileUrl.mockReturnValue('#player-profile');
    mockIsSignAndTradeEligible.mockReturnValue({ eligible: true });
    mockFormatEntitlementLabel.mockImplementation(
      (entitlement: { holderTeam?: string; seasonYear?: number; round?: number }) =>
        `${entitlement.holderTeam} ${entitlement.seasonYear} Round ${entitlement.round}`
    );
    mockGetEntitlementKindTag.mockImplementation((kind?: string) => ({
      label: kind === 'swap_right' ? 'Swap' : 'Own',
      colorClass: 'bg-blue-900/30 text-blue-300',
    }));
    mockProjectEntitlementToPickRow.mockImplementation(
      (entitlement: {
        holderTeam?: string;
        seasonYear?: number;
        round?: number;
        secondaryText?: string;
      }) => ({
        originalTeam: entitlement.holderTeam,
        year: entitlement.seasonYear,
        round: entitlement.round,
        secondaryText: entitlement.secondaryText || 'Top 10 protected',
      })
    );
    mockGetPickRowDisplayLabel.mockImplementation(
      (pickRow: { originalTeam?: string }) => `via ${pickRow.originalTeam}`
    );
    mockGetPickRowSecondaryText.mockImplementation(
      (pickRow: { secondaryText?: string }) => pickRow.secondaryText || ''
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('TradePlayerRow preserves outgoing menu wording and item order', () => {
    render(
      <TradePlayerRow
        player={BASE_PLAYER}
        included={false}
        yearKey={2026}
        incoming={false}
        otherTeams={OTHER_TEAMS}
        playersMap={{}}
        openMenu={String(
          BASE_PLAYER.id ?? BASE_PLAYER.player_id ?? BASE_PLAYER.name ?? ''
        )}
        onSetPlayerTrade={vi.fn()}
        onUndoPlayerTrade={vi.fn()}
        setOpenMenu={vi.fn()}
        setContractPlayer={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        sourceTeamId="LAL"
      />
    );

    const firstTradeButton = screen.getByRole('button', {
      name: 'Trade to Boston Celtics',
    });
    const menuButtons = within(firstTradeButton.parentElement as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(menuButtons).toEqual([
      'Trade to Boston Celtics',
      'Trade to Chicago Bulls',
      'Sign-and-Trade',
      'Contract Actions',
      'View Profile',
    ]);
  });

  it('TradePlayerRow preserves trade callback argument order', () => {
    const onSetPlayerTrade = vi.fn();

    render(
      <TradePlayerRow
        player={BASE_PLAYER}
        included={false}
        yearKey={2026}
        incoming={false}
        otherTeams={OTHER_TEAMS}
        playersMap={{}}
        openMenu={String(
          BASE_PLAYER.id ?? BASE_PLAYER.player_id ?? BASE_PLAYER.name ?? ''
        )}
        onSetPlayerTrade={onSetPlayerTrade}
        onUndoPlayerTrade={vi.fn()}
        setOpenMenu={vi.fn()}
        setContractPlayer={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        sourceTeamId="LAL"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trade to Boston Celtics' }));

    expect(onSetPlayerTrade.mock.calls[0]).toEqual([BASE_PLAYER, 'trade', 'BOS']);
  });

  it('TradePlayerRow preserves sign-and-trade, undo, contract-edit, and profile behavior', () => {
    const onRequestSignAndTrade = vi.fn();
    const onUndoPlayerTrade = vi.fn();
    const setContractPlayer = vi.fn();

    const includedPlayer = {
      ...BASE_PLAYER,
      name: 'Included Player',
      tradeTo: 'BOS',
    };

    const { rerender } = render(
      <TradePlayerRow
        player={BASE_PLAYER}
        included={false}
        yearKey={2026}
        incoming={false}
        otherTeams={OTHER_TEAMS}
        playersMap={{}}
        openMenu={String(
          BASE_PLAYER.id ?? BASE_PLAYER.player_id ?? BASE_PLAYER.name ?? ''
        )}
        onSetPlayerTrade={vi.fn()}
        onUndoPlayerTrade={onUndoPlayerTrade}
        setOpenMenu={vi.fn()}
        setContractPlayer={setContractPlayer}
        onRequestSignAndTrade={onRequestSignAndTrade}
        sourceTeamId="LAL"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign-and-Trade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Contract Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Profile' }));

    expect(onRequestSignAndTrade.mock.calls[0]).toEqual([BASE_PLAYER, 'BOS']);
    expect(setContractPlayer.mock.calls[0]).toEqual([BASE_PLAYER]);
    expect(window.location.hash).toBe('#player-profile');

    rerender(
      <TradePlayerRow
        player={includedPlayer}
        included={true}
        yearKey={2026}
        incoming={false}
        otherTeams={OTHER_TEAMS}
        playersMap={{}}
        openMenu={String(
          includedPlayer.id ??
            includedPlayer.player_id ??
            includedPlayer.name ??
            ''
        )}
        onSetPlayerTrade={vi.fn()}
        onUndoPlayerTrade={onUndoPlayerTrade}
        setOpenMenu={vi.fn()}
        setContractPlayer={setContractPlayer}
        onRequestSignAndTrade={onRequestSignAndTrade}
        sourceTeamId="LAL"
      />
    );

    const firstTradeButton = screen.getByRole('button', { name: 'Cancel Trade' });
    const menuButtons = within(firstTradeButton.parentElement as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(menuButtons).toEqual([
      'Cancel Trade',
      'Trade to Chicago Bulls',
      'Undo Trade',
      'Contract Actions',
      'View Profile',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Undo Trade' }));
    expect(onUndoPlayerTrade.mock.calls[0]).toEqual([includedPlayer]);
  });

  it('OutgoingPlayersList preserves incoming-first plus salary sort and row callback propagation', () => {
    const onSetPlayerTrade = vi.fn();

    render(
      <OutgoingPlayersList
        team={{
          players: [
            {
              ...BASE_PLAYER,
              id: 'low',
              player_id: 'low',
              name: 'Low Salary',
              bio: { ...BASE_PLAYER.bio, displayName: 'Low Salary' },
              mockSalary: 2_000_000,
            },
            {
              ...BASE_PLAYER,
              id: 'high',
              player_id: 'high',
              name: 'High Salary',
              bio: { ...BASE_PLAYER.bio, displayName: 'High Salary' },
              mockSalary: 9_000_000,
            },
          ],
        }}
        sends={[]}
        incomingPlayers={[
          {
            ...BASE_PLAYER,
            id: 'incoming',
            player_id: 'incoming',
            name: 'Incoming Player',
            bio: { ...BASE_PLAYER.bio, displayName: 'Incoming Player' },
            mockSalary: 1_000_000,
          },
        ]}
        yearKey={2026}
        otherTeams={OTHER_TEAMS}
        playersMap={{}}
        onSetPlayerTrade={onSetPlayerTrade}
        onUndoPlayerTrade={vi.fn()}
        onEditContract={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        sourceTeamId="LAL"
      />
    );

    const incomingPlayer = screen.getByText('Incoming Player');
    const highSalary = screen.getByText('High Salary');
    const lowSalary = screen.getByText('Low Salary');

    expect(
      incomingPlayer.compareDocumentPosition(highSalary) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      highSalary.compareDocumentPosition(lowSalary) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: '•••' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Trade to Boston Celtics' }));

    expect(onSetPlayerTrade.mock.calls[0]).toEqual([
      expect.objectContaining({ name: 'High Salary' }),
      'trade',
      'BOS',
    ]);
  });

  it('EntitlementPickRow preserves routing callback order for new trades', () => {
    const events: Array<unknown[]> = [];
    const entitlement = { ...BASE_ENTITLEMENT };

    render(
      <EntitlementPickRow
        entitlement={entitlement}
        teamId="LAL"
        otherTeams={OTHER_TEAMS}
        openMenu={entitlement.id}
        setOpenMenu={vi.fn()}
        onToggle={(entry) => events.push(['toggle', entry])}
        onSetDestination={(entitlementId, toTeamId) =>
          events.push(['setDestination', entitlementId, toTeamId])
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trade to Boston Celtics' }));

    expect(events).toEqual([
      ['toggle', entitlement],
      ['setDestination', entitlement.id, 'BOS'],
    ]);
  });

  it('EntitlementPickRow preserves selected menu wording, item order, and action argument order', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const onViewDetails = vi.fn();
    const onRevertEdit = vi.fn();
    const entitlement = {
      ...BASE_ENTITLEMENT,
      __vacuumEdited: true,
    };

    render(
      <EntitlementPickRow
        entitlement={entitlement}
        teamId="LAL"
        isSelected={true}
        currentToTeamId="BOS"
        otherTeams={OTHER_TEAMS}
        openMenu={entitlement.id}
        setOpenMenu={vi.fn()}
        onToggle={onToggle}
        onSetDestination={vi.fn()}
        onEdit={onEdit}
        onViewDetails={onViewDetails}
        isVacuumMode={true}
        onRevertEdit={onRevertEdit}
      />
    );

    const firstTradeButton = screen.getByRole('button', { name: 'Cancel Trade' });
    const menuButtons = within(firstTradeButton.parentElement as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(menuButtons).toEqual([
      'Cancel Trade',
      'Trade to Chicago Bulls',
      'Undo Trade',
      'Modify',
      'View Details',
      'Revert this edit',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Undo Trade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revert this edit' }));

    expect(onToggle.mock.calls[0]).toEqual([entitlement]);
    expect(onEdit.mock.calls[0]).toEqual([entitlement]);
    expect(onViewDetails.mock.calls[0]).toEqual([entitlement]);
    expect(onRevertEdit.mock.calls[0]).toEqual([entitlement]);
  });

  it('EntitlementPickRow preserves session-only delete wording and callback argument order', () => {
    const onDeleteSessionPickRight = vi.fn();
    const entitlement = {
      ...BASE_ENTITLEMENT,
      id: 'vacuum:LAL:2027:1:own',
      __vacuumSessionOnly: true,
    };

    render(
      <EntitlementPickRow
        entitlement={entitlement}
        teamId="LAL"
        otherTeams={OTHER_TEAMS}
        openMenu={entitlement.id}
        setOpenMenu={vi.fn()}
        onToggle={vi.fn()}
        onSetDestination={vi.fn()}
        onEdit={vi.fn()}
        onViewDetails={vi.fn()}
        isVacuumMode={true}
        onDeleteSessionPickRight={onDeleteSessionPickRight}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete this session pick right' })
    );

    expect(onDeleteSessionPickRight.mock.calls[0]).toEqual([entitlement]);
  });

  it('EntitlementPicksList preserves grouping, dedupe, filtering, and row callback propagation', () => {
    const onToggleEntitlement = vi.fn();
    const onSetDestination = vi.fn();

    render(
      <EntitlementPicksList
        teamId="LAL"
        otherTeams={OTHER_TEAMS}
        onToggleEntitlement={onToggleEntitlement}
        onSetDestination={onSetDestination}
        onEditEntitlement={vi.fn()}
        onViewDetails={vi.fn()}
        entitlements={[
          {
            ...BASE_ENTITLEMENT,
            id: 'pooled-hidden',
            identityKey: 'pooled-hidden',
            seasonYear: 2029,
            underlyingStatus: 'pooled',
          },
          {
            ...BASE_ENTITLEMENT,
            id: 'duplicate-first',
            identityKey: 'duplicate-key',
            seasonYear: 2028,
            round: 2,
            kind: 'swap_right',
            secondaryText: 'Original duplicate',
          },
          {
            ...BASE_ENTITLEMENT,
            id: 'earliest',
            identityKey: 'earliest',
            seasonYear: 2027,
            round: 1,
            kind: 'pick_ownership',
            secondaryText: 'Earliest entitlement',
          },
          {
            ...BASE_ENTITLEMENT,
            id: 'duplicate-latest',
            identityKey: 'duplicate-key',
            seasonYear: 2028,
            round: 2,
            kind: 'swap_right',
            secondaryText: 'Latest duplicate',
          },
        ]}
      />
    );

    const year2027 = screen.getByText('2027');
    const year2028 = screen.getByText('2028');
    const earliestRow = screen.getByText('2027 - Round 1');
    const duplicateRow = screen.getByText('2028 - Round 2');

    expect(screen.queryByText('2029')).not.toBeInTheDocument();
    expect(screen.queryByText('Original duplicate')).not.toBeInTheDocument();
    expect(
      year2027.compareDocumentPosition(year2028) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      earliestRow.compareDocumentPosition(duplicateRow) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: '•••' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Trade to Boston Celtics' }));

    expect(onToggleEntitlement.mock.calls[0]).toEqual([
      expect.objectContaining({ id: 'earliest' }),
    ]);
    expect(onSetDestination.mock.calls[0]).toEqual(['earliest', 'BOS']);
  });
});
