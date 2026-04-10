// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import {
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
  clearLocalCapAuditEvents,
  getLocalCapAuditLifecycleContract,
  readLocalCapAuditEvents,
} from '@/features/architect/utils/capLegality/localCapAuditLog';

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
  computeWorldMutation: mutationMocks.computeWorldMutation,
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

const worldTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  players: [
    {
      id: 'player_1',
      player_id: 'player_1',
      name: 'Test Player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 10_000_000 }],
      },
    },
  ],
  capHolds: [],
  deadCap: [],
  exceptions: {},
  totals: {
    isHardCapped: false,
  },
};

function renderActionsHarness() {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(worldTeamFixture);
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
      worldId: 'world_1',
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet,
    };
  });

  return { result };
}

describe('world optimistic post-state validator gate', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation(
      (teamId: string) => String(teamId || '').toUpperCase()
    );
    mutationMocks.applyWorldMutation.mockResolvedValue({ success: true });
    capTotalsMocks.computeTeamCapTotals.mockImplementation((team: any) => {
      if (Array.isArray(team?.deadCap) && team.deadCap.length > 0) {
        return makeTotals({
          totalCapAllocations: Number.NaN,
        });
      }
      return makeTotals();
    });
    clearLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
  });

  afterEach(() => {
    clearLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
  });

  it('writes the invalid preview audit event before any local commit and blocks world persistence', async () => {
    const { result } = renderActionsHarness();
    const beforeSnapshot = result.current.teamCapSheet;
    let mutationResult = true;

    expect(
      readLocalCapAuditEvents({
        storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
      })
    ).toHaveLength(0);

    await act(async () => {
      mutationResult = await result.current.actions.handleSetDeadCap([
        {
          id: 'dead_cap_invalid',
          amountByYear: [{ season: '2025-26', amount: Number.NaN }],
        },
      ]);
    });

    expect(mutationResult).toBe(false);
    expect(result.current.teamCapSheet).toBe(beforeSnapshot);
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalled();

    const previewEvents = readLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    expect(previewEvents).toHaveLength(1);
    const [previewEvent] = previewEvents;
    expect(previewEvent).toBeDefined();
    expect(previewEvent?.preview).toBe(true);
    expect(previewEvent?.worldId).toBe('world_1');
    expect(previewEvent?.valid).toBe(false);
    expect(previewEvent?.mutationType).toBe('setDeadCap');
    expect(previewEvent?.operationId).toEqual(expect.any(String));
    expect(previewEvent?.authoritativeEventLinked).toBe(false);
    expect(previewEvent?.authoritativeOperationId).toBeUndefined();
    expect(previewEvent?.localAuditLifecycleState).toBe('evaluation-blocked');
    expect(getLocalCapAuditLifecycleContract(previewEvent!)).toMatchObject({
      lifecycleState: 'evaluation-blocked',
      localOutcome: 'blocked-before-apply',
      authoritativeLinkState: 'never-scheduled',
      representsCommittedWorldTruth: false,
    });
  });
});
