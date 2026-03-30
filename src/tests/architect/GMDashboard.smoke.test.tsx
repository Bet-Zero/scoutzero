/**
 * FILE: src/tests/architect/GMDashboard.smoke.test.tsx
 * PURPOSE: Minimal smoke test for GMDashboard component - verifies rendering and tab switching
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2025-12-13: Created initial smoke test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GMDashboard from '@/features/architect/GMDashboard/GMDashboard';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'LAL' }),
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

// Mock useArchitectPlayerData
vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  default: () => ({
    players: [] as any[],
    loading: false,
    error: null as any,
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
  CapTableSection: () => <div>CapTableSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/TradeSection', () => ({
  TradeSection: () => <div>TradeSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/FreeAgencySection', () => ({
  FreeAgencySection: () => <div>FreeAgencySection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/OffseasonSection', () => ({
  OffseasonSection: () => <div>OffseasonSection</div>,
}));

vi.mock('@/features/architect/GMDashboard/sections/HistorySection', () => ({
  HistorySection: () => <div>HistorySection</div>,
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
      handleEditContract: vi.fn(),
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
    initialAction: null as any,
    targetYear: null as any,
    actionContext: null as any,
    closeContractModal: vi.fn(),
    closeOffseasonModal: vi.fn(),
    setShowOffseasonModal: vi.fn(),
    openContractModal: vi.fn(),
    openOffseasonModal: vi.fn(),
  }),
}));

vi.mock('@/features/architect/hooks/usePlayerRulesProfiles', () => ({
  usePlayerRulesProfiles: () => ({
    leagueContext: null as any,
    leagueContextByYear: new Map(),
    getProfile: vi.fn(),
    getProfileForYear: vi.fn(),
  }),
}));

// Minimal team cap sheet fixture
const createMockTeamCapSheet = () => ({
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  players: [] as any[],
  deadCap: [] as any[],
  capHolds: [] as any[],
  exceptions: {},
  draftPicks: [] as any[],
  totals: {},
});

describe('GMDashboard Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    const mockCapSheet = createMockTeamCapSheet();
    mockLoadTeamCapSheet.mockResolvedValue(mockCapSheet);
    mockLoadFreeAgents.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('shows loading message when auth is loading', async () => {
      mockUseAuth.mockReturnValue({
        userId: null,
        loading: true,
      });

      render(<GMDashboard />);

      expect(screen.getByText(/Loading GM Dashboard/i)).toBeInTheDocument();
    });

    it('shows loading message when data is loading', async () => {
      mockUseAuth.mockReturnValue({
        userId: 'user123',
        loading: false,
      });

      // Make loadTeamCapSheet hang to simulate loading
      mockLoadTeamCapSheet.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = render(<GMDashboard />);

      // Should show loading initially - use getAllByText since there might be multiple instances
      const loadingMessages = screen.getAllByText(/Loading GM Dashboard/i);
      expect(loadingMessages.length).toBeGreaterThan(0);

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
    });

    it('renders tab buttons when loaded', async () => {
      render(<GMDashboard />);

      // Wait for the dashboard to load by checking for tab buttons
      await waitFor(
        () => {
          const rosterButtons = screen.getAllByRole('button', {
            name: /roster/i,
          });
          expect(rosterButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      // Check for all tab buttons (use getAllByRole to handle multiple instances)
      expect(
        screen.getAllByRole('button', { name: /roster/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /cap sheet/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /full cap table/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /trade machine/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /free agency/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /offseason/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /team history/i }).length
      ).toBeGreaterThan(0);
    });

    it('switches to Cap Sheet tab when clicked', async () => {
      render(<GMDashboard />);

      // Wait for the dashboard to load
      await waitFor(
        () => {
          const rosterButtons = screen.getAllByRole('button', {
            name: /roster/i,
          });
          expect(rosterButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      // Find and click the Cap Sheet tab (use getAllByRole to handle multiple instances)
      const capSheetButtons = screen.getAllByRole('button', {
        name: /cap sheet/i,
      });
      expect(capSheetButtons.length).toBeGreaterThan(0);
      fireEvent.click(capSheetButtons[0]);

      // Verify CapSheetSection is rendered (mocked component)
      await waitFor(() => {
        expect(screen.getByText('CapSheetSection')).toBeInTheDocument();
      });
    });

    it('renders dashboard title', async () => {
      render(<GMDashboard />);

      // Wait for the dashboard to load
      await waitFor(
        () => {
          const rosterButtons = screen.getAllByRole('button', {
            name: /roster/i,
          });
          expect(rosterButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      const titles = screen.getAllByText(/HoopZero Architect.*GM Dashboard/i);
      expect(titles.length).toBeGreaterThan(0);
    });
  });
});
