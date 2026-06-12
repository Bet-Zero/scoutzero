// @vitest-environment jsdom
/**
 * FILE: src/tests/trade/tradeStaging.test.tsx
 * PURPOSE: Guard the cross-room "stage player(s) into Trade Machine" integration.
 *          When the Trade Machine opens from a player-context entry (the pin
 *          board's "Trade" / "Trade all pinned"), TradeEditor pre-stages each
 *          requested player as an outgoing asset once slot 0's roster is ready,
 *          then clears the one-shot request. Off-roster ids are a no-op but
 *          still clear.
 * OWNERSHIP: Test suite (Trade Machine integration)
 *
 * Heavy child UI (team cards, modals) is stubbed — the staging effect only
 * reads teams[0].team.players and calls the hook's setPlayerTrade, so the
 * stubs keep the test focused on the integration wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const useTradeMachineMock = vi.fn();

vi.mock('@/features/architect/hooks/useTradeMachine', () => ({
  useTradeMachine: (...args: unknown[]) => useTradeMachineMock(...args),
}));
vi.mock('@/shared/hooks/useContainerDimensions', () => ({
  useContainerDimensions: () => ({ width: 1200, height: 700, ready: true }),
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  FIREBASE_TARGET_MODE: 'EMULATOR',
  isLikelyEmulatorConnectionError: () => false,
}));
// Stub heavy children — irrelevant to the staging effect under test.
vi.mock('@/features/architect/tradeMachine/TradeTeamCard', () => ({
  TradeTeamCard: () => null,
}));
vi.mock('@/features/architect/tradeMachine/TradePreviewModal', () => ({
  default: () => null,
}));
vi.mock('@/shared/components/EditContractModal', () => ({
  EditContractModal: () => null,
}));
vi.mock('@/features/architect/admin/PickRightWizardModal', () => ({
  PickRightWizardModal: () => null,
}));

import { TradeEditor } from '@/features/architect/tradeMachine/TradeEditor';

interface BuildOpts {
  rosterPlayers?: Array<Record<string, unknown>>;
  setPlayerTrade?: ReturnType<typeof vi.fn>;
  overrides?: Record<string, unknown>;
}

function buildHookReturn({
  rosterPlayers = [],
  setPlayerTrade,
  overrides = {},
}: BuildOpts) {
  return {
    teams: [
      { team: { id: 'LAL', players: rosterPlayers }, sends: [], entitlementsOut: [] },
      { team: null, sends: [], entitlementsOut: [] },
    ],
    previewAuthority: null,
    snapshotValidationDetails: null,
    forceTrade: false,
    previewOpen: false,
    setPreviewOpen: vi.fn(),
    setForceTrade: vi.fn(),
    setPlayerTrade: setPlayerTrade ?? vi.fn(),
    toggleEntitlement: vi.fn(),
    setEntitlementDestination: vi.fn(),
    selectTeam: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    handleValidate: vi.fn(),
    exportCurrentTrade: vi.fn(() => []),
    undoPlayerTrade: vi.fn(),
    resetTrade: vi.fn(),
    yearKey: 2025,
    incomingAssets: [
      { players: [], entitlements: [] },
      { players: [], entitlements: [] },
    ],
    salaryOut: [0, 0],
    activeTeamCount: 1,
    applyEntitlementOverrideUpdate: vi.fn(),
    refreshEntitlements: vi.fn(),
    isValidating: false,
    currentDraftKey: 'k',
    hasCurrentValidation: false,
    validatedAt: null,
    hasInjectedDevSntPlayers: false,
    injectDevSntPlayers: vi.fn(),
    clearInjectedDevSntPlayers: vi.fn(),
    getValidatedAt: () => null,
    initError: null,
    ...overrides,
  };
}

const baseProps = {
  primaryTeam: 'LAL',
  capProjections: {},
  currentYear: 2025,
  playersMap: {},
  onApplyTrade: vi.fn(),
  primaryTeamData: { id: 'LAL' } as never,
  worldId: null,
};

afterEach(cleanup);

describe('TradeEditor — stage focused player into the trade', () => {
  it('stages a single requested player as outgoing on slot 0, then clears', () => {
    const setPlayerTrade = vi.fn();
    const onStagePlayerHandled = vi.fn();
    const player = { id: 'p1', name: 'Test Player' };
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({ rosterPlayers: [player], setPlayerTrade })
    );

    render(
      <TradeEditor
        {...baseProps}
        requestedStagePlayerIds={['p1']}
        onStagePlayerHandled={onStagePlayerHandled}
      />
    );

    expect(setPlayerTrade).toHaveBeenCalledTimes(1);
    expect(setPlayerTrade).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 'p1' }),
      'trade'
    );
    expect(onStagePlayerHandled).toHaveBeenCalledTimes(1);
  });

  it('stages every requested player on the roster ("Trade all pinned")', () => {
    const setPlayerTrade = vi.fn();
    const onStagePlayerHandled = vi.fn();
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        rosterPlayers: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        setPlayerTrade,
      })
    );

    render(
      <TradeEditor
        {...baseProps}
        requestedStagePlayerIds={['p1', 'p3']}
        onStagePlayerHandled={onStagePlayerHandled}
      />
    );

    expect(setPlayerTrade).toHaveBeenCalledTimes(2);
    expect(setPlayerTrade).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 'p1' }),
      'trade'
    );
    expect(setPlayerTrade).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 'p3' }),
      'trade'
    );
    expect(onStagePlayerHandled).toHaveBeenCalledTimes(1);
  });

  it('skips ids not on the primary roster but still stages the valid ones and clears', () => {
    const setPlayerTrade = vi.fn();
    const onStagePlayerHandled = vi.fn();
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({ rosterPlayers: [{ id: 'p1' }], setPlayerTrade })
    );

    render(
      <TradeEditor
        {...baseProps}
        requestedStagePlayerIds={['p999', 'p1']}
        onStagePlayerHandled={onStagePlayerHandled}
      />
    );

    expect(setPlayerTrade).toHaveBeenCalledTimes(1);
    expect(setPlayerTrade).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 'p1' }),
      'trade'
    );
    expect(onStagePlayerHandled).toHaveBeenCalledTimes(1);
  });

  it('does not stage anything when no players are requested', () => {
    const setPlayerTrade = vi.fn();
    const onStagePlayerHandled = vi.fn();
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({ rosterPlayers: [{ id: 'p1' }], setPlayerTrade })
    );

    render(
      <TradeEditor
        {...baseProps}
        requestedStagePlayerIds={[]}
        onStagePlayerHandled={onStagePlayerHandled}
      />
    );

    expect(setPlayerTrade).not.toHaveBeenCalled();
    expect(onStagePlayerHandled).not.toHaveBeenCalled();
  });
});

describe('TradeEditor — in-overlay objective/context banner (Slice 3)', () => {
  it('renders the objective + authority banner and dismisses it', () => {
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));
    render(
      <TradeEditor
        {...baseProps}
        tradeContext={{ objective: 'reduce-tax', authority: 'planning-context' }}
      />
    );

    expect(screen.getByTestId('trade-context-banner')).toBeInTheDocument();
    expect(
      screen.getByTestId('trade-context-banner-objective')
    ).toHaveTextContent('Reduce luxury tax');
    expect(
      screen.getByTestId('trade-context-banner-authority')
    ).toHaveTextContent('Planning context');

    fireEvent.click(screen.getByTestId('trade-context-banner-dismiss'));
    expect(screen.queryByTestId('trade-context-banner')).toBeNull();
  });

  it('shows no banner for a bare local-draft open (no objective/event)', () => {
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));
    render(
      <TradeEditor
        {...baseProps}
        tradeContext={{ authority: 'local-draft' }}
      />
    );
    expect(screen.queryByTestId('trade-context-banner')).toBeNull();
  });

  it('counts an objective context as a meaningful draft (no staged assets)', () => {
    const onDraftActivityChange = vi.fn();
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));
    render(
      <TradeEditor
        {...baseProps}
        tradeContext={{ objective: 'clear-second-apron', authority: 'planning-context' }}
        onDraftActivityChange={onDraftActivityChange}
      />
    );
    expect(onDraftActivityChange).toHaveBeenCalledWith(true);
  });

  it('does not mark a meaningful draft for a bare open with no edits', () => {
    const onDraftActivityChange = vi.fn();
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));
    render(
      <TradeEditor {...baseProps} onDraftActivityChange={onDraftActivityChange} />
    );
    expect(onDraftActivityChange).toHaveBeenCalledWith(false);
  });
});

describe('TradeEditor — validation and apply readiness hierarchy', () => {
  it('prioritizes team setup before validation state', () => {
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));

    render(<TradeEditor {...baseProps} />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Setup required');
    expect(summary).toHaveTextContent(
      'Select at least two teams before validation.'
    );
  });

  it('prompts for assets after two teams are selected', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        overrides: {
          teams: [
            { team: { id: 'LAL', players: [] }, sends: [], entitlementsOut: [] },
            { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
          ],
          activeTeamCount: 2,
        },
      })
    );

    render(<TradeEditor {...baseProps} />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Setup required');
    expect(summary).toHaveTextContent(
      'Add a player or draft asset to the trade.'
    );
  });

  it('shows ready-to-validate once setup has teams and staged assets', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        overrides: {
          teams: [
            {
              team: { id: 'LAL', players: [] },
              sends: [{ id: 'p1', name: 'Player One', tradeTo: 'BOS' }],
              entitlementsOut: [],
            },
            { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
          ],
          activeTeamCount: 2,
        },
      })
    );

    render(<TradeEditor {...baseProps} />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Ready to validate');
    expect(summary).toHaveTextContent('Run validation before preview or apply.');
  });

  it('makes blocking validation reasons distinct from setup guidance', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        overrides: {
          teams: [
            {
              team: { id: 'LAL', players: [] },
              sends: [{ id: 'p1', name: 'Player One', tradeTo: 'BOS' }],
              entitlementsOut: [],
            },
            { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
          ],
          activeTeamCount: 2,
          hasCurrentValidation: true,
          previewAuthority: {
            legal: false,
            reason: 'Salary matching violation',
            violations: [{ message: 'Salary matching violation' }],
            omittedStages: [],
          },
          snapshotValidationDetails: {
            teamResults: [],
            dataWarnings: [],
            hasDataIssues: false,
          },
        },
      })
    );

    render(<TradeEditor {...baseProps} />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Trade blocked');
    expect(summary).toHaveTextContent('Salary matching violation');
  });

  it('names the active Team Plan impact when a trade is ready to apply', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        overrides: {
          teams: [
            {
              team: { id: 'LAL', players: [] },
              sends: [{ id: 'p1', name: 'Player One', tradeTo: 'BOS' }],
              entitlementsOut: [],
            },
            { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
          ],
          activeTeamCount: 2,
          hasCurrentValidation: true,
          previewAuthority: {
            legal: true,
            reason: 'Preview authority passed',
            violations: [],
            omittedStages: [],
          },
          snapshotValidationDetails: {
            teamResults: [],
            dataWarnings: [],
            hasDataIssues: false,
          },
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Ready to apply');
    expect(summary).toHaveTextContent('Applies this move to the active Team Plan.');
  });
});
