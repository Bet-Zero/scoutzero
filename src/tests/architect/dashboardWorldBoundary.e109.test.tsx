/**
 * FILE: src/tests/architect/dashboardWorldBoundary.e109.test.tsx
 * PURPOSE: Focused UI coverage for the E109 dashboard/world TS boundary.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import React, { useState } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorldSelector } from '@/features/architect/GMDashboard/components/WorldSelector';
import SeasonAdvanceModal from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import GMDashboard from '@/features/architect/GMDashboard/GMDashboard';

const {
  mockListUserWorlds,
  mockCreateWorld,
  mockBranchWorld,
  mockUpdateWorldMetadata,
  mockGetWorldMetadata,
  mockPurgeWorld,
  mockAdvanceSeasonInWorld,
  mockProcessTradeExceptions,
  mockGetTpeExpiryISO,
  mockGetTeamTpeList,
  mockUseAuth,
  mockUseArchitectState,
  mockUseArchitectActions,
  mockUseArchitectModals,
  mockUsePlayerRulesProfiles,
  mockCloseContractModal,
  mockCloseOffseasonModal,
  mockSetShowOffseasonModal,
  mockSetActiveTab,
  mockEditContractModalProps,
} = vi.hoisted(() => ({
  mockListUserWorlds: vi.fn(),
  mockCreateWorld: vi.fn(),
  mockBranchWorld: vi.fn(),
  mockUpdateWorldMetadata: vi.fn(),
  mockGetWorldMetadata: vi.fn(),
  mockPurgeWorld: vi.fn(),
  mockAdvanceSeasonInWorld: vi.fn(),
  mockProcessTradeExceptions: vi.fn(),
  mockGetTpeExpiryISO: vi.fn(),
  mockGetTeamTpeList: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseArchitectState: vi.fn(),
  mockUseArchitectActions: vi.fn(),
  mockUseArchitectModals: vi.fn(),
  mockUsePlayerRulesProfiles: vi.fn(),
  mockCloseContractModal: vi.fn(),
  mockCloseOffseasonModal: vi.fn(),
  mockSetShowOffseasonModal: vi.fn(),
  mockSetActiveTab: vi.fn(),
  mockEditContractModalProps: vi.fn(),
}));

const dashboardRouteFixtures = vi.hoisted(() => ({
  capSheetPlayer: {
    player_id: 'cap_sheet_player',
    displayName: 'Cap Sheet Player',
  },
  capTablePlayer: {
    player_id: 'cap_table_player',
    displayName: 'Cap Table Player',
  },
  capHold: {
    playerId: 'cap_hold_fixture',
    playerName: 'Cap Hold Fixture',
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'LAL' }),
}));

vi.mock('@/firebaseConfig', () => ({
  FIREBASE_TARGET_MODE: 'EMULATOR',
  isLikelyEmulatorConnectionError: () => false,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  listUserWorlds: (...args: unknown[]) => mockListUserWorlds(...args),
  createWorld: (...args: unknown[]) => mockCreateWorld(...args),
  branchWorld: (...args: unknown[]) => mockBranchWorld(...args),
  updateWorldMetadata: (...args: unknown[]) => mockUpdateWorldMetadata(...args),
  getWorldMetadata: (...args: unknown[]) => mockGetWorldMetadata(...args),
  purgeWorld: (...args: unknown[]) => mockPurgeWorld(...args),
}));

vi.mock('@/features/architect/utils/seasonManager', () => ({
  advanceSeasonInWorld: (...args: unknown[]) =>
    mockAdvanceSeasonInWorld(...args),
}));

vi.mock('@/features/architect/utils/tpeLifecycle', () => ({
  processTradeExceptions: (...args: unknown[]) =>
    mockProcessTradeExceptions(...args),
  getTpeExpiryISO: (...args: unknown[]) => mockGetTpeExpiryISO(...args),
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  getTeamTpeList: (...args: unknown[]) => mockGetTeamTpeList(...args),
}));

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectState', () => ({
  useArchitectState: (...args: unknown[]) => mockUseArchitectState(...args),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectActions', () => ({
  useArchitectActions: (...args: unknown[]) => mockUseArchitectActions(...args),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectModals', () => ({
  useArchitectModals: (...args: unknown[]) => mockUseArchitectModals(...args),
}));

vi.mock('@/features/architect/hooks/usePlayerRulesProfiles', () => ({
  usePlayerRulesProfiles: (...args: unknown[]) =>
    mockUsePlayerRulesProfiles(...args),
}));

vi.mock('@/shared/components/EditContractModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    player,
    onClose,
    targetYear,
    actionYear,
    actionContext,
    playerRulesProfile,
    rulesLeagueContext,
    onSignFreeAgent,
    onResign,
    onSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
    onStoreOfferSheet,
    onExtend,
    onWaive,
    onOptionDecision,
    onRenounce,
    onSave,
  }: {
    isOpen?: boolean;
    player?: { displayName?: string; name?: string };
    onClose?: () => void;
    targetYear?: number | null;
    actionYear?: number | null;
    actionContext?: string | null;
    playerRulesProfile?: {
      contractSummary?: { freeAgencyType?: string | null; freeAgencyYear?: number | null };
    } | null;
    rulesLeagueContext?: { currentYear?: number | null } | null;
    onSignFreeAgent?: unknown;
    onResign?: unknown;
    onSignAndTrade?: unknown;
    getSignAndTradePreflight?: unknown;
    getOfferSheetPreflight?: unknown;
    onStoreOfferSheet?: unknown;
    onExtend?: unknown;
    onWaive?: unknown;
    onOptionDecision?: unknown;
    onRenounce?: unknown;
    onSave?: unknown;
  }) => {
    if (!isOpen) return null;

    mockEditContractModalProps({
      isOpen,
      player,
      onClose,
      targetYear,
      actionYear,
      actionContext,
      playerRulesProfile,
      rulesLeagueContext,
      onSignFreeAgent,
      onResign,
      onSignAndTrade,
      getSignAndTradePreflight,
      getOfferSheetPreflight,
      onStoreOfferSheet,
      onExtend,
      onWaive,
      onOptionDecision,
      onRenounce,
      onSave,
    });

    return (
      <div data-testid="mock-edit-contract-modal">
        <div data-testid="mock-edit-contract-modal-player">
          {player?.displayName || player?.name || ''}
        </div>
        <div data-testid="mock-edit-contract-modal-target-year">
          {targetYear == null ? '' : String(targetYear)}
        </div>
        <div data-testid="mock-edit-contract-modal-action-year">
          {actionYear == null ? '' : String(actionYear)}
        </div>
        <div data-testid="mock-edit-contract-modal-action-context">
          {actionContext || ''}
        </div>
        <div data-testid="mock-edit-contract-modal-profile-free-agency-type">
          {playerRulesProfile?.contractSummary?.freeAgencyType || ''}
        </div>
        <div data-testid="mock-edit-contract-modal-rules-year">
          {rulesLeagueContext?.currentYear == null
            ? ''
            : String(rulesLeagueContext.currentYear)}
        </div>
        <button onClick={onClose}>Close Contract Modal</button>
      </div>
    );
  },
}));

vi.mock('@/features/architect/GMDashboard/sections/RosterSection', () => ({
  RosterSection: () => <div data-testid="mock-roster-section">RosterSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/CapSheetSection', () => ({
  CapSheetSection: ({
    onOpenPlayerContractModal,
  }: {
    onOpenPlayerContractModal?: ((player: typeof dashboardRouteFixtures.capSheetPlayer) => void) | null;
  }) => (
    <div data-testid="mock-cap-sheet-section">
      CapSheetSection
      <button
        type="button"
        data-testid="mock-cap-sheet-open-player-contract"
        onClick={() =>
          onOpenPlayerContractModal?.(dashboardRouteFixtures.capSheetPlayer)
        }
      >
        Open Current-Year Contract
      </button>
    </div>
  ),
}));

vi.mock('@/features/architect/GMDashboard/sections/CapTableSection', () => ({
  CapTableSection: ({
    onOpenPlayerContractModal,
    onLaunchContractAction,
    onRenounceCapHold,
  }: {
    onOpenPlayerContractModal?: ((player: typeof dashboardRouteFixtures.capTablePlayer) => void) | null;
    onLaunchContractAction?: ((
      player: typeof dashboardRouteFixtures.capTablePlayer,
      action: 'rfa',
      year: number
    ) => void) | null;
    onRenounceCapHold?: ((capHold: typeof dashboardRouteFixtures.capHold) => void) | null;
  }) => (
    <div data-testid="mock-cap-table-section">
      CapTableSection
      <button
        type="button"
        data-testid="mock-cap-table-open-player-contract"
        onClick={() =>
          onOpenPlayerContractModal?.(dashboardRouteFixtures.capTablePlayer)
        }
      >
        Open Full-Table Contract
      </button>
      <button
        type="button"
        data-testid="mock-cap-table-launch-action"
        onClick={() =>
          onLaunchContractAction?.(
            dashboardRouteFixtures.capTablePlayer,
            'rfa',
            2028
          )
        }
      >
        Launch Full-Table Action
      </button>
      <button
        type="button"
        data-testid="mock-cap-table-renounce-hold"
        onClick={() => onRenounceCapHold?.(dashboardRouteFixtures.capHold)}
      >
        Renounce Cap Hold
      </button>
    </div>
  ),
}));

vi.mock('@/features/architect/GMDashboard/sections/TradeSection', () => ({
  TradeSection: () => <div data-testid="mock-trade-section">TradeSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/FreeAgencySection', () => ({
  FreeAgencySection: () => (
    <div data-testid="mock-free-agency-section">FreeAgencySection</div>
  ),
}));

vi.mock('@/features/architect/GMDashboard/sections/OffseasonSection', () => ({
  OffseasonSection: ({
    currentYear,
    worldId,
    teamCode,
  }: {
    currentYear: number;
    worldId?: string | null;
    teamCode?: string | null;
  }) => (
    <div
      data-testid="mock-offseason-section"
      data-current-year={String(currentYear)}
      data-world-id={worldId ?? ''}
      data-team-code={teamCode ?? ''}
    >
      OffseasonSection
    </div>
  ),
}));

vi.mock('@/features/architect/GMDashboard/sections/HistorySection', () => ({
  HistorySection: () => (
    <div data-testid="mock-history-section">HistorySection</div>
  ),
}));

vi.mock('@/features/architect/GMDashboard/components/CapAuditDebugPanel', () => ({
  CapAuditDebugPanel: ({ worldId }: { worldId?: string | null }) => (
    <div data-testid="mock-cap-audit-debug" data-world-id={worldId ?? ''} />
  ),
}));

type WorldLike = {
  worldId: string;
  worldName: string;
  description?: string;
};

type TeamCapSheetLike = {
  players: Array<Record<string, unknown>>;
  capHolds: Array<Record<string, unknown>>;
  offerSheets?: unknown[];
  incomingOfferSheets?: unknown[];
  [key: string]: unknown;
};

function makeWorld(worldId: string, worldName: string): WorldLike {
  return { worldId, worldName };
}

function buildSeasonAdvanceTeamCapSheet(): TeamCapSheetLike {
  return {
    players: [
      {
        player_id: 'expiring_1',
        name: 'Expiring Player',
        displayName: 'Expiring Player',
        contract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary: 8_000_000,
              capHit: 8_000_000,
            },
          ],
        },
      },
      {
        player_id: 'option_1',
        name: 'Option Player',
        displayName: 'Option Player',
        contract: {
          salariesByYear: [
            {
              season: '2026-27',
              option: 'Player Option',
              salary: 12_500_000,
              capHit: 12_500_000,
            },
          ],
        },
      },
    ],
    capHolds: [
      {
        playerId: 'hold_1',
        playerName: 'Cap Hold Player',
        amount: 2_400_000,
        type: 'Bird Rights',
        expiresOn: '2026-06-15T00:00:00.000Z',
      },
    ],
    offerSheets: [],
    incomingOfferSheets: [],
  };
}

function buildDashboardState(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    teamCapSheet: buildSeasonAdvanceTeamCapSheet(),
    currentYear: 2026,
    selectedRulesYear: null,
    activeTab: 'offseason',
    selectedPlayer: null,
    freeAgents: [],
    isLoading: false,
    isSaving: false,
    error: null,
    offseasonRun: false,
    offseasonSummary: null,
    playersMap: {},
    capTableYears: [2026, 2027],
    worldId: 'world_alpha',
    worldAsOfDate: '2026-02-10',
    setTeamCapSheet: vi.fn(),
    setCurrentYear: vi.fn(),
    setActiveTab: mockSetActiveTab,
    setLastCapSheet: vi.fn(),
    setOffseasonRun: vi.fn(),
    setOffseasonSummary: vi.fn(),
    setWorldId: vi.fn(),
    setWorldAsOfDate: vi.fn(),
    ...overrides,
  };
}

function buildDashboardActions(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    handleEditContract: vi.fn(),
    handleCapTableModalAction: vi.fn(),
    handleCapHoldRenounce: vi.fn(),
    handleSetDeadCap: vi.fn(),
    handleSetExceptions: vi.fn(),
    capSheetDevTools: {
      injectFixtures: vi.fn(),
      clearFixtures: vi.fn(),
      hasInjectedFixtures: false,
    },
    applyTradeToCapSheet: vi.fn(),
    handleSign: vi.fn(),
    handleSignAndTrade: vi.fn(),
    getSignAndTradePreflight: vi.fn(),
    getOfferSheetPreflight: vi.fn(),
    handleStoreOfferSheet: vi.fn(),
    handleMatchOfferSheet: vi.fn(),
    handleDeclineOfferSheet: vi.fn(),
    handleFinalizeOfferSheet: vi.fn(),
    handleExtendContract: vi.fn(),
    handleWaiveContract: vi.fn(),
    handleOptionDecision: vi.fn(),
    handleRenounceRights: vi.fn(),
    teamHistoryDevTools: {
      injectFixtures: vi.fn(),
      clearFixtures: vi.fn(),
      hasInjectedFixtures: false,
    },
    ...overrides,
  };
}

function buildDashboardModals(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    showOffseasonModal: false,
    showContractModal: false,
    initialAction: null,
    targetYear: null,
    actionContext: null,
    closeContractModal: mockCloseContractModal,
    closeOffseasonModal: mockCloseOffseasonModal,
    setShowOffseasonModal: mockSetShowOffseasonModal,
    ...overrides,
  };
}

function WorldSelectorHarness({
  userId = 'user_1',
  initialWorldId = null,
  onWorldChange = vi.fn(),
  onSetWorldId,
}: {
  userId?: string | null;
  initialWorldId?: string | null;
  onWorldChange?: (worldId: string | null) => void;
  onSetWorldId?: (worldId: string | null) => void;
}) {
  const [currentWorldId, setCurrentWorldId] = useState<string | null>(
    initialWorldId
  );

  return (
    <WorldSelector
      userId={userId}
      worldId={currentWorldId}
      setWorldId={(worldId) => {
        setCurrentWorldId(worldId);
        onSetWorldId?.(worldId);
      }}
      onWorldChange={onWorldChange}
    />
  );
}

describe('E109 dashboard/world boundary behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    window.localStorage.clear();

    mockListUserWorlds.mockResolvedValue([
      makeWorld('world_alpha', 'World Alpha'),
      makeWorld('world_beta', 'World Beta'),
    ]);
    mockCreateWorld.mockResolvedValue({ worldId: 'world_new' });
    mockBranchWorld.mockResolvedValue({ worldId: 'world_branch' });
    mockUpdateWorldMetadata.mockResolvedValue(undefined);
    mockGetWorldMetadata.mockResolvedValue({
      worldName: 'World Alpha',
      description: 'Original description',
    });
    mockPurgeWorld.mockResolvedValue({ ok: true });

    mockGetTeamTpeList.mockReturnValue([
      { amount: 3_500_000, source: 'Existing Trade' },
    ]);
    mockProcessTradeExceptions.mockReturnValue({
      expiredTPEs: [{ amount: 3_500_000, source: 'Existing Trade' }],
    });
    mockGetTpeExpiryISO.mockReturnValue('2026-06-30T00:00:00.000Z');
    mockAdvanceSeasonInWorld.mockResolvedValue({
      success: true,
      toSeason: '2026-27',
      updatedTeams: ['LAL'],
      summary: {},
    });

    mockUseAuth.mockReturnValue({ userId: 'user_1', loading: false });
    mockUseArchitectState.mockReturnValue(buildDashboardState());
    mockUseArchitectActions.mockReturnValue(buildDashboardActions());
    mockUseArchitectModals.mockReturnValue(buildDashboardModals());
    mockUsePlayerRulesProfiles.mockReturnValue({
      leagueContext: null,
      leagueContextByYear: new Map(),
      getProfile: vi.fn(() => null),
      getProfileForYear: vi.fn(() => null),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('WorldSelector', () => {
    it('preserves rendering, helper copy, localStorage restore, and world selection wiring', async () => {
      const onWorldChange = vi.fn();
      window.localStorage.setItem(
        'architect.activeWorldId.user_1',
        'world_beta'
      );

      render(<WorldSelectorHarness onWorldChange={onWorldChange} />);

      const select = await screen.findByLabelText('Architect (optional)');
      expect(select).toHaveValue('world_beta');
      expect(screen.getByRole('button', { name: '+ New' })).toBeInTheDocument();

      fireEvent.change(select, { target: { value: 'world_alpha' } });

      await waitFor(() => {
        expect(onWorldChange).toHaveBeenCalledWith('world_alpha');
      });
      expect(window.localStorage.getItem('architect.activeWorldId.user_1')).toBe(
        'world_alpha'
      );
    });

    it('preserves create-world modal copy and create wiring', async () => {
      const onWorldChange = vi.fn();
      mockListUserWorlds
        .mockResolvedValueOnce([makeWorld('world_alpha', 'World Alpha')])
        .mockResolvedValueOnce([
          makeWorld('world_alpha', 'World Alpha'),
          makeWorld('world_new', 'New World'),
        ]);

      render(<WorldSelectorHarness onWorldChange={onWorldChange} />);

      await screen.findByLabelText('Architect (optional)');
      fireEvent.click(screen.getByRole('button', { name: '+ New' }));

      expect(
        screen.getByRole('heading', { name: 'Create New World' })
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('World Name'), {
        target: { value: ' New World ' },
      });
      fireEvent.change(screen.getByLabelText('Description (optional)'), {
        target: { value: ' Fresh branch ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(mockCreateWorld).toHaveBeenCalledWith({
          name: 'New World',
          description: 'Fresh branch',
          userId: 'user_1',
        });
      });
      await waitFor(() => {
        expect(onWorldChange).toHaveBeenCalledWith('world_new');
      });
      expect(screen.queryByRole('heading', { name: 'Create New World' })).not.toBeInTheDocument();
    });

    it('preserves branch action ordering and helper wiring', async () => {
      mockListUserWorlds
        .mockResolvedValueOnce([
          makeWorld('world_alpha', 'World Alpha'),
          makeWorld('world_beta', 'World Beta'),
        ])
        .mockResolvedValueOnce([
          makeWorld('world_alpha', 'World Alpha'),
          makeWorld('world_beta', 'World Beta'),
          makeWorld('world_branch', 'World Alpha Branch'),
        ]);

      render(
        <WorldSelectorHarness initialWorldId="world_alpha" onWorldChange={vi.fn()} />
      );

      await screen.findByLabelText('Architect (optional)');
      fireEvent.click(screen.getByTitle('World actions'));

      const actionButtons = screen.getAllByRole('button');
      const actionTexts = actionButtons
        .map((button) => button.textContent)
        .filter((text): text is string =>
          ['Branch', 'Rename', 'Archive', 'Delete Permanently'].includes(
            text || ''
          )
        );

      expect(actionTexts).toEqual([
        'Branch',
        'Rename',
        'Archive',
        'Delete Permanently',
      ]);

      fireEvent.click(screen.getByRole('button', { name: 'Branch' }));
      expect(screen.getByRole('heading', { name: 'Branch World' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('World Alpha (Branch)')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Branch Name'), {
        target: { value: ' World Alpha Branch ' },
      });
      fireEvent.change(screen.getByLabelText('Description (optional)'), {
        target: { value: ' Branch description ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Branch' }));

      await waitFor(() => {
        expect(mockBranchWorld).toHaveBeenCalledWith(
          'world_alpha',
          'World Alpha Branch',
          'Branch description',
          'user_1'
        );
      });
    });

    it('preserves rename-world metadata loading and save wiring', async () => {
      render(
        <WorldSelectorHarness initialWorldId="world_alpha" onWorldChange={vi.fn()} />
      );

      await screen.findByTitle('World actions');
      fireEvent.click(screen.getByTitle('World actions'));
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      await waitFor(() => {
        expect(mockGetWorldMetadata).toHaveBeenCalledWith('world_alpha');
      });
      expect(screen.getByRole('heading', { name: 'Rename World' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('World Name'), {
        target: { value: ' Renamed World ' },
      });
      fireEvent.change(screen.getByLabelText('Description (optional)'), {
        target: { value: ' Updated description ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateWorldMetadata).toHaveBeenCalledWith('world_alpha', {
          worldName: 'Renamed World',
          description: 'Updated description',
        });
      });
    });

    it('preserves archive confirmation flow and clears selected world on success', async () => {
      const onWorldChange = vi.fn();
      const onSetWorldId = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <WorldSelectorHarness
          initialWorldId="world_alpha"
          onWorldChange={onWorldChange}
          onSetWorldId={onSetWorldId}
        />
      );

      await screen.findByLabelText('Architect (optional)');
      fireEvent.click(screen.getByTitle('World actions'));
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

      expect(confirmSpy).toHaveBeenCalledWith(
        'Archive world "World Alpha"? This will hide it from the list. You can restore it later.'
      );
      await waitFor(() => {
        expect(mockUpdateWorldMetadata).toHaveBeenCalledWith('world_alpha', {
          isArchived: true,
        });
      });
      expect(onWorldChange).toHaveBeenCalledWith(null);
      expect(onSetWorldId).toHaveBeenCalledWith(null);
    });

    it('preserves delete-modal open-close behavior and successful purge wiring', async () => {
      const onWorldChange = vi.fn();
      const onSetWorldId = vi.fn();

      render(
        <WorldSelectorHarness
          initialWorldId="world_alpha"
          onWorldChange={onWorldChange}
          onSetWorldId={onSetWorldId}
        />
      );

      await screen.findByLabelText('Architect (optional)');
      fireEvent.click(screen.getByTitle('World actions'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

      expect(
        screen.getByRole('heading', { name: 'Delete World Permanently' })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Delete World Permanently' })
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle('World actions'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));
      fireEvent.change(
        screen.getByLabelText(/Type DELETE or World Alpha to confirm:/i),
        {
          target: { value: 'DELETE' },
        }
      );
      fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

      await waitFor(() => {
        expect(mockPurgeWorld).toHaveBeenCalledWith('world_alpha');
      });
      expect(onWorldChange).toHaveBeenCalledWith(null);
      expect(onSetWorldId).toHaveBeenCalledWith(null);
    });

    it('preserves queued delete failure messaging', async () => {
      mockPurgeWorld.mockResolvedValue({
        queued: true,
        message: 'Deletion queued. Retry in a moment.',
      });

      render(<WorldSelectorHarness initialWorldId="world_alpha" />);

      await screen.findByLabelText('Architect (optional)');
      fireEvent.click(screen.getByTitle('World actions'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));
      fireEvent.change(
        screen.getByLabelText(/Type DELETE or World Alpha to confirm:/i),
        {
          target: { value: 'DELETE' },
        }
      );
      fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

      await waitFor(() => {
        expect(
          screen.getAllByText('Deletion queued. Retry in a moment.').length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('SeasonAdvanceModal', () => {
    it('preserves modal render, section ordering, helper copy, and no-world disabled state', () => {
      render(
        <SeasonAdvanceModal
          isOpen={true}
          onClose={vi.fn()}
          teamCapSheet={buildSeasonAdvanceTeamCapSheet()}
          currentYear={2026}
          worldId={null}
          teamCode="LAL"
          onAdvanceComplete={vi.fn()}
        />
      );

      const summaryHeading = screen.getByRole('heading', {
        name: 'Advance to 2026-27',
      });
      const expiringContractsHeading = screen.getByRole('heading', {
        name: 'Expiring Contracts (1)',
      });
      const optionsHeading = screen.getByRole('heading', {
        name: 'Options Requiring Decision (1)',
      });
      const otherEffectsHeading = screen.getByRole('heading', {
        name: 'Other Effects',
      });

      expect(
        summaryHeading.compareDocumentPosition(expiringContractsHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        expiringContractsHeading.compareDocumentPosition(optionsHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        optionsHeading.compareDocumentPosition(otherEffectsHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      expect(
        screen.getByText(
          '⚠️ No world selected. You must select a world before advancing seasons.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('preserves option-decision wizard flow, processing state, and success callback wiring', async () => {
      const onAdvanceComplete = vi.fn();
      let resolveAdvance: (value: Record<string, unknown>) => void = () => {};
      mockAdvanceSeasonInWorld.mockReturnValue(
        new Promise((resolve) => {
          resolveAdvance = resolve;
        })
      );

      render(
        <SeasonAdvanceModal
          isOpen={true}
          onClose={vi.fn()}
          teamCapSheet={buildSeasonAdvanceTeamCapSheet()}
          currentYear={2026}
          worldId="world_alpha"
          teamCode="LAL"
          onAdvanceComplete={onAdvanceComplete}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(
        screen.getByRole('heading', { name: 'Option Decisions for 2026-27' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

      fireEvent.click(screen.getByLabelText('Exercise'));
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(
        screen.getByRole('heading', { name: 'Confirm Season Advance' })
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));

      expect(
        await screen.findByRole('heading', { name: 'Advancing Season...' })
      ).toBeInTheDocument();

      resolveAdvance({
        success: true,
        toSeason: '2026-27',
        updatedTeams: ['LAL'],
        summary: {},
      });

      await waitFor(() => {
        expect(mockAdvanceSeasonInWorld).toHaveBeenCalledWith('world_alpha', {
          optionDecisions: {
            option_1: {
              decision: 'exercise',
              optionType: 'player',
              season: '2026-27',
            },
          },
        });
      });
      await screen.findByText('Season Advanced Successfully!');
      expect(onAdvanceComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          toSeason: '2026-27',
        })
      );
    });

    it('preserves advance failure behavior by returning to confirmation with the error surfaced', async () => {
      mockAdvanceSeasonInWorld.mockRejectedValue(
        new Error('Failed to advance season')
      );

      render(
        <SeasonAdvanceModal
          isOpen={true}
          onClose={vi.fn()}
          teamCapSheet={buildSeasonAdvanceTeamCapSheet()}
          currentYear={2026}
          worldId="world_alpha"
          teamCode="LAL"
          onAdvanceComplete={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByLabelText('Exercise'));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Confirm Season Advance' })
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to advance season')).toBeInTheDocument();
    });
  });

  describe('GMDashboard', () => {
    it('preserves dashboard shell, tab wiring, world selector placement, world time controls, and OffseasonSection handoff', async () => {
      render(<GMDashboard />);

      expect(
        screen.getByRole('heading', { name: 'HoopZero Architect – GM Dashboard' })
      ).toBeInTheDocument();
      expect(screen.getByTestId('firebase-target-mode-badge')).toHaveTextContent(
        'EMULATOR MODE'
      );

      await screen.findByLabelText('Architect (optional)');
      expect(screen.getByTestId('world-time-controls')).toBeInTheDocument();
      expect(screen.getByTestId('mock-offseason-section')).toHaveAttribute(
        'data-world-id',
        'world_alpha'
      );
      expect(screen.getByTestId('mock-offseason-section')).toHaveAttribute(
        'data-current-year',
        '2026'
      );
      expect(screen.getByTestId('mock-offseason-section')).toHaveAttribute(
        'data-team-code',
        'LAL'
      );
      expect(screen.getByTestId('mock-cap-audit-debug')).toHaveAttribute(
        'data-world-id',
        'world_alpha'
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cap Sheet' }));
      expect(mockSetActiveTab).toHaveBeenCalledWith('cap');
    });

    it('routes current-year and full-table contract launch surfaces through distinct dashboard handlers', async () => {
      const dashboardActions = buildDashboardActions();
      mockUseArchitectActions.mockReturnValue(dashboardActions);
      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'cap',
        })
      );

      const { rerender } = render(<GMDashboard />);

      fireEvent.click(screen.getByTestId('mock-cap-sheet-open-player-contract'));
      expect(dashboardActions.handleEditContract).toHaveBeenCalledWith(
        dashboardRouteFixtures.capSheetPlayer
      );
      expect(dashboardActions.handleCapTableModalAction).not.toHaveBeenCalled();
      expect(dashboardActions.handleCapHoldRenounce).not.toHaveBeenCalled();

      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'capfull',
        })
      );
      rerender(<GMDashboard />);

      fireEvent.click(screen.getByTestId('mock-cap-table-open-player-contract'));
      expect(dashboardActions.handleEditContract).toHaveBeenCalledWith(
        dashboardRouteFixtures.capTablePlayer
      );

      fireEvent.click(screen.getByTestId('mock-cap-table-launch-action'));
      expect(dashboardActions.handleCapTableModalAction).toHaveBeenCalledWith(
        dashboardRouteFixtures.capTablePlayer,
        'rfa',
        2028
      );

      fireEvent.click(screen.getByTestId('mock-cap-table-renounce-hold'));
      expect(dashboardActions.handleCapHoldRenounce).toHaveBeenCalledWith(
        dashboardRouteFixtures.capHold
      );
    });

    it('passes selected player, modal context, and rules-year profile context into the contract modal', async () => {
      const dashboardActions = buildDashboardActions();
      mockUseArchitectActions.mockReturnValue(dashboardActions);
      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'cap',
          selectedPlayer: {
            displayName: 'LeBron James',
          },
          selectedRulesYear: 2028,
        })
      );
      mockUseArchitectModals.mockReturnValue(
        buildDashboardModals({
          showContractModal: true,
          targetYear: 2028,
          actionContext: 'freeAgent',
        })
      );
      mockUsePlayerRulesProfiles.mockReturnValue({
        leagueContext: { currentYear: 2026 },
        leagueContextByYear: new Map([[2028, { currentYear: 2028 }]]),
        getProfile: vi.fn(() => ({
          contractSummary: {
            freeAgencyType: 'Restricted',
            freeAgencyYear: 2027,
          },
        })),
        getProfileForYear: vi.fn(() => null),
      });

      render(<GMDashboard />);

      await screen.findByTestId('mock-edit-contract-modal');
      expect(screen.getByTestId('mock-edit-contract-modal-player')).toHaveTextContent(
        'LeBron James'
      );
      expect(
        screen.getByTestId('mock-edit-contract-modal-target-year')
      ).toHaveTextContent('2028');
      expect(
        screen.getByTestId('mock-edit-contract-modal-action-year')
      ).toHaveTextContent('2028');
      expect(
        screen.getByTestId('mock-edit-contract-modal-action-context')
      ).toHaveTextContent('freeAgent');
      expect(
        screen.getByTestId('mock-edit-contract-modal-profile-free-agency-type')
      ).toHaveTextContent('Restricted');
      expect(
        screen.getByTestId('mock-edit-contract-modal-rules-year')
      ).toHaveTextContent('2028');
      const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];
      expect(modalProps).toEqual(
        expect.objectContaining({
          actionYear: 2028,
          onSignFreeAgent: dashboardActions.handleSign,
          onResign: dashboardActions.handleSign,
          onSignAndTrade: dashboardActions.handleSignAndTrade,
          getSignAndTradePreflight: dashboardActions.getSignAndTradePreflight,
          getOfferSheetPreflight: dashboardActions.getOfferSheetPreflight,
          onStoreOfferSheet: dashboardActions.handleStoreOfferSheet,
          onExtend: dashboardActions.handleExtendContract,
          onWaive: expect.any(Function),
          onOptionDecision: expect.any(Function),
          onRenounce: expect.any(Function),
        })
      );
      expect(modalProps?.onSave).toBeUndefined();

      fireEvent.click(screen.getByRole('button', { name: 'Close Contract Modal' }));
      expect(mockCloseContractModal).toHaveBeenCalledTimes(1);
    });

    it('keeps selectedRulesYear independent from modal targetYear when threading modal rules context', async () => {
      const dashboardActions = buildDashboardActions();
      const selectedPlayer = {
        player_id: 'rules_context_player',
        displayName: 'Rules Context Player',
      };
      const getProfile = vi.fn((player, year) => ({
        contractSummary: {
          freeAgencyType: `Rules ${String(year)}`,
          freeAgencyYear: 2028,
        },
      }));

      mockUseArchitectActions.mockReturnValue(dashboardActions);
      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'cap',
          selectedPlayer,
          selectedRulesYear: 2029,
        })
      );
      mockUseArchitectModals.mockReturnValue(
        buildDashboardModals({
          showContractModal: true,
          targetYear: 2028,
          actionContext: 'freeAgent',
        })
      );
      mockUsePlayerRulesProfiles.mockReturnValue({
        leagueContext: { currentYear: 2026 },
        leagueContextByYear: new Map([
          [2028, { currentYear: 2028 }],
          [2029, { currentYear: 2029 }],
        ]),
        getProfile,
        getProfileForYear: vi.fn(() => null),
      });

      render(<GMDashboard />);

      await screen.findByTestId('mock-edit-contract-modal');
      expect(
        screen.getByTestId('mock-edit-contract-modal-target-year')
      ).toHaveTextContent('2028');
      expect(
        screen.getByTestId('mock-edit-contract-modal-action-year')
      ).toHaveTextContent('2028');
      expect(
        screen.getByTestId('mock-edit-contract-modal-rules-year')
      ).toHaveTextContent('2029');
      expect(
        screen.getByTestId('mock-edit-contract-modal-profile-free-agency-type')
      ).toHaveTextContent('Rules 2029');

      expect(getProfile).toHaveBeenCalledWith(selectedPlayer, 2029);
      expect(getProfile).not.toHaveBeenCalledWith(selectedPlayer, 2028);

      const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];
      expect(modalProps).toEqual(
        expect.objectContaining({
          actionYear: 2028,
          targetYear: 2028,
          rulesLeagueContext: { currentYear: 2029 },
        })
      );
    });

    it('withholds world-only modal callbacks when no world is selected while keeping local Architect callbacks', async () => {
      const dashboardActions = buildDashboardActions();

      mockUseArchitectActions.mockReturnValue(dashboardActions);
      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'cap',
          worldId: null,
          selectedPlayer: {
            player_id: 'no_world_player',
            displayName: 'No World Player',
          },
          selectedRulesYear: 2026,
        })
      );
      mockUseArchitectModals.mockReturnValue(
        buildDashboardModals({
          showContractModal: true,
          targetYear: 2027,
          actionContext: 'underContract',
        })
      );
      mockUsePlayerRulesProfiles.mockReturnValue({
        leagueContext: { currentYear: 2026 },
        leagueContextByYear: new Map([[2026, { currentYear: 2026 }]]),
        getProfile: vi.fn(() => null),
        getProfileForYear: vi.fn(() => null),
      });

      render(<GMDashboard />);

      await screen.findByTestId('mock-edit-contract-modal');
      const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];

      expect(modalProps).toEqual(
        expect.objectContaining({
          onSignFreeAgent: dashboardActions.handleSign,
          onResign: dashboardActions.handleSign,
          onExtend: dashboardActions.handleExtendContract,
          onWaive: expect.any(Function),
          onOptionDecision: expect.any(Function),
          onRenounce: expect.any(Function),
        })
      );
      expect(modalProps?.onSignAndTrade).toBeNull();
      expect(modalProps?.getSignAndTradePreflight).toBeNull();
      expect(modalProps?.getOfferSheetPreflight).toBeNull();
      expect(modalProps?.onStoreOfferSheet).toBeNull();
    });

    it('keeps wrapped modal mutation callbacks as thin adapters into shared Architect action handlers', async () => {
      const selectedPlayer = {
        player_id: 'adapter_player',
        displayName: 'Adapter Player',
      };
      const overrideMetadata = {
        overrideUsed: true,
        overrideReasons: ['manual override'],
        overrideTimestamp: '2026-02-10T00:00:00.000Z',
      };
      const waivePayload = {
        stretch: true,
        buyout: false,
      };
      const dashboardActions = buildDashboardActions({
        handleWaiveContract: vi
          .fn()
          .mockResolvedValue({ success: true, message: 'Waived.' }),
        handleOptionDecision: vi
          .fn()
          .mockResolvedValue({ success: true, message: 'Option saved.' }),
        handleRenounceRights: vi
          .fn()
          .mockResolvedValue({ success: true, message: 'Rights renounced.' }),
      });

      mockUseArchitectActions.mockReturnValue(dashboardActions);
      mockUseArchitectState.mockReturnValue(
        buildDashboardState({
          activeTab: 'cap',
          selectedPlayer,
          selectedRulesYear: 2026,
        })
      );
      mockUseArchitectModals.mockReturnValue(
        buildDashboardModals({
          showContractModal: true,
          targetYear: 2027,
          actionContext: 'underContract',
        })
      );
      mockUsePlayerRulesProfiles.mockReturnValue({
        leagueContext: { currentYear: 2026 },
        leagueContextByYear: new Map([[2026, { currentYear: 2026 }]]),
        getProfile: vi.fn(() => null),
        getProfileForYear: vi.fn(() => null),
      });

      render(<GMDashboard />);

      await screen.findByTestId('mock-edit-contract-modal');
      const modalProps = mockEditContractModalProps.mock.calls.at(-1)?.[0];

      expect(modalProps).toEqual(
        expect.objectContaining({
          onWaive: expect.any(Function),
          onOptionDecision: expect.any(Function),
          onRenounce: expect.any(Function),
        })
      );

      await modalProps?.onWaive?.(selectedPlayer, waivePayload);
      await modalProps?.onOptionDecision?.(
        selectedPlayer,
        false,
        overrideMetadata
      );
      await modalProps?.onRenounce?.(selectedPlayer, overrideMetadata);

      expect(dashboardActions.handleWaiveContract).toHaveBeenCalledWith(
        selectedPlayer,
        waivePayload
      );
      expect(dashboardActions.handleOptionDecision).toHaveBeenCalledWith(
        selectedPlayer,
        false,
        overrideMetadata,
        null
      );
      expect(dashboardActions.handleRenounceRights).toHaveBeenCalledWith(
        selectedPlayer,
        overrideMetadata
      );
    });
  });
});
