import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  useArchitectActions,
  type UseArchitectActionsParams,
  type UseArchitectActionsReturn,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
  computeWorldMutation: vi.fn(),
  findUpdatedTeamSnapshot: vi.fn(
    (
      teamUpdates: Array<{ teamCode?: string; team?: unknown }> | null | undefined,
      targetTeamCode: string
    ) =>
      (teamUpdates || []).find(
        (update) => update?.teamCode === targetTeamCode && update?.team
      )?.team || null
  ),
  findCommittedTeamSnapshot: vi.fn(
    (
      teamUpdates: Array<{ teamCode?: string; team?: unknown }> | null | undefined,
      targetTeamCode: string
    ) =>
      (teamUpdates || []).find(
        (update) => update?.teamCode === targetTeamCode && update?.team
      )?.team || null
  ),
  buildGeneralMutationDashboardReloadTeamSnapshot: vi.fn(
    (team: unknown) => team || null
  ),
  preflightSignAndTradeMutation: vi.fn(),
  preflightOfferSheetMutation: vi.fn(),
}));

const validationMocks = vi.hoisted(() => ({
  validateSigning: vi.fn(),
}));

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveTeamCode: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/architect/utils/mutationPipeline', () => ({
  applyWorldMutation: mutationMocks.applyWorldMutation,
  buildGeneralMutationDashboardReloadTeamSnapshot:
    mutationMocks.buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation: mutationMocks.computeWorldMutation,
  findCommittedTeamSnapshot: mutationMocks.findCommittedTeamSnapshot,
  findUpdatedTeamSnapshot: mutationMocks.findUpdatedTeamSnapshot,
  preflightSignAndTradeMutation: mutationMocks.preflightSignAndTradeMutation,
  preflightOfferSheetMutation: mutationMocks.preflightOfferSheetMutation,
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: validationMocks.validateSigning,
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

type FreeAgencyPlayerFixture = Parameters<UseArchitectActionsReturn['handleSign']>[0];
type FreeAgencyContractFixture = Parameters<
  UseArchitectActionsReturn['handleSign']
>[1];
type FreeAgencyMutationResult = Awaited<
  ReturnType<UseArchitectActionsReturn['handleSign']>
>;
type FreeAgencySignAndTradePreflight = Awaited<
  ReturnType<UseArchitectActionsReturn['getSignAndTradePreflight']>
>;
type FreeAgencyOfferSheetPreflight = Awaited<
  ReturnType<UseArchitectActionsReturn['getOfferSheetPreflight']>
>;
type FreeAgencyPreparedContract = Partial<FreeAgencyContractFixture> &
  Record<string, unknown>;
type FreeAgencyWorldMutationArgs = {
  mutationType?: string;
  worldId?: string | null;
  seasonId?: string;
  payload?: Record<string, unknown> & {
    contract?: FreeAgencyPreparedContract;
    signedUsing?: unknown;
  };
};
type FreeAgencyValidationArgs = {
  contract?: unknown;
  signedUsing?: unknown;
};
type FreeAgencyComputeArgs = {
  mutationType?: string;
  seasonId?: string;
  payload: Record<string, unknown> & {
    contract?: unknown;
    signedUsing?: unknown;
  };
};
type FreeAgencyPreflightArgs = {
  seasonId?: string;
  payload?: unknown;
};
type FreeAgencyOfferSheetActionInput = Parameters<
  UseArchitectActionsReturn['handleFinalizeOfferSheet']
>[0];
type FreeAgencyTradeInput = Parameters<
  UseArchitectActionsReturn['applyTradeToCapSheet']
>[0];
type FreeAgencyTeamCapSheet = NonNullable<
  UseArchitectActionsParams['state']['teamCapSheet']
>;
type FreeAgencyStateCapSheet = UseArchitectActionsParams['state']['teamCapSheet'];
type FreeAgencyCapHold = NonNullable<FreeAgencyTeamCapSheet['capHolds']>[number];
type StateSetterValue<T> = T extends Dispatch<SetStateAction<infer TValue>>
  ? TValue
  : never;
type FreeAgencySelectedPlayerState = StateSetterValue<
  UseArchitectActionsParams['state']['setSelectedPlayer']
>;
type FreeAgencyFreeAgentsState = StateSetterValue<
  UseArchitectActionsParams['state']['setFreeAgents']
>;
type ReloadActiveWorldTeamData = NonNullable<
  UseArchitectActionsParams['state']['reloadActiveWorldTeamData']
>;

const playerFixture = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'LAL',
  contract: {
    salariesByYear: [],
  },
} satisfies FreeAgencyPlayerFixture;

const contractFixture = {
  salariesByYear: [
    {
      season: '2025-26',
      salary: 12_000_000,
      capHit: 12_000_000,
      guaranteed: true,
    },
  ],
  totalValue: 12_000_000,
  signedUsing: 'Full MLE',
} satisfies FreeAgencyContractFixture;

const buildStagedScalarSigningFixture = (
  overrides: Record<string, unknown> = {}
) =>
  ({
    years: 2,
    salaries: [12_000_000, 12_600_000],
    startYear: 2026,
    contractType: 'Staged Modal Contract',
    exceptionType: 'Full MLE',
    signedUsing: 'Full MLE',
    contractYears: 1,
    totalValue: 1,
    firstYearGuaranteed: false,
    salariesByYear: [
      {
        season: '1999-00',
        salary: 1,
        capHit: 1,
        guaranteed: false,
      },
    ],
    ...overrides,
  }) satisfies FreeAgencyContractFixture;

const baseTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: [],
  capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      usedAmount: 0,
      remainingAmount: 12_900_000,
    },
  },
  totals: {
    isHardCapped: false,
  },
} satisfies FreeAgencyTeamCapSheet;

function buildSignedTeamFixture(
  baseTeam: Partial<FreeAgencyTeamCapSheet> & Record<string, unknown> = baseTeamFixture,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...baseTeam,
    roster: ['player_1'],
    players: [
      {
        ...playerFixture,
        contract: {
          salariesByYear: contractFixture.salariesByYear,
        },
      },
    ],
    capHolds: [],
    exceptions: {
      mle: {
        type: 'non-taxpayer',
        usedAmount: 12_000_000,
        remainingAmount: 900_000,
      },
    },
    totals: {
      isHardCapped: true,
      hardCapLevel: 'firstApron',
      hardCapReason: 'Triggered by Non-Taxpayer MLE',
      hardCapDetail: 'Triggered by Non-Taxpayer MLE',
    },
    hardCapLevel: 'firstApron',
    hardCapReason: 'Triggered by Non-Taxpayer MLE',
    hardCapTriggeredBy: 'fullMLE',
    ...overrides,
  };
}

function buildSignAndTradeCommittedSourceTeamFixture(
  baseTeam: Partial<FreeAgencyTeamCapSheet> & Record<string, unknown> = baseTeamFixture,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...baseTeam,
    roster: [],
    players: [],
    capHolds: [],
    totals: {
      ...(baseTeam?.totals || {}),
      isHardCapped: false,
    },
    ...overrides,
  };
}

function buildPendingOfferSheetFixture(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 'os_1',
    dedupKey: 'os:world_1:LAL:player_1:2025-26',
    playerId: 'player_1',
    playerName: 'Test Player',
    offeringTeamCode: 'LAL',
    homeTeamCode: 'BOS',
    seasonKey: '2025-26',
    status: 'PENDING_MATCH',
    contractYears: 4,
    totalValue: 12_000_000,
    ...overrides,
  };
}

function buildIncomingOfferSheetLifecycleTeamFixture(
  status: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...baseTeamFixture,
    offerSheets: [],
    incomingOfferSheets: [
      buildPendingOfferSheetFixture({
        id: 'offer_lifecycle_1',
        dedupKey: 'os:world_1:BOS:player_1:2025-26',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
        status,
        ...overrides,
      }),
    ],
  };
}

