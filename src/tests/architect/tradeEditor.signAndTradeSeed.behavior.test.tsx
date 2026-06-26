// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// BZE-190: lock the Free-Agency -> Trade-Machine sign-and-trade hand-off glue.
// The Trade Machine's own composition is covered elsewhere; here we mock the
// machine hook (with no team slots, so the heavy team cards never render) and
// the heavy child panels, and assert only the seed-consumption behavior.

const harness = vi.hoisted(() => ({
  useTradeMachineMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock('@/features/architect/hooks/useTradeMachine', () => ({
  useTradeMachine: harness.useTradeMachineMock,
}));

vi.mock('@/shared/hooks/useContainerDimensions', () => ({
  useContainerDimensions: () => ({ width: 1200, height: 600 }),
}));

vi.mock('@/features/architect/capSheet/CapConfidenceBadge', () => ({
  CapConfidenceBadge: () => null,
}));

vi.mock('@/features/architect/tradeMachine/ValidationStateHeader', () => ({
  ValidationStateHeader: () => <div data-testid="mock-validation-state-header" />,
}));

vi.mock('@/features/architect/tradeMachine/ValidationDetailsPanel', () => ({
  ValidationDetailsPanel: () => (
    <div data-testid="mock-validation-details-panel" />
  ),
}));

vi.mock('@/features/architect/tradeMachine/TradePreviewModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/features/architect/admin/PickRightWizardModal', () => ({
  PickRightWizardModal: () => null,
}));

// Capture the props the S&T contract modal is opened with.
const editContractModalProps: Array<Record<string, unknown>> = [];
vi.mock('@/shared/components/EditContractModal', () => ({
  EditContractModal: (props: Record<string, unknown>) => {
    if (props.isOpen) {
      editContractModalProps.push(props);
      return (
        <div data-testid="mock-edit-contract-modal">
          {String(props.initialAction)}
        </div>
      );
    }
    return null;
  },
}));

import { TradeEditor } from '@/features/architect/tradeMachine/TradeEditor';

const buildTradeMachineValue = () => ({
  teams: [] as unknown[],
  previewAuthority: null,
  snapshotValidationDetails: null,
  forceTrade: false,
  setPlayerTrade: vi.fn(),
  toggleEntitlement: vi.fn(),
  setEntitlementDestination: vi.fn(),
  selectTeam: vi.fn(),
  addTeam: vi.fn(),
  removeTeam: vi.fn(),
  handleValidate: vi.fn(() => 'insufficient'),
  exportCurrentTrade: vi.fn(() => []),
  undoPlayerTrade: vi.fn(),
  resetTrade: vi.fn(),
  yearKey: 2026,
  incomingAssets: [],
  isValidating: false,
  salaryOut: 0,
  hasCurrentValidation: false,
  getValidatedAt: vi.fn(() => null),
  hasInjectedDevSntPlayers: false,
  injectDevSntPlayers: vi.fn(),
  clearInjectedDevSntPlayers: vi.fn(),
  initError: null,
  activeTeamCount: 0,
  applyEntitlementOverrideUpdate: vi.fn(),
  refreshEntitlements: vi.fn(),
});

const SEED_PLAYER = {
  id: 'player_sat',
  player_id: 'player_sat',
  name: 'Sat Star',
  displayName: 'Sat Star',
  bio: { displayName: 'Sat Star', playerId: 'player_sat' },
};

beforeEach(() => {
  editContractModalProps.length = 0;
  harness.useTradeMachineMock.mockReturnValue(buildTradeMachineValue());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TradeEditor sign-and-trade seed consumption (BZE-190)', () => {
  it('parks the seeded free agent as a pending S&T piece and clears the one-shot request', () => {
    const onSignAndTradeSeedHandled = vi.fn();
    render(
      <TradeEditor
        primaryTeam="LAL"
        currentYear={2026}
        worldId="world_1"
        requestedSignAndTradeSeed={{
          player: SEED_PLAYER,
          sourceTeamCode: 'LAL',
        }}
        onSignAndTradeSeedHandled={onSignAndTradeSeedHandled}
      />
    );

    const pending = screen.getByTestId('pending-sign-and-trade');
    expect(pending).toBeInTheDocument();
    expect(screen.getByTestId('pending-sign-and-trade-player')).toHaveTextContent(
      'Sat Star'
    );
    // The one-shot seed is consumed so re-renders don't re-stage it.
    expect(onSignAndTradeSeedHandled).toHaveBeenCalledTimes(1);
  });

  it('opens the sign-and-trade contract editor for the seeded free agent', () => {
    render(
      <TradeEditor
        primaryTeam="LAL"
        currentYear={2026}
        worldId="world_1"
        requestedSignAndTradeSeed={{
          player: SEED_PLAYER,
          sourceTeamCode: 'LAL',
        }}
        onSignAndTradeSeedHandled={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Set contract & destination/i })
    );

    expect(screen.getByTestId('mock-edit-contract-modal')).toBeInTheDocument();
    expect(editContractModalProps).toHaveLength(1);
    expect(editContractModalProps[0].initialAction).toBe('signAndTrade');
    expect(editContractModalProps[0].actionContext).toBe('freeAgent');
  });

  it('dismisses the pending prompt without staging anything', () => {
    render(
      <TradeEditor
        primaryTeam="LAL"
        currentYear={2026}
        worldId="world_1"
        requestedSignAndTradeSeed={{
          player: SEED_PLAYER,
          sourceTeamCode: 'LAL',
        }}
        onSignAndTradeSeedHandled={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('pending-sign-and-trade-dismiss'));

    expect(screen.queryByTestId('pending-sign-and-trade')).not.toBeInTheDocument();
  });
});
