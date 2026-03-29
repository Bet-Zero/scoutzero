// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GMDashboard from '@/features/architect/GMDashboard/GMDashboard';
import { TradeSection } from '@/features/architect/GMDashboard/sections/TradeSection';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import { FreeAgencySection } from '@/features/architect/GMDashboard/sections/FreeAgencySection';
import { HistorySection } from '@/features/architect/GMDashboard/sections/HistorySection';
import { OffseasonSection } from '@/features/architect/GMDashboard/sections/OffseasonSection';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

const useArchitectStateMock = vi.fn();
const useTradeMachineMock = vi.fn();
const getWorldMetadataMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'LAL' }),
}));

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ userId: null, loading: false }),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  FIREBASE_TARGET_MODE: 'EMULATOR',
  isLikelyEmulatorConnectionError: () => false,
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectState', () => ({
  useArchitectState: (...args: unknown[]) => useArchitectStateMock(...args),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectActions', () => ({
  useArchitectActions: () => ({
    handleEditContract: vi.fn(),
    handleSetDeadCap: vi.fn(async () => true),
    handleSetExceptions: vi.fn(async () => true),
    capSheetDevTools: {
      injectFixtures: vi.fn(),
      clearFixtures: vi.fn(),
      hasInjectedFixtures: false,
    },
    applyTradeToCapSheet: vi.fn(async () => {}),
    handleSign: vi.fn(async () => ({ success: true })),
    handleSignAndTrade: vi.fn(async () => ({ success: true })),
    getSignAndTradePreflight: vi.fn(),
    getOfferSheetPreflight: vi.fn(),
    handleStoreOfferSheet: vi.fn(async () => ({ success: true })),
    handleMatchOfferSheet: vi.fn(async () => ({ success: true })),
    handleDeclineOfferSheet: vi.fn(async () => ({ success: true })),
    handleFinalizeOfferSheet: vi.fn(async () => ({ success: true })),
    handleCapSheetAction: vi.fn(),
    handleExtendContract: vi.fn(async () => ({ success: true })),
    handleWaiveContract: vi.fn(async () => ({ success: true })),
    handleOptionDecision: vi.fn(async () => ({ success: true })),
    handleRenounceRights: vi.fn(async () => ({ success: true })),
    teamHistoryDevTools: {
      injectFixtures: vi.fn(),
      clearFixtures: vi.fn(),
      hasInjectedFixtures: false,
    },
  }),
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

vi.mock('@/features/architect/hooks/useTradeMachine', () => ({
  useTradeMachine: (...args: unknown[]) => useTradeMachineMock(...args),
}));

vi.mock('@/shared/hooks/useContainerDimensions', () => ({
  useContainerDimensions: () => ({ width: 1200, height: 700 }),
}));

vi.mock('@/features/architect/utils/worldManager', async () => {
  const actual = await vi.importActual(
    '@/features/architect/utils/worldManager'
  );

  return {
    ...actual,
    getWorldMetadata: (...args: unknown[]) => getWorldMetadataMock(...args),
    getDraftPositions: vi.fn(async () => ({})),
  };
});

const CURRENT_YEAR = 2026;

type TeamLike = {
  id?: string;
  teamCode: string;
  teamName: string;
  roster: string[];
  players: Array<Record<string, unknown>>;
  deadCap: unknown[];
  capHolds: unknown[];
  exceptions: Record<string, unknown>;
  totals: Record<string, unknown>;
  entitlements?: Array<Record<string, unknown>>;
  historyTimeline?: Array<Record<string, unknown>>;
  waivedContracts?: Array<Record<string, unknown>>;
  exceptionHistory?: Array<Record<string, unknown>>;
  mleHistory?: Array<Record<string, unknown>>;
  pickLog?: Array<Record<string, unknown>>;
  currentPicks?: Record<string, unknown>;
};

function makePlayer(index: number): Record<string, unknown> {
  const id = `base_player_${index + 1}`;
  return {
    id,
    player_id: id,
    name: `Base Player ${index + 1}`,
    displayName: `Base Player ${index + 1}`,
    position: 'G',
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: toSeasonCode(CURRENT_YEAR),
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
      ],
    },
  };
}

