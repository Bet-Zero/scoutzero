/**
 * FILE: src/tests/architect/architectHardeningE4.polish.test.ts
 * PURPOSE: Narrow regression proof for the fourth Architect TS hardening pass (E4).
 * Validates the remaining dashboard-shell action/modal boundary contracts after
 * tightening GMDashboard.tsx and useArchitectActions.ts.
 * OWNERSHIP: Feature: architect/ts-hardening
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  preflightSignAndTradeMutation: vi.fn(),
}));

const capTotalsMocks = vi.hoisted(() => ({
  computeTeamCapTotals: vi.fn(),
}));

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveTeamCode: vi.fn(),
}));

const auditLogMocks = vi.hoisted(() => ({
  appendLocalCapAuditEvent: vi.fn(),
  updateLocalCapAuditEvent: vi.fn(() => true),
  withLocalCapAuditLifecycleState: vi.fn((event, lifecycleState) => ({
    ...event,
    localAuditLifecycleState: lifecycleState,
  })),
  buildAuthoritativeLinkEstablishedAuditPatch: vi.fn(
    (authoritativeOperationId: string) => ({
      localAuditLifecycleState: 'authoritative-link-established',
      authoritativeEventLinked: true,
      authoritativeOperationId,
      persistFailed: false,
    })
  ),
  buildPersistFailedRolledBackAuditPatch: vi.fn(() => ({
    localAuditLifecycleState: 'persist-failed-rolled-back',
    authoritativeEventLinked: false,
    authoritativeOperationId: undefined,
    persistFailed: true,
  })),
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

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/capLegality/localCapAuditLog', () => ({
  BASE_CAP_AUDIT_STORAGE_KEY: 'test-base-cap-audit',
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY: 'test-world-cap-audit',
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM: {
    storageKey: 'test-base-cap-audit',
    stateKind: 'local-validated-apply',
    authoritative: false,
    persistsToWorld: false,
    preview: false,
    initialAuthoritativeEventLinked: undefined,
    committedWorldTransition: 'never-links',
  },
  WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM: {
    storageKey: 'test-world-cap-audit',
    stateKind: 'optimistic-local-preview',
    authoritative: false,
    persistsToWorld: 'pending-world-persist',
    preview: true,
    initialAuthoritativeEventLinked: false,
    committedWorldTransition: 'links-on-success-or-rolls-back',
  },
  appendLocalCapAuditEvent: auditLogMocks.appendLocalCapAuditEvent,
  updateLocalCapAuditEvent: auditLogMocks.updateLocalCapAuditEvent,
  withLocalCapAuditLifecycleState: auditLogMocks.withLocalCapAuditLifecycleState,
  buildAuthoritativeLinkEstablishedAuditPatch:
    auditLogMocks.buildAuthoritativeLinkEstablishedAuditPatch,
  buildPersistFailedRolledBackAuditPatch:
    auditLogMocks.buildPersistFailedRolledBackAuditPatch,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const TEST_PLAYER = {
  id: 'p1',
  player_id: 'p1',
  name: 'Test Player',
  displayName: 'Test Player',
  yearsOfService: 5,
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

const OFFER_SHEET_CONTRACT = {
  salariesByYear: [
    {
      season: '2026-27',
      salary: 18_000_000,
      capHit: 18_000_000,
      guaranteed: true,
    },
  ],
  contractType: 'Offer Sheet',
};

const DEAD_CAP_PAYLOAD = [
  {
    playerId: 'dead_1',
    playerName: 'Dead Cap Fixture',
    amountByYear: [
      {
        season: '2025-26',
        amount: 5_000_000,
      },
    ],
    notes: 'Manual Adjustment',
  },
];

function makeTotals(team: typeof BASE_TEAM) {
  const deadMoneyTotal = (team.deadCap || []).reduce((sum, entry) => {
    const seasonRow = (entry.amountByYear || []).find(
      (row) => row.season === '2025-26'
    );
    return sum + Number(seasonRow?.amount || 0);
  }, 0);

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

function renderActionsHarness() {
  const openContractModal = vi.fn();
  const closeContractModal = vi.fn();
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
        worldAsOfDate: null,
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
        openContractModal,
        closeContractModal,
      },
      worldId: null,
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet,
      selectedPlayer,
      selectedRulesYear,
    };
  });

  return {
    result,
    openContractModal,
    closeContractModal,
    refreshWorldRosterIndex,
    startSave,
    finishSave,
  };
}

describe('Architect TypeScript hardening E4 regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(BASE_TEAM);
    capTotalsMocks.computeTeamCapTotals.mockImplementation((team: typeof BASE_TEAM) =>
      makeTotals(team)
    );
  });

  it('opens the contract modal with null preselection when editing a player', () => {
    const { result, openContractModal } = renderActionsHarness();

    act(() => {
      result.current.actions.handleEditContract(TEST_PLAYER);
    });

    expect(result.current.selectedPlayer).toEqual(TEST_PLAYER);
    expect(result.current.selectedRulesYear).toBe(2026);
    expect(openContractModal).toHaveBeenCalledWith({
      initialAction: null,
      targetYear: null,
      actionContext: null,
    });
  });

  it('maps cap-table action types to modal contexts while preserving the clicked year', () => {
    const { result, openContractModal } = renderActionsHarness();

    const cases = [
      ['po', 'option'],
      ['to', 'option'],
      ['ufa', 'freeAgent'],
      ['rfa', 'freeAgent'],
    ] as const;

    cases.forEach(([actionType, expectedContext], index) => {
      act(() => {
        result.current.actions.handleCapTableModalAction(
          TEST_PLAYER,
          actionType,
          2028
        );
      });

      expect(result.current.selectedPlayer).toEqual(TEST_PLAYER);
      expect(result.current.selectedRulesYear).toBe(2028);
      expect(openContractModal).toHaveBeenNthCalledWith(index + 1, {
        initialAction: null,
        targetYear: 2028,
        actionContext: expectedContext,
      });
    });
  });

  it('keeps cap-hold renounce on an immediate path that does not reopen the modal', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result, openContractModal } = renderActionsHarness();

    act(() => {
      result.current.actions.handleCapHoldRenounce({
        playerId: 'hold_only',
        playerName: 'Hold Only',
      });
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Hold Only')
    );
    expect(openContractModal).not.toHaveBeenCalled();
    expect(result.current.selectedPlayer).toBeNull();
    expect(result.current.selectedRulesYear).toBe(2026);
  });

  it('returns the stable offer-sheet failure result when no active world is present', async () => {
    const { result } = renderActionsHarness();

    let actionResult: Awaited<
      ReturnType<typeof result.current.actions.handleStoreOfferSheet>
    >;

    await act(async () => {
      actionResult = await result.current.actions.handleStoreOfferSheet(
        TEST_PLAYER,
        OFFER_SHEET_CONTRACT
      );
    });

    expect(actionResult!).toEqual({
      success: false,
      message: 'Offer sheet actions require an active world to commit.',
    });
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Offer sheet actions require an active world to commit.'
    );
  });

  it('replaces dead-cap state with the provided payload in base mode', async () => {
    const { result } = renderActionsHarness();

    let actionResult = false;

    await act(async () => {
      actionResult = await result.current.actions.handleSetDeadCap(
        DEAD_CAP_PAYLOAD
      );
    });

    expect(actionResult).toBe(true);
    expect(result.current.teamCapSheet.deadCap).toEqual(DEAD_CAP_PAYLOAD);
    expect(auditLogMocks.appendLocalCapAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps DEV fixture tools fenced behind nested local-only namespaces', () => {
    const { result } = renderActionsHarness();

    expect(result.current.actions.capSheetDevTools).toEqual(
      expect.objectContaining({
        injectFixtures: expect.any(Function),
        clearFixtures: expect.any(Function),
        hasInjectedFixtures: false,
        runtimeBoundary: expect.objectContaining({
          activationFlag: 'hz.dev.capSheetFixtures',
          authoritative: false,
          persistence: 'none',
        }),
      })
    );
    expect(result.current.actions.teamHistoryDevTools).toEqual(
      expect.objectContaining({
        injectFixtures: expect.any(Function),
        clearFixtures: expect.any(Function),
        hasInjectedFixtures: false,
      })
    );

    let capSheetFixtureResult: { success: boolean; message?: string } | null = null;
    let teamHistoryFixtureResult: { success: boolean; message?: string } | null = null;

    act(() => {
      capSheetFixtureResult = result.current.actions.capSheetDevTools.injectFixtures();
      teamHistoryFixtureResult =
        result.current.actions.teamHistoryDevTools.injectFixtures();
    });

    expect(capSheetFixtureResult).toEqual({ success: true });
    expect(teamHistoryFixtureResult).toEqual({ success: true });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
    expect(auditLogMocks.appendLocalCapAuditEvent).not.toHaveBeenCalled();
    expect(auditLogMocks.updateLocalCapAuditEvent).not.toHaveBeenCalled();
  });
});
