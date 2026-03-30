import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
  computeWorldMutation: vi.fn(),
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
  computeWorldMutation: mutationMocks.computeWorldMutation,
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

const playerFixture = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'LAL',
  contract: {
    salariesByYear: [],
  },
};

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
};

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
};

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
}: {
  worldId: string | null;
  userId?: string | null;
  initialTeam?: any;
}) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(initialTeam);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [freeAgents, setFreeAgents] = useState<any[]>([playerFixture]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] = useState<any>(null);

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
        setFreeAgents,
        startSave,
        finishSave,
        setOffseasonRun,
        setOffseasonSummary,
        refreshWorldRosterIndex,
      },
      playersMap: {
        [playerFixture.id]: playerFixture,
        [playerFixture.player_id]: playerFixture,
        [playerFixture.name]: playerFixture,
      },
      modals,
      worldId,
      seasonId: '2025-26',
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

  it('applies canonical changedTeams snapshot immediately after world-mode sign', async () => {
    const updatedTeam = {
      ...baseTeamFixture,
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
    };

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

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture as any,
        contractFixture as any
      );
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet.capHolds).toHaveLength(0);
      expect(result.current.teamCapSheet.totals?.isHardCapped).toBe(true);
      expect(result.current.teamCapSheet.totals?.hardCapReason).toBe(
        'Triggered by Non-Taxpayer MLE'
      );
      expect(result.current.teamCapSheet.hardCapReason).toBe(
        'Triggered by Non-Taxpayer MLE'
      );
      expect(result.current.teamCapSheet.exceptions?.mle?.usedAmount).toBe(
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

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture as any,
        contractFixture as any
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
        playerFixture as any,
        contractFixture as any,
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

  it('normalizes sign-and-trade destination to canonical teamCode before dispatch', async () => {
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

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleSignAndTrade(
        playerFixture as any,
        contractFixture as any,
        'celtics'
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signAndTrade',
        payload: expect.objectContaining({
          destinationTeamCode: 'BOS',
        }),
      })
    );
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          destinationTeamCode: 'celtics',
        }),
      })
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

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleRenounceRights(
        {
          id: 'player_1',
          player_id: 'player_1',
          name: 'Test Player',
          displayName: 'Test Player',
        } as any
      );
    });

    expect(actionResult).toEqual({ success: true });
    expect(result.current.teamCapSheet.capHolds).toHaveLength(0);
    expect(result.current.teamCapSheet.totals.capHolds).toBe(0);
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
      offerSheets: [
        {
          id: 'os_1',
          playerId: 'player_1',
          playerName: 'Test Player',
          offeringTeamCode: 'LAL',
          homeTeamCode: 'BOS',
          status: 'PENDING_MATCH',
          contractYears: 4,
          totalValue: 12_000_000,
        },
      ],
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

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture as any,
        contractFixture as any
      );
    });

    expect(actionResult).toEqual({ success: true });

    await waitFor(() => {
      expect(result.current.teamCapSheet.offerSheets).toHaveLength(1);
      expect(result.current.teamCapSheet.offerSheets[0].id).toBe('os_1');
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'storeOfferSheet',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          playerId: 'player_1',
          contract: expect.objectContaining({
            contractType: 'Offer Sheet',
            rfaOfferSheet: true,
            rfaOfferSheetOnly: true,
            rfaOfferSheetStatus: 'PENDING_MATCH',
          }),
        }),
      })
    );
    expect(refreshWorldRosterIndex).toHaveBeenCalled();
  });

  it('blocks offer-sheet storage in base mode (no authoritative write)', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    let actionResult: any;
    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        playerFixture as any,
        contractFixture as any
      );
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(actionResult.message).toContain('active world');
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('active world')
    );
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

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.actions.applyTradeToCapSheet(tradeData as any);
      } catch (error: any) {
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
        worldId: null,
      })
    );
    expect(result.current.teamCapSheet).toBe(beforeApplyTeam);
    expect((result.current.teamCapSheet as any).marker).toBeUndefined();
  });

  it('returns a conservative blocked SAT preflight result in base mode', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    let preflightResult: any;
    await act(async () => {
      preflightResult = await result.current.actions.getSignAndTradePreflight(
        playerFixture as any,
        contractFixture as any,
        'BOS'
      );
    });

    expect(preflightResult).toEqual({
      status: 'blocked',
      reasons: ['Sign-and-trade requires an active world to commit.'],
      warnings: [],
      source: 'authoritative-preflight',
    });
    expect(mutationMocks.preflightSignAndTradeMutation).not.toHaveBeenCalled();
  });

  it('canonicalizes SAT preflight inputs and delegates to the authoritative preflight helper', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.getSignAndTradePreflight(
        playerFixture as any,
        {
          years: 2,
          salaries: [12_000_000, 12_600_000],
          exceptionType: 'Full MLE',
        } as any,
        'bos'
      );
    });

    expect(mutationMocks.preflightSignAndTradeMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world_1',
        seasonId: '2025-26',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          destinationTeamCode: 'BOS',
          playerId: 'player_1',
          signAndTrade: true,
          signedUsing: 'Full MLE',
          contract: expect.objectContaining({
            contractType: 'Sign & Trade',
            signingTeam: 'LAL',
            salariesByYear: [
              expect.objectContaining({
                season: '2025-26',
                salary: 12_000_000,
                capHit: 12_000_000,
              }),
              expect.objectContaining({
                season: '2026-27',
                salary: 12_600_000,
                capHit: 12_600_000,
              }),
            ],
          }),
        }),
      })
    );
  });

  it('canonicalizes offer-sheet preflight inputs and delegates to the authoritative preflight helper', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.getOfferSheetPreflight(playerFixture as any, {
        years: 2,
        salaries: [12_000_000, 12_960_000],
        exceptionType: 'Minimum',
      } as any);
    });

    expect(mutationMocks.preflightOfferSheetMutation).toHaveBeenCalledWith({
      worldId: 'world_1',
      seasonId: '2025-26',
      offeringTeamCode: 'LAL',
      playerId: 'player_1',
      contract: expect.objectContaining({
        contractType: 'Offer Sheet',
        signingTeam: 'LAL',
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
