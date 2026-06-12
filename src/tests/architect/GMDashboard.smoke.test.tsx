/**
 * FILE: src/tests/architect/GMDashboard.smoke.test.tsx
 * PURPOSE: Minimal smoke test for GMDashboard component - verifies rendering and tab switching
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2025-12-13: Created initial smoke test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GMDashboard } from '@/features/architect/GMDashboard/GMDashboard';

const {
  mockUseArchitectState,
  mockSetActiveTab,
  mockCapTableSectionProps,
  mockFreeAgencySectionProps,
  mockTradeSectionProps,
  mockUseArchitectPostActionReceipt,
  mockHandleEditContract,
} = vi.hoisted(() => ({
  mockUseArchitectState: vi.fn(),
  mockSetActiveTab: vi.fn(),
  mockCapTableSectionProps: vi.fn(),
  mockFreeAgencySectionProps: vi.fn(),
  mockTradeSectionProps: vi.fn(),
  mockUseArchitectPostActionReceipt: vi.fn(),
  mockHandleEditContract: vi.fn(),
}));

const buildLoadedDashboardState = () => {
  const teamCapSheet = createMockTeamCapSheet();
  return {
    teamCapSheet,
    baselineCapSheet: teamCapSheet,
    currentYear: 2026,
    selectedRulesYear: 2026,
    activeTab: 'roster' as const,
    selectedPlayer: null,
    freeAgents: [],
    isLoading: false,
    isSaving: false,
    error: '',
    lastCapSheet: null,
    offseasonRun: false,
    offseasonSummary: null,
    playersMap: {},
    capTableYears: [2026, 2027],
    players: [],
    worldId: null,
    worldAsOfDate: null,
    worldCurrentSeason: null,
    worldMetadataLoading: false,
    activeWorldOwner: {
      worldId: null,
      identityToken: 0,
      setActiveWorld: vi.fn(),
    },
    worldTimeOwner: {
      worldId: null,
      asOfDate: null,
      isUpdatingAsOfDate: false,
      updateAsOfDate: vi.fn(async (d: string) => d),
      advanceByOneDay: vi.fn(async () => '2026-02-10'),
    },
    worldModeBoundary: {
      kind: 'sandbox' as const,
      worldId: null,
      onReloadWorldData: null,
    },
    setBaselineCapSheet: vi.fn(),
    setTeamCapSheet: vi.fn(),
    setCurrentYear: vi.fn(),
    setSelectedRulesYear: vi.fn(),
    setActiveTab: mockSetActiveTab,
    setSelectedPlayer: vi.fn(),
    setFreeAgents: vi.fn(),
    setLastCapSheet: vi.fn(),
    setOffseasonRun: vi.fn(),
    setOffseasonSummary: vi.fn(),
    startLoad: vi.fn(),
    finishLoad: vi.fn(),
    startSave: vi.fn(),
    finishSave: vi.fn(),
    setErrorSafe: vi.fn(),
    clearError: vi.fn(),
    refreshWorldRosterIndex: vi.fn(async () => new Set<string>()),
    reloadActiveWorldTeamData: vi.fn(async () => null),
  };
};

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectState', () => ({
  useArchitectState: (...args: unknown[]) => mockUseArchitectState(...args),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectDeskNavigation', () => ({
  useArchitectDeskNavigation: vi.fn(),
  writeLastTeamSlug: vi.fn(),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectComparisonViewModel', () => ({
  useArchitectComparisonViewModel: () => ({
    status: 'unavailable',
    viewModel: null,
    error: null,
  }),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectGuidedAnswers', () => ({
  useArchitectGuidedAnswers: () => ({
    status: 'ready',
    answers: [],
    scopeLabel: 'sandbox',
  }),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt', () => ({
  useArchitectPostActionReceipt: (...args: unknown[]) =>
    mockUseArchitectPostActionReceipt(...args),
}));

vi.mock('@/features/architect/GMDashboard/components/ScenarioMoveRail', () => ({
  ScenarioMoveRail: () => <div data-testid="scenario-move-rail-stub" />,
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'LAL' }),
  // Passthrough stub so cockpit TopBar's <Link to="/gm"> renders inside
  // unit tests that mock the entire react-router-dom module.
  Link: ({ to, children, ...props }: { to: string; children?: React.ReactNode } & Record<string, unknown>) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>
  ),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Firebase helpers for base team and free agent loading
const mockLoadTeamCapSheet = vi.fn();
const mockLoadFreeAgents = vi.fn();

vi.mock('@/features/architect/utils/firebaseTeamPlanHelpers', () => ({
  loadTeamCapSheet: (...args: unknown[]) => mockLoadTeamCapSheet(...args),
  loadFreeAgents: (...args: unknown[]) => mockLoadFreeAgents(...args),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
  FIREBASE_TARGET_MODE: 'EMULATOR',
  isLikelyEmulatorConnectionError: () => false,
}));

// Mock useArchitectPlayerData
vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  useArchitectPlayerData: () => ({
    players: [],
    loading: false,
    error: null,
  }),
}));

// Mock section components to avoid heavy dependencies
vi.mock('@/features/architect/GMDashboard/sections/RosterSection', () => ({
  RosterSection: () => <div>RosterSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/CapSheetSection', () => ({
  CapSheetSection: () => <div>CapSheetSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/CapTableSection', () => ({
  CapTableSection: (props: Record<string, any>) => {
    mockCapTableSectionProps(props);
    return (
      <div>
        CapTableSection
        {props.onLaunchFreeAgentSearch ? (
          <button type="button" onClick={() => props.onLaunchFreeAgentSearch()}>
            + Sign Free Agent
          </button>
        ) : null}
        {(props.freeAgentOptions || []).map(
          (entry: { selectionKey: string; surfacePlayer: { name: string } }) => (
            <button
              key={entry.selectionKey}
              type="button"
              onClick={() => props.onOpenFreeAgentOption?.(entry.selectionKey)}
            >
              Open {entry.surfacePlayer.name}
            </button>
          )
        )}
      </div>
    );
  },
}));

vi.mock('@/features/architect/GMDashboard/sections/TradeSection', () => ({
  TradeSection: (props: Record<string, any>) => {
    mockTradeSectionProps(props);
    return <div>TradeSection</div>;
  },
}));

vi.mock('@/features/architect/GMDashboard/sections/FreeAgencySection', () => ({
  FreeAgencySection: (props: Record<string, any>) => {
    mockFreeAgencySectionProps(props);
    return (
      <div>
        FreeAgencySection
        <button
          type="button"
          onClick={() => {
            props.onSelectedPlayerKeysChange?.(['fa_1']);
            props.onSelectedEntriesChange?.([
              {
                selectionKey: 'fa_1',
                playerId: 'fa_1',
                freeAgent: { id: 'fa_1', name: 'Desk Option' },
                surfacePlayer: {
                  id: 'fa_1',
                  name: 'Desk Option',
                  displayName: 'Desk Option',
                },
              },
            ]);
          }}
        >
          Add Desk Option
        </button>
      </div>
    );
  },
}));

vi.mock('@/features/architect/GMDashboard/sections/OffseasonSection', () => ({
  OffseasonSection: () => <div>OffseasonSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/HistorySection', () => ({
  HistorySection: () => <div>HistorySection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/ComparisonSection', () => ({
  ComparisonSection: () => <div>ComparisonSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/GuideSection', () => ({
  GuideSection: () => <div>GuideSection</div>,
}));

// Mock other hooks used by GMDashboard
vi.mock('@/features/architect/GMDashboard/hooks/useArchitectActions', () => ({
  useArchitectActions: () => {
    const signFreeAgent = vi.fn();
    const signAndTrade = vi.fn();
    const getSignAndTradePreflight = vi.fn();
    const getOfferSheetPreflight = vi.fn();
    const storeOfferSheet = vi.fn();
    const matchOfferSheet = vi.fn();
    const declineOfferSheet = vi.fn();
    const finalizeOfferSheet = vi.fn();

    return {
      handleEditContract: mockHandleEditContract,
      handleSign: signFreeAgent,
      handleSignAndTrade: signAndTrade,
      getSignAndTradePreflight,
      getOfferSheetPreflight,
      capSheetDevTools: {
        injectFixtures: vi.fn(),
        clearFixtures: vi.fn(),
        hasInjectedFixtures: false,
      },
      teamHistoryDevTools: {
        injectFixtures: vi.fn(),
        clearFixtures: vi.fn(),
        hasInjectedFixtures: false,
      },
      handleExtendContract: vi.fn(),
      handleWaiveContract: vi.fn(),
      handleOptionDecision: vi.fn(),
      handleRenounceRights: vi.fn(),
      handleSetDeadCap: vi.fn(),
      handleSetExceptions: vi.fn(),
      handleStoreOfferSheet: storeOfferSheet,
      handleMatchOfferSheet: matchOfferSheet,
      handleDeclineOfferSheet: declineOfferSheet,
      handleFinalizeOfferSheet: finalizeOfferSheet,
      freeAgencyActionOwner: {
        dualPathSigning: {
          signFreeAgent,
        },
        worldOnly: {
          signAndTrade,
          getSignAndTradePreflight,
          getOfferSheetPreflight,
          storeOfferSheet,
          matchOfferSheet,
          declineOfferSheet,
          finalizeOfferSheet,
        },
        freeAgentModalAvailability: {
          visibleActions: ['signNew', 'signAndTrade'],
          actionLabelsOverride: {
            signNew: 'Sign Free Agent',
          },
          showOfferSheetToggle: true,
          signAndTradeInitiation: {
            onSignAndTrade: signAndTrade,
            getSignAndTradePreflight,
          },
          offerSheetInitiation: {
            getOfferSheetPreflight,
            storeOfferSheet,
          },
        },
        offerSheetSectionAvailability: {
          lifecycleActionOwner: {
            matchOfferSheet,
            declineOfferSheet,
            finalizeOfferSheet,
          },
          actionsDisabled: false,
          actionsDisabledReason: null,
        },
      },
      applyTradeToCapSheet: vi.fn(),
      handleCapTableModalAction: vi.fn(),
      handleCapHoldRenounce: vi.fn(),
    };
  },
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectModals', () => ({
  useArchitectModals: () => ({
    showOffseasonModal: false,
    showContractModal: false,
    initialAction: null,
    targetYear: null,
    actionContext: null,
    closeContractModal: vi.fn(),
    closeOffseasonModal: vi.fn(),
    setShowOffseasonModal: vi.fn(),
    openContractModal: vi.fn(),
    openOffseasonModal: vi.fn(),
  }),
}));

vi.mock('@/features/architect/hooks/usePlayerRulesProfiles', () => ({
  usePlayerRulesProfiles: () => ({
    leagueContext: null,
    leagueContextByYear: new Map(),
    getProfile: vi.fn(),
    getProfileForYear: vi.fn(),
  }),
}));

function createMockTeamCapSheet() {
  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    players: [{ id: 'p1', name: 'Test Player', contracts: { '2025-26': { salary: 0 } } }],
    deadCap: [],
    capHolds: [],
    exceptions: { mle: { available: true } },
    draftPicks: [],
    totals: {},
    salaryCapByYear: { '2025-26': 140_000_000 },
    luxuryTaxByYear: { '2025-26': 170_000_000 },
    firstApronByYear: { '2025-26': 178_000_000 },
    secondApronByYear: { '2025-26': 188_000_000 },
  };
}

describe('GMDashboard Smoke Test', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    const mockCapSheet = createMockTeamCapSheet();
    mockLoadTeamCapSheet.mockResolvedValue(mockCapSheet);
    mockLoadFreeAgents.mockResolvedValue(undefined);
    mockUseArchitectState.mockImplementation(() => buildLoadedDashboardState());
    mockUseArchitectPostActionReceipt.mockReturnValue({
      receipt: null,
      generation: 0,
      publish: vi.fn(),
      dismiss: vi.fn(),
    });
  });

  describe('Loading State', () => {
    it('shows loading message when auth is loading', async () => {
      mockUseAuth.mockReturnValue({
        userId: null,
        loading: true,
      });
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        isLoading: true,
      }));

      render(<GMDashboard />);

      expect(screen.getByTestId('gm-dashboard-loading')).toBeInTheDocument();
    });

    it('shows loading message when data is loading', async () => {
      mockUseAuth.mockReturnValue({
        userId: 'user123',
        loading: false,
      });
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        isLoading: true,
      }));

      const { unmount } = render(<GMDashboard />);

      // Should show loading initially - use getAllByText since there might be multiple instances
      expect(screen.getByTestId('gm-dashboard-loading')).toBeInTheDocument();

      // Cleanup to prevent hanging promises
      unmount();
    });
  });

  describe('Loaded State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        userId: 'user123',
        loading: false,
      });
      mockUseArchitectState.mockImplementation(() => buildLoadedDashboardState());
    });

    it('renders nav rail tabs when loaded', async () => {
      render(<GMDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('cockpit-shell')).toBeInTheDocument();
      });

      const tablist = screen.getByRole('tablist', {
        name: /architect dashboard sections/i,
      });
      expect(within(tablist).getByRole('tab', { name: /^roster$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^cap sheet$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^full cap table$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^trade machine$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^free agency$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^offseason$/i })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: /^team history$/i })).toBeInTheDocument();
    });

    it('requests Cap Sheet tab when nav item clicked', async () => {
      render(<GMDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('cockpit-shell')).toBeInTheDocument();
      });

      const tablist = screen.getByRole('tablist', {
        name: /architect dashboard sections/i,
      });
      fireEvent.click(within(tablist).getByRole('tab', { name: /^cap sheet$/i }));

      expect(mockSetActiveTab).toHaveBeenCalledWith('cap');
    });

    it('renders dashboard title', async () => {
      render(<GMDashboard />);

      expect(await screen.findByTestId('cockpit-shell')).toBeInTheDocument();

      const titles = screen.getAllByText(/HoopZero Architect.*GM Dashboard/i);
      expect(titles.length).toBeGreaterThan(0);
    });

    it('opens selected free-agent options in the Full Cap modal', () => {
      let activeTab = 'fa';
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        activeTab,
      }));
      mockSetActiveTab.mockImplementation((nextTab: string) => {
        activeTab = nextTab;
      });

      const view = render(<GMDashboard />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Desk Option' }));

      activeTab = 'capfull';
      view.rerender(<GMDashboard />);
      mockSetActiveTab.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Open Desk Option' }));

      expect(mockSetActiveTab).not.toHaveBeenCalledWith('fa');

      const dialog = screen.getByRole('dialog', { name: /^Sign Free Agent$/i });
      expect(within(dialog).getAllByText('Desk Option').length).toBeGreaterThan(
        0
      );
      expect(within(dialog).getByText('Selected')).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: /^Start Signing$/i })
      ).toBeEnabled();

      fireEvent.click(
        within(dialog).getByRole('button', { name: /^Start Signing$/i })
      );

      expect(mockHandleEditContract).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fa_1',
          displayName: 'Desk Option',
        })
      );
    });

    it('opens the Full Cap free-agent modal without routing to Free Agency', () => {
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        activeTab: 'capfull',
        freeAgents: [
          {
            id: 'fa_pool_1',
            name: 'Pool Guard',
            formattedPosition: 'PG',
            previousSalary: 10_000_000,
            freeAgentType: 'UFA',
          },
          {
            id: 'fa_pool_2',
            name: 'Pool Wing',
            formattedPosition: 'SF',
            previousSalary: 8_000_000,
            freeAgentType: 'RFA',
          },
        ],
        playersMap: {
          fa_pool_1: {
            id: 'fa_pool_1',
            name: 'Pool Guard',
            displayName: 'Pool Guard',
            bio: { age: 27, position: 'PG' },
          },
          fa_pool_2: {
            id: 'fa_pool_2',
            name: 'Pool Wing',
            displayName: 'Pool Wing',
            bio: { age: 25, position: 'SF' },
          },
        },
      }));

      render(<GMDashboard />);

      mockSetActiveTab.mockClear();
      fireEvent.click(
        screen.getByRole('button', { name: /^\+ Sign Free Agent$/i })
      );

      expect(
        screen.getByRole('dialog', { name: /^Sign Free Agent$/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Pool Guard')).toBeInTheDocument();
      expect(screen.getByText('Pool Wing')).toBeInTheDocument();
      expect(screen.getByText('2 eligible players')).toBeInTheDocument();
      expect(mockSetActiveTab).not.toHaveBeenCalledWith('fa');

      fireEvent.change(screen.getByPlaceholderText('Search pool'), {
        target: { value: 'wing' },
      });
      expect(screen.queryByText('Pool Guard')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Pool Wing/i }));
      expect(screen.getByText('Selected')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^Start Signing$/i })
      ).toBeEnabled();

      fireEvent.click(
        screen.getByRole('button', {
          name: /close sign free agent modal/i,
        })
      );

      expect(
        screen.queryByTestId('full-cap-free-agent-modal')
      ).not.toBeInTheDocument();
      expect(screen.getByText('CapTableSection')).toBeInTheDocument();

      const tablist = screen.getByRole('tablist', {
        name: /architect dashboard sections/i,
      });
      fireEvent.click(
        within(tablist).getByRole('tab', { name: /^free agency$/i })
      );

      expect(mockSetActiveTab).toHaveBeenCalledWith('fa');
    });

    it('hands selected Full Cap free agents to the existing contract action owner', () => {
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        activeTab: 'capfull',
        freeAgents: [
          {
            id: 'fa_pool_2',
            name: 'Pool Wing',
            formattedPosition: 'SF',
            previousSalary: 8_000_000,
            freeAgentType: 'RFA',
          },
        ],
        playersMap: {
          fa_pool_2: {
            id: 'fa_pool_2',
            name: 'Pool Wing',
            displayName: 'Pool Wing',
            bio: { age: 25, position: 'SF' },
          },
        },
      }));

      render(<GMDashboard />);

      mockSetActiveTab.mockClear();
      fireEvent.click(
        screen.getByRole('button', { name: /^\+ Sign Free Agent$/i })
      );
      fireEvent.click(screen.getByRole('button', { name: /^Pool Wing/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Start Signing$/i }));

      expect(mockHandleEditContract).toHaveBeenCalledTimes(1);
      expect(mockHandleEditContract).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fa_pool_2',
          displayName: 'Pool Wing',
        })
      );
      expect(mockSetActiveTab).not.toHaveBeenCalledWith('fa');
      expect(
        screen.queryByTestId('full-cap-free-agent-modal')
      ).not.toBeInTheDocument();
    });

    it('forwards every receipt player to the Full Cap Table highlight surface', () => {
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        activeTab: 'capfull',
      }));
      mockUseArchitectPostActionReceipt.mockReturnValue({
        receipt: {
          kind: 'trade',
          actionType: 'trade',
          eventId: 'event_1',
          occurredAt: null,
          headline: 'Trade applied',
          changedTeamCodes: ['LAL', 'BOS'],
          primaryTeamCode: 'LAL',
          primaryPlayerIds: ['player_42', 'player_99'],
          persistence: {
            status: 'world-saved',
            saveStateStatus: 'saved',
            label: 'Saved',
            detail: 'Committed to world.',
          },
          impact: {
            actionType: 'trade',
            mutationType: 'executeTrade',
            teamCode: 'LAL',
            playerId: null,
            playerName: null,
            affectedSeasons: [],
            roster: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            cap: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            exceptions: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            rights: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            deadMoney: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            contract: {
              status: 'not-applicable',
              summary: '',
              deltas: [],
            },
            notes: [],
          },
          authority: 'committed-world',
        },
        generation: 1,
        publish: vi.fn(),
        dismiss: vi.fn(),
      });

      render(<GMDashboard />);

      expect(mockCapTableSectionProps).toHaveBeenLastCalledWith(
        expect.objectContaining({
          highlightPlayerIds: ['player_42', 'player_99'],
        })
      );
    });

    it('returns to the Full Cap Table only after the Trade Machine apply callback fires', () => {
      mockUseArchitectState.mockImplementation(() => ({
        ...buildLoadedDashboardState(),
        activeTab: 'capfull',
      }));

      render(<GMDashboard />);

      // The Trade Machine is now a full-viewport overlay, lazily mounted on
      // first open. Open it via the nav rail so TradeSection mounts and exposes
      // its surface props.
      const tablist = screen.getByRole('tablist', {
        name: /architect dashboard sections/i,
      });
      fireEvent.click(
        within(tablist).getByRole('tab', { name: /^trade machine$/i })
      );

      mockTradeSectionProps.mock.calls.at(-1)?.[0].onAfterTradeApplied();

      expect(mockSetActiveTab).toHaveBeenCalledWith('capfull');
    });
  });
});
