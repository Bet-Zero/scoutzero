// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import {
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
  clearLocalCapAuditEvents,
  getLocalCapAuditLifecycleContract,
  readLocalCapAuditEvents,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import {
  isOptimisticLockHeld,
  resetOptimisticLocksForTests,
} from '@/features/architect/GMDashboard/hooks/optimisticMutationLock';

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

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  validatePostStateCapLegality: () => ({ valid: true, violations: [], warnings: [] }),
  POST_STATE_CAP_VALIDATOR_VERSION: 1,
}));

const LOCK_SCOPE_KEY = 'architect_world_cap_mutation_lock:world_1';

const worldTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  players: [],
  capHolds: [],
  deadCap: [],
  exceptions: {},
  totals: {
    isHardCapped: false,
  },
};

function makeTotals(overrides: Record<string, unknown> = {}) {
  return {
    yearKey: 2026,
    playersTotal: 12_000_000,
    deadMoneyTotal: 0,
    capHoldsTotal: 0,
    incompleteChargesTotal: 13_000_000,
    totalCapAllocations: 25_000_000,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 180_000_000,
    secondApron: 190_000_000,
    ...overrides,
  };
}

function renderActionsHarness(
  worldId: string | null,
  initialTeam: any = worldTeamFixture
) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(initialTeam);
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
      playersMap: {},
      modals: {
        openContractModal: vi.fn(),
        closeContractModal: vi.fn(),
      },
      worldId,
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet,
    };
  });

  return { result };
}