function buildTeamFixture(): TeamLike {
  const players = Array.from({ length: 12 }, (_, index) => makePlayer(index));
  return {
    id: 'LAL',
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: players.map((player) => String(player.id || '')),
    players,
    deadCap: [],
    capHolds: [],
    exceptions: {},
    totals: {},
    entitlements: [],
    historyTimeline: [],
    waivedContracts: [],
    exceptionHistory: [],
    mleHistory: [],
    pickLog: [],
    currentPicks: {},
  };
}

function buildTradeMachineReturn(teamCapSheet: TeamLike) {
  return {
    teams: [
      {
        team: {
          ...teamCapSheet,
          id: teamCapSheet.id || teamCapSheet.teamCode,
        },
        sends: [],
        entitlementsOut: [],
      },
    ],
    result: null,
    forceTrade: false,
    setPlayerTrade: vi.fn(),
    toggleEntitlement: vi.fn(),
    setEntitlementDestination: vi.fn(),
    selectTeam: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    handleValidate: vi.fn(),
    exportCurrentTrade: vi.fn(() => []),
    undoPlayerTrade: vi.fn(),
    resetTrade: vi.fn(),
    yearKey: toSeasonCode(CURRENT_YEAR),
    incomingAssets: [{ players: [], entitlements: [] }],
    isValidating: false,
    salaryOut: [0],
    hasCurrentValidation: false,
    getValidatedAt: vi.fn(() => null),
    hasInjectedDevSntPlayers: false,
    injectDevSntPlayers: vi.fn(),
    clearInjectedDevSntPlayers: vi.fn(),
    initError: null,
    activeTeamCount: 1,
    applyEntitlementOverrideUpdate: vi.fn(),
    refreshEntitlements: vi.fn(),
  };
}

