/**
 * FILE: src/tests/architect/capSheet_toast_dedupe.behavior.test.ts
 * PURPOSE: Verify Cap Sheet save failures emit exactly one user-facing toast (E2 Task B).
 * OWNERSHIP: Feature: architect/cap-sheet (E2)
 *
 * HISTORY:
 *  - 2026-02-28: Created for TM_CAP_SHEET_E2 Task B verification
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import {
  useArchitectActions,
  type UseArchitectActionsParams,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';

type SetterValue<TSetter> = TSetter extends Dispatch<SetStateAction<infer TValue>>
  ? TValue
  : never;

type HarnessTeamCapSheet = NonNullable<
  UseArchitectActionsParams['state']['teamCapSheet']
>;
type HarnessSelectedPlayer = SetterValue<
  UseArchitectActionsParams['state']['setSelectedPlayer']
>;
type HarnessFreeAgents = SetterValue<
  UseArchitectActionsParams['state']['setFreeAgents']
>;
type HarnessOffseasonSummary = SetterValue<
  UseArchitectActionsParams['state']['setOffseasonSummary']
>;

// Create hoisted mocks for counting calls
const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

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

const capTotalsMocks = vi.hoisted(() => {
  const computeTeamCapTotals = vi.fn((_team?: unknown, _year?: number) => ({
    totalCapAllocations: 150000000,
    salaryCap: 141000000,
    playersTotal: 100000000,
    capHoldsTotal: 50000000,
    deadMoneyTotal: 0,
    incompleteChargesTotal: 0,
    capSpace: -9000000,
    yearKey: 2026,
    _meta: {},
  }));

  const synchronizeTeamTotalsSnapshot = vi.fn(
    (team: Record<string, unknown> | null | undefined, selectedYear: number) => {
      if (!team || !Number.isFinite(selectedYear)) {
        return team;
      }

      return {
        ...team,
        totals: {
          ...((team.totals as Record<string, unknown> | undefined) || {}),
          ...computeTeamCapTotals(team, Number(selectedYear)),
          capHit: 150000000,
          totalSalary: 150000000,
          teamSalary: 150000000,
          currentCapHit: 150000000,
        },
      };
    }
  );

  return {
    computeTeamCapTotals,
    synchronizeTeamTotalsSnapshot,
  };
});

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
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

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ violations: [], warnings: [] })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: vi.fn().mockResolvedValue(null),
  resolveTeamCode: vi.fn((teamId: string) =>
    String(teamId || '').toUpperCase()
  ),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: '1.0.0',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  computeTeamCapTotals: capTotalsMocks.computeTeamCapTotals,
  synchronizeTeamTotalsSnapshot: capTotalsMocks.synchronizeTeamTotalsSnapshot,
}));

const baseTeamFixture: HarnessTeamCapSheet = {
  teamCode: 'BOS',
  teamName: 'Boston Celtics',
  roster: [],
  players: [],
  capHolds: [],
  deadCap: [],
  exceptions: {},
  totals: {
    isHardCapped: false,
  },
};

const playerFixture = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'BOS',
  previousSalary: 0,
  birdRights: 'bird',
  freeAgentType: 'UFA' as const,
  contract: { salariesByYear: [] },
};

function renderActionsHarness({
  worldId,
  userId = 'user_1',
  initialTeam = baseTeamFixture,
}: {
  worldId: string | null;
  userId?: string | null;
  initialTeam?: HarnessTeamCapSheet;
}) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  return renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] =
      useState<UseArchitectActionsParams['state']['teamCapSheet']>(initialTeam);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] =
      useState<HarnessSelectedPlayer>(null);
    const [freeAgents, setFreeAgents] = useState<HarnessFreeAgents>([
      playerFixture,
    ]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] =
      useState<HarnessOffseasonSummary>(null);

    const actions = useArchitectActions({
      teamId: 'BOS',
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

    return { actions, teamCapSheet: teamCapSheet ?? initialTeam };
  });
}

describe('Cap Sheet Toast Deduplication (E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits exactly one toast.error when world mutation fails (via applyWorldMutation failure)', async () => {
    // Simulate world mutation failure
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: false,
      error: 'Simulated world save failure',
    });

    const { result } = renderActionsHarness({
      worldId: 'test-world-123',
      userId: 'user_1',
    });

    await act(async () => {
      // Call handleSetDeadCap which uses applyCapAuditedTeamMutation -> persistMutation
      const savePromise = result.current.actions.handleSetDeadCap([
        {
          playerId: 'dead_money_test',
          playerName: 'Dead Money Entry',
          amountByYear: [{ season: '2025-26', amount: 5000000 }],
        },
      ]);

      // Wait for the promise to complete
      await savePromise;
    });

    // The key assertion: exactly ONE toast.error call, not two
    // Before E2 fix: persistMutation toasts + reportMutationError (via onFailure) toasts = 2
    // After E2 fix: only reportMutationError toasts = 1
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Simulated world save failure')
    );
  });

  it('emits exactly one toast.error when world mutation throws exception', async () => {
    // Simulate world mutation throwing
    mutationMocks.applyWorldMutation.mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderActionsHarness({
      worldId: 'test-world-123',
      userId: 'user_1',
    });

    await act(async () => {
      const savePromise = result.current.actions.handleSetExceptions({
        mle: { enabled: true, totalAmount: 12800000, usedAmount: 0 },
      });

      await savePromise;
    });

    // Key assertion: exactly ONE toast.error call
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });

  it('still emits toast.success on successful world mutation', async () => {
    // Simulate successful world mutation
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [],
    });

    const { result } = renderActionsHarness({
      worldId: 'test-world-123',
      userId: 'user_1',
    });

    await act(async () => {
      const savePromise = result.current.actions.handleSetDeadCap([]);
      await savePromise;
    });

    // Success toast should still appear
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
    // No error toast
    expect(toastMocks.error).not.toHaveBeenCalled();
  });
});
