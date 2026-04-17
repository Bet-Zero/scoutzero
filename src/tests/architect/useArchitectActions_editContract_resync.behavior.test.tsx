// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

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
}));

const capTotalsMocks = vi.hoisted(() => ({
  computeTeamCapTotals: vi.fn(),
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
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: capTotalsMocks.computeTeamCapTotals,
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const TEST_PLAYER = {
  id: 'p1',
  player_id: 'p1',
  name: 'Test Player',
  displayName: 'Test Player',
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
  },
};

const BASE_TEAM = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: ['p1'],
  players: [TEST_PLAYER],
  deadCap: [],
  capHolds: [],
  exceptions: {},
  totals: {},
};

function sumDeadCapForSeason(team: any, season = '2025-26') {
  return (team?.deadCap || []).reduce((sum: number, item: any) => {
    const match = (item?.amountByYear || []).find((entry: any) => entry?.season === season);
    return sum + (match?.amount || 0);
  }, 0);
}

function makeTotals(team: any) {
  const deadMoneyTotal = sumDeadCapForSeason(team);
  return {
    yearKey: 2026,
    playersTotal: 0,
    deadMoneyTotal,
    capHoldsTotal: 0,
    incompleteChargesTotal: 0,
    totalCapAllocations: deadMoneyTotal,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 180_000_000,
    secondApron: 190_000_000,
    deltas: {
      vsCap: deadMoneyTotal - 140_000_000,
      vsLuxuryTax: deadMoneyTotal - 170_000_000,
      vsFirstApron: deadMoneyTotal - 180_000_000,
      vsSecondApron: deadMoneyTotal - 190_000_000,
    },
  };
}

function renderActionsHarness(worldId: string | null) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(BASE_TEAM);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [freeAgents, setFreeAgents] = useState<any[]>([]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] = useState<any>(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: 'user_1',
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
        p1: TEST_PLAYER,
        [TEST_PLAYER.name]: TEST_PLAYER,
      },
      modals: {
        openContractModal: vi.fn(),
        closeContractModal: vi.fn(),
      },
      worldId,
      seasonId: '2025-26',
    });

    return { actions, teamCapSheet };
  });

  return { result, refreshWorldRosterIndex };
}

describe('useArchitectActions edit-contract world resync behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(BASE_TEAM);
    capTotalsMocks.computeTeamCapTotals.mockImplementation((team: any) =>
      makeTotals(team)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards buyout amount, applies optimistic totals, then resyncs to authoritative changedTeams', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let resolveMutation: ((value: any) => void) | null = null;
    mutationMocks.applyWorldMutation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        })
    );

    const { result, refreshWorldRosterIndex } = renderActionsHarness('world_1');

    let actionResultPromise: Promise<any>;
    act(() => {
      actionResultPromise = result.current.actions.handleWaiveContract(
        TEST_PLAYER as any,
        {
          stretch: false,
          buyout: true,
          buyoutAmount: 5_000_000,
        }
      );
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet.players).toHaveLength(0);
    });

    // Optimistic state: dead cap should reflect 12M - 5M buyout reduction = 7M.
    expect(sumDeadCapForSeason(result.current.teamCapSheet)).toBe(7_000_000);
    expect(makeTotals(result.current.teamCapSheet).deadMoneyTotal).toBe(7_000_000);

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'waivePlayer',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          playerId: 'p1',
          buyout: true,
          buyoutAmount: 5_000_000,
        }),
      })
    );

    const authoritativeTeam = {
      ...BASE_TEAM,
      roster: [],
      players: [],
      deadCap: [
        {
          playerId: 'p1',
          playerName: 'Test Player',
          originalSalary: 12_000_000,
          amountByYear: [{ season: '2025-26', amount: 6_000_000 }],
          waiveDate: '2026-03-01T00:00:00.000Z',
        },
      ],
      totals: { source: 'authoritative' },
    };

    act(() => {
      resolveMutation?.({
        success: true,
        changedTeams: [{ teamCode: 'LAL', team: authoritativeTeam }],
        event: { operationId: 'auth_waive_1' },
      });
    });

    const actionResult = await actionResultPromise!;
    expect(actionResult).toEqual({ success: true });

    await waitFor(() => {
      expect(sumDeadCapForSeason(result.current.teamCapSheet)).toBe(6_000_000);
    });

    // Authoritative resync state should now drive totals.
    expect(makeTotals(result.current.teamCapSheet).deadMoneyTotal).toBe(6_000_000);
    expect(refreshWorldRosterIndex).toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });
});