describe('ARCHITECT_SMOKE_E1: emulator-first world-mode UI smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);

    if (typeof window !== 'undefined' && !window.ResizeObserver) {
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      window.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
    }

    localStorage.clear();
    localStorage.setItem('hz.dev.teamHistoryFixtures', 'true');
    localStorage.setItem('hz.dev.offseasonPreview', 'true');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('renders GM Dashboard shell header with emulator mode badge', () => {
    const teamCapSheet = buildTeamFixture();

    useArchitectStateMock.mockReturnValue({
      teamCapSheet,
      currentYear: CURRENT_YEAR,
      selectedRulesYear: CURRENT_YEAR,
      activeTab: 'roster',
      selectedPlayer: null,
      freeAgents: [],
      isLoading: false,
      isSaving: false,
      error: null,
      offseasonRun: false,
      offseasonSummary: null,
      playersMap: {},
      capTableYears: [CURRENT_YEAR],
      worldId: 'world_smoke_lal',
      worldAsOfDate: null,
      setTeamCapSheet: vi.fn(),
      setCurrentYear: vi.fn(),
      setActiveTab: vi.fn(),
      setLastCapSheet: vi.fn(),
      setOffseasonRun: vi.fn(),
      setOffseasonSummary: vi.fn(),
      setWorldId: vi.fn(),
      setWorldAsOfDate: vi.fn(),
    });

    render(<GMDashboard />);

    expect(screen.getByText(/HoopZero Architect/i)).toBeInTheDocument();
    expect(screen.getByTestId('firebase-target-mode-badge')).toHaveTextContent(
      'EMULATOR MODE'
    );
  });

  it('renders Trade Machine surface without crash', () => {
    const teamCapSheet = buildTeamFixture();
    useTradeMachineMock.mockReturnValue(buildTradeMachineReturn(teamCapSheet));

    render(
      <TradeSection
        primaryTeam="LAL"
        capProjections={{}}
        currentYear={CURRENT_YEAR}
        playersMap={{}}
        onApplyTrade={vi.fn()}
        primaryTeamData={teamCapSheet}
        onEditContract={vi.fn()}
        worldId="world_smoke_lal"
        userId="smoke-user"
      />
    );

    expect(screen.getByText('Trade Machine')).toBeInTheDocument();
  });

  it('renders Cap Sheet surface without crash', () => {
    const teamCapSheet = buildTeamFixture();

    render(
      <CapSheetSection
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={vi.fn()}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap: vi.fn(async () => true),
          handleSetExceptions: vi.fn(async () => true),
        }}
        playersMap={{}}
      />
    );

    expect(screen.getByText(/Cap Sheet/i)).toBeInTheDocument();
    expect(screen.getByText(/^Total Cap Hit$/i)).toBeInTheDocument();
  });

  it('renders Free Agency surface without crash', () => {
    const teamCapSheet = buildTeamFixture();

    render(
      <FreeAgencySection
        freeAgents={[
          {
            id: 'fa_001',
            player_id: 'fa_001',
            name: 'Smoke Fixture Free Agent',
          },
        ]}
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onSign={vi.fn(async () => ({ success: true }))}
        onSignAndTrade={vi.fn(async () => ({ success: true }))}
        onStoreOfferSheet={vi.fn(async () => ({ success: true }))}
        playersMap={{}}
        outgoingOfferSheets={[
          {
            id: 'offer_001',
            playerName: 'Outgoing Offer Player',
            homeTeamCode: 'LAL',
            offeringTeamCode: 'BOS',
            contractYears: 2,
            totalValue: 12_000_000,
            status: 'PENDING_MATCH',
            createdAt: '2026-03-04T00:00:00.000Z',
          },
        ]}
        incomingOfferSheets={[
          {
            id: 'offer_002',
            playerName: 'Incoming Offer Player',
            homeTeamCode: 'LAL',
            offeringTeamCode: 'NYK',
            contractYears: 3,
            totalValue: 24_000_000,
            status: 'PENDING_MATCH',
            createdAt: '2026-03-04T00:00:00.000Z',
          },
        ]}
        onMatch={vi.fn(async () => ({ success: true }))}
        onDecline={vi.fn(async () => ({ success: true }))}
        onFinalize={vi.fn(async () => ({ success: true }))}
        worldId="world_smoke_lal"
      />
    );

    expect(screen.getByText(/Free Agent Pool/i)).toBeInTheDocument();
  });

  it('renders Team History timeline row and opens detail modal from DEV fixtures', () => {
    const fixtureTeam = injectTeamHistoryFixtures(buildTeamFixture());

    render(
      <HistorySection
        teamCapSheet={fixtureTeam}
        worldId="world_smoke_lal"
        onInjectTeamHistoryFixtures={vi.fn()}
        onClearTeamHistoryFixtures={vi.fn()}
        hasInjectedTeamHistoryFixtures={true}
      />
    );

    const row = screen.getByTestId('team-history-event-row-0');
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent('Trade Executed');

    fireEvent.click(row);

    expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('History Item Detail')).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-detail-timestamp')
    ).toHaveTextContent('2026-02-10T14:00:00.000Z');
  });

  it('renders Offseason world surface and season advance controls', async () => {
    const teamCapSheet = buildTeamFixture();
    getWorldMetadataMock.mockResolvedValue({ currentSeason: '2025-26' });

    render(
      <OffseasonSection
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={vi.fn()}
        currentYear={CURRENT_YEAR}
        setCurrentYear={vi.fn()}
        capProjections={{}}
        setLastCapSheet={vi.fn()}
        offseasonRun={false}
        setOffseasonRun={vi.fn()}
        setOffseasonSummary={vi.fn()}
        setShowOffseasonModal={vi.fn()}
        playersMap={{}}
        worldId="world_smoke_lal"
        teamCode="LAL"
        onReloadWorldData={vi.fn()}
      />
    );

    expect(screen.getByText('World Season Advancement')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Advance Season' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('offseason-preview-banner')).toBeInTheDocument();
  });

  it('does not emit function-component defaultProps deprecation warnings', () => {
    const warningNeedle =
      'Support for defaultProps will be removed from function components';
    const teamCapSheet = buildTeamFixture();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      getWorldMetadataMock.mockResolvedValue({ currentSeason: '2025-26' });

      render(
        <OffseasonSection
          teamCapSheet={teamCapSheet}
          setTeamCapSheet={vi.fn()}
          currentYear={CURRENT_YEAR}
          setCurrentYear={vi.fn()}
          capProjections={{}}
          setLastCapSheet={vi.fn()}
          offseasonRun={false}
          setOffseasonRun={vi.fn()}
          setOffseasonSummary={vi.fn()}
          setShowOffseasonModal={vi.fn()}
          playersMap={{}}
          worldId="world_smoke_lal"
          teamCode="LAL"
          onReloadWorldData={vi.fn()}
        />
      );

      const combinedLogs = [...warnSpy.mock.calls, ...errorSpy.mock.calls].map(
        (args) => args.map((value) => String(value)).join(' ')
      );

      expect(combinedLogs.some((line) => line.includes(warningNeedle))).toBe(
        false
      );
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
