/**
 * FILE: src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx
 * PURPOSE: Focused UI coverage for the E86 Free Agent Pool TS surface and kept JSX shims.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Added during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 *
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FreeAgentPool from '@/features/architect/freeAgency/FreeAgentPool';
import type { FreeAgentModalVisibleAction } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

const { mockGetPlayerProfileUrl, mockEditContractModalProps } = vi.hoisted(() => ({
  mockGetPlayerProfileUrl: vi.fn(() => '#player-profile'),
  mockEditContractModalProps: vi.fn(),
}));

vi.mock('@/shared/utils/routing/playerRouteUtils', () => ({
  getPlayerProfileUrl: mockGetPlayerProfileUrl,
}));

type MockEditContractModalProps = {
  isOpen?: boolean;
  player?: {
    id?: string;
    player_id?: string;
    displayName?: string;
    name?: string;
    bio?: {
      playerId?: string;
      displayName?: string;
    };
  };
  onClose?: () => void;
  onSignFreeAgent?: unknown;
  onSignAndTrade?: unknown;
  getSignAndTradePreflight?: unknown;
  getOfferSheetPreflight?: unknown;
  onStoreOfferSheet?: unknown;
  actionsOverride?: unknown;
  actionLabelsOverride?: unknown;
  showOfferSheetToggle?: unknown;
  onSave?: unknown;
};

vi.mock('@/shared/components/EditContractModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    player,
    onClose,
    onSignFreeAgent,
    onSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
    onStoreOfferSheet,
    actionsOverride,
    actionLabelsOverride,
    showOfferSheetToggle,
    onSave,
  }: MockEditContractModalProps) => {
    if (!isOpen) return null;

    mockEditContractModalProps({
      isOpen,
      player,
      onClose,
      onSignFreeAgent,
      onSignAndTrade,
      getSignAndTradePreflight,
      getOfferSheetPreflight,
      onStoreOfferSheet,
      actionsOverride,
      actionLabelsOverride,
      showOfferSheetToggle,
      onSave,
    });

    return (
      <div data-testid="mock-edit-contract-modal">
        <div data-testid="mock-edit-contract-modal-player">
          {player?.bio?.displayName || player?.name || ''}
        </div>
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  },
}));

const PLAYER = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'ATL',
  headshotUrl: '/assets/headshots/player_1.png',
  formattedPosition: 'SF',
  previousSalary: 12_000_000,
  birdRights: 'Full Bird',
  bio: {
    playerId: 'player_1',
    displayName: 'Test Player',
    position: 'Small Forward',
    age: 27,
    height: 80,
    weight: 220,
  },
};

const FREE_AGENT = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  freeAgentType: 'RFA',
  previousSalary: 12_000_000,
  birdRights: 'Full Bird',
  height: '6-8',
  weight: 220,
};

const playersMap = {
  [PLAYER.id]: PLAYER,
  [PLAYER.player_id]: PLAYER,
  [PLAYER.name]: PLAYER,
};

const buildWorldOnlyActionOwner = (
  overrides: Partial<Record<string, unknown>> = {}
) => ({
  signAndTrade: vi.fn().mockResolvedValue({ success: true }),
  getSignAndTradePreflight: vi.fn(),
  getOfferSheetPreflight: vi.fn(),
  storeOfferSheet: vi.fn().mockResolvedValue({ success: true }),
  matchOfferSheet: vi.fn(),
  declineOfferSheet: vi.fn(),
  finalizeOfferSheet: vi.fn(),
  ...overrides,
});

const buildFreeAgentModalAvailability = ({
  worldOnlyActionOwner,
  overrides = {},
}: {
  worldOnlyActionOwner: ReturnType<typeof buildWorldOnlyActionOwner> | null;
  overrides?: Partial<{
    visibleActions: FreeAgentModalVisibleAction[];
    actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
    showOfferSheetToggle: boolean;
  }>;
}): {
  visibleActions: FreeAgentModalVisibleAction[];
  actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
  showOfferSheetToggle: boolean;
} => ({
  visibleActions:
    worldOnlyActionOwner?.signAndTrade &&
    worldOnlyActionOwner?.getSignAndTradePreflight
      ? ['signNew', 'signAndTrade']
      : ['signNew'],
  actionLabelsOverride: {
    signNew: 'Sign Free Agent',
  },
  showOfferSheetToggle: Boolean(
    worldOnlyActionOwner?.storeOfferSheet &&
      worldOnlyActionOwner?.getOfferSheetPreflight
  ),
  ...overrides,
});

const buildActionOwner = ({
  dualPathSigning,
  worldOnly = null,
  freeAgentModalAvailability,
}: {
  dualPathSigning?: Partial<Record<string, unknown>>;
  worldOnly?: Partial<Record<string, unknown>> | null;
  freeAgentModalAvailability?: Partial<{
    visibleActions: FreeAgentModalVisibleAction[];
    actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
    showOfferSheetToggle: boolean;
  }>;
} = {}): React.ComponentProps<typeof FreeAgentPool>['actionOwner'] => {
  const resolvedWorldOnlyActionOwner = worldOnly
    ? buildWorldOnlyActionOwner(worldOnly)
    : null;

  return {
    dualPathSigning: {
      signFreeAgent: vi.fn().mockResolvedValue({ success: true }),
      ...dualPathSigning,
    },
    worldOnly: resolvedWorldOnlyActionOwner,
    freeAgentModalAvailability: buildFreeAgentModalAvailability({
      worldOnlyActionOwner: resolvedWorldOnlyActionOwner,
      overrides: freeAgentModalAvailability,
    }),
  };
};

const renderPool = (
  overrides: Partial<React.ComponentProps<typeof FreeAgentPool>> = {}
) => {
  const actionOwner = overrides.actionOwner || buildActionOwner();

  const renderResult = render(
    <FreeAgentPool
      freeAgents={[FREE_AGENT]}
      currentYear={2026}
      actionOwner={actionOwner}
      playersMap={playersMap}
      {...overrides}
    />
  );

  return { actionOwner, ...renderResult };
};

const openFromSelectedCard = (playerName: RegExp = /test player/i) => {
  fireEvent.click(screen.getByRole('button', { name: playerName }));
  fireEvent.click(screen.getByRole('button', { name: /Sign Player/i }));
};

const openFromRowMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: '•••' }));
  fireEvent.click(
    screen.getByText(/Sign Free Agent/i, { selector: 'button' })
  );
};

const getLatestModalProps = () =>
  mockEditContractModalProps.mock.calls.at(-1)?.[0] as MockEditContractModalProps;

const getPoolRowButtons = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll('ul li > div[role="button"]')
  ) as HTMLDivElement[];

describe('FreeAgentPool surface E86 behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('toggles row selection into and out of the selected-card strip through the top-level wrapper import', () => {
    renderPool();

    const rowButton = screen.getByRole('button', { name: /test player/i });
    fireEvent.click(rowButton);

    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Player/i })).toBeInTheDocument();

    fireEvent.click(rowButton);

    expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Sign Player/i })
    ).not.toBeInTheDocument();
  });

  it('preserves selected-card remove wiring and card content order', () => {
    renderPool();

    fireEvent.click(screen.getByRole('button', { name: /test player/i }));

    const previousSalaryLabel = screen.getByText(/Previous Salary/i);
    const signPlayerButton = screen.getByRole('button', { name: /Sign Player/i });
    expect(
      previousSalaryLabel.compareDocumentPosition(signPlayerButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    expect(
      screen.queryByRole('button', { name: /Sign Player/i })
    ).not.toBeInTheDocument();
  });

  it('preserves selected-card sign wiring into EditContractModal', () => {
    renderPool();

    openFromSelectedCard();

    expect(screen.getByTestId('mock-edit-contract-modal')).toBeInTheDocument();
    expect(screen.getByTestId('mock-edit-contract-modal-player')).toHaveTextContent(
      /test player/i
    );
  });

  it('passes grouped-owner standard signing directly into EditContractModal without onSave fallback props', () => {
    const actionOwner = buildActionOwner();
    renderPool({ actionOwner });

    openFromSelectedCard();

    const modalProps = getLatestModalProps();
    expect(modalProps?.onSignFreeAgent).toEqual(expect.any(Function));
    expect(modalProps?.onSave).toBeUndefined();
    expect(modalProps?.onSignFreeAgent).toBe(
      actionOwner.dualPathSigning.signFreeAgent
    );
    expect(modalProps?.onSignAndTrade).toBeUndefined();
    expect(modalProps?.getSignAndTradePreflight).toBeUndefined();
    expect(modalProps?.getOfferSheetPreflight).toBeUndefined();
    expect(modalProps?.onStoreOfferSheet).toBeUndefined();
    expect(modalProps?.actionsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.visibleActions
    );
    expect(modalProps?.actionLabelsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.actionLabelsOverride
    );
    expect(modalProps?.showOfferSheetToggle).toBe(
      actionOwner.freeAgentModalAvailability.showOfferSheetToggle
    );
  });

  it('threads grouped owner world-mode callbacks into EditContractModal while keeping standard signing on the authoritative owner', () => {
    const actionOwner = buildActionOwner({
      worldOnly: {},
    });
    renderPool({ actionOwner });

    openFromSelectedCard();

    const modalProps = getLatestModalProps();
    expect(modalProps?.onSignFreeAgent).toEqual(expect.any(Function));
    expect(modalProps?.onSignFreeAgent).toBe(
      actionOwner.dualPathSigning.signFreeAgent
    );
    expect(modalProps?.onSignAndTrade).toBe(actionOwner.worldOnly?.signAndTrade);
    expect(modalProps?.getSignAndTradePreflight).toBe(
      actionOwner.worldOnly?.getSignAndTradePreflight
    );
    expect(modalProps?.getOfferSheetPreflight).toBe(
      actionOwner.worldOnly?.getOfferSheetPreflight
    );
    expect(modalProps?.onStoreOfferSheet).toBe(actionOwner.worldOnly?.storeOfferSheet);
    expect(modalProps?.actionsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.visibleActions
    );
    expect(modalProps?.actionLabelsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.actionLabelsOverride
    );
    expect(modalProps?.showOfferSheetToggle).toBe(
      actionOwner.freeAgentModalAvailability.showOfferSheetToggle
    );
  });

  it('projects visible modal action availability from the grouped owner instead of local world-only inference', () => {
    const actionOwner = buildActionOwner({
      worldOnly: {},
      freeAgentModalAvailability: {
        visibleActions: ['signNew'],
        showOfferSheetToggle: false,
      },
    });
    renderPool({ actionOwner });

    openFromSelectedCard();

    const modalProps = getLatestModalProps();
    expect(modalProps?.onSignAndTrade).toBe(actionOwner.worldOnly?.signAndTrade);
    expect(modalProps?.getOfferSheetPreflight).toBe(
      actionOwner.worldOnly?.getOfferSheetPreflight
    );
    expect(modalProps?.onStoreOfferSheet).toBe(actionOwner.worldOnly?.storeOfferSheet);
    expect(modalProps?.actionsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.visibleActions
    );
    expect(modalProps?.actionLabelsOverride).toEqual(
      actionOwner.freeAgentModalAvailability.actionLabelsOverride
    );
    expect(modalProps?.showOfferSheetToggle).toBe(false);
  });

  it('opens the same shared modal-launch state from selected-card and row-menu entry surfaces', () => {
    const actionOwner = buildActionOwner({
      worldOnly: {},
    });
    renderPool({ actionOwner });

    openFromSelectedCard();

    const selectedCardModalProps = getLatestModalProps();

    fireEvent.click(screen.getByRole('button', { name: /Close Modal/i }));

    openFromRowMenu();

    const rowMenuModalProps = getLatestModalProps();

    expect(rowMenuModalProps).toEqual(
      expect.objectContaining({
        player: selectedCardModalProps.player,
        onClose: selectedCardModalProps.onClose,
        onSignFreeAgent: selectedCardModalProps.onSignFreeAgent,
        onSignAndTrade: selectedCardModalProps.onSignAndTrade,
        getSignAndTradePreflight:
          selectedCardModalProps.getSignAndTradePreflight,
        getOfferSheetPreflight: selectedCardModalProps.getOfferSheetPreflight,
        onStoreOfferSheet: selectedCardModalProps.onStoreOfferSheet,
        actionsOverride: selectedCardModalProps.actionsOverride,
      })
    );
    expect(screen.getByTestId('mock-edit-contract-modal-player')).toHaveTextContent(
      /test player/i
    );
  });

  it('keeps duplicate-name free agents independently selectable and removable by stable selection key', () => {
    const duplicateNamePlayersMap = {
      player_1: {
        ...PLAYER,
        id: 'player_1',
        player_id: 'player_1',
        name: 'Same Player',
        displayName: 'Same Player',
        bio: {
          ...PLAYER.bio,
          playerId: 'player_1',
          displayName: 'Same Player',
        },
      },
      player_2: {
        ...PLAYER,
        id: 'player_2',
        player_id: 'player_2',
        name: 'Same Player',
        displayName: 'Same Player',
        bio: {
          ...PLAYER.bio,
          playerId: 'player_2',
          displayName: 'Same Player',
        },
      },
      'Same Player': {
        ...PLAYER,
        id: 'player_2',
        player_id: 'player_2',
        name: 'Same Player',
        displayName: 'Same Player',
        bio: {
          ...PLAYER.bio,
          playerId: 'player_2',
          displayName: 'Same Player',
        },
      },
    };
    const duplicateNameFreeAgents = [
      {
        ...FREE_AGENT,
        id: 'player_1',
        player_id: 'player_1',
        name: 'Same Player',
      },
      {
        ...FREE_AGENT,
        id: 'player_2',
        player_id: 'player_2',
        name: 'Same Player',
      },
    ];
    const { container } = renderPool({
      freeAgents: duplicateNameFreeAgents,
      playersMap: duplicateNamePlayersMap,
    });

    const rowButtons = getPoolRowButtons(container);
    expect(rowButtons).toHaveLength(2);

    fireEvent.click(rowButtons[0]);
    fireEvent.click(rowButtons[1]);

    expect(screen.getAllByRole('button', { name: /Sign Player/i })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: '✕' })[0]);

    expect(screen.getAllByRole('button', { name: /Sign Player/i })).toHaveLength(1);
  });

  it('prefers stable id lookup over conflicting name fallback while keeping visible identity aligned across row, selected-card, and modal launch', () => {
    const stableIdPlayer = {
      ...PLAYER,
      id: 'player_1',
      player_id: 'player_1',
      name: 'Canonical Player',
      displayName: 'Canonical Player',
      teamCode: 'ATL',
      bio: {
        ...PLAYER.bio,
        playerId: 'player_1',
        displayName: 'Canonical Player',
      },
    };
    const conflictingNamePlayer = {
      ...PLAYER,
      id: 'wrong_player',
      player_id: 'wrong_player',
      name: 'Conflicting Player',
      displayName: 'Conflicting Player',
      teamCode: 'BOS',
      bio: {
        ...PLAYER.bio,
        playerId: 'wrong_player',
        displayName: 'Conflicting Player',
      },
    };
    const conflictingFreeAgent = {
      ...FREE_AGENT,
      id: 'player_1',
      player_id: 'player_1',
      name: 'Alias Name',
    };
    const conflictingPlayersMap = {
      player_1: stableIdPlayer,
      'Alias Name': conflictingNamePlayer,
      aliasname: conflictingNamePlayer,
    };
    const actionOwner = buildActionOwner({
      worldOnly: {},
    });
    renderPool({
      actionOwner,
      freeAgents: [conflictingFreeAgent],
      playersMap: conflictingPlayersMap,
    });

    expect(screen.getByRole('button', { name: /alias name/i })).toBeInTheDocument();

    openFromSelectedCard(/alias name/i);

    const selectedCardModalProps = getLatestModalProps();
    expect(selectedCardModalProps?.player).toEqual(
      expect.objectContaining({
        id: 'player_1',
        player_id: 'player_1',
        name: 'Alias Name',
        bio: expect.objectContaining({
          playerId: 'player_1',
          displayName: 'Alias Name',
        }),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Close Modal/i }));

    openFromRowMenu();

    const rowMenuModalProps = getLatestModalProps();
    expect(rowMenuModalProps?.player).toEqual(selectedCardModalProps?.player);
    expect(screen.getByTestId('mock-edit-contract-modal-player')).toHaveTextContent(
      /alias name/i
    );
  });

  it('preserves row menu toggle semantics, menu item ordering, and outside-click close behavior', () => {
    renderPool();

    const menuToggle = screen.getByRole('button', { name: '•••' });
    fireEvent.click(menuToggle);

    const signButton = screen.getByText(/Sign Free Agent/i, {
      selector: 'button',
    });
    const viewProfileButton = screen.getByText(/View Profile/i, {
      selector: 'button',
    });
    const menuContainer = signButton.parentElement;

    expect(menuContainer).not.toBeNull();
    expect(
      signButton.compareDocumentPosition(viewProfileButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(menuContainer as HTMLElement).getAllByRole('button')).toHaveLength(
      2
    );

    fireEvent.click(menuToggle);
    expect(
      screen.queryByRole('button', { name: /Sign Free Agent/i })
    ).not.toBeInTheDocument();

    fireEvent.click(menuToggle);
    expect(
      screen.getByText(/Sign Free Agent/i, { selector: 'button' })
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole('button', { name: /Sign Free Agent/i })
    ).not.toBeInTheDocument();
  });

  it('preserves View Profile navigation through window.location.href assignment', () => {
    renderPool();

    fireEvent.click(screen.getByRole('button', { name: '•••' }));
    fireEvent.click(
      screen.getByText(/View Profile/i, { selector: 'button' })
    );

    expect(mockGetPlayerProfileUrl).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#player-profile');
  });
});