describe('world optimistic cap mutation serialization (block mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation(
      (teamId: string) => String(teamId || '').toUpperCase()
    );
    capTotalsMocks.computeTeamCapTotals.mockImplementation(() => makeTotals());
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      event: { operationId: 'auth_default' },
    });

    clearLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    resetOptimisticLocksForTests();
  });

  afterEach(() => {
    clearLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    resetOptimisticLocksForTests();
  });

  it('blocks a second optimistic mutation while the first authoritative persist is in-flight', async () => {
    let resolveFirstPersist:
      | ((value: { success: boolean; event: { operationId: string } }) => void)
      | null = null;

    mutationMocks.applyWorldMutation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstPersist = resolve as (
            value: { success: boolean; event: { operationId: string } }
          ) => void;
        })
    );

    const { result } = renderActionsHarness('world_1');

    act(() => {
      result.current.actions.handleSetDeadCap([
        {
          id: 'dead_1',
          amountByYear: [{ season: '2025-26', amount: 3_000_000 }],
        },
      ]);
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledTimes(1);
    expect(isOptimisticLockHeld(LOCK_SCOPE_KEY)).toBe(true);
    expect((result.current.teamCapSheet.deadCap || []).length).toBe(1);
    expect(result.current.teamCapSheet.totals?.yearKey).toBe(2026);
    expect(result.current.teamCapSheet.totals?.capHit).toBe(
      result.current.teamCapSheet.totals?.totalCapAllocations
    );

    act(() => {
      result.current.actions.handleSetExceptions({
        mle: {
          type: 'non-taxpayer',
          remainingAmount: 9_000_000,
        },
      });
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledTimes(1);
    expect(result.current.teamCapSheet.exceptions).toEqual({});
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Another cap mutation is still saving')
    );

    const previewEventsWhileLocked = readLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    expect(previewEventsWhileLocked).toHaveLength(1);
    const [previewEventWhileLocked] = previewEventsWhileLocked;
    expect(previewEventWhileLocked).toBeDefined();
    expect(previewEventWhileLocked?.mutationType).toBe('setDeadCap');
    expect(previewEventWhileLocked?.preview).toBe(true);
    expect(previewEventWhileLocked?.authoritativeEventLinked).toBe(false);
    expect(previewEventWhileLocked?.localAuditLifecycleState).toBe(
      'optimistic-preview-pending'
    );
    expect(
      getLocalCapAuditLifecycleContract(previewEventWhileLocked!)
    ).toMatchObject({
      lifecycleState: 'optimistic-preview-pending',
      localOutcome: 'preview-applied-awaiting-persist',
      authoritativeLinkState: 'pending',
      representsCommittedWorldTruth: false,
    });
    expect(mutationMocks.applyWorldMutation.mock.calls[0]?.[0]).toMatchObject({
      mutationType: 'setDeadCap',
      operationId: previewEventWhileLocked?.operationId,
    });

    act(() => {
      resolveFirstPersist?.({
        success: true,
        event: { operationId: 'auth_op_1' },
      });
    });

    await waitFor(() => {
      expect(isOptimisticLockHeld(LOCK_SCOPE_KEY)).toBe(false);
    });

    await waitFor(() => {
      const previewEvents = readLocalCapAuditEvents({
        storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
      });
      expect(previewEvents).toHaveLength(1);
      expect(previewEvents[0]?.operationId).toBe(
        previewEventWhileLocked?.operationId
      );
      expect(previewEvents[0]?.authoritativeEventLinked).toBe(true);
      expect(previewEvents[0]?.authoritativeOperationId).toBe('auth_op_1');
      expect(previewEvents[0]?.localAuditLifecycleState).toBe(
        'authoritative-link-established'
      );
      expect(getLocalCapAuditLifecycleContract(previewEvents[0]!)).toMatchObject(
        {
          lifecycleState: 'authoritative-link-established',
          localOutcome: 'preview-was-linked',
          authoritativeLinkState: 'linked',
          representsCommittedWorldTruth: false,
        }
      );
    });

    act(() => {
      result.current.actions.handleSetExceptions({
        mle: {
          type: 'non-taxpayer',
          remainingAmount: 8_000_000,
        },
      });
    });

    await waitFor(() => {
      expect(mutationMocks.applyWorldMutation).toHaveBeenCalledTimes(2);
    });
  });

  it('preserves non-editable exception buckets and recomputed totals in the optimistic setExceptions preview', async () => {
    let resolvePersist:
      | ((value: { success: boolean; event: { operationId: string } }) => void)
      | null = null;

    mutationMocks.applyWorldMutation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePersist = resolve as (
            value: { success: boolean; event: { operationId: string } }
          ) => void;
        })
    );

    const initialTeam = {
      ...worldTeamFixture,
      exceptions: {
        tpe: [{ id: 'tpe_keep', totalAmount: 3_200_000 }],
        dpe: {
          enabled: true,
          totalAmount: 4_000_000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
        bae: {
          enabled: true,
          totalAmount: 2_500_000,
          usedAmount: 500_000,
          seasonKey: '2025-26',
        },
      },
    };

    const { result } = renderActionsHarness('world_1', initialTeam);

    act(() => {
      result.current.actions.handleSetExceptions({
        mle: {
          enabled: true,
          totalAmount: 9_000_000,
          usedAmount: 1_500_000,
          seasonKey: '2025-26',
        },
      });
    });

    expect(result.current.teamCapSheet.exceptions).toMatchObject({
      mle: {
        enabled: true,
        totalAmount: 9_000_000,
        usedAmount: 1_500_000,
        seasonKey: '2025-26',
      },
      dpe: initialTeam.exceptions.dpe,
      tpe: initialTeam.exceptions.tpe,
    });
    expect(result.current.teamCapSheet.exceptions?.bae).toBeUndefined();
    expect(result.current.teamCapSheet.totals?.yearKey).toBe(2026);
    expect(result.current.teamCapSheet.totals?.capHit).toBe(
      result.current.teamCapSheet.totals?.totalCapAllocations
    );

    act(() => {
      resolvePersist?.({
        success: true,
        event: { operationId: 'auth_set_exceptions_1' },
      });
    });

    await waitFor(() => {
      expect(isOptimisticLockHeld(LOCK_SCOPE_KEY)).toBe(false);
    });
  });

  it('rolls back the optimistic local preview and marks the preview audit event when persistence fails', async () => {
    let resolvePersistFailure:
      | ((value: { success: boolean; error: string }) => void)
      | null = null;

    mutationMocks.applyWorldMutation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePersistFailure = resolve as (
            value: { success: boolean; error: string }
          ) => void;
        })
    );

    const { result } = renderActionsHarness('world_1');
    const beforeSnapshot = result.current.teamCapSheet;
    let savePromise: Promise<boolean> | null = null;

    act(() => {
      savePromise = result.current.actions.handleSetExceptions({
        mle: {
          type: 'non-taxpayer',
          remainingAmount: 7_500_000,
        },
      });
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledTimes(1);

    const previewEventsBeforeFailure = readLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    expect(previewEventsBeforeFailure).toHaveLength(1);
    const [previewEventBeforeFailure] = previewEventsBeforeFailure;
    expect(previewEventBeforeFailure).toBeDefined();
    expect(previewEventBeforeFailure?.mutationType).toBe('setExceptions');
    expect(previewEventBeforeFailure?.persistFailed).toBeUndefined();
    expect(previewEventBeforeFailure?.authoritativeEventLinked).toBe(false);
    expect(previewEventBeforeFailure?.localAuditLifecycleState).toBe(
      'optimistic-preview-pending'
    );
    expect(result.current.teamCapSheet.exceptions).toEqual({
      mle: {
        type: 'non-taxpayer',
        remainingAmount: 7_500_000,
      },
    });

    let saveResult = true;
    if (!savePromise) {
      throw new Error('Expected save promise to be created for optimistic mutation.');
    }

    await act(async () => {
      resolvePersistFailure?.({
        success: false,
        error: 'Simulated world save failure',
      });
      saveResult = await savePromise;
    });

    expect(saveResult).toBe(false);
    expect(result.current.teamCapSheet).toEqual(beforeSnapshot);
    expect(result.current.teamCapSheet.exceptions).toEqual({});
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Simulated world save failure')
    );
    expect(isOptimisticLockHeld(LOCK_SCOPE_KEY)).toBe(false);

    const previewEvents = readLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    expect(previewEvents).toHaveLength(1);
    expect(previewEvents[0]?.operationId).toBe(
      previewEventBeforeFailure?.operationId
    );
    expect(previewEvents[0]?.mutationType).toBe('setExceptions');
    expect(previewEvents[0]?.persistFailed).toBe(true);
    expect(previewEvents[0]?.authoritativeEventLinked).toBe(false);
    expect(previewEvents[0]?.authoritativeOperationId).toBeUndefined();
    expect(previewEvents[0]?.localAuditLifecycleState).toBe(
      'persist-failed-rolled-back'
    );
    expect(getLocalCapAuditLifecycleContract(previewEvents[0]!)).toMatchObject({
      lifecycleState: 'persist-failed-rolled-back',
      localOutcome: 'rolled-back-after-persist-failure',
      authoritativeLinkState: 'failed',
      representsCommittedWorldTruth: false,
    });
  });

  it('keeps base-mode no-write behavior for optimistic handlers', () => {
    const { result } = renderActionsHarness(null);

    act(() => {
      result.current.actions.handleSetDeadCap([
        {
          id: 'dead_base',
          amountByYear: [{ season: '2025-26', amount: 1_500_000 }],
        },
      ]);
    });

    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
    expect(isOptimisticLockHeld(LOCK_SCOPE_KEY)).toBe(false);
  });
});