function buildOutgoingOfferSheetLifecycleTeamFixture(
  status: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...baseTeamFixture,
    offerSheets: [
      buildPendingOfferSheetFixture({
        id: 'offer_lifecycle_1',
        offeringTeamCode: 'LAL',
        homeTeamCode: 'BOS',
        status,
        ...overrides,
      }),
    ],
    incomingOfferSheets: [],
  };
}

function summarizeStandardSignPostState(current: {
  teamCapSheet: FreeAgencyTeamCapSheet | null | undefined;
  freeAgents: FreeAgencyPlayerFixture[];
}) {
  return {
    roster: [...(current.teamCapSheet?.roster || [])],
    playerIds: (current.teamCapSheet?.players || [])
      .map((player) => String(player?.id || player?.player_id || ''))
      .filter(Boolean)
      .sort(),
    capHoldPlayerIds: (current.teamCapSheet?.capHolds || [])
      .map((hold: FreeAgencyCapHold) => String(hold?.playerId || ''))
      .filter(Boolean)
      .sort(),
    mleUsedAmount: current.teamCapSheet?.exceptions?.mle?.usedAmount ?? null,
    mleRemainingAmount:
      current.teamCapSheet?.exceptions?.mle?.remainingAmount ?? null,
    hardCapLevel:
      current.teamCapSheet?.hardCapLevel ||
      current.teamCapSheet?.totals?.hardCapLevel ||
      null,
    hardCapReason:
      current.teamCapSheet?.hardCapReason ||
      current.teamCapSheet?.totals?.hardCapReason ||
      null,
    hardCapTriggeredBy: current.teamCapSheet?.hardCapTriggeredBy || null,
    freeAgentIds: (current.freeAgents || [])
      .map((player) =>
        String(player?.id || player?.player_id || player?.name || '')
      )
      .filter(Boolean)
      .sort(),
  };
}

function createStandardRosterPlayer(index: number) {
  const playerId = `roster_player_${index + 1}`;
  return {
    id: playerId,
    player_id: playerId,
    name: `Roster Player ${index + 1}`,
    displayName: `Roster Player ${index + 1}`,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: '2025-26',
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
      ],
    },
  };
}

function renderActionsHarness({
  worldId,
  userId = 'user_1',
  initialTeam = baseTeamFixture,
  reloadActiveWorldTeamData,
  publishPostActionReceipt,
}: {
  worldId: string | null;
  userId?: string | null;
  initialTeam?: FreeAgencyTeamCapSheet;
  reloadActiveWorldTeamData?: ReloadActiveWorldTeamData | null;
  publishPostActionReceipt?: (receipt: ArchitectPostActionReceipt) => void;
}) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] =
      useState<FreeAgencyStateCapSheet>(initialTeam);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] =
      useState<FreeAgencySelectedPlayerState>(null);
    const [freeAgents, setFreeAgents] = useState<FreeAgencyPlayerFixture[]>([
      playerFixture,
    ]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] = useState<unknown>(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: userId ?? null,
      authLoading: false,
      state: {
        teamCapSheet,
        currentYear: 2026,
        setTeamCapSheet,
        setSelectedRulesYear,
        setSelectedPlayer,
        setFreeAgents:
          setFreeAgents as UseArchitectActionsParams['state']['setFreeAgents'],
        startSave,
        finishSave,
        setOffseasonRun,
        setOffseasonSummary,
        refreshWorldRosterIndex,
        ...(reloadActiveWorldTeamData
          ? { reloadActiveWorldTeamData }
          : {}),
      },
      playersMap: {
        [playerFixture.id]: playerFixture,
        [playerFixture.player_id]: playerFixture,
        [playerFixture.name]: playerFixture,
      },
      modals,
      worldId,
      seasonId: '2025-26',
      publishPostActionReceipt,
    });

    return {
      actions,
      teamCapSheet,
      freeAgents,
      selectedRulesYear,
      selectedPlayer,
      offseasonRun,
      offseasonSummary,
    };
  });

  return {
    result,
    refreshWorldRosterIndex,
    startSave,
    finishSave,
  };
}

