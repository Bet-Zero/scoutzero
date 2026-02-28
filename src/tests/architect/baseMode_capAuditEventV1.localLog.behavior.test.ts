// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import {
  BASE_CAP_AUDIT_STORAGE_KEY,
  MAX_LOCAL_CAP_AUDIT_EVENTS,
  appendLocalCapAuditEvent,
  clearLocalCapAuditEvents,
  readLocalCapAuditEvents,
  type CapAuditEventV1Like,
} from '@/features/architect/utils/capLegality/localCapAuditLog';

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
  computeWorldMutation: vi.fn(),
}));

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveTeamCode: vi.fn(),
}));

vi.mock('@/features/architect/utils/mutationPipeline', () => ({
  applyWorldMutation: mutationMocks.applyWorldMutation,
  computeWorldMutation: mutationMocks.computeWorldMutation,
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  players: [
    {
      id: 'player_1',
      player_id: 'player_1',
      name: 'Test Player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 12_000_000 }],
      },
    },
  ],
  capHolds: [],
  deadCap: [],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      usedAmount: 0,
      remainingAmount: 12_500_000,
    },
  },
  totals: {
    isHardCapped: false,
  },
};

function makeEvent(operationId: string): CapAuditEventV1Like {
  return {
    schemaVersion: 'cap-audit-event-v1',
    validatorVersion: '0.1.0',
    operationId,
    mutationType: 'setExceptions',
    occurredAt: new Date().toISOString(),
    worldId: null,
    teamCodes: ['LAL'],
    playerIds: [],
    beforeTotalsByTeam: {},
    afterTotalsByTeam: {},
    valid: true,
    violations: [],
    warnings: [],
    diffSummary: {},
  };
}

function renderActionsHarness(worldId: string | null) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(baseTeamFixture);
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
      selectedRulesYear,
      selectedPlayer,
      freeAgents,
      offseasonRun,
      offseasonSummary,
    };
  });

  return { result };
}

describe('base mode CapAuditEventV1 local log behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation(
      (teamId: string) => String(teamId || '').toUpperCase()
    );
    clearLocalCapAuditEvents({ storageKey: BASE_CAP_AUDIT_STORAGE_KEY });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLocalCapAuditEvents({ storageKey: BASE_CAP_AUDIT_STORAGE_KEY });
  });

  it('appends a CapAuditEventV1-like record with required fields for a base-mode cap-changing action', () => {
    const { result } = renderActionsHarness(null);

    act(() => {
      result.current.actions.handleSetExceptions({
        ...baseTeamFixture.exceptions,
        bae: {
          type: 'BAE',
          usedAmount: 2_000_000,
          remainingAmount: 2_700_000,
        },
      });
    });

    const events = readLocalCapAuditEvents({
      storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
    });
    expect(events.length).toBeGreaterThan(0);

    const lastEvent = events[events.length - 1];
    expect(lastEvent.schemaVersion).toBe('cap-audit-event-v1');
    expect(lastEvent.validatorVersion).toBeTruthy();
    expect(lastEvent.operationId).toMatch(/^op_/);
    expect(lastEvent.mutationType).toBe('setExceptions');
    expect(lastEvent.worldId).toBeNull();
    expect(lastEvent.teamCodes).toEqual(['LAL']);
    expect(Array.isArray(lastEvent.playerIds)).toBe(true);
    expect(lastEvent.beforeTotalsByTeam.LAL).toBeDefined();
    expect(lastEvent.afterTotalsByTeam.LAL).toBeDefined();
    expect(typeof lastEvent.valid).toBe('boolean');
    expect(Array.isArray(lastEvent.violations)).toBe(true);
    expect(Array.isArray(lastEvent.warnings)).toBe(true);
    expect(lastEvent.diffSummary).toBeDefined();
  });

  it('caps log size and falls back to in-memory storage when window is unavailable', () => {
    clearLocalCapAuditEvents({ storageKey: BASE_CAP_AUDIT_STORAGE_KEY });
    vi.stubGlobal('window', undefined);

    for (let i = 0; i < MAX_LOCAL_CAP_AUDIT_EVENTS + 25; i += 1) {
      appendLocalCapAuditEvent(makeEvent(`op_memory_${i}`));
    }

    const events = readLocalCapAuditEvents();
    expect(events).toHaveLength(MAX_LOCAL_CAP_AUDIT_EVENTS);
    expect(events[0].operationId).toBe('op_memory_25');
    expect(events[MAX_LOCAL_CAP_AUDIT_EVENTS - 1].operationId).toBe(
      `op_memory_${MAX_LOCAL_CAP_AUDIT_EVENTS + 24}`
    );
  });
});
