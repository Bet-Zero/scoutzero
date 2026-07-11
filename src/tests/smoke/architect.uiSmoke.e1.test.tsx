// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GMDashboard } from '@/features/architect/GMDashboard/GMDashboard';
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
const advanceSeasonInWorldMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'LAL' }),
  // Cockpit TopBar/GMDashboard render <Link>; stub it as a plain anchor.
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode; [k: string]: unknown }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>
  ),
}));

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ userId: null, loading: false }),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  FIREBASE_TARGET_MODE: 'EMULATOR',
  ARCHITECT_REVIEW_MODE: false,
  isLikelyEmulatorConnectionError: () => false,
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectState', () => ({
  useArchitectState: (...args: unknown[]) => useArchitectStateMock(...args),
}));

vi.mock('@/features/architect/GMDashboard/hooks/useArchitectActions', () => ({
  useArchitectActions: () => {
    const signFreeAgent = vi.fn(async () => ({ success: true }));
    const signAndTrade = vi.fn(async () => ({ success: true }));
    const getSignAndTradePreflight = vi.fn();
    const getOfferSheetPreflight = vi.fn();
    const storeOfferSheet = vi.fn(async () => ({ success: true }));
    const matchOfferSheet = vi.fn(async () => ({ success: true }));
    const declineOfferSheet = vi.fn(async () => ({ success: true }));
    const finalizeOfferSheet = vi.fn(async () => ({ success: true }));

    return {
      handleEditContract: vi.fn(),
      handleSetDeadCap: vi.fn(async () => true),
      handleSetExceptions: vi.fn(async () => true),
      capSheetDevTools: {
        injectFixtures: vi.fn(),
        clearFixtures: vi.fn(),
        hasInjectedFixtures: false,
      },
      applyTradeToCapSheet: vi.fn(async () => {}),
      handleSign: signFreeAgent,
      handleSignAndTrade: signAndTrade,
      getSignAndTradePreflight,
      getOfferSheetPreflight,
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
          standardSigningExposureClassification: 'V1 supported',
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

vi.mock('@/features/architect/utils/seasonManager', () => ({
  advanceSeasonInWorld: (...args: unknown[]) => advanceSeasonInWorldMock(...args),
}));

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

function expectCommittedTeamCapSheetUpdate(
  setTeamCapSheet: { mock: { calls: unknown[][] } },
  expectedCommittedTeamCapSheet: TeamLike
) {
  const update = setTeamCapSheet.mock.calls.at(-1)?.[0];

  expect(typeof update).toBe('function');
  expect((update as (previousTeamCapSheet: TeamLike) => TeamLike)(buildTeamFixture())).toEqual(
    expectedCommittedTeamCapSheet
  );
}

function buildCommittedAdvanceExecutorResult(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  const committedTeamCapSheet =
    (overrides.committedTeamCapSheet as Record<string, unknown> | undefined) ||
    buildTeamFixture();
  const committedSeason =
    (overrides.committedSeason as string | undefined) || '2026-27';
  const committedYear =
    (overrides.committedYear as number | undefined) || 2027;
  const updatedTeams =
    (overrides.updatedTeams as string[] | undefined) || ['LAL'];

  return {
    success: true,
    fromSeason: '2025-26',
    toSeason: committedSeason,
    updatedTeams,
    summary: overrides.summary || {},
    draftResolutionInfo: {
      draftYear: 2026,
      hadPositions: false,
    },
    committedState: {
      metadata: {
        currentSeason: committedSeason,
        currentYear: committedYear,
        lastModifiedTeams: updatedTeams,
      },
      event: {
        eventId: 'seasonAdvance_123456_abcd',
        occurredAt: '2026-04-02T12:00:00.000Z',
      },
      focusTeamCode: 'LAL',
      focusTeamSnapshot: committedTeamCapSheet,
    },
    ...overrides,
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
      worldCurrentSeason: '2025-26',
      worldMetadataLoading: false,
      setTeamCapSheet: vi.fn(),
      setCurrentYear: vi.fn(),
      setActiveTab: vi.fn(),
      setLastCapSheet: vi.fn(),
      setOffseasonRun: vi.fn(),
      setOffseasonSummary: vi.fn(),
      activeWorldOwner: {
        worldId: 'world_smoke_lal',
        identityToken: 1,
        setActiveWorld: vi.fn(),
      },
      worldTimeOwner: {
        worldId: 'world_smoke_lal',
        asOfDate: null,
        isUpdatingAsOfDate: false,
        updateAsOfDate: vi.fn(async (nextDate: string) => nextDate),
        advanceByOneDay: vi.fn(async () => CURRENT_YEAR.toString()),
      },
      worldModeBoundary: {
        kind: 'world',
        worldId: 'world_smoke_lal',
        onReloadWorldData: vi.fn(async () => null),
      },
      reloadActiveWorldTeamData: vi.fn(async () => null),
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
        teamCapSheet={
          teamCapSheet as React.ComponentProps<typeof CapSheetSection>['teamCapSheet']
        }
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={vi.fn()}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap: vi.fn(async () => true),
          handleSetExceptions: vi.fn(async () => true),
        }}
        playersMap={{}}
      />
    );

    // Cockpit redesign dropped the in-section "Cap Sheet" heading (the cap sheet
    // is now a cockpit room titled via RoomFrame); assert the primary cap-sheet
    // surface landmark + the canonical Total Cap Hit line as the render proof.
    expect(
      screen.getByRole('region', { name: /Primary selected-year cap sheet surface/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Total Cap Hit$/i)).toBeInTheDocument();
  });

  it('renders Free Agency surface without crash', () => {
    const signFreeAgent = vi.fn(async () => ({ success: true }));
    const signAndTrade = vi.fn(async () => ({ success: true }));
    const getSignAndTradePreflight = vi.fn();
    const getOfferSheetPreflight = vi.fn();
    const storeOfferSheet = vi.fn(async () => ({ success: true }));
    const matchOfferSheet = vi.fn(async () => ({ success: true }));
    const declineOfferSheet = vi.fn(async () => ({ success: true }));
    const finalizeOfferSheet = vi.fn(async () => ({ success: true }));

    render(
      <FreeAgencySection
        freeAgents={[
          {
            id: 'fa_001',
            player_id: 'fa_001',
            name: 'Smoke Fixture Free Agent',
          },
        ]}
        currentYear={CURRENT_YEAR}
        actionOwner={{
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
            standardSigningExposureClassification: 'V1 supported',
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
        }}
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
      />
    );

    expect(screen.getByText(/Free Agent Pool/i)).toBeInTheDocument();
  });

  it('renders Team History timeline row and opens detail modal from DEV fixtures', () => {
    const fixtureTeam = injectTeamHistoryFixtures(
      buildTeamFixture() as Parameters<typeof injectTeamHistoryFixtures>[0]
    );

    render(
      <HistorySection
        teamCapSheet={
          fixtureTeam as React.ComponentProps<typeof HistorySection>['teamCapSheet']
        }
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

    render(
      <OffseasonSection
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={vi.fn()}
        currentYear={CURRENT_YEAR}
        setCurrentYear={vi.fn()}
        capProjections={{}}
        setOffseasonRun={vi.fn()}
        setOffseasonSummary={vi.fn()}
        setShowOffseasonModal={vi.fn()}
        playersMap={{}}
        worldId="world_smoke_lal"
        teamCode="LAL"
        worldSeason="2025-26"
        worldSeasonLoading={false}
        onReloadWorldData={vi.fn()}
      />
    );

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(screen.getByTestId('offseason-preview-surface')).toBeInTheDocument();
    expect(screen.getByText('World Season Advancement')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Advance Season' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('offseason-preview-banner')).toBeInTheDocument();
  });

  it('drives the season advance modal from world season instead of the dashboard viewing year', async () => {
    const teamCapSheet = buildTeamFixture();

    render(
      <OffseasonSection
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={vi.fn()}
        currentYear={2028}
        setCurrentYear={vi.fn()}
        capProjections={{}}
        setOffseasonRun={vi.fn()}
        setOffseasonSummary={vi.fn()}
        setShowOffseasonModal={vi.fn()}
        playersMap={{}}
        worldId="world_smoke_lal"
        teamCode="LAL"
        worldSeason="2025-26"
        worldSeasonLoading={false}
        onReloadWorldData={vi.fn()}
      />
    );

    await within(screen.getByTestId('offseason-world-surface')).findByText(
      'World Season: 2025-26',
      { selector: 'span' }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));

    expect(
      await screen.findByRole('heading', { name: 'Advance to 2026-27' })
    ).toBeInTheDocument();
  });

  it('keeps world-backed season advance disabled until world metadata supplies the current season', async () => {
    const teamCapSheet = buildTeamFixture();

    render(
      <OffseasonSection
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={vi.fn()}
        currentYear={2028}
        setCurrentYear={vi.fn()}
        capProjections={{}}
        setOffseasonRun={vi.fn()}
        setOffseasonSummary={vi.fn()}
        setShowOffseasonModal={vi.fn()}
        playersMap={{}}
        worldId="world_smoke_lal"
        teamCode="LAL"
        worldSeason={null}
        worldSeasonLoading={false}
        onReloadWorldData={vi.fn()}
      />
    );

    await screen.findByText(
      'World season unavailable. Season advance stays disabled until metadata loads.'
    );

    const advanceButton = screen.getByRole('button', { name: 'Advance Season' });
    expect(advanceButton).toBeDisabled();

    fireEvent.click(advanceButton);

    expect(
      screen.queryByRole('heading', { name: 'Advance to 2028-29' })
    ).not.toBeInTheDocument();
    expect(advanceSeasonInWorldMock).not.toHaveBeenCalled();
  });

  it('applies world-backed aftermath from the normalized advance result instead of wrapper-authored fallbacks', async () => {
    const teamCapSheet = buildTeamFixture();
    const committedTeamCapSheet = buildTeamFixture();
    const setCurrentYear = vi.fn();
    const setTeamCapSheet = vi.fn();
    const setOffseasonRun = vi.fn();
    const setOffseasonSummary = vi.fn();
    const setShowOffseasonModal = vi.fn();
    const onReloadWorldData = vi.fn(async () => null);

    advanceSeasonInWorldMock.mockResolvedValue(
      buildCommittedAdvanceExecutorResult({
        committedTeamCapSheet,
        updatedTeams: ['LAL'],
        summary: {
          declinedOptions: [
            { playerId: 'decline_1', playerName: 'Declined Option Player' },
          ],
          expiredContracts: [
            { playerId: 'expire_1', playerName: 'Expiring Contract Player' },
          ],
          expiredTPEs: [
            {
              amount: 4_200_000,
              source: 'Trade Exception A',
              teamCode: 'LAL',
            },
          ],
          exercisedOptions: [
            {
              playerId: 'exercise_1',
              playerName: 'Exercised Option Player',
              optionType: 'team',
              salary: 8_500_000,
            },
          ],
          stepienUpdates: [
            {
              pickId: 'pick_2027',
              year: 2027,
              status: 'retained',
              reason: 'No Stepien violation',
            },
          ],
        },
      })
    );

    render(
      <OffseasonSection
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={setTeamCapSheet}
        currentYear={2028}
        setCurrentYear={setCurrentYear}
        capProjections={{}}
        setOffseasonRun={setOffseasonRun}
        setOffseasonSummary={setOffseasonSummary}
        setShowOffseasonModal={setShowOffseasonModal}
        playersMap={{}}
        worldId="world_smoke_lal"
        teamCode="LAL"
        worldSeason="2025-26"
        worldSeasonLoading={false}
        onReloadWorldData={onReloadWorldData}
      />
    );

    await within(screen.getByTestId('offseason-world-surface')).findByText(
      'World Season: 2025-26',
      { selector: 'span' }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Next' })
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Advance Season' }).at(-1) as Element
    );

    await waitFor(() => {
      expect(advanceSeasonInWorldMock).toHaveBeenCalledWith('world_smoke_lal', {
        fromSeason: '2025-26',
        toSeason: '2026-27',
        optionDecisions: {},
        focusTeamCode: 'LAL',
      });
    });

    await waitFor(() => {
      expectCommittedTeamCapSheetUpdate(setTeamCapSheet, committedTeamCapSheet);
      expect(setCurrentYear).toHaveBeenCalledWith(2027);
      expect(setOffseasonRun).toHaveBeenCalledWith(true);
      expect(setOffseasonSummary).toHaveBeenCalledWith({
        declinedOptions: ['Declined Option Player'],
        expiredContracts: ['Expiring Contract Player'],
        expiredTPEs: [
          {
            amount: 4_200_000,
            source: 'Trade Exception A',
            teamCode: 'LAL',
          },
        ],
        exercisedOptions: [
          {
            playerId: 'exercise_1',
            playerName: 'Exercised Option Player',
            optionType: 'team',
            salary: 8_500_000,
          },
        ],
        stepienUpdates: [
          {
            pickId: 'pick_2027',
            year: 2027,
            status: 'retained',
            reason: 'No Stepien violation',
          },
        ],
      });
      expect(setShowOffseasonModal).toHaveBeenCalledWith(true);
      expect(onReloadWorldData).toHaveBeenCalledTimes(1);
      expect(onReloadWorldData).toHaveBeenCalledWith(
        expect.objectContaining({
          committedTeamSnapshot: committedTeamCapSheet,
          committedWorldMetadata: {
            currentSeason: '2026-27',
          },
        })
      );
    });
    expect(setTeamCapSheet.mock.invocationCallOrder[0]).toBeLessThan(
      onReloadWorldData.mock.invocationCallOrder[0]
    );
  });

  it('does not emit function-component defaultProps deprecation warnings', () => {
    const warningNeedle =
      'Support for defaultProps will be removed from function components';
    const teamCapSheet = buildTeamFixture();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <OffseasonSection
          teamCapSheet={teamCapSheet}
          setTeamCapSheet={vi.fn()}
          currentYear={CURRENT_YEAR}
          setCurrentYear={vi.fn()}
          capProjections={{}}
          setOffseasonRun={vi.fn()}
          setOffseasonSummary={vi.fn()}
          setShowOffseasonModal={vi.fn()}
          playersMap={{}}
          worldId="world_smoke_lal"
          teamCode="LAL"
          worldSeason="2025-26"
          worldSeasonLoading={false}
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
