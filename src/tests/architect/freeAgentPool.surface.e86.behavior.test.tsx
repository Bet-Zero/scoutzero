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
    name?: string;
    bio?: {
      displayName?: string;
    };
  };
  onClose?: () => void;
  onSignFreeAgent?: unknown;
  onSignAndTrade?: unknown;
  getSignAndTradePreflight?: unknown;
  getOfferSheetPreflight?: unknown;
  onStoreOfferSheet?: unknown;
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

const buildActionOwner = (
  overrides: Partial<Record<string, unknown>> = {}
) => ({
  signFreeAgent: vi.fn().mockResolvedValue({ success: true }),
  signAndTrade: vi.fn().mockResolvedValue({ success: true }),
  getSignAndTradePreflight: vi.fn(),
  getOfferSheetPreflight: vi.fn(),
  storeOfferSheet: vi.fn().mockResolvedValue({ success: true }),
  matchOfferSheet: vi.fn(),
  declineOfferSheet: vi.fn(),
  finalizeOfferSheet: vi.fn(),
  ...overrides,
});

const renderPool = (
  overrides: Partial<React.ComponentProps<typeof FreeAgentPool>> = {}
) => {
  const actionOwner =
    overrides.actionOwner || buildActionOwner();

  render(
    <FreeAgentPool
      freeAgents={[FREE_AGENT]}
      currentYear={2026}
      actionOwner={actionOwner}
      playersMap={playersMap}
      playersById={playersMap}
      worldId={null}
      {...overrides}
    />
  );

  return { actionOwner };
};

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

    fireEvent.click(screen.getByRole('button', { name: /test player/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Player/i }));

    expect(screen.getByTestId('mock-edit-contract-modal')).toBeInTheDocument();
    expect(screen.getByTestId('mock-edit-contract-modal-player')).toHaveTextContent(
      /test player/i
    );
  });

  it('passes grouped-owner standard signing directly into EditContractModal without onSave fallback props', () => {
    const actionOwner = buildActionOwner();
    renderPool({ actionOwner });

    fireEvent.click(screen.getByRole('button', { name: /test player/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Player/i }));

    const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];
    expect(modalProps?.onSignFreeAgent).toEqual(expect.any(Function));
    expect(modalProps?.onSave).toBeUndefined();
    expect(modalProps?.onSignFreeAgent).toBe(actionOwner.signFreeAgent);
    expect(modalProps?.onSignAndTrade).toBeUndefined();
    expect(modalProps?.getSignAndTradePreflight).toBeUndefined();
    expect(modalProps?.getOfferSheetPreflight).toBeUndefined();
    expect(modalProps?.onStoreOfferSheet).toBeUndefined();
  });

  it('threads grouped owner world-mode callbacks into EditContractModal while keeping standard signing on the authoritative owner', () => {
    const actionOwner = buildActionOwner();
    renderPool({
      actionOwner,
      worldId: 'world_alpha',
    });

    fireEvent.click(screen.getByRole('button', { name: /test player/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Player/i }));

    const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];
    expect(modalProps?.onSignFreeAgent).toEqual(expect.any(Function));
    expect(modalProps?.onSignFreeAgent).toBe(actionOwner.signFreeAgent);
    expect(modalProps?.onSignAndTrade).toBe(actionOwner.signAndTrade);
    expect(modalProps?.getSignAndTradePreflight).toBe(
      actionOwner.getSignAndTradePreflight
    );
    expect(modalProps?.getOfferSheetPreflight).toBe(
      actionOwner.getOfferSheetPreflight
    );
    expect(modalProps?.onStoreOfferSheet).toBe(actionOwner.storeOfferSheet);
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
