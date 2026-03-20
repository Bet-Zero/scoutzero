/**
 * FILE: src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx
 * PURPOSE: Focused boundary coverage for the E105 TradeEditor + TradeTeamCard TS authority migration.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const harness = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return {
    toast,
    useTradeMachineMock: vi.fn(),
    hasVacuumOverlayMock: vi.fn(() => false),
    clearVacuumOverlayMock: vi.fn(),
    removeEditMock: vi.fn(),
    removeCreateMock: vi.fn(),
    applyVacuumTransferMock: vi.fn(),
    validateSntMock: vi.fn(() => ({
      valid: true,
      contract: {
        salariesByYear: [
          {
            season: '2025-26',
            salary: 18_000_000,
            capHit: 18_000_000,
            guaranteed: true,
          },
        ],
        contractYears: 3,
        firstYearGuaranteed: true,
      },
      reasons: [],
    })),
    entitlementAuthoringEnabledMock: vi.fn(() => true),
    getTeamSnapshotMock: vi.fn(() => ({
      outgoingMatchingSalary: 5_000_000,
      incomingMatchingSalary: 6_000_000,
      outgoingBaseSalary: 5_000_000,
      incomingBaseSalary: 6_000_000,
      displayAllowableIncoming: 12_000_000,
      salaryMatchingApplicable: true,
      salaryMatchingSkipReason: null,
      salaryMatchingRule: '125%',
      salaryMatchingFormula: 'outgoing * 1.25',
      isHardCapped: false,
      effectiveAllowableIncoming: 12_000_000,
      allowableIncoming: 12_000_000,
      hardCapLimiterLabel: null,
      hardCapType: null,
    })),
    warnOnTotalsDivergenceMock: vi.fn(),
    getTeamTpeListMock: vi.fn(() => []),
    editorTradeTeamCardProps: [] as any[],
    capImpactTilesMock: vi.fn((props: any) => (
      <div data-testid="mock-cap-impact-tiles">{props.team?.id || 'none'}</div>
    )),
    selectTeamCardMock: vi.fn(
      ({ onSelectTeam, onRemove }: { onSelectTeam?: (...args: any[]) => void; onRemove?: (() => void) | null }) => (
        <div data-testid="mock-select-team-card">
          <button onClick={() => onSelectTeam?.('BOS')}>Select Team Fallback</button>
          <button onClick={() => onRemove?.()}>Remove Fallback</button>
        </div>
      )
    ),
    outgoingPlayersListMock: vi.fn((props: any) => (
      <div data-testid="mock-outgoing-players-list">
        {props.sourceTeamId || 'unknown'}
      </div>
    )),
    entitlementPicksListMock: vi.fn((props: any) => (
      <div data-testid="mock-entitlement-picks-list">{props.teamId}</div>
    )),
    tradeExceptionManagerMock: vi.fn((props: any) => (
      <div data-testid="mock-trade-exception-manager">{props.teamId}</div>
    )),
  };
});

vi.mock('react-hot-toast', () => ({
  toast: harness.toast,
}));

vi.mock('@/features/architect/hooks/useTradeMachine', () => ({
  useTradeMachine: harness.useTradeMachineMock,
}));

vi.mock('@/shared/hooks/useContainerDimensions', () => ({
  useContainerDimensions: () => ({ width: 1200, height: 600 }),
}));

vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  isEntitlementAuthoringEnabled: harness.entitlementAuthoringEnabledMock,
}));

vi.mock(
  '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore',
  () => ({
    clearVacuumOverlay: harness.clearVacuumOverlayMock,
    hasVacuumOverlay: harness.hasVacuumOverlayMock,
    removeEdit: harness.removeEditMock,
    removeCreate: harness.removeCreateMock,
    applyVacuumTransfer: harness.applyVacuumTransferMock,
  })
);

vi.mock(
  '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility',
  () => ({
    validateSignAndTradeContractPayload: harness.validateSntMock,
  })
);

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  resolveTeamCode: (teamId: string | null | undefined) => teamId || null,
}));

vi.mock('@/shared/utils/formatting', () => ({
  getTeamColors: () => ({ primary: '#ff9900' }),
  formatMillions: (amount: number, decimals = 1) =>
    `${(Number(amount) / 1_000_000).toFixed(decimals)}M`,
  formatSalary: (amount: number) => `$${Number(amount)}`,
}));

vi.mock('@/features/architect/utils/tradeHelpers', () => ({
  getSalaryForYear: (players: Array<Record<string, any>> = []) =>
    players.reduce(
      (sum, player) =>
        sum +
        Number(
          player.salary ??
            player.capHit ??
            player.contract?.salariesByYear?.[0]?.salary ??
            0
        ),
      0
    ),
  getAdjustmentTooltipLabel: () => 'Adjustment',
}));

vi.mock('@/shared/components/TeamSelectDropdown', () => ({
  __esModule: true,
  default: ({
    selectedTeamId,
    onChange,
  }: {
    selectedTeamId?: string;
    onChange?: (teamId: string) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-team-select-dropdown"
      onClick={() => onChange?.('BOS')}
    >
      {selectedTeamId || 'none'}
    </button>
  ),
}));

vi.mock('@/features/architect/tradeMachine/CapImpactTiles', () => ({
  __esModule: true,
  default: harness.capImpactTilesMock,
}));

vi.mock('@/features/architect/tradeMachine/SelectTeamCard', () => ({
  SelectTeamCard: harness.selectTeamCardMock,
}));

vi.mock('@/features/architect/tradeMachine/OutgoingPlayersList', () => ({
  OutgoingPlayersList: harness.outgoingPlayersListMock,
}));

vi.mock('@/features/architect/tradeMachine/EntitlementPicksList', () => ({
  __esModule: true,
  default: harness.entitlementPicksListMock,
  EntitlementPicksList: harness.entitlementPicksListMock,
}));

vi.mock('@/features/architect/tradeMachine/TradeExceptionManager', () => ({
  __esModule: true,
  default: harness.tradeExceptionManagerMock,
}));

vi.mock('@/features/architect/utils/faExceptionUtils', () => ({
  getTeamFaExceptionBuckets: () => [{ type: 'ROOM', remaining: 1_500_000 }],
  isFaExceptionEligibleType: () => true,
}));

vi.mock('@/config/validationFlags.js', () => ({
  validationFlags: {
    faExceptionTrade: 'warn',
  },
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/seasonUtils', () => ({
  getCapHitForSeason: (player: Record<string, any>) =>
    Number(player.capHit ?? player.salary ?? 0),
}));

vi.mock('@/features/architect/utils/seasonUtils', () => ({
  toSeasonKey: () => '2025-26',
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules',
  () => ({
    getSalaryMatchingResult: () => ({
      allowableIncoming: 12_000_000,
      ruleLabel: '125%',
      formulaUsed: 'outgoing * 1.25',
    }),
  })
);

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  () => ({
    getCapSettingsForYear: () => ({
      salaryCap: 100_000_000,
      firstApron: 110_000_000,
      secondApron: 120_000_000,
    }),
  })
);

vi.mock('@/features/architect/hooks/useTradeMachineSnapshot', () => ({
  getTeamSnapshot: harness.getTeamSnapshotMock,
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: () => ({
    totalCapAllocations: 90_000_000,
  }),
  warnOnTotalsDivergence: harness.warnOnTotalsDivergenceMock,
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  getTeamTpeList: harness.getTeamTpeListMock,
}));

const OUTGOING_PLAYER = {
  id: 'out-1',
  player_id: 'out-1',
  name: 'Outgoing One',
  salary: 5_000_000,
};

const INCOMING_PLAYER = {
  id: 'in-1',
  player_id: 'in-1',
  name: 'Incoming One',
  salary: 6_000_000,
  capHit: 6_000_000,
};

const FA_EXCEPTION_PLAYER = {
  ...INCOMING_PLAYER,
  id: 'in-2',
  player_id: 'in-2',
  name: 'Incoming FA',
  absorptionMode: 'FA_EXCEPTION',
  bucketType: 'ROOM',
};

const ENTITLEMENT = {
  id: 'ent-1',
  entitlementId: 'ent-1',
  holderTeam: 'ATL',
  seasonYear: 2027,
  round: 1,
  kind: 'pick_ownership',
  fromTeamId: 'ATL',
  toTeamId: 'BOS',
};

const VACUUM_ENTITLEMENT = {
  ...ENTITLEMENT,
  id: 'vacuum:new-ent',
  entitlementId: 'vacuum:new-ent',
};

const BASE_TEAMS = [
  {
    team: {
      id: 'ATL',
      teamCode: 'ATL',
      teamName: 'Atlanta Hawks',
      nickname: 'Hawks',
      players: [OUTGOING_PLAYER, { id: 'atl-2', player_id: 'atl-2', name: 'Stay Put' }],
      entitlements: [ENTITLEMENT, { ...ENTITLEMENT, id: 'ent-2', entitlementId: 'ent-2' }],
      pickRulesById: { 'ent-1': { id: 'ent-1' } },
      capHolds: [{ id: 'hold-1' }],
    },
    sends: [OUTGOING_PLAYER],
    entitlementsOut: [ENTITLEMENT],
  },
  {
    team: {
      id: 'BOS',
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      nickname: 'Celtics',
      players: [{ id: 'bos-1', player_id: 'bos-1', name: 'Boston Player' }],
      entitlements: [],
      pickRulesById: {},
      capHolds: [],
    },
    sends: [],
    entitlementsOut: [],
  },
];

const TRADE_DATA = [
  {
    teamId: 'ATL',
    outgoingEntitlements: [ENTITLEMENT],
  },
];

function makeTradeMachineReturn(overrides: Record<string, any> = {}) {
  return {
    teams: BASE_TEAMS.map((team) => ({
      ...team,
      team: { ...team.team },
      sends: [...team.sends],
      entitlementsOut: [...team.entitlementsOut],
    })),
    result: {
      legal: true,
      reason: null,
      override: null,
      teamResults: [{ teamId: 'ATL' }, { teamId: 'BOS' }],
    },
    forceTrade: false,
    setPlayerTrade: vi.fn(),
    toggleEntitlement: vi.fn(),
    setEntitlementDestination: vi.fn(),
    selectTeam: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    handleValidate: vi.fn(),
    exportCurrentTrade: vi.fn(() => TRADE_DATA),
    undoPlayerTrade: vi.fn(),
    resetTrade: vi.fn(),
    yearKey: 2026,
    incomingAssets: [],
    isValidating: false,
    salaryOut: [5_000_000, 0],
    hasCurrentValidation: true,
    getValidatedAt: vi.fn(() => '2026-03-15T12:00:00.000Z'),
    hasInjectedDevSntPlayers: false,
    injectDevSntPlayers: vi.fn(),
    clearInjectedDevSntPlayers: vi.fn(),
    initError: null,
    activeTeamCount: 2,
    applyEntitlementOverrideUpdate: vi.fn(),
    refreshEntitlements: vi.fn(),
    ...overrides,
  };
}

async function loadTradeEditor() {
  vi.resetModules();
  harness.editorTradeTeamCardProps.length = 0;

  vi.doMock('@/features/architect/tradeMachine/TradeTeamCard', () => ({
    __esModule: true,
    default: (props: any) => {
      harness.editorTradeTeamCardProps.push(props);
      return (
        <div data-testid={`mock-trade-team-card-${props.teamIndex}`}>
          <button onClick={() => props.onSelectTeam?.('NYK')}>Select Team</button>
          <button onClick={() => props.onRemove?.()}>Remove Team</button>
          <button onClick={() => props.onUndoPlayerTrade?.(OUTGOING_PLAYER)}>
            Undo Player
          </button>
          <button
            onClick={() =>
              props.onToggleEntitlement?.({
                entitlementId: ENTITLEMENT.entitlementId,
              })
            }
          >
            Toggle Entitlement
          </button>
          <button
            onClick={() =>
              props.onSetEntitlementDestination?.(
                ENTITLEMENT.entitlementId,
                'BOS'
              )
            }
          >
            Set Entitlement Destination
          </button>
          <button onClick={() => props.onEditEntitlement?.(ENTITLEMENT)}>
            Edit Entitlement
          </button>
          <button onClick={() => props.onCreateEntitlement?.('ATL')}>
            Create Entitlement
          </button>
          <button onClick={() => props.onRevertEntitlementEdit?.(ENTITLEMENT)}>
            Revert Entitlement
          </button>
          <button
            onClick={() =>
              props.onDeleteSessionEntitlement?.(VACUUM_ENTITLEMENT)
            }
          >
            Delete Session Entitlement
          </button>
          <button
            onClick={() =>
              props.onRequestSignAndTrade?.(OUTGOING_PLAYER, 'BOS')
            }
          >
            Open SAT
          </button>
        </div>
      );
    },
  }));

  vi.doMock('@/features/architect/tradeMachine/TradePreviewModal', () => ({
    __esModule: true,
    default: ({ open, onClose }: { open?: boolean; onClose?: () => void }) =>
      open ? (
        <div data-testid="mock-trade-preview-modal">
          <button onClick={onClose}>Close Preview</button>
        </div>
      ) : null,
  }));

  vi.doMock('@/features/architect/tradeMachine/ValidationStateHeader', () => ({
    __esModule: true,
    default: ({
      hasValidatorResult,
    }: {
      hasValidatorResult?: boolean;
    }) => (
      <div data-testid="mock-validation-state-header">
        {hasValidatorResult ? 'validated' : 'not-validated'}
      </div>
    ),
  }));

  vi.doMock('@/features/architect/tradeMachine/ValidationDetailsPanel', () => ({
    __esModule: true,
    default: ({
      showSntInjector,
    }: {
      showSntInjector?: boolean;
    }) => (
      <div data-testid="mock-validation-details-panel">
        {showSntInjector ? 'injector-on' : 'injector-off'}
      </div>
    ),
  }));

  vi.doMock('@/features/architect/admin/PickRightWizardModal', () => ({
    PickRightWizardModal: ({
      entitlementId,
      initialDocument,
      onClose,
      onSuccess,
      onVacuumSessionMutation,
      onDuplicateAsNew,
    }: any) => (
      <div data-testid="mock-pick-right-wizard-modal">
        <div data-testid="wizard-entitlement-id">
          {entitlementId == null ? 'create' : String(entitlementId)}
        </div>
        <div data-testid="wizard-holder-team">
          {initialDocument?.holderTeam || 'none'}
        </div>
        <button
          onClick={() =>
            onSuccess?.({
              entitlementId: entitlementId || 'created-entitlement',
              document: { saved: true },
            })
          }
        >
          Wizard Success
        </button>
        <button onClick={() => onVacuumSessionMutation?.()}>
          Wizard Vacuum Mutation
        </button>
        <button
          onClick={() => onDuplicateAsNew?.({ holderTeam: 'BOS', kind: 'swap_right' })}
        >
          Wizard Duplicate
        </button>
        <button onClick={onClose}>Close Wizard</button>
      </div>
    ),
  }));

  vi.doMock('@/shared/components/EditContractModal', () => ({
    __esModule: true,
    default: ({
      isOpen,
      onClose,
      onSignAndTrade,
      player,
    }: {
      isOpen?: boolean;
      onClose?: () => void;
      onSignAndTrade?: (...args: any[]) => Promise<any> | any;
      player?: Record<string, any>;
    }) => {
      const [result, setResult] = React.useState<any>(null);
      if (!isOpen) return null;

      return (
        <div data-testid="mock-edit-contract-modal">
          <div data-testid="sat-player-name">{player?.name || 'unknown'}</div>
          <button
            onClick={async () => {
              const next = await onSignAndTrade?.(
                player,
                {
                  salariesByYear: [
                    {
                      season: '2025-26',
                      salary: 18_000_000,
                      capHit: 18_000_000,
                      guaranteed: true,
                    },
                  ],
                  contractYears: 3,
                  firstYearGuaranteed: true,
                },
                'BOS'
              );
              setResult(next);
            }}
          >
            Confirm SAT
          </button>
          <button
            onClick={async () => {
              const next = await onSignAndTrade?.(player, { invalid: true }, null);
              setResult(next);
            }}
          >
            Confirm SAT Missing Destination
          </button>
          <button onClick={onClose}>Close SAT</button>
          <div data-testid="sat-result">
            {result ? JSON.stringify(result) : 'none'}
          </div>
        </div>
      );
    },
  }));

  const module = await import('@/features/architect/tradeMachine/TradeEditor');
  return module.default;
}

async function loadTradeTeamCard() {
  vi.resetModules();
  vi.doUnmock('@/features/architect/tradeMachine/TradeTeamCard');
  const module = await import('@/features/architect/tradeMachine/TradeTeamCard');
  return module.default;
}

function getTabButtons() {
  const players = screen.getByRole('button', { name: /Players \(/i });
  const picks = screen.getByRole('button', { name: /Picks \(/i });
  const exceptions = screen.getByRole('button', { name: /Exceptions \(/i });

  return { players, picks, exceptions };
}

function resetHarness() {
  cleanup();
  vi.clearAllMocks();
  vi.resetModules();
  harness.editorTradeTeamCardProps.length = 0;
  harness.hasVacuumOverlayMock.mockReturnValue(false);
  harness.entitlementAuthoringEnabledMock.mockReturnValue(true);
  harness.validateSntMock.mockReturnValue({
    valid: true,
    contract: {
      salariesByYear: [
        {
          season: '2025-26',
          salary: 18_000_000,
          capHit: 18_000_000,
          guaranteed: true,
        },
      ],
      contractYears: 3,
      firstYearGuaranteed: true,
    },
    reasons: [],
  });
  harness.getTeamSnapshotMock.mockReturnValue({
    outgoingMatchingSalary: 5_000_000,
    incomingMatchingSalary: 6_000_000,
    outgoingBaseSalary: 5_000_000,
    incomingBaseSalary: 6_000_000,
    displayAllowableIncoming: 12_000_000,
    salaryMatchingApplicable: true,
    salaryMatchingSkipReason: null,
    salaryMatchingRule: '125%',
    salaryMatchingFormula: 'outgoing * 1.25',
    isHardCapped: false,
    effectiveAllowableIncoming: 12_000_000,
    allowableIncoming: 12_000_000,
    hardCapLimiterLabel: null,
    hardCapType: null,
  });
  harness.getTeamTpeListMock.mockReturnValue([]);
}

describe('TradeEditor boundary E105', () => {
  beforeEach(() => {
    resetHarness();
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves the major editor surface, TradeTeamCard composition, validate/apply/reset controls, and child callback routing', async () => {
    const tradeMachine = makeTradeMachineReturn();
    const onApplyTrade = vi.fn().mockResolvedValue({ success: true });
    harness.useTradeMachineMock.mockReturnValue(tradeMachine);
    harness.hasVacuumOverlayMock.mockReturnValue(true);

    const TradeEditor = await loadTradeEditor();

    render(
      <TradeEditor
        primaryTeam="ATL"
        capProjections={{}}
        currentYear={2026}
        onApplyTrade={onApplyTrade}
        onEditContract={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Trade Machine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validate Trade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Trade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear session pick changes/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-validation-state-header')).toHaveTextContent(
      'validated'
    );
    expect(screen.getByTestId('mock-validation-details-panel')).toHaveTextContent(
      'injector-off'
    );
    expect(screen.getByTestId('mock-trade-team-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('mock-trade-team-card-1')).toBeInTheDocument();
    expect(harness.editorTradeTeamCardProps).toHaveLength(2);
    expect(harness.editorTradeTeamCardProps[0]).toMatchObject({
      teamIndex: 0,
      team: expect.objectContaining({ id: 'ATL' }),
      validationResult: tradeMachine.result,
    });

    const firstCard = screen.getByTestId('mock-trade-team-card-0');
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Select Team' }));
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Remove Team' }));
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Undo Player' }));
    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Toggle Entitlement' })
    );
    fireEvent.click(
      within(firstCard).getByRole('button', {
        name: 'Set Entitlement Destination',
      })
    );

    expect(tradeMachine.selectTeam).toHaveBeenCalledWith(0, 'NYK');
    expect(tradeMachine.removeTeam).toHaveBeenCalledWith(0);
    expect(tradeMachine.undoPlayerTrade).toHaveBeenCalledWith(OUTGOING_PLAYER);
    expect(tradeMachine.toggleEntitlement).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ entitlementId: 'ent-1' })
    );
    expect(tradeMachine.setEntitlementDestination).toHaveBeenCalledWith(
      0,
      'ent-1',
      'BOS'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Validate Trade' }));
    expect(tradeMachine.handleValidate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-trade-preview-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Preview' }));
    await waitFor(() => {
      expect(
        screen.queryByTestId('mock-trade-preview-modal')
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Reset Trade'));
    expect(tradeMachine.resetTrade).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    expect(tradeMachine.addTeam).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Clear session pick changes/i }));
    expect(harness.clearVacuumOverlayMock).toHaveBeenCalledTimes(1);
    expect(tradeMachine.refreshEntitlements).toHaveBeenCalledTimes(1);
    expect(harness.toast.success).toHaveBeenCalledWith('Session pick changes cleared');

    tradeMachine.refreshEntitlements.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Trade' }));

    await waitFor(() => {
      expect(onApplyTrade).toHaveBeenCalledWith(TRADE_DATA);
    });
    expect(harness.applyVacuumTransferMock).toHaveBeenCalledWith(
      'ent-1',
      'ATL',
      'BOS'
    );
    expect(tradeMachine.refreshEntitlements).toHaveBeenCalledTimes(1);
  });

  it('preserves entitlement edit/create success flow plus vacuum revert/delete behavior', async () => {
    const tradeMachine = makeTradeMachineReturn();
    harness.useTradeMachineMock.mockReturnValue(tradeMachine);

    const TradeEditor = await loadTradeEditor();

    render(
      <TradeEditor
        primaryTeam="ATL"
        capProjections={{}}
        currentYear={2026}
        onApplyTrade={vi.fn()}
        onEditContract={vi.fn()}
      />
    );

    const firstCard = screen.getByTestId('mock-trade-team-card-0');
    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Edit Entitlement' })
    );

    expect(screen.getByTestId('mock-pick-right-wizard-modal')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-entitlement-id')).toHaveTextContent('ent-1');

    fireEvent.click(screen.getByRole('button', { name: 'Wizard Success' }));
    expect(tradeMachine.applyEntitlementOverrideUpdate).toHaveBeenCalledWith(
      'ent-1',
      { saved: true }
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId('mock-pick-right-wizard-modal')
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Create Entitlement' })
    );
    expect(screen.getByTestId('wizard-entitlement-id')).toHaveTextContent('create');
    expect(screen.getByTestId('wizard-holder-team')).toHaveTextContent('ATL');

    fireEvent.click(screen.getByRole('button', { name: 'Wizard Vacuum Mutation' }));
    expect(tradeMachine.refreshEntitlements).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Revert Entitlement' })
    );
    fireEvent.click(
      within(firstCard).getByRole('button', {
        name: 'Delete Session Entitlement',
      })
    );

    expect(harness.removeEditMock).toHaveBeenCalledWith('ATL', 'ent-1');
    expect(harness.removeCreateMock).toHaveBeenCalledWith(
      'ATL',
      'vacuum:new-ent'
    );
    expect(tradeMachine.handleValidate).toHaveBeenCalledTimes(2);
    expect(harness.toast.success).toHaveBeenCalledWith('Session edit reverted');
    expect(harness.toast.success).toHaveBeenCalledWith(
      'Session pick right deleted'
    );
  });

  it('preserves world-mode auth gating and sign-and-trade result contracts', async () => {
    const tradeMachine = makeTradeMachineReturn();
    harness.useTradeMachineMock.mockReturnValue(tradeMachine);

    const TradeEditor = await loadTradeEditor();

    render(
      <TradeEditor
        primaryTeam="ATL"
        capProjections={{}}
        currentYear={2026}
        onApplyTrade={vi.fn()}
        onEditContract={vi.fn()}
        worldId="world-1"
        userId={null}
      />
    );

    const firstCard = screen.getByTestId('mock-trade-team-card-0');
    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Edit Entitlement' })
    );
    fireEvent.click(
      within(firstCard).getByRole('button', { name: 'Create Entitlement' })
    );

    expect(harness.toast.error).toHaveBeenCalledWith('Sign in to edit entitlements.');
    expect(harness.toast.error).toHaveBeenCalledWith(
      'Sign in to create entitlements.'
    );
    expect(
      screen.queryByTestId('mock-pick-right-wizard-modal')
    ).not.toBeInTheDocument();

    await act(async () => {
      await harness.editorTradeTeamCardProps[0].onRequestSignAndTrade?.(
        OUTGOING_PLAYER,
        'BOS'
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-edit-contract-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('sat-player-name')).toHaveTextContent('Outgoing One');

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm SAT Missing Destination' })
    );
    await waitFor(() => {
      expect(screen.getByTestId('sat-result')).toHaveTextContent(
        '"success":false'
      );
    });
    expect(screen.getByTestId('sat-result')).toHaveTextContent(
      'Destination team is required.'
    );
    expect(harness.toast.error).toHaveBeenCalledWith(
      'Sign-and-trade requires a destination team.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm SAT' }));
    await waitFor(() => {
      expect(tradeMachine.setPlayerTrade).toHaveBeenCalledWith(
        0,
        OUTGOING_PLAYER,
        'signAndTrade',
        'BOS',
        expect.objectContaining({
          destinationTeamCode: 'BOS',
          signAndTradeContract: expect.objectContaining({
            contractYears: 3,
          }),
        })
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('mock-edit-contract-modal')
      ).not.toBeInTheDocument();
    });
  });
});

describe('TradeTeamCard boundary E105', () => {
  beforeEach(() => {
    resetHarness();
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves the SelectTeamCard fallback and its select/remove handlers', async () => {
    const TradeTeamCard = await loadTradeTeamCard();
    const onSelectTeam = vi.fn();
    const onRemove = vi.fn();

    render(
      <TradeTeamCard
        team={null}
        sends={[]}
        yearKey={2026}
        onSelectTeam={onSelectTeam}
        onRemove={onRemove}
      />
    );

    expect(screen.getByTestId('mock-select-team-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select Team Fallback' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Fallback' }));

    expect(onSelectTeam).toHaveBeenCalledWith('BOS');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('preserves section labels, tab order, leaf composition props, and header handlers', async () => {
    const TradeTeamCard = await loadTradeTeamCard();
    const onSelectTeam = vi.fn();
    const onRemove = vi.fn();
    const onSetPlayerTrade = vi.fn();

    render(
      <TradeTeamCard
        team={BASE_TEAMS[0].team}
        sends={[OUTGOING_PLAYER]}
        yearKey={2026}
        otherTeams={[BASE_TEAMS[1].team]}
        playersMap={{ [OUTGOING_PLAYER.id]: OUTGOING_PLAYER }}
        incomingPlayers={[INCOMING_PLAYER]}
        incomingEntitlements={[{ ...ENTITLEMENT, id: 'incoming-entitlement' }]}
        onSetPlayerTrade={onSetPlayerTrade}
        onUndoPlayerTrade={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        onSelectTeam={onSelectTeam}
        onRemove={onRemove}
        onEditContract={vi.fn()}
        validationResult={{ legal: true }}
        teamIndex={0}
        isValidating={false}
        entitlementsOut={[ENTITLEMENT]}
        onToggleEntitlement={vi.fn()}
        onSetEntitlementDestination={vi.fn()}
        onEditEntitlement={vi.fn()}
        onViewEntitlementDetails={vi.fn()}
        onCreateEntitlement={vi.fn()}
        isVacuumMode={true}
        onRevertEntitlementEdit={vi.fn()}
        onDeleteSessionEntitlement={vi.fn()}
        worldId="world-1"
      />
    );

    expect(screen.getByTestId('mock-cap-impact-tiles')).toHaveTextContent('ATL');
    expect(screen.getByText(/Allowable Incoming:/i)).toBeInTheDocument();
    expect(screen.getByText(/\(125%\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Outgoing Salary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incoming Salary/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-outgoing-players-list')).toHaveTextContent('ATL');

    const { players, picks, exceptions } = getTabButtons();
    expect(
      players.compareDocumentPosition(picks) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      picks.compareDocumentPosition(exceptions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(harness.outgoingPlayersListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTeamId: 'ATL',
        worldId: 'world-1',
        otherTeams: [BASE_TEAMS[1].team],
      }),
      expect.anything()
    );

    fireEvent.click(screen.getByTestId('mock-team-select-dropdown'));
    fireEvent.click(screen.getByTitle('Remove team'));
    expect(onSelectTeam).toHaveBeenCalledWith('BOS');
    expect(onRemove).toHaveBeenCalledTimes(1);

    fireEvent.click(picks);
    expect(screen.getByTestId('mock-entitlement-picks-list')).toHaveTextContent(
      'ATL'
    );
    expect(harness.entitlementPicksListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'ATL',
        selectedEntitlementIds: ['ent-1'],
        otherTeams: [BASE_TEAMS[1].team],
      }),
      expect.anything()
    );

    fireEvent.click(exceptions);
    expect(
      screen.getByText('No trade exceptions available for this team.')
    ).toBeInTheDocument();
  });

  it('preserves TPE and FA-exception incoming action wiring', async () => {
    const TradeTeamCard = await loadTradeTeamCard();
    const onSetPlayerTrade = vi.fn();
    harness.getTeamTpeListMock.mockReturnValue([
      {
        id: 'tpe-1',
        amount: 9_000_000,
        isUsed: false,
        expirationDate: '2099-01-01',
        name: 'Test TPE',
      },
    ] as any);

    const { rerender } = render(
      <TradeTeamCard
        team={BASE_TEAMS[0].team}
        sends={[OUTGOING_PLAYER]}
        yearKey={2026}
        incomingPlayers={[INCOMING_PLAYER]}
        incomingEntitlements={[]}
        onSetPlayerTrade={onSetPlayerTrade}
        onUndoPlayerTrade={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        onSelectTeam={vi.fn()}
        onRemove={vi.fn()}
        onEditContract={vi.fn()}
        validationResult={{ legal: true }}
        entitlementsOut={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Incoming Salary/i }));
    expect(screen.getByText(/Available TPEs:/i)).toBeInTheDocument();

    let selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[1], { target: { value: 'tpe-1' } });
    fireEvent.change(selects[0], { target: { value: 'MATCH' } });

    expect(onSetPlayerTrade).toHaveBeenCalledWith(
      INCOMING_PLAYER,
      'setTpeId',
      'tpe-1'
    );
    expect(onSetPlayerTrade).toHaveBeenCalledWith(
      INCOMING_PLAYER,
      'setAbsorptionMode',
      'MATCH'
    );

    rerender(
      <TradeTeamCard
        team={BASE_TEAMS[0].team}
        sends={[OUTGOING_PLAYER]}
        yearKey={2026}
        incomingPlayers={[FA_EXCEPTION_PLAYER]}
        incomingEntitlements={[]}
        onSetPlayerTrade={onSetPlayerTrade}
        onUndoPlayerTrade={vi.fn()}
        onRequestSignAndTrade={vi.fn()}
        onSelectTeam={vi.fn()}
        onRemove={vi.fn()}
        onEditContract={vi.fn()}
        validationResult={{ legal: true }}
        entitlementsOut={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Incoming Salary/i }));
    selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[1], { target: { value: 'ROOM' } });
    expect(onSetPlayerTrade).toHaveBeenCalledWith(
      FA_EXCEPTION_PLAYER,
      'setFaBucket',
      'ROOM'
    );
  });
});