describe('useArchitectActions Free Agency SSOT wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validationMocks.validateSigning.mockReturnValue({
      valid: true,
      violations: [],
      warnings: [],
    });
    mutationMocks.preflightSignAndTradeMutation.mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
    mutationMocks.preflightOfferSheetMutation.mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(baseTeamFixture);
  });

  it('publishes grouped Free Agency owners while parking advanced modal lanes for V1', () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    expect(result.current.actions.freeAgencyActionOwner).toEqual({
      dualPathSigning: {
        signFreeAgent: result.current.actions.handleSign,
      },
      worldOnly: {
        signAndTrade: result.current.actions.handleSignAndTrade,
        getSignAndTradePreflight:
          result.current.actions.getSignAndTradePreflight,
        getOfferSheetPreflight: result.current.actions.getOfferSheetPreflight,
        storeOfferSheet: result.current.actions.handleStoreOfferSheet,
        matchOfferSheet: result.current.actions.handleMatchOfferSheet,
        declineOfferSheet: result.current.actions.handleDeclineOfferSheet,
        finalizeOfferSheet: result.current.actions.handleFinalizeOfferSheet,
      },
      freeAgentModalAvailability: {
        visibleActions: ['signNew'],
        actionLabelsOverride: {
          signNew: 'Sign Free Agent',
        },
        standardSigningExposureClassification: 'V1 supported',
        showOfferSheetToggle: false,
        signAndTradeInitiation: null,
        offerSheetInitiation: null,
      },
      offerSheetSectionAvailability: {
        lifecycleActionOwner: {
          matchOfferSheet: result.current.actions.handleMatchOfferSheet,
          declineOfferSheet: result.current.actions.handleDeclineOfferSheet,
          finalizeOfferSheet: result.current.actions.handleFinalizeOfferSheet,
        },
        actionsDisabled: false,
        actionsDisabledReason: null,
      },
    });
  });

  it('keeps standard signing available in vacuum mode while withholding the world-only grouped owner', () => {
    const { result } = renderActionsHarness({ worldId: null });

    expect(result.current.actions.freeAgencyActionOwner).toEqual({
      dualPathSigning: {
        signFreeAgent: result.current.actions.handleSign,
      },
      worldOnly: null,
      freeAgentModalAvailability: {
        visibleActions: ['signNew'],
        actionLabelsOverride: {
          signNew: 'Sign Free Agent (Preview)',
        },
        standardSigningExposureClassification: 'preview-only',
        showOfferSheetToggle: false,
        signAndTradeInitiation: null,
        offerSheetInitiation: null,
      },
      offerSheetSectionAvailability: {
        lifecycleActionOwner: null,
        actionsDisabled: true,
        actionsDisabledReason:
          'Offer-sheet lifecycle actions require an active world to commit.',
      },
    });
  });

  it('keeps dual-path standard signing sandbox-capable through the grouped owner while world-only modal paths stay unavailable', async () => {
    const rosterPlayers = Array.from({ length: 13 }, (_, index) =>
      createStandardRosterPlayer(index)
    );
    const signableBaseTeam = {
      ...baseTeamFixture,
      roster: rosterPlayers.map((player) => player.id),
      players: rosterPlayers,
      capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
    };
    const updatedTeam = buildSignedTeamFixture(signableBaseTeam, {
      roster: [...signableBaseTeam.roster, 'player_1'],
      players: [
        ...signableBaseTeam.players,
        {
          ...playerFixture,
          contract: {
            salariesByYear: contractFixture.salariesByYear,
          },
        },
      ],
    });
    mutationMocks.computeWorldMutation.mockReturnValue({
      success: true,
      teamUpdates: [{ teamCode: 'LAL', team: updatedTeam }],
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: null,
      initialTeam: signableBaseTeam,
    });
    const sandboxOwner = result.current.actions.freeAgencyActionOwner;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await sandboxOwner.dualPathSigning.signFreeAgent(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(mutationMocks.computeWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        payload: expect.objectContaining({
          playerId: 'player_1',
          signedUsing: 'Full MLE',
          teamCode: 'LAL',
        }),
      })
    );
    expect(sandboxOwner.worldOnly).toBeNull();
    expect(
      sandboxOwner.freeAgentModalAvailability.signAndTradeInitiation
    ).toBeNull();
    expect(
      sandboxOwner.freeAgentModalAvailability.offerSheetInitiation
    ).toBeNull();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(result.current.teamCapSheet).toEqual(updatedTeam);
  });

  it('keeps preview-vs-commit world-only messaging aligned with the capability matrix in sandbox mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });
    const sandboxOwner = result.current.actions.freeAgencyActionOwner;

    let satPreflightResult: FreeAgencySignAndTradePreflight | undefined;
    let offerSheetPreflightResult: FreeAgencyOfferSheetPreflight | undefined;
    let signAndTradeResult: FreeAgencyMutationResult | undefined;
    let offerSheetStoreResult: FreeAgencyMutationResult | undefined;

    await act(async () => {
      satPreflightResult =
        await result.current.actions.getSignAndTradePreflight(
          playerFixture,
          contractFixture,
          'BOS'
        );
      offerSheetPreflightResult =
        await result.current.actions.getOfferSheetPreflight(
          playerFixture,
          contractFixture
        );
      signAndTradeResult = await result.current.actions.handleSignAndTrade(
        playerFixture,
        contractFixture,
        'BOS'
      );
      offerSheetStoreResult =
        await result.current.actions.handleStoreOfferSheet(
          playerFixture,
          contractFixture
        );
    });

    expect(satPreflightResult?.reasons).toEqual([
      'Sign-and-trade requires an active world to preview.',
    ]);
    expect(signAndTradeResult).toEqual({
      success: false,
      message: 'Sign-and-trade requires an active world to commit.',
    });
    expect(offerSheetPreflightResult?.reasons).toEqual([
      'Offer sheet actions require an active world to preview.',
    ]);
    expect(offerSheetStoreResult).toEqual({
      success: false,
      message: 'Offer sheet actions require an active world to commit.',
    });
    expect(
      sandboxOwner.offerSheetSectionAvailability.actionsDisabledReason
    ).toBe('Offer-sheet lifecycle actions require an active world to commit.');

    toastMocks.error.mockClear();

    act(() => {
      result.current.actions.handleMatchOfferSheet('BOS', 'offer_1');
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        sandboxOwner.offerSheetSectionAvailability.actionsDisabledReason
      );
    });

    expect(mutationMocks.preflightSignAndTradeMutation).not.toHaveBeenCalled();
    expect(mutationMocks.preflightOfferSheetMutation).not.toHaveBeenCalled();
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('applies canonical changedTeams snapshot immediately after world-mode sign', async () => {
    const updatedTeam = buildSignedTeamFixture();

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_1' },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet?.capHolds).toHaveLength(0);
      expect(result.current.teamCapSheet?.totals?.isHardCapped).toBe(true);
      expect(result.current.teamCapSheet?.totals?.hardCapReason).toBe(
        'Triggered by Non-Taxpayer MLE'
      );
      expect(result.current.teamCapSheet?.hardCapReason).toBe(
        'Triggered by Non-Taxpayer MLE'
      );
      expect(result.current.teamCapSheet?.exceptions?.mle?.usedAmount).toBe(
        12_000_000
      );
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        worldId: 'world_1',
        payload: expect.objectContaining({
          signedUsing: 'Full MLE',
        }),
      })
    );
    expect(actionResult).toEqual({ success: true });
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
    expect(refreshWorldRosterIndex).toHaveBeenCalled();
  });

  it('keeps world-mode and vacuum-mode standard-sign post-state truth coherent', async () => {
    const rosterPlayers = Array.from({ length: 13 }, (_, index) =>
      createStandardRosterPlayer(index)
    );
    const signableBaseTeam = {
      ...baseTeamFixture,
      roster: rosterPlayers.map((player) => player.id),
      players: rosterPlayers,
      capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
    };
    const updatedTeam = buildSignedTeamFixture(signableBaseTeam, {
      roster: [...signableBaseTeam.roster, 'player_1'],
      players: [
        ...signableBaseTeam.players,
        {
          ...playerFixture,
          contract: {
            salariesByYear: contractFixture.salariesByYear,
          },
        },
      ],
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_world_coherence' },
    });

    const { result: worldResult, refreshWorldRosterIndex: worldRefresh } =
      renderActionsHarness({
        worldId: 'world_1',
        initialTeam: signableBaseTeam,
      });

    await act(async () => {
      await worldResult.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    mutationMocks.computeWorldMutation.mockReturnValue({
      success: true,
      teamUpdates: [{ teamCode: 'LAL', team: updatedTeam }],
    });

    const { result: vacuumResult, refreshWorldRosterIndex: vacuumRefresh } =
      renderActionsHarness({
        worldId: null,
        initialTeam: signableBaseTeam,
      });

    await act(async () => {
      await vacuumResult.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(summarizeStandardSignPostState(worldResult.current)).toEqual(
      summarizeStandardSignPostState(vacuumResult.current)
    );
    expect(worldRefresh).toHaveBeenCalledTimes(1);
    expect(vacuumRefresh).not.toHaveBeenCalled();
  });

  it('keeps vacuum standard signing on the local-validated lane even if a world reload helper is present', async () => {
    const rosterPlayers = Array.from({ length: 13 }, (_, index) =>
      createStandardRosterPlayer(index)
    );
    const signableBaseTeam = {
      ...baseTeamFixture,
      roster: rosterPlayers.map((player) => player.id),
      players: rosterPlayers,
      capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
    };
    const updatedTeam = buildSignedTeamFixture(signableBaseTeam, {
      roster: [...signableBaseTeam.roster, 'player_1'],
      players: [
        ...signableBaseTeam.players,
        {
          ...playerFixture,
          contract: {
            salariesByYear: contractFixture.salariesByYear,
          },
        },
      ],
    });
    mutationMocks.computeWorldMutation.mockReturnValue({
      success: true,
      teamUpdates: [{ teamCode: 'LAL', team: updatedTeam }],
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'applied' as const,
      committedWorldTeam: {
        committedTeam: updatedTeam,
        committedTeamSource: 'reload' as const,
      },
    }));

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: null,
      initialTeam: signableBaseTeam,
      reloadActiveWorldTeamData,
    });

    await act(async () => {
      await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(reloadActiveWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(result.current.teamCapSheet).toEqual(updatedTeam);
    expect(summarizeStandardSignPostState(result.current).freeAgentIds).toEqual(
      []
    );
  });

  it('reloads committed world signing truth when changedTeams does not include the active team', async () => {
    const reloadedTeam = buildSignedTeamFixture({
      source: {
        type: 'world-snapshot',
        lastModifiedAt: '2026-03-31T00:00:00.000Z',
      },
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_reload_fallback' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(reloadedTeam);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(worldTeamDataMocks.loadWorldTeamData).toHaveBeenCalledWith(
      'world_1',
      'LAL'
    );
    expect(result.current.teamCapSheet).toEqual(reloadedTeam);
    expect(result.current.freeAgents).toEqual([]);
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
  });

  it('delegates committed world signing reload ownership to the state reload helper when present', async () => {
    const updatedTeam = buildSignedTeamFixture({
      source: {
        type: 'changed-teams',
        lastModifiedAt: '2026-03-31T00:00:00.000Z',
      },
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_state_reload_owner' },
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'applied' as const,
      committedWorldTeam: {
        committedTeam: updatedTeam,
        committedTeamSource: 'changedTeams' as const,
      },
    }));

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: baseTeamFixture,
      reloadActiveWorldTeamData,
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(reloadActiveWorldTeamData).toHaveBeenCalledWith({
      committedTeamSnapshot: updatedTeam,
      committedTeamSource: 'changedTeams',
      committedWorldMetadata: null,
      refreshRosterBundle: true,
    });
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('forwards authoritative world metadata patches to the state reload owner instead of applying them locally', async () => {
    const updatedTeam = buildSignedTeamFixture({
      source: {
        type: 'changed-teams',
        lastModifiedAt: '2026-04-01T00:00:00.000Z',
      },
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      worldPatch: {
        asOfDate: '2026-07-05',
      },
      event: { eventId: 'evt_sign_state_metadata_patch' },
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'applied' as const,
      committedWorldTeam: {
        committedTeam: updatedTeam,
        committedTeamSource: 'changedTeams' as const,
      },
    }));

    const { result } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: baseTeamFixture,
      reloadActiveWorldTeamData,
    });

    await act(async () => {
      await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(reloadActiveWorldTeamData).toHaveBeenCalledWith({
      committedTeamSnapshot: updatedTeam,
      committedTeamSource: 'changedTeams',
      committedWorldMetadata: {
        asOfDate: '2026-07-05',
      },
      refreshRosterBundle: true,
    });
  });

  it('fails closed when world signing persists but no committed team snapshot can be resolved', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_missing_snapshot' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(null);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;
    const beforeFreeAgents = result.current.freeAgents;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual({
      success: false,
      message:
        'Signing saved but the committed team snapshot could not be reloaded.',
    });
    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(result.current.freeAgents).toBe(beforeFreeAgents);
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Signing saved but the committed team snapshot could not be reloaded.'
    );
  });

  it('does not apply stale local free-agent aftermath when the state reload owner rejects a world signing reapply', async () => {
    const updatedTeam = buildSignedTeamFixture({
      source: {
        type: 'changed-teams',
        lastModifiedAt: '2026-03-31T00:00:00.000Z',
      },
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_stale_reload_drop' },
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'stale-drop' as const,
      reason: 'active-world-changed' as const,
    }));

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: baseTeamFixture,
      reloadActiveWorldTeamData,
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;
    const beforeFreeAgentIds = summarizeStandardSignPostState(
      result.current
    ).freeAgentIds;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(reloadActiveWorldTeamData).toHaveBeenCalledWith({
      committedTeamSnapshot: updatedTeam,
      committedTeamSource: 'changedTeams',
      committedWorldMetadata: null,
      refreshRosterBundle: true,
    });
    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(summarizeStandardSignPostState(result.current).freeAgentIds).toEqual(
      beforeFreeAgentIds
    );
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('ignores conflicting modal-finalized standard-sign fields and dispatches one canonical mutation contract', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: baseTeamFixture }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_scalar_1' },
    });

    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.handleSign(
        playerFixture,
        buildStagedScalarSigningFixture()
      );
    });

    const worldMutationArgs =
      mutationMocks.applyWorldMutation.mock.calls.at(-1)
        ?.[0] as FreeAgencyWorldMutationArgs;
    const dispatchedContract = worldMutationArgs?.payload?.contract;

    expect(worldMutationArgs).toEqual(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        worldId: 'world_1',
        payload: expect.objectContaining({
          signedUsing: 'Full MLE',
        }),
      })
    );
    expect(dispatchedContract).toEqual(
      expect.objectContaining({
        contractType: 'Staged Modal Contract',
        signingTeam: 'LAL',
        startYear: 2026,
        signAndTrade: false,
        contractYears: 2,
        totalValue: 24_600_000,
        firstYearGuaranteed: true,
      })
    );
    expect(dispatchedContract?.totalValue).toBe(24_600_000);
    expect(dispatchedContract?.averageAnnualValue).toBe(12_300_000);
    expect(dispatchedContract?.base).toBe(12_000_000);
    expect(dispatchedContract?.salariesByYear).toEqual([
      expect.objectContaining({
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteedAmount: 12_000_000,
        optionType: null,
        optionUsed: null,
      }),
      expect.objectContaining({
        season: '2026-27',
        salary: 12_600_000,
        capHit: 12_600_000,
        guaranteedAmount: 12_600_000,
        optionType: null,
        optionUsed: null,
      }),
    ]);
  });

  it('reuses the same prepared standard-sign contract for vacuum legality validation and mutation compute', async () => {
    mutationMocks.computeWorldMutation.mockReturnValue({
      success: false,
      error: 'stop after capturing prepared standard-sign payload',
    });

    const { result } = renderActionsHarness({ worldId: null });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        buildStagedScalarSigningFixture()
      );
    });

    const validationArgs = validationMocks.validateSigning.mock.calls.at(-1)
      ?.[0] as FreeAgencyValidationArgs;
    const computeArgs = mutationMocks.computeWorldMutation.mock.calls.at(-1)
      ?.[0] as FreeAgencyComputeArgs;

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(validationArgs.contract).toBe(computeArgs.payload.contract);
    expect(validationArgs.signedUsing).toBe(computeArgs.payload.signedUsing);
    expect(computeArgs).toEqual(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        seasonId: '2025-26',
        payload: expect.objectContaining({
          playerId: 'player_1',
          signedUsing: 'Full MLE',
          contract: expect.objectContaining({
            contractType: 'Staged Modal Contract',
            signingTeam: 'LAL',
            startYear: 2026,
            contractYears: 2,
            totalValue: 24_600_000,
            firstYearGuaranteed: true,
          }),
        }),
      })
    );
  });

  it('blocks exception-backed signing in vacuum mode when canonical exception validation fails', async () => {
    validationMocks.validateSigning.mockReturnValue({
      valid: false,
      violations: [
        {
          message:
            'Cannot use Full MLE - no canonical MLE owner exists for this team.',
        },
      ],
      warnings: [],
    });

    const { result } = renderActionsHarness({
      worldId: null,
      initialTeam: {
        ...baseTeamFixture,
        exceptions: {},
      },
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(mutationMocks.computeWorldMutation).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('no canonical MLE owner exists')
    );
  });

  it('surfaces authoritative world-mode mutation failure when TPMLE ownership is missing', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: false,
      error:
        'Cannot use TPMLE - canonical TPMLE owner is missing.',
    });

    const { result } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: {
        ...baseTeamFixture,
        exceptions: {
          mle: {
            type: 'non-taxpayer',
            usedAmount: 0,
            remainingAmount: 12_900_000,
          },
        },
      },
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        {
          ...contractFixture,
          totalValue: 5_000_000,
          signedUsing: 'Taxpayer MLE',
        }
      );
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('canonical TPMLE owner is missing')
    );
  });

  it('fails closed (no success toast) when world mutation reports missing persistence truth', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: baseTeamFixture }],
      appliedToLocalState: true,
      persistedToWorld: false,
      writesSummary: {
        teamsPatched: 1,
        eventsWritten: 0,
        worldMetadataPatched: 0,
      },
      error: 'signFreeAgent did not complete required world writes.',
    });

    const { result } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('required world writes')
    );
  });

  it('blocks sign-and-trade in vacuum mode with explicit error (no silent no-op)', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    act(() => {
      result.current.actions.handleSignAndTrade(
        playerFixture,
        contractFixture,
        'BOS'
      );
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('requires an active world')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('normalizes sign-and-trade destination to canonical teamCode and keeps final contract truth in the action layer', async () => {
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) => {
      if (teamId === 'celtics') return 'BOS';
      return String(teamId || '').toUpperCase();
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: baseTeamFixture }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sat_1' },
    });

    const { result } = renderActionsHarness({ worldId: 'world_1' });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSignAndTrade(
        playerFixture,
        buildStagedScalarSigningFixture({
          startYear: 2028,
          contractType: 'Conflicting SAT Type',
        }),
        'celtics'
      );
    });

    const worldMutationArgs =
      mutationMocks.applyWorldMutation.mock.calls.at(-1)
        ?.[0] as FreeAgencyWorldMutationArgs;
    const dispatchedContract = worldMutationArgs?.payload?.contract;

    expect(actionResult).toEqual({ success: true });
    expect(worldMutationArgs).toEqual(
      expect.objectContaining({
        mutationType: 'signAndTrade',
        payload: expect.objectContaining({
          destinationTeamCode: 'BOS',
        }),
      })
    );
    expect(dispatchedContract).toEqual(
      expect.objectContaining({
        contractType: 'Sign & Trade',
        signingTeam: 'LAL',
        startYear: 2028,
        signAndTrade: true,
        contractYears: 2,
        totalValue: 24_600_000,
        firstYearGuaranteed: true,
      })
    );
    expect(dispatchedContract?.salariesByYear).toEqual([
      expect.objectContaining({
        season: '2027-28',
        salary: 12_000_000,
        capHit: 12_000_000,
      }),
      expect.objectContaining({
        season: '2028-29',
        salary: 12_600_000,
        capHit: 12_600_000,
      }),
    ]);
  });

  it('uses the same prepared SAT transaction payload for authoritative preflight and commit', async () => {
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) => {
      if (teamId === 'celtics') return 'BOS';
      return String(teamId || '').toUpperCase();
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: baseTeamFixture }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sat_shared_definition' },
    });

    const { result } = renderActionsHarness({ worldId: 'world_1' });
    const stagedContract = buildStagedScalarSigningFixture({
      startYear: 2028,
      contractType: 'Conflicting SAT Type',
    });

    await act(async () => {
      await result.current.actions.getSignAndTradePreflight(
        playerFixture,
        stagedContract,
        'celtics'
      );
    });

    await act(async () => {
      await result.current.actions.handleSignAndTrade(
        playerFixture,
        stagedContract,
        'celtics'
      );
    });

    const preflightArgs =
      mutationMocks.preflightSignAndTradeMutation.mock.calls.at(-1)
        ?.[0] as FreeAgencyPreflightArgs;
    const commitArgs = mutationMocks.applyWorldMutation.mock.calls.at(-1)
      ?.[0] as FreeAgencyWorldMutationArgs;

    expect(preflightArgs?.seasonId).toBe('2027-28');
    expect(commitArgs?.seasonId).toBe('2027-28');
    expect(commitArgs?.mutationType).toBe('signAndTrade');
    expect(commitArgs?.payload).toEqual(preflightArgs?.payload);
  });

  it('applies the active-team changedTeams snapshot immediately after successful sign-and-trade commit', async () => {
    const committedSourceTeam = buildSignAndTradeCommittedSourceTeamFixture(
      baseTeamFixture,
      {
        totals: {
          isHardCapped: false,
          totalCapAllocations: 108_000_000,
        },
      }
    );

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [
        { teamCode: 'LAL', team: committedSourceTeam },
        { teamCode: 'BOS', team: { teamCode: 'BOS', roster: ['player_1'] } },
      ],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sat_changed_team_sync' },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSignAndTrade(
        playerFixture,
        buildStagedScalarSigningFixture(),
        'BOS'
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(result.current.teamCapSheet).toEqual(committedSourceTeam);
    expect(result.current.teamCapSheet?.capHolds).toEqual([]);
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
  });

  it('reloads the active team when sign-and-trade changedTeams does not include the current team', async () => {
    const reloadedSourceTeam = buildSignAndTradeCommittedSourceTeamFixture(
      baseTeamFixture,
      {
        source: {
          type: 'world-snapshot',
          lastModifiedAt: '2026-03-31T00:00:00.000Z',
        },
      }
    );

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sat_reload_fallback' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(reloadedSourceTeam);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSignAndTrade(
        playerFixture,
        buildStagedScalarSigningFixture(),
        'BOS'
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(worldTeamDataMocks.loadWorldTeamData).toHaveBeenCalledWith(
      'world_1',
      'LAL'
    );
    expect(result.current.teamCapSheet).toEqual(reloadedSourceTeam);
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
  });

  it('fails closed when sign-and-trade persists but no committed active-team snapshot can be resolved', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sat_missing_snapshot' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(null);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;
    const beforeFreeAgents = result.current.freeAgents;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleSignAndTrade(
        playerFixture,
        buildStagedScalarSigningFixture(),
        'BOS'
      );
    });

    expect(actionResult).toEqual({
      success: false,
      message:
        'Sign-and-trade saved but the committed team snapshot could not be reloaded.',
    });
    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(result.current.freeAgents).toBe(beforeFreeAgents);
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Sign-and-trade saved but the committed team snapshot could not be reloaded.'
    );
  });

  it('renounce removes cap hold, updates totals, and requires persisted world writes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const rosterPlayers = Array.from({ length: 14 }, (_, index) =>
      createStandardRosterPlayer(index)
    );
    const initialTeam = {
      ...baseTeamFixture,
      roster: rosterPlayers.map((player) => player.id),
      players: rosterPlayers,
      capHolds: [
        {
          playerId: 'player_1',
          playerName: 'Test Player',
          amount: 9_000_000,
          season: '2025-26',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
      totals: {
        capHit: 120_000_000,
        capHolds: 9_000_000,
      },
    };
    const persistedRenounceTeam = {
      ...initialTeam,
      capHolds: [],
      totals: {
        capHit: 111_000_000,
        capHolds: 0,
      },
    };
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: persistedRenounceTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_renounce_1' },
    });

    const { result } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleRenounceRights(
        {
          id: 'player_1',
          player_id: 'player_1',
          name: 'Test Player',
          displayName: 'Test Player',
        }
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(result.current.teamCapSheet?.capHolds).toHaveLength(0);
    expect(result.current.teamCapSheet?.totals?.capHolds).toBe(0);
    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'renounceRights',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          playerId: 'player_1',
        }),
      })
    );
    confirmSpy.mockRestore();
  });

  it('stores an offer sheet in world mode and syncs the outgoing list from changedTeams', async () => {
    const updatedTeam = {
      ...baseTeamFixture,
      offerSheets: [buildPendingOfferSheetFixture()],
      incomingOfferSheets: [],
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        buildStagedScalarSigningFixture({
          salaries: [12_000_000, 12_960_000],
          exceptionType: 'Minimum',
          signedUsing: null,
          contractType: 'Conflicting Offer Sheet Type',
        })
      );
    });

    expect(actionResult).toEqual({ success: true });

    await waitFor(() => {
      const offerSheets = result.current.teamCapSheet?.offerSheets ?? [];
      expect(offerSheets).toHaveLength(1);
      expect(offerSheets[0].id).toBe('os_1');
    });

    const worldMutationArgs =
      mutationMocks.applyWorldMutation.mock.calls.at(-1)
        ?.[0] as FreeAgencyWorldMutationArgs;
    const dispatchedContract = worldMutationArgs?.payload?.contract;

    expect(worldMutationArgs).toEqual(
      expect.objectContaining({
        mutationType: 'storeOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          playerId: 'player_1',
        }),
      })
    );
    expect(dispatchedContract).toEqual(
      expect.objectContaining({
        contractType: 'Offer Sheet',
        signingTeam: 'LAL',
        startYear: 2026,
        signAndTrade: false,
        contractYears: 2,
        totalValue: 24_960_000,
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
      })
    );
    expect(dispatchedContract?.salariesByYear).toEqual([
      expect.objectContaining({
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
      }),
      expect.objectContaining({
        season: '2026-27',
        salary: 12_960_000,
        capHit: 12_960_000,
      }),
    ]);
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
  });

  it('delegates offer-sheet store aftermath through the state reload owner without roster republish', async () => {
    const updatedTeam = {
      ...baseTeamFixture,
      offerSheets: [buildPendingOfferSheetFixture()],
      incomingOfferSheets: [],
    };
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'applied' as const,
      committedWorldTeam: {
        committedTeam: updatedTeam,
        committedTeamSource: 'changedTeams' as const,
      },
    }));

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: baseTeamFixture,
      reloadActiveWorldTeamData,
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        buildStagedScalarSigningFixture({
          salaries: [12_000_000, 12_960_000],
          exceptionType: 'Minimum',
          signedUsing: null,
        })
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(reloadActiveWorldTeamData).toHaveBeenCalledWith({
      committedTeamSnapshot: updatedTeam,
      committedTeamSource: 'changedTeams',
      committedWorldMetadata: null,
      refreshRosterBundle: false,
    });
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('reloads committed offer-sheet truth when changedTeams does not include the active team', async () => {
    const reloadedTeam = {
      ...baseTeamFixture,
      offerSheets: [buildPendingOfferSheetFixture({ id: 'os_reload' })],
      incomingOfferSheets: [],
      source: {
        type: 'world-snapshot',
        lastModifiedAt: '2026-03-31T00:00:00.000Z',
      },
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'storeOfferSheet',
        offerSheetId: 'os_reload',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
      },
      event: { eventId: 'evt_store_offer_sheet_reload_fallback' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(reloadedTeam);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        buildStagedScalarSigningFixture({
          salaries: [12_000_000, 12_960_000],
          exceptionType: 'Minimum',
          signedUsing: null,
        })
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(worldTeamDataMocks.loadWorldTeamData).toHaveBeenCalledWith(
      'world_1',
      'LAL'
    );
    expect(result.current.teamCapSheet).toEqual(reloadedTeam);
    expect(result.current.teamCapSheet?.offerSheets).toEqual(
      reloadedTeam.offerSheets
    );
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('fails closed when offer-sheet persistence succeeds but no committed team snapshot can be resolved', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'storeOfferSheet',
        offerSheetId: 'os_missing_snapshot',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
      },
      event: { eventId: 'evt_store_offer_sheet_missing_snapshot' },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(null);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;
    const beforeFreeAgents = result.current.freeAgents;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        buildStagedScalarSigningFixture()
      );
    });

    expect(actionResult).toEqual({
      success: false,
      message:
        'Offer sheet saved but the committed team snapshot could not be reloaded.',
    });
    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(result.current.freeAgents).toBe(beforeFreeAgents);
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Offer sheet saved but the committed team snapshot could not be reloaded.'
    );
  });

  it('fails closed when the active-team snapshot does not contain the committed pending offer sheet', async () => {
    const changedTeamWithoutCommittedOfferSheet = {
      ...baseTeamFixture,
      offerSheets: [
        buildPendingOfferSheetFixture({
          id: 'os_other',
          playerId: 'other_player',
          dedupKey: 'os:world_1:LAL:other_player:2025-26',
        }),
      ],
      incomingOfferSheets: [],
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [
        {
          teamCode: 'LAL',
          team: changedTeamWithoutCommittedOfferSheet,
        },
      ],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'storeOfferSheet',
        offerSheetId: 'os_committed',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
      },
      event: { eventId: 'evt_store_offer_sheet_missing_identity' },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        buildStagedScalarSigningFixture()
      );
    });

    expect(actionResult).toEqual({
      success: false,
      message:
        'Offer sheet saved but the committed pending offer sheet could not be verified in the active team snapshot.',
    });
    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Offer sheet saved but the committed pending offer sheet could not be verified in the active team snapshot.'
    );
  });

  it('blocks offer-sheet storage in base mode (no authoritative write)', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    let actionResult: FreeAgencyMutationResult | undefined;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture,
        contractFixture
      );
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(actionResult?.message).toContain('active world');
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('active world')
    );
  });

  it('syncs matched incoming offer-sheet truth from changedTeams after match', async () => {
    const matchedTeam = buildIncomingOfferSheetLifecycleTeamFixture('MATCHED', {
      id: 'offer_match_1',
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: matchedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'matchOfferSheet',
        offerSheetId: 'offer_match_1',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
      },
    });

    const publishPostActionReceipt = vi.fn();
    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      publishPostActionReceipt,
    });

    act(() => {
      result.current.actions.handleMatchOfferSheet('BOS', 'offer_match_1');
    });

    await waitFor(() => {
      expect(
        result.current.teamCapSheet?.incomingOfferSheets?.[0]?.status
      ).toBe('MATCHED');
    });

    expect(
      mutationMocks.applyWorldMutation.mock.calls.at(-1)?.[0]
    ).toEqual(
      expect.objectContaining({
        mutationType: 'matchOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          offeringTeamCode: 'BOS',
          offerSheetId: 'offer_match_1',
        }),
      })
    );
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
    expect(publishPostActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'offerSheet',
        headline: 'Offer sheet matched',
        actionType: 'offer-sheet-match',
        message: expect.stringContaining(
          'incumbent team LAL matched the offer sheet'
        ),
      })
    );
  });

  it('syncs declined incoming offer-sheet truth from changedTeams after decline', async () => {
    const declinedTeam = buildIncomingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_decline_1',
      }
    );
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: declinedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'declineOfferSheet',
        offerSheetId: 'offer_decline_1',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
      },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    act(() => {
      result.current.actions.handleDeclineOfferSheet('BOS', 'offer_decline_1');
    });

    await waitFor(() => {
      expect(
        result.current.teamCapSheet?.incomingOfferSheets?.[0]?.status
      ).toBe('DECLINED');
    });

    expect(
      mutationMocks.applyWorldMutation.mock.calls.at(-1)?.[0]
    ).toEqual(
      expect.objectContaining({
        mutationType: 'declineOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          offeringTeamCode: 'BOS',
          offerSheetId: 'offer_decline_1',
        }),
      })
    );
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('syncs finalized incoming offer-sheet truth from changedTeams after matched finalization', async () => {
    const initialTeam = buildIncomingOfferSheetLifecycleTeamFixture('MATCHED', {
      id: 'offer_finalize_matched_1',
    });
    const finalizedTeam = {
      ...baseTeamFixture,
      offerSheets: [],
      incomingOfferSheets: [],
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: finalizedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'finalizeMatchedOfferSheet',
        offerSheetId: 'offer_finalize_matched_1',
        playerId: 'player_1',
        offeringTeam: 'BOS',
        homeTeam: 'LAL',
      },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
    });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        ...initialTeam.incomingOfferSheets[0],
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet?.incomingOfferSheets).toEqual([]);
    });

    expect(
      mutationMocks.applyWorldMutation.mock.calls.at(-1)?.[0]
    ).toEqual(
      expect.objectContaining({
        mutationType: 'finalizeMatchedOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          offeringTeamCode: 'BOS',
          offerSheetId: 'offer_finalize_matched_1',
        }),
      })
    );
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
  });

  it('delegates finalized offer-sheet reload through the state owner with roster republish enabled', async () => {
    const initialTeam = buildOutgoingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_finalize_state_reload_1',
      }
    );
    const finalizedTeam = {
      ...baseTeamFixture,
      offerSheets: [],
      incomingOfferSheets: [],
    };
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: finalizedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'finalizeDeclinedOfferSheet',
        offerSheetId: 'offer_finalize_state_reload_1',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
        playerId: 'player_1',
        offeringTeam: 'LAL',
        homeTeam: 'BOS',
      },
    });
    const reloadActiveWorldTeamData = vi.fn(async () => ({
      outcome: 'applied' as const,
      committedWorldTeam: {
        committedTeam: finalizedTeam,
        committedTeamSource: 'changedTeams' as const,
      },
    }));

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
      reloadActiveWorldTeamData,
    });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        ...initialTeam.offerSheets[0],
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(reloadActiveWorldTeamData).toHaveBeenCalledWith({
        committedTeamSnapshot: finalizedTeam,
        committedTeamSource: 'changedTeams',
        committedWorldMetadata: null,
        refreshRosterBundle: true,
      });
    });

    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('syncs finalized outgoing offer-sheet truth from changedTeams after declined finalization', async () => {
    const initialTeam = buildOutgoingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_finalize_declined_1',
      }
    );
    const finalizedTeam = {
      ...baseTeamFixture,
      offerSheets: [],
      incomingOfferSheets: [],
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: finalizedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'finalizeDeclinedOfferSheet',
        offerSheetId: 'offer_finalize_declined_1',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
        playerId: 'player_1',
        offeringTeam: 'LAL',
        homeTeam: 'BOS',
      },
    });

    const publishPostActionReceipt = vi.fn();
    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
      publishPostActionReceipt,
    });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        ...initialTeam.offerSheets[0],
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet?.offerSheets).toEqual([]);
    });

    expect(
      mutationMocks.applyWorldMutation.mock.calls.at(-1)?.[0]
    ).toEqual(
      expect.objectContaining({
        mutationType: 'finalizeDeclinedOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          offeringTeamCode: 'LAL',
          homeTeamCode: 'BOS',
          offerSheetId: 'offer_finalize_declined_1',
          dedupKey: 'os:world_1:LAL:player_1:2025-26',
          playerId: 'player_1',
          seasonKey: '2025-26',
        }),
      })
    );
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
    expect(publishPostActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'offerSheet',
        headline: 'Declined offer sheet finalized',
        actionType: 'offer-sheet-finalize-declined',
        message: expect.stringContaining(
          'offering team LAL adds the player'
        ),
      })
    );
  });

  it('keeps finalized lifecycle success when roster-index republish warns', async () => {
    const initialTeam = buildOutgoingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_finalize_refresh_warn_1',
      }
    );
    const finalizedTeam = {
      ...baseTeamFixture,
      offerSheets: [],
      incomingOfferSheets: [],
    };
    const refreshError = new Error('refresh unavailable');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: finalizedTeam }],
      changedPlayers: [],
      metadata: {
        type: 'finalizeDeclinedOfferSheet',
        offerSheetId: 'offer_finalize_refresh_warn_1',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
        playerId: 'player_1',
        offeringTeam: 'LAL',
        homeTeam: 'BOS',
      },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
    });
    refreshWorldRosterIndex.mockRejectedValue(refreshError);

    try {
      act(() => {
        result.current.actions.handleFinalizeOfferSheet({
          ...initialTeam.offerSheets[0],
        } as FreeAgencyOfferSheetActionInput);
      });

      await waitFor(() => {
        expect(result.current.teamCapSheet?.offerSheets).toEqual([]);
      });

      expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
      expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Architect][FreeAgency] Failed to refresh roster index after world reload plan:',
        refreshError
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('reloads committed incoming lifecycle truth when changedTeams omits the active team after match', async () => {
    const reloadedTeam = buildIncomingOfferSheetLifecycleTeamFixture('MATCHED', {
      id: 'offer_reload_match_1',
    });
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'matchOfferSheet',
        offerSheetId: 'offer_reload_match_1',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
      },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(reloadedTeam);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    act(() => {
      result.current.actions.handleMatchOfferSheet(
        'BOS',
        'offer_reload_match_1'
      );
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet).toEqual(reloadedTeam);
    });

    expect(worldTeamDataMocks.loadWorldTeamData).toHaveBeenCalledWith(
      'world_1',
      'LAL'
    );
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('reloads committed finalized outgoing lifecycle truth when changedTeams omits the active team', async () => {
    const initialTeam = buildOutgoingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_reload_finalize_declined_1',
      }
    );
    const reloadedTeam = {
      ...baseTeamFixture,
      offerSheets: [],
      incomingOfferSheets: [],
      source: {
        type: 'world-snapshot',
        lastModifiedAt: '2026-04-01T00:00:00.000Z',
      },
    };
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'finalizeDeclinedOfferSheet',
        offerSheetId: 'offer_reload_finalize_declined_1',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
        playerId: 'player_1',
        offeringTeam: 'LAL',
        homeTeam: 'BOS',
      },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(reloadedTeam);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
    });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        ...initialTeam.offerSheets[0],
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet).toEqual(reloadedTeam);
    });

    expect(worldTeamDataMocks.loadWorldTeamData).toHaveBeenCalledWith(
      'world_1',
      'LAL'
    );
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
  });

  it('fails closed when lifecycle persistence succeeds but no committed active-team snapshot can be resolved', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'BOS', team: { teamCode: 'BOS' } }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'matchOfferSheet',
        offerSheetId: 'offer_missing_snapshot_1',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
      },
    });
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(null);

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;

    act(() => {
      result.current.actions.handleMatchOfferSheet(
        'BOS',
        'offer_missing_snapshot_1'
      );
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Offer sheet lifecycle action saved but the committed team snapshot could not be reloaded.'
      );
    });

    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it('fails closed when matched lifecycle truth cannot be verified in the active team snapshot', async () => {
    const changedTeamWithoutMatchedOfferSheet =
      buildIncomingOfferSheetLifecycleTeamFixture('PENDING_MATCH', {
        id: 'offer_match_verify_1',
      });

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [
        {
          teamCode: 'LAL',
          team: changedTeamWithoutMatchedOfferSheet,
        },
      ],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 0,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'matchOfferSheet',
        offerSheetId: 'offer_match_verify_1',
        offeringTeamCode: 'BOS',
        homeTeamCode: 'LAL',
      },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;

    act(() => {
      result.current.actions.handleMatchOfferSheet('BOS', 'offer_match_verify_1');
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Offer sheet lifecycle action saved but the committed lifecycle state could not be verified in the active team snapshot.'
      );
    });

    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('fails closed when finalized declined lifecycle truth still shows the outgoing offer sheet', async () => {
    const initialTeam = buildOutgoingOfferSheetLifecycleTeamFixture(
      'DECLINED',
      {
        id: 'offer_finalize_verify_1',
      }
    );
    const changedTeamWithLingeringOfferSheet =
      buildOutgoingOfferSheetLifecycleTeamFixture('DECLINED', {
        id: 'offer_finalize_verify_1',
      });

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [
        {
          teamCode: 'LAL',
          team: changedTeamWithLingeringOfferSheet,
        },
      ],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      metadata: {
        type: 'finalizeDeclinedOfferSheet',
        offerSheetId: 'offer_finalize_verify_1',
        dedupKey: 'os:world_1:LAL:player_1:2025-26',
        playerId: 'player_1',
        offeringTeam: 'LAL',
        homeTeam: 'BOS',
      },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam,
    });
    const beforeTeamSnapshot = result.current.teamCapSheet;

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        ...initialTeam.offerSheets[0],
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Offer sheet lifecycle action saved but the committed lifecycle state could not be verified in the active team snapshot.'
      );
    });

    expect(result.current.teamCapSheet).toBe(beforeTeamSnapshot);
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(refreshWorldRosterIndex).not.toHaveBeenCalled();
  });

  it('keeps match offer-sheet lifecycle handling fail-closed in base mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    act(() => {
      result.current.actions.handleMatchOfferSheet('BOS', 'offer_1');
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('active world')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('keeps finalize offer-sheet lifecycle handling fail-closed in base mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        id: 'offer_1',
        status: 'MATCHED',
        homeTeamCode: 'LAL',
        offeringTeamCode: 'BOS',
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('active world')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('fails closed when finalize role/status truth does not align with the active team', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet({
        id: 'offer_mismatch_1',
        status: 'MATCHED',
        homeTeamCode: 'BOS',
        offeringTeamCode: 'NYK',
      } as FreeAgencyOfferSheetActionInput);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('status/team mismatch')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('surfaces clear error when finalize is invoked without offer sheet args', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet(undefined);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('offer sheet data is missing')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('fails closed in base-state apply when authoritative validation is illegal', async () => {
    const initialTeamSnapshot = baseTeamFixture;
    const otherTeam = {
      ...baseTeamFixture,
      teamCode: 'BOS',
      id: 'BOS',
      teamName: 'Boston Celtics',
      roster: ['incoming_1'],
      players: [
        {
          id: 'incoming_1',
          player_id: 'incoming_1',
          name: 'Incoming Player',
          contract: {
            salariesByYear: [
              { season: '2025-26', salary: 8_000_000, capHit: 8_000_000 },
            ],
          },
        },
      ],
    };

    worldTeamDataMocks.loadWorldTeamData.mockImplementation(
      async (_worldId: string | null, teamCode: string) =>
        teamCode === 'BOS' ? otherTeam : initialTeamSnapshot
    );

    mutationMocks.computeWorldMutation.mockReturnValue({
      success: true,
      teamUpdates: [
        {
          teamCode: 'LAL',
          team: { ...initialTeamSnapshot, marker: 'should_not_apply' },
        },
      ],
      _validatedTradeContext: {
        _isValidatedTradeContext: true,
        legal: false,
        error: 'Trade blocked by authoritative validation',
      },
    });

    const { result } = renderActionsHarness({
      worldId: null,
      initialTeam: initialTeamSnapshot,
    });
    const beforeApplyTeam = result.current.teamCapSheet;

    const tradeData = [
      {
        teamId: 'LAL',
        outgoingPlayers: [
          {
            id: 'player_1',
            player_id: 'player_1',
            name: 'Test Player',
          },
        ],
        incomingPlayers: [
          {
            id: 'incoming_1',
            player_id: 'incoming_1',
            name: 'Incoming Player',
            contract: {
              salariesByYear: [
                { season: '2025-26', salary: 8_000_000, capHit: 8_000_000 },
              ],
            },
          },
        ],
        outgoingEntitlements: [],
        incomingEntitlements: [],
      },
      {
        teamId: 'BOS',
        outgoingPlayers: [
          {
            id: 'incoming_1',
            player_id: 'incoming_1',
            name: 'Incoming Player',
          },
        ],
        incomingPlayers: [
          {
            id: 'player_1',
            player_id: 'player_1',
            name: 'Test Player',
          },
        ],
        outgoingEntitlements: [],
        incomingEntitlements: [],
      },
    ];

    let caughtError: unknown = null;
    await act(async () => {
      try {
        await result.current.actions.applyTradeToCapSheet(
          tradeData as FreeAgencyTradeInput
        );
      } catch (error: unknown) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeTruthy();
    const caughtErrorMessage =
      (caughtError as { message?: string } | null)?.message || '';
    expect(caughtErrorMessage).toContain('Trade blocked by authoritative validation');
    expect(mutationMocks.computeWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'executeTrade',
        payload: expect.objectContaining({
          tradeCtx: expect.objectContaining({
            source: 'tradeMachine',
            worldId: null,
          }),
        }),
      })
    );
    expect(result.current.teamCapSheet).toBe(beforeApplyTeam);
    expect(
      (result.current.teamCapSheet as FreeAgencyTeamCapSheet & {
        marker?: unknown;
      }).marker
    ).toBeUndefined();
  });

  it('routes world-mode trade apply through the authoritative mutation lane and syncs the committed active-team snapshot', async () => {
    const committedTradeTeam = {
      ...baseTeamFixture,
      roster: ['incoming_1'],
      players: [
        {
          id: 'incoming_1',
          player_id: 'incoming_1',
          name: 'Incoming Player',
          contract: {
            salariesByYear: [
              { season: '2025-26', salary: 8_000_000, capHit: 8_000_000 },
            ],
          },
        },
      ],
      capHolds: [],
      source: {
        type: 'changed-teams',
        lastModifiedAt: '2026-04-01T00:00:00.000Z',
      },
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [
        { teamCode: 'LAL', team: committedTradeTeam },
        { teamCode: 'BOS', team: { teamCode: 'BOS', roster: ['player_1'] } },
      ],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 2,
        playersPatched: 2,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_trade_world_commit' },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
      initialTeam: baseTeamFixture,
    });

    const tradeData = [
      {
        teamId: 'LAL',
        outgoingPlayers: [
          {
            id: 'player_1',
            player_id: 'player_1',
            name: 'Test Player',
          },
        ],
        incomingPlayers: [
          {
            id: 'incoming_1',
            player_id: 'incoming_1',
            name: 'Incoming Player',
            contract: {
              salariesByYear: [
                { season: '2025-26', salary: 8_000_000, capHit: 8_000_000 },
              ],
            },
          },
        ],
        outgoingEntitlements: [],
        incomingEntitlements: [],
      },
      {
        teamId: 'BOS',
        outgoingPlayers: [
          {
            id: 'incoming_1',
            player_id: 'incoming_1',
            name: 'Incoming Player',
          },
        ],
        incomingPlayers: [
          {
            id: 'player_1',
            player_id: 'player_1',
            name: 'Test Player',
          },
        ],
        outgoingEntitlements: [],
        incomingEntitlements: [],
      },
    ];

    await act(async () => {
      await result.current.actions.applyTradeToCapSheet(
        tradeData as FreeAgencyTradeInput
      );
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'executeTrade',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teams: expect.any(Array),
          tradeCtx: expect.objectContaining({
            source: 'tradeMachine',
            worldId: 'world_1',
            yearKey: 2026,
          }),
        }),
      })
    );
    expect(mutationMocks.computeWorldMutation).not.toHaveBeenCalled();
    expect(worldTeamDataMocks.loadWorldTeamData).not.toHaveBeenCalled();
    expect(result.current.teamCapSheet).toEqual(committedTradeTeam);
    expect(refreshWorldRosterIndex).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
  });

  it('returns a conservative blocked SAT preflight result in base mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    let preflightResult: FreeAgencyOfferSheetPreflight | undefined;
    await act(async () => {
      preflightResult = await result.current.actions.getSignAndTradePreflight(
        playerFixture,
        contractFixture,
        'BOS'
      );
    });

    expect(preflightResult).toEqual({
      status: 'blocked',
      reasons: ['Sign-and-trade requires an active world to preview.'],
      warnings: [],
      source: 'authoritative-preflight',
    });
    expect(mutationMocks.preflightSignAndTradeMutation).not.toHaveBeenCalled();
  });

  it('returns a conservative blocked offer-sheet preflight result in base mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    let preflightResult: FreeAgencyOfferSheetPreflight | undefined;
    await act(async () => {
      preflightResult = await result.current.actions.getOfferSheetPreflight(
        playerFixture,
        contractFixture
      );
    });

    expect(preflightResult).toEqual({
      status: 'blocked',
      reasons: ['Offer sheet actions require an active world to preview.'],
      warnings: [],
      source: 'authoritative-preflight',
    });
    expect(mutationMocks.preflightOfferSheetMutation).not.toHaveBeenCalled();
  });

  it('canonicalizes SAT preflight inputs and ignores conflicting prebuilt signing rows', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.getSignAndTradePreflight(
        playerFixture,
        buildStagedScalarSigningFixture({
          startYear: 2028,
          contractType: 'Conflicting SAT Preflight Type',
        }),
        'bos'
      );
    });

    expect(mutationMocks.preflightSignAndTradeMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world_1',
        seasonId: '2027-28',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          destinationTeamCode: 'BOS',
          playerId: 'player_1',
          signAndTrade: true,
          signedUsing: 'Full MLE',
          contract: expect.objectContaining({
            contractType: 'Sign & Trade',
            signingTeam: 'LAL',
            startYear: 2028,
            contractYears: 2,
            totalValue: 24_600_000,
            firstYearGuaranteed: true,
            salariesByYear: [
              expect.objectContaining({
                season: '2027-28',
                salary: 12_000_000,
                capHit: 12_000_000,
              }),
              expect.objectContaining({
                season: '2028-29',
                salary: 12_600_000,
                capHit: 12_600_000,
              }),
            ],
          }),
        }),
      })
    );
  });

  it('canonicalizes offer-sheet preflight inputs and ignores conflicting prebuilt signing rows', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.getOfferSheetPreflight(
        playerFixture,
        buildStagedScalarSigningFixture({
          salaries: [12_000_000, 12_960_000],
          exceptionType: 'Minimum',
          signedUsing: null,
          contractType: 'Conflicting Offer Sheet Preflight Type',
        })
      );
    });

    expect(mutationMocks.preflightOfferSheetMutation).toHaveBeenCalledWith({
      worldId: 'world_1',
      seasonId: '2025-26',
      offeringTeamCode: 'LAL',
      playerId: 'player_1',
      contract: expect.objectContaining({
        contractType: 'Offer Sheet',
        signingTeam: 'LAL',
        startYear: 2026,
        contractYears: 2,
        totalValue: 24_960_000,
        firstYearGuaranteed: true,
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        salariesByYear: [
          expect.objectContaining({
            season: '2025-26',
            salary: 12_000_000,
            capHit: 12_000_000,
          }),
          expect.objectContaining({
            season: '2026-27',
            salary: 12_960_000,
            capHit: 12_960_000,
          }),
        ],
      }),
    });
  });
});
